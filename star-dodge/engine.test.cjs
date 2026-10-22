const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  Game,
  CONFIG: c,
  difficulty,
  Records,
  formatTime,
  segmentHit,
} = require("./engine.js");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function playing(random = () => 0.5) {
  const g = new Game({ random });
  g.start();
  for (let i = 0; i < 180; i++) g.advance(1 / 60);
  assert.equal(g.state, "playing");
  return g;
}
function safe(g, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    g.player.invincible = 10;
    g.advance(1 / 60);
  }
}
function rock(x, y, hp = 1, radius = 16, speed = 0) {
  return {
    x,
    y,
    hp,
    maxHp: hp,
    radius,
    speed,
    rotation: 0,
    spin: 0,
    shape: Array(10).fill(1),
  };
}
function bullet(x, y, vy = -600) {
  return { x, y, vx: 0, vy, radius: 3, damage: 1 };
}
const fakeStorage = () => ({
  value: null,
  getItem() {
    return this.value;
  },
  setItem(key, value) {
    this.value = value;
  },
});

test("3 second countdown does not advance gameplay; immediate single shot", () => {
  const g = new Game();
  g.start();
  for (let i = 0; i < 179; i++) g.advance(1 / 60);
  assert.equal(g.time, 0);
  assert.equal(g.rocks.length, 0);
  assert.equal(g.bullets.length, 0);
  g.advance(1 / 60);
  assert.equal(g.state, "playing");
  assert.equal(g.bullets.length, 1);
  assert.equal(g.time, 0);
});
test("0.25 second fire cadence and initial 600 speed", () => {
  const g = playing();
  for (let i = 0; i < 14; i++) g.advance(1 / 60);
  assert.equal(g.bullets.length, 1);
  close(g.bullets[0].vy, -600);
  g.advance(1 / 60);
  assert.equal(g.bullets.length, 2);
});
test("movement is normalized, bounded and 300 units per second", () => {
  const a = playing(),
    b = playing();
  a.input = { x: 1, y: 0 };
  b.input = { x: 1, y: 1 };
  const x = a.player.x,
    y = a.player.y;
  for (let i = 0; i < 20; i++) {
    a.advance(1 / 60);
    b.advance(1 / 60);
  }
  close(a.player.x - x, 100);
  close(Math.hypot(b.player.x - x, b.player.y - y), 100);
  a.moveBy(9999, -9999);
  assert.equal(a.player.x, 470);
  assert.equal(a.player.y, 10);
});
test("30, 60, 120fps produce identical time, travel and shot count", () => {
  const results = [];
  for (const fps of [30, 60, 120]) {
    const g = playing();
    g.input = { x: -1, y: 0 };
    for (let i = 0; i < fps * 0.5; i++) g.advance(1 / fps);
    results.push({
      time: g.time,
      x: g.player.x,
      bullets: g.bullets.map((b) => ({ x: b.x, y: b.y })),
    });
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});
test("a long stall contributes no more than 0.1 seconds", () => {
  const g = playing();
  g.advance(20);
  close(g.time, 0.1);
});
test("pause freezes all simulation including countdown, immunity and spawns", () => {
  const g = new Game();
  g.start();
  g.advance(0.1);
  g.pause();
  const count = g.countdown;
  g.advance(90);
  assert.equal(g.countdown, count);
  g.resume();
  while (g.state === "countdown") g.advance(1 / 60);
  g.player.invincible = 1;
  g.pause();
  const snapshot = JSON.stringify(g);
  g.advance(80);
  assert.equal(JSON.stringify(g), snapshot);
  g.resume();
  g.advance(1 / 60);
  assert.ok(g.time > 0);
  assert.ok(g.player.invincible < 1);
});
test("initial meteor spawns at 0.95 seconds, above screen", () => {
  const g = playing();
  g.bullets = [];
  g.mainAt = 100;
  for (let i = 0; i < 56; i++) g.advance(1 / 60);
  assert.equal(g.rocks.length, 0);
  g.advance(1 / 60);
  assert.equal(g.rocks.length, 1);
  assert.ok(g.rocks[0].y + g.rocks[0].radius < 2);
});
test("meteor schedule and hardening match supplied checkpoints", () => {
  for (const [t, interval, batch, h] of [
    [0, 0.95, 1, 1],
    [60, 0.71, 1, 3],
    [90, 0.59, 2, 4],
    [120, 0.47, 2, 5],
    [180, 0.23, 3, 7],
  ]) {
    const d = difficulty(t);
    close(d.interval, interval);
    assert.equal(d.batch, batch);
    assert.equal(d.hardness, h);
  }
  assert.equal(difficulty(10000).interval, 0.22);
  assert.equal(difficulty(10000).speed, 180);
});
test("all three rock types and new-only HP hardening", () => {
  for (const [roll, radius, hp] of [
    [0.2, 16, 2],
    [0.7, 26, 4],
    [0.95, 38, 8],
  ]) {
    const g = playing(() => roll);
    g.time = 30;
    g.spawnRocks();
    assert.equal(g.rocks[0].radius, radius);
    assert.equal(g.rocks[0].hp, hp);
    g.time = 60;
    assert.equal(g.rocks[0].hp, hp);
  }
});
test("meteor cap, simultaneous spacing and failed placements", () => {
  let n = 0;
  const g = playing(() => ((n++ % 17) + 0.5) / 17);
  g.time = 180;
  g.spawnRocks();
  assert.equal(g.rocks.length, 3);
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++)
      assert.ok(
        Math.abs(g.rocks[i].x - g.rocks[j].x) >=
          g.rocks[i].radius + g.rocks[j].radius + 12,
      );
  while (g.rocks.length < 80) g.rocks.push(rock(10, -100));
  g.spawnRocks();
  assert.equal(g.rocks.length, 80);
  const stacked = playing(() => 0.5);
  stacked.time = 180;
  stacked.spawnRocks();
  assert.equal(stacked.rocks.length, 1);
});
test("items start at 15s, cycle on missed drops and do not grant power on spawn", () => {
  const g = playing();
  safe(g, 15 - 1 / 60);
  assert.equal(g.items.length, 0);
  safe(g, 1 / 60);
  assert.equal(g.items[0].type, "speed");
  assert.deepEqual(g.levels, { speed: 1, multi: 1, sub: 0 });
  safe(g, 15);
  assert.equal(g.items[0].type, "multi");
  assert.equal(g.levels.multi, 1);
  safe(g, 15);
  assert.equal(g.items[0].type, "sub");
});
test("item cadence reaches all caps at 135s when each drop is collected", () => {
  const g = playing();
  for (let i = 0; i < 9; i++) {
    safe(g, 15);
    const item = g.items.at(-1);
    assert.ok(item);
    g.collect(item);
    g.items = [];
  }
  assert.equal(g.time, 135);
  assert.deepEqual(g.levels, { speed: 5, multi: 3, sub: 3 });
  g.spawnItem();
  assert.equal(g.items.length, 0);
  for (const type of ["speed", "multi", "sub"]) g.collect({ type });
  assert.deepEqual(g.levels, { speed: 5, multi: 3, sub: 3 });
});
test("collected items upgrade, maxed kinds are skipped", () => {
  const g = playing();
  g.items = [{ x: g.player.x, y: g.player.y, radius: 19, type: "speed" }];
  g.advance(1 / 60);
  assert.equal(g.levels.speed, 2);
  assert.equal(g.items.length, 0);
  g.levels.speed = 5;
  g.itemCursor = 0;
  g.spawnItem();
  assert.equal(g.items[0].type, "multi");
});
test("speed changes velocity only; multi uses configured angles and sub remains independent", () => {
  const g = playing();
  g.bullets = [];
  g.collect({ type: "speed" });
  g.fire();
  assert.equal(g.bullets[0].vy, -720);
  assert.equal(g.mainAt, 0.25);
  g.collect({ type: "multi" });
  g.bullets = [];
  g.fire();
  assert.equal(g.bullets.length, 2);
  close(g.bullets[0].vx, -Math.sin((5 * Math.PI) / 180) * 720);
  g.collect({ type: "multi" });
  g.bullets = [];
  g.fire();
  assert.equal(g.bullets.length, 3);
  g.collect({ type: "sub" });
  g.bullets = [];
  g.fire(true);
  assert.equal(g.bullets.length, 1);
  assert.equal(g.bullets[0].vy, -650);
  g.collect({ type: "sub" });
  g.bullets = [];
  g.fire(true);
  assert.equal(g.bullets.length, 2);
});
test("drone cadence is 1s then 0.7s at level 3", () => {
  const g = playing();
  g.collect({ type: "sub" });
  safe(g, 1 - 1 / 60);
  assert.equal(g.bullets.filter((b) => b.sub).length, 0);
  safe(g, 1 / 60);
  assert.equal(g.bullets.filter((b) => b.sub).length, 1);
  g.collect({ type: "sub" });
  g.collect({ type: "sub" });
  g.bullets = [];
  safe(g, 0.7);
  assert.equal(g.bullets.filter((b) => b.sub).length, 2);
});
test("swept bullet collision prevents tunneling and chooses closest target", () => {
  const g = playing();
  g.mainAt = 100;
  g.bullets = [bullet(240, 400, -18000)];
  g.rocks = [rock(240, 200), rock(240, 300)];
  g.advance(1 / 60);
  assert.equal(g.destroyed, 1);
  assert.equal(g.rocks.length, 1);
  assert.equal(g.rocks[0].y, 200);
  assert.equal(g.bullets.length, 0);
  assert.equal(segmentHit(0, 0, 1, 0, 10, 0, 1), null);
});
test("nonpiercing bullets damage once, destroyed targets cannot absorb another bullet", () => {
  const g = playing();
  g.mainAt = 100;
  g.bullets = [bullet(240, 300), bullet(240, 300)];
  g.rocks = [rock(240, 290)];
  g.advance(1 / 60);
  assert.equal(g.destroyed, 1);
  assert.equal(g.bullets.length, 1);
});
test("damage removes touching rock; 1.2 second immunity prevents multiple hits", () => {
  const g = playing();
  g.bullets = [];
  g.mainAt = 100;
  g.rocks = [rock(g.player.x, g.player.y), rock(g.player.x, g.player.y)];
  g.advance(1 / 60);
  assert.equal(g.player.hp, 2);
  assert.equal(g.rocks.length, 1);
  close(g.player.invincible, 1.2);
  for (let i = 0; i < 71; i++) g.advance(1 / 60);
  assert.equal(g.player.hp, 2);
  g.advance(1 / 60);
  assert.equal(g.player.hp, 1);
});
test("fatal collision precedes pickup; gameover freezes movement, upgrades and time", () => {
  const g = playing();
  g.bullets = [];
  g.mainAt = 100;
  g.player.hp = 1;
  g.rocks = [rock(g.player.x, g.player.y)];
  g.items = [{ x: g.player.x, y: g.player.y, radius: 19, type: "speed" }];
  g.advance(1 / 60);
  assert.equal(g.state, "result");
  assert.equal(g.levels.speed, 1);
  const before = JSON.stringify(g);
  g.advance(20);
  g.moveBy(100, 100);
  assert.equal(JSON.stringify(g), before);
});
test("retry resets all run state and timers", () => {
  const g = playing();
  safe(g, 32);
  g.levels = { speed: 5, multi: 3, sub: 3 };
  g.player.hp = 1;
  g.destroyed = 10;
  g.start();
  assert.equal(g.state, "countdown");
  assert.equal(g.time, 0);
  assert.equal(g.player.hp, 3);
  assert.deepEqual(g.levels, { speed: 1, multi: 1, sub: 0 });
  assert.equal(g.bullets.length + g.rocks.length + g.items.length, 0);
  assert.equal(g.destroyed, 0);
  assert.equal(g.rockAt, 0.95);
  assert.equal(g.itemAt, 15);
  assert.equal(g.mainAt, 0);
  assert.equal(g.subAt, 1);
  assert.equal(g.itemCursor, 0);
});
test("offscreen objects are removed without damage or score penalty", () => {
  const g = playing();
  g.bullets = [bullet(-50, 0)];
  g.rocks = [rock(10, 800)];
  g.items = [{ type: "speed", x: 50, y: 800, radius: 19 }];
  g.advance(1 / 60);
  assert.equal(g.bullets.length + g.rocks.length + g.items.length, 0);
  assert.equal(g.player.hp, 3);
  assert.equal(g.destroyed, 0);
});
test("record formatting truncates; exact milliseconds determine best and ties do not update", () => {
  const storage = fakeStorage(),
    r = new Records(storage);
  assert.equal(formatTime(75438), "75.4");
  assert.equal(r.finish(75438), true);
  assert.equal(r.finish(75438), false);
  assert.equal(r.finish(75439), true);
  assert.equal(r.finish(70000), false);
  const reread = new Records(storage);
  assert.equal(reread.data.best, 75439);
  assert.equal(reread.data.last, 70000);
  r.sound(true);
  assert.equal(new Records(storage).data.sound, true);
});
test("corrupt, missing, invalid and denied storage never prevent play", () => {
  for (const value of [
    "bad json",
    "null",
    '{"best":-1,"last":"42","sound":"true"}',
    "{}",
  ]) {
    const storage = fakeStorage();
    storage.value = value;
    const r = new Records(storage);
    assert.deepEqual(r.data, { best: 0, last: 0, sound: false });
    r.finish(100);
    assert.equal(r.data.best, 100);
  }
  const denied = new Records({
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  });
  denied.finish(300);
  assert.equal(denied.tabOnly, true);
  assert.equal(denied.data.best, 300);
  const missing = new Records();
  missing.finish(500);
  assert.equal(missing.data.best, 500);
  assert.equal(missing.tabOnly, true);
});
