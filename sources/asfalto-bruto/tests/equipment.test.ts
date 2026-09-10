import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKES, curveAt, cornerSpeed, cornerForces } from '../src/game/content';
import { KNEE_PADS, KNEE_DURATION, NITRO_PRICE, cornerHandling, kneeSupport } from '../src/game/equipment';
import { roadGrip } from '../src/game/conditions';
import { DoubleTap } from '../src/game/controls';
import { TAUNTS, sayTaunt } from '../src/game/banter';
import { buyBike, buyKneePad, buyNitro, freshSave, loadSave, persist, recordOnlineNitro, SAVE_KEY } from '../src/game/save';
import { createRace, createMultiplayerRace, performAction, predictMovement, restoreSnapshot, snapshot, stepRace } from '../src/game/simulation';
import { EMPTY_COMMAND, type RaceCondition } from '../src/game/types';
import { inputKey, joinRoom, lobbyClock, makeMember, makeRoom, pulseRoom, viewRoom } from '../server/room';
import { cleanActions } from '../src/multiplayer/protocol';

function solo(condition: RaceCondition='day',bikeId='ferro',pad='gold') {
  const save=freshSave();save.cash=1000000;buyBike(save,bikeId);
  for(const tier of KNEE_PADS.slice(0,KNEE_PADS.findIndex(p=>p.id===pad)+1))buyKneePad(save,tier.id);
  buyNitro(save);buyNitro(save);
  const s=createRace('costa',save,321,condition);s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
  Object.assign(s.riders[0],{x:0,z:1320,speed:43});return s;
}
test('double tap requires two same-side presses within 280ms and resets across direction or pause',()=>{
  const d=new DoubleTap();assert.equal(d.press(1,0),false);assert.equal(d.press(1,200),true);assert.equal(d.press(1,240),false);
  assert.equal(d.press(-1,260),false);assert.equal(d.press(1,290),false);assert.equal(d.press(1,600),false);d.reset();assert.equal(d.press(1,650),false);
});
test('kneepads require ownership, persist without duplicate charges, and migrate legacy saves without giving free equipment',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
  try{
    const save=freshSave();save.cash=1000000;persist(save);assert.deepEqual(loadSave(),save);
    assert.equal(createRace('costa',{...save,kneePadId:'gold'}).riders[0].kneePadId,undefined);
    for(const pad of KNEE_PADS){assert.ok(buyKneePad(save,pad.id));const balance=save.cash;assert.ok(buyKneePad(save,pad.id));assert.equal(save.cash,balance);}
    buyNitro(save);persist(save);assert.deepEqual(loadSave(),save);assert.equal(JSON.parse(data.get(SAVE_KEY)!).version,1);
    save.cash=0;delete save.ownedKneePads;assert.equal(buyKneePad(save,'white'),false);assert.equal(buyKneePad(save,'invalid'),false);
    data.set(SAVE_KEY,JSON.stringify({...save,ownedKneePads:['fake','white','white'],kneePadId:'gold',nitro:{ferro:999,lobo:999}}));
    const safe=loadSave();assert.deepEqual(safe.ownedKneePads,['white']);assert.equal(safe.kneePadId,undefined);assert.deepEqual(safe.nitro,{ferro:2});
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});
test('manual knee technique improves a fast dry bend by tier; it never helps a straight, wrong side, shoulder or chopper',()=>{
  let previous=0;
  for(const pad of KNEE_PADS){const s=solo('day','ferro',pad.id),p=s.riders[0],curve=curveAt(p.z,s.trackId);
    assert.equal(kneeSupport(p,curve),0);performAction(s,p,'kneeLeft');assert.equal(kneeSupport(p,curve),1);
    const effective=cornerHandling(p,curve),speed=cornerSpeed(curve,effective);assert.ok(speed>previous);previous=speed;
    assert.ok(effective>p.handling);assert.equal(cornerHandling(p,0),p.handling);assert.equal(kneeSupport(p,-curve),0);
    p.x=8;assert.equal(kneeSupport(p,curve),0);
  }
  const heavy=solo('day','lobo'),p=heavy.riders[0];performAction(heavy,p,'kneeLeft');assert.equal(p.kneeTime,undefined);assert.equal(kneeSupport(p,-2.3),0);
  const s=solo(),r=s.riders[0];performAction(s,r,'kneeLeft');stepRace(s,{player:{...EMPTY_COMMAND,steer:.4}});assert.equal(r.kneeTime,0);
  r.speed=5;performAction(s,r,'kneeLeft');assert.equal(r.kneeTime,0);
});
function wetBend(condition: RaceCondition='rain') {
  const s=solo(condition);s.trackId='porto';Object.assign(s.riders[0],{z:1000,speed:40,x:0});return s;
}
function holdBend(s: ReturnType<typeof createRace>,frames:number) {
  for(let i=0;i<frames;i++) {
    const p=s.riders[0],curve=curveAt(p.z,s.trackId),forces=cornerForces(p.speed,cornerHandling(p,curve)*roadGrip(s.condition),curve);
    stepRace(s,{player:{...EMPTY_COMMAND,throttle:p.speed<40?1:0,steer:forces.drift/forces.lateral}});
  }
}
test('rain knee contact is safe through 2 seconds and falls on the next tick; maneuver still lasts 4 seconds',()=>{
  assert.equal(KNEE_DURATION,4);
  const s=wetBend(),p=s.riders[0];performAction(s,p,'kneeRight');assert.equal(p.falls,0);assert.equal(p.kneeTime,4);
  holdBend(s,120);assert.equal(p.wetKneeTicks,120);assert.equal(p.falls,0);assert.equal(p.integrity,100);
  performAction(s,p,'kneeRight');assert.equal(p.wetKneeTicks,120,'Repeated taps do not reset contact');
  const resumed=restoreSnapshot(snapshot(s));holdBend(resumed,1);assert.equal(resumed.riders[0].falls,1);assert.ok(resumed.riders[0].crash>0);assert.equal(resumed.riders[0].wetKneeTicks,0);
  p.immune=2;const cop={...createRace().riders[1],profile:'police' as const,id:'police',z:p.z-10,x:p.x};s.riders.push(cop);
  holdBend(s,1);assert.equal(p.falls,1);assert.equal(s.result?.reason,'caught');
  const dry=wetBend('day');performAction(dry,dry.riders[0],'kneeRight');holdBend(dry,241);assert.equal(dry.riders[0].falls,0);assert.equal(dry.riders[0].kneeTime,0);assert.equal(dry.riders[0].wetKneeTicks,0);
});
test('lifting the knee resets rain exposure, with no accumulation across short maneuvers or unsupported poses',()=>{
  const s=wetBend(),p=s.riders[0];performAction(s,p,'kneeRight');holdBend(s,120);assert.equal(p.wetKneeTicks,120);
  stepRace(s,{player:{...EMPTY_COMMAND,steer:-.5}});assert.equal(p.kneeTime,0);assert.equal(p.wetKneeTicks,0);
  performAction(s,p,'kneeRight');holdBend(s,120);assert.equal(p.wetKneeTicks,120);assert.equal(p.falls,0);
  for(const reason of ['straight','wrong-side','slow','shoulder','kick','no-pad','chopper'] as const){
    const world=wetBend(),r=world.riders[0];performAction(world,r,'kneeRight');r.wetKneeTicks=120;
    if(reason==='straight')r.z=300;else if(reason==='wrong-side')r.kneeSide=-1;else if(reason==='slow')r.speed=15;else if(reason==='shoulder')r.x=8;else if(reason==='kick')r.attack={kind:'kick',age:0,side:1,hit:false};else if(reason==='no-pad')delete r.kneePadId;else r.bikeId='lobo';
    stepRace(world,{player:EMPTY_COMMAND});assert.equal(r.wetKneeTicks,0,reason);assert.equal(r.falls,0,reason);
  }
});
test('prediction tracks continuous wet contact but never confirms a fall or mutates authoritative events',()=>{
  const s=wetBend(),p=s.riders[0];performAction(s,p,'kneeRight');holdBend(s,119);const copy=restoreSnapshot(snapshot(s)),predicted=copy.riders[0];
  const cmd={...EMPTY_COMMAND,steer:.25};stepRace(s,{player:cmd});predictMovement(copy,predicted,cmd);
  for(const key of ['wetKneeTicks','kneeTime','x','z','speed'] as const)assert.equal(predicted[key],p[key]);
  const events=JSON.stringify(copy.events);predictMovement(copy,predicted,cmd);assert.equal(predicted.wetKneeTicks,121);assert.equal(predicted.falls,0);assert.equal(JSON.stringify(copy.events),events);
  stepRace(s,{player:cmd});assert.equal(p.falls,1);
});
test('nitro respects per-bike capacities, costs per charge, never stacks, and temporarily raises real performance',()=>{
  for(const bike of BIKES){const save=freshSave();save.cash=1000000;buyBike(save,bike.id);const balance=save.cash;
    for(let i=0;i<bike.nitroCapacity;i++)assert.ok(buyNitro(save));assert.equal(buyNitro(save),false);assert.equal(save.nitro![bike.id],bike.nitroCapacity);assert.equal(save.cash,balance-bike.nitroCapacity*NITRO_PRICE);
  }
  assert.equal(BIKES.filter(b=>b.nitroCapacity===5).map(b=>b.id).join(),'brutal');
  const s=solo(),p=s.riders[0];p.z=0;p.speed=p.maxSpeed;
  performAction(s,p,'nitro');performAction(s,p,'nitro');assert.equal(p.nitro,1);assert.equal(p.nitroUsed,1);
  for(let i=0;i<250;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.ok(p.speed>p.maxSpeed*1.07);assert.ok(p.speed<=p.maxSpeed*1.1);
  for(let i=0;i<80;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.equal(p.nitroTime,0);assert.equal(p.nitro,1);
  performAction(s,p,'nitro');assert.equal(p.nitro,0);assert.equal(p.nitroUsed,2);
});
test('client prediction matches server with an active knee maneuver and nitro across bikes and weather',()=>{
  for(const bike of BIKES)for(const condition of ['day','rain'] as const){
    const s=solo(condition,bike.id),p=s.riders[0];performAction(s,p,'nitro');performAction(s,p,'kneeLeft');
    const copy=restoreSnapshot(snapshot(s));
    for(let i=0;i<90;i++){const command={...EMPTY_COMMAND,throttle:i<40?1:0,brake:i>=40?.2:0,steer:-.45};stepRace(s,{player:command});predictMovement(copy,copy.riders[0],command);}
    for(const key of ['x','z','speed','kneeTime','wetKneeTicks','nitroTime','nitro','kneePadId'] as const)assert.equal(copy.riders[0][key],p[key],`${bike.id}/${condition}/${key}`);
  }
});
test('reliable actions survive coalesced packets once and server clamps equipment, stock and forged stats',()=>{
  const a=makeMember('A',0,'ferro',{kneePadId:'gold',nitro:999}),b=makeMember('B',0,'lobo',{kneePadId:'fake',nitro:-1});
  const room=makeRoom('ABCDEF','costa',a,0,true);joinRoom(room,b,0);lobbyClock(room,60000);const p=room.race!.riders[0];p.speed=43;p.z=1320;
  assert.equal(p.nitro,2);assert.equal(room.race!.riders[1].kneePadId,undefined);assert.equal(p.handling,1.1);
  const command={...EMPTY_COMMAND,steer:-.4},actions=[{seq:1,kind:'kneeLeft' as const},{seq:2,kind:'nitro' as const},{seq:3,kind:'taunt' as const},{seq:4,kind:'horn' as const}];
  for(let i=1;i<=15;i++){const at=60000+i*20;pulseRoom(room,{[inputKey(a)]:{seq:i,at,command,actions}},at);}
  assert.equal(room.actionAck![a.id],4);assert.equal(p.nitroUsed,1);assert.equal(p.nitro,1);assert.ok(p.kneeTime!>0);assert.ok(p.speech);assert.equal(room.race!.events.filter(e=>e.type==='horn').length,1);
  const v=viewRoom(room,60300);assert.equal(v.members[0].kneePadId,'gold');assert.equal(v.members[0].nitro,2);assert.equal('token' in v.members[0],false);
  assert.equal(cleanActions([{seq:1,kind:'teleport'}]),null);assert.equal(cleanActions([{seq:1,kind:'nitro'},{seq:1,kind:'nitro'}]),null);assert.equal(cleanActions(Array.from({length:9},(_,i)=>({seq:i+1,kind:'nitro'}))),null);
});
test('online nitro receipts debit each used charge once across repeated snapshots and reconnects',()=>{
  const save=freshSave();save.cash=1000000;buyNitro(save);buyNitro(save);
  const r=createMultiplayerRace('costa',[{id:'human-0123456789abcdef',name:'A',nitro:2},{id:'b',name:'B'}]).riders[0];r.nitroUsed=1;
  assert.ok(recordOnlineNitro(save,r));assert.equal(save.nitro!.ferro,1);assert.equal(recordOnlineNitro(save,r),false);
  const copy=JSON.parse(JSON.stringify(save));assert.equal(recordOnlineNitro(copy,r),false);r.nitroUsed=2;assert.ok(recordOnlineNitro(copy,r));assert.equal(copy.nitro.ferro,0);
});
test('taunts are approved, limited in time, avoid immediate repeats and do not change physics RNG',()=>{
  const s=solo(),p=s.riders[0],rng=s.rng;assert.equal(TAUNTS.length,10);sayTaunt(s,p);const first=p.speech!.index;
  sayTaunt(s,p);assert.equal(p.tauntSeq,1);s.time+=5;sayTaunt(s,p);assert.notEqual(p.speech!.index,first);assert.equal(s.rng,rng);assert.equal(p.speech!.until,s.time+3);
});

test('room actions count wet contact once and only the exposed pilot falls after two seconds',()=>{
  const a=makeMember('A',0,'ferro',{kneePadId:'white'}),b=makeMember('B',0,'ferro');
  const room=makeRoom('WETPAD','porto',a,0,true,'rain');joinRoom(room,b,0);lobbyClock(room,60000);
  const s=room.race!,p=s.riders[0];s.traffic=[];s.obstacles=[];s.riders.forEach((r,i)=>Object.assign(r,{z:i?2200+i*30:1000,x:i?5:-5,speed:i?0:40}));
  const actions=[{seq:1,kind:'kneeRight' as const}],command={...EMPTY_COMMAND,steer:1};
  let observed=false;
  for(let i=1;i<=160;i++){
    const at=60000+i*20;pulseRoom(room,{[inputKey(a)]:{seq:i,at,command,actions}},at);
    if(p.wetKneeTicks!>0){observed=true;assert.ok(p.wetKneeTicks!<=120);assert.equal(p.falls,0);}
  }
  assert.ok(observed);assert.equal(room.actionAck![a.id],1);assert.equal(p.falls,1);assert.ok(p.crash>0);assert.equal(s.riders[1].falls,0);assert.equal(room.phase,'racing');
});
