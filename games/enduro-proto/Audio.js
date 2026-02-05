export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.motorOsc = null;
    this.motorGain = null;
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new window.AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }

    if (!this.motorOsc) {
      this.motorOsc = this.ctx.createOscillator();
      this.motorOsc.type = 'sawtooth';
      this.motorOsc.frequency.value = 75;

      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.value = 0.05;

      this.motorOsc.connect(this.motorGain);
      this.motorGain.connect(this.master);
      this.motorOsc.start();
    }

    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  setMotor(level) {
    if (!this.motorGain || !this.motorOsc) return;
    const now = this.ctx.currentTime;
    this.motorGain.gain.linearRampToValueAtTime(0.04 + level * 0.06, now + 0.04);
    this.motorOsc.frequency.linearRampToValueAtTime(65 + level * 50, now + 0.05);
  }

  beep() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(560, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  crash() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }
}
