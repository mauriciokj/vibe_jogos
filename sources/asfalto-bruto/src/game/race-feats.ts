import { getTrack, trackCorners, curveAt } from './content';
import { roadHalf } from './road-profile';
import { kneeContact } from './equipment';
import type { RaceState, Rider } from './types';

export interface RaceFeats {
 clean:boolean;knocked:string[];policeDown:boolean;carJumps:string[];terraJump:boolean;
 lastAtHalf:boolean;latePass:boolean;kneeCurve:boolean;
 curve?:{start:number;end:number;valid:boolean;contact:number};
}
export const newRaceFeats=(clean=true):RaceFeats=>({clean,knocked:[],policeDown:false,carJumps:[],terraJump:false,lastAtHalf:false,latePass:false,kneeCurve:false});
export function creditKnock(actor:Rider,target:Rider,previousFalls:number){
 if(target.falls<=previousFalls||actor.id===target.id)return;
 const f=actor.feats ??=newRaceFeats(false);
 if(target.profile==='police')f.policeDown=true;
 else if(!f.knocked.includes(target.id))f.knocked.push(target.id);
}
export function creditCarJump(r:Rider,id:string){const f=r.feats ??=newRaceFeats(false);if(!f.carJumps.includes(id)&&f.carJumps.length<3)f.carJumps.push(id);}
export function trackRaceFeats(state:RaceState,before:Map<string,{z:number;health:number;integrity:number}>,order:string[],dt:number){
 const distance=getTrack(state.trackId).distance,eligible=state.riders.filter(r=>r.profile!=='police');
 for(const r of eligible){
  const old=before.get(r.id);if(!old||r.finishedAt!==null)continue;
  const f=r.feats ??=newRaceFeats(false);
  if(r.health<old.health || r.integrity<old.integrity)f.clean=false;
  if(old.z<distance/2 && r.z>=distance/2 && eligible.length>1)f.lastAtHalf=order.at(-1)===r.id;
  const leader=state.riders.find(other=>other.id===order[0]);
  if(leader&&leader.id!==r.id&&leader.finishedAt===null&&!leader.out&&old.z>=distance-100&&old.z<distance&&r.z>leader.z)f.latePass=true;
  const corner=trackCorners(state.trackId).find(c=>old.z<c.start&&r.z>=c.start);
  if(corner)f.curve={start:corner.start,end:corner.end,valid:true,contact:0};
  if(f.curve){
   if(r.recovery||r.out||Math.abs(r.x)>roadHalf(state.trackId))f.curve.valid=false;
   if(kneeContact(r,curveAt(old.z,state.trackId),state.trackId))f.curve.contact+=dt;
   if(r.z>=f.curve.end){if(f.curve.valid&&f.curve.contact>=.5)f.kneeCurve=true;delete f.curve;}
  }
 }
}
