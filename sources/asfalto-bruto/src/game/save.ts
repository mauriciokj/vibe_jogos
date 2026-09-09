import { HELMETS, HELMET_COLORS, equippedHelmet, getHelmetColor, ownsHelmet } from './helmets';
import { WEAPONS, equippedWeapon, getWeapon } from './weapons';
import { CONDITIONS, raceCondition, recordKey } from './conditions';
import { BIKES, TRACKS, clamp, getTrack } from './content';
import { KNEE_PADS, NITRO_PRICE, equippedKneePad, getKneePad, nitroCount } from './equipment';
import type { RaceState, SaveData, Upgrade } from './types';

export const SAVE_KEY = 'asfalto-bruto:v1';
export function freshSave(): SaveData {
  return { version: 1, ownedHelmets: ['integral'], helmetId: 'integral', helmetColorId: 'white', raceTrackId: 'costa', raceCondition: 'sunset', cash: 650, owned: ['ferro'], bikeId: 'ferro', upgrades: { ferro: { engine: 0, armor: 0, handling: 0 } }, condition: { ferro: 100 }, unlocked: 0, records: {}, races: 0, muted: false };
}
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return freshSave();
    const saved = JSON.parse(raw);
    if (saved.version !== 1) return freshSave();
    const valid = freshSave();
    valid.cash = Number.isFinite(saved.cash) ? clamp(saved.cash, 0, 1e8) : 650;
    valid.owned = Array.isArray(saved.owned) ? BIKES.filter(b => saved.owned.includes(b.id)).map(b => b.id) : ['ferro'];
    if (!valid.owned.includes('ferro')) valid.owned.unshift('ferro');
    valid.bikeId = valid.owned.includes(saved.bikeId) ? saved.bikeId : 'ferro';
    valid.unlocked = Number.isInteger(saved.unlocked) ? clamp(saved.unlocked, 0, TRACKS.length-1) : 0;
    valid.races = Number.isFinite(saved.races) ? Math.max(0, saved.races) : 0;
    valid.muted = saved.muted === true;
    valid.raceCondition = raceCondition(saved.raceCondition);
    valid.ownedHelmets=HELMETS.filter(h=>h.id==='integral' || Array.isArray(saved.ownedHelmets) && saved.ownedHelmets.includes(h.id)).map(h=>h.id);
    valid.helmetId=equippedHelmet({...valid,helmetId:saved.helmetId}).id;
    valid.helmetColorId=getHelmetColor(saved.helmetColorId).id;
    if(Array.isArray(saved.ownedWeapons))valid.ownedWeapons=WEAPONS.filter(w=>saved.ownedWeapons.includes(w.id)).map(w=>w.id);
    const weapon=equippedWeapon({...valid,weaponId:saved.weaponId});if(weapon)valid.weaponId=weapon.id;
    if (Array.isArray(saved.ownedKneePads)) valid.ownedKneePads=KNEE_PADS.filter(p=>saved.ownedKneePads.includes(p.id)).map(p=>p.id);
    const pad=equippedKneePad({...valid,kneePadId:saved.kneePadId});if(pad)valid.kneePadId=pad.id;
    if(saved.nitro && typeof saved.nitro==='object')valid.nitro=Object.fromEntries(valid.owned.filter(id=>saved.nitro[id]!==undefined).map(id=>[id,nitroCount(id,saved.nitro[id])]));
    if(saved.nitroReceipts && typeof saved.nitroReceipts==='object')valid.nitroReceipts=Object.fromEntries(Object.entries(saved.nitroReceipts).filter(([id,used])=>/^human-[a-f0-9]{16}$/.test(id) && Number.isInteger(used) && (used as number)>=0 && (used as number)<=5).slice(-64)) as Record<string,number>;
    for (const id of valid.owned) {
      valid.condition[id] = Number.isFinite(saved.condition?.[id]) ? clamp(saved.condition[id], 0, 100) : 100;
      valid.upgrades[id] = { engine: 0, armor: 0, handling: 0 };
      for (const key of ['engine', 'armor', 'handling'] as const) valid.upgrades[id][key] = Number.isInteger(saved.upgrades?.[id]?.[key]) ? clamp(saved.upgrades[id][key], 0, 3) : 0;
    }
    for (const id of TRACKS.flatMap(t=>CONDITIONS.map(c=>recordKey(t.id,c.id)))) {
      const r = saved.records?.[id];
      if (r && Number.isFinite(r.time) && r.time > 0 && Number.isInteger(r.place) && r.place >= 1 && r.place <= 8) valid.records[id] = { time: r.time, place: r.place };
    }
    // An existing top-five record on the former last track unlocks the expansion.
    for(const track of TRACKS)if(CONDITIONS.some(c=>(valid.records[recordKey(track.id,c.id)]?.place ?? 99)<=5))valid.unlocked=Math.max(valid.unlocked,Math.min(TRACKS.length-1,track.index+1));
    valid.raceTrackId=TRACKS.find(t=>t.id===saved.raceTrackId && t.index<=valid.unlocked)?.id ?? 'costa';
    return valid;
  } catch { return freshSave(); }
}
export function persist(save: SaveData): boolean {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}
export function repairCost(save: SaveData, bikeId = save.bikeId) { return Math.ceil((100 - (save.condition[bikeId] ?? 100)) * 4); }
export function buyHelmet(save: SaveData, id: string): boolean {
  const helmet=HELMETS.find(h=>h.id===id);if(!helmet)return false;
  if(!ownsHelmet(save,id)){
    if(save.cash<helmet.price)return false;
    save.cash-=helmet.price;save.ownedHelmets=HELMETS.filter(h=>h.id==='integral' || h.id===id || save.ownedHelmets?.includes(h.id)).map(h=>h.id);
  }
  save.helmetId=id;return true;
}
export function paintHelmet(save: SaveData,id: string): boolean {
  if(!HELMET_COLORS.some(c=>c.id===id))return false;
  save.helmetColorId=id;return true;
}
export function buyWeapon(save: SaveData, id: string): boolean {
  const weapon=getWeapon(id);if(!weapon)return false;
  const owned=save.ownedWeapons ?? [];
  if(!owned.includes(id)){if(save.cash<weapon.price)return false;save.cash-=weapon.price;save.ownedWeapons=[...owned,id];}
  save.weaponId=id;return true;
}
export function buyKneePad(save: SaveData, id: string): boolean {
  const pad=getKneePad(id);if(!pad)return false;
  const owned=save.ownedKneePads ?? [];
  if(!owned.includes(id)) {
    if(save.cash<pad.price)return false;
    save.cash-=pad.price;save.ownedKneePads=[...owned,id];
  }
  save.kneePadId=id;return true;
}
export function buyNitro(save: SaveData): boolean {
  const count=nitroCount(save.bikeId,save.nitro?.[save.bikeId]);
  if(save.cash<NITRO_PRICE || count>=BIKES.find(b=>b.id===save.bikeId)!.nitroCapacity)return false;
  save.cash-=NITRO_PRICE;save.nitro={...save.nitro,[save.bikeId]:count+1};return true;
}
export function spendNitro(save: SaveData, bikeId: string, quantity: number): boolean {
  if(quantity<=0)return false;
  save.nitro={...save.nitro,[bikeId]:Math.max(0,nitroCount(bikeId,save.nitro?.[bikeId])-quantity)};return true;
}
export function recordOnlineNitro(save: SaveData, rider: import('./types').Rider): boolean {
  const used=rider.nitroUsed ?? 0,previous=save.nitroReceipts?.[rider.id] ?? 0;
  if(used<=previous)return false;
  spendNitro(save,rider.bikeId ?? 'ferro',used-previous);
  save.nitroReceipts=Object.fromEntries([...Object.entries(save.nitroReceipts ?? {}).filter(([id])=>id!==rider.id),[rider.id,used]].slice(-64));return true;
}
export function repair(save: SaveData): boolean {
  const cost = repairCost(save);
  if (save.cash < cost) return false;
  save.cash -= cost; save.condition[save.bikeId] = 100; return true;
}
export function buyBike(save: SaveData, id: string): boolean {
  const bike = BIKES.find(b => b.id === id);
  if (!bike) return false;
  if (!save.owned.includes(id)) {
    if (save.cash < bike.price) return false;
    save.cash -= bike.price; save.owned.push(id); save.condition[id] = 100;
    save.upgrades[id] = { engine: 0, armor: 0, handling: 0 };
  }
  save.bikeId = id; return true;
}
export function upgradeCost(save: SaveData, key: keyof Upgrade) { return 450 + (save.upgrades[save.bikeId]?.[key] ?? 0) * 350; }
export function buyUpgrade(save: SaveData, key: keyof Upgrade): boolean {
  const up = save.upgrades[save.bikeId];
  if (!up || up[key] >= 3) return false;
  const cost = upgradeCost(save, key); if (save.cash < cost) return false;
  up[key]++; save.cash -= cost; return true;
}
export function settleRace(save: SaveData, state: RaceState) {
  if (!state.result) return;
  save.cash += state.result.reward; save.races++;
  save.condition[save.bikeId] = clamp(state.riders[0].integrity, 0, 100);
  const result = state.result;
  if (result.reason === 'finish') {
    const key = recordKey(state.trackId,state.condition);
    const old = save.records[key];
    save.records[key] = { time: Math.min(old?.time ?? Infinity, result.time), place: Math.min(old?.place ?? 8, result.place) };
    if (result.place <= 5) save.unlocked = Math.max(save.unlocked, Math.min(TRACKS.length-1, getTrack(state.trackId).index + 1));
  }
  // A sponsor restores the starter bike to a safe minimum, so failure never locks out play.
  if ((save.condition.ferro ?? 100) < 55) save.condition.ferro = 55;
}
