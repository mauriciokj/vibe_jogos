import type { Bike, Track } from './types';

export const BIKES: Bike[] = [
  { id: 'ferro', name: 'Ferro 500', class: 'STREET', price: 0, speed: 64, acceleration: 13.2, handling: 1.1, armor: 1, color: '#dfff71', tagline: 'Leve, esperta e pronta pra briga.' },
  { id: 'veneno', name: 'Veneno 750', class: 'SPORT', price: 2800, speed: 73, acceleration: 15, handling: 1.2, armor: .95, color: '#ee734d', tagline: 'A reta é sua. O resto você conquista.' },
  { id: 'brutal', name: 'Brutal 1000', class: 'MUSCLE', price: 4800, speed: 78, acceleration: 12.5, handling: .95, armor: 1.4, color: '#b6a1fb', tagline: 'Mais motor. Menos conversa.' },
];
export const TRACKS: Track[] = [
  { id: 'costa', name: 'Costa do Sol', region: 'RODOVIA LITORÂNEA', distance: 8400, difficulty: 'NORMAL', prize: 1400, index: 0, sky: ['#567d9b', '#e0a6aa', '#fbd4ad'], land: ['#779b77', '#699271'], road: ['#555a5b', '#505557'], accent: '#deff70' },
  { id: 'serra', name: 'Serra da Fumaça', region: 'ESTRADA DA MONTANHA', distance: 9200, difficulty: 'DIFÍCIL', prize: 1850, index: 1, sky: ['#555f83', '#b794b1', '#f2c2b5'], land: ['#728b70', '#637e67'], road: ['#555962', '#50545c'], accent: '#b9a0f8' },
  { id: 'deserto', name: 'Vale Vermelho', region: 'FRONTEIRA DO DESERTO', distance: 10200, difficulty: 'BRUTAL', prize: 2300, index: 2, sky: ['#69678d', '#e2908b', '#ffcb95'], land: ['#bc8165', '#b3785d'], road: ['#5c5356', '#564e51'], accent: '#ffac6f' },
];
export function getTrack(id: string): Track { return TRACKS.find(t => t.id === id) ?? TRACKS[0]; }
export function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
export function curveAt(z: number, trackId: string) {
  const i = getTrack(trackId).index;
  const intro = clamp((z - 280) / 600, 0, 1);
  return (Math.sin(z / (520 - i * 60)) * .66 + Math.sin(z / 231 + 1) * .27) * intro * (1 + i * .2);
}
export function elevationAt(z: number, trackId: string) {
  const i = getTrack(trackId).index;
  return (Math.sin(z / 640) * 17 + Math.sin(z / 265) * 3.5) * (i === 1 ? 2.5 : 1);
}
export function clockString(time: number) {
  return `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}.${Math.floor(time % 1 * 10)}`;
}
export function money(amount: number) { return '$ ' + Math.round(amount).toLocaleString('pt-BR'); }
