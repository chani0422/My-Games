const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");
const { fresh } = require("./progression.js");
const base = process.env.STAR_DODGE_URL || "http://127.0.0.1:8001/star-dodge/";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 360, height: 640 },
      { width: 1440, height: 1000 },
    ]) {
      const context = await browser.newContext({
        viewport,
        serviceWorkers: "block",
        acceptDownloads: true,
      });
      const page = await context.newPage(),
        errors = [],
        external = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (new URL(r.url()).origin !== new URL(base).origin)
          external.push(r.url());
      });
      await context.addInitScript(
        (profile) => {
          if (!localStorage.getItem("star-dodge-progress-v1"))
            localStorage.setItem(
              "star-dodge-progress-v1",
              JSON.stringify(profile),
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
          window.shared = [];
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async (data) => {
              window.shared.push(data);
            },
          });
        },
        { ...fresh(), credits: 300, totalMs: 240000, flights: 4 },
      );
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page
        .getByRole("button", { name: "ショップ", exact: false })
        .click();
      assert.equal(await page.locator(".skin-card").count(), 6);
      await page.locator('[data-skin="solar"]').click();
      assert.equal(
        await page.locator('[data-skin="solar"]').isDisabled(),
        true,
      );
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
        ),
        220,
      );
      await page.locator('[data-skin="aurora"]').click();
      await page.locator('[data-skin="solar"]').click();
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
        ),
        220,
      );
      await fs.mkdir("/workspace/artifacts/star-dodge-0.5-screens", {
        recursive: true,
      });
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-0.5-screens/shop-${viewport.width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page
        .getByRole("button", { name: "ライセンス", exact: false })
        .click();
      assert.ok(
        (await page.locator("#hub-content").innerText()).includes("RANK 3"),
      );
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page
        .getByRole("button", { name: "遊び方・設定", exact: false })
        .click();
      assert.equal(await page.locator(".play-guide").isVisible(), true);
      await page.getByLabel("演出を控えめにする", { exact: false }).check();
      assert.equal(
        await page.locator("html").getAttribute("class"),
        "reduce-effects",
      );
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page.reload();
      await page.clock.runFor(50);
      assert.equal(
        await page.locator("html").getAttribute("class"),
        "reduce-effects",
      );
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-0.5-screens/home-${viewport.width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      const hud = await page.locator(".instrument").boundingBox(),
        field = await page.locator("canvas").boundingBox();
      assert.ok(
        hud.y >= 0 && field.y + field.height <= viewport.height,
        "flight HUD and field fit after opening home menus",
      );
      assert.equal(await page.evaluate(() => testGame.player.color), "#ffd77a");
      await page.clock.runFor(3300);
      await page.evaluate(() => {
        testGame.ticks = 3600;
        testGame.time = 60;
        testGame.destroyed = 25;
        testGame.rockAt = 100;
        testGame.itemAt = 100;
        testGame.mainAt = 100;
        testGame.player.hp = 1;
        testGame.bullets = [];
        testGame.levels.speed = 3;
        testGame.rocks = [
          {
            x: testGame.player.x,
            y: testGame.player.y,
            radius: 16,
            hp: 999,
            maxHp: 999,
            speed: 0,
            rotation: 0,
            spin: 0,
            shape: Array(10).fill(1),
          },
        ];
      });
      await page.clock.runFor(50);
      assert.equal(await page.evaluate(() => testGame.state), "result");
      assert.ok(
        (await page.locator(".flight-reward").innerText()).includes(
          "+26 コイン",
        ),
      );
      const bounds = await page.locator("#panel").boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-0.5-screens/result-${viewport.width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "記録を共有", exact: false })
        .click();
      assert.equal(await page.evaluate(() => shared.length), 1);
      assert.ok(
        (await page.evaluate(() => shared[0].text)).includes("60.0秒生存"),
      );
      // A cancelled system share does not claim success or open an extra dialog.
      await page.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async () => {
            throw new DOMException("cancel", "AbortError");
          },
        }),
      );
      await page
        .getByRole("button", { name: "記録を共有", exact: false })
        .click();
      assert.equal(await page.locator("#hub").evaluate((e) => e.open), false);
      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.copiedResult = text;
            },
          },
        });
      });
      await page
        .getByRole("button", { name: "記録を共有", exact: false })
        .click();
      assert.ok(
        (await page.locator("#share-status").innerText()).includes(
          "記録をコピーしました",
        ),
      );
      assert.ok(
        (await page.evaluate(() => copiedResult)).includes("60.0秒生存"),
      );
      // If platform APIs are absent, offer selectable text rather than losing the result.
      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
      });
      await page
        .getByRole("button", { name: "記録を共有", exact: false })
        .click();
      assert.ok(
        (await page.locator("#share-text").inputValue()).includes(
          "https://chani0422.github.io/My-Games/star-dodge/",
        ),
      );
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page.getByRole("button", { name: "ホームへ", exact: true }).click();
      await page
        .getByRole("button", { name: "フライト記録", exact: false })
        .click();
      assert.equal(await page.locator(".history-card").count(), 1);
      assert.ok(
        (await page.locator(".history-card").innerText()).includes(
          "ゴールド",
        ),
      );
      assert.ok(
        (await page.locator(".history-card").innerText()).includes(
          "SPEED 1 → 3",
        ),
      );
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "記録をJSONでダウンロード" })
        .click();
      const download = await downloadPromise;
      assert.equal(
        download.suggestedFilename(),
        "star-dodge-play-records.json",
      );
      const report = JSON.parse(
        await fs.readFile(await download.path(), "utf8"),
      );
      assert.equal(report.summary.flights, 5);
      assert.equal(report.recentRuns[0].coins, 26);
      assert.ok(!/email|token|credits|settled/.test(JSON.stringify(report)));
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${viewport.width}px: skins, rank, motion persistence, result/history, share and download; no external requests`,
      );
      await context.close();
    }
    const reduced = await browser.newContext({
        reducedMotion: "reduce",
        serviceWorkers: "block",
      }),
      rp = await reduced.newPage();
    await rp.goto(base);
    assert.equal(
      await rp.locator("html").getAttribute("class"),
      "reduce-effects",
    );
    await reduced.close();
    console.log("PASS: device reduced-motion preference takes priority");
    const native = await browser.newContext({ serviceWorkers: "block" });
    await native.addInitScript(() => {
      window.nativeListeners = {};
      window.Capacitor = {
        isNativePlatform: () => true,
        registerPlugin: () => ({
          addListener: async (name, listener) => {
            nativeListeners[name] = listener;
          },
          minimizeApp: async () => {},
        }),
      };
    });
    const np = await native.newPage();
    await np.goto(base);
    await np
      .getByRole("button", { name: "フライト記録", exact: false })
      .click();
    await np
      .getByRole("button", { name: "記録をJSONで表示", exact: true })
      .click();
    assert.equal(
      JSON.parse(
        await np.getByLabel("プレイ記録", { exact: true }).inputValue(),
      ).game,
      "STAR DODGE",
    );
    await np.evaluate(() => nativeListeners.backButton());
    assert.equal(await np.locator("#hub").evaluate((e) => e.open), false);
    await np
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    await np.evaluate(() =>
      nativeListeners.appStateChange({ isActive: false }),
    );
    assert.ok(
      await np
        .getByRole("button", { name: "フライトを再開", exact: true })
        .isVisible(),
    );
    await native.close();
    console.log(
      "PASS: mocked native JSON fallback, back handler and background pause",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
