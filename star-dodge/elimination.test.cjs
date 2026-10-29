const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Game, CONFIG } = require("./engine.js");
const { Progress, calculateFlightReward } = require("./progression.js");
const seed = () => {
  let n = 127;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
};
function play(stage = 1) {
  const g = new Game({ random: seed() });
  g.start({ stage });
  for (let i = 0; i < 180; i++) g.advance(1 / 60);
  g.mainAt = g.subAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
  g.bullets = [];
  g.events = [];
  return g;
}
function rock(type = "meteor", overrides = {}) {
  return {
    type,
    x: 150,
    y: 100,
    originX: 150,
    radius: 16,
    hp: 3,
    maxHp: 5,
    speed: 0,
    age: 0,
    phase: "approach",
    vx: 0,
    nextShot: 2.5,
    amplitude: 30,
    wavePhase: 0,
    rotation: 0,
    spin: 0,
    shape: Array(10).fill(1),
    ...overrides,
  };
}
function time(g, t) {
  g.ticks = Math.round(t / CONFIG.step);
  g.time = g.ticks * CONFIG.step;
}
function enter(g, rocks = [rock()]) {
  time(g, 30 - CONFIG.step);
  g.rocks = rocks;
  g.advance(CONFIG.step);
  assert.equal(g.elimination, true);
  return g;
}
function lastKill() {
  const g = enter(play(), [rock("meteor", { hp: 1 })]);
  time(g, 35 - CONFIG.step);
  g.enemyBullets = [{ x: 20, y: 200, vx: 0, vy: 0, radius: 3 }];
  g.bullets = [{ x: 150, y: 100, vx: 0, vy: 0, radius: 3, damage: 1 }];
  g.advance(CONFIG.step);
  return g;
}

