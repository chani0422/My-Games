const { test } = require("node:test");
const assert = require("node:assert/strict");
const current = require("./engine.js");
const simulate = require("./test-support/simulate-endless.cjs");
const baseline = require("./test-fixtures/endless-pr-a.json");
const {
  description,
  ...boostedNova
} = require("./test-fixtures/endless-nova-boost.json");
for (const ship of ["pioneer", "lance", "nova", "seeker"])
  test(`${ship}: the 180-second endless trace matches ${ship === "nova" ? "the intentional nova boost" : "merged PR-A"}, including cores and combat`, () => {
    assert.deepEqual(
      simulate(current, ship),
      ship === "nova" ? boostedNova : baseline.ships[ship],
    );
  });
