import type { Command, RaceCondition, SaveData } from '../game/types';
export const ACCOUNT_API = '/api/asfalto/account';
export const RANK_RULES = 3;
export interface CloudSave { revision: number; save: SaveData | null; updatedAt: number; }
export interface Account { id: string; nickname: string; }
export interface Session { account: Account | null; cloud?: CloudSave; csrf: string; clientId: string; }
export interface ReplaySegment { count: number; command: Command; }
export interface RankedRun { id: string; seed: number; save: SaveData; trackId: string; condition: RaceCondition; rules: number; }
export interface RankingEntry { rank: number; nickname: string; bikeId: string; time: number; place: number; races: number; points: number; me: boolean; }
