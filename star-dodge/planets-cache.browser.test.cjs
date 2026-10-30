/* Deliver forty stages over PR-A's real cache while both releases are 0.5.0. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const root = __dirname,
  previous = new Map();
for (const name of [
  "index.html",
  "app.js",
  "engine.js",
  "stages.js",
  "progression.js",
  "effects.js",
  "audio.js",
  "services.js",
  "config.js",
  "style.css",
  "sw.js",
  "manifest.webmanifest",
])
  previous.set(
    name,
    execFileSync("git", ["show", `fde97a3:star-dodge/${name}`], { cwd: root }),
  );
let phase = "pr-a";
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost"),
    name = url.pathname.replace(/^\/star-dodge\//, "") || "index.html";
  try {
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) throw Error();
    const body =
      phase === "pr-a" && previous.has(name)
        ? previous.get(name)
        : fs.readFileSync(file);
    const mime = {
      ".js": "text/javascript",
      ".html": "text/html",
      ".css": "text/css",
      ".json": "application/json",
      ".webmanifest": "application/manifest+json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    }[path.extname(name)];
    res.writeHead(200, {
      "content-type": mime || "application/octet-stream",
      "cache-control": "no-cache",
    });
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
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.addInitScript(() => {
      if (!localStorage.getItem("star-dodge-progress-v1"))
        localStorage.setItem(
          "star-dodge-progress-v1",
          JSON.stringify({
            version: 1,
            credits: 432,
            clearedStages: Array.from({ length: 10 }, (_, i) => i + 1),
            selectedStage: 10,
            selectedShip: "lance",
            unlocked: ["pioneer", "lance"],
          }),
        );
      let api;
      Object.defineProperty(window, "StarDodge", {
        get: () => api,
        set(value) {
          api = value;
          const Base = value.Game;
          value.Game = class extends Base {
            constructor(...args) {
              super(...args);
              window.testGame = this;
            }
          };
        },
      });
    });
    const base = `http://127.0.0.1:${server.address().port}/star-dodge/`;
    const epoch = new Date("2030-01-01T00:00:00Z");
    await page.clock.install({ time: epoch });
    await page.clock.pauseAt(new Date(epoch.getTime() + 1000));
    await page.goto(base);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    await page.reload();
    assert.equal(await page.evaluate(() => StarStages.STAGES.length), 10);
    assert.ok(
      await page.evaluate(() =>
        caches.has("star-dodge-shell-v0-5-0-four-ships"),
      ),
    );
    await page
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    await page.clock.runFor(3300);
    assert.equal(await page.evaluate(() => testGame.state), "playing");
    await page.evaluate(() => {
      testGame.player.invincible = 1000;
    });
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    phase = "pr-b";
    await page.evaluate(async () => {
      const changed = new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
      await (await navigator.serviceWorker.getRegistration()).update();
      await changed;
    });
    await page.waitForFunction(
      async () =>
        (await caches.has("star-dodge-shell-v0-5-0-planets-40")) &&
        !(await caches.has("star-dodge-shell-v0-5-0-four-ships")),
    );
    assert.equal(navigations, 0);
    assert.equal(await page.evaluate(() => testGame.state), "playing");
    assert.equal(await page.evaluate(() => testGame.stage.name), "最後の星門");
    assert.equal(await page.evaluate(() => StarStages.STAGES.length), 10);
    // The running game stays intact; the next navigation receives one coherent new shell.
    await page.reload();
    assert.equal(await page.evaluate(() => StarStages.STAGES.length), 40);
    assert.ok(
      (await page.locator(".page-footer").innerText()).includes("0.5.0"),
    );
    assert.equal(
      await page.locator(".stage-summary strong").innerText(),
      "水星 ステージ5",
    );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("star-dodge-progress-v1")),
    );
    assert.equal(saved.credits, 432);
    assert.equal(saved.selectedShip, "lance");
    assert.equal(saved.selectedStage, 10);
    assert.deepEqual(
      saved.clearedStages,
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-hub="stages"]').click();
    assert.equal(await page.locator(".planet-card").count(), 8);
    fs.mkdirSync("/workspace/artifacts/star-dodge-planets-40", {
      recursive: true,
    });
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 360, height: 640 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      assert.ok(
        await page
          .locator("#hub")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      );
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-planets-40/planets-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page.locator('[data-planet="3"]').click();
    assert.equal(await page.locator(".stage-card").count(), 5);
    assert.equal(await page.locator('[data-stage="11"]').isDisabled(), false);
    assert.equal(await page.locator('[data-stage="12"]').isDisabled(), true);
    await page.locator('[data-stage="11"]').click();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    assert.equal(
      await page.locator(".stage-summary strong").innerText(),
      "金星 ステージ1",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(
      await page.locator(".stage-summary strong").innerText(),
      "金星 ステージ1",
    );
    await page
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    await page.clock.runFor(3300);
    assert.equal(await page.evaluate(() => testGame.state), "playing");
    assert.equal(await page.evaluate(() => testGame.stage.id), 11);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "PASS: real PR-A 0.5.0 cache → PR-B 0.5.0 cache during flight without interruption; preserved ten-stage save; forty-stage offline selection/launch; eight planet themes at three viewport sizes",
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
});
