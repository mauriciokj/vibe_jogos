import { bankStrength } from './rural';
import { roadHalf } from './road-profile';
import type { Rider } from './types';

// Shared by drawing, simulation and multiplayer presentation.
export const GUARD_RAIL_X = 7.75;
export const GUARD_RAIL_CLEARANCE = .75;
export const GUARD_RAIL_LIMIT = GUARD_RAIL_X - GUARD_RAIL_CLEARANCE;
export function hasGuardRail(trackId: string, side: number) {
  return trackId==='serra' || (trackId==='costa' || trackId==='porto') && side<0;
}
export function roadsideBarrier(trackId: string, side: number, z: number) {
  if(hasGuardRail(trackId,side))return {limit:GUARD_RAIL_LIMIT,material:'metal' as const};
  const strength=trackId==='terra'?bankStrength(z,side):0;
  return strength>0?{limit:roadHalf(trackId)+(1-strength)*3.5,material:'earth' as const}:null;
}
export function guardRailPosition(trackId: string, x: number, z=0) {
  const side=Math.sign(x),barrier=roadsideBarrier(trackId,side,z);
  return barrier ? side*Math.min(Math.abs(x),barrier.limit) : x;
}
export function contactGuardRail(trackId: string, rider: Rider, dt=0) {
  const x=guardRailPosition(trackId,rider.x,rider.z),penetration=Math.abs(rider.x-x);
  if(!penetration)return false;
  rider.x=x;
  // Scraping dissipates speed while holding into the rail. Steering away is free.
  // Lateral pushes also lose speed, without extra health damage or a forced fall.
  rider.speed=Math.max(0,rider.speed-penetration*6-dt*12);
  return true;
}
