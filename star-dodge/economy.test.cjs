const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateFlightReward: reward, Progress } = require("./progression.js");

test("survival alone funds progression; checkpoints pay once at exact boundaries", () => {
  assert.equal(reward(4999, 0).totalCoins, 0);
  assert.equal(reward(5000, 0).totalCoins, 1);
  assert.equal(reward(29999, 0).totalCoins, 5);
  assert.deepEqual(reward(30000, 0), {
    survivalCoins: 6,
    milestoneCoins: 4,
    destructionCoins: 0,
    totalCoins: 10,
  });
  assert.equal(reward(59999, 0).totalCoins, 15);
  assert.equal(reward(60000, 0).totalCoins, 22);
  assert.equal(reward(90000, 0).totalCoins, 36);
  assert.equal(reward(120000, 0).totalCoins, 50);
});
test("firepower cannot increase a same-duration payout by more than 20 percent", () => {
  for (const ms of [
    0, 4999, 5000, 15000, 29999, 30000, 60000, 90000, 120000, 300000, 3600000,
  ]) {
    const passive = reward(ms, 0),
      aggressive = reward(ms, 999999);
    assert.ok(aggressive.totalCoins <= passive.totalCoins * 1.2);
    assert.ok(aggressive.totalCoins >= passive.totalCoins);
    assert.ok(
      aggressive.destructionCoins <=
        Math.floor(
          (aggressive.survivalCoins + aggressive.milestoneCoins) * 0.2,
        ),
    );
  }
  assert.equal(reward(30000, 4).destructionCoins, 0);
  assert.equal(reward(30000, 5).destructionCoins, 1);
  assert.equal(reward(30000, 10).destructionCoins, 2);
  assert.equal(reward(30000, 100).destructionCoins, 2);
  assert.equal(reward(0, 100).totalCoins, 0);
});
test("continuing a flight beats equivalent short runs with the same destruction rate", () => {
  for (const seconds of [60, 90, 120, 180]) {
    const short = reward(30000, 10).totalCoins * (seconds / 30);
    const long = reward(seconds * 1000, (seconds / 30) * 10).totalCoins;
    assert.ok(long > short, `${seconds}s: ${long} should exceed ${short}`);
  }
});
test("a first 30-second flight plus its challenge buys the first upgrade without any kills", () => {
  const p = new Progress();
  p.finish("first", 30000, 0);
  assert.equal(p.claim("survive30"), true);
  assert.equal(p.data.credits, 35);
  assert.equal(p.purchaseUpgrade("speed"), true);
  assert.equal(p.data.credits, 0);
});
test("payouts are finite, monotonic and capped; displayed breakdown always sums to the award", () => {
  for (const kills of [0, 5, 50, 10000]) {
    let last = 0;
    for (let seconds = 0; seconds <= 3600; seconds += 5) {
      const r = reward(seconds * 1000, kills);
      assert.equal(
        r.totalCoins,
        r.survivalCoins + r.milestoneCoins + r.destructionCoins,
      );
      assert.ok(
        Number.isInteger(r.totalCoins) &&
          r.totalCoins >= last &&
          r.totalCoins <= 500,
      );
      last = r.totalCoins;
    }
  }
  for (const [ms, kills] of [
    [NaN, Infinity],
    [-100, -5],
    [undefined, null],
  ])
    assert.equal(reward(ms, kills).totalCoins, 0);
  assert.equal(reward(1e9, 1e9).totalCoins, 500);
});
test("existing balances, unlocks, skills and already-settled flights survive the change", () => {
  const raw = {
    version: 1,
    credits: 240,
    selectedShip: "swift",
    unlocked: ["pioneer", "swift"],
    upgrades: { hull: 1, speed: 1, multi: 0, sub: 0 },
    flights: 3,
    totalMs: 60000,
    totalDestroyed: 12,
    bestMs: 30000,
    claimed: ["survive30"],
    settled: ["old-flight"],
  };
  const storage = {
    value: JSON.stringify(raw),
    getItem() {
      return this.value;
    },
    setItem(k, v) {
      this.value = v;
    },
  };
  const p = new Progress(storage);
  assert.deepEqual(p.snapshot(), raw);
  assert.equal(p.finish("old-flight", 30000, 12).credits, 0);
  assert.equal(p.data.credits, 240);
  assert.equal(p.selectShip("swift"), true);
  assert.equal(p.data.credits, 240);
  assert.equal(p.purchaseUpgrade("speed"), true);
  assert.equal(p.data.credits, 150);
  p.restore(raw);
  assert.equal(p.data.credits, 240);
  assert.deepEqual(p.data.upgrades, raw.upgrades);
});
