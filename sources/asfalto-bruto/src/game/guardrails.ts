import type { Rider } from './types';

// Shared by drawing, simulation and multiplayer presentation.
export const GUARD_RAIL_X = 7.75;
export const GUARD_RAIL_CLEARANCE = .75;
export const GUARD_RAIL_LIMIT = GUARD_RAIL_X - GUARD_RAIL_CLEARANCE;
export function hasGuardRail(trackId: string, side: number) {
  return trackId==='serra' || (trackId==='costa' || trackId==='porto') && side<0;
}
export function guardRailPosition(trackId: string, x: number) {
  if(x < -GUARD_RAIL_LIMIT && hasGuardRail(trackId,-1))return -GUARD_RAIL_LIMIT;
  if(x > GUARD_RAIL_LIMIT && hasGuardRail(trackId,1))return GUARD_RAIL_LIMIT;
  return x;
}
export function contactGuardRail(trackId: string, rider: Rider, dt=0) {
  const x=guardRailPosition(trackId,rider.x),penetration=Math.abs(rider.x-x);
  if(!penetration)return false;
  rider.x=x;
  // Scraping dissipates speed while holding into the rail. Steering away is free.
  // Lateral pushes also lose speed, without extra health damage or a forced fall.
  rider.speed=Math.max(0,rider.speed-penetration*6-dt*12);
  return true;
}
