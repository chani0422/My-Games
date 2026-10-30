/* Capture a deterministic trace including cores, choices, actors and events. */
const { createHash } = require("node:crypto");
module.exports = function simulateEndless(api, ship) {
  let n = 127;
  const g = new api.Game({
    random: () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296,
  });
  g.start({ ship, levels: { speed: 2, multi: 2, sub: 1 } });
  g.player.invincible = 1000;
  const hash = createHash("sha256"),
    counts = {},
    checkpoints = [];
  for (let frame = 0; frame < 183 * 60; frame++) {
    if (g.state === "upgrade") g.chooseUpgrade(0);
    g.input.x = Math.sin(frame / 120);
    g.input.y = Math.cos(frame / 240) * 0.2;
    g.advance(api.CONFIG.step);
    for (const e of g.events) counts[e.type] = (counts[e.type] || 0) + 1;
    hash.update(
      JSON.stringify(g, (key, value) => {
        if (key === "config" || key === "random") return undefined;
        if (Object.prototype.toString.call(value) === "[object Set]")
          return [...value];
        return value;
      }),
    );
    if (g.ticks && g.ticks % 1800 === 0)
      checkpoints.push({
        seconds: g.time,
        destroyed: g.destroyed,
        rocks: g.rocks.length,
        bullets: g.bullets.length,
        enemyBullets: g.enemyBullets.length,
        levels: { ...g.levels },
        skills: { ...g.skills },
      });
    g.events.length = 0;
  }
  return {
    hash: hash.digest("hex"),
    counts,
    checkpoints,
    state: g.state,
    seconds: g.time,
  };
};
