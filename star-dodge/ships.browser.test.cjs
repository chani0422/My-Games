const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");
const legacy = require("./test-fixtures/progress-0.4.json");
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
      await context.addInitScript(
        (raw) => {
          if (!localStorage.getItem("star-dodge-progress-v1"))
            localStorage.setItem("star-dodge-progress-v1", JSON.stringify(raw));
          for (const [key, kind, target] of [
            ["StarDodge", "Game", "testGame"],
            ["StarEffects", "Effects", "testFX"],
          ]) {
            let api;
            Object.defineProperty(window, key, {
              get: () => api,
              set(value) {
                api = value;
                const Base = value[kind];
                value[kind] = class extends Base {
                  constructor(...args) {
                    super(...args);
                    window[target] = this;
                  }
                };
              },
            });
          }
        },
        {
          ...legacy,
          credits: 900,
          selectedStage: 5,
          clearedStages: [1, 2, 3, 4, 5],
          selectedShip: "warden",
          unlocked: ["pioneer", "swift", "warden", "warden"],
        },
      );
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      const saved = () =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("star-dodge-progress-v1")),
        );
      let data = await saved();
      assert.equal(data.credits, 1160);
      assert.equal(data.selectedShip, "pioneer");
      assert.deepEqual(data.unlocked, ["pioneer", "lance"]);
      assert.deepEqual(data.recentRuns, legacy.recentRuns);
      assert.deepEqual(data.upgrades, legacy.upgrades);
      assert.deepEqual(data.clearedStages, [1, 2, 3, 4, 5]);
      const close = () =>
        page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page.locator('[data-hub="hangar"]').click();
      assert.equal(await page.locator("[data-hangar-ship]").count(), 4);
      assert.equal(
        await page.locator('[data-ship="pioneer"]').isDisabled(),
        true,
      );
      assert.equal(
        await page.locator('[data-ship="lance"]').isDisabled(),
        false,
      );
      for (const [id, threshold] of [
        ["nova", 15],
        ["seeker", 25],
      ]) {
        const button = page.locator(`[data-ship="${id}"]`);
        assert.equal(await button.isDisabled(), true);
        assert.ok((await button.innerText()).includes(`通し番号${threshold}`));
        await button.evaluate((el) => el.click());
      }
      assert.equal((await saved()).selectedShip, "pioneer");
      const silhouettes = await page
        .locator(".hangar-preview svg")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.querySelector("path").getAttribute("d")),
        );
      const colors = await page
        .locator(".hangar-preview svg")
        .evaluateAll((nodes) => nodes.map((n) => n.style.color));
      assert.equal(new Set(silhouettes).size, 4);
      assert.equal(new Set(colors).size, 4);
      assert.ok(
        !/コインで解放|スウィフト|ウォーデン/.test(
          await page.locator("#hub-content").innerText(),
        ),
      );
      assert.ok(
        await page
          .locator("#hub")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      );
      await fs.mkdir("/workspace/artifacts/star-dodge-four-ships", {
        recursive: true,
      });
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-four-ships/hangar-${viewport.width}.png`,
        fullPage: true,
      });
      await page.locator('[data-ship="lance"]').click();
      data = await saved();
      assert.equal(data.selectedShip, "lance");
      assert.equal(data.credits, 1160);
      assert.equal(data.selectedSkin, "rose");
      await close();
      await page.reload();
      await page.clock.runFor(50);
      assert.equal((await saved()).credits, 1160);
      assert.equal((await saved()).selectedShip, "lance");
      await page.locator('[data-hub="stats"]').click();
      assert.ok(
        (await page.locator("#hub-content").innerText()).includes("ウォーデン"),
      );
      await close();
      await page.locator('[data-hub="skills"]').click();
      assert.equal(await page.locator("[data-skill]").count(), 8);
      assert.equal(await page.locator('[data-skill="movement"]').count(), 0);
      assert.equal(
        await page.locator('[data-category="movement"] h3').innerText(),
        "移動・収集",
      );
      assert.equal(
        await page.locator('[data-category="movement"] [data-skill]').count(),
        1,
      );
      await close();
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      assert.equal(await page.evaluate(() => testGame.player.ship), "lance");
      assert.equal(await page.evaluate(() => testGame.player.speed), 300);
      assert.equal(await page.evaluate(() => testGame.player.hp), 4);
      assert.equal(await page.evaluate(() => testGame.player.color), "#ffa0bd");
      assert.ok(
        await page.evaluate(() =>
          testGame.bullets.some((b) => b.weapon === "piercing" && !b.sub),
        ),
      );
      await page.evaluate(() => {
        testGame.fire(true);
      });
      assert.ok(
        await page.evaluate(() =>
          testGame.bullets.some((b) => b.sub && b.weapon === "normal"),
        ),
      );
      // Real fatal result path must not render the removed movement skill.
      await page.evaluate(() => {
        const g = testGame;
        g.ticks = 2099;
        g.time = 2099 / 60;
        g.player.hp = 1;
        g.player.invincible = 0;
        g.bullets = [];
        g.mainAt = g.subAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
        g.rocks = [
          {
            type: "meteor",
            x: g.player.x,
            y: g.player.y,
            radius: 16,
            hp: 100,
            maxHp: 100,
            speed: 0,
            rotation: 0,
            spin: 0,
            shape: Array(10).fill(1),
          },
        ];
      });
      await page.clock.runFor(34);
      assert.equal(await page.evaluate(() => testGame.outcome), "destroyed");
      assert.ok(
        !/機動|undefined/.test(await page.locator("#panel").innerText()),
      );
      // Renderer probe for locked future ships uses engine fixtures, without bypassing the hangar.
      for (const [id, weapon] of [
        ["pioneer", "normal"],
        ["lance", "piercing"],
        ["nova", "explosive"],
        ["seeker", "homing"],
      ]) {
        await page.evaluate(
          (id) =>
            testGame.start({
              ship: id,
              color: "#ffa0bd",
              hp: 4,
              visuals: { armor: 1 },
            }),
          id,
        );
        await page.clock.runFor(3050);
        assert.equal(await page.evaluate(() => testGame.player.speed), 300);
        assert.equal(await page.evaluate(() => testGame.player.ship), id);
        assert.ok(
          await page.evaluate(
            (w) => testGame.bullets.some((b) => b.weapon === w && !b.sub),
            weapon,
          ),
        );
        if (id === "nova") {
          await page.evaluate(() =>
            testGame.emit("explosion", { x: 200, y: 200, radius: 70 }),
          );
          await page.clock.runFor(34);
          assert.ok(await page.evaluate(() => testFX.stats.rings > 0));
        }
        await page.screenshot({
          path: `/workspace/artifacts/star-dodge-four-ships/${id}-${viewport.width}.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${viewport.width}px: one-time legacy refund/history, four distinct hangar silhouettes and unlock locks, free lance selection/reload/skin, eight skills, shared stats, main/drone traits and explosion renderer`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
