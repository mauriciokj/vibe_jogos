import { getTrack } from './content';
import type { RaceResult } from './types';

export const POLICE_KNOCKDOWN_REWARD = 500;
export function policeReward(knockdowns=0):number {
  return Number.isSafeInteger(knockdowns) && knockdowns>0 ? knockdowns*POLICE_KNOCKDOWN_REWARD : 0;
}

export interface RacePayout {
  policeBikeUnlocked?:boolean;
  policeBonus?: number;
  achievements?:import('./achievements').AchievementId[];
  secretUnlocked?: boolean;
  baseReward: number;
  recordBonus: number;
  previousRecord: number | null;
  total: number;
}

export function racePayout(trackId: string, result: RaceResult, previousTime?: number): RacePayout {
  const previousRecord = Number.isFinite(previousTime) && previousTime! > 0 ? previousTime! : null;
  const beaten = result.reason === 'finish' && Number.isFinite(result.time) && result.time > 0
    && previousRecord !== null && result.time < previousRecord;
  const recordBonus = beaten ? Math.round(getTrack(trackId).prize * .3) : 0;
  const policeBonus=policeReward(result.policeKnockdowns);
  return { baseReward: result.reward, recordBonus, previousRecord, ...(policeBonus?{policeBonus}:{}), total: result.reward + recordBonus + policeBonus };
}