test("30s enters elimination once and counts all live rock types, including above the viewport", () => {
  const g = enter(play(5), [
    rock(),
    rock("weaver", { x: 60, originX: 60 }),
    rock("charger", { x: 350 }),
    rock("gunner", { x: 250 }),
    rock("elite", { y: -43, radius: 42 }),
    rock("meteor", { hp: 0 }),
  ]);
  assert.equal(g.time, 30);
  assert.equal(g.state, "playing");
  assert.equal(g.outcome, null);
  assert.equal(g.remainingRocks, 5);
  for (let i = 0; i < 10; i++) g.advance(CONFIG.step);
  assert.equal(g.events.filter((e) => e.type === "elimination").length, 1);
  assert.equal(g.events.find((e) => e.type === "elimination").remaining, 5);
  assert.equal(g.events.filter((e) => e.type === "gameover").length, 0);
});
test("elimination blocks every new spawn at the boundary and afterwards", () => {
  const g = play(5);
  time(g, 30 - CONFIG.step);
  g.rockAt = g.itemAt = g.eventAt = 30;
  g.rocks = [rock("gunner", { age: 3, nextShot: 0 })];
  g.items = [{ type: "core", x: 24, y: 24, radius: 16, scheduled: false }];
  g.advance(CONFIG.step);
  assert.equal(g.elimination, true);
  assert.equal(g.rocks.length, 1);
  assert.equal(g.items.length, 1);
  assert.equal(g.enemyBullets.length, 0);
  g.spawnRocks();
  g.spawnRocks(true);
  g.spawnItem();
  assert.equal(g.spawnCore(), false);
  g.triggerEvent();
  for (let i = 0; i < 360; i++) g.advance(CONFIG.step);
  assert.equal(g.rocks.length, 1);
  assert.ok(g.items.length <= 1);
  assert.equal(g.enemyBullets.length, 0);
  assert.equal(g.events.filter((e) => e.type === "event").length, 0);
  // An elite can be destroyed, but its normally guaranteed new drop is suppressed.
  g.rocks[0].type = "elite";
  g.rocks[0].hp = 1;
  const previous = g.items.length;
  g.bullets = [
    { x: g.rocks[0].x, y: g.rocks[0].y, vx: 0, vy: 0, radius: 3, damage: 1 },
  ];
  g.advance(CONFIG.step);
  assert.equal(g.items.length, previous);
  assert.equal(g.outcome, "cleared");
});
test("bottom exits recycle the same target, preserving HP and type while resetting its approach", () => {
  for (const type of ["meteor", "weaver", "charger", "gunner", "elite"]) {
    const target = rock(type, {
      radius: type === "elite" ? 42 : 16,
      hp: 2,
      maxHp: 9,
      speed: 70,
    });
    const g = enter(play(5), [target]);
    target.y = CONFIG.height + target.radius + 1;
    target.phase = "charge";
    target.vx = 120;
    target.warningUntil = 50;
    target.targetX = 400;
    g.advance(CONFIG.step);
    assert.equal(g.rocks[0], target);
    assert.equal(target.type, type);
    assert.equal(target.hp, 2);
    assert.equal(target.maxHp, 9);
    assert.ok(target.y + target.radius < 0);
    assert.equal(target.oldY, target.y);
    assert.equal(target.oldX, target.x);
    assert.ok(
      target.x >= target.radius && target.x <= CONFIG.width - target.radius,
    );
    assert.ok(target.speed > 0);
    assert.equal(target.phase, "approach");
    assert.equal(target.age, 0);
    assert.equal(target.vx, 0);
    assert.equal(g.destroyed, 0);
    assert.equal(g.state, "playing");
  }
});
test("escaping repeatedly without shooting never clears the elimination phase", () => {
  const g = enter(play(), [rock("meteor", { y: 700, speed: 160 })]);
  g.player.invincible = 1000;
  for (let i = 0; i < 3600; i++) g.advance(CONFIG.step);
  assert.equal(g.time, 90);
  assert.equal(g.state, "playing");
  assert.equal(g.remainingRocks, 1);
  assert.equal(g.destroyed, 0);
  assert.equal(g.outcome, null);
  assert.equal(g.events.filter((e) => e.type === "gameover").length, 0);
});
test("destroying the final rock clears exactly once at the real completion time even with enemy bullets left", () => {
  const g = lastKill();
  assert.equal(g.time, 35);
  assert.equal(g.outcome, "cleared");
  assert.equal(g.state, "result");
  assert.equal(g.destroyed, 1);
  assert.equal(g.remainingRocks, 0);
  assert.equal(g.enemyBullets.length, 1);
  const result = g.events.filter((e) => e.type === "gameover");
  assert.equal(result.length, 1);
  assert.equal(result[0].ms, 35000);
  assert.equal(result[0].cleared, true);
  const before = JSON.stringify({
    time: g.time,
    p: g.player,
    bullets: g.enemyBullets,
    events: g.events,
  });
  g.advance(50);
  assert.equal(
    JSON.stringify({
      time: g.time,
      p: g.player,
      bullets: g.enemyBullets,
      events: g.events,
    }),
    before,
  );
});
test("an empty stage still clears at 30s without an elimination banner, regardless of remaining bullets", () => {
  const g = play();
  time(g, 30 - CONFIG.step);
  g.rockAt = g.itemAt = g.eventAt = 30;
  g.enemyBullets = [{ x: 20, y: 20, vx: 0, vy: 0, radius: 3 }];
  g.advance(CONFIG.step);
  assert.equal(g.time, 30);
  assert.equal(g.outcome, "cleared");
  assert.equal(g.elimination, false);
  assert.equal(g.enemyBullets.length, 1);
  assert.equal(g.events.filter((e) => e.type === "elimination").length, 0);
  assert.equal(g.events.filter((e) => e.type === "gameover").length, 1);
});
test("fatal damage in elimination wins over a same-frame final destruction", () => {
  for (const sameFrameKill of [false, true]) {
    const g = enter(play());
    g.player.hp = 1;
    g.player.invincible = 0;
    time(g, 35 - CONFIG.step);
    if (sameFrameKill) {
      g.rocks[0].hp = 1;
      g.bullets = [{ x: 150, y: 100, vx: 0, vy: 0, radius: 3, damage: 1 }];
      g.enemyBullets = [
        { x: g.player.x, y: g.player.y, vx: 0, vy: 0, radius: 3 },
      ];
    } else {
      g.rocks[0].x = g.player.x;
      g.rocks[0].y = g.player.y;
    }
    g.advance(CONFIG.step);
    assert.equal(g.outcome, "destroyed");
    assert.equal(g.player.hp, 0);
    assert.equal(g.state, "result");
    assert.equal(g.destroyed, sameFrameKill ? 1 : 0);
    const results = g.events.filter((e) => e.type === "gameover");
    assert.equal(results.length, 1);
    assert.notEqual(results[0].cleared, true);
  }
});
test("ramming and shield contact cannot remove the final target or replace a kill", () => {
  for (const shield of [0, 1]) {
    const target = rock();
    const g = enter(play(), [target]);
    g.shield = shield;
    target.x = g.player.x;
    target.y = g.player.y;
    g.advance(CONFIG.step);
    assert.equal(target.hp, 3);
    assert.equal(g.remainingRocks, 1);
    assert.equal(g.player.hp, shield ? 3 : 2);
    assert.equal(g.shield, 0);
    assert.equal(g.destroyed, 0);
    assert.equal(g.state, "playing");
    assert.equal(g.outcome, null);
  }
});
test("an existing core remains collectible and pause/selection retain the elimination phase", () => {
  const g = play();
  time(g, 30 - CONFIG.step);
  g.rocks = [rock()];
  g.items = [
    {
      type: "core",
      x: g.player.x + 50,
      y: g.player.y,
      radius: 16,
      scheduled: false,
    },
  ];
  g.advance(CONFIG.step);
  for (let i = 0; i < 10 && g.state === "playing"; i++) g.advance(CONFIG.step);
  assert.equal(g.state, "upgrade");
  assert.equal(g.elimination, true);
  const before = JSON.stringify({
    time: g.time,
    rocks: g.rocks,
    items: g.items,
    bullets: g.bullets,
  });
  g.pause();
  g.advance(10);
  g.resume();
  assert.equal(g.state, "upgrade");
  assert.equal(
    JSON.stringify({
      time: g.time,
      rocks: g.rocks,
      items: g.items,
      bullets: g.bullets,
    }),
    before,
  );
  assert.equal(g.chooseUpgrade(0), true);
  assert.equal(g.elimination, true);
  assert.equal(g.remainingRocks, 1);
  g.start({ stage: 1 });
  assert.equal(g.elimination, false);
  assert.equal(g.time, 0);
});
test("actual completion duration settles once and unlocks the next stage without save-schema changes", () => {
  const g = lastKill(),
    storage = {
      value: null,
      getItem() {
        return this.value;
      },
      setItem(k, v) {
        this.value = v;
      },
    },
    p = new Progress(storage),
    keys = Object.keys(p.snapshot());
  const event = g.events.find((e) => e.type === "gameover"),
    context = { stage: g.stage.id, cleared: event.cleared };
  const result = p.finish("elimination", event.ms, g.destroyed, context);
  assert.equal(result.reward.survivalCoins, 7);
  assert.equal(result.reward.milestoneCoins, 4);
  assert.equal(result.credits, 16);
  assert.equal(calculateFlightReward(30000, g.destroyed).totalCoins, 10);
  assert.equal(p.data.totalMs, 35000);
  assert.equal(p.data.recentRuns[0].ms, 35000);
  assert.equal(p.data.recentRuns[0].cleared, true);
  assert.deepEqual(p.data.clearedStages, [1]);
  assert.equal(p.data.selectedStage, 2);
  assert.deepEqual(Object.keys(p.snapshot()), keys);
  assert.ok(!JSON.stringify(p.snapshot()).includes('elimination":'));
  const reloaded = new Progress(storage);
  assert.equal(
    reloaded.finish("elimination", event.ms, g.destroyed, context).duplicate,
    true,
  );
  assert.equal(reloaded.data.credits, 16);
  const failed = new Progress({
    getItem() {
      return null;
    },
    setItem() {},
  });
  failed.finish("failed", 35000, 1, { stage: 1, cleared: false });
  assert.deepEqual(failed.data.clearedStages, []);
});
test("endless keeps spawning, enemy shooting, events and ordinary bottom removal after 30s", () => {
  const g = play(null);
  time(g, 30 - CONFIG.step);
  g.rockAt = g.itemAt = g.eventAt = 30;
  const escaped = rock("meteor", { y: CONFIG.height + 20 }),
    gunner = rock("gunner", { x: 300, originX: 300, age: 3, nextShot: 0 });
  g.rocks = [escaped, gunner];
  g.advance(CONFIG.step);
  assert.equal(g.stageTimeUp, false);
  assert.equal(g.elimination, false);
  assert.equal(g.state, "playing");
  assert.ok(!g.rocks.includes(escaped));
  assert.ok(g.rocks.length > 1);
  assert.equal(g.items.length, 1);
  assert.equal(g.enemyBullets.length, 1);
  assert.equal(g.events.filter((e) => e.type === "event").length, 1);
  assert.equal(g.outcome, null);
});
test("seeded recycling is identical at 30/60/120fps", () => {
  const states = [30, 60, 120].map((fps) => {
    const g = play(5);
    g.rocks = [rock("weaver", { y: 500, speed: 7 })];
    g.player.invincible = 1000;
    for (let i = 0; i < 45 * fps; i++) g.advance(1 / fps);
    assert.equal(g.elimination, true);
    assert.equal(g.state, "playing");
    return JSON.stringify({
      time: g.time,
      rocks: g.rocks,
      remaining: g.remainingRocks,
      destroyed: g.destroyed,
      events: g.events,
    });
  });
  assert.equal(states[0], states[1]);
  assert.equal(states[1], states[2]);
});
