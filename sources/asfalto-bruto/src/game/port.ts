import { decorHash } from './conditions';
import { trafficDirection } from './hazards';
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
  {start:2260,end:2400,side:1,queue:true}, {start:2910,end:3050,side:-1,queue:true}, {start:6370,end:6490,side:1,queue:false},
];
export function upcomingWorks(z: number) {
  const work=PORT_WORKS.find(w=>w.end>z && w.start-z<220);
  return work?{...work,distance:Math.max(0,Math.round(work.start-z))}:null;
}
export function portObstacles(): Obstacle[] {
  return PORT_WORKS.flatMap((work,i)=>[
    ...[0,30,60,100,140].map((offset,n)=>({id:`port-cone-${i}-${n}`,kind:'cone' as const,x:work.side*(work.queue ? .5 : n===0?6.3:n===1?5.7:4.5),z:work.start+offset})),
    ...[65,110].map((offset,n)=>({id:`port-block-${i}-${n}`,kind:'concrete' as const,x:work.side*(work.queue?3.5:5.8),z:work.start+offset,...work.queue?{width:6.8}:{}})),
  ]);
}
export function portTraffic(random:()=>number): Traffic[] {
  const traffic: Traffic[]=[];
  for(let z=900,i=0;z<9600;z+=560+random()*110,i++) {
    const oncoming=i%4===1,truck=oncoming || i%4===2;
    const vehicle:Traffic={id:`port-traffic-${i}`,kind:truck?'truck':i%3===0?'van':'car',x:oncoming?-1.75:1.75,z,
      speed:oncoming?-13-random()*4:truck?14+random()*4:19+random()*6,
      color:['#bf704f','#8babb2','#d4ba80','#548e88'][i%4]};
    if(!PORT_WORKS.some(w=>w.queue && Math.sign(vehicle.x)===w.side && z>w.start-140 && z<w.end+140))traffic.push(vehicle);
  }
  for(const [i,w] of PORT_WORKS.entries())if(w.queue)for(let n=0;n<5;n++)traffic.push({
    id:`port-queue-${i}-${n}`,kind:'car',x:w.side*1.75,z:w.side>0?w.start-18-n*12:w.end+18+n*12,
    speed:0,heading:w.side as 1|-1,queued:true,color:['#d9d1ab','#769ea2','#c77454','#dedfce','#698673'][n],
  });
  return traffic;
}
export function stopAtPortQueue(traffic: Traffic[],dt: number) {
  // Sort front to back in each direction, so a newly stopped car also protects
  // cars behind it in this tick. Stationary queues never recycle down the road.
  for(const direction of [1,-1]){
    const vehicles=traffic.filter(t=>trafficDirection(t)===direction).sort((a,b)=>direction*(b.z-a.z));
    for(const t of vehicles){
      if(!t.speed)continue;
      const ahead=vehicles.filter(v=>v.id!==t.id && v.queued && Math.abs(v.x-t.x)<2 && (v.z-t.z)*direction>=0)
        .sort((a,b)=>direction*(a.z-b.z))[0];
      const gap=t.kind==='truck'?14:12;
      if(ahead && (ahead.z-t.z)*direction<gap+Math.abs(t.speed)*dt){t.z=ahead.z-direction*gap;t.heading=direction as 1|-1;t.speed=0;t.queued=true;}
    }
  }
}
export function portPassengerEvent(seed:number,traffic:Traffic[]):RaceState['scenicEvent'] {
  if(decorHash(seed^0x70f311)>=.33)return undefined;
  const trucks=traffic.filter(t=>t.kind==='truck' && t.speed<0);
  if(!trucks.length)return undefined;
  const truck=trucks[Math.floor(decorHash(seed^0x319a97)*trucks.length)];
  return {kind:'truckPassenger',trafficId:truck.id,z:truck.z,startedAt:null,duration:8};
}
