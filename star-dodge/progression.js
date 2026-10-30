/* Local, earned-only progression. Never a ledger for real-money purchases. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./stages.js")
      : root.StarStages,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarProgress = api;
})(globalThis, (stageAPI) => {
  "use strict";
  const { STAGES, getStage } = stageAPI;
  const SHIPS = [
    {
      id: "pioneer",
      name: "パイオニア",
      tag: "NORMAL",
      description: "ノーマル弾。標準の弾速と連射で狙い撃つ、最初の相棒。",
      unlockStage: 0,
      hp: 3,
      speed: 300,
      color: "#71f3e0",
    },
    {
      id: "lance",
      name: "ランス",
      tag: "PIERCING",
      description:
        "貫通弾。複数の隕石を貫く。同じ個体には1発につき1回だけ命中。弾速85%。",
      unlockStage: 5,
      hp: 3,
      speed: 300,
      color: "#ffca75",
    },
    {
      id: "nova",
      name: "ノヴァ",
      tag: "EXPLOSIVE",
      description:
        "爆発弾。メイン弾で撃破すると半径70の他の隕石に1ダメージ。連鎖なし。発射間隔115%。",
      unlockStage: 15,
      hp: 3,
      speed: 300,
      color: "#ff6f91",
    },
    {
      id: "seeker",
      name: "シーカー",
      tag: "HOMING",
      description: "誘導弾。最寄りの隕石へ緩やかに曲がる。弾速90%。",
      unlockStage: 25,
      hp: 3,
      speed: 300,
      color: "#9ab8ff",
    },
  ];
  // Retired IDs remain valid only in historical flight records and old backups.
  const RETIRED_SHIPS = [
    { id: "swift", name: "スウィフト", refund: 120, retired: true },
    { id: "warden", name: "ウォーデン", refund: 140, retired: true },
  ];
  function shipDetails(id) {
    return (
      SHIPS.find((ship) => ship.id === id) ||
      RETIRED_SHIPS.find((ship) => ship.id === id) ||
      SHIPS[0]
    );
  }
  function shipAvailable(data, id) {
    const ship = SHIPS.find((ship) => ship.id === id);
    return (
      !!ship &&
      (ship.unlockStage === 0 || data.clearedStages.includes(ship.unlockStage))
    );
  }
  function unlockedShips(data) {
    return SHIPS.filter((ship) => shipAvailable(data, ship.id)).map(
      (ship) => ship.id,
    );
  }
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
  const SKINS = Object.freeze([
    {
      id: "factory",
      name: "ファクトリー",
      description: "機体本来のカラー。",
      cost: 0,
      color: null,
    },
    {
      id: "aurora",
      name: "オーロラ",
      description: "積み重ねたフライトの証。",
      cost: 0,
      unlockRank: 3,
      color: "#a5ffba",
    },
    {
      id: "solar",
      name: "ゴールド",
      description: "金色の輝きをまとったカラー。",
      cost: 80,
      color: "#ffd77a",
    },
    {
      id: "nebula",
      name: "ネビュラ",
      description: "遠い星雲を思わせるバイオレット。",
      cost: 120,
      color: "#b29aff",
    },
    {
      id: "frost",
      name: "フロスト",
      description: "静かな氷の宙域のアイスブルー。",
      cost: 160,
      color: "#9ae7ff",
    },
    {
      id: "rose",
      name: "ローズフレア",
      description: "星のまたたきを映すローズ。",
      cost: 200,
      color: "#ffa0bd",
    },
  ]);
  const MAX_RECENT_RUNS = 20;
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
  const REWARD_RULES = Object.freeze({
    survivalStepMs: 5000,
    milestoneStepMs: 30000,
    milestoneAwards: Object.freeze([4, 6, 8]),
    destroyedPerCoin: 5,
    destructionRatio: 0.2,
    maxFlightCoins: 500,
  });
  function calculateFlightReward(ms, destroyed, coreCoins = 0) {
    const time = integer(ms),
      kills = integer(destroyed),
      rules = REWARD_RULES;
    const milestones = Math.floor(time / rules.milestoneStepMs);
    const rawMilestones =
      rules.milestoneAwards.reduce(
        (sum, award, index) => sum + (index < milestones ? award : 0),
        0,
      ) +
      Math.max(0, milestones - rules.milestoneAwards.length) *
        rules.milestoneAwards.at(-1);
    const survivalCoins = Math.min(
      rules.maxFlightCoins,
      Math.floor(time / rules.survivalStepMs),
    );
    const milestoneCoins = Math.min(
      rawMilestones,
      rules.maxFlightCoins - survivalCoins,
    );
    const progressCoins = survivalCoins + milestoneCoins;
    const destructionCoins = Math.min(
      Math.floor(kills / rules.destroyedPerCoin),
      Math.floor(progressCoins * rules.destructionRatio),
      rules.maxFlightCoins - progressCoins,
    );
    const reward = {
      survivalCoins,
      milestoneCoins,
      destructionCoins,
      totalCoins: progressCoins + destructionCoins,
    };
    const bonus = Math.min(
      integer(coreCoins),
      REWARD_RULES.maxFlightCoins - reward.totalCoins,
    );
    if (bonus > 0) {
      reward.coreCoins = bonus;
      reward.totalCoins += bonus;
    }
    return reward;
  }
  function licenseFor(totalMs) {
    const time = integer(totalMs);
    const rank = Math.min(20, 1 + Math.floor(Math.sqrt(time / 60000)));
    const fromMs = (rank - 1) ** 2 * 60000;
    const nextMs = rank < 20 ? rank ** 2 * 60000 : null;
    const name =
      rank >= 20
        ? "スターレジェンド"
        : rank >= 15
          ? "エリート"
          : rank >= 10
            ? "エース"
            : rank >= 5
              ? "エクスプローラー"
              : "カデット";
    return {
      rank,
      name,
      fromMs,
      nextMs,
      progress:
        nextMs === null ? 1 : Math.min(1, (time - fromMs) / (nextMs - fromMs)),
    };
  }
  function skinAvailable(data, id) {
    const skin = SKINS.find((s) => s.id === id);
    return (
      !!skin &&
      (skin.id === "factory" ||
        (skin.unlockRank
          ? licenseFor(data.totalMs).rank >= skin.unlockRank
          : data.unlockedSkins.includes(id)))
    );
  }
  function levels(raw) {
    return {
      speed: Math.max(1, integer(raw?.speed, 5)),
      multi: Math.max(1, integer(raw?.multi, 3)),
      sub: integer(raw?.sub, 3),
    };
  }
  function sanitizeRun(raw) {
    return {
      endedAt: integer(raw.endedAt, 8640000000000000),
      ms: integer(raw.ms),
      destroyed: integer(raw.destroyed),
      coins: integer(raw.coins, REWARD_RULES.maxFlightCoins),
      ship: [...SHIPS, ...RETIRED_SHIPS].some((s) => s.id === raw.ship)
        ? raw.ship
        : "pioneer",
      skin: SKINS.some((s) => s.id === raw.skin) ? raw.skin : "factory",
      stage: getStage(raw.stage)?.id ?? null,
      cleared:
        raw.cleared === true &&
        !!getStage(raw.stage) &&
        raw.ms >= getStage(raw.stage).duration * 1000,
      initialLevels: levels(raw.initialLevels),
      endLevels: levels(raw.endLevels),
    };
  }
  function fresh() {
    return {
      version: 1,
      credits: 0,
      flightMode: "stages",
      selectedStage: 1,
      clearedStages: [],
      selectedSkin: "factory",
      unlockedSkins: ["factory"],
      recentRuns: [],
      reduceEffects: false,
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
    if (raw.flightMode === "endless") data.flightMode = "endless";
    for (const stage of STAGES) {
      if (
        !Array.isArray(raw.clearedStages) ||
        !raw.clearedStages.includes(stage.id)
      )
        break;
      data.clearedStages.push(stage.id);
    }
    const unlockedStage = Math.min(
      STAGES.length,
      data.clearedStages.length + 1,
    );
    data.selectedStage =
      getStage(raw.selectedStage) && raw.selectedStage <= unlockedStage
        ? raw.selectedStage
        : unlockedStage;
    // Presence of a retired owned ID is the migration marker. Removing it makes
    // reloading or restoring the normalized save idempotent without new fields.
    const refund = RETIRED_SHIPS.reduce(
      (sum, ship) =>
        sum +
        (Array.isArray(raw.unlocked) && raw.unlocked.includes(ship.id)
          ? ship.refund
          : 0),
      0,
    );
    data.credits = Math.min(LIMIT, data.credits + refund);
    data.unlocked = unlockedShips(data);
    if (data.unlocked.includes(raw.selectedShip))
      data.selectedShip = raw.selectedShip;
    for (const up of UPGRADES)
      data.upgrades[up.id] = integer(raw.upgrades?.[up.id], up.costs.length);
    data.claimed = MISSIONS.filter(
      (m) => Array.isArray(raw.claimed) && raw.claimed.includes(m.id),
    ).map((m) => m.id);
    data.unlockedSkins = SKINS.filter(
      (s) =>
        s.id === "factory" ||
        (s.cost > 0 &&
          Array.isArray(raw.unlockedSkins) &&
          raw.unlockedSkins.includes(s.id)),
    ).map((s) => s.id);
    if (skinAvailable(data, raw.selectedSkin))
      data.selectedSkin = raw.selectedSkin;
    data.recentRuns = Array.isArray(raw.recentRuns)
      ? raw.recentRuns
          .filter(
            (r) =>
              r && typeof r === "object" && Number.isFinite(r.ms) && r.ms >= 0,
          )
          .slice(0, MAX_RECENT_RUNS)
          .map(sanitizeRun)
      : [];
    data.reduceEffects = raw.reduceEffects === true;
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
    finish(runId, ms, destroyed, context = {}) {
      if (
        typeof runId !== "string" ||
        !runId ||
        runId.length > 100 ||
        this.data.settled.includes(runId)
      )
        return { credits: 0, duplicate: true };
      ms = integer(ms);
      destroyed = integer(destroyed);
      const stage = getStage(context.stage);
      const cleared =
        context.cleared === true && stage && ms >= stage.duration * 1000;
      const firstClear =
        cleared && stage.id === this.data.clearedStages.length + 1;
      if (firstClear) {
        this.data.clearedStages.push(stage.id);
        this.data.selectedStage = Math.min(STAGES.length, stage.id + 1);
        this.data.unlocked = unlockedShips(this.data);
      }
      const reward = calculateFlightReward(ms, destroyed, context.coreCoins);
      if (firstClear) {
        reward.firstClearCoins = Math.min(
          stage.firstClearCoins,
          REWARD_RULES.maxFlightCoins - reward.totalCoins,
        );
        reward.totalCoins += reward.firstClearCoins;
      }
      const earned = reward.totalCoins;
      // Keep the legacy save field to preserve existing balances and cloud backups.
      this.data.credits = Math.min(LIMIT, this.data.credits + earned);
      this.data.flights = Math.min(LIMIT, this.data.flights + 1);
      this.data.totalMs = Math.min(LIMIT, this.data.totalMs + ms);
      this.data.totalDestroyed = Math.min(
        LIMIT,
        this.data.totalDestroyed + destroyed,
      );
      this.data.bestMs = Math.max(this.data.bestMs, ms);
      this.data.recentRuns.unshift(
        sanitizeRun({
          endedAt: context.endedAt ?? Date.now(),
          stage: stage?.id ?? null,
          cleared: !!cleared,
          ms,
          destroyed,
          coins: earned,
          ship: context.ship || this.data.selectedShip,
          skin: context.skin || this.data.selectedSkin,
          initialLevels: context.initialLevels || this.loadout().levels,
          endLevels: context.endLevels || this.loadout().levels,
        }),
      );
      this.data.recentRuns = this.data.recentRuns.slice(0, MAX_RECENT_RUNS);
      this.data.settled.push(runId);
      this.data.settled = this.data.settled.slice(-64);
      this.save();
      return { credits: earned, duplicate: false, reward };
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
    isShipUnlocked(id) {
      return shipAvailable(this.data, id);
    }
    selectShip(id) {
      if (!this.isShipUnlocked(id)) return false;
      this.data.unlocked = unlockedShips(this.data);
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
    selectStage(id) {
      if (
        !getStage(id) ||
        id > Math.min(STAGES.length, this.data.clearedStages.length + 1)
      )
        return false;
      this.data.selectedStage = id;
      this.data.flightMode = "stages";
      this.save();
      return true;
    }
    selectMode(mode) {
      if (!["stages", "endless"].includes(mode)) return false;
      this.data.flightMode = mode;
      this.save();
      return true;
    }
    isSkinUnlocked(id) {
      return skinAvailable(this.data, id);
    }
    selectSkin(id) {
      const skin = SKINS.find((s) => s.id === id);
      if (!skin) return false;
      if (!this.isSkinUnlocked(id)) {
        if (skin.unlockRank || this.data.credits < skin.cost) return false;
        this.data.credits -= skin.cost;
        this.data.unlockedSkins.push(id);
      }
      this.data.selectedSkin = id;
      this.save();
      return true;
    }
    setReducedEffects(value) {
      this.data.reduceEffects = value === true;
      this.save();
    }
    report() {
      return {
        schemaVersion: 1,
        game: "STAR DODGE",
        summary: {
          flights: this.data.flights,
          totalMs: this.data.totalMs,
          totalDestroyed: this.data.totalDestroyed,
          bestMs: this.data.bestMs,
        },
        recentRuns: this.data.recentRuns.map((r) => sanitizeRun(r)),
      };
    }
    loadout() {
      const ship =
          SHIPS.find((s) => s.id === this.data.selectedShip) || SHIPS[0],
        up = this.data.upgrades;
      const skin =
        SKINS.find((s) => s.id === this.data.selectedSkin) || SKINS[0];
      return {
        stage:
          this.data.flightMode === "stages" ? this.data.selectedStage : null,
        ship: ship.id,
        skin: skin.id,
        visuals: { armor: up.hull, trail: up.speed > 0, drone: up.sub > 0 },
        color: skin.color || ship.color,
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
  return {
    SHIPS,
    RETIRED_SHIPS,
    shipDetails,
    UPGRADES,
    MISSIONS,
    SKINS,
    MAX_RECENT_RUNS,
    licenseFor,
    REWARD_RULES,
    calculateFlightReward,
    Progress,
    sanitize,
    fresh,
  };
});
