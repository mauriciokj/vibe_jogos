import { drawTrackHazard } from './hazard-art';
import { obstacleShape, trafficDirection } from './hazards';
import { bankStrength } from './rural';
import { finishScene, type FinishPoliceArrival, type FinishPolicePose } from './finish';
import { finishBanner, finishFan, finishOfficer } from './finish-art';
import { roadHalf, trafficShape } from './road-profile';
import { farmSprite, tractorSprite, folkloreSprite, type FarmProp } from './rural-art';
import { GUARD_RAIL_X, hasGuardRail } from './guardrails';
import { portSprite, portHorizon, type PortProp } from './port-art';
import { PORT_WORKS } from './port';
import { jumpHeight, stunting } from './stunts';
import { conditionTrack, raceCondition, scenicAppearance, seaColors } from './conditions';
import { mermaidSprite } from './mermaid';
import { clamp, curveAt, elevationAt, getBike, getTrack } from './content';
import { nearestTarget } from './simulation';
import { bikeSprite, carSprite, truckSprite } from './sprites';
import { scenerySprite, visualHash } from './scenery';
import { getKneePad, kneeSupport } from './equipment';
import { TAUNTS } from './banter';
import type { RaceState, Rider, Track } from './types';

interface Point { x: number; y: number; scale: number; road: number; clip: number; }
interface RoadPoint { z: number; x: number; y: number; scale: number; worldX: number; clip: number; }
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 1280; private h = 720;
  private projectionWidth = 1280;
  private points: RoadPoint[] = [];
  private shake = 0;
  private localId = 'player';
  private winnerId: string | null = null;
  private finishPolice:FinishPolicePose|null=null;
  private pullback = 0;
  private cinematic = false;
  private centerX = 640;
  private player(state: RaceState) { return state.riders.find(r => r.id === this.localId) ?? state.riders[0]; }
  private focal = .9;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private camera = { z: 0, y: 0, x: 0, horizon: 0, trackId: 'costa' };
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const ratio = bounds.width / Math.max(1, bounds.height);
    this.w = Math.min(1600, Math.round(bounds.width));
    this.h = Math.round(this.w / ratio);
    this.projectionWidth = Math.max(this.w, this.h * 1.35);
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
  }
  hit() { this.shake = 7; }
  private polygon(coords: number[], fill: string) {
    const c = this.ctx; c.fillStyle = fill; c.beginPath();
    for (let i = 0; i < coords.length; i += 2) i === 0 ? c.moveTo(coords[i], coords[i + 1]) : c.lineTo(coords[i], coords[i + 1]);
    c.closePath(); c.fill();
  }
  private background(track: Track, z: number, state: RaceState) {
    const c = this.ctx, w = this.w, h = this.h;
    const horizon = this.camera.horizon - h * .02;
    const condition=raceCondition(state.condition), sea=seaColors(condition);
    const sky = c.createLinearGradient(0, 0, 0, horizon + 40);
    track.sky.forEach((col, i) => sky.addColorStop(i / 2, col));
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const parallax = Math.sin(z / 950) * 65;
    const sunX = w * .74 - parallax * .2;
    const sunY = h * .225;
    if(condition==='night') {
      c.fillStyle='#d7ead8';
      for(let i=0;i<70;i++) { const x=visualHash(i*39+7)*w,y=visualHash(i*51+3)*h*.3;c.globalAlpha=.35+visualHash(i)*.6;c.fillRect(x,y,i%6===0?2:1,1); }
      c.globalAlpha=1;
      const halo=c.createRadialGradient(sunX,sunY,0,sunX,sunY,h*.13);halo.addColorStop(0,'#9bbbd22a');halo.addColorStop(1,'#9bbbd200');c.fillStyle=halo;c.fillRect(sunX-h*.13,sunY-h*.13,h*.26,h*.26);
      c.fillStyle='#d8e4d7';c.beginPath();c.arc(sunX,sunY,h*.032,0,Math.PI*2);c.fill();
      c.fillStyle='#aebec1';for(let i=0;i<5;i++){c.beginPath();c.arc(sunX+(visualHash(i+20)-.5)*h*.038,sunY+(visualHash(i+40)-.5)*h*.038,h*.003,0,Math.PI*2);c.fill();}
    } else if(condition!=='rain') {
      const glow=c.createRadialGradient(sunX,sunY,h*.02,sunX,sunY,h*.24);
      glow.addColorStop(0,'#ffeecb50');glow.addColorStop(1,'#ffeecb00');c.fillStyle=glow;c.fillRect(sunX-h*.24,0,h*.48,h*.48);
      c.fillStyle=condition==='day'?'#fff7d8':'#ffe7b5';c.beginPath();c.arc(sunX,sunY,h*(condition==='day'?.042:.073),0,Math.PI*2);c.fill();
      if(condition==='sunset')for(let i=0;i<5;i++){c.fillStyle=track.sky[1];c.fillRect(sunX-h*.08,sunY+10+i*8,h*.16,1+i*.5);}
    }
    c.fillStyle=condition==='rain'?'#283f4d40':condition==='night'?'#91a9bc16':condition==='day'?'#f4fcf088':'#f8d4c44a';
    for(let i=0;i<7;i++) {
      const x=((i*293-parallax*.12)%(w+240))-100,y=h*(.09+(i%3)*.045);
      if(condition==='rain')continue;
      else {c.fillRect(x,y,95+i%4*31,3);c.fillRect(x+40,y+4,140,2);}
    }
    if(condition==='rain')for(let layer=0;layer<2;layer++) {
      const cloud=[0,0,w,0];
      for(let x=w;x>=-24;x-=24)cloud.push(x,h*(.1+layer*.065)+Math.sin(x*.006+layer*2)*h*.025+Math.sin(x*.017+layer)*h*.014);
      this.polygon(cloud,layer?'#314a5724':'#20394635');
    }
    if(track.theme==='port'){portHorizon(c,w,h,horizon,parallax,condition);return;}
    const mountains=condition==='night'?['#293952','#304559','#375559']:condition==='rain'?['#6b828e','#5e7884','#58777a']:condition==='day'?['#84acb7','#6b9b9b',track.theme==='desert'?'#b48b70':'#527e72']:['#827c97','#73768b',track.theme==='desert'?'#aa796f':'#667e7f'];
    for (let layer = 0; layer < 3; layer++) {
      const coords = [-50, horizon + 45];
      for (let x = -50; x <= w + 70; x += 16) {
        const p = x + parallax * (layer + 1);
        let mountain = (Math.sin(p * .006 + layer) * .45 + Math.sin(p * .012 + layer * 2) * .28 + Math.sin(p * .023) * .1 + .6);
        if (track.theme === 'coast') mountain *= clamp((x / w - .2) * 2, .07, 1);
        const y = horizon - mountain * (h * .14 - layer * h * .027) + layer * 13;
        coords.push(x, Math.round(y / 3) * 3);
      }
      coords.push(w + 70, horizon + 60);
      this.polygon(coords, mountains[layer]);
      // Light and shaded ridges add depth without covering the mountain silhouette.
      c.save(); c.beginPath();
      for (let i = 0; i < coords.length; i += 2) i ? c.lineTo(coords[i], coords[i + 1]) : c.moveTo(coords[i], coords[i + 1]);
      c.closePath(); c.clip();
      for (let i = 0; i < 12; i++) {
        const x = i * w / 9 - parallax * (layer + 1), y = horizon - h * .13;
        this.polygon([x, y, x + 25, horizon, x + w * .17, horizon, x + w * .025, y + 16], layer === 2 ? '#acaf9a20' : '#e8bdba16');
      }
      c.restore();
    }
    if (track.theme === 'coast') {
      c.fillStyle = sea.water; c.fillRect(0, horizon, w * .62, h * .21);
      c.fillStyle = sea.foam;
      for (let y = horizon + 4; y < h * .55; y += 9) { c.fillRect(0, y, w * (.44 + Math.sin(y * .03 + state.time*.3) * .06), 1); }
      c.fillStyle = sea.sand; c.fillRect(0, h * .53, w * .65, h * .15);
    }
  }
  private buildRoad(state: RaceState) {
    const player = this.player(state);
    const pace = this.reducedMotion ? 0 : clamp(player.speed / 70, 0, 1);
    // A low chase camera brings the passing asphalt closer. Widen the lens and
    // move forward together so acceleration doesn't shrink the player's bike.
    const blend=(from:number,to:number)=>from+(to-from)*this.pullback;
    this.focal = blend(.9 - pace * .2,.9);
    const followDistance = blend(12 - pace * 3.4,54);
    const camZ = player.z - followDistance;
    const height = blend(6.5 - pace * 1.7,12);
    const camY = elevationAt(player.z, state.trackId) + height;
    const road: RoadPoint[] = [];
    const segment = 3;
    const start = Math.floor(camZ / segment) * segment;
    let wx = 0, dx = 0;
    const slope = (elevationAt(player.z + 35, state.trackId) - elevationAt(player.z, state.trackId)) / 35;
    const vibration = this.reducedMotion ? 0 : Math.sin(player.z * .7) * pace * .55;
    const playerScale = this.focal * this.projectionWidth / (2 * followDistance);
    const horizon = blend(this.h * .8 - height * playerScale + slope * this.w * .25 + vibration,this.h*.3);
    const cameraX=blend(player.x*.6,0);
    this.centerX=this.w*(.5-(this.w>this.h?.17:0)*this.pullback);
    this.camera = { z: camZ, y: camY, x: cameraX, horizon, trackId: state.trackId };
    const nearZ = camZ + 1.01;
    const nearScale = this.focal / 1.01 * this.projectionWidth / 2;
    road.push({ z: nearZ, x: this.centerX - cameraX * nearScale, y: horizon - (elevationAt(nearZ, state.trackId) - camY) * nearScale, scale: nearScale, worldX: 0, clip: this.h });
    for (let i = 0; i < 520; i++) {
      const z = start + i * segment, dz = z - camZ;
      if (z <= nearZ) continue;
      const curve = curveAt(z, state.trackId);
      dx += curve * .0008 * segment;
      wx += dx * segment;
      const scale = this.focal / dz * this.projectionWidth / 2;
      const x = this.centerX + (wx - cameraX) * scale;
      const y = horizon - (elevationAt(z, state.trackId) - camY) * scale;
      road.push({ z, x, y, scale, worldX: wx, clip: this.h });
    }
    this.points = road;
  }
  private road(state: RaceState, track: Track) {
    const c = this.ctx, w = this.w, h = this.h;
    const points = this.points, condition=raceCondition(state.condition), sea=seaColors(condition);
    let maxY = h;
    // Near-to-far hill clipping recorded for both terrain and sprites.
    for (const p of points) { p.clip = maxY; maxY = Math.min(maxY, p.y); }
    for (let i = points.length - 2; i >= 0; i--) {
      const a = points[i], b = points[i + 1];
      if (a.y <= b.y || b.y >= a.clip || a.y < 0) continue;
      const alt = Math.floor(a.z / 12) % 2 === 0;
      const stripe = Math.floor(a.z / 3) % 2 === 0;
      const half=roadHalf(state.trackId),rural=track.theme==='rural';
      const aw = half * a.scale, bw = half * b.scale;
      c.save(); c.beginPath(); c.rect(0, 0, w, a.clip); c.clip();
      this.polygon([0, a.y, w, a.y, w, b.y, 0, b.y], track.land[alt ? 0 : 1]);
      if(rural && a.y-b.y>1.2)for(const side of [-1,1])for(let field=0;field<3;field++){
        const l=side*(12+field*8),r=side*(15+field*8);
        this.polygon([a.x+l*a.scale,a.y,a.x+r*a.scale,a.y,b.x+r*b.scale,b.y,b.x+l*b.scale,b.y],condition==='night'?'#303e3528':'#435a3120');
      }
      if (track.theme === 'coast') {
        this.polygon([0, a.y, a.x - aw * 2.7, a.y, b.x - bw * 2.7, b.y, 0, b.y], sea.water);
        this.polygon([a.x - aw * 2.7, a.y, a.x - aw * 2.2, a.y, b.x - bw * 2.2, b.y, b.x - bw * 2.7, b.y], sea.sand);
      }
      if(track.theme==='port'){
        this.polygon([0,a.y,a.x-aw*2,a.y,b.x-bw*2,b.y,0,b.y],sea.water);
        this.polygon([a.x-aw*2,a.y,a.x-aw*1.88,a.y,b.x-bw*1.88,b.y,b.x-bw*2,b.y],alt?'#bca06c':'#43545b');
      }
      this.polygon([a.x - aw * 1.13, a.y, a.x + aw * 1.13, a.y, b.x + bw * 1.13, b.y, b.x - bw * 1.13, b.y], rural?(condition==='night'?'#665640':condition==='rain'?'#775b43':'#a18a52'):condition==='night' ? '#636e6d' : alt ? '#c2b9a0' : '#bab39b');
      this.polygon([a.x - aw, a.y + 1, a.x + aw, a.y + 1, b.x + bw, b.y - .5, b.x - bw, b.y - .5], track.road[alt ? 0 : 1]);
      if(condition==='rain' && alt && !rural) {
        // Broad reflections follow the road surface, with no extra obstacles.
        for(const lane of [-3.3,3.3])this.polygon([a.x+(lane-1)*a.scale,a.y,a.x+(lane+.6)*a.scale,a.y,b.x+(lane+.6)*b.scale,b.y,b.x+(lane-1)*b.scale,b.y],'#b9d2d51a');
      }
      // Fine aggregate, patches and lane wear are anchored to the road in world space.
      const row = Math.floor(a.z / 3);
      if (a.scale > 1 && b.y < h && a.y > h * .42) {
        for (let dot = 0; dot < 18; dot++) {
          const hash = visualHash(row * 97 + dot * 17);
          const mix = visualHash(row * 53 + dot);
          const scale = b.scale + (a.scale - b.scale) * mix;
          const x = b.x + (a.x - b.x) * mix + (hash * half * 1.8 - half * .9) * scale;
          const y = b.y + (a.y - b.y) * mix;
          const exposure = this.reducedMotion ? 0 : this.player(state).speed * .012;
          const distance = this.focal * this.projectionWidth / (2 * scale);
          const trail = exposure / (distance + exposure);
          c.strokeStyle = dot % 3 ? '#c7c6af30' : '#121e2640';
          c.lineWidth = Math.max(1, scale * .028);
          c.beginPath(); c.moveTo(x, y);
          c.lineTo(x - (x - this.w / 2) * trail, y - (y - this.camera.horizon) * trail - .5);
          c.stroke();
        }
        if (row % 11 === 0) {
          const x = (visualHash(row) * half * 1.14 - half * .57) * a.scale + a.x;
          c.strokeStyle = '#202e3140'; c.lineWidth = Math.max(.5, a.scale * .015);
          c.beginPath(); c.moveTo(x, a.y); c.lineTo(x - a.scale * .25, a.y - (a.y - b.y) * .4); c.lineTo(x + a.scale * .16, b.y); c.stroke();
        }
      }
      if(rural) {
        // Two worn wheel paths per direction; no painted four-lane highway.
        for(const lane of [-2.1,2.1])for(const wheel of [-.7,.7]){
          const l=lane+wheel-.17,r=lane+wheel+.17;
          this.polygon([a.x+l*a.scale,a.y,a.x+r*a.scale,a.y,b.x+r*b.scale,b.y,b.x+l*b.scale,b.y],condition==='rain'?'#362e2522':'#efd0a02c');
        }
        if(condition==='rain' && Math.floor(a.z/33)%4===1){
          const lane=Math.floor(a.z/132)%2?-2.9:2.9;
          this.polygon([a.x+(lane-.5)*a.scale,a.y,a.x+(lane+.5)*a.scale,a.y,b.x+(lane+.5)*b.scale,b.y,b.x+(lane-.5)*b.scale,b.y],'#b6bab03a');
        }
        for(const side of [-1,1]){
          const sa=bankStrength(a.z,side),sb=bankStrength(b.z,side);if(!sa&&!sb)continue;
          const ax=side*(half+.75+(1-sa)*3.5),bx=side*(half+.75+(1-sb)*3.5);
          const ah=sa*(3.1+Math.sin(a.z/35)*.35),bh=sb*(3.1+Math.sin(b.z/35)*.35);
          const topA=a.x+(ax+side*1.6)*a.scale,topB=b.x+(bx+side*1.6)*b.scale;
          this.polygon([a.x+ax*a.scale,a.y,topA,a.y-ah*a.scale,topB,b.y-bh*b.scale,b.x+bx*b.scale,b.y],condition==='night'?'#65422f':condition==='rain'?'#794a32':alt?'#985638':'#9c593a');
          this.polygon([topA,a.y-ah*a.scale,a.x+(ax+side*3.7)*a.scale,a.y-ah*.7*a.scale,b.x+(bx+side*3.7)*b.scale,b.y-bh*.7*b.scale,topB,b.y-bh*b.scale],track.land[1]);
          if(a.scale>.45 && sa>.3){
            for(let pebble=0;pebble<3;pebble++){
              const level=.1+visualHash(row*13+pebble)*.7,x=a.x+(ax+side*1.6*level)*a.scale,y=a.y-ah*level*a.scale;
              c.fillStyle=pebble%2?'#d69b6855':'#573a2877';c.beginPath();c.ellipse(x,y,a.scale*(.08+visualHash(row)*.09),a.scale*.045,.3,0,Math.PI*2);c.fill();
            }
            if(row%4===0){c.strokeStyle='#503e2b88';c.lineWidth=Math.max(.6,a.scale*.024);c.beginPath();c.moveTo(topA,a.y-ah*a.scale);c.lineTo(topA-side*a.scale*.45,a.y-ah*a.scale*.73);c.lineTo(topA-side*a.scale*.35,a.y-ah*a.scale*.52);c.stroke();}
          }
          c.strokeStyle=condition==='night'?'#677c50':'#a7a458';c.lineWidth=Math.max(.7,a.scale*.045);c.beginPath();c.moveTo(topA,a.y-ah*a.scale);c.lineTo(topB,b.y-bh*b.scale);c.stroke();
        }
      }
      if(!rural)for (const sign of [-1, 1]) {
        const curbA = aw * sign, curbB = bw * sign;
        this.polygon([a.x + curbA * 1.02,a.y,a.x + curbA * 1.065,a.y,b.x + curbB * 1.065,b.y,b.x + curbB * 1.02,b.y], track.theme==='port'?(stripe?'#d9b264':'#344951'):stripe ? '#dbd2b6' : '#b97864');
        const edge = .97 * sign;
        this.polygon([a.x + aw * edge - a.scale * .065, a.y, a.x + aw * edge + a.scale * .065, a.y, b.x + bw * edge + b.scale * .065, b.y, b.x + bw * edge - b.scale * .065, b.y], '#e1dac1');
        const center = .12 * sign;
        this.polygon([a.x + a.scale * (center - .035), a.y, a.x + a.scale * (center + .035), a.y, b.x + b.scale * (center + .035), b.y, b.x + b.scale * (center - .035), b.y], '#eac783');
        if (stripe) {
          const lane = .5 * sign;
          this.polygon([a.x + aw * lane - a.scale * .055, a.y, a.x + aw * lane + a.scale * .055, a.y, b.x + bw * lane + b.scale * .055, b.y, b.x + bw * lane - b.scale * .055, b.y], '#d8d2bb');
        }
      }
      if (a.z - this.player(state).z > 140) {
        c.fillStyle = `rgba(${condition==='night'?'34,57,76':condition==='rain'?'130,154,164':condition==='day'?'185,218,220':'203,183,165'},${clamp((a.z - this.player(state).z - 140) / 1600, 0, .35)})`;
        c.fillRect(0, b.y, w, a.y - b.y + .1);
      }
      if (Math.abs(a.z - track.distance) < 1.6) {
        for (let col = 0; col < 18; col++) for (let row = 0; row < 2; row++) {
          const l = col / 9 - 1, r = (col + 1) / 9 - 1;
          const t = row / 2, u = (row + 1) / 2;
          const ax = a.x + (b.x - a.x) * t, bx = a.x + (b.x - a.x) * u;
          const ap = aw + (bw - aw) * t, bp = aw + (bw - aw) * u;
          this.polygon([ax + ap * l, a.y + (b.y - a.y) * t, ax + ap * r, a.y + (b.y - a.y) * t, bx + bp * r, a.y + (b.y - a.y) * u, bx + bp * l, a.y + (b.y - a.y) * u], (col + row) % 2 ? '#242c30' : '#eeebd3');
        }
      }
      c.restore();
    }
  }
  private project(z: number, lateral: number): Point | null {
    const pts = this.points;
    if (!pts.length || z < pts[0].z || z > pts[pts.length - 1].z) return null;
    let lo = 0, hi = pts.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (pts[mid].z <= z) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[lo + 1], t = clamp((z - a.z) / (b.z - a.z), 0, 1);
    const scale = this.focal / Math.max(1, z - this.camera.z) * this.projectionWidth / 2;
    const wx = a.worldX + (b.worldX - a.worldX) * t;
    const road = this.centerX + (wx - this.camera.x) * scale;
    return { x: road + lateral * scale, y: this.camera.horizon - (elevationAt(z, this.camera.trackId) - this.camera.y) * scale, scale, road, clip: a.clip };
  }
  private scenery(state: RaceState, track: Track, z: number, i: number) {
    if(track.theme==='rural') {
      const side=i%2?1:-1;
      let kind:FarmProp='tree',lateral=side*(11+visualHash(i*17)*7),height=10,width=8.6;
      if(i%19===3){kind='house';lateral=side*25;height=9;width=13;}
      else if(i%23===7){kind='barn';lateral=side*28;height=12;width=17;}
      else if(i%29===11){kind='windmill';lateral=side*22;height=15;width=12;}
      else if(i%7===0){kind='hay';lateral=side*11;height=3.4;width=5;}
      else if(i%3!==0)return;
      const p=this.project(z,lateral);if(!p || p.y>p.clip+20 || p.scale<.16)return;
      const c=this.ctx;c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
      c.drawImage(farmSprite(kind,raceCondition(state.condition),i),p.x-p.scale*width/2,p.y-p.scale*height,p.scale*width,p.scale*height);c.restore();return;
    }
    if(track.theme==='port'){
      let kind:PortProp, lateral:number, width:number,height:number;
      if(i%17===0){kind='ship';lateral=-44;width=55;height=30;}
      else if(i%7===0){kind='crane';lateral=-26;width=25;height=22;}
      else if(i%7===3){kind='warehouse';lateral=24;width=23;height=16;}
      else if(i%3===0){kind='containers';lateral=i%2?-20:18;width=13;height=10;}
      else if(i%2===0){kind='lamp';lateral=8.6;width=10;height=9;}
      else return;
      const p=this.project(z,lateral);if(!p || p.y>p.clip+20 || p.scale<.16)return;
      const c=this.ctx;c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
      c.drawImage(portSprite(kind,raceCondition(state.condition),i),p.x-p.scale*width/2,p.y-p.scale*height,p.scale*width,p.scale*height);c.restore();return;
    }
    const side = i % 2 ? 1 : -1;
    const lateral = side * (9.2 + visualHash(i * 13) * 5);
    const p = this.project(z, lateral);
    if (!p || p.y > p.clip + 20 || p.y < 0 || p.scale < .16) return;
    const c = this.ctx;
    c.save(); c.beginPath(); c.rect(0, 0, this.w, p.clip); c.clip();
    const kind = i % 17 === 6 && side > 0 ? 'building' : track.theme === 'coast' ? 'palm' : track.theme === 'mountain' ? 'pine' : 'cactus';
    const height = p.scale * (kind === 'palm' ? 13.5 : kind === 'pine' ? 12 : kind === 'building' ? 7.5 : 7);
    const width = height * 192 / 224;
    c.fillStyle = '#263e3628'; c.beginPath(); c.ellipse(p.x + width * .15, p.y, width * .34, p.scale * .24, -.1, 0, Math.PI * 2); c.fill();
    c.drawImage(scenerySprite(kind, i), p.x - width / 2, p.y - height, width, height);
    c.restore();
  }
  private roadside(state: RaceState) {
    const c = this.ctx, pz = this.player(state).z;
    // Real projected points make markers sweep past faster as they approach the camera.
    if(state.trackId!=='terra')for (let i = Math.floor(pz / 8) + 100; i >= Math.floor((pz - 12) / 8); i--) {
      const z = i * 8;
      for (const side of [-1, 1]) {
        const p = this.project(z, side * GUARD_RAIL_X); if (!p || p.y > p.clip + 2 || p.y < 0) continue;
        const next = this.project(z + 8, side * GUARD_RAIL_X);
        if (next && hasGuardRail(state.trackId,side)) {
          c.save(); c.beginPath(); c.rect(0, 0, this.w, p.clip); c.clip();
          this.polygon([p.x,p.y-p.scale*.65,p.x,p.y-p.scale*.92,next.x,next.y-next.scale*.92,next.x,next.y-next.scale*.65], '#a3aaa1');
          c.strokeStyle = '#e4dfc0'; c.lineWidth = Math.max(.5,p.scale*.025); c.beginPath(); c.moveTo(p.x,p.y-p.scale*.91); c.lineTo(next.x,next.y-next.scale*.91); c.stroke(); c.restore();
        }
        c.fillStyle = '#e3dfc7'; c.fillRect(p.x-p.scale*.055,p.y-p.scale*1.08,Math.max(1,p.scale*.11),p.scale*1.08);
        c.fillStyle = '#f0a372'; c.fillRect(p.x-p.scale*.055,p.y-p.scale*.96,Math.max(1,p.scale*.11),p.scale*.2);
      }
    }
    if(state.trackId==='terra') {
      const condition=raceCondition(state.condition);
      for(let i=Math.floor(pz/12)+65;i>=Math.floor((pz-12)/12);i--)for(const side of [-1,1]){
        const z=i*12;if(bankStrength(z,side)>0 || bankStrength(z+12,side)>0)continue;
        const p=this.project(z,side*6.7),q=this.project(z+12,side*6.7);if(!p || !q || p.y>p.clip+3)continue;
        c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
        c.fillStyle=condition==='night'?'#7b7760':'#9e8b63';c.fillRect(p.x-p.scale*.08,p.y-p.scale*1.4,Math.max(1,p.scale*.16),p.scale*1.4);
        for(const level of [.55,1.12]){c.strokeStyle=condition==='night'?'#9eab9277':'#596747aa';c.lineWidth=Math.max(.6,p.scale*.025);c.beginPath();c.moveTo(p.x,p.y-p.scale*level);c.lineTo(q.x,q.y-q.scale*level);c.stroke();}
        c.restore();
      }
      for(let z=430;z<7200;z+=1380){const p=this.project(z,5.9);if(!p || p.y>p.clip+3)continue;c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();c.drawImage(farmSprite('tractorSign',condition),p.x-p.scale*1.6,p.y-p.scale*3.7,p.scale*3.2,p.scale*3.7);c.restore();}
    }
    // Crop the transparent sprite padding: these are full-sized roadside shrubs,
    // close enough to cross the edge of the view as the player passes them.
    if(state.trackId!=='porto')for (let i = Math.floor(pz / 8) + 55; i >= Math.floor((pz - 12) / 8); i--) {
      for (const side of [-1, 1]) {
        if(state.trackId==='terra' && bankStrength(i*8+4,side)>0)continue;
        const p = this.project(i*8+4,side*(roadHalf(state.trackId)+1.1+visualHash(i*71+side)*2.5));
        if (!p || p.y > p.clip + 3 || p.scale < .7) continue;
        const kind = i%7===0 ? 'rock' : 'bush';
        const h = p.scale*(kind === 'rock' ? 1.3 : .85), w = h*(kind === 'rock' ? 2.2 : 3.1);
        c.save(); c.beginPath(); c.rect(0,0,this.w,p.clip); c.clip();
        c.drawImage(scenerySprite(kind,i),0,kind==='rock'?140:168,192,kind==='rock'?84:56,p.x-w/2,p.y-h,w,h);
        c.restore();
      }
    }
    if(state.trackId==='porto')for(const work of PORT_WORKS){
      const p=this.project(work.start-180,work.side*8.5);if(!p || p.y>p.clip+3)continue;
      c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
      c.drawImage(portSprite('works',raceCondition(state.condition)),p.x-p.scale*2.6,p.y-p.scale*4.6,p.scale*5.2,p.scale*4.6);c.restore();
    }
    // Curves are signposted ahead, using the actual track curvature.
    for (let i = Math.floor(pz/160); i < Math.floor(pz/160)+8; i++) {
      const z=i*160+45, curve=curveAt(z,state.trackId);
      if(Math.abs(curve)<.45) continue;
      const side=curve>0?-1:1, p=this.project(z,side*(roadHalf(state.trackId)+1.4));
      if(!p || p.y>p.clip+3) continue;
      c.save(); c.beginPath(); c.rect(0,0,this.w,p.clip);c.clip();
      c.fillStyle='#66746b';c.fillRect(p.x-p.scale*.055,p.y-p.scale*2.4,p.scale*.11,p.scale*2.4);
      c.fillStyle='#e6cc8c';c.fillRect(p.x-p.scale*.8,p.y-p.scale*3.6,p.scale*1.6,p.scale*1.35);
      const cx=p.x,cy=p.y-p.scale*2.9,s=p.scale*.45,d=curve>0?1:-1;
      c.strokeStyle='#293c3b';c.lineWidth=Math.max(1,p.scale*.16);c.beginPath();c.moveTo(cx-d*s*.6,cy-s*.7);c.lineTo(cx+d*s*.5,cy);c.lineTo(cx-d*s*.6,cy+s*.7);c.stroke();c.restore();
    }
  }
  private speedFlow(state: RaceState, menu: boolean) {
    const player = this.player(state);
    if (menu || this.reducedMotion || player.speed < 20) return;
    const c = this.ctx, pace = clamp((player.speed - 20) / 45, 0, 1);
    // Project the same roadside fleck at both ends of a short exposure. The
    // resulting trails follow bends, depend on real speed and leave actors clear.
    const first = Math.floor((player.z - 12) / 3);
    for (let i = first + 34; i >= first; i--) {
      for (const side of [-1, 1]) {
        const z = i * 3 + visualHash(i * 31) * 2;
        const x = side * (roadHalf(state.trackId)+1.2 + visualHash(i * 19 + side) * 4.5);
        const p = this.project(z, x), tail = this.project(z + player.speed * .035, x);
        if (!p || !tail || p.y > p.clip + 2 || p.y < this.camera.horizon || p.x < -120 || p.x > this.w + 120) continue;
        const alpha = pace * clamp((p.y - this.camera.horizon) / (this.h * .45), 0, 1) * .42;
        c.strokeStyle = `rgba(234,224,182,${alpha})`; c.lineWidth = Math.max(1, p.scale * .035);
        c.beginPath(); c.moveTo(tail.x, tail.y); c.lineTo(p.x, p.y); c.stroke();
      }
    }
    // Wind stays at the periphery; no blur over traffic or combat targets.
    const vanishing = this.project(player.z + 180, 0);
    if (!vanishing) return;
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1;
      const t = (visualHash(i * 43) + player.z / 24) % 1;
      const travel = .5 + t * .8;
      const dx = side * this.w * (.5 + visualHash(i * 13) * .15);
      const dy = this.h * (.12 + visualHash(i * 29) * .42);
      const x = vanishing.x + dx * travel, y = vanishing.y + dy * travel;
      if (Math.abs(x - this.w / 2) < this.w * .3) continue;
      const length = (.035 + pace * .09) * travel * travel;
      c.strokeStyle = `rgba(244,235,205,${Math.sin(t * Math.PI) * pace * pace * .24})`;
      c.lineWidth = 1 + pace;
      c.beginPath(); c.moveTo(x - dx * length, y - dy * length); c.lineTo(x, y); c.stroke();
    }
  }
  private rider(r: Rider, state: RaceState, targetId: string | undefined) {
    const p = this.project(r.z, r.x);
    if (!p || p.y < 0 || p.y > p.clip + 100) return;
    const c = this.ctx, player = r.id === this.localId;
    const support=kneeSupport(r,curveAt(r.z,state.trackId),state.trackId),kneeSide=support>.35 && r.attack?.kind!=='kick'?(r.kneeSide ?? 0):0;
    const leanAngle=r.lean*.65*(1-support)+support*(r.kneeSide ?? 0)*.59;
    let height = p.scale * 3.55;
    height = Math.min(height, this.h * .36);
    const width = height * 88 / 128;
    if (height < 3) return;
    c.save(); c.beginPath(); c.rect(0, 0, this.w, player ? this.h : p.clip); c.clip();
    c.fillStyle = '#15293670'; c.beginPath(); c.ellipse(p.x, p.y - 2, width * .4, height * .045, 0, 0, Math.PI * 2); c.fill();
    if (r.immune && Math.floor(state.time * 10) % 2) c.globalAlpha = .48;
    if(state.trackId==='terra' && r.speed>12 && !r.crash && !(r.jumpTime!>0)){
      const wet=raceCondition(state.condition)==='rain';c.fillStyle=wet?'#80684455':'#dbb87e35';
      for(let i=0;i<5;i++){const age=(r.z*.08+i*.21)%1;const size=height*(.025+age*.06);c.beginPath();c.ellipse(p.x+(i%2?1:-1)*width*(.16+age*.52),p.y-height*.03-age*height*.045,size,size*.3,0,0,Math.PI*2);c.fill();}
    }
    const lift=jumpHeight(r)*p.scale;
    c.translate(p.x, p.y-lift);
    if (r.crash) {
      c.rotate(1.25); c.translate(-height * .23, -width * .14);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f9cd8b' : '#d2b78d'; c.fillRect(-width * .8 + Math.sin(state.time * 13 + i) * width, -height * .2 - i * 3, 4, 4); }
    } else { c.rotate(leanAngle); if (!this.reducedMotion) c.translate(0, Math.sin(r.z * 1.1) * Math.min(1, r.speed / 50) * height * .003); }
    const struck=this.finishPolice?.hit && this.finishPolice.targetId===r.id;
    const parked=this.finishPolice?.id===r.id && this.finishPolice.phase!=='arriving';
    if(struck)c.rotate(this.finishPolice!.side*.14);
    const champion=r.id===this.winnerId && r.finishedAt!==null && !struck;
    const pose = parked?'parked':champion?'celebrate':r.attack && r.attack.age > .08 ? r.attack.kind : 'ride';
    const frame=parked?Math.floor(state.time*8)%2:champion?(this.reducedMotion?0:Math.floor(state.time*3)%3):r.speed > 8 ? Math.floor(r.z * 1.6) % 3 : 0;
    c.drawImage(bikeSprite(r.color, pose, r.attack?.side ?? 1, r.profile === 'police', frame, getBike(r.bikeId).style,getKneePad(r.kneePadId)?.color,kneeSide,r.weaponId,stunting(r),r.helmetId,r.helmetColorId), -width / 2, -height, width, height);
    if(struck){c.strokeStyle='#ffeaa0';c.lineWidth=Math.max(1,height*.018);for(let i=0;i<5;i++){const a=i*Math.PI*.4;c.beginPath();c.moveTo(Math.cos(a)*width*.3,-height*.77+Math.sin(a)*width*.3);c.lineTo(Math.cos(a)*width*.48,-height*.77+Math.sin(a)*width*.48);c.stroke();}}
    if((r.nitroTime ?? 0)>0 && !r.crash){
      for(const side of [-1,1]){
        const x=side*width*.26,flicker=.8+Math.sin(state.time*45)*.2;
        c.fillStyle='#73dffe';c.beginPath();c.moveTo(x-width*.04,-height*.14);c.lineTo(x+width*.04,-height*.14);c.lineTo(x,height*.09*flicker);c.closePath();c.fill();
        c.fillStyle='#f1ffdf';c.fillRect(x-width*.015,-height*.14,width*.03,height*.09);
      }
    }
    c.restore();
    if(champion && height>30){
      c.save();c.textAlign='center';c.font="700 12px 'Barlow Condensed',sans-serif";const text=player?'VOCÊ VENCEU':`${r.name} VENCEU`,tw=c.measureText(text).width,y=p.y-height-8;
      c.fillStyle='#172c32d9';c.fillRect(p.x-tw/2-5,y-12,tw+10,17);c.fillStyle='#deff70';c.fillText(text,p.x,y);c.restore();
    }
    if (!this.cinematic && !champion && !player && height > 58 && !r.crash && p.y < p.clip + 5) {
      c.save();
      c.font = `600 ${clamp(height * .13, 10, 13)}px monospace`; c.textAlign = 'center';
      const y = p.y - lift - height - 12;
      c.fillStyle = '#172c32b8'; const tw = c.measureText(r.name).width; c.fillRect(p.x - tw / 2 - 7, y - 13, tw + 14, 19);
      c.fillStyle = targetId === r.id ? '#dfff71' : '#f4edd8'; c.fillText(r.name, p.x, y);
      if (r.health < 98) { c.fillStyle = '#253e42'; c.fillRect(p.x - 21, y + 9, 42, 3); c.fillStyle = r.health < 30 ? '#ff826b' : r.color; c.fillRect(p.x - 21, y + 9, 42 * r.health / 100, 3); }
      if (r.attack) { c.fillStyle = '#ff9b65'; c.font = 'bold 20px monospace'; c.fillText('!', p.x, y - 23); }
      if (targetId === r.id) { c.strokeStyle = '#e2ff7b'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x - width * .5, p.y - height * .5 - 8); c.lineTo(p.x - width * .5 - 7, p.y - height * .5); c.lineTo(p.x - width * .5, p.y - height * .5 + 8); c.stroke(); }
      c.restore();
    }
    if(!this.cinematic && r.speech && r.speech.until>state.time && !r.crash && !r.out && height>40) {
      const text=TAUNTS[r.speech.index];if(!text)return;
      c.save();c.font=`600 ${player?13:11}px 'Barlow',sans-serif`;c.textAlign='center';c.textBaseline='middle';
      const headX=p.x+Math.sin(leanAngle)*height*.9,headY=p.y-lift-Math.cos(leanAngle)*height;
      const bw=c.measureText(text).width+24,bh=29,bx=clamp(headX-bw/2,8,this.w-bw-8),by=Math.max(12,headY-42);
      c.fillStyle='#f0f1ddec';c.strokeStyle='#2b4d4e';c.lineWidth=1.5;c.beginPath();c.roundRect(bx,by,bw,bh,7);c.fill();c.stroke();
      const tip=clamp(headX,bx+12,bx+bw-12);c.beginPath();c.moveTo(tip-5,by+bh-1);c.lineTo(tip,by+bh+7);c.lineTo(tip+5,by+bh-1);c.fill();
      c.fillStyle='#183036';c.fillText(text,bx+bw/2,by+bh/2);c.restore();
    }
  }
  private atmosphere(state: RaceState) {
    const condition=raceCondition(state.condition),c=this.ctx,w=this.w,h=this.h;
    if(condition==='night') {
      c.fillStyle='#08182e24';c.fillRect(0,0,w,h);
      // Project a headlight pool entirely inside the roadway.
      const me=this.player(state),a=this.project(me.z+4,me.x),b=this.project(me.z+95,me.x);
      if(a&&b) {
        const glow=c.createLinearGradient(0,b.y,0,a.y);glow.addColorStop(0,'#d5eac500');glow.addColorStop(.7,'#d5eac524');glow.addColorStop(1,'#d5eac500');
        c.save();c.beginPath();c.moveTo(a.x-2.5*a.scale,a.y);c.lineTo(b.x-3*b.scale,b.y);c.lineTo(b.x+3*b.scale,b.y);c.lineTo(a.x+2.5*a.scale,a.y);c.closePath();c.fillStyle=glow;c.fill();c.restore();
      }
    }
    if(condition!=='rain')return;
    const time=this.reducedMotion?0:state.time,pace=this.player(state).speed/70;
    c.strokeStyle='#deedf66b';c.lineWidth=1;
    c.beginPath();
    for(let i=0;i<(this.reducedMotion?35:100);i++) {
      const x=(visualHash(i*79+1)*w-time*(30+pace*28)+w*1000)%w;
      const y=(visualHash(i*47+5)*h+time*(340+visualHash(i)*260))%h;
      const len=6+visualHash(i*7)*15;c.moveTo(x,y);c.lineTo(x-3-pace*4,y+len);
    }
    c.stroke();
    // Small splashes on the visible shoulder; bounded work regardless of speed.
    c.strokeStyle='#d2e8e946';c.beginPath();
    for(let i=0;i<18;i++){const age=(time*1.7+visualHash(i*13))%1,x=visualHash(i*91)*w,y=h*(.6+visualHash(i*51)*.35);c.moveTo(x-age*4,y);c.lineTo(x+age*4,y);}
    c.stroke();
  }
  private finishArea(state: RaceState, entities: {z:number;draw:()=>void}[]) {
    const length=getTrack(state.trackId).distance,half=roadHalf(state.trackId),c=this.ctx,condition=raceCondition(state.condition);
    if(this.camera.z<length-1500 || this.camera.z>length+80)return;
    for(const side of [-1,1]){
      for(let i=0;i<2;i++){
        const z=length+10+i*25,x=side*(half+4.5);
        entities.push({z,draw:()=>{
          const p=this.project(z,x);if(!p || p.y>p.clip+4)return;
          c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();c.fillStyle='#10252c70';c.beginPath();c.ellipse(p.x,p.y,p.scale*2.3,p.scale*.4,0,0,Math.PI*2);c.fill();
          c.drawImage(carSprite(side>0?(i?'#679d9d':'#d97453'):(i?'#ddd5b9':'#aabcca'),true,i===1),p.x-p.scale*2.1,p.y-p.scale*3.4,p.scale*4.2,p.scale*3.4);c.restore();
        }});
      }
      for(let i=0;i<9;i++){
        const z=length-5+i*5,x=side*(half+1.35+(i%3)*.7),index=i+(side>0?3:0);
        entities.push({z,draw:()=>{
          const p=this.project(z,x);if(!p || p.y>p.clip+3)return;
          const frame=this.reducedMotion?0:Math.floor(state.time*4+i*.7)%3;
          const h=p.scale*2.6,w=h*36/56;c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
          c.drawImage(finishFan(index,!!this.winnerId,frame,condition),p.x-w/2,p.y-h,w,h);c.restore();
        }});
      }
    }
    entities.push({z:length,draw:()=>{
      const p=this.project(length,0);if(!p || p.y>p.clip+4)return;
      const left=p.road-(half+.8)*p.scale,width=(half*2+1.6)*p.scale,gantryHeight=14.5,top=p.y-gantryHeight*p.scale;
      c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
      for(const x of [left,left+width-.22*p.scale]){
        c.fillStyle='#293e46';c.fillRect(x,top,.22*p.scale,gantryHeight*p.scale);c.fillStyle='#d4d7bc';c.fillRect(x,top,.07*p.scale,gantryHeight*p.scale);
      }
      c.drawImage(finishBanner(),left,top,width,p.scale*2.1);
      if(condition==='night' || condition==='rain')for(let i=0;i<10;i++){
        c.fillStyle=i%2?'#deff70':'#fff0cb';c.beginPath();c.arc(left+width*(i+.5)/10,top+2.2*p.scale,Math.max(1,.055*p.scale),0,Math.PI*2);c.fill();
      }
      c.restore();
    }});
  }
  render(state: RaceState, menu = false, localId = 'player', finishElapsed: number | null = null, officer?:FinishPoliceArrival|null) {
    this.localId = localId;
    this.cinematic=!menu && finishElapsed!==null;
    const finish=finishScene(state,localId,menu?null:finishElapsed,officer);
    this.finishPolice=finish.police;
    this.winnerId=menu?null:finish.winnerId;this.pullback=menu?0:this.reducedMotion&&finishElapsed!==null?1:finish.pullback;state=finish.state;
    const c = this.ctx, track = conditionTrack(getTrack(state.trackId),state.condition), player = this.player(state);
    c.save();
    if (this.shake > .1 && !this.reducedMotion) { c.translate(this.w / 2, this.h / 2); c.scale(1.016, 1.016); c.translate(-this.w / 2, -this.h / 2); c.translate(Math.sin(state.tick * 8) * this.shake, Math.cos(state.tick * 7) * this.shake * .6); this.shake *= .83; }
    this.buildRoad(state);
    this.background(track, player.z, state);
    this.road(state, track); this.roadside(state);
    this.speedFlow(state, menu);
    const entities: { z: number; draw: () => void }[] = [];
    const first = Math.floor(this.camera.z / 28);
    for (let i = first; i < first + 55; i++) if(Math.abs(i*28+12-track.distance)>65)entities.push({ z: i * 28 + 12, draw: () => this.scenery(state, track, i * 28 + 12, i) });
    if(!menu)this.finishArea(state,entities);
    const scenic=menu?null:scenicAppearance(state);
    for (const t of state.traffic) if (t.z > player.z - 12 && t.z < player.z + 1900) entities.push({ z: t.z, draw: () => {
      const p = this.project(t.z, t.x); if (!p || p.y > p.clip + 35) return;
      c.save(); c.beginPath(); c.rect(0, 0, this.w, p.clip); c.clip();
      const shape=trafficShape(state.trackId,t.kind),width=p.scale*shape.width,height=p.scale*shape.height;
      c.fillStyle = '#233a4055'; c.beginPath(); c.ellipse(p.x, p.y, width * .5, height * .1, 0, 0, Math.PI * 2); c.fill();
      c.drawImage(t.kind==='tractor'?tractorSprite(t.color,trafficDirection(t)<0,Math.floor(t.z*.8)%2):t.kind==='truck'?truckSprite(t.color,trafficDirection(t)<0,scenic?.kind==='truckPassenger'&&scenic.trafficId===t.id,Math.floor(state.time*4)%2):carSprite(t.color, trafficDirection(t)<0, t.kind === 'van'), p.x - width / 2, p.y - height, width, height); c.restore();
    } });
    for (const o of state.obstacles) if (o.z > player.z - 8 && o.z < player.z + 1700) entities.push({ z: o.z, draw: () => {
      const p = this.project(o.z, o.x); if (!p || p.y > p.clip + 4) return;
      c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
      if(drawTrackHazard(c,o,p.x,p.y,p.scale,state.time,this.reducedMotion)){}
      else if(o.kind==='gravel' || o.kind==='mud'){
        const s=p.scale;c.fillStyle=o.kind==='mud'?'#463d2ed0':'#cbba87';c.beginPath();c.ellipse(p.x,p.y,s*1.1,s*.36,-.12,0,Math.PI*2);c.fill();
        for(let i=0;i<12;i++){c.fillStyle=o.kind==='mud'?'#b3b19b66':i%2?'#8c805e':'#e7ce97';c.fillRect(p.x+(visualHash(i*7)-.5)*s*1.9,p.y+(visualHash(i*13)-.5)*s*.4,s*.12,s*.055);}
      } else if (o.kind === 'oil') {
        c.fillStyle = '#293642'; c.beginPath(); c.ellipse(p.x, p.y, p.scale * 1.1, p.scale * .3, -.1, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#71768b'; c.fillRect(p.x - p.scale * .5, p.y - 1, p.scale * .7, 2);
      } else if(o.kind==='cone'){
        const s=p.scale;this.polygon([p.x-s*.65,p.y,p.x+s*.65,p.y,p.x+s*.5,p.y-s*.2,p.x-s*.5,p.y-s*.2],'#34464b');
        this.polygon([p.x-s*.45,p.y-s*.15,p.x+s*.45,p.y-s*.15,p.x+s*.12,p.y-s*1.35,p.x-s*.12,p.y-s*1.35],'#fa9a50');
        this.polygon([p.x-s*.3,p.y-s*.65,p.x+s*.3,p.y-s*.65,p.x+s*.22,p.y-s*.96,p.x-s*.22,p.y-s*.96],'#f4e8c3');
      } else if(o.kind==='concrete'){
        const s=p.scale,half=obstacleShape(o).width/2;this.polygon([p.x-s*half,p.y,p.x+s*half,p.y,p.x+s*(half-.25),p.y-s*1.6,p.x-s*(half-.25),p.y-s*1.6],'#9ba7a0');
        c.fillStyle='#d9b566';c.fillRect(p.x-s*(half-.3),p.y-s*1.35,s*(half*2-.6),s*.5);
        for(let n=-half+.4;n<half-.5;n+=.45)this.polygon([p.x+s*n,p.y-s*.85,p.x+s*(n+.2),p.y-s*.85,p.x+s*(n+.42),p.y-s*1.35,p.x+s*(n+.22),p.y-s*1.35],'#384951');
      } else {
        c.fillStyle = '#e1bf8c'; c.fillRect(p.x - p.scale, p.y - p.scale * 1.2, p.scale * 2, p.scale * .8);
        c.fillStyle = '#d77956'; for (let n = -1; n < 1; n += .5) c.fillRect(p.x + p.scale * n, p.y - p.scale * 1.2, p.scale * .23, p.scale * .8);
        c.fillStyle = '#443f41'; c.fillRect(p.x - p.scale * .8, p.y - p.scale * .4, p.scale * .13, p.scale * .4); c.fillRect(p.x + p.scale * .7, p.y - p.scale * .4, p.scale * .13, p.scale * .4);
      }
      c.restore();
    } });
    if(scenic?.kind==='mermaid')entities.push({z:scenic.z,draw:()=>{
      const p=this.project(scenic.z,-25);if(!p || p.y>p.clip+8)return;
      const size=p.scale*6.2,condition=raceCondition(state.condition);
      c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();
      c.globalAlpha=clamp(scenic.age*2,0,1)*clamp((scenic.duration-scenic.age)*2,0,1);
      const bob=this.reducedMotion?0:Math.sin(scenic.age*2.4)*size*.015;
      if(condition==='night'){const g=c.createRadialGradient(p.x,p.y-size*.4,0,p.x,p.y-size*.4,size*.8);g.addColorStop(0,'#83f3e743');g.addColorStop(1,'#83f3e700');c.fillStyle=g;c.fillRect(p.x-size,p.y-size*1.3,size*2,size*2);}
      c.drawImage(mermaidSprite(condition,this.reducedMotion?0:Math.floor(scenic.age*2)%3),p.x-size*96/88/2,p.y-size+bob,size*96/88,size);c.restore();
    }});
    if(scenic?.kind==='saci' || scenic?.kind==='boitata')entities.push({z:scenic.z,draw:()=>{
      const p=this.project(scenic.z,7.8);if(!p || p.y>p.clip+8)return;
      const height=p.scale*(scenic.kind==='saci'?3.5:3.1),width=height*144/112;
      c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();c.globalAlpha=clamp(scenic.age*2,0,1)*clamp((scenic.duration-scenic.age)*2,0,1);
      if(scenic.kind==='boitata'){const glow=c.createRadialGradient(p.x,p.y-height*.35,0,p.x,p.y-height*.35,width);glow.addColorStop(0,'#faab483b');glow.addColorStop(1,'#faab4800');c.fillStyle=glow;c.fillRect(p.x-width,p.y-height-width,width*2,width*2);}
      c.drawImage(folkloreSprite(scenic.kind==='saci'?'saci':'boitata',this.reducedMotion?0:Math.floor(scenic.age*4)%3),p.x-width/2,p.y-height,width,height);c.restore();
    }});
    const target = nearestTarget(state, player, player.weapon ? 'weapon' : 'punch');
    for (const r of state.riders) if (r.z > this.camera.z && r.z < player.z + 1900) entities.push({ z: r.z, draw: () => this.rider(r, state, target?.id) });
    const officerPose=this.finishPolice;
    if(officerPose && officerPose.phase!=='arriving')entities.push({z:officerPose.z,draw:()=>{
      const p=this.project(officerPose.z,officerPose.x);if(!p || p.y>p.clip+4)return;
      const h=Math.min(p.scale*3,this.h*.31),w=h*60/84;
      c.save();c.beginPath();c.rect(0,0,this.w,p.clip);c.clip();c.fillStyle='#15293680';c.beginPath();c.ellipse(p.x,p.y,w*.22,h*.055,0,0,Math.PI*2);c.fill();
      c.drawImage(finishOfficer(officerPose.phase==='striking',this.reducedMotion?0:officerPose.frame,officerPose.side),p.x-w/2,p.y-h,w,h);c.restore();
    }});
    entities.sort((a, b) => b.z - a.z).forEach(e => e.draw());
    this.atmosphere(state);
    // Subtle raster texture, with a soft lower edge for the instruments.
    c.fillStyle = '#17243305'; for (let y = 0; y < this.h; y += 5) c.fillRect(0, y, this.w, 1);
    const vignette = c.createLinearGradient(0, this.h * .72, 0, this.h);
    vignette.addColorStop(0, '#101f2500'); vignette.addColorStop(1, menu ? '#111d2460' : '#111d24b0'); c.fillStyle = vignette; c.fillRect(0, this.h * .72, this.w, this.h * .28);
    c.restore();
  }
}
