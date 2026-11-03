const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Effects } = require("./effects.js");
test("nova blast rings reuse the bounded effect pool and respect reduced motion", () => {
  const effects = new Effects();
  for (let i = 0; i < 100; i++)
    effects.add({ type: "explosion", x: 100, y: 200, radius: 120 });
  assert.equal(effects.stats.rings, 12);
  assert.equal(effects.stats.particles, 180);
  assert.equal(effects.rings[0].radius * 2.5, 120);
  assert.ok(effects.rings[0].life >= 0.6);
  assert.ok(effects.stats.shake > 0);
  effects.advance(0.35);
  assert.ok(effects.stats.rings > 0);
  effects.advance(1);
  assert.equal(effects.stats.rings, 0);
  effects.add({ type: "explosion", x: 50, y: 80, radius: 120 });
  assert.equal(effects.rings.length, 12);
  effects.advance(0, true);
  effects.add({ type: "explosion", x: 50, y: 80, radius: 120 }, true);
  assert.equal(effects.stats.rings, 0);
  assert.equal(effects.stats.particles, 0);
  assert.equal(effects.stats.shake, 0);
  assert.deepEqual(effects.offset(true), { x: 0, y: 0 });
});
