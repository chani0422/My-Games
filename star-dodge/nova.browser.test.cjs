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
        if (!localStorage.getItem("star-dodge-progress-v1"))
          localStorage.setItem(
            "star-dodge-progress-v1",
            JSON.stringify({
              version: 1,
              credits: 1000,
              clearedStages: Array.from({ length: 25 }, (_, i) => i + 1),
              selectedStage: 25,
              selectedShip: "nova",
            }),
          );
        for (const [key, type, target] of [
          ["StarDodge", "Game", "testGame"],
          ["StarEffects", "Effects", "testFX"],
          ["StarAudio", "Synth", "testSynth"],
        ]) {
          let api;
          Object.defineProperty(window, key, {
            get: () => api,
            set(value) {
              api = value;
              const Base = value[type];
              value[type] = class extends Base {
                constructor(...args) {
                  super(...args);
                  window[target] = this;
                }
              };
            },
          });
        }
      });
      const epoch = new Date("2030-01-01T00:00:00Z");
      await page.clock.install({ time: epoch });
      await page.clock.pauseAt(new Date(epoch.getTime() + 1000));
      await page.goto(base);
      await page.clock.runFor(50);
      const start = async () => {
        await page
          .getByRole("button", { name: "フライト開始", exact: false })
          .click();
        await page.clock.runFor(3300);
        assert.equal(await page.evaluate(() => testGame.player.ship), "nova");
      };
      await page.locator('[data-hub="hangar"]').click();
      assert.ok(
        (await page.locator('[data-hangar-ship="nova"]').innerText()).includes(
          "半径120",
        ),
      );
      assert.ok(
        (await page.locator('[data-hangar-ship="nova"]').innerText()).includes(
          "上限3",
        ),
      );
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await start();
      await page.evaluate(() => {
        testSynth.calls = [];
        const effect = testSynth.effect.bind(testSynth);
        testSynth.effect = (type, data) => {
          testSynth.calls.push({ type, ...data });
          return effect(type, data);
        };
      });
      const blast = async () => {
        await page.evaluate(() => {
          const g = testGame;
          g.time = 30;
          g.ticks = 1800;
          g.elimination = true;
          g.mainAt = g.subAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
          g.enemyBullets = [];
          g.items = [];
          g.bullets = [];
          g.events = [];
          g.rocks = [
            [240, 260, 3],
            [330, 260, 3],
            [420, 260, 3],
            [80, 100, 9],
          ].map(([x, y, hp]) => ({
            type: "meteor",
            x,
            y,
            hp,
            maxHp: hp,
            radius: 16,
            speed: 0,
            rotation: 0,
            spin: 0,
            shape: Array(10).fill(1),
          }));
          g.skills.damage = 2;
          g.fire();
          const bullet = g.bullets[0];
          bullet.x = 240;
          bullet.y = 260;
          bullet.vx = bullet.vy = 0;
        });
        await page.clock.runFor(34);
        assert.equal(await page.evaluate(() => testGame.destroyed), 3);
        assert.equal(await page.evaluate(() => testGame.remainingRocks), 1);
      };
      await blast();
      const fx = await page.evaluate(() => ({
        ...testFX.stats,
        duration: testFX.rings.find((r) => r.max === 0.6)?.max,
        radius: testFX.rings.find((r) => r.max === 0.6)?.radius,
      }));
      assert.ok(fx.particles >= 84);
      assert.ok(fx.shake > 0);
      assert.equal(fx.duration, 0.6);
      assert.equal(fx.radius * 2.5, 120);
      assert.deepEqual(
        await page.evaluate(() =>
          testSynth.calls
            .filter((c) => c.type === "explosion")
            .map((c) => c.depth),
        ),
        [0, 1],
      );
      assert.equal(await page.evaluate(() => testSynth.master.gain.value), 1);
      assert.ok(
        Math.abs(
          (await page.evaluate(() => testSynth.output.gain.value)) - 0.6,
        ) < 1e-6,
      );
      assert.equal(
        await page.evaluate(
          () => testSynth.compressor instanceof DynamicsCompressorNode,
        ),
        true,
      );
      await page.clock.runFor(240);
      assert.ok(
        await page.evaluate(() =>
          testFX.rings.some((r) => r.max === 0.6 && r.life > 0),
        ),
      );
      await fs.mkdir("/workspace/artifacts/star-dodge-nova-audio", {
        recursive: true,
      });
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-nova-audio/nova-${viewport.width}.png`,
        fullPage: false,
      });
      await page.keyboard.press("p");
      await page.locator('[data-action="title"]').click();
      await page.locator('[data-hub="settings"]').click();
      await page.locator("#reduce-effects").check();
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await start();
      await blast();
      assert.deepEqual(await page.evaluate(() => testFX.stats), {
        particles: 0,
        labels: 0,
        rings: 0,
        shake: 0,
      });
      assert.deepEqual(await page.evaluate(() => testFX.offset(true)), {
        x: 0,
        y: 0,
      });
      assert.equal(await page.evaluate(() => testSynth.enabled), true);
      assert.equal(
        await page.evaluate(
          () => testSynth.calls.filter((c) => c.type === "explosion").length,
        ),
        4,
      );
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${viewport.width}px: nova damage3/depth1, radius120 sustained rings, extra particles/shake, distinct explosion cue, real compressor and unchanged gameplay with reduced effects`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
