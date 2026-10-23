const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  Progress,
  fresh,
  sanitize,
  SKINS,
  licenseFor,
  calculateFlightReward,
} = require("./progression.js");
const { Game } = require("./engine.js");
const store = () => ({
  value: null,
  getItem() {
    return this.value;
  },
  setItem(k, v) {
    this.value = v;
  },
});
test("cosmetic purchases charge once, persist and never alter flight statistics", () => {
  const storage = store(),
    p = new Progress(storage);
  assert.equal(p.selectSkin("solar"), false);
  assert.equal(p.selectSkin("unknown"), false);
  p.data.credits = 300;
  const before = p.loadout();
  assert.equal(p.selectSkin("solar"), true);
  assert.equal(p.data.credits, 220);
  p.selectSkin("factory");
  p.selectSkin("solar");
  assert.equal(p.data.credits, 220);
  const after = new Progress(storage).loadout();
  assert.equal(after.color, SKINS.find((s) => s.id === "solar").color);
  assert.deepEqual(
    { ...after, color: before.color, skin: before.skin },
    before,
  );
  const normal = new Game(),
    styled = new Game();
  normal.start(before);
  styled.start(after);
  assert.deepEqual(
    { ...styled.player, color: normal.player.color },
    normal.player,
  );
  assert.deepEqual(styled.levels, normal.levels);
  assert.deepEqual(calculateFlightReward(60000, 100), {
    survivalCoins: 12,
    milestoneCoins: 10,
    destructionCoins: 4,
    totalCoins: 26,
  });
});
test("license thresholds advance only with settled survival and unlock a free rank reward", () => {
  const p = new Progress(store());
  assert.equal(licenseFor(0).rank, 1);
  assert.equal(licenseFor(59999).rank, 1);
  assert.equal(licenseFor(60000).rank, 2);
  assert.equal(licenseFor(239999).rank, 2);
  assert.equal(licenseFor(240000).rank, 3);
  assert.equal(p.selectSkin("aurora"), false);
  p.data.unlockedSkins.push("aurora");
  assert.equal(p.selectSkin("aurora"), false);
  p.finish("one", 120000, 0);
  p.finish("two", 120000, 0);
  const balance = p.data.credits;
  assert.equal(p.selectSkin("aurora"), true);
  assert.equal(p.data.credits, balance);
  p.restore(p.snapshot());
  assert.equal(p.data.selectedSkin, "aurora");
  const game = new Game();
  game.start(p.loadout());
  game.title();
  assert.equal(p.data.totalMs, 240000);
  for (const t of [-1, NaN, Infinity]) assert.equal(licenseFor(t).rank, 1);
  const top = licenseFor(1e9);
  assert.equal(top.rank, 20);
  assert.equal(top.progress, 1);
  assert.equal(top.nextMs, null);
});
test("recent flights retain 20 newest results and duplicate settlement never adds history", () => {
  const storage = store(),
    p = new Progress(storage);
  for (let i = 0; i < 25; i++)
    p.finish(`run-${i}`, 30000 + i, 10, {
      endedAt: 1000 + i,
      ship: "swift",
      skin: "solar",
      initialLevels: { speed: 2, multi: 1, sub: 0 },
      endLevels: { speed: 5, multi: 3, sub: 2 },
    });
  assert.equal(p.data.recentRuns.length, 20);
  assert.equal(p.data.recentRuns[0].endedAt, 1024);
  assert.equal(p.data.recentRuns.at(-1).endedAt, 1005);
  const restored = new Progress(storage),
    before = restored.snapshot();
  assert.equal(restored.finish("run-24", 90000, 999).duplicate, true);
  assert.deepEqual(restored.snapshot(), before);
  assert.deepEqual(restored.data.recentRuns[0].initialLevels, {
    speed: 2,
    multi: 1,
    sub: 0,
  });
  assert.deepEqual(restored.data.recentRuns[0].endLevels, {
    speed: 5,
    multi: 3,
    sub: 2,
  });
});
test("legacy and malformed backup fields cannot inject skin colors, markup or private report data", () => {
  const old = sanitize({ credits: 123, selectedShip: "pioneer" });
  assert.equal(old.credits, 123);
  assert.equal(old.selectedSkin, "factory");
  assert.deepEqual(old.recentRuns, []);
  const p = new Progress(store());
  p.restore({
    ...fresh(),
    credits: 88,
    selectedSkin: "solar",
    unlockedSkins: ["factory", "bad"],
    reduceEffects: "true",
    email: "private@example.test",
    access_token: "secret",
    recentRuns: [
      null,
      {},
      { ms: NaN },
      { ms: -1 },
      {
        ms: 30000,
        coins: 9999,
        ship: "<script>",
        skin: "<img>",
        endedAt: Infinity,
        initialLevels: { speed: 99, multi: -1, sub: "2" },
        email: "secret",
        endLevels: { speed: 5, multi: 3, sub: 2 },
      },
    ],
  });
  assert.equal(p.data.selectedSkin, "factory");
  assert.equal(p.data.reduceEffects, false);
  const report = p.report(),
    row = report.recentRuns[0];
  assert.equal(report.recentRuns.length, 1);
  assert.equal(row.ship, "pioneer");
  assert.equal(row.skin, "factory");
  assert.equal(row.coins, 500);
  assert.deepEqual(row.initialLevels, { speed: 5, multi: 1, sub: 0 });
  assert.ok(
    !/secret|email|token|credits|settled|unlocked/.test(JSON.stringify(report)),
  );
  row.endLevels.speed = 1;
  assert.equal(p.data.recentRuns[0].endLevels.speed, 5);
});
test("motion preferences and cosmetic unlocks survive backup and reload", () => {
  const storage = store(),
    p = new Progress(storage);
  p.data.credits = 300;
  p.selectSkin("rose");
  p.setReducedEffects(true);
  const restored = new Progress(storage);
  assert.equal(restored.data.reduceEffects, true);
  assert.equal(restored.data.selectedSkin, "rose");
  assert.equal(restored.data.credits, 100);
  restored.setReducedEffects(false);
  assert.equal(new Progress(storage).data.reduceEffects, false);
  restored.restore(p.snapshot());
  assert.equal(restored.data.reduceEffects, true);
});
