const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");
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
        window.hitboxArcs = [];
        const arc = CanvasRenderingContext2D.prototype.arc;
        CanvasRenderingContext2D.prototype.arc = function (...args) {
          if (args[2] === 5.25) hitboxArcs.push(args.slice(0, 3));
          return arc.apply(this, args);
        };
      });
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      assert.ok(
        (await page.locator(".page-footer").innerText()).includes("0.5.0"),
      );
      await page
        .getByRole("button", { name: "最新版を確認", exact: true })
        .click();
      await page.getByText("最新版です（0.5.0）", { exact: true }).waitFor();
      await page.locator('[data-hub="stages"]').click();
      assert.equal(await page.locator(".stage-card").count(), 10);
      assert.equal(await page.locator('[data-stage="2"]').isDisabled(), true);
      await fs.mkdir("/workspace/artifacts/star-dodge-0.5-screens", {
        recursive: true,
      });
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-0.5-screens/stages-${viewport.width}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      assert.equal(await page.evaluate(() => testGame.stage.id), 1);
      assert.equal(await page.evaluate(() => testGame.player.radius), 6);
      assert.ok(
        await page.evaluate(() =>
          hitboxArcs.some(
            ([x, y]) => x === testGame.player.x && y === testGame.player.y,
          ),
        ),
      );
      const hud = await page.locator(".instrument").boundingBox();
      assert.ok(hud.y >= 0);
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-0.5-screens/hitbox-${viewport.width}.png`,
        fullPage: true,
      });
      // Finish an ordinary simulated stage; keep damage immunity only in this fixture.
      await page.evaluate(() => (testGame.player.invincible = 1000));
      await page.evaluate(() => {
        for (let i = 0; i < 1800; i++) {
          if (testGame.state === "upgrade") testGame.chooseUpgrade(0);
          if (testGame.ticks === 1799)
            testGame.rocks.push({
              type: "meteor",
              x: 70,
              y: 100,
              radius: 16,
              hp: 1e6,
              maxHp: 1e6,
              speed: 0,
              rotation: 0,
              spin: 0,
              shape: Array(10).fill(1),
            });
          testGame.advance(1 / 60);
        }
      });
      await page.clock.runFor(50);
      assert.equal(await page.evaluate(() => testGame.elimination), true);
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      // Clear the live targets through projectile collisions after the deadline.
      await page.evaluate(() => {
        testGame.mainAt = testGame.subAt = Infinity;
        testGame.bullets = [];
        for (const r of testGame.rocks) {
          r.type = "meteor";
          r.x = r.originX = 150;
          r.y = 200;
          r.speed = 0;
        }
        for (let i = 0; i < 30; i++) testGame.advance(1 / 60);
        testGame.bullets = testGame.rocks.map(() => ({
          x: 150,
          y: 200,
          vx: 0,
          vy: 0,
          radius: 3,
          damage: 1e9,
        }));
        testGame.advance(1 / 60);
      });
      await page.clock.runFor(50);
      assert.equal(await page.evaluate(() => testGame.outcome), "cleared");
      assert.ok(await page.evaluate(() => testGame.time > 30));
      await page
        .getByRole("heading", { name: "ステージ1 クリア！", exact: true })
        .waitFor();
      const coins = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
      );
      assert.ok(coins >= 15 && coins <= 17);
      assert.equal(
        await page.locator(".first-clear-reward dd").innerText(),
        "+5 コイン",
      );
      const row = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1"))
            .recentRuns[0],
      );
      assert.equal(row.stage, 1);
      assert.equal(row.cleared, true);
      await page.clock.runFor(2000);
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("star-dodge-progress-v1")).credits,
        ),
        coins,
      );
      await page
        .getByRole("button", { name: "ステージ2へ進む", exact: false })
        .click();
      assert.equal(await page.evaluate(() => testGame.stage.id), 2);
      assert.equal(await page.evaluate(() => testGame.time), 0);
      assert.equal(await page.evaluate(() => testGame.player.hp), 3);
      await page.reload();
      await page.clock.runFor(50);
      assert.ok(
        (await page.locator(".stage-summary").innerText()).includes("STAGE 02"),
      );
      await page.locator('[data-hub="stages"]').click();
      assert.ok(
        (await page.locator(".stage-card").first().innerText()).includes(
          "CLEAR",
        ),
      );
      await page.locator('[data-mode="endless"]').click();
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      assert.equal(await page.evaluate(() => testGame.stage), null);
      assert.equal(await page.locator("#check-update").isDisabled(), true);
      assert.ok(
        !/クレジット|\bCR\b|CREDITS/i.test(
          await page.locator("body").innerText(),
        ),
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${viewport.width}px: ten-stage selector, locked levels, radius-6 visible hitbox, 30s deadline and elimination clear, one reward, next level, reload, endless and coin labels`,
      );
    }
    const campaign = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    await campaign.addInitScript(() => {
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
    const cp = await campaign.newPage();
    await cp.clock.install();
    await cp.goto(base);
    await cp.clock.runFor(50);
    await cp
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    for (let id = 1; id <= 10; id++) {
      await cp.clock.runFor(3300);
      assert.equal(await cp.evaluate(() => testGame.stage.id), id);
      await cp.evaluate(() => {
        testGame.player.invincible = 1000;
        for (let i = 0; i < 1800; i++) {
          if (testGame.state === "upgrade") testGame.chooseUpgrade(0);
          if (testGame.ticks === 1799)
            testGame.rocks.push({
              type: "meteor",
              x: 70,
              y: 100,
              radius: 16,
              hp: 1e6,
              maxHp: 1e6,
              speed: 0,
              rotation: 0,
              spin: 0,
              shape: Array(10).fill(1),
            });
          testGame.advance(1 / 60);
        }
      });
      await cp.clock.runFor(50);
      assert.equal(await cp.evaluate(() => testGame.elimination), true);
      await cp.evaluate(() => {
        testGame.mainAt = testGame.subAt = Infinity;
        testGame.bullets = [];
        for (const r of testGame.rocks) {
          r.type = "meteor";
          r.x = r.originX = 150;
          r.y = 200;
          r.speed = 0;
        }
        testGame.bullets = testGame.rocks.map(() => ({
          x: 150,
          y: 200,
          vx: 0,
          vy: 0,
          radius: 3,
          damage: 1e9,
        }));
        testGame.advance(1 / 60);
      });
      await cp.clock.runFor(50);
      assert.equal(await cp.evaluate(() => testGame.outcome), "cleared");
      if (id < 10)
        await cp
          .getByRole("button", {
            name: `ステージ${id + 1}へ進む`,
            exact: false,
          })
          .click();
    }
    await cp
      .getByRole("heading", { name: "全10ステージ、制覇！", exact: true })
      .waitFor();
    assert.equal(
      await cp.evaluate(
        () =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1"))
            .clearedStages.length,
      ),
      10,
    );
    await cp.screenshot({
      path: "/workspace/artifacts/star-dodge-0.5-screens/all-clear.png",
      fullPage: true,
    });
    await cp
      .getByRole("button", { name: "同じステージに挑戦", exact: false })
      .click();
    assert.equal(await cp.evaluate(() => testGame.stage.id), 10);
    assert.equal(await cp.evaluate(() => testGame.outcome), null);
    await campaign.close();
    console.log(
      "PASS: full campaign 1–10 through next-stage UI, final completion, saved clears and replay",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
