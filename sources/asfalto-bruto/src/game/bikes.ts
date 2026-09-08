import type { Bike } from './types';

export const BIKES: Bike[] = [
  { id: 'ferro', nitroCapacity: 2, name: 'Ferro 500', class: 'STREET', style: 'street', price: 0, speed: 64, acceleration: 13.2, handling: 1.1, armor: 1, color: '#dfff71', tagline: 'Equilibrada para aprender a rua. Leve no bolso, firme na pista.' },
  { id: 'veneno', nitroCapacity: 3, name: 'Veneno 750', class: 'ESPORTIVA', style: 'sport', price: 2800, speed: 73, acceleration: 15, handling: 1.2, armor: .95, color: '#ee734d', tagline: 'Carenagem afiada e motor forte. Acelera muito, exige cuidado no contato.' },
  { id: 'brutal', nitroCapacity: 5, name: 'Brutal 1000', class: 'MUSCLE', style: 'muscle', price: 4800, speed: 78, acceleration: 12.5, handling: .95, armor: 1.4, color: '#b6a1fb', tagline: 'Pneu largo e a maior final. Freie cedo para domar o peso nas curvas.' },
  { id: 'falcao', nitroCapacity: 2, name: 'Falcão 450', class: 'SUPERMOTO', style: 'supermoto', price: 1800, speed: 60, acceleration: 15.6, handling: 1.6, armor: .82, color: '#74dfe9', tagline: 'Alta, estreita e muito ágil. Contorna rápido, perde nas retas e no impacto.' },
  { id: 'estradeira', nitroCapacity: 2, name: 'Estradeira 900', class: 'CRUISER', style: 'cruiser', price: 2400, speed: 66, acceleration: 12.4, handling: 1, armor: 1.55, color: '#e6b965', tagline: 'Custom de banco baixo, cromados e alforjes. Aguenta a briga, pede uma curva mais aberta.' },
  { id: 'lobo', nitroCapacity: 3, name: 'Lobo 1200', class: 'CHOPPER', style: 'chopper', price: 3500, speed: 71, acceleration: 11.4, handling: .82, armor: 1.7, color: '#c57566', tagline: 'Garfo longo, guidão alto e muito metal. A mais resistente; prepare bem a frenagem.' },
  { id: 'agulha', nitroCapacity: 3, name: 'Agulha 600', class: 'CAFÉ RACER', style: 'cafe', price: 3900, speed: 69, acceleration: 14.5, handling: 1.42, armor: .9, color: '#91b897', tagline: 'Tanque clássico, banco de couro e direção precisa. Boa saída de curva, pouca proteção.' },
];
export function getBike(id?: string): Bike { return BIKES.find(b => b.id === id) ?? BIKES[0]; }
export function handlingLabel(handling: number) { return handling >= 1.4 ? 'MUITO ÁGIL' : handling >= 1.15 ? 'ÁGIL' : handling >= 1.05 ? 'EQUILIBRADA' : handling >= .9 ? 'PESADA' : 'EXIGE ANTECIPAÇÃO'; }
export function zeroToHundred(bike: Bike) {
  const drag = bike.acceleration * .35 / bike.speed;
  return -Math.log(1 - (100 / 3.6) * drag / (bike.acceleration - 1.2)) / drag;
}
export const supportsKneeDown = (bikeId?: string) => getBike(bikeId).style !== 'chopper';
