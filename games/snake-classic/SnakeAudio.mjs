export class SnakeAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
  }

  ensureContext() {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this.enabled = false;
      return null;
    }

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.05;
    this.masterGain.connect(this.ctx.destination);
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  beep({ frequency = 440, duration = 0.09, type = 'square', start = 0, volume = 0.6 } = {}) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playEat() {
    this.beep({ frequency: 760, duration: 0.07, type: 'square', volume: 0.5 });
    this.beep({ frequency: 980, duration: 0.08, type: 'square', start: 0.05, volume: 0.5 });
  }

  playDeath() {
    this.beep({ frequency: 340, duration: 0.12, type: 'sawtooth', volume: 0.55 });
    this.beep({ frequency: 240, duration: 0.15, type: 'sawtooth', start: 0.08, volume: 0.5 });
    this.beep({ frequency: 150, duration: 0.18, type: 'triangle', start: 0.15, volume: 0.45 });
  }
}
