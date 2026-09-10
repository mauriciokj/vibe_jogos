import type { Championship } from './championship';
export type RaceCondition = 'day' | 'sunset' | 'night' | 'rain';
export type AttackKind = 'punch' | 'kick' | 'weapon';
export type RaceMode = 'countdown' | 'racing' | 'finished';
export type Profile = 'aggressive' | 'careful' | 'fast' | 'player' | 'police';
export type BikeStyle = 'street' | 'sport' | 'muscle' | 'supermoto' | 'cruiser' | 'chopper' | 'cafe';
export type RiderAction = 'kneeLeft' | 'kneeRight' | 'nitro' | 'horn' | 'taunt' | 'wheelie';
export interface Command { throttle: number; brake: number; steer: number; attack: AttackKind | null; action?: RiderAction; }
export interface Attack { kind: AttackKind; age: number; side: number; hit: boolean; id?: number; }
export interface Recovery {
 origin?:{x:number;z:number;speed:number;lean:number};
 phase:'sliding'|'gettingUp'|'walking'|'mounting'|'exploding';
 bikeX:number;bikeZ:number;bikeVX:number;bikeVZ:number;vx:number;vz:number;
 timer:number;age:number;cycle:number;facingX:number;facingZ:number;hitCooldown:number;hits:number;
}
export interface Rider {
 recovery?:Recovery;
  helmetId?: string; helmetColorId?: string;
  id: string; name: string; color: string; profile: Profile; bikeId?: string; kneePadId?: string;
  x: number; z: number; speed: number; lean: number;
  health: number; integrity: number; maxSpeed: number; acceleration: number; handling: number; armor: number;
  weapon: boolean; weaponId?: string; wheeliesLeft?: number; wheelieTime?: number; jumpTime?: number; jumpTarget?: string; attack: Attack | null; cooldown: number; crash: number; immune: number;
  targetX: number; decisionAt: number; finishedAt: number | null; hits: number; falls: number;
  out?: 'caught' | 'wrecked' | 'left' | 'timeout'; capture?: number;
  kneeSide?: number; kneeTime?: number; wetKneeTicks?: number; nitro?: number; nitroUsed?: number; nitroTime?: number; hornCooldown?: number;
  speech?: { index: number; until: number }; tauntReadyAt?: number; tauntSeq?: number;
}
export interface Traffic { id: string; x: number; z: number; speed: number; color: string; kind: 'car' | 'van' | 'truck' | 'tractor'; heading?: 1 | -1; queued?: boolean; }
export interface Obstacle { id: string; x: number; z: number; kind: 'oil' | 'barrier' | 'cone' | 'concrete' | 'gravel' | 'mud' | 'fallenTree' | 'tumbleweed' | 'armadillo' | 'dirtRamp' | 'woodRamp'; width?: number; motion?: { from: number; to: number; speed: number; phase: number; period: number }; }
export interface GameEvent { type: 'hit' | 'crash' | 'pass' | 'finish' | 'attack' | 'steal' | 'police' | 'horn' | 'nitro' | 'explosion'; actor: string; target?: string; text?: string; tick?: number; }
export interface RaceResult { reason: 'finish' | 'wrecked' | 'caught' | 'left' | 'timeout'; arrestCause?: 'fall' | 'stopped'; place: number; time: number; reward: number; hits: number; falls: number; }
export interface RaceState {
  version: 1; condition?: RaceCondition; scenicEvent?: { kind: 'mermaid' | 'saci' | 'boitata'; z: number; startedAt: number | null; duration: number } | { kind: 'truckPassenger'; trafficId: string; z: number; startedAt: number | null; duration: number }; tick: number; rng: number; trackId: string; mode: RaceMode; countdown: number; time: number;
  riders: Rider[]; traffic: Traffic[]; obstacles: Obstacle[]; events: GameEvent[];
  collisions: Record<string, number>; heat: number; capture: number; policeActive: boolean;
  result: RaceResult | null;
  nextTauntAt?: number;
  multiplayer?: { humanIds: string[]; results: Record<string, RaceResult> };
}
export interface Bike { id: string; name: string; class: string; style: BikeStyle; nitroCapacity: 2 | 3 | 5; price: number; speed: number; acceleration: number; handling: number; armor: number; color: string; tagline: string; }
export interface Upgrade { engine: number; armor: number; handling: number; }
export interface SaveData { version: 1; championship?: Championship; ownedHelmets?: string[]; helmetId?: string; helmetColorId?: string; raceTrackId?: string; raceCondition?: RaceCondition; ownedWeapons?: string[]; weaponId?: string; ownedKneePads?: string[]; kneePadId?: string; nitro?: Record<string, number>; nitroReceipts?: Record<string, number>; cash: number; owned: string[]; bikeId: string; upgrades: Record<string, Upgrade>; condition: Record<string, number>; unlocked: number; records: Record<string, { time: number; place: number }>; races: number; muted: boolean; }
export interface Track { id: string; name: string; region: string; distance: number; difficulty: string; prize: number; index: number; level: number; theme: 'coast' | 'mountain' | 'desert' | 'port' | 'rural'; sky: string[]; land: string[]; road: string[]; accent: string; }
export const EMPTY_COMMAND: Command = { throttle: 0, brake: 0, steer: 0, attack: null };
