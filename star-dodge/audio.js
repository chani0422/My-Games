/* Local Web Audio synthesis only. No samples, network, or autoplay bypass. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StarAudio = api;
})(globalThis, () => {
  "use strict";
  class Synth {
    constructor({
      contextFactory = () =>
        new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
      timers = globalThis,
    } = {}) {
      this.contextFactory = contextFactory;
      this.timers = timers;
      this.context = null;
      this.enabled = true;
      this.volume = 1;
      this.voices = new Set();
      this.maxVoices = 24;
      this.timer = null;
      this.state = "title";
      this.intense = false;
      this.beat = 0;
      this.nextBeat = 0;
      this.lastFX = {};
      this.scheduledTicks = 0;
    }
    unlock() {
      if (!this.enabled) return;
      try {
        if (!this.context) {
          this.context = this.contextFactory();
          this.master = this.context.createGain();
          this.master.gain.value = 0.9 * this.volume;
          this.master.connect(this.context.destination);
        }
        const resume =
          this.context.state === "suspended"
            ? this.context.resume()
            : Promise.resolve();
        Promise.resolve(resume)
          .then(() => this.sync(this.state, this.intense))
          .catch(() => {});
      } catch {}
    }
    setVolume(value) {
      this.volume = Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : 1;
      if (this.master) this.master.gain.value = 0.9 * this.volume;
    }
    setEnabled(value) {
      this.enabled = !!value;
      if (!this.enabled) this.stop();
    }
    sync(state, intense = false) {
      const previous = this.state;
      this.state = state;
      this.intense = intense;
      if (
        state === "upgrade" &&
        previous === "upgrade" &&
        this.enabled &&
        this.context?.state === "running"
      )
        return;
      if (
        !this.enabled ||
        !this.context ||
        this.context.state !== "running" ||
        !["title", "playing", "countdown", "result"].includes(state)
      ) {
        this.stop();
        return;
      }
      if (this.timer === null) {
        this.nextBeat = this.context.currentTime + 0.025;
        this.timer = this.timers.setInterval(() => this.schedule(), 80);
        this.schedule();
      }
    }
    tone(
      frequency,
      duration,
      volume,
      type = "sine",
      at = this.context?.currentTime,
      to = frequency,
      group = "sfx",
    ) {
      if (
        !this.enabled ||
        !this.context ||
        this.context.state !== "running" ||
        this.voices.size >= this.maxVoices
      )
        return false;
      // Leave room for the four music voices even in a dense meteor shower.
      if (
        group === "sfx" &&
        [...this.voices].filter((v) => v.group === "sfx").length >= 16
      )
        return false;
      let oscillator, gain, voice;
      try {
        oscillator = this.context.createOscillator();
        gain = this.context.createGain();
        voice = { oscillator, gain, group };
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, at);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, to),
          at + duration,
        );
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        oscillator.connect(gain);
        gain.connect(this.master);
        this.voices.add(voice);
        oscillator.onended = () => {
          this.voices.delete(voice);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(at);
        oscillator.stop(at + duration + 0.01);
        return true;
      } catch {
        if (voice) this.voices.delete(voice);
        try {
          oscillator?.disconnect();
          gain?.disconnect();
        } catch {}
        return false;
      }
    }
    schedule() {
      if (!this.context || this.context.state !== "running") return;
      const now = this.context.currentTime,
        step = 60 / 112 / 2;
      if (this.nextBeat < now - 0.15) this.nextBeat = now + 0.02;
      let budget = 4;
      while (this.nextBeat < now + 0.12 && budget-- > 0) {
        const chord = [48, 44, 46, 43][Math.floor(this.beat / 8) % 4],
          arp = [0, 7, 12, 15, 12, 7, 3, 7][this.beat % 8],
          at = this.nextBeat;
        const note = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
        if (this.beat % 2 === 0)
          this.tone(
            note(chord - 12),
            0.22,
            0.055,
            "triangle",
            at,
            note(chord - 12),
            "music",
          );
        this.tone(
          note(chord + 12 + arp),
          0.13,
          this.intense ? 0.036 : 0.022,
          this.intense ? "triangle" : "sine",
          at,
          note(chord + 12 + arp),
          "music",
        );
        if (this.intense && this.beat % 2 === 1)
          this.tone(
            note(chord + 24),
            0.1,
            0.012,
            "sine",
            at,
            note(chord + 24),
            "music",
          );
        this.beat++;
        this.scheduledTicks++;
        this.nextBeat += step;
      }
    }
    effect(type, data = {}) {
      if (
        !this.enabled ||
        !this.context ||
        this.context.state !== "running" ||
        this.state === "background" ||
        this.state === "paused" ||
        (this.state === "upgrade" && type !== "core" && type !== "choice")
      )
        return;
      const now = this.context.currentTime,
        minGap = type === "shot" ? 0.14 : type === "hit" ? 0.045 : 0.02;
      if (now - (this.lastFX[type] ?? -Infinity) < minGap) return;
      this.lastFX[type] = now;
      const pitch = Math.pow(
        2,
        Math.min(10, Math.max(0, (data.combo || 1) - 1)) / 18,
      );
      const tones = {
        shot: [680, 330, 0.035, 0.012, "sine"],
        hit: [230, 150, 0.04, 0.025, "triangle"],
        destroy: [
          (data.radius >= 32 ? 90 : 150) * pitch,
          35,
          data.radius >= 32 ? 0.22 : 0.12,
          0.045,
          "triangle",
        ],
        damage: [150, 40, 0.24, 0.065, "sawtooth"],
        shield: [650, 300, 0.13, 0.035, "sine"],
        core: [660, 1100, 0.18, 0.045, "sine"],
        choice: [440, 880, 0.16, 0.045, "triangle"],
        upgrade: [520, 1040, 0.17, 0.04, "sine"],
        gameover: [180, 35, 0.5, 0.05, "triangle"],
        clear: [660, 1320, 0.3, 0.05, "sine"],
        event: [220, 440, 0.25, 0.035, "triangle"],
        ui: [450, 620, 0.04, 0.025, "sine"],
      };
      const [from, to, len, volume, wave] = tones[type] || tones.ui;
      this.tone(from, len, volume, wave, now, to);
      if (type === "clear") {
        this.tone(830, 0.24, 0.03, "sine", now + 0.08);
        this.tone(990, 0.3, 0.03, "sine", now + 0.15);
      }
    }
    stop() {
      if (this.timer !== null) {
        this.timers.clearInterval(this.timer);
        this.timer = null;
      }
      for (const voice of this.voices) {
        try {
          voice.oscillator.stop();
          voice.oscillator.disconnect();
          voice.gain.disconnect();
        } catch {}
      }
      this.voices.clear();
    }
    get stats() {
      return {
        voices: this.voices.size,
        nodes: this.voices.size * 2 + (this.master ? 1 : 0),
        bgmPlaying: this.timer !== null,
        scheduledTicks: this.scheduledTicks,
      };
    }
    dispose() {
      this.stop();
      this.context?.close?.();
    }
  }
  return { Synth };
});
