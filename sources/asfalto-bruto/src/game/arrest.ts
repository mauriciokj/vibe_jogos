import { clamp } from './content';
import type { RaceState, Rider } from './types';

export const ARREST_SECONDS=6.4;
export type ArrestPhase='arriving'|'dismounting'|'walking'|'cuffing'|'cuffed';
const ease=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
export interface ArrestPose { id:string; x:number; z:number; side:number; phase:ArrestPhase; frame:number; }
/** A frozen copy of the confirmed result drives the scene, also online.
 * No animation writes positions, damage, time or rewards back to the race. */
export function arrestScene(source:RaceState,localId:string,elapsed:number){
 const age=clamp(elapsed,0,ARREST_SECONDS),local=source.riders.find(r=>r.id===localId) ?? source.riders[0];
 const officer=source.riders.filter(r=>r.profile==='police'&&!r.out&&!r.crash).sort((a,b)=>Math.hypot(a.x-local.x,a.z-local.z)-Math.hypot(b.x-local.x,b.z-local.z))[0]
  ?? {...local,id:'arrest-officer',profile:'police' as const,name:'POLÍCIA',color:'#e7e9e5',x:local.x+3,z:local.z+8,recovery:undefined,crash:0,out:undefined};
 const side=officer.x>=local.x?1:-1,wasFallen=!!local.recovery;
 const suspectX=local.x+(wasFallen?0:-side*.9),suspectZ=local.z;
 const parkX=suspectX+side*2.8,parkZ=suspectZ+1.5,coast=ease(age/1.1);
 const parked={...officer,x:officer.x+(parkX-officer.x)*coast,z:officer.z+(parkZ-officer.z)*coast,speed:officer.speed*(1-coast),lean:0,attack:null,recovery:undefined,crash:0,immune:0} as Rider;
 const phase:ArrestPhase=age<1.1?'arriving':age<1.75?'dismounting':age<3.3?'walking':age<4.8?'cuffing':'cuffed';
 const dismount=ease((age-1.1)/.65),walk=ease((age-1.75)/1.55);
 const police:ArrestPose={id:officer.id,x:parkX-side*.65*dismount+(suspectX+side*1.15-(parkX-side*.65))*walk+side*.55*ease((age-4.8)/.7),z:parkZ+(suspectZ-.05-parkZ)*walk,side:-side,phase,frame:Math.floor(age*8)%4};
 const suspect={...local,x:suspectX,z:suspectZ,speed:0,lean:0,attack:null,immune:0,
  recovery:local.recovery?{...local.recovery,bikeVX:0,bikeVZ:0,vx:0,vz:0,phase:'gettingUp' as const,timer:.75*(1-ease((age-.5)/1.3))}:undefined};
 const riders:Rider[]=source.riders.filter(r=>r.id!==officer.id).map(r=>r.id===localId?suspect:{...r,speed:0,attack:null});riders.push(parked);
 return {state:{...source,time:source.time+age,riders},suspect,police,wasFallen,standing:age>=1.8,cuffed:age>=4.8,pullback:ease(age/4.6),elapsed:age,bike:{x:local.x,z:local.z}};
}
export type ArrestScene=ReturnType<typeof arrestScene>;
