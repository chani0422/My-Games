/* STAR DODGE: deterministic simulation, independent of Canvas and browser APIs. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./stages.js")
      : root.StarStages,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarDodge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (stageAPI) => {
  "use strict";
  const { STAGES, getStage } = stageAPI;
  const CONFIG = {
    width: 480,
    height: 720,
    step: 1 / 60,
    maxFrame: 0.1,
    player: {
      hp: 3,
      speed: 300,
      radius: 6,
      movementRadius: 10,
      pickupRadius: 10,
      invincible: 1.2,
    },
    main: {
      interval: 0.25,
      speeds: [600, 720, 840, 960, 1080],
      angles: [[0], [-5, 5], [-10, 0, 10]],
      damage: 1,
      radius: 3,
    },
    sub: {
      max: 3,
      speed: 650,
      damage: 1,
      radius: 3,
      interval: 1,
      fastInterval: 0.7,
    },
    items: {
      interval: 12,
      speed: 80,
      radius: 19,
      types: ["speed", "multi", "sub"],
    },
    rocks: {
      cap: 80,
      minInterval: 0.22,
      initialInterval: 0.95,
      intervalSlope: 0.004,
      batchSeconds: 90,
      hardeningSeconds: 30,
      baseSpeed: 70,
      speedSlope: 0.4,
      maxSpeed: 180,
      gap: 12,
      types: [
        { chance: 0.6, radius: 16, hp: (h) => h, multiplier: 1.1 },
        { chance: 0.3, radius: 26, hp: (h) => h + 2, multiplier: 0.9 },
        { chance: 0.1, radius: 38, hp: (h) => 2 * h + 4, multiplier: 0.75 },
      ],
    },
    particles: 180,
    enemyBullets: 48,
    playerBullets: 192,
    cores: 4,
  };
  const FLIGHT_CATEGORIES = Object.freeze(
    [
      { id: "firepower", name: "火力" },
      { id: "movement", name: "移動" },
      { id: "defense", name: "防御・回復" },
    ].map(Object.freeze),
  );
  const FLIGHT_UPGRADES = Object.freeze(
    [
      {
        id: "rapid",
        category: "firepower",
        name: "連射ドライブ",
        description: "発射間隔を12%ずつ短縮",
        max: 3,
        icon: "»",
        color: "#ff6f61",
      },
      {
        id: "damage",
        category: "firepower",
        name: "高出力弾",
        description: "メイン弾のダメージ +1",
        max: 3,
        icon: "✦",
        color: "#ff8562",
      },
      {
        id: "multi",
        category: "firepower",
        name: "拡散弾",
        description: "メイン弾の発射数を増やす",
        max: 3,
        icon: "⋮",
        color: "#ff5f7a",
      },
      {
        id: "speed",
        category: "firepower",
        name: "弾速ブースト",
        description: "SPEEDを1段階アップ",
        max: 5,
        icon: "↑",
        color: "#ffa25e",
      },
      {
        id: "sub",
        category: "firepower",
        name: "ドローン",
        description: "随伴機を強化。最大数の後は弾威力UP",
        max: 5,
        icon: "✧",
        color: "#ff6f91",
      },
      {
        id: "shield",
        category: "defense",
        name: "シールド",
        description: "被弾を1回防ぐバリアを補充",
        max: 1,
        icon: "◇",
        color: "#91d7ff",
      },
      {
        id: "movement",
        category: "movement",
        name: "機動ブースト",
        description: "移動速度を8%ずつアップ",
        max: 3,
        icon: "↗",
        color: "#6bb8ff",
      },
      {
        id: "magnet",
        category: "movement",
        name: "マグネット",
        description: "コアの吸引範囲を広げる",
        max: 3,
        icon: "◎",
        color: "#6be0ff",
      },
      {
        id: "repair",
        category: "defense",
        name: "応急修理",
        description: "機体のHPを1回復",
        max: 1,
        icon: "＋",
        color: "#a5ffba",
      },
    ].map(Object.freeze),
  );
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const formatTime = (ms) =>
    (Math.floor(Math.max(0, ms) / 100) / 10).toFixed(1);
  const overlaps = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius;
  function segmentHit(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1,
      dy = y2 - y1,
      fx = x1 - cx,
      fy = y1 - cy;
    const a = dx * dx + dy * dy,
      c = fx * fx + fy * fy - r * r;
    if (c <= 0) return 0;
    if (!a) return null;
    const b = 2 * (fx * dx + fy * dy),
      d = b * b - 4 * a * c;
    if (d < 0) return null;
    const t = (-b - Math.sqrt(d)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }
  function difficulty(t, c = CONFIG) {
    return {
      hardness: 1 + Math.floor(t / c.rocks.hardeningSeconds),
      interval: Math.max(
        c.rocks.minInterval,
        c.rocks.initialInterval - c.rocks.intervalSlope * t,
      ),
      batch: 1 + Math.min(2, Math.floor(t / c.rocks.batchSeconds)),
      speed: Math.min(
        c.rocks.maxSpeed,
        c.rocks.baseSpeed + c.rocks.speedSlope * t,
      ),
    };
  }
  class Records {
    constructor(storage) {
      this.storage = storage;
      this.tabOnly = false;
      this.data = {
        best: 0,
        last: 0,
        sound: true,
        soundDefaultRevision: 1,
        volume: 1,
      };
      try {
        const data = JSON.parse(storage.getItem("star-dodge-v1") || "{}");
        for (const key of ["best", "last"])
          this.data[key] =
            Number.isFinite(data?.[key]) && data[key] >= 0 ? data[key] : 0;
        this.data.sound =
          data?.soundDefaultRevision === 1 ? data.sound === true : true;
        this.data.volume = Number.isFinite(data?.volume)
          ? clamp(data.volume, 0, 1)
          : 1;
      } catch {
        this.data = {
          best: 0,
          last: 0,
          sound: true,
          soundDefaultRevision: 1,
          volume: 1,
        };
      }
      this.save();
    }
    save() {
      try {
        if (!this.storage) throw Error();
        this.storage.setItem("star-dodge-v1", JSON.stringify(this.data));
      } catch {
        this.tabOnly = true;
      }
    }
    finish(ms) {
      const value = Number.isFinite(ms) && ms >= 0 ? ms : 0;
      const isBest = value > this.data.best;
      this.data.last = value;
      if (isBest) this.data.best = value;
      this.save();
      return isBest;
    }
    sound(on) {
      this.data.sound = !!on;
      this.save();
    }
    setVolume(value) {
      this.data.volume = Number.isFinite(value) ? clamp(value, 0, 1) : 1;
      this.save();
    }
  }
  class Game {
    constructor({ random = Math.random, config = CONFIG } = {}) {
      this.random = random;
      this.config = config;
      this.state = "title";
      this.events = [];
      this.reset();
    }
    reset() {
      const c = this.config;
      this.stage = null;
      this.outcome = null;
      this.elimination = false;
      this.ticks = 0;
      this.time = 0;
      this.accumulator = 0;
      this.countdown = 3;
      this.player = {
        x: c.width / 2,
        y: c.height * 0.8,
        radius: c.player.radius,
        hp: c.player.hp,
        invincible: 0,
      };
      this.levels = { speed: 1, multi: 1, sub: 0 };
      this.bullets = [];
      this.rocks = [];
      this.items = [];
      this.enemyBullets = [];
      this.skills = {
        rapid: 0,
        damage: 0,
        dronePower: 0,
        movement: 0,
        magnet: 0,
      };
      this.shield = 0;
      this.coreCoins = 0;
      this.choices = [];
      this.combo = 0;
      this.lastKill = -Infinity;
      this.eventState = null;
      this.eventAt = 60;
      this.eventCount = 0;
      this.destroyed = 0;
      this.mainAt = 0;
      this.subAt = c.sub.interval;
      this.rockAt = c.rocks.initialInterval;
      this.itemAt = c.items.interval;
      this.itemCursor = 0;
      this.events = [];
      this.input = { x: 0, y: 0 };
    }
    start(loadout = {}) {
      this.reset();
      this.stage = getStage(loadout.stage);
      if (this.stage) {
        this.eventAt = 15;
        this.rockAt = this.stage.interval;
        this.itemCursor = (this.stage.id - 1) % this.config.items.types.length;
      }
      // Permanent upgrades apply only at the beginning of a new run.
      this.player.hp = clamp(
        Math.floor(loadout.hp || this.config.player.hp),
        1,
        8,
      );
      this.player.maxHp = this.player.hp;
      this.player.speed = clamp(
        loadout.speed || this.config.player.speed,
        150,
        450,
      );
      this.player.baseSpeed = this.player.speed;
      this.player.armor = clamp(Math.floor(loadout.visuals?.armor || 0), 0, 2);
      this.player.trails = loadout.visuals?.trail === true;
      this.player.droneStyle = loadout.visuals?.drone === true;
      this.player.color = loadout.color || "#71f3e0";
      this.player.ship = ["pioneer", "swift", "warden"].includes(loadout.ship)
        ? loadout.ship
        : "pioneer";
      for (const type of ["speed", "multi", "sub"]) {
        const minimum = type === "sub" ? 0 : 1;
        this.levels[type] = clamp(
          Math.floor(loadout.levels?.[type] ?? minimum),
          minimum,
          this.maxLevel(type),
        );
      }
      this.state = "countdown";
    }
    pause() {
      if (["playing", "countdown", "upgrade"].includes(this.state)) {
        this.previousState = this.state;
        this.state = "paused";
        this.input = { x: 0, y: 0 };
        this.accumulator = 0;
      }
    }
    resume() {
      if (this.state === "paused") {
        this.state = this.previousState;
        this.accumulator = 0;
      }
    }
    title() {
      this.reset();
      this.state = "title";
    }
    advance(seconds) {
      if (!["playing", "countdown"].includes(this.state)) return;
      this.accumulator += clamp(seconds, 0, this.config.maxFrame);
      while (this.accumulator + 1e-10 >= this.config.step) {
        this.accumulator -= this.config.step;
        this.step(this.config.step);
        if (!["playing", "countdown"].includes(this.state)) {
          this.accumulator = 0;
          break;
        }
      }
    }
    moveBy(dx, dy) {
      if (this.state !== "playing") return;
      const p = this.player,
        c = this.config;
      const margin = c.player.movementRadius ?? p.radius;
      p.x = clamp(p.x + dx, margin, c.width - margin);
      p.y = clamp(p.y + dy, margin, c.height - margin);
    }
    emit(type, data = {}) {
      this.events.push({ type, ...data });
      if (this.events.length > 256) this.events.shift();
    }
    fire(sub = false) {
      const c = this.config,
        p = this.player;
      const angles = sub ? [0] : c.main.angles[this.levels.multi - 1];
      const origins = sub ? (this.levels.sub === 1 ? [28] : [-28, 28]) : [0];
      for (const offset of origins)
        for (const angle of angles) {
          const a = (angle * Math.PI) / 180,
            speed = sub ? c.sub.speed : c.main.speeds[this.levels.speed - 1];
          if (this.bullets.length >= this.config.playerBullets) break;
          this.bullets.push({
            x: p.x + offset,
            y: p.y - 19,
            vx: Math.sin(a) * speed,
            vy: -Math.cos(a) * speed,
            radius: sub ? c.sub.radius : c.main.radius,
            damage: sub
              ? c.sub.damage + this.skills.dronePower
              : c.main.damage + this.skills.damage,
            sub,
          });
        }
      this.emit("shot", { sub });
    }
    fireInterval() {
      return this.config.main.interval * (1 - 0.12 * this.skills.rapid);
    }
    get stageTimeUp() {
      return !!this.stage && this.time + 1e-8 >= this.stage.duration;
    }
    get remainingRocks() {
      return this.rocks.reduce(
        (count, rock) => count + (rock.hp > 0 ? 1 : 0),
        0,
      );
    }
    recycleRock(rock) {
      const c = this.config;
      const type =
        c.rocks.types.find((type) => type.radius === rock.radius) ||
        c.rocks.types.at(-1);
      rock.x = rock.radius + this.random() * (c.width - 2 * rock.radius);
      rock.y = -rock.radius - 1;
      rock.oldX = rock.x;
      rock.oldY = rock.y;
      rock.originX = rock.x;
      rock.speed =
        this.currentDifficulty().speed *
        type.multiplier *
        (0.85 + this.random() * 0.3);
      rock.age = 0;
      rock.phase = "approach";
      rock.vx = 0;
      rock.nextShot = 2.5;
      rock.wavePhase = this.random() * Math.PI * 2;
      rock.flashUntil = 0;
      delete rock.targetX;
      delete rock.warningUntil;
    }
    currentDifficulty() {
      const base = this.stage || difficulty(this.time, this.config);
      return this.eventState?.kind === "rush" &&
        this.time < this.eventState.until
        ? {
            ...base,
            interval: Math.max(
              this.config.rocks.minInterval,
              base.interval * 0.8,
            ),
          }
        : base;
    }
    patternPool() {
      if (this.stage)
        return [
          "weaver",
          ...(this.stage.id >= 3 ? ["charger"] : []),
          ...(this.stage.id >= 5 ? ["gunner"] : []),
        ];
      return [
        ...(this.time >= 30 ? ["weaver"] : []),
        ...(this.time >= 60 ? ["charger"] : []),
        ...(this.time >= 90 ? ["gunner"] : []),
      ];
    }
    spawnRocks(elite = false) {
      if (this.stageTimeUp) return;
      const c = this.config,
        d = this.currentDifficulty(),
        batch = [];
      for (
        let i = 0;
        i < (elite ? 1 : d.batch) && this.rocks.length < c.rocks.cap;
        i++
      ) {
        const roll = this.random();
        let cumulative = 0;
        const type =
            c.rocks.types.find((r) => {
              cumulative += r.chance;
              return roll < cumulative;
            }) || c.rocks.types.at(-1),
          radius = elite ? 42 : type.radius;
        let x,
          placed = false;
        for (let attempt = 0; attempt < 24; attempt++) {
          x = radius + this.random() * (c.width - 2 * radius);
          if (
            (!this.eventState ||
              this.time >= this.eventState.until ||
              Math.abs(x - this.eventState.safeX) >= radius + 48) &&
            batch.every(
              (r) => Math.abs(x - r.x) >= radius + r.radius + c.rocks.gap,
            )
          ) {
            placed = true;
            break;
          }
        }
        if (!placed) continue;
        const pool = this.patternPool(),
          rollPattern = this.random();
        const pattern = elite
          ? "elite"
          : rollPattern < pool.length * 0.12
            ? pool[Math.floor(rollPattern / 0.12)]
            : "meteor";
        const hp = elite ? d.hardness * 2 + 6 : type.hp(d.hardness);
        const rock = {
          x,
          y: -radius - 1,
          radius,
          hp,
          maxHp: hp,
          type: pattern,
          originX: x,
          age: 0,
          phase: "approach",
          vx: 0,
          nextShot: 2.5,
          amplitude: 30 + this.random() * 18,
          wavePhase: this.random() * Math.PI * 2,
          speed: d.speed * type.multiplier * (0.85 + this.random() * 0.3),
          rotation: this.random() * Math.PI * 2,
          spin: (this.random() - 0.5) * 0.7,
          shape: Array.from({ length: 10 }, () => 0.82 + this.random() * 0.18),
        };
        batch.push(rock);
        this.rocks.push(rock);
      }
    }
    maxLevel(type) {
      return type === "speed"
        ? this.config.main.speeds.length
        : type === "multi"
          ? this.config.main.angles.length
          : this.config.sub.max;
    }
    spawnItem() {
      this.spawnCore({ scheduled: true });
    }
    spawnCore({
      x = this.player.x,
      y = this.player.y - 70,
      scheduled = false,
    } = {}) {
      if (this.stageTimeUp || this.items.length >= this.config.cores)
        return false;
      this.items.push({
        type: "core",
        x: clamp(x, 24, this.config.width - 24),
        y: clamp(y, 24, this.config.height - 24),
        radius: 16,
        scheduled,
      });
      return true;
    }
    upgradeLevel(id) {
      if (id === "sub") return this.levels.sub + this.skills.dronePower;
      if (id === "shield") return this.shield;
      if (id === "repair") return this.player.hp >= this.player.maxHp ? 1 : 0;
      return this.levels[id] ?? this.skills[id] ?? 0;
    }
    offerUpgrades() {
      const pool = FLIGHT_UPGRADES.filter(
        (up) => this.upgradeLevel(up.id) < up.max,
      );
      this.choices = [];
      while (pool.length && this.choices.length < 3) {
        const index = Math.min(
          pool.length - 1,
          Math.floor(this.random() * pool.length),
        );
        this.choices.push({ ...pool.splice(index, 1)[0] });
      }
      if (!this.choices.length)
        this.choices = [
          {
            id: "coins",
            name: "余剰コア",
            description: "全強化MAX。終了時のコイン +2（合計500まで）",
            icon: "✦",
            color: "#ffd47d",
          },
        ];
      this.state = "upgrade";
      this.accumulator = 0;
      this.input = { x: 0, y: 0 };
      this.emit("core", { x: this.player.x, y: this.player.y });
    }
    chooseUpgrade(index) {
      if (
        this.state !== "upgrade" ||
        !Number.isInteger(index) ||
        !this.choices[index]
      )
        return false;
      const up = this.choices[index];
      if (["speed", "multi"].includes(up.id))
        this.collect({ type: up.id, x: this.player.x, y: this.player.y });
      else if (up.id === "sub") {
        if (this.levels.sub < 3)
          this.collect({ type: "sub", x: this.player.x, y: this.player.y });
        else this.skills.dronePower++;
      } else if (up.id === "shield") this.shield = 1;
      else if (up.id === "repair")
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      else if (up.id === "coins")
        this.coreCoins = Math.min(500, this.coreCoins + 2);
      else if (up.id in this.skills) this.skills[up.id]++;
      if (up.id === "movement")
        this.player.speed = Math.min(
          450,
          this.player.baseSpeed * (1 + this.skills.movement * 0.08),
        );
      if (up.id === "rapid")
        this.mainAt = Math.min(this.mainAt, this.time + this.fireInterval());
      this.choices = [];
      this.state = "playing";
      this.accumulator = 0;
      this.input = { x: 0, y: 0 };
      this.emit("choice", { kind: up.id, x: this.player.x, y: this.player.y });
      return true;
    }
    triggerEvent() {
      if (this.stageTimeUp) return;
      const number = this.stage ? this.stage.id : ++this.eventCount;
      const kind = number % 2 ? "rush" : "elite";
      this.eventState = {
        kind,
        until: this.time + 5,
        safeX: clamp(this.player.x, 60, this.config.width - 60),
      };
      this.emit("event", { kind });
      if (kind === "elite") this.spawnRocks(true);
    }
    moveRock(r, dt) {
      r.oldX = r.x;
      r.oldY = r.y;
      r.age = (r.age || 0) + dt;
      if (r.flashUntil && this.time > r.flashUntil) r.flashUntil = 0;
      if (r.type === "weaver")
        r.x = clamp(
          r.originX + Math.sin(r.age * 1.8 + r.wavePhase) * r.amplitude,
          r.radius,
          this.config.width - r.radius,
        );
      if (r.type === "charger") {
        if (r.phase === "approach" && r.age + 1e-8 >= 1.5) {
          r.phase = "warning";
          r.warningUntil = r.age + 0.5;
        }
        if (r.phase === "warning") {
          r.targetX = this.player.x;
          if (r.age + 1e-8 >= r.warningUntil) {
            r.phase = "charge";
            r.vx = clamp((r.targetX - r.x) / 0.8, -120, 120);
          }
        }
        if (r.phase === "charge") r.x += r.vx * dt;
      }
      const multiplier =
        r.type === "charger"
          ? r.phase === "charge"
            ? 2.3
            : 0.55
          : r.type === "gunner"
            ? 0.65
            : 1;
      r.y += Math.min(240, r.speed * multiplier) * dt;
      r.rotation += r.spin * dt;
      if (
        r.type === "gunner" &&
        !this.stageTimeUp &&
        r.age >= r.nextShot &&
        r.y > 0 &&
        r.y < this.config.height - 100
      ) {
        r.nextShot = r.age + 2.5;
        if (this.enemyBullets.length < this.config.enemyBullets) {
          const dx = this.player.x - r.x,
            dy = this.player.y - r.y,
            length = Math.hypot(dx, dy) || 1;
          this.enemyBullets.push({
            x: r.x,
            y: r.y,
            vx: (dx / length) * 125,
            vy: (dy / length) * 125,
            radius: 3,
          });
        }
      }
    }
    damagePlayer() {
      const p = this.player;
      if (p.invincible > 0) return false;
      p.invincible = this.config.player.invincible;
      if (this.shield) {
        this.shield = 0;
        this.emit("shield", { x: p.x, y: p.y });
        return true;
      }
      p.hp--;
      this.emit("damage", { x: p.x, y: p.y });
      if (p.hp <= 0) {
        this.outcome = "destroyed";
        this.state = "result";
        this.input = { x: 0, y: 0 };
        this.emit("gameover", { ms: this.time * 1000 });
      }
      return true;
    }
    collect(item) {
      if (item.type === "core") {
        if (this.state === "playing") this.offerUpgrades();
        return;
      }
      if (this.levels[item.type] >= this.maxLevel(item.type)) return;
      this.levels[item.type]++;
      if (item.type === "sub")
        this.subAt =
          this.time +
          (this.levels.sub === 3
            ? this.config.sub.fastInterval
            : this.config.sub.interval);
      this.emit("upgrade", {
        kind: item.type,
        level: this.levels[item.type],
        x: item.x,
        y: item.y,
      });
    }
    step(dt) {
      const c = this.config;
      if (this.state === "countdown") {
        this.countdown = Math.max(0, this.countdown - dt);
        if (this.countdown < 1e-8) {
          this.state = "playing";
          this.fire();
          this.mainAt = this.fireInterval();
        }
        return;
      }
      if (this.state !== "playing") return;
      this.ticks++;
      this.time = this.ticks * c.step;
      const p = this.player,
        oldPX = p.x,
        oldPY = p.y;
      if (this.time - this.lastKill > 3) this.combo = 0;
      p.invincible = Math.max(0, p.invincible - dt);
      if (p.invincible < 1e-8) p.invincible = 0;
      const length = Math.hypot(this.input.x, this.input.y);
      if (length)
        this.moveBy(
          (this.input.x / Math.max(1, length)) *
            (p.speed || c.player.speed) *
            dt,
          (this.input.y / Math.max(1, length)) *
            (p.speed || c.player.speed) *
            dt,
        );
      while (this.time + 1e-8 >= this.mainAt) {
        this.fire();
        this.mainAt += this.fireInterval();
      }
      if (this.levels.sub && this.time + 1e-8 >= this.subAt) {
        this.fire(true);
        this.subAt =
          this.time +
          (this.levels.sub === 3 ? c.sub.fastInterval : c.sub.interval);
      }
      if (!this.stageTimeUp) {
        if (this.time + 1e-8 >= this.eventAt) {
          this.triggerEvent();
          this.eventAt = this.stage ? Infinity : this.eventAt + 60;
        }
        if (this.time + 1e-8 >= this.rockAt) {
          this.spawnRocks();
          this.rockAt = this.time + this.currentDifficulty().interval;
        }
        while (this.time + 1e-8 >= this.itemAt) {
          this.spawnItem();
          this.itemAt += c.items.interval;
        }
      }
      for (const r of this.rocks) this.moveRock(r, dt);
      for (const b of this.bullets) {
        const ox = b.x,
          oy = b.y;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        let target = null,
          nearest = Infinity;
        for (const r of this.rocks) {
          if (r.hp <= 0) continue;
          const hit = segmentHit(
            ox,
            oy,
            b.x - (r.x - r.oldX),
            b.y - (r.y - r.oldY),
            r.oldX,
            r.oldY,
            b.radius + r.radius,
          );
          if (hit !== null && hit < nearest) {
            nearest = hit;
            target = r;
          }
        }
        if (target) {
          b.dead = true;
          target.hp -= b.damage;
          target.flashUntil = this.time + 0.06;
          this.emit("hit", { x: target.x, y: target.y, damage: b.damage });
          if (target.hp <= 0) {
            this.destroyed++;
            this.combo = this.time - this.lastKill <= 3 ? this.combo + 1 : 1;
            this.lastKill = this.time;
            if (target.type === "elite")
              this.spawnCore({ x: target.x, y: target.y });
            this.emit("destroy", {
              x: target.x,
              y: target.y,
              radius: target.radius,
              combo: this.combo,
              elite: target.type === "elite",
            });
          }
        }
      }
      for (const r of this.rocks) {
        if (r.hp > 0 && p.invincible <= 0 && overlaps(p, r)) {
          // During elimination, collision removes HP or shield, never the target.
          if (!this.stageTimeUp) r.hp = 0;
          this.damagePlayer();
          if (this.state === "result") break;
        }
      }
      for (const b of this.enemyBullets) {
        const ox = b.x,
          oy = b.y;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (
          this.state === "playing" &&
          segmentHit(
            ox,
            oy,
            b.x - (p.x - oldPX),
            b.y - (p.y - oldPY),
            oldPX,
            oldPY,
            p.radius + b.radius,
          ) !== null
        ) {
          if (this.damagePlayer()) b.dead = true;
        }
      }
      this.enemyBullets = this.enemyBullets.filter(
        (b) =>
          !b.dead &&
          b.x >= -20 &&
          b.x <= c.width + 20 &&
          b.y >= -20 &&
          b.y <= c.height + 20,
      );
      if (this.state === "playing" && this.stageTimeUp) {
        if (this.remainingRocks === 0) {
          this.state = "result";
          this.outcome = "cleared";
          this.input = { x: 0, y: 0 };
          this.emit("gameover", {
            ms: this.time * 1000,
            cleared: true,
            stage: this.stage.id,
          });
        } else if (!this.elimination) {
          this.elimination = true;
          this.emit("elimination", { remaining: this.remainingRocks });
        }
      }
      if (this.state === "playing")
        for (const item of this.items) {
          if (item.type === "core") {
            const dx = p.x - item.x,
              dy = p.y - item.y,
              distance = Math.hypot(dx, dy);
            const attracted =
              item.scheduled || distance < 90 + this.skills.magnet * 70;
            if (attracted && distance > 0) {
              const travel = Math.min(
                distance,
                (item.scheduled ? 650 : 360) * dt,
              );
              item.x += (dx / distance) * travel;
              item.y += (dy / distance) * travel;
            } else item.y += c.items.speed * dt;
          } else item.y += c.items.speed * dt;
          if (
            overlaps(
              {
                ...p,
                radius:
                  (c.player.pickupRadius ?? p.radius) + this.skills.magnet * 20,
              },
              item,
            )
          ) {
            item.dead = true;
            if (item.type === "core") {
              this.offerUpgrades();
              break;
            } else this.collect(item);
          }
        }
      this.bullets = this.bullets.filter(
        (b) =>
          !b.dead &&
          b.y >= -30 &&
          b.x >= -20 &&
          b.x <= c.width + 20 &&
          b.y < c.height + 30,
      );
      if (this.stageTimeUp) {
        for (const rock of this.rocks) {
          if (rock.hp > 0 && rock.y - rock.radius > c.height)
            this.recycleRock(rock);
        }
      }
      this.rocks = this.rocks.filter(
        (r) => r.hp > 0 && (this.stageTimeUp || r.y - r.radius <= c.height),
      );
      this.items = this.items.filter(
        (i) => !i.dead && i.y - i.radius <= c.height,
      );
    }
  }
  return {
    CONFIG,
    STAGES,
    FLIGHT_CATEGORIES,
    FLIGHT_UPGRADES,
    Game,
    Records,
    difficulty,
    formatTime,
    segmentHit,
  };
});
