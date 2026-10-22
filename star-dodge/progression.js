/* Local, earned-only progression. Never a ledger for real-money purchases. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarProgress = api;
})(globalThis, () => {
  "use strict";
  const SHIPS = [
    {
      id: "pioneer",
      name: "パイオニア",
      tag: "BALANCED",
      description: "回避も攻撃もバランスよく。最初の相棒。",
      cost: 0,
      hp: 3,
      speed: 300,
      color: "#71f3e0",
    },
    {
      id: "swift",
      name: "スウィフト",
      tag: "AGILE",
      description: "速さで切り抜ける、軽量の高速機。",
      cost: 120,
      hp: 2,
      speed: 345,
      color: "#ffca75",
    },
    {
      id: "warden",
      name: "ウォーデン",
      tag: "DEFENDER",
      description: "重い装甲で、危険な宙域にもう一歩。",
      cost: 140,
      hp: 4,
      speed: 270,
      color: "#c4a0ff",
    },
  ];
  const UPGRADES = [
    {
      id: "hull",
      name: "機体装甲",
      icon: "⬡",
      description: "最大HPを1ずつ増やす",
      costs: [60, 150],
    },
    {
      id: "speed",
      name: "初期弾速",
      icon: "↑",
      description: "開始時のSPEEDレベルを1ずつ上げる",
      costs: [35, 90],
    },
    {
      id: "multi",
      name: "初期弾数",
      icon: "⋮",
      description: "最初から2発の弾でスタート",
      costs: [120],
    },
    {
      id: "sub",
      name: "初期ドローン",
      icon: "✧",
      description: "最初からドローン1機が随伴",
      costs: [150],
    },
  ];
  const MISSIONS = [
    {
      id: "survive30",
      name: "最初の航跡",
      description: "1回のフライトで30秒生存",
      field: "bestMs",
      goal: 30000,
      reward: 25,
    },
    {
      id: "destroy10",
      name: "宙域の掃除屋",
      description: "隕石を累計10個破壊",
      field: "totalDestroyed",
      goal: 10,
      reward: 30,
    },
    {
      id: "flights3",
      name: "新米パイロット",
      description: "フライトを3回完了",
      field: "flights",
      goal: 3,
      reward: 40,
    },
    {
      id: "survive90",
      name: "星の先へ",
      description: "1回のフライトで90秒生存",
      field: "bestMs",
      goal: 90000,
      reward: 75,
    },
    {
      id: "destroy100",
      name: "流星ブレイカー",
      description: "隕石を累計100個破壊",
      field: "totalDestroyed",
      goal: 100,
      reward: 100,
    },
  ];
  const LIMIT = 1e9;
  const integer = (n, max = LIMIT) =>
    Number.isFinite(n) && n >= 0 ? Math.min(max, Math.floor(n)) : 0;
  function fresh() {
    return {
      version: 1,
      credits: 0,
      selectedShip: "pioneer",
      unlocked: ["pioneer"],
      upgrades: { hull: 0, speed: 0, multi: 0, sub: 0 },
      flights: 0,
      totalMs: 0,
      totalDestroyed: 0,
      bestMs: 0,
      claimed: [],
      settled: [],
    };
  }
  function sanitize(raw) {
    const data = fresh();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return data;
    for (const field of [
      "credits",
      "flights",
      "totalMs",
      "totalDestroyed",
      "bestMs",
    ])
      data[field] = integer(raw[field]);
    data.unlocked = SHIPS.filter(
      (s) =>
        s.cost === 0 ||
        (Array.isArray(raw.unlocked) && raw.unlocked.includes(s.id)),
    ).map((s) => s.id);
    if (data.unlocked.includes(raw.selectedShip))
      data.selectedShip = raw.selectedShip;
    for (const up of UPGRADES)
      data.upgrades[up.id] = integer(raw.upgrades?.[up.id], up.costs.length);
    data.claimed = MISSIONS.filter(
      (m) => Array.isArray(raw.claimed) && raw.claimed.includes(m.id),
    ).map((m) => m.id);
    data.settled = Array.isArray(raw.settled)
      ? [
          ...new Set(
            raw.settled.filter(
              (id) => typeof id === "string" && id.length <= 100,
            ),
          ),
        ].slice(-64)
      : [];
    return data;
  }
  class Progress {
    constructor(storage) {
      this.storage = storage;
      this.tabOnly = false;
      try {
        this.data = sanitize(
          JSON.parse(storage?.getItem("star-dodge-progress-v1") || "null"),
        );
      } catch {
        this.data = fresh();
      }
      this.save();
    }
    save() {
      try {
        if (!this.storage) throw Error();
        this.storage.setItem(
          "star-dodge-progress-v1",
          JSON.stringify(this.data),
        );
      } catch {
        this.tabOnly = true;
      }
    }
    finish(runId, ms, destroyed) {
      if (
        typeof runId !== "string" ||
        !runId ||
        runId.length > 100 ||
        this.data.settled.includes(runId)
      )
        return { credits: 0, duplicate: true };
      ms = integer(ms);
      destroyed = integer(destroyed);
      const earned = Math.min(
        500,
        Math.floor(ms / 5000) + Math.floor(destroyed / 3),
      );
      this.data.credits = Math.min(LIMIT, this.data.credits + earned);
      this.data.flights = Math.min(LIMIT, this.data.flights + 1);
      this.data.totalMs = Math.min(LIMIT, this.data.totalMs + ms);
      this.data.totalDestroyed = Math.min(
        LIMIT,
        this.data.totalDestroyed + destroyed,
      );
      this.data.bestMs = Math.max(this.data.bestMs, ms);
      this.data.settled.push(runId);
      this.data.settled = this.data.settled.slice(-64);
      this.save();
      return { credits: earned, duplicate: false };
    }
    purchaseUpgrade(id) {
      const up = UPGRADES.find((x) => x.id === id);
      if (!up) return false;
      const cost = up.costs[this.data.upgrades[id]];
      if (cost === undefined || this.data.credits < cost) return false;
      this.data.credits -= cost;
      this.data.upgrades[id]++;
      this.save();
      return true;
    }
    selectShip(id) {
      const ship = SHIPS.find((x) => x.id === id);
      if (!ship) return false;
      if (!this.data.unlocked.includes(id)) {
        if (this.data.credits < ship.cost) return false;
        this.data.credits -= ship.cost;
        this.data.unlocked.push(id);
      }
      this.data.selectedShip = id;
      this.save();
      return true;
    }
    claim(id) {
      const m = MISSIONS.find((m) => m.id === id);
      if (!m || this.data.claimed.includes(id) || this.data[m.field] < m.goal)
        return false;
      this.data.claimed.push(id);
      this.data.credits = Math.min(LIMIT, this.data.credits + m.reward);
      this.save();
      return true;
    }
    loadout() {
      const ship =
          SHIPS.find((s) => s.id === this.data.selectedShip) || SHIPS[0],
        up = this.data.upgrades;
      return {
        ship: ship.id,
        color: ship.color,
        hp: ship.hp + up.hull,
        speed: ship.speed,
        levels: { speed: 1 + up.speed, multi: 1 + up.multi, sub: up.sub },
      };
    }
    snapshot() {
      return JSON.parse(JSON.stringify(this.data));
    }
    restore(raw) {
      this.previous = this.snapshot();
      this.data = sanitize(raw);
      this.save();
    }
  }
  return { SHIPS, UPGRADES, MISSIONS, Progress, sanitize, fresh };
});
