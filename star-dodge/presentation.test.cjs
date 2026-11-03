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
    gains: [],
    createGain() {
      const node = {
        outputs: [],
        gain: {
          ramps: [],
          value: 1,
          setValueAtTime() {},
          exponentialRampToValueAtTime(value, at) {
            this.ramps.push({ value, at });
          },
        },
        connect(target) {
          this.outputs.push(target);
        },
        disconnect() {
          this.outputs.length = 0;
        },
      };
      this.gains.push(node);
      return node;
    },
    createDynamicsCompressor() {
      return {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        outputs: [],
        connect(target) {
          this.outputs.push(target);
        },
        disconnect() {
          this.outputs.length = 0;
        },
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
  assert.ok(synth.stats.nodes <= 51);
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

test("master gain defaults to 1 and volume changes apply before and after audio unlock independently of SOUND", async () => {
  const { synth, timers } = fakeAudio();
  assert.equal(synth.volume, 1);
  synth.unlock();
  await Promise.resolve();
  assert.equal(synth.master.gain.value, 1);
  synth.setVolume(0.4);
  assert.equal(synth.master.gain.value, 0.4);
  assert.equal(synth.enabled, true);
  synth.setEnabled(false);
  synth.setVolume(0.25);
  assert.equal(synth.volume, 0.25);
  assert.equal(synth.master.gain.value, 0.25);
  assert.equal(synth.stats.voices, 0);
  assert.equal(timers.pending.size, 0);
  synth.setEnabled(true);
  synth.unlock();
  await Promise.resolve();
  assert.equal(synth.master.gain.value, 0.25);
  synth.setVolume(0);
  assert.equal(synth.enabled, true);
  assert.equal(synth.master.gain.value, 0);
  synth.dispose();
  const pending = fakeAudio().synth;
  pending.setVolume(0.7);
  assert.equal(
    pending.context,
    null,
    "volume alone must not create or unlock audio",
  );
  pending.unlock();
  await Promise.resolve();
  assert.equal(pending.master.gain.value, 0.7);
  pending.dispose();
});
test("audio volume clamps out-of-range inputs and rejects nonnumeric values without changing enabled state", () => {
  const { synth } = fakeAudio();
  synth.setEnabled(false);
  for (const [value, expected] of [
    [-1, 0],
    [2, 1],
    [0.375, 0.375],
    [NaN, 1],
    [Infinity, 1],
    ["0.5", 1],
    [null, 1],
  ]) {
    synth.setVolume(value);
    assert.equal(synth.volume, expected);
    assert.equal(synth.enabled, false);
    assert.equal(synth.context, null);
  }
  synth.dispose();
});

test("BGM and SFX voice gains both rise by 2.5 while a post-master compressor preserves headroom", async () => {
  const { synth, context } = fakeAudio();
  synth.unlock();
  await Promise.resolve();
  assert.deepEqual(synth.master.outputs, [synth.compressor]);
  assert.deepEqual(synth.compressor.outputs, [synth.output]);
  assert.equal(synth.compressor.threshold.value, -10);
  assert.equal(synth.compressor.ratio.value, 12);
  assert.equal(synth.compressor.attack.value, 0.003);
  assert.equal(synth.compressor.release.value, 0.16);
  assert.deepEqual(synth.output.outputs, [context.destination]);
  assert.equal(synth.output.gain.value, 0.6);
  const music = context.gains[2].gain.ramps[0].value;
  assert.equal(music, 0.055 * 2.5);
  const before = context.gains.length;
  synth.effect("ui");
  const ui = context.gains[before].gain.ramps[0].value;
  assert.equal(ui, 0.025 * 2.5);
  assert.ok(Math.abs(music / ui - 0.055 / 0.025) < 1e-12);
  synth.dispose();
  assert.equal(synth.master.outputs.length, 0);
  assert.equal(synth.compressor.outputs.length, 0);
});

test("the distinct two-layer nova cue is louder than destroy, rate-limited, bounded and silenced with SOUND OFF", async () => {
  const { synth, context } = fakeAudio();
  synth.unlock();
  await Promise.resolve();
  synth.sync("playing");
  const before = context.gains.length;
  synth.effect("destroy", { radius: 38 });
  const destroy = context.gains[before].gain.ramps[0].value;
  const voices = synth.stats.voices;
  synth.effect("explosion");
  assert.equal(synth.stats.voices, voices + 2);
  assert.ok(context.gains[before + 1].gain.ramps[0].value > destroy * 2);
  for (let i = 0; i < 100; i++) synth.effect("explosion");
  assert.equal(synth.stats.voices, voices + 2);
  context.currentTime += 0.11;
  synth.effect("explosion");
  assert.equal(synth.stats.voices, voices + 4);
  synth.setEnabled(false);
  assert.equal(synth.stats.voices, 0);
  synth.effect("explosion");
  assert.equal(synth.stats.voices, 0);
  synth.dispose();
});
