import { getTrack } from './content';
import type { RaceResult } from './types';

export const POLICE_KNOCKDOWN_REWARD = 500;
export const RIVAL_KNOCKDOWN_REWARD = 50;
export function rivalReward(knockdowns=0):number {
  return Number.isSafeInteger(knockdowns) && knockdowns>0 ? knockdowns*RIVAL_KNOCKDOWN_REWARD : 0;
}
export function policeReward(knockdowns=0):number {
  return Number.isSafeInteger(knockdowns) && knockdowns>0 ? knockdowns*POLICE_KNOCKDOWN_REWARD : 0;
}
export function raceReward(trackId:string,reason:RaceResult['reason'],place:number):number {
  return reason==='finish' ? Math.round(getTrack(trackId).prize*([1,.8,.64,.5,.4,.32,.25,.2][place-1] ?? .2)) : reason==='left' ? 0 : 120;
}

export interface RacePayout {
  policeBikeUnlocked?:boolean;
  policeBonus?: number;
  rivalBonus?: number;
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
  const rivalBonus=rivalReward(result.rivalKnockdowns);
  return { baseReward: result.reward, recordBonus, previousRecord, ...(policeBonus?{policeBonus}:{}), ...(rivalBonus?{rivalBonus}:{}), total: result.reward + recordBonus + policeBonus + rivalBonus };
}
