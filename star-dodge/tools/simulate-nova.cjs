/* Reproducible firepower comparison; invulnerability isolates aiming/cleanup. */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const vm = require("node:vm");
const current = require("../engine.js");
const baselineRef = "84dea14fa5c09a3973f576bb63495bc86075a0e0";
const stageBox = { module: { exports: {} } };
vm.runInNewContext(
  execFileSync("git", ["show", `${baselineRef}:star-dodge/stages.js`], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
  }),
  stageBox,
);
const box = { module: { exports: {} }, require: () => stageBox.module.exports };
vm.runInNewContext(
  execFileSync("git", ["show", `${baselineRef}:star-dodge/engine.js`], {
    cwd: path.resolve(__dirname, "../.."),
    encoding: "utf8",
  }),
  box,
);
const previous = box.module.exports;
const seeds = [127, 158, 189, 220];
const profiles = {
  stock: { levels: { speed: 1, multi: 1, sub: 0 } },
  standard: { levels: { speed: 3, multi: 2, sub: 1 } },
  developed: { levels: { speed: 5, multi: 3, sub: 3 }, damage: 2, rapid: 3 },
  weave: {
    levels: { speed: 2, multi: 2, sub: 1 },
    movement: "weave",
    choice: "first",
  },
};
function run(api, ship, stage, profile, n) {
  const g = new api.Game({
    random: () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296,
  });
  g.start({ stage, ship, levels: profile.levels });
  g.skills.damage = profile.damage || 0;
  g.skills.rapid = profile.rapid || 0;
  g.player.invincible = 10000;
  const priorities = [
    "damage",
    "rapid",
    "multi",
    "sub",
    "speed",
    "shield",
    "repair",
    "magnet",
  ];
  let rockFrames = 0,
    frames = 0,
    explosions = 0;
  for (
    let frame = 0;
    frame < 60 * (stage ? 123 : 183) && g.state !== "result";
    frame++
  ) {
    if (g.state === "upgrade") {
      const ranks = g.choices.map((c) => priorities.indexOf(c.id));
      g.chooseUpgrade(
        profile.choice === "first" ? 0 : ranks.indexOf(Math.min(...ranks)),
      );
    }
    let target = null;
    for (const r of g.rocks)
      if (r.hp > 0 && r.y < g.player.y - 30 && (!target || r.y > target.y))
        target = r;
    const dx = target ? target.x - g.player.x : 0;
    g.input.x =
      profile.movement === "weave"
        ? Math.sin(frame / 120)
        : Math.abs(dx) < 3
          ? dx / 5
          : Math.sign(dx);
    g.input.y = profile.movement === "weave" ? Math.cos(frame / 240) * 0.2 : 0;
    g.advance(api.CONFIG.step);
    if (g.time > 0) {
      rockFrames += g.rocks.length;
      frames++;
    }
    explosions += g.events.filter((e) => e.type === "explosion").length;
    g.events.length = 0;
  }
  return {
    seconds: g.time,
    kills: g.destroyed,
    clear: g.outcome === "cleared",
    meanRocks: rockFrames / frames,
    explosions,
  };
}
const round = (n) => Number(n.toFixed(2));
const average = (runs, key) =>
  round(runs.reduce((sum, r) => sum + r[key], 0) / runs.length);
function group(stage, profile) {
  const result = {};
  for (const [label, api, ship] of [
    ["pioneer", current, "pioneer"],
    ["previousNova", previous, "nova"],
    ["nova", current, "nova"],
  ]) {
    const runs = seeds.map((seed) =>
      run(api, ship, stage, profiles[profile], seed),
    );
    result[label] = {
      seconds: runs.map((r) => round(r.seconds)),
      meanSeconds: average(runs, "seconds"),
      meanKills: average(runs, "kills"),
      meanRocks: average(runs, "meanRocks"),
      meanExplosions: average(runs, "explosions"),
      ...(stage ? { allCleared: runs.every((r) => r.clear) } : {}),
    };
  }
  return { stage, profile, ...result };
}
console.log(
  JSON.stringify(
    {
      baselineRef,
      seeds,
      profiles,
      method:
        "Invulnerable horizontal aiming with offensive core priorities, plus sinusoidal movement with the first core choice for weave. Normal damage only, no injected kills. Stage 30s + elimination; endless 180s. Developed profile is an artificial high-firepower stress case.",
      stages: ["stock", "standard"].flatMap((profile) =>
        [5, 15, 25, 40].map((id) => group(id, profile)),
      ),
      endless: Object.keys(profiles).map((profile) => group(null, profile)),
    },
    null,
    2,
  ),
);
