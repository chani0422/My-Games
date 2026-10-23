/* Shared campaign data for the simulator, progression and presentation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarStages = api;
})(globalThis, () => {
  "use strict";
  const STAGES = Object.freeze(
    [
      ["はじまりの宙域", 1.05, 65, 1, 1, "#71f3e0"],
      ["流星の航路", 0.95, 75, 1, 1, "#8ce4ff"],
      ["青い星雲", 0.85, 85, 1, 1, "#78b4ff"],
      ["小惑星ベルト", 0.75, 95, 2, 1, "#b5a0ff"],
      ["黄昏の境界", 0.68, 105, 2, 1, "#ffcf8a"],
      ["双子の流星群", 0.6, 115, 2, 2, "#ffc09a"],
      ["深紅の宙域", 0.52, 125, 3, 2, "#ff9fac"],
      ["嵐の回廊", 0.45, 135, 3, 2, "#eea8ff"],
      ["星の渦", 0.38, 145, 4, 2, "#a9b4ff"],
      ["最後の星門", 0.32, 155, 4, 3, "#ffe6a0"],
    ].map(([name, interval, speed, hardness, batch, color], i) =>
      Object.freeze({
        id: i + 1,
        name,
        duration: 30,
        firstClearCoins: 5 + i * 2,
        interval,
        speed,
        hardness,
        batch,
        color,
      }),
    ),
  );
  function getStage(id) {
    return Number.isInteger(id)
      ? STAGES.find((stage) => stage.id === id) || null
      : null;
  }
  return { STAGES, getStage };
});
