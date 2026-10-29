/* Reproduce a real 0.3 offline cache, migrate during a flight, then update again. */
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const root = __dirname,
  repo = path.resolve(root, ".."),
  oldFiles = new Map();
for (const name of [
  "index.html",
  "app.js",
  "engine.js",
  "progression.js",
  "services.js",
  "config.js",
  "style.css",
  "sw.js",
  "manifest.webmanifest",
])
  oldFiles.set(
    name,
    execFileSync("git", ["show", `91d78c1:star-dodge/${name}`], { cwd: repo }),
  );
let phase = "old";
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost"),
    relative = url.pathname.replace(/^\/star-dodge\//, "") || "index.html";
  let body;
  try {
    if (relative === "version.json")
      body = Buffer.from(
        JSON.stringify({
          version:
            phase === "old" ? "0.3.0" : phase === "next" ? "0.5.1" : "0.5.0",
        }),
      );
    else if (phase === "old" && oldFiles.has(relative))
      body = oldFiles.get(relative);
    else {
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) throw Error();
      body = fs.readFileSync(file);
    }
    if (phase === "next" && /\.(js|html)$/.test(relative))
      body = Buffer.from(
        body
          .toString()
          .replaceAll("0.5.0", "0.5.1")
          .replaceAll("v0-5-0", "v0-5-1"),
      );
    if (relative === "app.js" && url.searchParams.get("v") === "9.9.9")
      body = Buffer.from("/* future asset cache-key probe */");
    const ext = path.extname(relative),
      mime =
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".webmanifest": "application/manifest+json",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        }[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": mime, "cache-control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext(),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.addInitScript(() => {
      if (!localStorage.getItem("star-dodge-progress-v1"))
        localStorage.setItem(
          "star-dodge-progress-v1",
          JSON.stringify({ version: 1, credits: 77 }),
        );
      let api;
      Object.defineProperty(window, "StarDodge", {
        get: () => api,
        set(value) {
          api = value;
          const Base = value.Game;
          value.Game = class extends Base {
            constructor(...a) {
              super(...a);
              window.testGame = this;
            }
          };
        },
      });
    });
    const base = `http://127.0.0.1:${server.address().port}/star-dodge/`;
    await page.goto(base);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.reload();
    assert.ok(
      (await page.locator(".page-footer").innerText()).includes("V0.3"),
    );
    await page
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    await page.waitForFunction(() => testGame.state === "playing");
    await page.evaluate(() => {
      testGame.player.invincible = 1000;
    });
    const oldState = await page.evaluate(() => ({
      radius: testGame.player.radius,
      stage: testGame.stage ?? null,
    }));
    assert.equal(oldState.radius, 10);
    phase = "new";
    await page.evaluate(async () => {
      const changed = new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
      await changed;
    });
    await page.waitForFunction(
      async () =>
        (await caches.has("star-dodge-shell-v0-5-0")) &&
        !(await caches.has("star-dodge-shell-v0-3-0")),
    );
    assert.equal(
      await page.evaluate(() => testGame.player.radius),
      10,
      "activating a new worker must not replace a live game",
    );
    assert.equal(await page.evaluate(() => testGame.state), "playing");
    await page.reload();
    assert.ok(
      (await page.locator(".page-footer").innerText()).includes("0.5.0"),
    );
    assert.equal(await page.evaluate(() => StarDodge.CONFIG.player.radius), 6);
    assert.equal(await page.evaluate(() => StarStages.STAGES.length), 10);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
      ),
      77,
    );
    assert.ok(
      !/クレジット|\bCR\b/.test(await page.locator("body").innerText()),
    );
    assert.ok(
      (
        await page.evaluate(() => fetch("app.js?v=9.9.9").then((r) => r.text()))
      ).includes("future asset cache-key probe"),
      "new asset URLs must not receive old cached scripts",
    );
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.ok(
      (await page.locator(".page-footer").innerText()).includes("0.5.0"),
    );
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page.getByText(/確認できませんでした/).waitFor();
    await page.locator('[data-hub="stages"]').click();
    assert.equal(await page.locator(".stage-card").count(), 10);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await context.setOffline(false);
    phase = "next";
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector(".page-footer")?.textContent.includes("0.5.1"),
    );
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page.getByText("最新版です（0.5.1）", { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
      ),
      77,
    );
    // A player may start a flight while the manual version request is pending.
    let releaseVersion;
    const versionGate = new Promise((resolve) => {
      releaseVersion = resolve;
    });
    await context.route("**/version.json", async (route) => {
      await versionGate;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ version: "0.5.2" }),
      });
    });
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    await page
      .getByRole("button", { name: "最新版を確認", exact: true })
      .click();
    await page
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    releaseVersion();
    await page.getByText(/フライト終了後にもう一度/).waitFor();
    assert.equal(navigations, 0);
    assert.ok(
      ["countdown", "playing"].includes(
        await page.evaluate(() => testGame.state),
      ),
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS: real 0.3 cache → 0.5 worker during flight without interruption → current HTML/scripts; preserved coins; exact asset versions; offline boot; explicit subsequent update",
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
});
