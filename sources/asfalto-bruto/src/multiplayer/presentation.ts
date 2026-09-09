import { guardRailPosition } from '../game/guardrails';
import { attackSpec, predictMovement, STEP, nearestTarget } from '../game/simulation';
import { clamp } from '../game/content';
import { NITRO_MULTIPLIER } from '../game/equipment';
import { EMPTY_COMMAND, type AttackKind, type Command, type RaceState, type Rider } from '../game/types';
import type { RoomView } from './protocol';

interface Correction { x: number; z: number; at: number; zDecay: number; }
const MAX_LEAD = .35;
const copyRider = (r: Rider): Rider => ({...r,attack:r.attack?{...r.attack}:null});

/** All bikes are presented on one timeline. Snapshot corrections start from
 * the currently drawn pose, including any correction still being blended out. */
export class RacePresentation {
  private room: RoomView | null = null;
  private receivedAt = 0;
  private ageAtReceipt = 0;
  private controls: {at:number;command:Command}[] = [];
  private velocity = new Map<string,{x:number;acceleration:number}>();
  private corrections = new Map<string,Correction>();
  private swing?: {kind:AttackKind;at:number;side:number;seq:number};
  private lastSwing = 0;
  private nextAttackAt = 0;
  constructor(readonly id: string) {}

  control(command: Command, now: number) {
    this.controls.push({at:now,command:{...command,attack:null}});
    while(this.controls.length>1 && this.controls[1].at<now-1500)this.controls.shift();
  }
  canAttack(kind: AttackKind, now: number) {
    const r=this.view(now)?.riders.find(r=>r.id===this.id);
    return !!r && now>=this.nextAttackAt && !r.out && !r.crash && !(r.jumpTime!>0) && r.finishedAt===null && (kind!=='weapon' || r.weapon);
  }
  attack(kind: AttackKind, seq: number, now: number) {
    const view=this.view(now),r=view?.riders.find(r=>r.id===this.id);if(!r || !view)return;
    const target=nearestTarget(view,r,kind);
    this.swing={kind,seq,at:now,side:target?Math.sign(target.x-r.x)||1:Math.sign(this.controls.at(-1)?.command.steer ?? 0)||1};
    this.lastSwing=seq;this.nextAttackAt=now+attackSpec(r,kind).cooldown*1000;
  }
  accept(room: RoomView, now: number, serverNow: number) {
    const before=this.view(now),previous=this.room;
    this.room=room;this.receivedAt=now;
    this.ageAtReceipt=clamp((serverNow-room.simulationAt)/1000,0,MAX_LEAD);
    const elapsed=previous?(room.simulationAt-previous.simulationAt)/1000:0;
    for(const r of room.race?.riders ?? []) {
      const old=previous?.race?.riders.find(p=>p.id===r.id);
      if(old && elapsed>0) this.velocity.set(r.id,{
        x:clamp((r.x-old.x)/elapsed,-9,9),
        acceleration:clamp((r.speed-old.speed)/elapsed,-29,r.acceleration),
      });
      const drawn=before?.riders.find(p=>p.id===r.id);
      const projected=this.project(r,now);
      const discontinuity=!drawn || !!drawn.crash!==!!r.crash || drawn.out!==r.out || drawn.finishedAt!==r.finishedAt || Math.abs(drawn.z-projected.z)>40;
      if(discontinuity)this.corrections.delete(r.id);
      else this.corrections.set(r.id,{
        x:drawn.x-projected.x,z:drawn.z-projected.z,at:now,
        // Limit the rate of forward-position correction so ordinary updates
        // cannot pull a travelling bike backwards through the camera.
        zDecay:Math.max(150,Math.abs(drawn.z-projected.z)/Math.max(4,r.speed*.65)*1000),
      });
    }
  }
  private age(now: number) {return Math.min(MAX_LEAD,this.ageAtReceipt+Math.max(0,now-this.receivedAt)/1000);}
  private project(source: Rider, now: number): Rider {
    const r=copyRider(source),race=this.room!.race!;
    const age=this.age(now),canMove=!r.out && r.finishedAt===null;
    if(r.id===this.id && canMove && !r.crash) {
      const steps=Math.floor(age/STEP),start=now-age*1000;let index=0;
      for(let i=0;i<steps;i++) {
        const at=start+(i+1)*STEP*1000;
        while(index+1<this.controls.length && this.controls[index+1].at<=at)index++;
        const command=this.controls[index]?.command ?? EMPTY_COMMAND;
        predictMovement(race,r,command);
      }
      // Fractional movement avoids the 60Hz projection staircase at snapshot receipt.
      const fraction=age-steps*STEP;
      const next=copyRider(r);predictMovement(race,next,this.controls.at(-1)?.command ?? EMPTY_COMMAND);
      r.x+=(next.x-r.x)*fraction/STEP;r.z+=(next.z-r.z)*fraction/STEP;
    } else if(canMove && !r.crash) {
      const velocity=this.velocity.get(r.id);
      const acceleration=velocity?.acceleration ?? 0;
      r.z+=Math.max(0,r.speed*age+.5*acceleration*age*age);
      r.x=clamp(r.x+(velocity?.x ?? 0)*age,-10.5,10.5);
      r.speed=clamp(r.speed+acceleration*age,0,Math.max(r.speed,r.maxSpeed*((r.nitroTime ?? 0)>0?NITRO_MULTIPLIER:1)));
      if(r.kneeTime)r.kneeTime=Math.max(0,r.kneeTime-age);
      if(r.wheelieTime)r.wheelieTime=Math.max(0,r.wheelieTime-age);
      if(r.jumpTime)r.jumpTime=Math.max(0,r.jumpTime-age);
      if(r.nitroTime)r.nitroTime=Math.max(0,r.nitroTime-age);
    } else if(canMove && r.crash) r.z+=r.speed*(1-Math.pow(.975,age/STEP))*STEP/(1-.975);
    if(r.attack) {
      r.attack.age+=age;
      if(r.attack.age>=attackSpec(r,r.attack.kind).duration+(r.profile==='player'?0:.25))r.attack=null;
    }
    return r;
  }
  view(now: number): RaceState | null {
    const race=this.room?.race;if(!race)return null;
    const age=this.age(now);
    return {...race,time:race.time+age,riders:race.riders.map(source=>{
      const r=this.project(source,now),correction=this.corrections.get(r.id);
      if(correction){
        const elapsed=Math.max(0,now-correction.at);
        const lastMotion=this.receivedAt+(MAX_LEAD-this.ageAtReceipt)*1000;
        const zElapsed=correction.z>0?Math.max(0,Math.min(now,lastMotion)-correction.at):elapsed;
        r.x+=correction.x*Math.exp(-elapsed/110);r.z+=correction.z*Math.exp(-zElapsed/correction.zDecay);
      }
      if(r.id===this.id) {
        if(r.attack?.id && r.attack.id<=this.lastSwing)r.attack=null;
        if(this.swing && !r.crash && !r.out && !(r.jumpTime!>0) && r.finishedAt===null) {
          const age=(now-this.swing.at)/1000;
          if(age<attackSpec(r,this.swing.kind).duration)r.attack={id:this.swing.seq,kind:this.swing.kind,side:this.swing.side,age,hit:false};
        }
      }
      r.x=guardRailPosition(race.trackId,r.x,r.z);
      return r;
    }),traffic:race.traffic.map(t=>({...t,z:t.z+t.speed*age}))};
  }
}
