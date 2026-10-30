const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Game, CONFIG, FLIGHT_UPGRADES } = require("./engine.js");
const { SHIPS } = require("./progression.js");
const seeded = () => {
  let n = 127;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function play(ship = "pioneer", stage = null) {
  const g = new Game({ random: seeded() });
  g.start({ ship, stage });
  for (let i = 0; i < 180; i++) g.advance(CONFIG.step);
  g.mainAt = g.subAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
  g.bullets = [];
  g.events = [];
  return g;
}
function rock(x = 200, y = 400, hp = 3) {
  return {
    type: "meteor",
    x,
    y,
    radius: 16,
    hp,
    maxHp: hp,
    speed: 0,
    rotation: 0,
    spin: 0,
    shape: Array(10).fill(1),
  };
}
function shot(g, sub = false) {
  g.bullets = [];
  if (sub) g.levels.sub = 1;
  g.fire(sub);
  const b = g.bullets[0];
  b.x = 200;
  b.y = 400;
  b.vx = 0;
  b.vy = 0;
  return b;
}
test("all four ships apply shared main upgrades before provisional ship speed and cadence multipliers", () => {
  for (const ship of SHIPS) {
    const g = play(ship.id);
    g.skills.rapid = 3;
    g.skills.damage = 2;
    g.levels.multi = 3;
    const speedFactor =
      ship.id === "lance" ? 0.85 : ship.id === "seeker" ? 0.9 : 1;
    for (let level = 1; level <= 5; level++) {
      g.levels.speed = level;
      g.bullets = [];
      g.fire();
      assert.equal(g.bullets.length, 3);
      for (const b of g.bullets) {
        close(
          Math.hypot(b.vx, b.vy),
          CONFIG.main.speeds[level - 1] * speedFactor,
        );
        assert.equal(b.damage, 3);
      }
    }
    close(
      g.fireInterval(),
      0.25 * (1 - 0.12 * 3) * (ship.id === "nova" ? 1.15 : 1),
    );
    assert.equal(g.player.hp, 3);
    assert.equal(g.player.speed, 300);
  }
});
test("lance sweeps through every intersected rock in collision order and keeps the bullet", () => {
  const g = play("lance");
  const first = rock(200, 475),
    second = rock(200, 350),
    third = rock(200, 225),
    miss = rock(250, 350);
  g.rocks = [third, first, miss, second];
  const b = shot(g);
  b.x = 200;
  b.y = 500;
  b.vy = -20000;
  g.advance(CONFIG.step);
  assert.deepEqual([first.hp, second.hp, third.hp, miss.hp], [2, 2, 2, 3]);
  assert.equal(g.bullets[0], b);
  assert.deepEqual(
    g.events.filter((e) => e.type === "hit").map((e) => e.y),
    [475, 350, 225],
  );
  assert.equal(b.hitRocks.size, 3);
});
test("one piercing projectile cannot repeatedly hit an overlapping or recycled target", () => {
  const g = play("lance"),
    target = rock(200, 400, 10);
  g.rocks = [target];
  const b = shot(g);
  for (let i = 0; i < 15; i++) g.advance(CONFIG.step);
  assert.equal(target.hp, 9);
  assert.equal(g.events.filter((e) => e.type === "hit").length, 1);
  g.recycleRock(target);
  target.x = b.x;
  target.y = b.y;
  target.speed = 0;
  g.advance(CONFIG.step);
  assert.equal(target.hp, 9);
  assert.equal(b.hitRocks.size, 1);
});
test("nova direct kills explode once with fixed one damage at radius70 and no secondary chain", () => {
  const g = play("nova"),
    direct = rock(200, 400, 1),
    secondary = rock(260, 400, 1),
    chainOnly = rock(320, 400),
    edge = rock(200, 470),
    outside = rock(200, 470.001);
  g.rocks = [direct, secondary, chainOnly, edge, outside];
  shot(g);
  g.advance(CONFIG.step);
  assert.deepEqual(
    [direct.hp, secondary.hp, chainOnly.hp, edge.hp, outside.hp],
    [0, 0, 3, 2, 3],
  );
  assert.equal(g.destroyed, 2);
  assert.equal(g.events.filter((e) => e.type === "destroy").length, 2);
  assert.deepEqual(
    g.events.filter((e) => e.type === "explosion"),
    [{ type: "explosion", x: 200, y: 400, radius: 70 }],
  );
  assert.equal(g.bullets.length, 0);
});
test("nova nonlethal hits and all drone kills retain ordinary collision without blast or penetration", () => {
  const nova = play("nova"),
    target = rock(200, 400, 2),
    neighbor = rock(260, 400);
  nova.rocks = [target, neighbor];
  shot(nova);
  nova.advance(CONFIG.step);
  assert.equal(target.hp, 1);
  assert.equal(neighbor.hp, 3);
  assert.equal(nova.events.filter((e) => e.type === "explosion").length, 0);
  for (const ship of SHIPS) {
    const g = play(ship.id),
      first = rock(200, 400, 1),
      next = rock(200, 360, 1),
      nearby = rock(260, 400);
    g.rocks = [first, next, nearby];
    const b = shot(g, true);
    b.y = 420;
    b.vy = -6000;
    assert.equal(b.weapon, "normal");
    g.advance(CONFIG.step);
    assert.equal(first.hp, 0);
    assert.equal(next.hp, 1);
    assert.equal(nearby.hp, 3);
    assert.equal(g.bullets.length, 0);
    assert.equal(g.events.filter((e) => e.type === "explosion").length, 0);
  }
});
test("drone speed, spread, power and cadence remain common across all four ships", () => {
  for (const ship of SHIPS) {
    const g = play(ship.id);
    g.levels.speed = 5;
    g.levels.multi = 3;
    g.levels.sub = 3;
    g.skills.dronePower = 2;
    g.skills.rapid = 3;
    g.fire(true);
    assert.equal(g.bullets.length, 2);
    for (const b of g.bullets) {
      assert.equal(b.sub, true);
      assert.equal(b.weapon, "normal");
      assert.equal(b.vx, 0);
      assert.equal(b.vy, -650);
      assert.equal(b.damage, 3);
    }
    g.subAt = CONFIG.step;
    g.advance(CONFIG.step);
    close(g.subAt, g.time + CONFIG.sub.fastInterval);
  }
});
test("seeker turns gradually towards the nearest live rock, preserves speed and retargets after a kill", () => {
  const g = play("seeker");
  g.fire();
  const b = g.bullets[0];
  b.x = 200;
  b.y = 500;
  const nearest = rock(260, 400),
    left = rock(40, 300);
  g.rocks = [left, nearest];
  const speed = Math.hypot(b.vx, b.vy),
    initial = Math.atan2(b.vy, b.vx);
  g.steerBullet(b, CONFIG.step);
  const turn = Math.atan2(b.vy, b.vx) - initial;
  assert.ok(b.vx > 0);
  assert.ok(turn > 0 && turn <= 2.4 / 60 + 1e-12);
  close(Math.hypot(b.vx, b.vy), speed);
  close(speed, 540);
  nearest.hp = 0;
  for (let i = 0; i < 3; i++) g.steerBullet(b, CONFIG.step);
  assert.ok(b.vx < 0);
  g.rocks = [];
  const before = [b.vx, b.vy];
  g.steerBullet(b, CONFIG.step);
  assert.deepEqual([b.vx, b.vy], before);
  b.sub = true;
  g.rocks = [rock(400, 500)];
  g.steerBullet(b, CONFIG.step);
  assert.deepEqual([b.vx, b.vy], before);
});
test("movement skill is absent and every ship remains at speed300 despite old loadout speeds", () => {
  assert.equal(FLIGHT_UPGRADES.length, 8);
  assert.ok(!FLIGHT_UPGRADES.some((u) => u.id === "movement"));
  for (const ship of SHIPS) {
    const g = play(ship.id);
    g.start({ ship: ship.id, speed: 450 });
    for (let i = 0; i < 180; i++) g.advance(CONFIG.step);
    assert.equal(g.player.speed, 300);
    assert.ok(!("movement" in g.skills));
    g.input = { x: 1, y: 0 };
    const x = g.player.x;
    g.advance(CONFIG.step);
    close(g.player.x - x, 5);
    g.offerUpgrades();
    assert.ok(g.choices.every((u) => u.id !== "movement"));
  }
});
test("piercing and blast final kills clear once, while a simultaneous lethal enemy bullet still wins", () => {
  for (const ship of ["lance", "nova"])
    for (const fatal of [false, true]) {
      const g = play(ship, 1);
      g.ticks = 2099;
      g.time = g.ticks * CONFIG.step;
      g.elimination = true;
      g.rocks =
        ship === "nova"
          ? [rock(200, 400, 1), rock(260, 400, 1)]
          : [rock(200, 400, 1), rock(200, 390, 1)];
      const b = shot(g);
      if (ship === "lance") {
        b.y = 420;
        b.vy = -6000;
      }
      if (fatal) {
        g.player.hp = 1;
        g.enemyBullets = [
          { x: g.player.x, y: g.player.y, vx: 0, vy: 0, radius: 3 },
        ];
      }
      g.advance(CONFIG.step);
      assert.equal(g.destroyed, 2);
      assert.equal(g.outcome, fatal ? "destroyed" : "cleared");
      const result = g.events.filter((e) => e.type === "gameover");
      assert.equal(result.length, 1);
      assert.equal(result[0].cleared === true, !fatal);
      g.advance(1);
      assert.equal(g.events.filter((e) => e.type === "gameover").length, 1);
    }
});
test("special weapons reproduce the same fixed-step simulation at 30/60/120fps and freeze while paused", () => {
  for (const ship of ["lance", "nova", "seeker"]) {
    const states = [30, 60, 120].map((fps) => {
      const g = play(ship);
      g.mainAt = 0;
      g.rockAt = 0.95;
      g.player.invincible = 1000;
      for (let i = 0; i < 16 * fps; i++) g.advance(1 / fps);
      g.pause();
      const snapshot = JSON.stringify(g, (key, value) =>
        value instanceof Set ? [...value].map((r) => [r.x, r.y, r.hp]) : value,
      );
      g.advance(1);
      assert.equal(
        JSON.stringify(g, (key, value) =>
          value instanceof Set
            ? [...value].map((r) => [r.x, r.y, r.hp])
            : value,
        ),
        snapshot,
      );
      g.resume();
      return JSON.stringify(
        {
          time: g.time,
          player: g.player,
          rocks: g.rocks,
          bullets: g.bullets,
          events: g.events,
          destroyed: g.destroyed,
        },
        (key, value) =>
          value instanceof Set
            ? [...value].map((r) => [r.x, r.y, r.hp])
            : value,
      );
    });
    assert.equal(states[0], states[1]);
    assert.equal(states[1], states[2]);
  }
});
