const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Game, CONFIG } = require("./engine.js");
const {
  PLANETS,
  STAGES,
  getStage,
  getPlanet,
  stageLabel,
} = require("./stages.js");
const { Progress, fresh, sanitize } = require("./progression.js");
const seed = (n) => () =>
  (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
const clears = (n) => Array.from({ length: n }, (_, i) => i + 1);
const store = (raw) => ({
  value: JSON.stringify(raw),
  getItem() {
    return this.value;
  },
  setItem(key, value) {
    assert.equal(key, "star-dodge-progress-v1");
    this.value = value;
  },
});

test("eight ordered planets have exactly five numbered stages, stable labels and distinct themes", () => {
  assert.deepEqual(
    PLANETS.map((p) => p.name),
    ["地球", "水星", "金星", "火星", "木星", "土星", "天王星", "海王星"],
  );
  assert.equal(PLANETS.length, 8);
  assert.equal(STAGES.length, 40);
  assert.equal(new Set(PLANETS.map((p) => p.color)).size, 8);
  for (const p of PLANETS) {
    const stages = STAGES.filter((s) => s.planetId === p.id);
    assert.equal(stages.length, 5);
    assert.equal(getPlanet(p.id), p);
    assert.equal(stages[0].id, p.firstStage);
    assert.equal(stages[4].id, p.lastStage);
    for (const [i, s] of stages.entries()) {
      assert.equal(s.planetId, Math.ceil(s.id / 5));
      assert.equal(s.localNumber, i + 1);
      assert.equal(s.name, `ステージ${i + 1}`);
      assert.equal(stageLabel(s.id), `${p.name} ステージ${i + 1}`);
      assert.equal(s.color, p.color);
      assert.ok(Object.isFrozen(s) && Object.isFrozen(s.hp));
    }
  }
  assert.ok(Object.isFrozen(PLANETS) && Object.isFrozen(STAGES));
  for (const id of [0, 41, "1", NaN, null]) assert.equal(stageLabel(id), "");
  for (const id of [0, 9, "1", NaN, null]) assert.equal(getPlanet(id), null);
});

test("the forty-stage curve increases monotonically, with larger planet boundaries and fifth-stage peaks", () => {
  for (const s of STAGES) {
    const p = s.planetId - 1;
    assert.equal(s.hardness, 1 + p + (s.localNumber === 5 ? 1 : 0));
    assert.deepEqual(s.hp, [s.hardness, s.hardness + 1, s.hardness + 3]);
    assert.equal(s.eliteHp, s.hardness + 5);
    assert.equal(s.duration, 30);
    assert.equal(s.firstClearCoins, 5 + (s.id - 1) * 2);
    if (s.id > 1) {
      const prev = getStage(s.id - 1);
      assert.ok(s.interval < prev.interval);
      assert.ok(s.speed > prev.speed);
      for (const field of ["hardness", "batch", "maxRocks", "eliteHp"])
        assert.ok(s[field] >= prev[field], `${s.id}: ${field}`);
      for (let i = 0; i < 3; i++) assert.ok(s.hp[i] >= prev.hp[i]);
    }
    if (s.localNumber === 1 && s.id > 1) {
      const prev = getStage(s.id - 1),
        before = getStage(s.id - 2);
      assert.ok(s.speed - prev.speed > prev.speed - before.speed);
      assert.ok(prev.interval - s.interval > before.interval - prev.interval);
    }
    if (s.localNumber === 5) {
      const prev = getStage(s.id - 1),
        before = getStage(s.id - 2);
      assert.ok(s.speed - prev.speed > prev.speed - before.speed);
      assert.equal(s.hardness, prev.hardness + 1);
    }
  }
  assert.equal(
    STAGES.reduce((sum, s) => sum + s.firstClearCoins, 0),
    1760,
  );
  assert.equal(getStage(40).firstClearCoins, 83);
  assert.equal(getStage(40).speed, 160);
  assert.equal(getStage(40).interval, 0.5);
  assert.deepEqual(getStage(40).hp, [9, 10, 12]);
});

test("all stage rock sizes and elites use their stage HP and retain it when recycled", () => {
  for (const s of STAGES) {
    for (const [i, roll] of [0.1, 0.75, 0.95].entries()) {
      const g = new Game({ random: () => roll });
      g.start({ stage: s.id });
      g.spawnRocks();
      const r = g.rocks[0];
      assert.equal(r.radius, CONFIG.rocks.types[i].radius);
      assert.equal(r.hp, s.hp[i]);
      assert.equal(r.maxHp, s.hp[i]);
      r.hp--;
      g.time = 31;
      g.recycleRock(r);
      assert.equal(r.hp, s.hp[i] - 1);
      assert.equal(r.maxHp, s.hp[i]);
      assert.ok(r.y < 0);
    }
    const g = new Game({ random: seed(s.id) });
    g.start({ stage: s.id });
    g.spawnRocks(true);
    assert.equal(g.rocks[0].type, "elite");
    assert.equal(g.rocks[0].hp, s.eliteHp);
    assert.equal(g.rocks[0].maxHp, s.eliteHp);
  }
});

test("stage-only density caps cover ordinary batches and elites without changing the endless cap or HP", () => {
  for (const s of STAGES) {
    const g = new Game({ random: seed(s.id) });
    g.start({ stage: s.id });
    g.rocks = Array.from({ length: s.maxRocks - 1 }, () => ({ hp: 1 }));
    g.spawnRocks();
    assert.equal(g.rocks.length, s.maxRocks);
    g.spawnRocks(true);
    g.spawnRocks();
    assert.equal(g.rocks.length, s.maxRocks);
  }
  assert.equal(CONFIG.rocks.cap, 80);
  for (const seconds of [0, 30, 90, 180]) {
    for (const [i, roll] of [0.1, 0.75, 0.95].entries()) {
      const g = new Game({ random: () => roll });
      g.start();
      g.time = seconds;
      const d = g.currentDifficulty();
      g.spawnRocks();
      assert.equal(g.rocks[0].hp, CONFIG.rocks.types[i].hp(d.hardness));
      g.rocks = [];
      g.spawnRocks(true);
      assert.equal(g.rocks[0].hp, d.hardness * 2 + 6);
    }
  }
});

test("actual sequential clears unlock all four ships at 5/15/25 once, without spending coins", () => {
  const storage = store(fresh()),
    p = new Progress(storage);
  for (let id = 1; id <= 40; id++) {
    const before = p.snapshot();
    p.finish(`failed-${id}`, 45000, 15, { stage: id, cleared: false });
    assert.deepEqual(p.data.unlocked, before.unlocked);
    p.finish(`early-${id}`, 29999, 0, { stage: id, cleared: true });
    assert.deepEqual(p.data.clearedStages, before.clearedStages);
    const result = p.finish(`clear-${id}`, 45000, 15, {
      stage: id,
      cleared: true,
    });
    assert.equal(result.reward.firstClearCoins, 5 + (id - 1) * 2);
    assert.deepEqual(p.data.unlocked, [
      "pioneer",
      ...(id >= 5 ? ["lance"] : []),
      ...(id >= 15 ? ["nova"] : []),
      ...(id >= 25 ? ["seeker"] : []),
    ]);
    const balance = p.data.credits;
    for (const ship of p.data.unlocked) assert.equal(p.selectShip(ship), true);
    assert.equal(p.data.credits, balance);
    assert.deepEqual(new Progress(storage).data.unlocked, p.data.unlocked);
    assert.equal(
      p.finish(`clear-${id}`, 45000, 15, { stage: id, cleared: true })
        .duplicate,
      true,
    );
  }
  assert.equal(p.data.selectedStage, 40);
  assert.equal(p.selectStage(41), false);
  assert.deepEqual(
    Object.keys(p.snapshot()).sort(),
    Object.keys(fresh()).sort(),
  );
});

test("old ten-stage completion and new forty-stage saves retain numbered progress and recent records without new fields", () => {
  const raw = {
    ...fresh(),
    credits: 430,
    selectedShip: "lance",
    unlocked: ["pioneer", "lance"],
    clearedStages: clears(10),
    selectedStage: 10,
  };
  const storage = store(raw),
    p = new Progress(storage);
  assert.deepEqual(p.snapshot(), raw);
  assert.equal(p.selectStage(11), true);
  assert.equal(p.selectStage(12), false);
  p.finish("next-planet", 33000, 5, { stage: 11, cleared: true });
  const next = p.snapshot();
  assert.deepEqual(next.clearedStages, clears(11));
  assert.equal(next.selectedStage, 12);
  assert.equal(next.recentRuns[0].stage, 11);
  assert.equal(next.recentRuns[0].cleared, true);
  assert.deepEqual(new Progress(storage).snapshot(), next);
  assert.deepEqual(
    sanitize({ ...next, clearedStages: clears(40), selectedStage: 999 })
      .selectedStage,
    40,
  );
  assert.deepEqual(
    sanitize({ ...next, clearedStages: clears(7), selectedStage: 41 })
      .clearedStages,
    clears(7),
  );
});

test("normal weapons finish all forty stages with mid-level upgrades, and the final stage with stock initial weapons", () => {
  const priorities = [
    "damage",
    "rapid",
    "multi",
    "sub",
    "speed",
    "shield",
    "repair",
    "magnet",
  ];
  const runs = [
    ...STAGES.map((s) => ({
      stage: s.id,
      levels: { speed: 3, multi: 2, sub: 1 },
    })),
    { stage: 40, levels: { speed: 1, multi: 1, sub: 0 } },
  ];
  for (const loadout of runs) {
    for (const n of [127, 158]) {
      const g = new Game({ random: seed(n) });
      g.start({ ...loadout, ship: "pioneer" });
      // Isolate cleanup/firepower from human avoidance skill; never remove rocks or inject damage.
      g.player.invincible = 10000;
      for (let frame = 0; frame < 60 * 123 && g.state !== "result"; frame++) {
        if (g.state === "upgrade") {
          const ranks = g.choices.map((c) => priorities.indexOf(c.id));
          g.chooseUpgrade(ranks.indexOf(Math.min(...ranks)));
        }
        let target = null;
        for (const r of g.rocks)
          if (r.hp > 0 && r.y < g.player.y - 30 && (!target || r.y > target.y))
            target = r;
        const dx = target ? target.x - g.player.x : 0;
        g.input.x = Math.abs(dx) < 3 ? dx / 5 : Math.sign(dx);
        g.advance(CONFIG.step);
        g.events.length = 0;
      }
      assert.equal(
        g.outcome,
        "cleared",
        `stage ${loadout.stage}, seed ${n}, levels ${JSON.stringify(loadout.levels)}, ${g.remainingRocks} left at ${g.time}s`,
      );
      assert.equal(g.remainingRocks, 0);
    }
  }
});
