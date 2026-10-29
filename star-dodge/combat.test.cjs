const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { Game, CONFIG, FLIGHT_UPGRADES, Records } = require("./engine.js");
const { Progress, calculateFlightReward } = require("./progression.js");
const fixture = require("./test-fixtures/progress-0.4.json");
const seed = () => {
  let n = 17;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
};
function play(stage) {
  const g = new Game({ random: seed() });
  g.start({ stage });
  for (let i = 0; i < 180; i++) g.advance(1 / 60);
  return g;
}
function safe(g, seconds, choose = true) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    g.player.invincible = 1000;
    if (choose && g.state === "upgrade") g.chooseUpgrade(0);
    g.advance(1 / 60);
  }
}
const store = (raw) => ({
  value: JSON.stringify(raw),
  getItem() {
    return this.value;
  },
  setItem(k, v) {
    this.value = v;
  },
});
test("enemy patterns unlock progressively in the campaign and at 30/60/90s in endless", () => {
  for (let id = 1; id <= 10; id++) {
    const g = play(id);
    assert.deepEqual(g.patternPool(), [
      "weaver",
      ...(id >= 3 ? ["charger"] : []),
      ...(id >= 5 ? ["gunner"] : []),
    ]);
  }
  const g = play();
  for (const [time, expected] of [
    [0, []],
    [29.99, []],
    [30, ["weaver"]],
    [60, ["weaver", "charger"]],
    [90, ["weaver", "charger", "gunner"]],
  ]) {
    g.time = time;
    assert.deepEqual(g.patternPool(), expected);
  }
});
test("weavers stay inside the arena and chargers warn for 0.5s before locking their approach", () => {
  const g = play(5);
  g.random = () => 0.03;
  g.spawnRocks();
  const snake = g.rocks[0];
  assert.equal(snake.type, "weaver");
  const x = snake.x;
  for (let i = 0; i < 120; i++) g.moveRock(snake, 1 / 60);
  assert.notEqual(snake.x, x);
  assert.ok(snake.x >= snake.radius && snake.x <= CONFIG.width - snake.radius);
  g.rocks = [];
  g.random = () => 0.15;
  g.spawnRocks();
  const charger = g.rocks[0];
  assert.equal(charger.type, "charger");
  for (let i = 0; i < 90; i++) g.moveRock(charger, 1 / 60);
  assert.equal(charger.phase, "warning");
  for (let i = 0; i < 29; i++) g.moveRock(charger, 1 / 60);
  assert.equal(charger.phase, "warning");
  g.player.x = 400;
  g.moveRock(charger, 1 / 60);
  assert.equal(charger.phase, "charge");
  assert.ok(charger.vx > 0);
  const vx = charger.vx;
  g.player.x = 30;
  g.moveRock(charger, 1 / 60);
  assert.equal(charger.vx, vx, "charge does not track the pilot after locking");
});
test("gunners aim slow bullets, enforce the cap, and projectiles use the small hitbox and immunity", () => {
  const g = play(5);
  g.random = () => 0.3;
  g.spawnRocks();
  const gunner = g.rocks[0];
  assert.equal(gunner.type, "gunner");
  gunner.y = 100;
  gunner.x = 80;
  gunner.age = 2.49;
  g.moveRock(gunner, 1 / 60);
  assert.equal(g.enemyBullets.length, 1);
  assert.ok(g.enemyBullets[0].vx > 0);
  assert.ok(
    Math.abs(Math.hypot(g.enemyBullets[0].vx, g.enemyBullets[0].vy) - 125) <
      1e-6,
  );
  for (let i = 0; i < 100; i++) {
    gunner.age = 1000 + i * 3;
    gunner.y = 100;
    g.moveRock(gunner, 1 / 60);
  }
  assert.equal(g.enemyBullets.length, 48);
  g.rocks = [];
  g.enemyBullets = [
    { x: g.player.x + 10, y: g.player.y, vx: 0, vy: 0, radius: 3 },
  ];
  g.advance(1 / 60);
  assert.equal(g.player.hp, 3);
  g.enemyBullets = [
    { x: g.player.x + 9, y: g.player.y, vx: 0, vy: 0, radius: 3 },
    { x: g.player.x, y: g.player.y, vx: 0, vy: 0, radius: 3 },
  ];
  g.advance(1 / 60);
  assert.equal(g.player.hp, 2);
  assert.equal(g.enemyBullets.length, 1);
  g.enemyBullets = [{ x: -30, y: 20, vx: 0, vy: 0, radius: 3 }];
  g.advance(1 / 60);
  assert.equal(g.enemyBullets.length, 0);
});
test("15s campaign and 60s endless events alternate, preserve the curve and leave a lane", () => {
  for (const [id, kind] of [
    [1, "rush"],
    [2, "elite"],
  ]) {
    const g = play(id);
    g.itemAt = Infinity;
    safe(g, 15);
    assert.equal(g.eventState.kind, kind);
    assert.equal(g.events.filter((e) => e.type === "event").length, 1);
    assert.equal(g.eventAt, Infinity);
  }
  const g = play(10);
  g.time = 15;
  g.triggerEvent();
  g.eventState.kind = "rush";
  g.rocks = [];
  for (let i = 0; i < 100; i++) g.spawnRocks();
  assert.ok(g.rocks.length <= 80);
  assert.ok(
    g.rocks.every((r) => Math.abs(r.x - g.eventState.safeX) >= r.radius + 48),
  );
  g.time = 21;
  assert.equal(g.currentDifficulty().interval, g.stage.interval);
  const endless = play(),
    events = [];
  endless.itemAt = Infinity;
  for (let i = 0; i < 10800; i++) {
    endless.player.invincible = 1000;
    endless.advance(1 / 60);
    for (const e of endless.events)
      if (e.type === "event") events.push([endless.time, e.kind]);
    endless.events = [];
  }
  assert.deepEqual(events, [
    [60, "rush"],
    [120, "elite"],
    [180, "rush"],
  ]);
});
test("elite kills guarantee a core, carry distinct metadata and combo never grants money", () => {
  const g = play(2);
  g.eventAt = Infinity;
  g.itemAt = Infinity;
  g.rockAt = Infinity;
  g.mainAt = Infinity;
  g.spawnRocks(true);
  const elite = g.rocks[0];
  assert.equal(elite.type, "elite");
  assert.equal(elite.radius, 42);
  function kill(target) {
    target.x = 150;
    target.y = 100;
    target.hp = 1;
    g.rocks = [target];
    g.bullets = [{ x: 150, y: 110, vx: 0, vy: -600, radius: 3, damage: 1 }];
    g.advance(1 / 60);
  }
  kill(elite);
  assert.equal(g.items[0].type, "core");
  assert.equal(g.combo, 1);
  assert.equal(g.events.find((e) => e.type === "destroy").elite, true);
  kill({ ...elite, type: "meteor" });
  assert.equal(g.combo, 2);
  assert.equal(g.coreCoins, 0);
  assert.equal(g.destroyed, 2);
  g.ticks += 181;
  g.advance(1 / 60);
  assert.equal(g.combo, 0);
  assert.deepEqual(calculateFlightReward(30000, 2), {
    survivalCoins: 6,
    milestoneCoins: 4,
    destructionCoins: 0,
    totalCoins: 10,
  });
});
test("regular cores give two choices within a stage, freeze all simulation and resume safely from pause", () => {
  const g = play(1),
    times = [];
  let steps = 0;
  while (g.time < 30 && steps++ < 2000) {
    g.player.invincible = 1000;
    g.advance(1 / 60);
    if (g.state === "upgrade") {
      times.push(g.time);
      assert.equal(g.choices.length, 3);
      assert.equal(new Set(g.choices.map((o) => o.id)).size, 3);
      assert.ok(!g.choices.some((o) => o.id === "repair"));
      const before = JSON.stringify({
        time: g.time,
        p: g.player,
        rocks: g.rocks,
        bullets: g.bullets,
        enemy: g.enemyBullets,
        items: g.items,
      });
      g.advance(100);
      assert.equal(
        JSON.stringify({
          time: g.time,
          p: g.player,
          rocks: g.rocks,
          bullets: g.bullets,
          enemy: g.enemyBullets,
          items: g.items,
        }),
        before,
      );
      g.pause();
      assert.equal(g.state, "paused");
      assert.equal(g.chooseUpgrade(0), false);
      g.resume();
      assert.equal(g.state, "upgrade");
      assert.equal(g.chooseUpgrade(99), false);
      assert.equal(g.chooseUpgrade(0), true);
    }
  }
  assert.equal(g.outcome, null);
  assert.equal(g.state, "playing");
  assert.equal(g.elimination, true);
  assert.ok(g.remainingRocks > 0);
  assert.equal(times.length, 2);
  assert.ok(times[0] >= 12 && times[0] < 13);
  assert.ok(times[1] >= 24 && times[1] < 25);
  assert.equal(g.time, 30);
});
test("nine upgrade families enforce caps, apply stats and reset every flight", () => {
  const g = play();
  assert.equal(FLIGHT_UPGRADES.length, 9);
  const choose = (id) => {
    g.state = "upgrade";
    g.choices = [FLIGHT_UPGRADES.find((u) => u.id === id)];
    assert.equal(g.chooseUpgrade(0), true);
  };
  const interval = g.fireInterval();
  choose("rapid");
  assert.ok(g.fireInterval() < interval);
  choose("damage");
  g.bullets = [];
  g.fire();
  assert.equal(g.bullets[0].damage, 2);
  choose("movement");
  assert.ok(g.player.speed > 300);
  choose("magnet");
  assert.equal(g.skills.magnet, 1);
  choose("shield");
  g.player.invincible = 0;
  g.damagePlayer();
  assert.equal(g.player.hp, 3);
  assert.equal(g.shield, 0);
  g.player.hp = 2;
  choose("repair");
  assert.equal(g.player.hp, 3);
  for (let i = 0; i < 5; i++) choose("sub");
  g.bullets = [];
  g.fire(true);
  assert.equal(g.bullets[0].damage, 3);
  g.start();
  assert.deepEqual(g.skills, {
    rapid: 0,
    damage: 0,
    dronePower: 0,
    movement: 0,
    magnet: 0,
  });
  assert.equal(g.shield, 0);
  assert.equal(g.coreCoins, 0);
  assert.equal(g.player.speed, 300);
});
test("fully capped cores pay a small result-only bonus; total payout stays capped and idempotent", () => {
  const g = play();
  g.levels = { speed: 5, multi: 3, sub: 3 };
  g.skills = { rapid: 3, damage: 3, dronePower: 2, movement: 3, magnet: 3 };
  g.shield = 1;
  g.offerUpgrades();
  assert.deepEqual(
    g.choices.map((c) => c.id),
    ["coins"],
  );
  g.chooseUpgrade(0);
  assert.equal(g.coreCoins, 2);
  const p = new Progress(store(null));
  assert.equal(p.data.credits, 0);
  const reward = p.finish("max-core", 30000, 10, {
    coreCoins: g.coreCoins,
  }).reward;
  assert.equal(reward.coreCoins, 2);
  assert.equal(reward.totalCoins, 14);
  assert.equal(
    p.finish("max-core", 30000, 10, { coreCoins: 2 }).duplicate,
    true,
  );
  assert.equal(p.data.credits, 14);
  assert.equal(calculateFlightReward(1e9, 1e9, 500).totalCoins, 500);
});
test("the real 0.4 profile keeps every field and 20 histories; transient skills are never saved", () => {
  const storage = store(fixture),
    p = new Progress(storage);
  assert.deepEqual(p.snapshot(), fixture);
  assert.equal(p.data.recentRuns.length, 20);
  const before = p.snapshot(),
    g = play();
  g.start(p.loadout());
  g.state = "upgrade";
  g.choices = [FLIGHT_UPGRADES[0]];
  g.chooseUpgrade(0);
  assert.deepEqual(p.snapshot(), before);
  assert.ok(!("skills" in p.data));
  assert.deepEqual(p.loadout().visuals, { armor: 1, trail: true, drone: true });
  const copy = store(null),
    restored = new Progress(copy);
  restored.restore(p.snapshot());
  assert.deepEqual(restored.snapshot(), fixture);
});
test("sound defaults migrate once for everyone and a subsequent OFF survives reload", () => {
  const storage = store({ best: 32000, last: 30000, sound: false }),
    r = new Records(storage);
  assert.equal(r.data.sound, true);
  assert.equal(r.data.best, 32000);
  assert.equal(r.data.last, 30000);
  r.sound(false);
  assert.equal(new Records(storage).data.sound, false);
  assert.equal(JSON.parse(storage.value).soundDefaultRevision, 1);
});
test("fixed-step enemy and choice simulations remain identical at 30, 60 and 120fps", () => {
  const results = [30, 60, 120].map((fps) => {
    const g = new Game({ random: seed() });
    g.start({ stage: 5 });
    for (let frame = 0; frame < fps * 33; frame++) {
      g.player.invincible = 1000;
      if (g.state === "upgrade") g.chooseUpgrade(0);
      g.advance(1 / fps);
    }
    return JSON.stringify({
      time: g.time,
      rocks: g.rocks,
      enemy: g.enemyBullets,
      bullets: g.bullets,
      levels: g.levels,
      skills: g.skills,
      destroyed: g.destroyed,
      outcome: g.outcome,
    });
  });
  assert.equal(results[0], results[1]);
  assert.equal(results[1], results[2]);
});
test("all transient object queues have hard caps even under artificial bursts", () => {
  const g = play(10);
  g.levels.multi = 3;
  for (let i = 0; i < 1000; i++) g.fire();
  assert.equal(g.bullets.length, CONFIG.playerBullets);
  assert.ok(g.events.length <= 256);
  for (let i = 0; i < 100; i++) g.spawnCore();
  assert.equal(g.items.length, CONFIG.cores);
  for (let i = 0; i < 1000; i++) g.spawnRocks();
  assert.ok(g.rocks.length <= CONFIG.rocks.cap);
});

