const assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const { chromium } = require("playwright");
const fixture = require("./test-fixtures/progress-0.4.json");
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
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => requests.push(r.url()));
      await context.addInitScript((profile) => {
        if (!localStorage.getItem("star-dodge-progress-v1"))
          localStorage.setItem(
            "star-dodge-progress-v1",
            JSON.stringify(profile),
          );
        if (!localStorage.getItem("star-dodge-v1"))
          localStorage.setItem(
            "star-dodge-v1",
            JSON.stringify({ best: 49000, last: 30000, sound: false }),
          );
        for (const [key, type, target] of [
          ["StarDodge", "Game", "testGame"],
          ["StarAudio", "Synth", "testSynth"],
          ["StarEffects", "Effects", "testFX"],
        ]) {
          let api;
          Object.defineProperty(window, key, {
            get: () => api,
            set(value) {
              api = value;
              const Base = value[type];
              value[type] = class extends Base {
                constructor(...a) {
                  super(...a);
                  window[target] = this;
                }
              };
            },
          });
        }
      }, fixture);
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "true",
      );
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("star-dodge-progress-v1")),
      );
      assert.deepEqual(saved, fixture);
      await page
        .getByRole("button", { name: "機体ハンガー", exact: false })
        .click();
      assert.equal(await page.locator(".hangar-preview svg").count(), 3);
      assert.ok(
        (await page
          .locator(".hangar-preview svg")
          .first()
          .locator("path")
          .count()) > 5,
      );
      await page.waitForFunction(() => testSynth.context?.state === "running");
      await page.clock.runFor(100);
      assert.equal(await page.evaluate(() => testSynth.stats.bgmPlaying), true);
      assert.ok(await page.evaluate(() => testSynth.stats.nodes <= 49));
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      assert.deepEqual(
        await page.evaluate(() => ({
          armor: testGame.player.armor,
          trail: testGame.player.trails,
          drone: testGame.player.droneStyle,
        })),
        { armor: 1, trail: true, drone: true },
      );
      await page.evaluate(() => (testGame.player.invincible = 1000));
      await page.clock.runFor(13000);
      assert.equal(await page.evaluate(() => testGame.state), "upgrade");
      assert.equal(await page.locator("[data-choice]").count(), 3);
      const frozen = await page.evaluate(() =>
        JSON.stringify({
          time: testGame.time,
          rocks: testGame.rocks,
          bullets: testGame.bullets,
          enemy: testGame.enemyBullets,
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
            enemy: testGame.enemyBullets,
            items: testGame.items,
          }),
        ),
        frozen,
      );
      assert.equal(
        await page.evaluate(() => testSynth.stats.bgmPlaying),
        false,
      );
      const dir = "/workspace/artifacts/star-dodge-0.5-review";
      await fs.mkdir(dir, { recursive: true });
      await page.screenshot({
        path: `${dir}/choices-${viewport.width}.png`,
        fullPage: true,
      });
      const bounds = await page.locator('[data-choice="2"]').boundingBox(),
        field = await page.locator("canvas").boundingBox();
      assert.ok(
        bounds.y >= field.y &&
          bounds.y + bounds.height <= field.y + field.height,
        "three cards fit in the mobile field",
      );
      const selected = await page.evaluate(() => ({
        id: testGame.choices[1].id,
        level: testGame.upgradeLevel(testGame.choices[1].id),
      }));
      await page.keyboard.press("ArrowDown");
      assert.equal(
        await page
          .locator('[data-choice="1"]')
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      assert.ok(
        await page.evaluate(
          ({ id, level }) => testGame.upgradeLevel(id) > level,
          selected,
        ),
      );
      await page.evaluate(() =>
        testGame.spawnCore({ x: testGame.player.x, y: testGame.player.y }),
      );
      await page.clock.runFor(50);
      assert.equal(await page.evaluate(() => testGame.state), "upgrade");
      await page.keyboard.press("p");
      assert.equal(await page.evaluate(() => testGame.state), "paused");
      await page
        .getByRole("button", { name: "フライトを再開", exact: true })
        .click();
      assert.equal(await page.evaluate(() => testGame.state), "upgrade");
      await page.locator('[data-choice="0"]').click();
      assert.equal(await page.evaluate(() => testGame.state), "playing");
      // Keep the event target alive until its spawn has been observed.
      await page.evaluate(() => {
        testGame.mainAt = testGame.subAt = Infinity;
        testGame.bullets = [];
      });
      await page.clock.runFor(4300);
      assert.equal(
        await page.evaluate(() => testGame.eventState.kind),
        "elite",
      );
      assert.ok(
        await page.evaluate(() =>
          testGame.rocks.some((r) => r.type === "elite"),
        ),
      );
      assert.ok(
        (await page.locator("#toast").innerText()).includes("エリート"),
      );
      await page.evaluate(() => {
        testGame.emit("destroy", { x: 200, y: 220, radius: 38, combo: 8 });
        testGame.emit("hit", { x: 300, y: 270, damage: 4 });
        testGame.emit("damage", { x: testGame.player.x, y: testGame.player.y });
      });
      await page.clock.runFor(20);
      assert.ok(
        await page.evaluate(
          () =>
            testFX.stats.particles > 0 &&
            testFX.stats.labels > 0 &&
            testFX.stats.shake > 0,
        ),
      );
      await page.screenshot({
        path: `${dir}/event-${viewport.width}.png`,
        fullPage: true,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.clock.runFor(30);
      assert.deepEqual(await page.evaluate(() => testFX.stats), {
        particles: 0,
        labels: 0,
        rings: 0,
        shake: 0,
      });
      assert.equal(
        await page.locator("html").getAttribute("class"),
        "reduce-effects",
      );
      await page.getByRole("button", { name: "SOUND ON", exact: true }).click();
      await page.clock.runFor(30);
      assert.equal(await page.evaluate(() => testSynth.stats.voices), 0);
      assert.equal(
        await page.evaluate(() => testSynth.stats.bgmPlaying),
        false,
      );
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.clock.runFor(100);
      assert.equal(await page.evaluate(() => testGame.state), "paused");
      await page.reload();
      await page.clock.runFor(50);
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "false",
      );
      assert.ok(
        requests.every((u) => new URL(u).origin === new URL(base).origin),
      );
      assert.ok(!requests.some((u) => /\.(mp3|ogg|wav|m4a)(\?|$)/.test(u)));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS ${viewport.width}px: ON migration/OFF persistence, real Web Audio BGM/caps, permanent previews, frozen core choices, keyboard/tap/pause, event and bounded/reduced FX; no external requests or samples`,
      );
    }
    const patterns = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    await patterns.addInitScript((profile) => {
      localStorage.setItem(
        "star-dodge-progress-v1",
        JSON.stringify({
          ...profile,
          selectedStage: 5,
          clearedStages: [1, 2, 3, 4],
        }),
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
              window.patternGame = this;
            }
          };
        },
      });
    }, fixture);
    const pp = await patterns.newPage(),
      patternErrors = [];
    pp.on("pageerror", (e) => patternErrors.push(e.message));
    await pp.clock.install();
    await pp.goto(base);
    await pp.clock.runFor(50);
    await pp
      .getByRole("button", { name: "フライト開始", exact: false })
      .click();
    await pp.clock.runFor(3300);
    await pp.evaluate(() => {
      patternGame.rocks = [];
      patternGame.player.invincible = 1000;
      for (const [roll, x, y] of [
        [0.03, 100, 170],
        [0.15, 220, 250],
        [0.3, 360, 130],
      ]) {
        patternGame.random = () => roll;
        patternGame.spawnRocks();
        const r = patternGame.rocks.at(-1);
        r.x = x;
        r.originX = x;
        r.y = y;
        if (r.type === "charger") {
          r.phase = "warning";
          r.warningUntil = 0.5;
          r.targetX = patternGame.player.x;
        }
        if (r.type === "gunner") r.nextShot = 0;
      }
    });
    await pp.clock.runFor(100);
    assert.deepEqual(
      await pp.evaluate(() => patternGame.rocks.map((r) => r.type)),
      ["weaver", "charger", "gunner"],
    );
    assert.equal(await pp.evaluate(() => patternGame.enemyBullets.length), 1);
    assert.deepEqual(patternErrors, []);
    await pp.screenshot({
      path: "/workspace/artifacts/star-dodge-0.5-review/patterns.png",
      fullPage: true,
    });
    await patterns.close();
    console.log(
      "PASS: all three enemy renderers, charge warning, enemy bullet and permanent hull effects",
    );
    const native = await browser.newContext({ serviceWorkers: "block" });
    await native.addInitScript(() => {
      window.nativeCallbacks = {};
      window.Capacitor = {
        isNativePlatform: () => true,
        registerPlugin: () => ({
          addListener: async (name, fn) => {
            nativeCallbacks[name] = fn;
          },
          minimizeApp: async () => {},
        }),
      };
      let api;
      Object.defineProperty(window, "StarAudio", {
        get: () => api,
        set(value) {
          api = value;
          const Base = value.Synth;
          value.Synth = class extends Base {
            constructor(...args) {
              super(...args);
              window.nativeSynth = this;
            }
          };
        },
      });
    });
    const np = await native.newPage();
    await np.goto(base);
    await np.getByRole("button", { name: "ショップ", exact: false }).click();
    await np.waitForFunction(() => nativeSynth.stats.bgmPlaying);
    await np.evaluate(() =>
      nativeCallbacks.appStateChange({ isActive: false }),
    );
    await np.waitForFunction(() => !nativeSynth.stats.bgmPlaying);
    assert.equal(await np.evaluate(() => nativeSynth.stats.voices), 0);
    await native.close();
    console.log(
      "PASS: native background callback stops title BGM and all voices",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
