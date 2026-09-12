import type { Rider } from './types';

// A discrete, replayable stroke supplies a short burst of effort. Holding the
// throttle provides no effort; a small cap prevents stockpiling taps or packets.
export const PEDAL_SECONDS=.36, PEDAL_BUFFER=.5, PEDAL_INTERVAL=.14;
export function pedal(r:Rider){
  if((r.pedalCooldown ?? 0)>0)return;
  r.pedalTime=Math.min(PEDAL_BUFFER,(r.pedalTime ?? 0)+PEDAL_SECONDS);
  r.pedalCooldown=PEDAL_INTERVAL;
}
export function advancePedaling(r:Rider,dt:number){
  r.pedalCooldown=Math.max(0,(r.pedalCooldown ?? 0)-dt);
  if((r.pedalTime ?? 0)>0 && !r.recovery && !r.out && r.finishedAt===null){
    r.pedalPhase=((r.pedalPhase ?? 0)+Math.min(dt,r.pedalTime!)*Math.PI*5)%(Math.PI*2);
    r.pedalTime=Math.max(0,r.pedalTime!-dt);
  }
}
