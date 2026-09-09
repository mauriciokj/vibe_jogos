import { clamp, getTrack } from './content';
import type { RaceState, Rider } from './types';

export const FINISH_SECONDS = 4.8;
export function finishPullback(elapsed: number) {
  const t=clamp((elapsed-.35)/3.8,0,1);
  return t*t*(3-2*t);
}
export function finishWinner(state: RaceState): Rider | undefined {
  return state.riders.filter(r=>r.profile!=='police' && !r.out && r.finishedAt!==null)
    .sort((a,b)=>a.finishedAt!-b.finishedAt!)[0];
}

// Presentation only: coasting, parking and camera time never alter race results,
// replay inputs, collisions, garage rewards or the authoritative online state.
export function finishScene(state: RaceState, localId: string, elapsed: number | null) {
  const winner=finishWinner(state),length=getTrack(state.trackId).distance;
  const local=state.riders.find(r=>r.id===localId) ?? state.riders[0];
  const time=elapsed===null?state.time:Math.max(state.time,(local.finishedAt ?? state.time)+elapsed);
  const soloFinish=elapsed!==null && !state.multiplayer && state.mode==='finished' && local.finishedAt!==null;
  // Solo physics freezes at the player's finish. Estimate the remaining visual
  // arrivals from that frozen state, without recording official times.
  const arrivals=new Map(state.riders.filter(r=>!r.out && r.profile!=='police').map(r=>[
    r.id,r.finishedAt ?? (soloFinish && r.speed>0 ? state.time+Math.max(0,length-r.z)/r.speed : Infinity),
  ]));
  const finishers=state.riders.filter(r=>Number.isFinite(arrivals.get(r.id))).sort((a,b)=>arrivals.get(a.id)!-arrivals.get(b.id)!);
  const riders=state.riders.map(r=>{
    const arrival=arrivals.get(r.id) ?? Infinity;
    if(Number.isFinite(arrival) && (r.finishedAt!==null || time>=arrival)){
      const age=Math.max(0,time-arrival),t=1-Math.pow(1-clamp(age/2.4,0,1),3);
      const place=finishers.indexOf(r),x=place===0?0:(place%2?1:-1)*2.8,z=length+18+(place===0?0:Math.floor((place-1)/2)*5-4);
      return {...r,x:r.x+(x-r.x)*t,z:length+(z-length)*t,speed:r.speed*(1-t),lean:0,attack:null,crash:0,immune:0,kneeTime:0,jumpTime:0,wheelieTime:0,nitroTime:0,speech:undefined};
    }
    if(soloFinish && Number.isFinite(arrival))return {...r,z:r.z+r.speed*Math.max(0,time-state.time),attack:null,lean:0};
    return r;
  });
  return {state:{...state,time,riders},winnerId:winner?.id ?? null,pullback:elapsed===null?0:finishPullback(elapsed)};
}
