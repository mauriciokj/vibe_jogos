import { decorHash } from './conditions';
import { trafficAvoidance } from './road-profile';
import type { Obstacle, Traffic } from './types';

export const TREE_SITES = [{z:2040,x:-1.75},{z:4530,x:1.75},{z:7150,x:-1.75}];
export const RAMP_SITES = [{z:2060,x:2.1},{z:3560,x:-2.1},{z:5130,x:2.1},{z:6730,x:-2.1}];
export const isRamp = (o: Obstacle) => o.kind==='dirtRamp' || o.kind==='woodRamp';
export const trafficDirection = (t: Traffic) => t.heading ?? (t.speed<0?-1:1);

export function trackHazards(track: string, seed: number): Obstacle[] {
  if(track==='serra')return TREE_SITES.map((site,i)=>({id:`fallen-tree-${i}`,kind:'fallenTree',width:10.5,...site}));
  if(track==='terra')return RAMP_SITES.map((site,i)=>({id:`ramp-${i}`,kind:i%2?'woodRamp':'dirtRamp',...site}));
  if(track!=='deserto')return [];
  return [1450,2350,3650,4750,5950,7150,8250].map((z,i)=>{
    const animal=i%3===1,from=i%2?14:-14,speed=animal?2.6:5.4,period=animal?23:13;
    return {id:`desert-crossing-${i}`,kind:animal?'armadillo':'tumbleweed',x:from,z,
      motion:{from,to:-from,speed,phase:decorHash(seed^(0x51da+i*719))*period,period}};
  });
}
// The wrap happens well outside the shoulder. Rendering and multiplayer use
// the same clock as collisions; no random motion or per-frame accumulation.
export function obstacleX(o: Obstacle, time: number) {
  const m=o.motion;if(!m)return o.x;
  const age=((time+m.phase)%m.period+m.period)%m.period;
  return m.from+Math.sign(m.to-m.from)*Math.min(Math.abs(m.to-m.from),age*m.speed);
}
export function obstacleShape(o: Obstacle) {
  const width=o.width ?? (o.kind==='fallenTree'?10.5:isRamp(o)?2.3:o.kind==='armadillo'?1.6:o.kind==='tumbleweed'?1.8:o.kind==='cone'?1.1:2);
  return {width,contact:o.kind==='fallenTree'?width/2+.5:o.width?width/2+.3:o.kind==='cone'?.55:o.kind==='armadillo'?.95:isRamp(o)?1.1:1,
    length:o.kind==='fallenTree'?1.7:isRamp(o)?1.8:o.kind==='armadillo'?.85:o.kind==='tumbleweed'?.9:2};
}
export function dangerClearance(track: string, danger: Traffic | Obstacle, braking=false) {
  if(!('speed' in danger) && isRamp(danger))return 0;
  return Math.max(trafficAvoidance(track,danger.kind,braking),'speed' in danger?0:obstacleShape(danger).contact+.2);
}
