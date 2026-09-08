import type { RaceCondition, RaceState, Track } from './types';

export const CONDITIONS: { id: RaceCondition; name: string; icon: string; description: string }[] = [
  { id:'day', name:'Dia', icon:'☀', description:'Céu aberto e boa visibilidade.' },
  { id:'sunset', name:'Entardecer', icon:'◒', description:'Luz dourada e a estrada de sempre.' },
  { id:'night', name:'Noite', icon:'☾', description:'Luar, faróis e refletores pelo caminho.' },
  { id:'rain', name:'Chuva', icon:'☂', description:'Piso molhado. Freie antes e faça curvas suaves.' },
];
export function raceCondition(value: unknown): RaceCondition {
  return CONDITIONS.some(c=>c.id===value) ? value as RaceCondition : 'sunset';
}
export const conditionName = (value: unknown) => CONDITIONS.find(c=>c.id===raceCondition(value))!.name;
export const roadGrip = (value: unknown) => raceCondition(value)==='rain' ? .82 : 1;
export const brakeGrip = (value: unknown) => raceCondition(value)==='rain' ? .88 : 1;
export const recordKey = (trackId: string, value: unknown) => raceCondition(value)==='sunset' ? trackId : `${trackId}:${raceCondition(value)}`;
const palettes = new Map<string, Track>();
export function conditionTrack(track: Track, value: unknown): Track {
  const condition=raceCondition(value),key=`${track.id}:${condition}`;
  if(condition==='sunset')return track;
  const cached=palettes.get(key);if(cached)return cached;
  const desert=track.theme==='desert',port=track.theme==='port';
  const visual={...track,...(condition==='day'?{
    sky:['#287fad','#86cddb','#e2efd0'],land:port?['#8a9089','#7f867e']:desert?['#cc9b64','#c19360']:['#719d66','#65905b'],road:['#56646b','#515e65'],
  }:condition==='night'?{
    sky:['#060d23','#142746','#385975'],land:port?['#38484c','#324145']:desert?['#534d50','#4a4449']:['#29474a','#244044'],road:['#33434e','#2d3c48'],
  }:{
    sky:['#344d60','#688491','#acbbc0'],land:port?['#617377','#596a6e']:desert?['#9c8166','#90765d']:['#57786e','#4e6c64'],road:['#3b535e','#344a56'],
  })};
  palettes.set(key,visual);return visual;
}
export function seaColors(value: unknown) {
  const condition=raceCondition(value);
  return condition==='night'?{water:'#244957',foam:'#759fa7',sand:'#655f60'}:condition==='rain'?{water:'#537e8c',foam:'#b6d5d8',sand:'#aa9c85'}:condition==='day'?{water:'#3298a9',foam:'#bbe9da',sand:'#e3d4a0'}:{water:'#7aa4a4',foam:'#c0cdd1',sand:'#d4bd95'};
}
// A separate hash keeps decorative choices out of the simulation's RNG stream.
export function decorHash(seed: number) { let n=seed|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296; }
export function coastalEvent(trackId: string, seed: number): RaceState['scenicEvent'] {
  if(trackId!=='costa' || decorHash(seed^0x71ca510) >= .33)return undefined;
  const sites=[440,1540,2910,4180,6170];
  return {kind:'mermaid',z:sites[Math.floor(decorHash(seed^0x17cba52)*sites.length)],startedAt:null,duration:8};
}
export function advanceScenicEvent(state: RaceState) {
  const event=state.scenicEvent;if(!event || event.startedAt!==null || state.mode!=='racing')return;
  const humans=state.riders.filter(r=>r.profile==='player' && !r.out && r.finishedAt===null);
  if(event.kind==='truckPassenger'){
    const truck=state.traffic.find(t=>t.id===event.trafficId);
    if(truck && humans.some(r=>truck.z>=r.z-8 && truck.z-r.z<=180))event.startedAt=state.time;
  } else if(humans.some(r=>r.z>=event.z-180))event.startedAt=state.time;
}
export function scenicAppearance(state: RaceState) {
  const e=state.scenicEvent;if(!e || e.startedAt===null)return null;
  const age=state.time-e.startedAt;
  if(e.kind==='truckPassenger'){
    const truck=state.traffic.find(t=>t.id===e.trafficId);
    return truck && age>=0 && age<e.duration?{...e,z:truck.z,age,progress:age/e.duration}:null;
  }
  return age>=0 && age<e.duration ? {...e,age,progress:age/e.duration} : null;
}
