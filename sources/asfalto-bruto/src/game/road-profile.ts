import { brakeGrip, roadGrip, raceCondition } from './conditions';
import type { Traffic, Obstacle } from './types';

export const roadHalf = (trackId: string) => trackId==='terra'?4.2:7;
export const lateralLimit = (trackId: string) => roadHalf(trackId)+3.5;
export const roadLanes = (trackId: string) => trackId==='terra'?[-2.1,2.1]:[-5.25,-1.75,1.75,5.25];
export const surfaceGrip = (trackId: string, condition: unknown) => roadGrip(condition)*(trackId==='terra'?.92:1);
export const surfaceBraking = (trackId: string, condition: unknown) => brakeGrip(condition)*(trackId==='terra'?.94:1);
export const surfaceDrag = (trackId: string, condition: unknown) => trackId==='terra'?(raceCondition(condition)==='rain'?1.1:.6):0;
// Widths include a rider's clearance for contact, and match the projected art.
export function trafficShape(trackId: string, kind: Traffic['kind']) {
  const width=kind==='tractor'?3:kind==='truck'?4.5:trackId==='terra'?3.1:3.7;
  return {width, height:width*(kind==='tractor'?1.08:kind==='truck'?1.25:.94), contact:kind==='tractor'?1.95:kind==='truck'?2.7:trackId==='terra'?2:2.3, length:kind==='tractor'?4.2:kind==='truck'?5.5:3.2};
}

export function trafficAvoidance(trackId: string, kind: Traffic['kind'] | Obstacle['kind'], braking=false) {
  if(trackId!=='terra')return kind==='truck'?(braking?3.1:3.2):(braking?2.5:2.8);
  return trafficShape(trackId,kind==='tractor'?'tractor':'car').contact+(braking?.2:.5);
}
