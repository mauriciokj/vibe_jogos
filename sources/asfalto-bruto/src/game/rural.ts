import { decorHash, raceCondition } from './conditions';
import type { Obstacle, RaceCondition, RaceState, Traffic } from './types';

export const RURAL_CORNERS = [
  [650,990,1.8], [1170,1450,-2.15], [1610,1900,2.35],
  [2200,2510,-1.85], [2680,2970,2.5], [3160,3460,-2.2],
  [3700,4000,2.1], [4180,4500,-2.45], [4700,5000,1.95],
  [5230,5530,-2.35], [5680,5980,2.15], [6200,6560,-1.85],
].map(([start,end,bend])=>({start,end,bend,ramp:100}));

// Bank entrances taper outward over 64m, so joining a protected section from
// the shoulder is gradual. Rendering, prediction and contact use this profile.
export const RURAL_BANKS = [
  {start:480,end:1100,side:-1}, {start:1500,end:2030,side:1},
  {start:2620,end:3060,side:-1}, {start:3610,end:4120,side:1},
  {start:4650,end:5130,side:-1}, {start:5620,end:6100,side:1},
];
export function bankStrength(z: number, side: number) {
  const bank=RURAL_BANKS.find(b=>b.side===side && z>b.start && z<b.end);
  if(!bank)return 0;
  const t=Math.min(1,(z-bank.start)/64,(bank.end-z)/64);
  return t*t*(3-2*t);
}
export function ruralElevation(z: number) {
  return Math.sin(z/310)*19 + Math.sin(z/137)*4;
}
export function ruralSlope(z: number) {
  return Math.cos(z/310)*19/310 + Math.cos(z/137)*4/137;
}
export function ruralTraffic(random: ()=>number): Traffic[] {
  const vehicles:Traffic[]=[];
  // Sparse farm traffic leaves time to read crests and choose an overtake.
  for(let z=720,i=0;z<9000;z+=690+random()*150,i++) {
    const tractor=i%3!==2, oncoming=i%4===2 || i%5===3;
    vehicles.push({id:`farm-${i}`,kind:tractor?'tractor':'car',x:oncoming?-2.1:2.1,z,
      speed:(oncoming?-1:1)*(tractor?7+random()*3:17+random()*4),
      color:tractor?(i%2?'#d78143':'#6e9654'):['#d5c29f','#85a6ad','#d28a63'][i%3]});
  }
  return vehicles;
}
export function ruralObstacles(condition: RaceCondition): Obstacle[] {
  // Single-side patches on visible straights, never a wall across both lanes.
  return [2010,3520,5070,6650].map((z,i)=>({id:`soil-${i}`,kind:condition==='rain'?'mud':'gravel',x:i%2?-2.7:2.7,z}));
}
export function ruralEvent(seed: number, condition: RaceCondition): RaceState['scenicEvent'] {
  if(decorHash(seed^0x5ac1b0)>=.33)return undefined;
  const sites=[2070,3530,5150,6710];
  return {kind:raceCondition(condition)==='night'?'boitata':'saci',z:sites[Math.floor(decorHash(seed^0x70ba1)*sites.length)],startedAt:null,duration:8};
}