test("enemy bullets pass through an invincible pilot without consuming the shield", () => {
  const g = play();
  g.mainAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
  g.bullets = [];
  g.events = [];
  g.player.invincible = 0.4;
  g.shield = 1;
  const bullet = {
    x: g.player.x,
    y: g.player.y - 1,
    vx: 0,
    vy: 125,
    radius: 3,
  };
  g.enemyBullets = [bullet];
  g.advance(1 / 60);
  assert.equal(g.enemyBullets[0], bullet);
  assert.ok(!bullet.dead);
  assert.equal(g.player.hp, 3);
  assert.equal(g.shield, 1);
  for (let i = 0; i < 30; i++) g.advance(1 / 60);
  assert.equal(g.player.invincible, 0);
  assert.ok(bullet.y > g.player.y + g.player.radius + bullet.radius);
  assert.equal(g.enemyBullets[0], bullet);
  assert.equal(g.player.hp, 3);
  assert.equal(g.shield, 1);
  assert.equal(
    g.events.filter((e) => e.type === "damage" || e.type === "shield").length,
    0,
  );
});

test("enemy bullets are consumed by successful hits, including fatal damage", () => {
  for (const hp of [3, 1]) {
    const g = play();
    g.mainAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
    g.bullets = [];
    g.events = [];
    g.player.hp = hp;
    const bullet = {
      x: g.player.x,
      y: g.player.y - 1,
      vx: 0,
      vy: 125,
      radius: 3,
    };
    g.enemyBullets = [bullet];
    g.advance(1 / 60);
    assert.equal(bullet.dead, true);
    assert.equal(g.enemyBullets.length, 0);
    assert.equal(g.player.hp, hp - 1);
    assert.equal(g.player.invincible, CONFIG.player.invincible);
    assert.equal(g.events.filter((e) => e.type === "damage").length, 1);
    assert.equal(g.state, hp === 1 ? "result" : "playing");
  }
});

