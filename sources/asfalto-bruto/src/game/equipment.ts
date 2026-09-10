import { roadHalf } from './road-profile';
import type { Rider, SaveData } from './types';
import { getBike, supportsKneeDown } from './bikes';

export const NITRO_PRICE = 2500;
export const NITRO_DURATION = 5;
export const NITRO_MULTIPLIER = 1.1;
export const KNEE_DURATION = 4;
export const WET_KNEE_LIMIT = 2;
export function nitroCount(bikeId: string | undefined, value: unknown) {
  return typeof value==='number' && Number.isInteger(value) ? Math.max(0,Math.min(getBike(bikeId).nitroCapacity,value)) : 0;
}

export const KNEE_PADS = [
  { id: 'white', name: 'Branca', color: '#e7eddf', price: 450, grip: .12 },
  { id: 'green', name: 'Verde', color: '#a8ef66', price: 900, grip: .22 },
  { id: 'blue', name: 'Azul', color: '#67c5ff', price: 1600, grip: .32 },
  { id: 'purple', name: 'Roxa', color: '#c59aff', price: 2600, grip: .42 },
  { id: 'gold', name: 'Dourada', color: '#ffd16a', price: 4000, grip: .55 },
] as const;
export function getKneePad(id: unknown) { return KNEE_PADS.find(p=>p.id===id); }
export function kneePadPrerequisite(save: SaveData, id: unknown) {
  const index=KNEE_PADS.findIndex(p=>p.id===id),owned=save.ownedKneePads ?? [];
  // Previously purchased tiers remain usable, including older beta saves.
  if(index<=0 || owned.includes(KNEE_PADS[index].id))return undefined;
  const previous=KNEE_PADS[index-1];
  return owned.includes(previous.id)?undefined:previous;
}
export function equippedKneePad(save?: SaveData) {
  return save?.ownedKneePads?.includes(save.kneePadId ?? '') ? getKneePad(save.kneePadId) : undefined;
}
export const kneeCornerSpeedBonus = (grip: number) => Math.round((Math.sqrt(1+grip)-1)*100);
const ramp = (value: number) => Math.max(0,Math.min(1,value));
// Double-tap activates the technique; grip builds smoothly in the chosen bend.
// Choppers, straights, shoulders and low speeds receive no knee bonus.
export function kneeSupport(rider: Rider, curve: number, trackId = 'costa') {
  if((rider.wheelieTime ?? 0)>0 || (rider.jumpTime ?? 0)>0 || !getKneePad(rider.kneePadId) || !supportsKneeDown(rider.bikeId) || !(rider.kneeTime!>0) || rider.kneeSide!==Math.sign(curve) || rider.crash || rider.out || rider.finishedAt!==null || Math.abs(rider.x)>roadHalf(trackId))return 0;
  return ramp((rider.speed-20)/10)*ramp((Math.abs(curve)-.15)/.5);
}
// Match the visible contact pose: kicking lifts the leg off the road.
export function kneeContact(rider: Rider, curve: number, trackId = 'costa') {
  return kneeSupport(rider,curve,trackId)>.35 && rider.attack?.kind!=='kick';
}
export function cornerHandling(rider: Rider, curve: number, trackId = 'costa') {
  return rider.handling*(1+(getKneePad(rider.kneePadId)?.grip ?? 0)*kneeSupport(rider,curve,trackId));
}
// Braking advice assumes the equipped technique can be used in the bend.
export function plannedCornerHandling(handling: number, kneePadId?: string) {
  return handling*(1+(getKneePad(kneePadId)?.grip ?? 0));
}
