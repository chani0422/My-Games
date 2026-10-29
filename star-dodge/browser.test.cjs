/* Optional browser suite. Requires Playwright and a locally running HTTP server. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");
const base = process.env.STAR_DODGE_URL || "http://127.0.0.1:8001/star-dodge/";
const output = process.env.STAR_DODGE_ARTIFACTS || "/tmp/star-dodge-checks";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        deviceScaleFactor: mobile ? 3 : 1,
        isMobile: mobile,
        hasTouch: mobile,
      });
      const errors = [];
      let externalRequests = 0;
      await context.addInitScript(() => {
        // Capture the simulation through the exported constructor for controlled test fixtures only.
        let api;
        Object.defineProperty(window, "StarDodge", {
          configurable: true,
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
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (!request.url().startsWith(new URL(base).origin)) externalRequests++;
      });
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "true",
      );
      assert.ok(
        await page.getByRole("button", { name: "フライト開始" }).isVisible(),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `${output}/${mobile ? "mobile" : "desktop"}-title.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "フライト開始" }).click();
      await page.clock.runFor(600);
      const box = await page.locator("canvas").boundingBox();
      assert.ok(Math.abs(box.width / box.height - 2 / 3) < 0.002);
      assert.ok(box.x >= 0);
      assert.ok(box.x + box.width <= (mobile ? 390 : 1440));

      assert.equal(await page.evaluate(() => testGame.time), 0);
      await page.getByRole("button", { name: "一時停止", exact: true }).click();
      const countdown = await page.evaluate(() => testGame.countdown);
      await page.clock.runFor(5000);
      assert.equal(await page.evaluate(() => testGame.countdown), countdown);
      await page.getByRole("button", { name: "フライトを再開" }).click();
      await page.clock.runFor(3100);
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      const origin = await page.evaluate(() => ({
        x: testGame.player.x,
        y: testGame.player.y,
      }));
      if (mobile) {
        const session = await context.newCDPSession(page);
        const from = {
          x: box.x + box.width * 0.2,
          y: box.y + box.height * 0.5,
        };
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [from],
        });
        assert.equal(
          await page.evaluate(() => testGame.player.x),
          origin.x,
          "touch down must not teleport",
        );
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: from.x + 30, y: from.y - 35 }],
        });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        const moved = await page.evaluate(() => ({
          x: testGame.player.x,
          y: testGame.player.y,
        }));
        assert.ok(
          moved.x > origin.x && moved.y < origin.y,
          "touch drag moves ship relatively",
        );
      } else {
        await page.keyboard.down("ArrowLeft");
        await page.clock.runFor(300);
        await page.keyboard.up("ArrowLeft");
        assert.ok(await page.evaluate((x) => testGame.player.x < x, origin.x));
        await page.keyboard.down("w");
        await page.clock.runFor(200);
        await page.keyboard.up("w");
        assert.ok(await page.evaluate((y) => testGame.player.y < y, origin.y));
      }
      await page.keyboard.press("p");
      assert.equal(await page.evaluate(() => testGame.state), "paused");
      const frozen = await page.evaluate(() =>
        JSON.stringify({
          time: testGame.time,
          rocks: testGame.rocks,
          bullets: testGame.bullets,
          items: testGame.items,
        }),
      );
      await page.clock.runFor(2000);
      assert.equal(
        await page.evaluate(() =>
          JSON.stringify({
            time: testGame.time,
            rocks: testGame.rocks,
            bullets: testGame.bullets,
            items: testGame.items,
          }),
        ),
        frozen,
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      await page.keyboard.down("d");
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.clock.runFor(1000);
      assert.equal(await page.evaluate(() => testGame.state), "paused");
      assert.deepEqual(await page.evaluate(() => testGame.input), {
        x: 0,
        y: 0,
      });
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      assert.equal(await page.evaluate(() => testGame.state), "paused");
      await page.getByRole("button", { name: "フライトを再開" }).click();
      // Build an observable late-game scene without changing production code or disabling assertions.
      await page.evaluate(() => {
        testGame.player.invincible = 50;
        testGame.rocks = [];
        testGame.player.x = 240;
        testGame.player.y = 576;
        testGame.collect({ type: "sub", x: 240, y: 576 });
        testGame.collect({ type: "multi", x: 240, y: 576 });
      });
      await page.clock.runFor(17000);
      assert.equal(await page.evaluate(() => testGame.state), "upgrade");
      await page.keyboard.press("1");
      await page.clock.runFor(5000);
      assert.ok(await page.evaluate(() => testGame.time >= 15));
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      await page.screenshot({
        path: `${output}/${mobile ? "mobile" : "desktop"}-playing.png`,
        fullPage: true,
      });
      // Exercise real hit processing -> result -> persistence -> retry through the live UI.
      await page.evaluate(() => {
        testGame.player.invincible = 0;
        testGame.player.hp = 1;
        testGame.bullets = [];
        testGame.mainAt = testGame.time + 10;
        testGame.rocks = [
          {
            x: testGame.player.x,
            y: testGame.player.y,
            radius: 16,
            hp: 99,
            maxHp: 99,
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
        await page
          .getByText("✦ NEW PERSONAL BEST", { exact: true })
          .isVisible(),
      );
      const best = await page.evaluate(
        () => JSON.parse(localStorage.getItem("star-dodge-v1")).best,
      );
      assert.ok(best > 15000);
      await page.screenshot({
        path: `${output}/${mobile ? "mobile" : "desktop"}-result.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "同じステージに挑戦" }).click();
      assert.equal(await page.evaluate(() => testGame.player.hp), 3);
      assert.deepEqual(await page.evaluate(() => testGame.levels), {
        speed: 1,
        multi: 1,
        sub: 0,
      });
      assert.equal(await page.evaluate(() => testGame.time), 0);
      await page.reload();
      await page.clock.runFor(100);
      assert.equal(
        await page.locator("#side-best").textContent(),
        (Math.floor(best / 100) / 10).toFixed(1),
      );
      await page.getByRole("button", { name: "SOUND ON" }).click();
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "false",
      );
      await page.reload();
      await page.clock.runFor(50);
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "false",
      );
      assert.deepEqual(errors, []);
      assert.equal(externalRequests, 0);
      console.log(
        `PASS: ${mobile ? "mobile touch / 390×844" : "desktop keyboard / 1440×1000"} — countdown, movement, pause, focus loss, upgrades, gameover, retry, storage, sound, layout; no JS errors or external requests`,
      );
      await context.close();
    }
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    const page = await context.newPage();
    await page.goto(base);
    assert.ok(
      await page
        .getByText("記録はこのタブ内のみ保持", { exact: true })
        .isVisible(),
    );
    await page.getByRole("button", { name: "フライト開始" }).click();
    console.log(
      "PASS: storage denied — game still starts and tab-only notice is visible",
    );
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
