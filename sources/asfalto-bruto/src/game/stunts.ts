import { roadHalf } from './road-profile';
import type { Command, RaceState, Rider, Traffic } from './types';

export const WHEELIE_USES = 3;
export const WHEELIE_DURATION = 2.4;
export const WHEELIE_MIN_SPEED = 20;
export const JUMP_DURATION = 1;
export const wheeliesLeft = (r: Rider) => r.wheeliesLeft ?? WHEELIE_USES;
export const stunting = (r: Rider) => (r.wheelieTime ?? 0)>0 || (r.jumpTime ?? 0)>0;
export function jumpHeight(r: Rider) {
  return !(r.jumpTime!>0) || r.crash || r.out || r.finishedAt!==null ? 0 : Math.max(0,Math.sin(Math.PI*(1-(r.jumpTime ?? 0)/JUMP_DURATION)))*2.2;
}
export function cancelStunt(r: Rider) { r.wheelieTime=0;r.jumpTime=0;r.jumpTarget=undefined; }
export function advanceStunt(state: RaceState, rider: Rider, command: Command, dt: number) {
  if(rider.jumpTime) {
    rider.jumpTime=Math.max(0,rider.jumpTime-dt);
    if(!rider.jumpTime)rider.jumpTarget=undefined;
  }
  if(!rider.wheelieTime)return;
  rider.wheelieTime=Math.max(0,rider.wheelieTime-dt);
  if(command.brake>.2 || rider.speed<WHEELIE_MIN_SPEED || Math.abs(rider.x)>roadHalf(state.trackId))rider.wheelieTime=0;
  if(!rider.wheelieTime)return;
  const target=state.traffic.filter(t=>t.kind==='car' && t.speed<0 && Math.abs(t.x-rider.x)<1.7)
    .map(t=>({t,ttc:(t.z-rider.z)/(rider.speed-t.speed)}))
    .filter(({ttc})=>ttc>=.16 && ttc<=.38).sort((a,b)=>a.ttc-b.ttc)[0]?.t;
  if(!target)return;
  // One activation permits one jump over one approaching car, never blanket immunity.
  rider.wheelieTime=0;rider.jumpTime=JUMP_DURATION;rider.jumpTarget=target.id;rider.attack=null;
}
export function clearsCar(rider: Rider, traffic: Traffic) {
  return traffic.kind==='car' && traffic.speed<0 && rider.jumpTarget===traffic.id && (rider.jumpTime ?? 0)>0 && jumpHeight(rider)>1.1;
}
