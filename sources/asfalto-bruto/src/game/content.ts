import type { Bike, Track } from './types';

export const BIKES: Bike[] = [
  { id: 'ferro', name: 'Ferro 500', class: 'STREET', style: 'street', price: 0, speed: 64, acceleration: 13.2, handling: 1.1, armor: 1, color: '#dfff71', tagline: 'Equilibrada para aprender a rua. Leve no bolso, firme na pista.' },
  { id: 'veneno', name: 'Veneno 750', class: 'ESPORTIVA', style: 'sport', price: 2800, speed: 73, acceleration: 15, handling: 1.2, armor: .95, color: '#ee734d', tagline: 'Carenagem afiada e motor forte. Acelera muito, exige cuidado no contato.' },
  { id: 'brutal', name: 'Brutal 1000', class: 'MUSCLE', style: 'muscle', price: 4800, speed: 78, acceleration: 12.5, handling: .95, armor: 1.4, color: '#b6a1fb', tagline: 'Pneu largo e a maior final. Freie cedo para domar o peso nas curvas.' },
  { id: 'falcao', name: 'Falcão 450', class: 'SUPERMOTO', style: 'supermoto', price: 1800, speed: 60, acceleration: 15.6, handling: 1.6, armor: .82, color: '#74dfe9', tagline: 'Alta, estreita e muito ágil. Contorna rápido, perde nas retas e no impacto.' },
  { id: 'estradeira', name: 'Estradeira 900', class: 'CRUISER', style: 'cruiser', price: 2400, speed: 66, acceleration: 12.4, handling: 1, armor: 1.55, color: '#e6b965', tagline: 'Custom de banco baixo, cromados e alforjes. Aguenta a briga, pede uma curva mais aberta.' },
  { id: 'lobo', name: 'Lobo 1200', class: 'CHOPPER', style: 'chopper', price: 3500, speed: 71, acceleration: 11.4, handling: .82, armor: 1.7, color: '#c57566', tagline: 'Garfo longo, guidão alto e muito metal. A mais resistente; prepare bem a frenagem.' },
  { id: 'agulha', name: 'Agulha 600', class: 'CAFÉ RACER', style: 'cafe', price: 3900, speed: 69, acceleration: 14.5, handling: 1.42, armor: .9, color: '#91b897', tagline: 'Tanque clássico, banco de couro e direção precisa. Boa saída de curva, pouca proteção.' },
];
export function getBike(id?: string): Bike { return BIKES.find(b => b.id === id) ?? BIKES[0]; }
export function handlingLabel(handling: number) { return handling >= 1.4 ? 'MUITO ÁGIL' : handling >= 1.15 ? 'ÁGIL' : handling >= 1.05 ? 'EQUILIBRADA' : handling >= .9 ? 'PESADA' : 'EXIGE ANTECIPAÇÃO'; }
export function zeroToHundred(bike: Bike) {
  const drag = bike.acceleration * .35 / bike.speed;
  return -Math.log(1 - (100 / 3.6) * drag / (bike.acceleration - 1.2)) / drag;
}
export const TRACKS: Track[] = [
  { id: 'costa', name: 'Costa do Sol', region: 'RODOVIA LITORÂNEA', distance: 8400, difficulty: 'NORMAL', prize: 1400, index: 0, sky: ['#567d9b', '#e0a6aa', '#fbd4ad'], land: ['#779b77', '#699271'], road: ['#555a5b', '#505557'], accent: '#deff70' },
  { id: 'serra', name: 'Serra da Fumaça', region: 'ESTRADA DA MONTANHA', distance: 9200, difficulty: 'DIFÍCIL', prize: 1850, index: 1, sky: ['#555f83', '#b794b1', '#f2c2b5'], land: ['#728b70', '#637e67'], road: ['#555962', '#50545c'], accent: '#b9a0f8' },
  { id: 'deserto', name: 'Vale Vermelho', region: 'FRONTEIRA DO DESERTO', distance: 10200, difficulty: 'BRUTAL', prize: 2300, index: 2, sky: ['#69678d', '#e2908b', '#ffcb95'], land: ['#bc8165', '#b3785d'], road: ['#5c5356', '#564e51'], accent: '#ffac6f' },
];
export function getTrack(id: string): Track { return TRACKS.find(t => t.id === id) ?? TRACKS[0]; }
export function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
export interface Corner { start: number; end: number; bend: number; ramp: number; }
const cornerCache = new Map<string, Corner[]>();
export function trackCorners(trackId: string): Corner[] {
  const track = getTrack(trackId), cached = cornerCache.get(track.id);
  if (cached) return cached;
  const corners: Corner[] = [];
  const strengths = [1.65, 2.3, 1.4, 2.05, 2.6, 1.75];
  let start = 650;
  for (let i = 0; start < track.distance - 500; i++) {
    const length = [300, 270, 330, 260][i % 4];
    corners.push({ start, end: start + length, bend: (i % 2 ? -1 : 1) * strengths[i % strengths.length] * (1 + track.index * .12), ramp: 85 });
    start += length + [270, 180, 320, 220][i % 4] - track.index * 35;
  }
  cornerCache.set(track.id, corners);
  return corners;
}
export function curveAt(z: number, trackId: string) {
  const corner = trackCorners(trackId).find(c => z >= c.start && z <= c.end);
  if (!corner) return 0;
  const t = clamp(Math.min(z - corner.start, corner.end - z) / corner.ramp, 0, 1);
  return corner.bend * t * t * (3 - 2 * t);
}
export function cornerSpeed(curve: number, handling = 1.1) {
  return Math.sqrt(3000 * handling / Math.max(.01, Math.abs(curve)));
}
// Braking envelope: account for the distance still available before each bend.
// Used by AI and the HUD; movement itself never applies an automatic brake.
export function cornerPace(z: number, trackId: string, handling = 1.1) {
  let speed = 120;
  for (let ahead = 0; ahead <= 240; ahead += 20) {
    const safe = cornerSpeed(curveAt(z + ahead, trackId), handling);
    speed = Math.min(speed, Math.sqrt(safe * safe + 2 * 19 * Math.max(0, ahead - 12)));
  }
  return speed;
}
export function cornerForces(speed: number, handling: number, curve: number, shoulder = false) {
  const load = speed * speed * Math.abs(curve) / (3000 * handling);
  const excess = Math.max(0, load - 1);
  return {
    lateral: (2.6 + speed * .0625) * handling * (shoulder ? .72 : 1) / (1 + excess * .9),
    drift: Math.sign(curve) * (4 * load + 4 * excess * excess),
    sliding: excess > .2,
  };
}
export function upcomingCorner(z: number, trackId: string, handling = 1.1) {
  const c = trackCorners(trackId).find(c => c.end - 35 > z && c.start - z <= 240);
  return c ? { direction: c.bend > 0 ? 'right' : 'left', distance: Math.max(0, Math.round(c.start - z)), speed: Math.floor(cornerSpeed(c.bend, handling) * 3.6 / 5) * 5, tight: Math.abs(c.bend) >= 2 } : null;
}
export function elevationAt(z: number, trackId: string) {
  const i = getTrack(trackId).index;
  return (Math.sin(z / 640) * 17 + Math.sin(z / 265) * 3.5) * (i === 1 ? 2.5 : 1);
}
export function clockString(time: number) {
  return `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}.${Math.floor(time % 1 * 10)}`;
}
export function money(amount: number) { return '$ ' + Math.round(amount).toLocaleString('pt-BR'); }
