import { decorHash } from './conditions';
import type { Obstacle, RaceState, Track, Traffic } from './types';

// Sixth campaign track; the standalone preview uses this same course.
export const FOREST_TRACK: Track = {
  id:'mata',name:'Mata Fechada',region:'ESTRADA DA FLORESTA',distance:7600,
  difficulty:'TÉCNICA',prize:2700,index:5,level:1,theme:'forest',
  sky:['#4b7885','#b3bc93','#e2cb92'],land:['#466c48','#416543'],
  road:['#52605a','#4c5954'],accent:'#bbdc8b',
};
export const FOREST_HAIRPIN={start:2310,end:2530,bend:-4.4,ramp:65};
export const FOREST_CORNERS = [
  [480,710,1.8],[780,1000,-2.05],[1060,1300,2.25],
  [1370,1610,-1.9],[1690,1940,2.15],
  [2310,2530,-2.3],[2600,2820,2.1],[2890,3110,-2.2],
  [3180,3400,1.95],[3460,3660,-1.8],
  [3970,4190,2.25],[4260,4480,-2.1],[4550,4760,2.35],
  [4830,5050,-2.15],[5110,5340,1.85],
  [5650,5870,-2.15],[5940,6160,2.3],[6230,6450,-1.95],
  [6520,6750,2.2],[6820,7090,-1.9],
].map(([start,end,bend])=>start===FOREST_HAIRPIN.start?FOREST_HAIRPIN:{start,end,bend,ramp:85});
export const FOREST_NARROWS=[{start:1120,end:2000},{start:3030,end:3890},{start:4840,end:5650},{start:6420,end:7200}];
export const FOREST_CANOPIES=[{start:900,end:1940},{start:2700,end:3870},{start:4560,end:5540},{start:6120,end:7100}];
const ramp=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
const sectionStrength=(z:number,sites:{start:number;end:number}[],fade:number)=>sites.reduce((v,s)=>Math.max(v,ramp((z-s.start)/fade)*ramp((s.end-z)/fade)),0);
export function forestRoad(z:number) {
  const narrow=sectionStrength(z,FOREST_NARROWS,180),half=4.2+2.1*(1-narrow),center=-2.1*(1-narrow);
  const backward=center-2.1,inner=center+2.1,outer=4.2-2.1*narrow;
  return {half,center,narrow,backward,inner,outer,lanes:narrow>.8?[backward,inner]:[backward,inner,outer]};
}
export const forestCover=(z:number)=>sectionStrength(z,FOREST_CANOPIES,120);
export const FOREST_MUD=[
  {start:1510,end:1690,side:1},{start:2950,end:3140,side:-1},
  {start:4290,end:4470,side:1},{start:5700,end:5900,side:-1},{start:6690,end:6870,side:1},
];
export function forestMudStrip(z:number) {
  const site=FOREST_MUD.find(s=>z>=s.start&&z<=s.end);if(!site)return null;
  const strength=ramp((z-site.start)/22)*ramp((site.end-z)/22),half=forestRoad(z).half;
  const center=site.side*(half-1.5)+Math.sin(z*.23)*.08,width=2.9*strength*(.86+.14*Math.sin(z*.16));
  return {left:center-width/2,right:center+width/2,strength};
}
export function forestMudAt(z:number,x:number) {
  const strip=forestMudStrip(z);if(!strip)return 0;
  return strip.strength*ramp((x-strip.left)/.35)*ramp((strip.right-x)/.35);
}
export type ForestAnimal='capybara'|'toucan'|'deer'|'anteater';
const animals:ForestAnimal[]=['capybara','toucan','deer','anteater'];
// Scenic residents never enter the road, obstacle list or physics RNG.
export const FOREST_WILDLIFE=Array.from({length:28},(_,i)=>{
  const z=610+i*248,side=i%2?-1:1;
  return {kind:animals[i%animals.length],z,x:side*(forestRoad(z).half+2.8),side};
});
export const forestElevation=(z:number)=>Math.sin(z/620)*9+Math.sin(z/230)*2.5;
export const FOREST_BRANCHES=[{z:2150,x:-4.5},{z:3850,x:3.1},{z:5500,x:-3.1}];
export function forestObstacles():Obstacle[] {
  return FOREST_BRANCHES.map((site,i)=>({id:`forest-branch-${i}`,kind:'fallenTree',width:2.6,...site}));
}
export function forestTrafficX(traffic:Traffic,z=traffic.z) {
  const road=forestRoad(z);
  return (traffic.heading ?? Math.sign(traffic.speed))<0?road.backward:traffic.forestLane===1?road.outer:road.inner;
}
export function forestTraffic(random:()=>number):Traffic[] {
  return Array.from({length:14},(_,i)=>{
    const t:Traffic={id:`forest-car-${i}`,kind:i%4===3?'van':'car',forestLane:i%2?1:0,
      x:0,z:950+i*540+random()*100,speed:i%3===0?-18:18+random()*7,
      color:['#cfb889','#82a798','#b88465','#9eaeb5'][i%4]};
    t.x=forestTrafficX(t);return t;
  });
}
export function forestEvent(seed:number):RaceState['scenicEvent'] {
  if(decorHash(seed^0x6d6163)>=.33)return undefined;
  const sites=[2200,3820,5500,7110];
  return {kind:'monkey',z:sites[Math.floor(decorHash(seed^0x6d6174)*sites.length)],startedAt:null,duration:8};
}
