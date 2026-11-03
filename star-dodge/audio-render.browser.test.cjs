/* Measure real Web Audio samples: relative RMS, limiter peaks, silence and caps. */
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const { chromium } = require("playwright");
const base = process.env.STAR_DODGE_URL || "http://127.0.0.1:8001/star-dodge/";
const previous = execFileSync("git", ["show", "84dea14:star-dodge/audio.js"], {
  cwd: __dirname,
  encoding: "utf8",
});
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(base);
    const measurements = await page.evaluate(async (source) => {
      const oldModule = { exports: {} };
      new Function("module", source)(oldModule);
      async function render(Synth, kind, volume = 1) {
        const audio = new OfflineAudioContext(1, 48000 * 4, 48000);
        let time = 0,
          maxVoices = 0;
        const context = {
          state: "running",
          get currentTime() {
            return time;
          },
          destination: audio.destination,
          createGain: () => audio.createGain(),
          createDynamicsCompressor: () => audio.createDynamicsCompressor(),
          createOscillator() {
            const node = audio.createOscillator(),
              stop = node.stop.bind(node);
            node.stop = (at = time) => {
              node.endAt = at;
              stop(at);
            };
            return node;
          },
        };
        const synth = new Synth({
          contextFactory: () => context,
          timers: { setInterval: () => 1, clearInterval() {} },
        });
        synth.state = "paused";
        synth.setVolume(volume);
        if (kind === "off") synth.setEnabled(false);
        synth.unlock();
        await Promise.resolve();
        synth.state = "playing";
        synth.intense = kind === "intense";
        synth.nextBeat = 0.025;
        for (let frame = 0; frame < 200; frame++) {
          time = frame * 0.02;
          for (const voice of [...synth.voices])
            if (voice.oscillator.endAt <= time) synth.voices.delete(voice);
          if (["music", "intense", "mix"].includes(kind) && frame % 4 === 0)
            synth.schedule();
          if (kind === "sfx" && frame % 25 === 0)
            synth.effect(
              [
                "shot",
                "hit",
                "destroy",
                "damage",
                "shield",
                "core",
                "clear",
                "ui",
              ][frame / 25],
              { radius: 38 },
            );
          if (kind === "mix") {
            synth.effect("shot");
            synth.effect("hit");
            synth.effect("destroy", { radius: 38 });
            if (frame % 15 === 0) synth.effect("damage");
            if (frame % 10 === 0) synth.effect("explosion");
          }
          if (kind === "coherent" && frame % 25 === 0)
            for (let i = 0; i < 16; i++)
              synth.tone(150, 0.24, 0.11, "sawtooth", time, 40);
          if (kind === "off") synth.effect("explosion");
          maxVoices = Math.max(maxVoices, synth.voices.size);
        }
        const samples = (await audio.startRendering()).getChannelData(0);
        let peak = 0,
          energy = 0,
          clipped = 0;
        for (const x of samples) {
          peak = Math.max(peak, Math.abs(x));
          energy += x * x;
          if (Math.abs(x) >= 1) clipped++;
        }
        return {
          peak,
          rms: Math.sqrt(energy / samples.length),
          clipped,
          maxVoices,
        };
      }
      const data = { previous: {}, current: {} };
      for (const kind of ["music", "intense", "sfx", "mix", "coherent"])
        for (const [key, Synth] of [
          ["previous", oldModule.exports.Synth],
          ["current", StarAudio.Synth],
        ])
          data[key][kind] = await render(Synth, kind);
      data.current.zero = await render(StarAudio.Synth, "mix", 0);
      data.current.off = await render(StarAudio.Synth, "off");
      data.current.partial = await render(StarAudio.Synth, "music", 0.4);
      return data;
    }, previous);
    fs.mkdirSync("/workspace/artifacts/star-dodge-nova-audio", {
      recursive: true,
    });
    fs.writeFileSync(
      "/workspace/artifacts/star-dodge-nova-audio/audio-render.json",
      JSON.stringify(measurements, null, 2),
    );
    for (const kind of ["music", "intense", "sfx"]) {
      const ratio =
        measurements.current[kind].rms / measurements.previous[kind].rms;
      console.log(
        `${kind}: RMS ${ratio.toFixed(3)}x, peak ${measurements.current[kind].peak.toFixed(3)}`,
      );
      assert.ok(ratio >= 2 && ratio <= 3, `${kind}: RMS ratio ${ratio}`);
    }
    for (const value of Object.values(measurements.current)) {
      assert.equal(value.clipped, 0);
      assert.ok(value.peak < 1);
      assert.ok(value.maxVoices <= 24);
    }
    assert.equal(measurements.current.zero.peak, 0);
    assert.equal(measurements.current.off.peak, 0);
    assert.ok(
      Math.abs(
        measurements.current.partial.rms / measurements.current.music.rms - 0.4,
      ) < 0.01,
    );
    console.log(
      "PASS: real OfflineAudioContext renders 2–3x BGM/SFX RMS; dense mix and coherent 16-voice stress stay below clipping; zero/OFF are silent and the slider scales music correctly",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
