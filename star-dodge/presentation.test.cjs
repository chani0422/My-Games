const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { Effects } = require("./effects.js");
const { Synth } = require("./audio.js");
function fakeAudio() {
  const context = {
    currentTime: 0,
    state: "running",
    destination: {},
    closed: false,
    oscillators: [],
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    },
    createOscillator() {
      const o = {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop(when) {
          if (when === undefined || when <= context.currentTime)
            this.onended?.();
          else this.stopAt = when;
        },
      };
      context.oscillators.push(o);
      return o;
    },
    resume() {
      this.state = "running";
      return Promise.resolve();
    },
    close() {
      this.closed = true;
      this.state = "closed";
    },
  };
  const timers = {
    next: 1,
    pending: new Map(),
    setInterval(fn) {
      const id = this.next++;
      this.pending.set(id, fn);
      return id;
    },
    clearInterval(id) {
      this.pending.delete(id);
    },
  };
  return {
    context,
    timers,
    synth: new Synth({ contextFactory: () => context, timers }),
  };
}
test("BGM and SFX use a bounded oscillator graph and stop all voices/timers on pause, background and OFF", async () => {
  const { synth, context, timers } = fakeAudio();
  synth.unlock();
  await Promise.resolve();
  synth.sync("playing", true);
  assert.equal(synth.stats.bgmPlaying, true);
  assert.ok(synth.stats.scheduledTicks > 0);
  const initial = synth.stats.scheduledTicks;
  context.currentTime += 0.4;
  for (const fn of timers.pending.values()) fn();
  assert.ok(synth.stats.scheduledTicks > initial);
  for (let i = 0; i < 1000; i++)
    synth.tone(
      440,
      0.1,
      0.02,
      "sine",
      context.currentTime,
      440,
      i % 2 ? "sfx" : "music",
    );
  assert.ok(synth.stats.voices <= 24);
  assert.ok(synth.stats.nodes <= 49);
  for (const state of ["paused", "upgrade", "background"]) {
    synth.sync(state);
    assert.equal(synth.stats.voices, 0);
    assert.equal(timers.pending.size, 0);
    synth.sync("playing");
  }
  synth.setEnabled(false);
  assert.equal(synth.stats.voices, 0);
  assert.equal(synth.stats.bgmPlaying, false);
  synth.unlock();
  assert.equal(synth.stats.voices, 0);
  synth.setEnabled(true);
  synth.sync("playing");
  synth.dispose();
  assert.equal(timers.pending.size, 0);
  assert.equal(context.closed, true);
});
test("shot and hit sounds are throttled, clear and failure differ, and ended voices disconnect", async () => {
  const { synth, context } = fakeAudio();
  synth.unlock();
  await Promise.resolve();
  synth.sync("playing");
  let before = synth.stats.voices;
  for (let i = 0; i < 50; i++) synth.effect("shot");
  assert.equal(synth.stats.voices, before + 1);
  context.currentTime += 0.2;
  synth.effect("shot");
  assert.equal(synth.stats.voices, before + 2);
  const old = context.oscillators.length;
  synth.effect("clear");
  assert.equal(context.oscillators.length, old + 3);
  synth.effect("gameover");
  assert.equal(context.oscillators.length, old + 4);
  for (const voice of [...synth.voices]) voice.oscillator.onended();
  assert.equal(synth.stats.voices, 0);
  synth.dispose();
});
test("effects scale explosions, reuse fixed pools, expire and never modify rewards", () => {
  const fx = new Effects({ random: () => 0.25 });
  fx.add({ type: "destroy", radius: 16, x: 100, y: 100 });
  assert.equal(fx.stats.particles, 14);
  fx.advance(1);
  fx.add({ type: "destroy", radius: 38, x: 100, y: 100 });
  assert.equal(fx.stats.particles, 36);
  assert.ok(fx.stats.shake > 0);
  for (let i = 0; i < 1000; i++) {
    fx.add({ type: "hit", damage: 4, x: 50, y: 50 });
    fx.add({ type: "destroy", radius: 42, x: 100, y: 100, elite: true });
  }
  assert.equal(fx.stats.particles, 180);
  assert.equal(fx.stats.labels, 24);
  assert.equal(fx.stats.rings, 12);
  const allocated = [fx.particles.length, fx.labels.length, fx.rings.length];
  fx.advance(1);
  for (let i = 0; i < 50; i++) fx.add({ type: "hit", damage: 2, x: 50, y: 50 });
  assert.deepEqual(
    [fx.particles.length, fx.labels.length, fx.rings.length],
    allocated,
  );
  fx.advance(1);
  assert.deepEqual(fx.stats, { particles: 0, labels: 0, rings: 0, shake: 0 });
  assert.ok(!("coins" in fx));
});
test("reduced effects suppress particles, rings, numbers and shake, including an existing burst", () => {
  const fx = new Effects();
  fx.add({ type: "damage", x: 10, y: 10 });
  assert.ok(fx.stats.shake > 0);
  fx.advance(0, true);
  assert.deepEqual(fx.stats, { particles: 0, labels: 0, rings: 0, shake: 0 });
  fx.add({ type: "hit", x: 2, y: 2, damage: 3 }, true);
  assert.equal(fx.stats.labels, 0);
  assert.deepEqual(fx.offset(true), { x: 0, y: 0 });
  let calls = 0;
  fx.draw(
    {
      save() {
        calls++;
      },
    },
    true,
  );
  assert.equal(calls, 0);
});

test("the core pickup cue finishes while the selection screen keeps BGM stopped", async () => {
  const { synth } = fakeAudio();
  synth.unlock();
  await Promise.resolve();
  synth.sync("playing");
  synth.sync("upgrade");
  synth.effect("core");
  assert.equal(synth.stats.voices, 1);
  synth.sync("upgrade");
  assert.equal(synth.stats.voices, 1);
  assert.equal(synth.stats.bgmPlaying, false);
  synth.sync("background");
  synth.effect("core");
  assert.equal(synth.stats.voices, 0);
  synth.dispose();
});
