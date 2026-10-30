/* Shared campaign data for the simulator, progression and presentation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarStages = api;
})(globalThis, () => {
  "use strict";
  const STAGES_PER_PLANET = 5;
  const PLANETS = Object.freeze(
    [
      ["地球", "#71f3e0"],
      ["水星", "#c3becd"],
      ["金星", "#ffd182"],
      ["火星", "#ff9fac"],
      ["木星", "#edb78a"],
      ["土星", "#d8c69c"],
      ["天王星", "#8ee6ed"],
      ["海王星", "#809fff"],
    ].map(([name, color], i) =>
      Object.freeze({
        id: i + 1,
        name,
        color,
        firstStage: i * STAGES_PER_PLANET + 1,
        lastStage: (i + 1) * STAGES_PER_PLANET,
      }),
    ),
  );
  const STAGES = Object.freeze(
    Array.from({ length: PLANETS.length * STAGES_PER_PLANET }, (_, i) => {
      const p = Math.floor(i / STAGES_PER_PLANET),
        local = i % STAGES_PER_PLANET,
        // Small steps inside a planet, a larger step at its boundary and finale.
        curve = (p * 5 + local * 0.7 + (local === 4 ? 0.35 : 0)) / 38.15,
        hardness = 1 + p + (local === 4 ? 1 : 0);
      return Object.freeze({
        id: i + 1,
        planetId: p + 1,
        localNumber: local + 1,
        name: `ステージ${local + 1}`,
        duration: 30,
        firstClearCoins: 5 + i * 2,
        interval: Number((1.05 - 0.55 * curve).toFixed(3)),
        speed: Number((65 + 95 * curve).toFixed(1)),
        hardness,
        batch: p >= 7 ? 3 : p >= 4 ? 2 : 1,
        maxRocks: 12 + p * 5 + local,
        // Stage-only HP and density keep the longer campaign's cleanup bounded.
        hp: Object.freeze([hardness, hardness + 1, hardness + 3]),
        eliteHp: hardness + 5,
        color: PLANETS[p].color,
      });
    }),
  );
  function getStage(id) {
    return Number.isInteger(id)
      ? STAGES.find((stage) => stage.id === id) || null
      : null;
  }
  function getPlanet(id) {
    return Number.isInteger(id) ? PLANETS[id - 1] || null : null;
  }
  function stageLabel(id) {
    const stage = getStage(id);
    return stage ? `${getPlanet(stage.planetId).name} ${stage.name}` : "";
  }
  return {
    PLANETS,
    STAGES_PER_PLANET,
    STAGES,
    getStage,
    getPlanet,
    stageLabel,
  };
});
