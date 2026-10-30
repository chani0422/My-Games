const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  Progress,
  SHIPS,
  RETIRED_SHIPS,
  shipDetails,
  fresh,
  sanitize,
  licenseFor,
} = require("./progression.js");
const legacy = require("./test-fixtures/progress-0.4.json");
const store = (raw) => ({
  value: raw === undefined ? null : JSON.stringify(raw),
  writes: [],
  getItem() {
    return this.value;
  },
  setItem(key, value) {
    this.writes.push(key);
    this.value = value;
  },
});
const clears = (count) => Array.from({ length: count }, (_, i) => i + 1);

test("four main-weapon ships share base HP and speed, with 0/5/15/25 unlock thresholds", () => {
  assert.deepEqual(
    SHIPS.map((ship) => [ship.id, ship.unlockStage, ship.hp, ship.speed]),
    [
      ["pioneer", 0, 3, 300],
      ["lance", 5, 3, 300],
      ["nova", 15, 3, 300],
      ["seeker", 25, 3, 300],
    ],
  );
  const p = new Progress(store());
  p.data.credits = 1e9;
  for (const count of [0, 4, 5, 14, 15, 24, 25]) {
    p.data.clearedStages = clears(count);
    for (const ship of SHIPS) {
      assert.equal(p.isShipUnlocked(ship.id), count >= ship.unlockStage);
      assert.equal(p.selectShip(ship.id), count >= ship.unlockStage);
      assert.equal(p.data.credits, 1e9);
      if (count >= ship.unlockStage) {
        const loadout = p.loadout();
        assert.equal(loadout.hp, 3);
        assert.equal(loadout.speed, 300);
        assert.equal(loadout.ship, ship.id);
      }
    }
  }
  for (const id of ["swift", "warden", "unknown"])
    assert.equal(p.selectShip(id), false);
});
test("unlocking stage 5 awards lance only on successful sequential clear and keeps the unlock across reload", () => {
  const storage = store(),
    p = new Progress(storage);
  for (let id = 1; id <= 4; id++)
    p.finish(`s-${id}`, 30000, 0, { stage: id, cleared: true });
  assert.equal(p.isShipUnlocked("lance"), false);
  p.finish("failed-5", 35000, 0, { stage: 5, cleared: false });
  p.finish("early-5", 29999, 0, { stage: 5, cleared: true });
  p.finish("skipped-6", 35000, 0, { stage: 6, cleared: true });
  assert.equal(p.isShipUnlocked("lance"), false);
  p.finish("clear-5", 35000, 0, { stage: 5, cleared: true });
  assert.deepEqual(p.data.unlocked, ["pioneer", "lance"]);
  const balance = p.data.credits;
  assert.equal(p.selectShip("lance"), true);
  assert.equal(p.data.credits, balance);
  const reloaded = new Progress(storage);
  assert.equal(reloaded.data.selectedShip, "lance");
  assert.equal(reloaded.isShipUnlocked("lance"), true);
  assert.equal(
    reloaded.finish("clear-5", 35000, 0, { stage: 5, cleared: true }).duplicate,
    true,
  );
  assert.deepEqual(reloaded.data.unlocked, ["pioneer", "lance"]);
});
test("legacy ownership refunds each retired purchase exactly once without adding save fields", () => {
  const raw = {
    ...fresh(),
    credits: 17,
    unlocked: ["pioneer", "swift", "swift", "warden", "warden"],
    selectedShip: "warden",
    clearedStages: clears(7),
    selectedStage: 7,
  };
  const storage = store(raw),
    p = new Progress(storage),
    migrated = p.snapshot();
  assert.equal(migrated.credits, 277);
  assert.equal(migrated.selectedShip, "pioneer");
  assert.deepEqual(migrated.unlocked, ["pioneer", "lance"]);
  assert.deepEqual(migrated.clearedStages, clears(7));
  assert.equal(migrated.selectedStage, 7);
  assert.equal(migrated.version, 1);
  assert.deepEqual(Object.keys(migrated).sort(), Object.keys(fresh()).sort());
  assert.deepEqual([...new Set(storage.writes)], ["star-dodge-progress-v1"]);
  assert.deepEqual(new Progress(storage).snapshot(), migrated);
  assert.deepEqual(sanitize(sanitize(raw)), migrated);
  p.restore(migrated);
  assert.deepEqual(p.snapshot(), migrated);
  p.restore(raw);
  assert.equal(
    p.data.credits,
    277,
    "restoring an old backup replaces its balance then applies its refund, never stacks refunds",
  );
});
test("save migration retains skin ownership, upgrades, license totals and all recent legacy flight records", () => {
  const p = new Progress(store(legacy)),
    data = p.snapshot();
  const expectedRefund = RETIRED_SHIPS.reduce(
    (sum, ship) => sum + (legacy.unlocked.includes(ship.id) ? ship.refund : 0),
    0,
  );
  assert.equal(data.credits, legacy.credits + expectedRefund);
  for (const key of [
    "upgrades",
    "selectedSkin",
    "unlockedSkins",
    "flights",
    "totalMs",
    "totalDestroyed",
    "bestMs",
    "recentRuns",
    "reduceEffects",
    "claimed",
    "settled",
    "clearedStages",
    "selectedStage",
    "flightMode",
  ])
    assert.deepEqual(data[key], legacy[key], key);
  assert.deepEqual(licenseFor(data.totalMs), licenseFor(legacy.totalMs));
  assert.equal(data.selectedShip, "pioneer");
  assert.ok(data.recentRuns.some((run) => run.ship === "warden"));
  assert.equal(shipDetails("swift").name, "スウィフト");
  assert.equal(shipDetails("warden").name, "ウォーデン");
  assert.equal(shipDetails("lance").name, "ランス");
  assert.equal(shipDetails("unknown").id, "pioneer");
});
test("invalid selection clamps to the final unlocked stage and injected ship ownership never bypasses progress", () => {
  for (const selectedStage of [0, -1, 11, 999, "3", null]) {
    const d = sanitize({
      ...fresh(),
      clearedStages: clears(7),
      selectedStage,
      selectedShip: "seeker",
      unlocked: ["pioneer", "lance", "nova", "seeker"],
    });
    assert.equal(d.selectedStage, 8);
    assert.equal(d.selectedShip, "pioneer");
    assert.deepEqual(d.unlocked, ["pioneer", "lance"]);
  }
  assert.equal(
    sanitize({ ...fresh(), clearedStages: clears(10), selectedStage: 999 })
      .selectedStage,
    11,
  );
  assert.equal(
    sanitize({
      ...fresh(),
      clearedStages: clears(7),
      selectedStage: 3,
      selectedShip: "lance",
    }).selectedShip,
    "lance",
  );
  assert.equal(
    sanitize({ ...fresh(), clearedStages: [1, 3, 5], selectedShip: "lance" })
      .selectedShip,
    "pioneer",
  );
});
test("refunds stay bounded, require old ownership and remain available when persistence is denied", () => {
  assert.equal(
    sanitize({ credits: 1e9, unlocked: ["swift", "warden"] }).credits,
    1e9,
  );
  assert.equal(
    sanitize({ credits: 100, selectedShip: "swift", unlocked: [] }).credits,
    100,
  );
  assert.equal(sanitize({ credits: 100, unlocked: "swift" }).credits, 100);
  const storage = {
    getItem() {
      return JSON.stringify({ ...fresh(), credits: 12, unlocked: ["swift"] });
    },
    setItem() {
      throw Error("denied");
    },
  };
  const p = new Progress(storage);
  assert.equal(p.tabOnly, true);
  assert.equal(p.data.credits, 132);
  assert.deepEqual(p.data.unlocked, ["pioneer"]);
  p.restore(p.snapshot());
  assert.equal(p.data.credits, 132);
});
test("common armor, initial weapons and every owned skin apply uniformly to all unlocked ships", () => {
  const p = new Progress(store());
  p.data.clearedStages = clears(25);
  p.data.upgrades = { hull: 2, speed: 2, multi: 1, sub: 1 };
  p.data.unlockedSkins = ["factory", "solar", "nebula", "frost", "rose"];
  for (const ship of SHIPS) {
    assert.equal(p.selectShip(ship.id), true);
    for (const skin of p.data.unlockedSkins) {
      assert.equal(p.selectSkin(skin), true);
      const loadout = p.loadout();
      assert.equal(loadout.hp, 5);
      assert.equal(loadout.speed, 300);
      assert.deepEqual(loadout.levels, { speed: 3, multi: 2, sub: 1 });
      assert.equal(loadout.skin, skin);
    }
  }
});
