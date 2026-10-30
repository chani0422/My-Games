const assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const { chromium } = require("playwright");
const { calculateFlightReward } = require("./progression.js");
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
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await context.addInitScript(() => {
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
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      assert.ok(
        (await page.locator("#flight-label").innerText()).includes("出現30秒"),
      );
      await page.evaluate(() => {
        const g = testGame;
        g.ticks = 1799;
        g.time = 1799 / 60;
        g.player.invincible = 1000;
        g.mainAt = g.subAt = Infinity;
        g.rockAt = g.itemAt = g.eventAt = 30;
        g.bullets = [];
        g.rocks = [
          {
            type: "meteor",
            x: 150,
            y: 100,
            radius: 16,
            hp: 1,
            maxHp: 1,
            speed: 0,
            age: 0,
            rotation: 0,
            spin: 0,
            shape: Array(10).fill(1),
          },
          {
            type: "gunner",
            x: 330,
            y: 150,
            radius: 16,
            hp: 2,
            maxHp: 2,
            speed: 0,
            age: 3,
            nextShot: 0,
            rotation: 0,
            spin: 0,
            shape: Array(10).fill(1),
          },
        ];
        g.items = [
          { type: "core", x: 24, y: 24, radius: 16, scheduled: false },
        ];
      });
      await page.clock.runFor(50);
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      assert.equal(await page.evaluate(() => testGame.elimination), true);
      assert.equal(await page.evaluate(() => testGame.rocks.length), 2);
      assert.equal(await page.evaluate(() => testGame.enemyBullets.length), 0);
      assert.ok(
        (await page.locator("#toast").innerText()).includes(
          "TIME UP — 残りの隕石を殲滅せよ",
        ),
      );
      assert.ok(
        (await page.locator("#flight-label").innerText()).includes("残り 2"),
      );
      const fullBar = () =>
        page.evaluate(() => {
          const c = document.getElementById("game");
          return Array.from(
            c
              .getContext("2d")
              .getImageData(
                Math.floor((c.width * 470) / 480),
                Math.floor((c.height * 1) / 720),
                1,
                1,
              ).data,
          ).slice(0, 3);
        });
      assert.deepEqual(await fullBar(), [113, 243, 224]);
      await fs.mkdir("/workspace/artifacts/star-dodge-elimination", {
        recursive: true,
      });
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-elimination/phase-${viewport.width}.png`,
        fullPage: true,
      });
      await page.evaluate(() => {
        window.loopedRock = testGame.rocks[0];
        loopedRock.y = 720 + loopedRock.radius + 1;
      });
      await page.clock.runFor(34);
      assert.equal(
        await page.evaluate(() => testGame.rocks[0] === loopedRock),
        true,
      );
      assert.ok(await page.evaluate(() => loopedRock.y < 0));
      assert.equal(await page.evaluate(() => loopedRock.hp), 1);
      // The core existed before the deadline and remains usable during elimination.
      await page.evaluate(() => {
        testGame.items[0].x = testGame.player.x;
        testGame.items[0].y = testGame.player.y;
      });
      await page.clock.runFor(34);
      assert.equal(await page.evaluate(() => testGame.state), "upgrade");
      const frozen = await page.evaluate(() => testGame.time);
      await page.clock.runFor(1000);
      assert.equal(await page.evaluate(() => testGame.time), frozen);
      await page.locator('[data-choice="0"]').click();
      assert.equal(await page.evaluate(() => testGame.elimination), true);
      await page.evaluate(() => {
        const g = testGame,
          r = g.rocks[0];
        g.mainAt = g.subAt = Infinity;
        g.bullets = [{ x: r.x, y: r.y, vx: 0, vy: 0, radius: 3, damage: 1 }];
      });
      await page.clock.runFor(34);
      assert.ok(
        (await page.locator("#flight-label").innerText()).includes("残り 1"),
      );
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      await page.evaluate(() => {
        testGame.ticks = 2099;
        testGame.time = 2099 / 60;
      });
      await page.clock.runFor(34);
      assert.deepEqual(await fullBar(), [113, 243, 224]);
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("star-dodge-progress-v1")).flights,
        ),
        0,
      );
      await page.evaluate(() => {
        const r = testGame.rocks[0];
        testGame.bullets = [
          { x: r.x, y: r.y, vx: 0, vy: 0, radius: 3, damage: 2 },
        ];
        testGame.enemyBullets = [{ x: 20, y: 20, vx: 0, vy: 0, radius: 3 }];
      });
      await page.clock.runFor(50);
      assert.equal(await page.evaluate(() => testGame.outcome), "cleared");
      assert.equal(await page.evaluate(() => testGame.enemyBullets.length), 1);
      await page
        .getByRole("heading", { name: "地球 ステージ1 クリア！", exact: true })
        .waitFor();
      const data = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1")),
        ),
        row = data.recentRuns[0];
      assert.ok(row.ms >= 35000);
      assert.equal(
        row.ms,
        await page.evaluate(() => Math.floor(testGame.time * 1000)),
      );
      assert.equal(row.cleared, true);
      assert.equal(data.selectedStage, 2);
      assert.deepEqual(data.clearedStages, [1]);
      const expected =
        calculateFlightReward(row.ms, row.destroyed).totalCoins + 5;
      assert.equal(data.credits, expected);
      assert.ok(
        (await page.locator(".flight-reward").innerText()).includes(
          `+${expected} コイン`,
        ),
      );
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-elimination/clear-${viewport.width}.png`,
        fullPage: true,
      });
      await page.clock.runFor(1000);
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
        ),
        expected,
      );
      await page
        .getByRole("button", { name: "地球 ステージ2へ進む", exact: false })
        .click();
      assert.equal(await page.evaluate(() => testGame.elimination), false);
      assert.ok(
        (await page.locator("#flight-label").innerText()).includes("出現30秒"),
      );
      await page.keyboard.press("p");
      await page
        .getByRole("button", { name: "タイトルへ", exact: true })
        .click();
      await page.locator('[data-hub="stages"]').click();
      await page.locator('[data-mode="endless"]').click();
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      await page.evaluate(() => {
        testGame.ticks = 1799;
        testGame.time = 1799 / 60;
        testGame.rockAt = testGame.itemAt = 30;
        testGame.player.invincible = 1000;
      });
      await page.clock.runFor(34);
      assert.equal(await page.evaluate(() => testGame.elimination), false);
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      assert.ok(
        (await page.locator("#flight-label").innerText()).includes("ENDLESS"),
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${viewport.width}px: deadline banner/remaining HUD/full bar, recycled target, old core choice, real-time clear/reward/next stage, unchanged endless UI`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
