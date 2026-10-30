const { test } = require("node:test");
const assert = require("node:assert/strict");
const current = require("./engine.js");
const simulate = require("./test-support/simulate-endless.cjs");
const baseline = require("./test-fixtures/endless-pr-a.json");
for (const ship of ["pioneer", "lance", "nova", "seeker"])
  test(`${ship}: the complete 180-second endless trace matches merged PR-A, including periodic cores and combat`, () => {
    assert.deepEqual(simulate(current, ship), baseline.ships[ship]);
  });
