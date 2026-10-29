const assert = require("node:assert/strict"),
  fs = require("node:fs/promises");
const { chromium } = require("playwright");
const { FLIGHT_UPGRADES, FLIGHT_CATEGORIES } = require("./engine.js");
const { UPGRADES } = require("./progression.js");
const fixture = require("./test-fixtures/progress-0.4.json");
const base = process.env.STAR_DODGE_URL || "http://127.0.0.1:8001/star-dodge/";
const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
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
            JSON.stringify({
              best: 49000,
              last: 30000,
              sound: true,
              soundDefaultRevision: 1,
            }),
          );
        for (const [key, type, target] of [
          ["StarDodge", "Game", "testGame"],
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
                  this.uiCalls = 0;
                }
                effect(type, data) {
                  if (type === "ui") this.uiCalls++;
                  return super.effect(type, data);
                }
              };
            },
          });
        }
      }, fixture);
      await page.clock.install();
      await page.goto(base);
      await page.clock.runFor(50);
      const originalProgress = await page.evaluate(() =>
        localStorage.getItem("star-dodge-progress-v1"),
      );
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("star-dodge-v1")).volume,
        ),
        1,
      );
      const openSettings = () => page.locator('[data-hub="settings"]').click(),
        close = () =>
          page.getByRole("button", { name: "閉じる", exact: true }).click();
      await openSettings();
      const slider = page.getByRole("slider", {
        name: "マスター音量",
        exact: true,
      });
      assert.equal(await slider.getAttribute("min"), "0");
      assert.equal(await slider.getAttribute("max"), "100");
      assert.equal(await slider.inputValue(), "100");
      assert.equal(await page.locator("#volume-value").innerText(), "100%");
      await page.waitForFunction(() => testSynth.context?.state === "running");
      const gain = () => page.evaluate(() => testSynth.master.gain.value),
        volume = () =>
          page.evaluate(
            () => JSON.parse(localStorage.getItem("star-dodge-v1")).volume,
          );
      assert.ok(Math.abs((await gain()) - 0.9) < 1e-6);
      const uiBefore = await page.evaluate(() => testSynth.uiCalls);
      // Input updates immediately; committing a drag produces one preview.
      for (const value of [65, 45, 40])
        await slider.evaluate((input, n) => {
          input.value = n;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }, value);
      assert.equal(await volume(), 0.4);
      assert.ok(Math.abs((await gain()) - 0.36) < 1e-6);
      assert.equal(await slider.getAttribute("aria-valuetext"), "40%");
      assert.equal(await page.locator("#volume-value").innerText(), "40%");
      assert.equal(await page.evaluate(() => testSynth.uiCalls), uiBefore);
      await slider.dispatchEvent("change");
      assert.equal(await page.evaluate(() => testSynth.uiCalls), uiBefore + 1);
      await slider.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await slider.inputValue(), "41");
      assert.equal(await volume(), 0.41);
      await page.keyboard.press("Home");
      assert.equal(await volume(), 0);
      assert.equal(await gain(), 0);
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "true",
      );
      await page.keyboard.press("End");
      assert.equal(await volume(), 1);
      await fs.mkdir("/workspace/artifacts/star-dodge-volume-skills", {
        recursive: true,
      });
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-volume-skills/volume-${viewport.width}.png`,
        fullPage: true,
      });
      await close();
      await page.locator("#sound").click();
      await openSettings();
      await slider.evaluate((input) => {
        input.value = 27;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      assert.equal(await volume(), 0.27);
      assert.equal(await page.evaluate(() => testSynth.enabled), false);
      assert.equal(await page.evaluate(() => testSynth.stats.voices), 0);
      assert.ok(Math.abs((await gain()) - 0.243) < 1e-6);
      await page.reload();
      await page.clock.runFor(50);
      assert.equal(
        await page.locator("#sound").getAttribute("aria-pressed"),
        "false",
      );
      await openSettings();
      assert.equal(await slider.inputValue(), "27");
      assert.equal(await page.locator("#volume-value").innerText(), "27%");
      assert.equal(await page.evaluate(() => testSynth.context), null);
      await close();
      await page.locator("#sound").click();
      await page.waitForFunction(() => testSynth.context?.state === "running");
      assert.ok(Math.abs((await gain()) - 0.243) < 1e-6);
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("star-dodge-v1")).best,
        ),
        49000,
      );
      await page.locator('[data-hub="skills"]').click();
      assert.equal(await page.locator("#hub-title").innerText(), "スキル図鑑");
      assert.equal(await page.locator("[data-skill]").count(), 9);
      assert.equal(await page.locator("[data-initial-skill]").count(), 4);
      assert.equal(
        await page
          .locator(
            "#hub-content button, #hub-content input, #hub-content select",
          )
          .count(),
        0,
      );
      for (const category of FLIGHT_CATEGORIES) {
        const section = page.locator(
          `.skill-category[data-category="${category.id}"]`,
        );
        assert.equal(await section.locator("h3").innerText(), category.name);
        assert.equal(
          await section.locator("[data-skill]").count(),
          FLIGHT_UPGRADES.filter((up) => up.category === category.id).length,
        );
      }
      for (const up of FLIGHT_UPGRADES) {
        const card = page.locator(`[data-skill="${up.id}"]`);
        assert.equal(await card.locator("h4").innerText(), up.name);
        assert.equal(await card.locator("p").innerText(), up.description);
        assert.equal(await card.locator(".skill-icon").innerText(), up.icon);
        assert.equal(
          await card.locator(".skill-level").innerText(),
          `最大 Lv.${up.max}`,
        );
        assert.equal(
          await card.evaluate((el) => getComputedStyle(el).borderTopColor),
          rgb(up.color),
        );
        assert.equal(
          await card
            .locator(".skill-icon")
            .evaluate((el) => getComputedStyle(el).color),
          rgb(up.color),
        );
      }
      for (const up of UPGRADES) {
        const card = page.locator(`[data-initial-skill="${up.id}"]`);
        assert.equal(await card.locator("h4").innerText(), up.name);
        assert.equal(await card.locator("p").innerText(), up.description);
        assert.equal(
          await card.locator(".skill-level").innerText(),
          `所持 Lv.${fixture.upgrades[up.id]} / ${up.costs.length}`,
        );
      }
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("star-dodge-progress-v1"),
        ),
        originalProgress,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(
        await page
          .locator("#hub")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      );
      await page.locator("#hub").evaluate((el) => (el.scrollTop = 0));
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-volume-skills/codex-${viewport.width}.png`,
        fullPage: true,
      });
      await page.locator("#initial-skills-title").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-volume-skills/initial-${viewport.width}.png`,
        fullPage: true,
      });
      await close();
      await page
        .getByRole("button", { name: "フライト開始", exact: false })
        .click();
      await page.clock.runFor(3300);
      await page.evaluate(() => {
        testGame.player.invincible = 1000;
        testGame.offerUpgrades();
        testGame.choices = ["rapid", "movement", "shield"].map((id) => ({
          ...StarDodge.FLIGHT_UPGRADES.find((up) => up.id === id),
        }));
      });
      await page.clock.runFor(50);
      for (const [i, id] of ["rapid", "movement", "shield"].entries()) {
        const up = FLIGHT_UPGRADES.find((up) => up.id === id),
          card = page.locator(`[data-choice="${i}"]`);
        assert.equal(await card.locator("b").innerText(), up.name);
        assert.equal(await card.locator("small").innerText(), up.description);
        assert.equal(
          await card.evaluate((el) => getComputedStyle(el).borderTopColor),
          rgb(up.color),
        );
        assert.equal(
          await card
            .locator(".choice-icon")
            .evaluate((el) => getComputedStyle(el).color),
          rgb(up.color),
        );
      }
      await page.screenshot({
        path: `/workspace/artifacts/star-dodge-volume-skills/choices-${viewport.width}.png`,
        fullPage: true,
      });
      await page.locator('[data-choice="0"]').click();
      await page.evaluate(() => {
        testGame.levels = { speed: 5, multi: 3, sub: 3 };
        testGame.skills = {
          rapid: 3,
          damage: 3,
          dronePower: 2,
          movement: 3,
          magnet: 3,
        };
        testGame.shield = 1;
        testGame.offerUpgrades();
      });
      await page.clock.runFor(50);
      assert.equal(await page.locator("[data-choice]").count(), 1);
      assert.equal(
        await page
          .locator("[data-choice]")
          .evaluate((el) => getComputedStyle(el).borderTopColor),
        rgb("#ffd47d"),
      );
      assert.equal(
        await page
          .locator(".choice-icon")
          .evaluate((el) => getComputedStyle(el).color),
        rgb("#ffd47d"),
      );
      assert.ok(
        (await page.locator("[data-choice] b").innerText()).includes(
          "余剰コア",
        ),
      );
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("star-dodge-progress-v1"),
        ),
        originalProgress,
      );
      assert.deepEqual(errors, []);
      assert.ok(
        requests.every(
          (url) => url.startsWith(base) || url.startsWith("data:"),
        ),
        "no added external requests",
      );
      await context.close();
      console.log(
        `PASS ${viewport.width}px: volume migration/live gain/one preview/keyboard/zero/OFF/reload; nine shared-color skills and four read-only initial levels; category choice borders/icons; gold surplus; unchanged progress save`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
