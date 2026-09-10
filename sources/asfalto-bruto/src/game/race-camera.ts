import type { RaceState, Rider } from './types';

export interface CameraPose { x:number; y:number; z:number; horizon:number; focal:number; }
const mix=(a:CameraPose,b:CameraPose,t:number):CameraPose=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,horizon:a.horizon+(b.horizon-a.horizon)*t,focal:a.focal+(b.focal-a.focal)*t});
/** Presentation only: never moves a rider, a motorcycle or the simulation clock. */
export class RaceCamera {
 private pose:CameraPose|null=null;
 private frozen:CameraPose|null=null;
 private key='';
 private following=false;
 private lastTime=0;
 private lastZ=0;
 private returnFrom:CameraPose|null=null;
 private returnAge=0;
 mode:'riding'|'fall'|'walking'|'returning'='riding';
 reset(){this.pose=null;this.frozen=null;this.key='';this.following=false;this.returnFrom=null;this.lastTime=0;this.mode='riding';}
 update(state:RaceState,r:Rider,normal:CameraPose,origin:CameraPose,walking:CameraPose){
  const dt=Math.max(0,state.time-this.lastTime),f=r.recovery;
  if(f){
   const key=`${state.trackId}/${r.id}/${r.falls}/${f.hits}`;
   if(key!==this.key){
    const recent=this.pose && dt<=.15 && Math.abs((f.origin?.z ?? r.z)-this.lastZ)<10;
    this.frozen={...(recent?this.pose!:origin)};this.pose={...this.frozen};this.key=key;this.following=false;this.returnFrom=null;
   }
   // Hold the exact impact view until the player actually starts walking.
   if(f.phase==='walking' && f.cycle>0)this.following=true;
   if(this.following){this.pose=mix(this.pose!,walking,1-Math.exp(-2.5*dt));this.mode='walking';}
   else {this.pose={...this.frozen!};this.mode='fall';}
  }else if(this.key || this.returnFrom){
   if(!this.returnFrom){this.returnFrom={...this.pose!};this.returnAge=0;}
   // Decay a relative offset so the chase camera follows acceleration immediately
   // while gently removing the old walking composition.
   if(this.key){this.returnFrom={x:this.returnFrom.x-normal.x,y:this.returnFrom.y-normal.y,z:this.returnFrom.z-normal.z,horizon:this.returnFrom.horizon-normal.horizon,focal:this.returnFrom.focal-normal.focal};this.key='';}
   else this.returnAge+=dt;
   const t=Math.min(1,this.returnAge/1.2),fade=1-t*t*(3-2*t),offset=this.returnFrom;
   this.pose={x:normal.x+offset.x*fade,y:normal.y+offset.y*fade,z:normal.z+offset.z*fade,horizon:normal.horizon+offset.horizon*fade,focal:normal.focal+offset.focal*fade};this.mode='returning';
   if(t===1){this.returnFrom=null;this.mode='riding';}
  }else {this.pose={...normal};this.mode='riding';}
  this.lastTime=state.time;this.lastZ=r.z;return {...this.pose};
 }
}