test("shield blocks consume the first bullet while same-frame bullets pass through immunity", () => {
  const g = play();
  g.mainAt = g.rockAt = g.itemAt = g.eventAt = Infinity;
  g.bullets = [];
  g.events = [];
  g.shield = 1;
  const first = { x: g.player.x, y: g.player.y - 1, vx: 0, vy: 125, radius: 3 };
  const second = { ...first };
  g.enemyBullets = [first, second];
  g.advance(1 / 60);
  assert.equal(first.dead, true);
  assert.ok(!second.dead);
  assert.deepEqual(g.enemyBullets, [second]);
  assert.equal(g.player.hp, 3);
  assert.equal(g.shield, 0);
  assert.equal(g.player.invincible, CONFIG.player.invincible);
  assert.equal(g.events.filter((e) => e.type === "shield").length, 1);
  assert.equal(g.events.filter((e) => e.type === "damage").length, 0);
});

test("nine flight skills expose one shared category and palette for choices and the codex", () => {
  const { FLIGHT_CATEGORIES } = require("./engine.js");
  assert.deepEqual(
    FLIGHT_CATEGORIES.map((category) => category.name),
    ["火力", "移動", "防御・回復"],
  );
  const expected = {
    rapid: ["firepower", "#ff6f61"],
    damage: ["firepower", "#ff8562"],
    multi: ["firepower", "#ff5f7a"],
    speed: ["firepower", "#ffa25e"],
    sub: ["firepower", "#ff6f91"],
    movement: ["movement", "#6bb8ff"],
    magnet: ["movement", "#6be0ff"],
    shield: ["defense", "#91d7ff"],
    repair: ["defense", "#a5ffba"],
  };
  assert.equal(FLIGHT_UPGRADES.length, 9);
  for (const skill of FLIGHT_UPGRADES) {
    assert.deepEqual([skill.category, skill.color], expected[skill.id]);
    assert.ok(Object.isFrozen(skill));
  }
  const g = play(1);
  g.offerUpgrades();
  assert.equal(g.choices.length, 3);
  for (const choice of g.choices)
    assert.deepEqual(
      choice,
      FLIGHT_UPGRADES.find((skill) => skill.id === choice.id),
    );
  g.levels = { speed: 5, multi: 3, sub: 3 };
  g.skills = { rapid: 3, damage: 3, dronePower: 2, movement: 3, magnet: 3 };
  g.shield = 1;
  g.offerUpgrades();
  assert.equal(g.choices[0].id, "coins");
  assert.equal(g.choices[0].color, "#ffd47d");
});
