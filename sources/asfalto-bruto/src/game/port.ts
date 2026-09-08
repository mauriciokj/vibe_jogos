import { decorHash } from './conditions';
import type { Obstacle, RaceState, Traffic } from './types';

// Access → warehouses → works → service bends → cranes → exit.
export const PORT_CORNERS = [
  {start:800,end:1550,bend:1.15,ramp:110}, {start:1740,end:2020,bend:-.9,ramp:90},
  {start:2450,end:2710,bend:1.95,ramp:85}, {start:2800,end:3070,bend:-2.1,ramp:85},
  {start:3440,end:3710,bend:1.6,ramp:90}, {start:3920,end:4180,bend:-2.15,ramp:85},
  {start:4360,end:4680,bend:1.5,ramp:90}, {start:5120,end:5580,bend:-.9,ramp:110},
  {start:5860,end:6210,bend:1.1,ramp:100}, {start:6550,end:6870,bend:-1.75,ramp:90},
  {start:7080,end:7420,bend:2.15,ramp:90},
];
export const PORT_WORKS = [
  {start:2260,end:2400,side:1}, {start:2910,end:3050,side:-1}, {start:6370,end:6490,side:1},
];
export function upcomingWorks(z: number) {
  const work=PORT_WORKS.find(w=>w.end>z && w.start-z<220);
  return work?{...work,distance:Math.max(0,Math.round(work.start-z))}:null;
}
export function portObstacles(): Obstacle[] {
  return PORT_WORKS.flatMap((work,i)=>[
    ...[0,30,60,100,140].map((offset,n)=>({id:`port-cone-${i}-${n}`,kind:'cone' as const,x:work.side*(n===0?6.3:n===1?5.7:4.5),z:work.start+offset})),
    ...[65,110].map((offset,n)=>({id:`port-block-${i}-${n}`,kind:'concrete' as const,x:work.side*5.8,z:work.start+offset})),
  ]);
}
export function portTraffic(random:()=>number): Traffic[] {
  const traffic: Traffic[]=[];
  for(let z=900,i=0;z<9600;z+=560+random()*110,i++) {
    const oncoming=i%4===1,truck=oncoming || i%4===2;
    // Leave the outer lanes open for passing; work sites occupy only a shoulder lane.
    traffic.push({id:`port-traffic-${i}`,kind:truck?'truck':i%3===0?'van':'car',x:oncoming?-1.75:1.75,z,
      speed:oncoming?-13-random()*4:truck?14+random()*4:19+random()*6,
      color:['#bf704f','#8babb2','#d4ba80','#548e88'][i%4]});
  }
  return traffic;
}
export function portPassengerEvent(seed:number,traffic:Traffic[]):RaceState['scenicEvent'] {
  if(decorHash(seed^0x70f311)>=.33)return undefined;
  const trucks=traffic.filter(t=>t.kind==='truck' && t.speed<0);
  if(!trucks.length)return undefined;
  const truck=trucks[Math.floor(decorHash(seed^0x319a97)*trucks.length)];
  return {kind:'truckPassenger',trafficId:truck.id,z:truck.z,startedAt:null,duration:8};
}
