export type AttackKind = 'punch' | 'kick' | 'weapon';
export type RaceMode = 'countdown' | 'racing' | 'finished';
export type Profile = 'aggressive' | 'careful' | 'fast' | 'player' | 'police';
export type BikeStyle = 'street' | 'sport' | 'muscle' | 'supermoto' | 'cruiser' | 'chopper' | 'cafe';
export interface Command { throttle: number; brake: number; steer: number; attack: AttackKind | null; }
export interface Attack { kind: AttackKind; age: number; side: number; hit: boolean; id?: number; }
export interface Rider {
  id: string; name: string; color: string; profile: Profile; bikeId?: string;
  x: number; z: number; speed: number; lean: number;
  health: number; integrity: number; maxSpeed: number; acceleration: number; handling: number; armor: number;
  weapon: boolean; attack: Attack | null; cooldown: number; crash: number; immune: number;
  targetX: number; decisionAt: number; finishedAt: number | null; hits: number; falls: number;
  out?: 'caught' | 'wrecked' | 'left' | 'timeout'; capture?: number;
}
export interface Traffic { id: string; x: number; z: number; speed: number; color: string; kind: 'car' | 'van'; }
export interface Obstacle { id: string; x: number; z: number; kind: 'oil' | 'barrier'; }
export interface GameEvent { type: 'hit' | 'crash' | 'pass' | 'finish' | 'attack' | 'steal' | 'police'; actor: string; target?: string; text?: string; tick?: number; }
export interface RaceResult { reason: 'finish' | 'wrecked' | 'caught' | 'left' | 'timeout'; arrestCause?: 'fall' | 'stopped'; place: number; time: number; reward: number; hits: number; falls: number; }
export interface RaceState {
  version: 1; tick: number; rng: number; trackId: string; mode: RaceMode; countdown: number; time: number;
  riders: Rider[]; traffic: Traffic[]; obstacles: Obstacle[]; events: GameEvent[];
  collisions: Record<string, number>; heat: number; capture: number; policeActive: boolean;
  result: RaceResult | null;
  multiplayer?: { humanIds: string[]; results: Record<string, RaceResult> };
}
export interface Bike { id: string; name: string; class: string; style: BikeStyle; price: number; speed: number; acceleration: number; handling: number; armor: number; color: string; tagline: string; }
export interface Upgrade { engine: number; armor: number; handling: number; }
export interface SaveData { version: 1; cash: number; owned: string[]; bikeId: string; upgrades: Record<string, Upgrade>; condition: Record<string, number>; unlocked: number; records: Record<string, { time: number; place: number }>; races: number; muted: boolean; }
export interface Track { id: string; name: string; region: string; distance: number; difficulty: string; prize: number; index: number; sky: string[]; land: string[]; road: string[]; accent: string; }
export const EMPTY_COMMAND: Command = { throttle: 0, brake: 0, steer: 0, attack: null };
