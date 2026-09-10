import { clamp, getTrack } from './content';
import { roadHalf } from './road-profile';
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

export interface FinishPoliceArrival { id:string; x:number; z:number; speed:number; time:number; arrival:number; }
export function finishPoliceArrival(state:RaceState,localId:string):FinishPoliceArrival|null {
 const local=state.riders.find(r=>r.id===localId);if(!local || local.finishedAt===null)return null;
 const end=getTrack(state.trackId).distance;
 const officer=state.riders.find(r=>r.profile==='police' && !r.out && !r.crash && r.integrity>0 && r.z>=end-160 && r.z<=end+40 && (r.z>=end || r.speed>5));
 if(!officer)return null;
 const eta=Math.max(0,end-officer.z)/Math.max(5,officer.speed);if(eta>3.5)return null;
 return {id:officer.id,x:officer.x,z:officer.z,speed:officer.speed,time:state.time,arrival:state.time+eta};
}
export interface FinishPolicePose { id:string; x:number; z:number; phase:'arriving'|'dismounting'|'walking'|'striking'; side:number; frame:number; targetId:string|null; hit:boolean; strike:number; }

// Presentation only: coasting, parking and camera time never alter race results,
// replay inputs, collisions, garage rewards or the authoritative online state.
export function finishScene(state: RaceState, localId: string, elapsed: number | null, officer=finishPoliceArrival(state,localId)) {
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
  let police:FinishPolicePose|null=null;
  if(elapsed!==null && officer && local.finishedAt!==null){
    const index=riders.findIndex(r=>r.id===officer.id),age=time-officer.arrival;
    if(index>=0){
      const parkX=-roadHalf(state.trackId)+.7,parkZ=length+9;
      const coast=1-Math.pow(1-clamp(age/.8,0,1),3),r=riders[index];
      riders[index]={...r,x:officer.x+(parkX-officer.x)*coast,z:age<0?officer.z+officer.speed*Math.max(0,time-officer.time):length+(parkZ-length)*coast,speed:age<0?officer.speed:officer.speed*(1-coast),lean:0,attack:null,crash:0,immune:0};
      police={id:r.id,x:parkX,z:parkZ,phase:'arriving',side:1,frame:0,targetId:null,hit:false,strike:-1};
      if(age>=.8){
        police.phase='dismounting';police.x=parkX+clamp((age-.8)/.5,0,1)*1.1;
        const patrol=age-1.3,slot=1.7,turn=Math.max(0,Math.floor(patrol/slot)),phase=Math.max(0,patrol-turn*slot);
        const turnStart=officer.arrival+1.3+turn*slot;
        const eligible=finishers.filter(r=>turnStart>arrivals.get(r.id)!+1);
        if(patrol>=0 && eligible.length){
          const previousEligible=finishers.filter(r=>turnStart-slot>arrivals.get(r.id)!+1);
          const target=eligible[turn%eligible.length],previous=turn&&previousEligible.length?previousEligible[(turn-1)%previousEligible.length]:null;
          const position=(id:string)=>{const place=finishers.findIndex(r=>r.id===id);return {x:place===0?0:(place%2?1:-1)*2.8,z:length+18+(place===0?0:Math.floor((place-1)/2)*5-4)};};
          const to=position(target.id),from=previous?position(previous.id):{x:parkX+2.2,z:parkZ+1};
          const walk=clamp(phase/1.1,0,1),side=to.x>=from.x?1:-1;
          police={id:r.id,x:from.x+(to.x-side*1.2-from.x)*walk,z:from.z+(to.z-1-from.z)*walk,phase:phase<1.1?'walking':'striking',side,frame:phase<1.1?Math.floor(phase*8)%4:Math.min(3,Math.floor((phase-1.1)*7)),targetId:target.id,hit:phase>=1.27&&phase<1.47,strike:phase>=1.27?turn:-1};
        }
      }
    }
  }
  return {state:{...state,time,riders},police,winnerId:winner?.id ?? null,pullback:elapsed===null?0:finishPullback(elapsed)};
}
