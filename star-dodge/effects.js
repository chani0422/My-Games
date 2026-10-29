/* Bounded pools for cosmetic feedback, isolated from simulation and rewards. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarEffects = api;
})(globalThis, () => {
  "use strict";
  class Effects {
    constructor({
      random = Math.random,
      particleLimit = 180,
      labelLimit = 24,
      ringLimit = 12,
    } = {}) {
      this.random = random;
      this.particleLimit = particleLimit;
      this.labelLimit = labelLimit;
      this.ringLimit = ringLimit;
      this.particles = [];
      this.labels = [];
      this.rings = [];
      this.shake = 0;
      this.strength = 0;
    }
    clear() {
      for (const pool of [this.particles, this.labels, this.rings])
        for (const item of pool) item.life = 0;
      this.shake = 0;
      this.strength = 0;
    }
    slot(pool, limit) {
      let item = pool.find((item) => item.life <= 0);
      if (!item && pool.length < limit) {
        item = {};
        pool.push(item);
      }
      return item;
    }
    add(event, reduced = false) {
      if (reduced) return;
      const e = event;
      if (
        !["hit", "destroy", "damage", "shield", "core", "choice"].includes(
          e.type,
        )
      )
        return;
      const color =
        e.type === "damage"
          ? "#ff7b89"
          : e.type === "destroy"
            ? e.elite
              ? "#ffd47d"
              : "#ffc18c"
            : e.type === "hit"
              ? "#fff5d9"
              : "#71f3e0";
      const count =
        e.type === "hit"
          ? 3
          : e.type === "destroy"
            ? Math.min(36, Math.round(14 + (Math.max(16, e.radius) - 16)))
            : 14;
      for (let i = 0; i < count; i++) {
        const p = this.slot(this.particles, this.particleLimit);
        if (!p) break;
        const a = this.random() * Math.PI * 2,
          v = 35 + this.random() * 135;
        Object.assign(p, {
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: e.type === "hit" ? 0.14 : 0.5,
          max: e.type === "hit" ? 0.14 : 0.5,
          color,
          spark: i % 3 === 0,
        });
      }
      if (e.type !== "hit") {
        const r = this.slot(this.rings, this.ringLimit);
        if (r)
          Object.assign(r, {
            x: e.x,
            y: e.y,
            life: 0.3,
            max: 0.3,
            radius: e.radius || 15,
            flash: e.type === "destroy",
            color,
          });
      }
      if (e.type === "hit" && e.damage) {
        const n = this.slot(this.labels, this.labelLimit);
        if (n)
          Object.assign(n, {
            x: e.x,
            y: e.y,
            life: 0.5,
            max: 0.5,
            text: String(e.damage),
            color: "#fff5df",
          });
      }
      if (e.type === "damage" || (e.type === "destroy" && e.radius >= 32)) {
        this.shake = 0.2;
        this.strength = e.type === "damage" ? 6 : 2.8;
      }
    }
    advance(dt, reduced = false) {
      if (reduced) {
        this.clear();
        return;
      }
      this.shake = Math.max(0, this.shake - dt);
      for (const p of this.particles)
        if (p.life > 0) {
          p.life = Math.max(0, p.life - dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      for (const r of this.rings) r.life = Math.max(0, r.life - dt);
      for (const n of this.labels)
        if (n.life > 0) {
          n.life = Math.max(0, n.life - dt);
          n.y -= 35 * dt;
        }
    }
    offset(reduced = false) {
      return reduced || this.shake <= 0
        ? { x: 0, y: 0 }
        : {
            x: ((this.random() - 0.5) * this.strength * this.shake) / 0.2,
            y: ((this.random() - 0.5) * this.strength * this.shake) / 0.2,
          };
    }
    draw(ctx, reduced = false) {
      if (reduced) return;
      ctx.save();
      for (const r of this.rings)
        if (r.life > 0) {
          const elapsed = 1 - r.life / r.max;
          if (r.flash && elapsed < 0.22) {
            ctx.globalAlpha = (0.22 - elapsed) * 1.5;
            ctx.fillStyle = "#fff4d8";
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius * (0.6 + elapsed * 3), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = r.life / r.max;
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            r.x,
            r.y,
            r.radius * (1 + (1 - r.life / r.max) * 1.5),
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      for (const p of this.particles)
        if (p.life > 0) {
          ctx.globalAlpha = p.life / p.max;
          ctx.fillStyle = p.color;
          if (p.spark) {
            ctx.strokeStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
            ctx.stroke();
          } else ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        }
      ctx.font = "bold 13px ui-monospace,monospace";
      ctx.textAlign = "center";
      for (const n of this.labels)
        if (n.life > 0) {
          ctx.globalAlpha = n.life / n.max;
          ctx.fillStyle = n.color;
          ctx.fillText(n.text, n.x, n.y);
        }
      ctx.restore();
    }
    get stats() {
      return {
        particles: this.particles.filter((p) => p.life > 0).length,
        labels: this.labels.filter((n) => n.life > 0).length,
        rings: this.rings.filter((r) => r.life > 0).length,
        shake: this.shake,
      };
    }
  }
  return { Effects };
});
