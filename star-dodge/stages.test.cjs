const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Game, CONFIG } = require("./engine.js");
const { STAGES, getStage } = require("./stages.js");
const { Progress, sanitize } = require("./progression.js");
const store = () => ({
  value: null,
  getItem() {
    return this.value;
  },
  setItem(k, v) {
    this.value = v;
  },
});
function playing(stage) {
  const g = new Game({ random: () => 0.5 });
  g.start({ stage });
  for (let i = 0; i < 180; i++) g.advance(1 / 60);
  return g;
}
function rock(g, distance) {
  return {
    x: g.player.x + distance,
    y: g.player.y,
    radius: 16,
    hp: 999,
    maxHp: 999,
    speed: 0,
    rotation: 0,
    spin: 0,
    shape: Array(10).fill(1),
  };
}
test("player hitbox is radius 6; old near misses pass and the exact new boundary damages", () => {
  const g = playing();
  assert.equal(g.player.radius, 6);
  g.rockAt = 100;
  g.itemAt = 100;
  g.mainAt = 100;
  g.bullets = [];
  g.rocks = [rock(g, 23)];
  g.advance(1 / 60);
  assert.equal(g.player.hp, 3);
  g.rocks = [rock(g, 22)];
  g.advance(1 / 60);
  assert.equal(g.player.hp, 2);
  assert.equal(g.player.invincible, CONFIG.player.invincible);
  const x = g.player.x;
  g.moveBy(9999, -9999);
  assert.equal(g.player.x, 470);
  assert.equal(g.player.y, 10);
  assert.ok(x < g.player.x);
});
test("shrinking the damage hitbox preserves item pickup reach for every ship", () => {
  for (const ship of ["pioneer", "swift", "warden"]) {
    const g = playing();
    g.player.ship = ship;
    g.rockAt = 100;
    g.items = [
      { x: g.player.x + 28, y: g.player.y, radius: 19, type: "speed" },
    ];
    g.advance(1 / 60);
    assert.equal(g.levels.speed, 2);
    assert.equal(g.player.radius, 6);
  }
});
test("ten finite stages increase speed/density/hardness and preserve the endless mode", () => {
  assert.equal(STAGES.length, 10);
  for (let i = 0; i < 10; i++) {
    const s = STAGES[i],
      g = playing(s.id);
    assert.equal(g.stage.id, i + 1);
    assert.equal(s.duration, 30);
    assert.deepEqual(g.currentDifficulty(), s);
    if (i) {
      assert.ok(s.speed > STAGES[i - 1].speed);
      assert.ok(s.interval < STAGES[i - 1].interval);
      assert.ok(s.hardness >= STAGES[i - 1].hardness);
      assert.ok(s.batch >= STAGES[i - 1].batch);
    }
    assert.equal(g.itemCursor, i % 3);
  }
  for (const id of [0, 11, "1", null, NaN]) assert.equal(getStage(id), null);
  const endless = playing();
  endless.player.invincible = 1000;
  for (let i = 0; i < 2000; i++) endless.advance(1 / 60);
  assert.equal(endless.stage, null);
  assert.equal(endless.state, "playing");
  assert.ok(endless.time > 30);
});
test("each stage clears at exactly 30 simulation seconds, emits once and freezes until restart", () => {
  for (const s of STAGES) {
    const g = playing(s.id);
    g.player.invincible = 1000;
    for (let i = 0; i < 1799; i++) g.advance(1 / 60);
    assert.equal(g.state, "playing");
    assert.ok(g.time < 30);
    g.pause();
    g.advance(50);
    assert.ok(g.time < 30);
    g.resume();
    g.advance(1 / 60);
    assert.equal(g.state, "result");
    assert.equal(g.outcome, "cleared");
    assert.equal(g.time, 30);
    const results = g.events.filter((e) => e.type === "gameover");
    assert.equal(results.length, 1);
    assert.equal(results[0].stage, s.id);
    assert.equal(results[0].cleared, true);
    const snapshot = JSON.stringify({
      p: g.player,
      rocks: g.rocks,
      time: g.time,
    });
    g.advance(10);
    assert.equal(
      JSON.stringify({ p: g.player, rocks: g.rocks, time: g.time }),
      snapshot,
    );
    g.start({ stage: s.id });
    assert.equal(g.outcome, null);
    assert.equal(g.time, 0);
    assert.equal(g.state, "countdown");
  }
});
test("fatal damage on the boundary is a failure and never unlocks a stage", () => {
  const g = playing(1);
  g.ticks = 1799;
  g.time = 1799 / 60;
  g.rockAt = 100;
  g.mainAt = 100;
  g.bullets = [];
  g.player.hp = 1;
  g.rocks = [rock(g, 0)];
  g.advance(1 / 60);
  assert.equal(g.outcome, "destroyed");
  assert.equal(g.events.find((e) => e.type === "gameover").cleared, undefined);
  const p = new Progress(store());
  p.finish("failed", 30000, 0, { stage: 1, cleared: false });
  assert.deepEqual(p.data.clearedStages, []);
});
test("sequential clear progression persists; failed, early, duplicate or skipped clears do not unlock", () => {
  const storage = store(),
    p = new Progress(storage);
  assert.equal(p.selectStage(2), false);
  assert.equal(p.selectStage("1"), false);
  p.finish("early", 29999, 0, { stage: 1, cleared: true });
  assert.deepEqual(p.data.clearedStages, []);
  p.finish("skip", 30000, 0, { stage: 3, cleared: true });
  assert.deepEqual(p.data.clearedStages, []);
  for (let id = 1; id <= 10; id++) {
    const previous = p.data.credits,
      result = p.finish(`clear-${id}`, 30000, 10, { stage: id, cleared: true });
    assert.equal(result.credits, 12 + getStage(id).firstClearCoins);
    assert.equal(result.reward.firstClearCoins, getStage(id).firstClearCoins);
    assert.equal(p.data.credits, previous + 12 + getStage(id).firstClearCoins);
    assert.deepEqual(
      p.data.clearedStages,
      Array.from({ length: id }, (_, i) => i + 1),
    );
    assert.equal(p.data.selectedStage, Math.min(10, id + 1));
    assert.equal(
      p.finish(`clear-${id}`, 30000, 10, { stage: id, cleared: true })
        .duplicate,
      true,
    );
  }
  const restored = new Progress(storage);
  assert.equal(
    restored.finish("replay", 30000, 10, { stage: 1, cleared: true }).credits,
    12,
  );
  assert.deepEqual(restored.data.clearedStages, p.data.clearedStages);
  assert.equal(restored.data.recentRuns[0].cleared, true);
  assert.equal(restored.selectStage(1), true);
  assert.equal(restored.loadout().stage, 1);
  assert.equal(restored.selectMode("endless"), true);
  assert.equal(restored.loadout().stage, null);
  restored.restore(restored.snapshot());
  assert.equal(restored.data.flightMode, "endless");
  assert.equal(restored.selectMode("unknown"), false);
  const bad = sanitize({ selectedStage: 10, clearedStages: [1, 3, 10] });
  assert.deepEqual(bad.clearedStages, [1]);
  assert.equal(bad.selectedStage, 1);
});
