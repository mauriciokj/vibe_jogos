import { getTrack } from './content';
import type { RaceResult } from './types';

export interface RacePayout {
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
  return { baseReward: result.reward, recordBonus, previousRecord, total: result.reward + recordBonus };
}
