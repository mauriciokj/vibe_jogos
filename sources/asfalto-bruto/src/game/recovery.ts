import { clamp, getTrack } from './content';
import { guardRailPosition } from './guardrails';
import { lateralLimit } from './road-profile';
import type { Command, RaceState, Rider } from './types';

export const RUN_SPEED=7.2, MOUNT_DISTANCE=1.35, MOUNT_SECONDS=.65;
export const EXPLOSION_SECONDS=1.8;
const reachableX=(s:RaceState,x:number,z:number)=>guardRailPosition(s.trackId,clamp(x,-lateralLimit(s.trackId)+.5,lateralLimit(s.trackId)-.5),z);
const move=(v:number,drag:number,dt:number)=>Math.sign(v)*Math.max(0,Math.abs(v)-drag*dt);
export function beginRecovery(s:RaceState,r:Rider,kind:'spill'|'impact'='spill'){
 const speed=clamp(r.speed,0,80),side=r.lean<0?-1:1;
 r.recovery={origin:{x:r.x,z:r.z,speed:r.speed,lean:r.lean},phase:'sliding',bikeX:r.x,bikeZ:r.z,bikeVX:r.lean*1.5,bikeVZ:speed*(kind==='impact'?.2:.8),vx:r.lean*1.5,vz:Math.min(35,speed*.58),timer:0,age:0,cycle:0,facingX:0,facingZ:1,hitCooldown:.65,hits:0};
 r.x=reachableX(s,r.x+side*.7,r.z);r.crash=.001;r.speed=0;r.health=Math.max(24,r.health);r.lean=0;
}
export function recoveryCommand(r:Rider):Command{
 const f=r.recovery;if(!f)return {throttle:0,brake:0,steer:0,attack:null};
 const dx=f.bikeX-r.x,dz=f.bikeZ-r.z,len=Math.max(1,Math.hypot(dx,dz));
 return {throttle:Math.max(0,dz/len),brake:Math.max(0,-dz/len),steer:clamp(dx/len,-1,1),attack:null};
}
export function advanceRecovery(s:RaceState,r:Rider,cmd:Command,dt:number,confirm=true){
 const f=r.recovery;if(!f)return;
 f.age+=dt;f.hitCooldown=Math.max(0,f.hitCooldown-dt);r.crash=.001;r.speed=0;r.attack=null;
 if(f.phase==='exploding'){
  f.timer=Math.max(0,f.timer-dt);
  r.z=clamp(r.z+f.vz*dt,0,getTrack(s.trackId).distance+35);r.x=reachableX(s,r.x+f.vx*dt,r.z);
  f.vx=move(f.vx,5,dt);f.vz=move(f.vz,5,dt);return;
 }
 const wet=s.condition==='rain',ground=s.trackId==='terra';
 const bikeDrag=(ground?12:10)*(wet?.8:1),bodyDrag=(ground?13:12)*(wet?.82:1);
 const bx=f.bikeX+f.bikeVX*dt,bz=f.bikeZ+f.bikeVZ*dt;
 f.bikeX=reachableX(s,bx,bz);f.bikeZ=clamp(bz,0,getTrack(s.trackId).distance+35);
 if(Math.abs(bx-f.bikeX)>.001)f.bikeVX=0;
 f.bikeVX=move(f.bikeVX,bikeDrag,dt);f.bikeVZ=move(f.bikeVZ,bikeDrag,dt);
 if(f.phase==='sliding'){
  const x=r.x+f.vx*dt;r.z=clamp(r.z+f.vz*dt,0,getTrack(s.trackId).distance+35);r.x=reachableX(s,x,r.z);
  if(Math.abs(x-r.x)>.001)f.vx=0;
  f.vx=move(f.vx,bodyDrag,dt);f.vz=move(f.vz,bodyDrag,dt);
  if(confirm && Math.hypot(f.vx,f.vz)<.15){f.phase='gettingUp';f.timer=.75;}
 }else if(f.phase==='gettingUp'){
  f.timer=Math.max(0,f.timer-dt);if(confirm && f.timer===0)f.phase='walking';
 }else if(f.phase==='walking'){
  // During online prediction, wait at the bike for the server to confirm pickup.
  if(!confirm && Math.hypot(r.x-f.bikeX,r.z-f.bikeZ)<=MOUNT_DISTANCE && Math.hypot(f.bikeVX,f.bikeVZ)<.2)return;
  const dz=clamp(cmd.throttle-cmd.brake,-1,1),dx=clamp(cmd.steer,-1,1),norm=Math.max(1,Math.hypot(dx,dz));
  if(Math.hypot(dx,dz)>.05){f.facingX=dx/norm;f.facingZ=dz/norm;f.cycle+=dt*9*Math.hypot(dx,dz)/norm;}
  r.z=clamp(r.z+RUN_SPEED*dt*dz/norm,0,getTrack(s.trackId).distance+35);r.x=reachableX(s,r.x+RUN_SPEED*dt*dx/norm,r.z);
  if(confirm && Math.hypot(r.x-f.bikeX,r.z-f.bikeZ)<=MOUNT_DISTANCE && Math.hypot(f.bikeVX,f.bikeVZ)<.2){
   if(r.integrity<=0)explodeBike(s,r);
   else {f.phase='mounting';f.timer=MOUNT_SECONDS;}
  }
 }else{
  if(r.integrity<=0){if(confirm)explodeBike(s,r);return;}
  f.timer=Math.max(0,f.timer-dt);r.x+=(f.bikeX-r.x)*Math.min(1,dt*9);r.z+=(f.bikeZ-r.z)*Math.min(1,dt*9);
  if(confirm && f.timer===0){r.x=f.bikeX;r.z=f.bikeZ;r.speed=0;r.crash=0;r.immune=1.1;delete r.recovery;s.events.push({type:'pass',actor:r.id,text:'DE VOLTA À MOTO!'});}
 }
}
function explodeBike(s:RaceState,r:Rider){
 const f=r.recovery!;f.phase='exploding';f.timer=EXPLOSION_SECONDS;f.bikeVX=0;f.bikeVZ=0;
 f.vx=(r.x<f.bikeX?-1:1)*3;f.vz=r.z<f.bikeZ?-3:3;f.hitCooldown=EXPLOSION_SECONDS;
 s.events.push({type:'explosion',actor:r.id,text:'A MOTO EXPLODIU!'});
}
export function hitPedestrian(s:RaceState,r:Rider,source:string,speed:number,pushX:number){
 const f=r.recovery;if(!f || f.phase==='exploding' || f.hitCooldown>0 || r.out)return false;
 f.origin={x:r.x,z:r.z,speed:0,lean:pushX};f.hitCooldown=1.4;f.hits++;f.phase='sliding';f.timer=0;f.vz=Math.sign(speed)*clamp(Math.abs(speed)*.12,2,7);f.vx=clamp(pushX,-1,1)*1.5;
 r.health=Math.max(1,r.health-clamp(9+Math.abs(speed)*.24,12,27));
 s.events.push({type:'hit',actor:source,target:r.id,text:r.id==='player'?'ATROPELADO!':undefined});return true;
}
