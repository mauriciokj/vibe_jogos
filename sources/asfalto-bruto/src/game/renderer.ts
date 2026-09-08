import { clamp, curveAt, elevationAt, getTrack } from './content';
import { nearestTarget, ROAD_HALF } from './simulation';
import { bikeSprite, carSprite } from './sprites';
import { scenerySprite, visualHash } from './scenery';
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
  private background(track: Track, z: number) {
    const c = this.ctx, w = this.w, h = this.h;
    const horizon = this.camera.horizon - h * .02;
    const sky = c.createLinearGradient(0, 0, 0, horizon + 40);
    track.sky.forEach((col, i) => sky.addColorStop(i / 2, col));
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const parallax = Math.sin(z / 950) * 65;
    const sunX = w * .74 - parallax * .2;
    const sunY = h * .225;
    const glow = c.createRadialGradient(sunX, sunY, h * .02, sunX, sunY, h * .24);
    glow.addColorStop(0, '#ffeecb50'); glow.addColorStop(1, '#ffeecb00');
    c.fillStyle = glow; c.fillRect(sunX - h * .24, 0, h * .48, h * .48);
    c.fillStyle = '#ffe7b5'; c.beginPath(); c.arc(sunX, sunY, h * .073, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = track.sky[1]; c.fillRect(sunX - h * .08, sunY + 10 + i * 8, h * .16, 1 + i * .5); }
    // Long cloud bands, then layered mountain silhouettes.
    c.fillStyle = '#f8d4c44a';
    for (let i = 0; i < 7; i++) {
      const x = ((i * 293 - parallax * .12) % (w + 240)) - 100;
      const y = h * (.09 + (i % 3) * .045);
      c.fillRect(x, y, 95 + i % 4 * 31, 3); c.fillRect(x + 40, y + 4, 140, 2);
    }
    for (let layer = 0; layer < 3; layer++) {
      const coords = [-50, horizon + 45];
      for (let x = -50; x <= w + 70; x += 16) {
        const p = x + parallax * (layer + 1);
        let mountain = (Math.sin(p * .006 + layer) * .45 + Math.sin(p * .012 + layer * 2) * .28 + Math.sin(p * .023) * .1 + .6);
        if (track.index === 0) mountain *= clamp((x / w - .2) * 2, .07, 1);
        const y = horizon - mountain * (h * .14 - layer * h * .027) + layer * 13;
        coords.push(x, Math.round(y / 3) * 3);
      }
      coords.push(w + 70, horizon + 60);
      this.polygon(coords, ['#827c97', '#73768b', track.index === 2 ? '#aa796f' : '#667e7f'][layer]);
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
    if (track.index === 0) {
      c.fillStyle = '#6d9da5'; c.fillRect(0, horizon, w * .62, h * .21);
      c.fillStyle = '#a6bec0';
      for (let y = horizon + 4; y < h * .55; y += 9) { c.fillRect(0, y, w * (.44 + Math.sin(y * .03) * .06), 1); }
      c.fillStyle = '#e4c3a1'; c.fillRect(0, h * .53, w * .65, h * .15);
    }
  }
  private buildRoad(state: RaceState) {
    const player = this.player(state);
    const pace = this.reducedMotion ? 0 : clamp(player.speed / 70, 0, 1);
    // A low chase camera brings the passing asphalt closer. Widen the lens and
    // move forward together so acceleration doesn't shrink the player's bike.
    this.focal = .9 - pace * .2;
    const followDistance = 12 - pace * 3.4;
    const camZ = player.z - followDistance;
    const height = 6.5 - pace * 1.7;
    const camY = elevationAt(player.z, state.trackId) + height;
    const road: RoadPoint[] = [];
    const segment = 3;
    const start = Math.floor(camZ / segment) * segment;
    let wx = 0, dx = 0;
    const slope = (elevationAt(player.z + 35, state.trackId) - elevationAt(player.z, state.trackId)) / 35;
    const vibration = this.reducedMotion ? 0 : Math.sin(player.z * .7) * pace * .55;
    const playerScale = this.focal * this.projectionWidth / (2 * followDistance);
    const horizon = this.h * .8 - height * playerScale + slope * this.w * .25 + vibration;
    this.camera = { z: camZ, y: camY, x: player.x * .6, horizon, trackId: state.trackId };
    const nearZ = camZ + 1.01;
    const nearScale = this.focal / 1.01 * this.projectionWidth / 2;
    road.push({ z: nearZ, x: this.w / 2 - player.x * .6 * nearScale, y: horizon - (elevationAt(nearZ, state.trackId) - camY) * nearScale, scale: nearScale, worldX: 0, clip: this.h });
    for (let i = 0; i < 520; i++) {
      const z = start + i * segment, dz = z - camZ;
      if (z <= nearZ) continue;
      const curve = curveAt(z, state.trackId);
      dx += curve * .0008 * segment;
      wx += dx * segment;
      const scale = this.focal / dz * this.projectionWidth / 2;
      const x = this.w / 2 + (wx - player.x * .6) * scale;
      const y = horizon - (elevationAt(z, state.trackId) - camY) * scale;
      road.push({ z, x, y, scale, worldX: wx, clip: this.h });
    }
    this.points = road;
  }
  private road(state: RaceState, track: Track) {
    const c = this.ctx, w = this.w, h = this.h;
    const points = this.points;
    let maxY = h;
    // Near-to-far hill clipping recorded for both terrain and sprites.
    for (const p of points) { p.clip = maxY; maxY = Math.min(maxY, p.y); }
    for (let i = points.length - 2; i >= 0; i--) {
      const a = points[i], b = points[i + 1];
      if (a.y <= b.y || b.y >= a.clip || a.y < 0) continue;
      const alt = Math.floor(a.z / 12) % 2 === 0;
      const stripe = Math.floor(a.z / 3) % 2 === 0;
      const aw = ROAD_HALF * a.scale, bw = ROAD_HALF * b.scale;
      c.save(); c.beginPath(); c.rect(0, 0, w, a.clip); c.clip();
      this.polygon([0, a.y, w, a.y, w, b.y, 0, b.y], track.land[alt ? 0 : 1]);
      if (track.index === 0) {
        this.polygon([0, a.y, a.x - aw * 2.7, a.y, b.x - bw * 2.7, b.y, 0, b.y], '#7aa4a4');
        this.polygon([a.x - aw * 2.7, a.y, a.x - aw * 2.2, a.y, b.x - bw * 2.2, b.y, b.x - bw * 2.7, b.y], '#d4bd95');
      }
      this.polygon([a.x - aw * 1.13, a.y, a.x + aw * 1.13, a.y, b.x + bw * 1.13, b.y, b.x - bw * 1.13, b.y], alt ? '#c2b9a0' : '#bab39b');
      this.polygon([a.x - aw, a.y + 1, a.x + aw, a.y + 1, b.x + bw, b.y - .5, b.x - bw, b.y - .5], track.road[alt ? 0 : 1]);
      // Fine aggregate, patches and lane wear are anchored to the road in world space.
      const row = Math.floor(a.z / 3);
      if (a.scale > 1 && b.y < h && a.y > h * .42) {
        for (let dot = 0; dot < 18; dot++) {
          const hash = visualHash(row * 97 + dot * 17);
          const mix = visualHash(row * 53 + dot);
          const scale = b.scale + (a.scale - b.scale) * mix;
          const x = b.x + (a.x - b.x) * mix + (hash * 12.6 - 6.3) * scale;
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
          const x = (visualHash(row) * 8 - 4) * a.scale + a.x;
          c.strokeStyle = '#202e3140'; c.lineWidth = Math.max(.5, a.scale * .015);
          c.beginPath(); c.moveTo(x, a.y); c.lineTo(x - a.scale * .25, a.y - (a.y - b.y) * .4); c.lineTo(x + a.scale * .16, b.y); c.stroke();
        }
      }
      for (const sign of [-1, 1]) {
        const curbA = aw * sign, curbB = bw * sign;
        this.polygon([a.x + curbA * 1.02,a.y,a.x + curbA * 1.065,a.y,b.x + curbB * 1.065,b.y,b.x + curbB * 1.02,b.y], stripe ? '#dbd2b6' : '#b97864');
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
        c.fillStyle = `rgba(203,183,165,${clamp((a.z - this.player(state).z - 140) / 1600, 0, .35)})`;
        c.fillRect(0, b.y, w, a.y - b.y + .1);
      }
      if (Math.abs(a.z - track.distance) < 18) {
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
    const road = this.w / 2 + (wx - this.camera.x) * scale;
    return { x: road + lateral * scale, y: this.camera.horizon - (elevationAt(z, this.camera.trackId) - this.camera.y) * scale, scale, road, clip: a.clip };
  }
  private scenery(state: RaceState, track: Track, z: number, i: number) {
    const side = i % 2 ? 1 : -1;
    const lateral = side * (9.2 + visualHash(i * 13) * 5);
    const p = this.project(z, lateral);
    if (!p || p.y > p.clip + 20 || p.y < 0 || p.scale < .16) return;
    const c = this.ctx;
    c.save(); c.beginPath(); c.rect(0, 0, this.w, p.clip); c.clip();
    const kind = i % 17 === 6 && side > 0 ? 'building' : track.index === 0 ? 'palm' : track.index === 1 ? 'pine' : 'cactus';
    const height = p.scale * (kind === 'palm' ? 13.5 : kind === 'pine' ? 12 : kind === 'building' ? 7.5 : 7);
    const width = height * 192 / 224;
    c.fillStyle = '#263e3628'; c.beginPath(); c.ellipse(p.x + width * .15, p.y, width * .34, p.scale * .24, -.1, 0, Math.PI * 2); c.fill();
    c.drawImage(scenerySprite(kind, i), p.x - width / 2, p.y - height, width, height);
    c.restore();
  }
  private roadside(state: RaceState) {
    const c = this.ctx, pz = this.player(state).z;
    // Real projected points make markers sweep past faster as they approach the camera.
    for (let i = Math.floor(pz / 8) + 100; i >= Math.floor((pz - 12) / 8); i--) {
      const z = i * 8;
      for (const side of [-1, 1]) {
        const p = this.project(z, side * 7.75); if (!p || p.y > p.clip + 2 || p.y < 0) continue;
        const next = this.project(z + 8, side * 7.75);
        if (next && (state.trackId === 'serra' || (state.trackId === 'costa' && side < 0))) {
          c.save(); c.beginPath(); c.rect(0, 0, this.w, p.clip); c.clip();
          this.polygon([p.x,p.y-p.scale*.65,p.x,p.y-p.scale*.92,next.x,next.y-next.scale*.92,next.x,next.y-next.scale*.65], '#a3aaa1');
          c.strokeStyle = '#e4dfc0'; c.lineWidth = Math.max(.5,p.scale*.025); c.beginPath(); c.moveTo(p.x,p.y-p.scale*.91); c.lineTo(next.x,next.y-next.scale*.91); c.stroke(); c.restore();
        }
        c.fillStyle = '#e3dfc7'; c.fillRect(p.x-p.scale*.055,p.y-p.scale*1.08,Math.max(1,p.scale*.11),p.scale*1.08);
        c.fillStyle = '#f0a372'; c.fillRect(p.x-p.scale*.055,p.y-p.scale*.96,Math.max(1,p.scale*.11),p.scale*.2);
      }
    }
    // Crop the transparent sprite padding: these are full-sized roadside shrubs,
    // close enough to cross the edge of the view as the player passes them.
    for (let i = Math.floor(pz / 8) + 55; i >= Math.floor((pz - 12) / 8); i--) {
      for (const side of [-1, 1]) {
        const p = this.project(i*8+4,side*(8.1+visualHash(i*71+side)*2.5));
        if (!p || p.y > p.clip + 3 || p.scale < .7) continue;
        const kind = i%7===0 ? 'rock' : 'bush';
        const h = p.scale*(kind === 'rock' ? 1.3 : .85), w = h*(kind === 'rock' ? 2.2 : 3.1);
        c.save(); c.beginPath(); c.rect(0,0,this.w,p.clip); c.clip();
        c.drawImage(scenerySprite(kind,i),0,kind==='rock'?140:168,192,kind==='rock'?84:56,p.x-w/2,p.y-h,w,h);
        c.restore();
      }
    }
    // Curves are signposted ahead, using the actual track curvature.
    for (let i = Math.floor(pz/160); i < Math.floor(pz/160)+8; i++) {
      const z=i*160+45, curve=curveAt(z,state.trackId);
      if(Math.abs(curve)<.45) continue;
      const side=curve>0?-1:1, p=this.project(z,side*8.4);
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
        const x = side * (8.2 + visualHash(i * 19 + side) * 4.5);
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
    let height = p.scale * 3.55;
    height = Math.min(height, this.h * .36);
    const width = height * 88 / 128;
    if (height < 3) return;
    c.save(); c.beginPath(); c.rect(0, 0, this.w, player ? this.h : p.clip); c.clip();
    c.fillStyle = '#15293670'; c.beginPath(); c.ellipse(p.x, p.y - 2, width * .4, height * .045, 0, 0, Math.PI * 2); c.fill();
    if (r.immune && Math.floor(state.time * 10) % 2) c.globalAlpha = .48;
    c.translate(p.x, p.y);
    if (r.crash) {
      c.rotate(1.25); c.translate(-height * .23, -width * .14);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f9cd8b' : '#d2b78d'; c.fillRect(-width * .8 + Math.sin(state.time * 13 + i) * width, -height * .2 - i * 3, 4, 4); }
    } else { c.rotate(r.lean * .65); if (!this.reducedMotion) c.translate(0, Math.sin(r.z * 1.1) * Math.min(1, r.speed / 50) * height * .003); }
    const pose = r.attack && r.attack.age > .08 ? r.attack.kind : 'ride';
    c.drawImage(bikeSprite(r.color, pose, r.attack?.side ?? 1, r.profile === 'police', r.speed > 8 ? Math.floor(r.z * 1.6) % 3 : 0), -width / 2, -height, width, height);
    c.restore();
    if (!player && height > 58 && !r.crash && p.y < p.clip + 5) {
      c.save();
      c.font = `600 ${clamp(height * .13, 10, 13)}px monospace`; c.textAlign = 'center';
      const y = p.y - height - 12;
      c.fillStyle = '#172c32b8'; const tw = c.measureText(r.name).width; c.fillRect(p.x - tw / 2 - 7, y - 13, tw + 14, 19);
      c.fillStyle = targetId === r.id ? '#dfff71' : '#f4edd8'; c.fillText(r.name, p.x, y);
      if (r.health < 98) { c.fillStyle = '#253e42'; c.fillRect(p.x - 21, y + 9, 42, 3); c.fillStyle = r.health < 30 ? '#ff826b' : r.color; c.fillRect(p.x - 21, y + 9, 42 * r.health / 100, 3); }
      if (r.attack) { c.fillStyle = '#ff9b65'; c.font = 'bold 20px monospace'; c.fillText('!', p.x, y - 23); }
      if (targetId === r.id) { c.strokeStyle = '#e2ff7b'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x - width * .5, p.y - height * .5 - 8); c.lineTo(p.x - width * .5 - 7, p.y - height * .5); c.lineTo(p.x - width * .5, p.y - height * .5 + 8); c.stroke(); }
      c.restore();
    }
  }
  render(state: RaceState, menu = false, localId = 'player') {
    this.localId = localId;
    const c = this.ctx, track = getTrack(state.trackId), player = this.player(state);
    c.save();
    if (this.shake > .1 && !this.reducedMotion) { c.translate(this.w / 2, this.h / 2); c.scale(1.016, 1.016); c.translate(-this.w / 2, -this.h / 2); c.translate(Math.sin(state.tick * 8) * this.shake, Math.cos(state.tick * 7) * this.shake * .6); this.shake *= .83; }
    this.buildRoad(state);
    this.background(track, player.z);
    this.road(state, track); this.roadside(state);
    this.speedFlow(state, menu);
    const entities: { z: number; draw: () => void }[] = [];
    const first = Math.floor((player.z - 12) / 28);
    for (let i = first; i < first + 55; i++) entities.push({ z: i * 28 + 12, draw: () => this.scenery(state, track, i * 28 + 12, i) });
    for (const t of state.traffic) if (t.z > player.z - 12 && t.z < player.z + 1900) entities.push({ z: t.z, draw: () => {
      const p = this.project(t.z, t.x); if (!p || p.y > p.clip + 35) return;
      c.save(); c.beginPath(); c.rect(0, 0, this.w, p.clip); c.clip();
      const width = p.scale * 3.7, height = width * .94;
      c.fillStyle = '#233a4055'; c.beginPath(); c.ellipse(p.x, p.y, width * .5, height * .1, 0, 0, Math.PI * 2); c.fill();
      c.drawImage(carSprite(t.color, t.speed < 0, t.kind === 'van'), p.x - width / 2, p.y - height, width, height); c.restore();
    } });
    for (const o of state.obstacles) if (o.z > player.z - 8 && o.z < player.z + 1700) entities.push({ z: o.z, draw: () => {
      const p = this.project(o.z, o.x); if (!p || p.y > p.clip + 4) return;
      if (o.kind === 'oil') {
        c.fillStyle = '#293642'; c.beginPath(); c.ellipse(p.x, p.y, p.scale * 1.1, p.scale * .3, -.1, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#71768b'; c.fillRect(p.x - p.scale * .5, p.y - 1, p.scale * .7, 2);
      } else {
        c.fillStyle = '#e1bf8c'; c.fillRect(p.x - p.scale, p.y - p.scale * 1.2, p.scale * 2, p.scale * .8);
        c.fillStyle = '#d77956'; for (let n = -1; n < 1; n += .5) c.fillRect(p.x + p.scale * n, p.y - p.scale * 1.2, p.scale * .23, p.scale * .8);
        c.fillStyle = '#443f41'; c.fillRect(p.x - p.scale * .8, p.y - p.scale * .4, p.scale * .13, p.scale * .4); c.fillRect(p.x + p.scale * .7, p.y - p.scale * .4, p.scale * .13, p.scale * .4);
      }
    } });
    const target = nearestTarget(state, player, player.weapon ? 'weapon' : 'punch');
    for (const r of state.riders) if (r.z > player.z - 14 && r.z < player.z + 1900) entities.push({ z: r.z, draw: () => this.rider(r, state, target?.id) });
    entities.sort((a, b) => b.z - a.z).forEach(e => e.draw());
    // Subtle raster texture, with a soft lower edge for the instruments.
    c.fillStyle = '#17243305'; for (let y = 0; y < this.h; y += 5) c.fillRect(0, y, this.w, 1);
    const vignette = c.createLinearGradient(0, this.h * .72, 0, this.h);
    vignette.addColorStop(0, '#101f2500'); vignette.addColorStop(1, menu ? '#111d2460' : '#111d24b0'); c.fillStyle = vignette; c.fillRect(0, this.h * .72, this.w, this.h * .28);
    c.restore();
  }
}
