import type { GameEvent, BikeStyle, Rider, RaceState } from './types';
import { roadsideBarrier } from './guardrails';

// Physics already contains the bike at this boundary. Read its presented pose
// so the sound also responds immediately to predicted multiplayer movement.
export function guardRailSoundSide(trackId: string, rider: Rider) {
  if(rider.crash || rider.out || rider.finishedAt!==null || rider.speed<=1)return 0;
  const side=Math.sign(rider.x);
  const barrier=roadsideBarrier(trackId,side,rider.z);
  return barrier && Math.abs(rider.x)>=barrier.limit-.025 ? side : 0;
}

// Stable through predicted frames and repeated online snapshots.
export function jumpSoundKey(rider: Rider) {
  return (rider.jumpTime ?? 0)>0 && rider.jumpTarget && !rider.crash && !rider.out && rider.finishedAt===null
    ? `${rider.id}:${rider.wheeliesLeft ?? 3}:${rider.jumpTarget}` : '';
}

export function jumpSoundMaterial(state: RaceState, rider: Rider): 'metal'|'wood'|'earth' {
  const kind=state.obstacles.find(o=>o.id===rider.jumpTarget)?.kind;
  return kind==='dirtRamp'?'earth':kind==='woodRamp'||kind==='fallenTree'?'wood':'metal';
}

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private engineGain?: GainNode;
  private engine?: OscillatorNode;
  private engineFilter?: BiquadFilterNode;
  private windGain?: GainNode;
  private scrapeGain?: GainNode;
  private scrapeFilter?: BiquadFilterNode;
  private scrapeRing?: BiquadFilterNode;
  private lastJumpKey = '';
  private lastRailSide = 0;
  private lastRailContactAt = -Infinity;
  muted = false;
  private recoveryStep=-1;
  resetRace(currentJump = '', currentRailSide = 0) {
    this.lastJumpKey=currentJump;this.lastRailSide=currentRailSide;this.lastRailContactAt=-Infinity;
    if(this.context)this.scrapeGain?.gain.setTargetAtTime(0,this.context.currentTime,.035);
  }
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
      // One reusable loop, shaped into two metallic bands. No per-frame sources.
      const scrape=this.context.createBufferSource();scrape.buffer=windBuffer;scrape.loop=true;
      this.scrapeFilter=this.context.createBiquadFilter();this.scrapeFilter.type='bandpass';this.scrapeFilter.frequency.value=1700;this.scrapeFilter.Q.value=1.6;
      this.scrapeRing=this.context.createBiquadFilter();this.scrapeRing.type='bandpass';this.scrapeRing.frequency.value=3100;this.scrapeRing.Q.value=4.5;
      this.scrapeGain=this.context.createGain();this.scrapeGain.gain.value=0;
      scrape.connect(this.scrapeFilter);scrape.connect(this.scrapeRing);
      this.scrapeFilter.connect(this.scrapeGain);this.scrapeRing.connect(this.scrapeGain);this.scrapeGain.connect(this.master);scrape.start();
    }
    await this.context.resume();
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : .28, this.context.currentTime, .03);
  }
  update(speed: number, running: boolean, police: boolean, time: number, style: BikeStyle = 'street', jumpKey = '', railSide = 0, material: 'metal' | 'earth' = 'metal', jumpMaterial: 'metal'|'wood'|'earth' = 'metal') {
    if (!this.context || !this.engine || !this.engineGain) return;
    if(jumpKey && jumpKey!==this.lastJumpKey) {
      this.lastJumpKey=jumpKey;
      if(running){if(jumpMaterial==='metal')this.metalImpact();else {this.noise(jumpMaterial==='earth'?.16:.06,.25);this.tone(jumpMaterial==='earth'?74:138,.12,.17,'triangle');}}
    }
    if(running) {
      if(railSide) {
        if(railSide!==this.lastRailSide){if(material==='earth')this.noise(.16,Math.min(.4,.15+speed/200));else this.metalImpact(Math.min(1,.3+speed/75),1.5);}
        this.lastRailSide=railSide;this.lastRailContactAt=time;
      } else if(time-this.lastRailContactAt>.15)this.lastRailSide=0;
    }
    const scraping=running && !!railSide && speed>1;
    const scrapeLevel=scraping ? Math.min(1,(speed-1)/8)*(.07+Math.min(speed/60,1)*.2) : 0;
    this.scrapeGain?.gain.setTargetAtTime(scrapeLevel,this.context.currentTime,scraping?.025:.035);
    this.scrapeFilter?.frequency.setTargetAtTime((material==='earth'?420:1700)+Math.min(speed,80)*(material==='earth'?6:15),this.context.currentTime,.08);
    this.scrapeRing?.frequency.setTargetAtTime((material==='earth'?950:3100)+Math.min(speed,80)*10,this.context.currentTime,.08);
    this.scrapeFilter?.Q.setTargetAtTime(material==='earth'?.45:1.6,this.context.currentTime,.08);
    this.scrapeRing?.Q.setTargetAtTime(material==='earth'?.6:4.5,this.context.currentTime,.08);
    const airborne=running && !!jumpKey;
    const rpm = speed % 15;
    const custom=style==='cruiser'||style==='chopper';
    const pitch=custom?.72:style==='sport'?1.2:style==='muscle'?.84:style==='supermoto'?1.08:1;
    const groundPitch=35 + rpm * 4 + speed * .7;
    // With no load on the rear wheel, revs flare independently of road speed.
    const enginePitch=airborne ? Math.max(groundPitch+100,235+speed*.9)+Math.sin(time*45)*7 : groundPitch;
    this.engine.frequency.setTargetAtTime(enginePitch * pitch, this.context.currentTime, airborne ? .045 : .06);
    this.engineGain.gain.setTargetAtTime(running && style!=='bicycle' ? (.07 + speed / 850) * (airborne ? 1.25 : 1) * (custom ? 1 + .09 * Math.sin(time * 22) : 1) : 0, this.context.currentTime, .08);
    this.engineFilter?.frequency.setTargetAtTime((260 + speed * 8 + (airborne ? 1500 : 0)) * pitch, this.context.currentTime, .1);
    this.windGain?.gain.setTargetAtTime(running ? Math.pow(Math.max(0, speed - 20) / 60, 2) * .16 : 0, this.context.currentTime, .15);
    if (police && running && Math.floor(time * 2) !== Math.floor((time - 1 / 60) * 2)) this.tone(Math.floor(time * 2) % 2 ? 630 : 810, .18, .05, 'sine');
  }
  updateRecovery(r:Rider,track:string){
    const f=r.recovery;if(!f){this.recoveryStep=-1;return;}
    if(!this.context)return;
    const moving=f.bikeVZ>1 || Math.abs(f.bikeVX)>1,level=moving?Math.min(.22,f.bikeVZ/150):0;
    this.scrapeGain?.gain.setTargetAtTime(level,this.context.currentTime,.05);
    if(f.phase==='walking'){
      const step=Math.floor(f.cycle/2);if(step!==this.recoveryStep){this.recoveryStep=step;this.noise(.045,track==='terra'?.04:.025);this.tone(step%2?92:76,.045,.025,'triangle');}
    }
  }
  tone(frequency: number, duration: number, volume = .2, type: OscillatorType = 'square') {
    const ctx = this.context; if (!ctx || !this.master || this.muted) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, ctx.currentTime); gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(); osc.stop(ctx.currentTime + duration);
  }
  private metalImpact(strength = 1, pitch = 1) {
    const ctx=this.context;if(!ctx || !this.master || this.muted)return;
    // Inharmonic, decaying resonances give the short impact a sheet-metal ring.
    this.noise(.045,.26*strength);
    for(const [frequency,volume,duration] of [[228,.20,.20],[403,.14,.32],[719,.10,.24],[1181,.055,.16]]) {
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine';osc.frequency.setValueAtTime(frequency*pitch,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency*pitch*.86,ctx.currentTime+duration);
      gain.gain.setValueAtTime(.001,ctx.currentTime);gain.gain.linearRampToValueAtTime(volume*strength,ctx.currentTime+.002);
      gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
      osc.connect(gain);gain.connect(this.master);osc.start();osc.stop(ctx.currentTime+duration);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
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
    if (event.type === 'explosion') { this.noise(.9,.6);this.metalImpact(1.2,.65);this.tone(48,.75,.4,'sine'); }
    if (event.type === 'crash') this.noise(.45, .42);
    if (event.type === 'attack') this.noise(.07, .1);
    if (event.type === 'pass') this.tone(550, .09, .08, 'sine');
    if (event.type === 'steal') this.tone(980, .25, .12, 'triangle');
    if (event.type === 'finish') { this.tone(440, .5, .12, 'triangle'); this.tone(660, .6, .1, 'triangle'); }
  }
}
