import { roadHalf } from './road-profile';
import { isRamp, obstacleShape } from './hazards';
import type { Command, RaceState, Rider, Traffic, Obstacle } from './types';

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
function launch(rider: Rider, target: string) {
  rider.wheelieTime=0;rider.jumpTime=JUMP_DURATION;rider.jumpTarget=target;rider.attack=null;rider.kneeTime=0;rider.wetKneeTicks=0;
}
export function advanceStunt(state: RaceState, rider: Rider, command: Command, dt: number) {
  if(rider.jumpTime) {
    rider.jumpTime=Math.max(0,rider.jumpTime-dt);
    if(!rider.jumpTime)rider.jumpTarget=undefined;
  }
  if(rider.crash || rider.out || rider.finishedAt!==null)return;
  if(!(rider.jumpTime!>0) && rider.speed>=8){
    const fallen=state.riders.find(other=>other.id!==rider.id && other.recovery && other.recovery.bikeZ>=rider.z && other.recovery.bikeZ-rider.z<=2+rider.speed*dt && Math.abs(other.recovery.bikeX-rider.x)<1.65);
    if(fallen){launch(rider,`fallen:${fallen.id}:${fallen.falls}`);return;}
    const ramp=state.obstacles.find(o=>isRamp(o) && o.z>=rider.z && o.z-rider.z<=1.5+rider.speed*dt && Math.abs(o.x-rider.x)<obstacleShape(o).contact);
    if(ramp){launch(rider,ramp.id);return;}
  }
  if(!rider.wheelieTime)return;
  rider.wheelieTime=Math.max(0,rider.wheelieTime-dt);
  if(command.brake>.2 || rider.speed<WHEELIE_MIN_SPEED || Math.abs(rider.x)>roadHalf(state.trackId))rider.wheelieTime=0;
  if(!rider.wheelieTime)return;
  const targets: (Traffic | Obstacle)[]=[...state.traffic.filter(t=>t.kind==='car' && t.speed<0 && Math.abs(t.x-rider.x)<1.7),
    ...state.obstacles.filter(o=>o.kind==='fallenTree' && Math.abs(o.x-rider.x)<obstacleShape(o).contact)];
  const target=targets.map(t=>({t,ttc:(t.z-rider.z)/(rider.speed-('speed' in t?t.speed:0))}))
    .filter(({ttc})=>ttc>=.16 && ttc<=.38).sort((a,b)=>a.ttc-b.ttc)[0]?.t;
  if(!target)return;
  // One activation permits one jump over one target, never blanket immunity.
  launch(rider,target.id);
}
export function clearsObstacle(rider: Rider, obstacle: Obstacle) {
  if(isRamp(obstacle))return true;
  if(obstacle.kind==='fallenTree')return rider.jumpTarget===obstacle.id && (rider.jumpTime ?? 0)>0 && jumpHeight(rider)>1.1;
  return (obstacle.kind==='armadillo' || obstacle.kind==='tumbleweed') && jumpHeight(rider)>.65;
}
export function clearsCar(rider: Rider, traffic: Traffic) {
  return traffic.kind==='car' && traffic.speed<0 && rider.jumpTarget===traffic.id && (rider.jumpTime ?? 0)>0 && jumpHeight(rider)>1.1;
}
