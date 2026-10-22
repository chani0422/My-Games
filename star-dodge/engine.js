/* STAR DODGE: deterministic simulation, independent of Canvas and browser APIs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarDodge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";
  const CONFIG = {
    width: 480,
    height: 720,
    step: 1 / 60,
    maxFrame: 0.1,
    player: { hp: 3, speed: 300, radius: 10, invincible: 1.2 },
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
      interval: 15,
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
  };
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
      this.data = { best: 0, last: 0, sound: false };
      try {
        const data = JSON.parse(storage.getItem("star-dodge-v1") || "{}");
        for (const key of ["best", "last"])
          this.data[key] =
            Number.isFinite(data?.[key]) && data[key] >= 0 ? data[key] : 0;
        this.data.sound = data?.sound === true;
      } catch {
        this.data = { best: 0, last: 0, sound: false };
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
      this.player.color = loadout.color || "#71f3e0";
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
      if (this.state === "playing" || this.state === "countdown") {
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
      p.x = clamp(p.x + dx, p.radius, c.width - p.radius);
      p.y = clamp(p.y + dy, p.radius, c.height - p.radius);
    }
    emit(type, data = {}) {
      this.events.push({ type, ...data });
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
          this.bullets.push({
            x: p.x + offset,
            y: p.y - 19,
            vx: Math.sin(a) * speed,
            vy: -Math.cos(a) * speed,
            radius: sub ? c.sub.radius : c.main.radius,
            damage: sub ? c.sub.damage : c.main.damage,
            sub,
          });
        }
    }
    spawnRocks() {
      const c = this.config,
        d = difficulty(this.time, c),
        batch = [];
      for (let i = 0; i < d.batch && this.rocks.length < c.rocks.cap; i++) {
        const roll = this.random();
        let cumulative = 0;
        const type =
            c.rocks.types.find((r) => {
              cumulative += r.chance;
              return roll < cumulative;
            }) || c.rocks.types.at(-1),
          radius = type.radius;
        let x,
          placed = false;
        for (let attempt = 0; attempt < 24; attempt++) {
          x = radius + this.random() * (c.width - 2 * radius);
          if (
            batch.every(
              (r) => Math.abs(x - r.x) >= radius + r.radius + c.rocks.gap,
            )
          ) {
            placed = true;
            break;
          }
        }
        if (!placed) continue;
        const rock = {
          x,
          y: -radius - 1,
          radius,
          hp: type.hp(d.hardness),
          maxHp: type.hp(d.hardness),
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
      const c = this.config;
      for (let i = 0; i < c.items.types.length; i++) {
        const type = c.items.types[this.itemCursor];
        this.itemCursor = (this.itemCursor + 1) % c.items.types.length;
        if (this.levels[type] < this.maxLevel(type)) {
          this.items.push({
            type,
            x: 28 + this.random() * (c.width - 56),
            y: -24,
            radius: c.items.radius,
          });
          return;
        }
      }
    }
    collect(item) {
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
          this.mainAt = c.main.interval;
        }
        return;
      }
      if (this.state !== "playing") return;
      this.ticks++;
      this.time = this.ticks * c.step;
      const p = this.player;
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
        this.mainAt += c.main.interval;
      }
      if (this.levels.sub && this.time + 1e-8 >= this.subAt) {
        this.fire(true);
        this.subAt =
          this.time +
          (this.levels.sub === 3 ? c.sub.fastInterval : c.sub.interval);
      }
      if (this.time + 1e-8 >= this.rockAt) {
        this.spawnRocks();
        this.rockAt = this.time + difficulty(this.time, c).interval;
      }
      while (this.time + 1e-8 >= this.itemAt) {
        this.spawnItem();
        this.itemAt += c.items.interval;
      }
      for (const r of this.rocks) {
        r.oldY = r.y;
        r.y += r.speed * dt;
        r.rotation += r.spin * dt;
      }
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
            b.x,
            b.y - (r.y - r.oldY),
            r.x,
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
          this.emit("hit", { x: target.x, y: target.y });
          if (target.hp <= 0) {
            this.destroyed++;
            this.emit("destroy", {
              x: target.x,
              y: target.y,
              radius: target.radius,
            });
          }
        }
      }
      for (const r of this.rocks) {
        if (r.hp > 0 && p.invincible <= 0 && overlaps(p, r)) {
          r.hp = 0;
          p.hp--;
          p.invincible = c.player.invincible;
          this.emit("damage", { x: p.x, y: p.y });
          if (p.hp <= 0) {
            this.state = "result";
            this.input = { x: 0, y: 0 };
            this.emit("gameover", { ms: this.time * 1000 });
            break;
          }
        }
      }
      if (this.state === "playing")
        for (const item of this.items) {
          item.y += c.items.speed * dt;
          if (overlaps(p, item)) {
            this.collect(item);
            item.dead = true;
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
      this.rocks = this.rocks.filter(
        (r) => r.hp > 0 && r.y - r.radius <= c.height,
      );
      this.items = this.items.filter(
        (i) => !i.dead && i.y - i.radius <= c.height,
      );
    }
  }
  return { CONFIG, Game, Records, difficulty, formatTime, segmentHit };
});
