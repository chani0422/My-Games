const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Progress, SHIPS, UPGRADES, sanitize } = require("./progression.js");
const { Game } = require("./engine.js");
const store = () => ({
  data: new Map(),
  getItem(k) {
    return this.data.get(k) || null;
  },
  setItem(k, v) {
    this.data.set(k, v);
  },
});
test("earned credits settle once, including after reloading", () => {
  const storage = store(),
    p = new Progress(storage);
  assert.deepEqual(p.finish("one", 30000, 12), {
    credits: 10,
    duplicate: false,
  });
  assert.equal(p.data.flights, 1);
  assert.equal(new Progress(storage).finish("one", 30000, 12).duplicate, true);
  assert.equal(new Progress(storage).data.credits, 10);
  assert.equal(p.finish("two", NaN, Infinity).credits, 0);
  assert.equal(p.finish("huge", 1e9, 1e9).credits, 500);
});
test("upgrades cannot overspend or exceed cap, and persist", () => {
  const storage = store(),
    p = new Progress(storage);
  assert.equal(p.purchaseUpgrade("hull"), false);
  p.data.credits = 500;
  assert.equal(p.purchaseUpgrade("hull"), true);
  assert.equal(p.data.credits, 440);
  assert.equal(p.purchaseUpgrade("hull"), true);
  assert.equal(p.data.credits, 290);
  assert.equal(p.purchaseUpgrade("hull"), false);
  assert.equal(p.purchaseUpgrade("unknown"), false);
  assert.equal(new Progress(storage).data.upgrades.hull, 2);
});
test("ships must be unlocked, charge once and affect actual run HP and movement", () => {
  const p = new Progress(store());
  assert.equal(p.selectShip("swift"), false);
  assert.equal(p.selectShip("unknown"), false);
  p.data.credits = 300;
  assert.equal(p.selectShip("swift"), true);
  assert.equal(p.data.credits, 180);
  p.selectShip("pioneer");
  p.selectShip("swift");
  assert.equal(p.data.credits, 180);
  p.purchaseUpgrade("hull");
  const g = new Game();
  g.start(p.loadout());
  assert.equal(g.player.hp, 3);
  assert.equal(g.player.speed, 345);
  while (g.state === "countdown") g.advance(1 / 60);
  const x = g.player.x;
  g.input = { x: 1, y: 0 };
  for (let i = 0; i < 12; i++) g.advance(1 / 60);
  assert.ok(Math.abs(g.player.x - x - 69) < 0.00001);
});
test("initial skills apply at start and retry without changing current flight", () => {
  const p = new Progress(store());
  p.data.credits = 1000;
  const g = new Game();
  g.start(p.loadout());
  for (const id of ["speed", "multi", "sub"])
    assert.equal(p.purchaseUpgrade(id), true);
  assert.deepEqual(g.levels, { speed: 1, multi: 1, sub: 0 });
  g.start(p.loadout());
  assert.deepEqual(g.levels, { speed: 2, multi: 2, sub: 1 });
  g.levels.speed = 5;
  g.start(p.loadout());
  assert.equal(g.levels.speed, 2);
});
test("missions require achievement and pay exactly once", () => {
  const storage = store(),
    p = new Progress(storage);
  assert.equal(p.claim("survive30"), false);
  p.finish("run", 30000, 10);
  const before = p.data.credits;
  assert.equal(p.claim("survive30"), true);
  assert.equal(p.data.credits, before + 25);
  assert.equal(p.claim("survive30"), false);
  assert.equal(new Progress(storage).claim("survive30"), false);
  assert.equal(p.claim("destroy10"), true);
  assert.equal(p.claim("flights3"), false);
});
test("malformed saves are sanitized and storage failures do not prevent play", () => {
  const storage = store();
  storage.setItem("star-dodge-progress-v1", "broken");
  assert.equal(new Progress(storage).data.credits, 0);
  const p = new Progress({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  });
  p.finish("run", 50000, 3);
  assert.equal(p.tabOnly, true);
  assert.equal(p.data.credits, 11);
  const d = sanitize({
    credits: -5,
    selectedShip: "unknown",
    unlocked: ["unknown"],
    upgrades: { hull: 100, speed: -1, sub: "1" },
    claimed: ["fake"],
  });
  assert.equal(d.credits, 0);
  assert.equal(d.selectedShip, "pioneer");
  assert.deepEqual(d.unlocked, ["pioneer"]);
  assert.deepEqual(d.upgrades, { hull: 2, speed: 0, multi: 0, sub: 0 });
  assert.deepEqual(d.claimed, []);
});
test("cloud snapshots are deep copies and restores retain a recovery snapshot", () => {
  const p = new Progress(store());
  p.finish("run", 50000, 3);
  const snapshot = p.snapshot();
  snapshot.credits = 999;
  assert.equal(p.data.credits, 11);
  p.restore({ ...snapshot, credits: 40 });
  assert.equal(p.data.credits, 40);
  assert.equal(p.previous.credits, 11);
});
