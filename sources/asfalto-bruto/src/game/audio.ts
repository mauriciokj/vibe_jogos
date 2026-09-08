import type { GameEvent, BikeStyle } from './types';

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private engineGain?: GainNode;
  private engine?: OscillatorNode;
  private engineFilter?: BiquadFilterNode;
  private windGain?: GainNode;
  muted = false;
  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : .28; this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator(); this.engine.type = 'sawtooth';
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320; this.engineFilter = filter;
      this.engineGain = this.context.createGain(); this.engineGain.gain.value = 0;
      this.engine.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master); this.engine.start();
      const windBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
      const samples = windBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const wind = this.context.createBufferSource(); wind.buffer = windBuffer; wind.loop = true;
      const windFilter = this.context.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 1500; windFilter.Q.value = .35;
      this.windGain = this.context.createGain(); this.windGain.gain.value = 0;
      wind.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.master); wind.start();
    }
    await this.context.resume();
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : .28, this.context.currentTime, .03);
  }
  update(speed: number, running: boolean, police: boolean, time: number, style: BikeStyle = 'street') {
    if (!this.context || !this.engine || !this.engineGain) return;
    const rpm = speed % 15;
    const custom=style==='cruiser'||style==='chopper';
    const pitch=custom?.72:style==='sport'?1.2:style==='muscle'?.84:style==='supermoto'?1.08:1;
    this.engine.frequency.setTargetAtTime((35 + rpm * 4 + speed * .7) * pitch, this.context.currentTime, .06);
    this.engineGain.gain.setTargetAtTime(running ? (.07 + speed / 850) * (custom ? 1 + .09 * Math.sin(time * 22) : 1) : 0, this.context.currentTime, .08);
    this.engineFilter?.frequency.setTargetAtTime((260 + speed * 8) * pitch, this.context.currentTime, .1);
    this.windGain?.gain.setTargetAtTime(running ? Math.pow(Math.max(0, speed - 20) / 60, 2) * .16 : 0, this.context.currentTime, .15);
    if (police && running && Math.floor(time * 2) !== Math.floor((time - 1 / 60) * 2)) this.tone(Math.floor(time * 2) % 2 ? 630 : 810, .18, .05, 'sine');
  }
  tone(frequency: number, duration: number, volume = .2, type: OscillatorType = 'square') {
    const ctx = this.context; if (!ctx || !this.master || this.muted) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, ctx.currentTime); gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(); osc.stop(ctx.currentTime + duration);
  }
  private noise(duration: number, volume: number) {
    const ctx = this.context; if (!ctx || !this.master || this.muted) return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Audio noise has no influence on the simulation or its seeded RNG.
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const gain = ctx.createGain(); gain.gain.value = volume; source.connect(gain); gain.connect(this.master); source.start();
  }
  event(event: GameEvent) {
    if (event.type === 'horn') { this.tone(370,.4,.14,'sawtooth');this.tone(465,.4,.1,'square'); }
    if (event.type === 'nitro') { this.noise(.5,.17);this.tone(185,.3,.08,'triangle'); }
    if (event.type === 'hit') { this.noise(.1, .38); this.tone(90, .1, .3, 'triangle'); }
    if (event.type === 'crash') this.noise(.45, .42);
    if (event.type === 'attack') this.noise(.07, .1);
    if (event.type === 'pass') this.tone(550, .09, .08, 'sine');
    if (event.type === 'steal') this.tone(980, .25, .12, 'triangle');
    if (event.type === 'finish') { this.tone(440, .5, .12, 'triangle'); this.tone(660, .6, .1, 'triangle'); }
  }
}
