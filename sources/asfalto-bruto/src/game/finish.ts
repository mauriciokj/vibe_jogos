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
  const finishers=state.riders.filter(r=>r.finishedAt!==null && !r.out && r.profile!=='police').sort((a,b)=>a.finishedAt!-b.finishedAt!);
  const riders=state.riders.map(r=>{
    if(r.finishedAt!==null && !r.out && r.profile!=='police'){
      const age=Math.max(0,time-r.finishedAt),t=1-Math.pow(1-clamp(age/2.4,0,1),3);
      const place=finishers.indexOf(r),x=place===0?0:(place%2?1:-1)*2.8,z=length+18+(place===0?0:Math.floor((place-1)/2)*5-4);
      return {...r,x:r.x+(x-r.x)*t,z:length+(z-length)*t,speed:r.speed*(1-t),lean:0,attack:null,crash:0,immune:0,kneeTime:0,jumpTime:0,wheelieTime:0,nitroTime:0,speech:undefined};
    }
    // When solo simulation stops, background riders coast out of the shot.
    if(elapsed!==null && state.mode==='finished' && !r.out && r.profile!=='police')return {...r,z:r.z+r.speed*Math.max(0,time-state.time),attack:null,lean:0};
    return r;
  });
  return {state:{...state,time,riders},winnerId:winner?.id ?? null,pullback:elapsed===null?0:finishPullback(elapsed)};
}
