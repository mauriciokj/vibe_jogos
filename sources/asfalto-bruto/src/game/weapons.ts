import type { Rider, SaveData } from './types';

export const WEAPONS = [
  { id: 'bottle', name: 'Garrafa', price: 650, damage: 24, reach: 2.7, longitudinal: 4.8, windup: .12, duration: .34, cooldown: .50, push: .35, action: 'GARRAFADA', description: 'Rápida e de curto alcance. Boa para golpes seguidos.' },
  { id: 'bat', name: 'Bastão de beisebol', price: 1500, damage: 38, reach: 3.4, longitudinal: 5.7, windup: .23, duration: .50, cooldown: .78, push: .75, action: 'BASTONADA', description: 'O golpe mais forte. Exige chegar perto e acertar o tempo.' },
  { id: 'chain', name: 'Corrente', price: 2400, damage: 32, reach: 4.5, longitudinal: 6.2, windup: .30, duration: .64, cooldown: .94, push: .55, action: 'CORRENTADA', description: 'Maior alcance, com mais tempo entre os golpes.' },
] as const;
export function getWeapon(id: unknown) { return WEAPONS.find(w=>w.id===id); }
export function equippedWeapon(save?: SaveData) {
  return save?.ownedWeapons?.includes(save.weaponId ?? '') ? getWeapon(save.weaponId) : undefined;
}
export function weaponName(rider: Rider) { return getWeapon(rider.weaponId)?.name ?? (rider.weapon?'Bastão básico':'Sem arma'); }
