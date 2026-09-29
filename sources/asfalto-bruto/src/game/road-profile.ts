import { brakeGrip, roadGrip, raceCondition } from './conditions';
import type { Traffic, Obstacle } from './types';
import { forestRoad, forestMudAt } from './forest';

export const roadHalf = (trackId: string,z=0) => trackId==='mata'?forestRoad(z).half:trackId==='terra'?4.2:7;
export const lateralLimit = (trackId: string,z=0) => roadHalf(trackId,z)+3.5;
export const roadLanes = (trackId: string,z=0) => trackId==='mata'?forestRoad(z).lanes:trackId==='terra'?[-2.1,2.1]:[-5.25,-1.75,1.75,5.25];
export const surfaceGrip = (trackId: string, condition: unknown,z=0,x=0) => roadGrip(condition)*(trackId==='terra'?.92:trackId==='mata'?1-forestMudAt(z,x)*(raceCondition(condition)==='rain'?.48:.42):1);
export const surfaceBraking = (trackId: string, condition: unknown,z=0,x=0) => brakeGrip(condition)*(trackId==='terra'?.94:trackId==='mata'?1-forestMudAt(z,x)*.22:1);
export const surfaceDrag = (trackId: string, condition: unknown,z=0,x=0,speed=30) => trackId==='terra'?(raceCondition(condition)==='rain'?1.1:.6):trackId==='mata'?forestMudAt(z,x)*14*Math.min(1,Math.max(0,speed)/22):0;
// Widths include a rider's clearance for contact, and match the projected art.
export function trafficShape(trackId: string, kind: Traffic['kind']) {
  const width=kind==='tractor'?3:kind==='truck'?4.5:trackId==='terra'?3.1:3.7;
  return {width, height:width*(kind==='tractor'?1.08:kind==='truck'?1.25:.94), contact:kind==='tractor'?1.95:kind==='truck'?2.7:trackId==='terra'?2:2.3, length:kind==='tractor'?4.2:kind==='truck'?5.5:3.2};
}

export function trafficAvoidance(trackId: string, kind: Traffic['kind'] | Obstacle['kind'], braking=false) {
  if(trackId!=='terra')return kind==='truck'?(braking?3.1:3.2):(braking?2.5:2.8);
  return trafficShape(trackId,kind==='tractor'?'tractor':'car').contact+(braking?.2:.5);
}
