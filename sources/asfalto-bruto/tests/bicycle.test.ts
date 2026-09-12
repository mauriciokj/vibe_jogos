import test from 'node:test';
import assert from 'node:assert/strict';
import { BICYCLE_ID, BIKES, MOTORBIKES } from '../src/game/bikes';
import { buyBike, buyNitro, freshSave, normalizeSave, settleRace, unlockBicycle } from '../src/game/save';
import { createRace, createMultiplayerRace, crashRider, stepRace, snapshot, restoreSnapshot } from '../src/game/simulation';
import { TRACKS } from '../src/game/content';
import { CONDITIONS } from '../src/game/conditions';
import { EMPTY_COMMAND, type RaceState, type RaceResult } from '../src/game/types';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { makeMember, makeRoom, joinRoom, lobbyClock, pulseRoom, inputKey } from '../server/room';
import { cleanActions } from '../src/multiplayer/protocol';
import { finishScene } from '../src/game/finish';
import { safeDrivingCommand } from './driving';

const footResult:RaceResult={reason:'finish',onFoot:true,place:8,time:250,reward:280,hits:0,falls:1};
function nearFinish(s:RaceState){
  const p=s.riders[0];s.mode='racing';s.time=200;s.traffic=[];s.obstacles=[];
  const end=TRACKS.find(t=>t.id===s.trackId)!.distance;
  p.z=end-.06;p.x=0;p.speed=0;crashRider(s,p,true);p.x=0;
  Object.assign(p.recovery!,{phase:'walking',bikeX:0,bikeZ:end-12,bikeVX:0,bikeVZ:0,vx:0,vz:0,cycle:1});
  return p;
}
test('secret is unavailable for purchase, unlocks once without a debit or automatic equip, and survives normalization',()=>{
 const save=freshSave();save.cash=1e6;const before=structuredClone(save);
 assert.equal(buyBike(save,BICYCLE_ID),false);assert.deepEqual(save,before);
 assert.equal(unlockBicycle(save,{...footResult,onFoot:false}),false);
 assert.equal(unlockBicycle(save,{...footResult,reason:'caught'}),false);
 assert.equal(unlockBicycle(save,footResult),true);assert.equal(save.cash,before.cash);assert.equal(save.bikeId,'ferro');
 assert.equal(unlockBicycle(save,footResult),false);assert.equal(save.owned.filter(id=>id===BICYCLE_ID).length,1);
 assert.equal(buyBike(save,BICYCLE_ID),true);assert.equal(buyNitro(save),false);
 assert.deepEqual(normalizeSave(save),save);assert.equal(normalizeSave(before).owned.includes(BICYCLE_ID),false);
 assert.equal(MOTORBIKES.length,7);assert.equal(BIKES.length,8);
});
test('forward walking across the finish unlocks on every track and condition, including a broken motorcycle',()=>{
 for(const t of TRACKS)for(const c of CONDITIONS){
  const save=freshSave(),s=createRace(t.id,save,88117,c.id);s.riders=s.riders.slice(0,1);const p=nearFinish(s);p.integrity=0;
  stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});
  assert.equal(s.result?.reason,'finish');assert.equal(s.result?.onFoot,true);assert.equal(p.finishedOnFoot,true);assert.equal(p.z,t.distance);
  assert.ok(p.finishedAt!>199.98&&p.finishedAt!<=200.02);
  assert.equal(settleRace(save,s)?.secretUnlocked,true);assert.ok(save.owned.includes(BICYCLE_ID));
  assert.equal(settleRace(save,s)?.secretUnlocked,undefined);
  const visual=finishScene(s,'player',4.8);assert.equal(visual.state.riders[0].recovery?.phase,'walking');assert.equal(visual.state.riders[0].speed,0);
 }
});
test('sliding, standing beyond the line, a motorcycle crossing alone, mounted finishes and eliminations do not unlock',()=>{
 for(const phase of ['sliding','gettingUp','mounting','walking'] as const){
  const s=createRace();s.riders=s.riders.slice(0,1);const p=nearFinish(s);p.recovery!.phase=phase;p.recovery!.timer=10;
  p.z=8401;p.recovery!.vz=2;stepRace(s,{player:EMPTY_COMMAND});assert.equal(s.result,null,phase);
 }
 const s=createRace();s.riders=s.riders.slice(0,1);const p=nearFinish(s);p.z=8390;p.recovery!.bikeZ=8410;stepRace(s);assert.equal(s.result,null);
 const mounted=createRace();mounted.riders=mounted.riders.slice(0,1);mounted.mode='racing';mounted.riders[0].z=8401;stepRace(mounted);assert.equal(mounted.result!.onFoot,undefined);assert.equal(settleRace(freshSave(),mounted)?.secretUnlocked,undefined);
 const caught=createRace();const walker=nearFinish(caught);caught.riders=[walker,{...caught.riders[1],id:'police',profile:'police',x:walker.x,z:walker.z-5}];stepRace(caught,{player:{...EMPTY_COMMAND,throttle:1}});assert.equal(caught.result?.reason,'caught');assert.equal(caught.result?.onFoot,undefined);
});
test('a finisher on foot stays at the line while the other multiplayer racers continue',()=>{
 const s=createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}]);const p=nearFinish(s);s.riders[1].z=8300;
 stepRace(s,{a:{...EMPTY_COMMAND,throttle:1}});assert.equal(s.multiplayer!.results.a.onFoot,true);const f=structuredClone(p.recovery);
 for(let i=0;i<60;i++)stepRace(s,{a:{...EMPTY_COMMAND,throttle:1},b:{...EMPTY_COMMAND,throttle:1}});
 assert.equal(p.z,8400);assert.deepEqual(p.recovery,f);assert.ok(s.riders[1].z>8300);assert.equal(s.mode,'racing');
});
test('held acceleration cannot keep a bicycle moving; repeated pedal actions can and survive snapshot replay',()=>{
 const save=freshSave();unlockBicycle(save,footResult);buyBike(save,BICYCLE_ID);
 const make=()=>{const s=createRace('costa',save);s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];return s;};
 const held=make(),tapped=make(),idle=make();
 for(let i=0;i<300;i++){
  stepRace(held,{player:{...EMPTY_COMMAND,throttle:1,...i===0?{action:'pedal' as const}:{}}});
  stepRace(tapped,{player:{...EMPTY_COMMAND,...i%18===0?{action:'pedal' as const}:{}}});
  stepRace(idle,{player:{...EMPTY_COMMAND,throttle:1}});
 }
 assert.equal(held.riders[0].speed,0);assert.equal(idle.riders[0].z,0);assert.ok(tapped.riders[0].speed>15&&tapped.riders[0].speed<=60/3.6+.01);assert.equal(tapped.riders[0].wheeliesLeft,3);
 const restored=restoreSnapshot(snapshot(tapped));
 for(let i=0;i<60;i++){const command={...EMPTY_COMMAND,...i%18===0?{action:'pedal' as const}:{}};stepRace(tapped,{player:command});stepRace(restored,{player:command});}
 assert.equal(snapshot(tapped),snapshot(restored));assert.ok(tapped.riders[0].pedalPhase!>=0);
 assert.deepEqual(cleanActions([{seq:1,kind:'pedal'}]),[{seq:1,kind:'pedal'}]);
});
test('account unlock is derived from the simulated crossing and an idempotent receipt, never a requested unlock',async()=>{
 const db=new AccountsDB(':memory:'),account=db.login('cycling-test');let now=Date.now();const economy=new Economy(db,()=>now);
 try{
  const cloud=economy.initialize(account.id);const before=structuredClone(cloud);
  assert.throws(()=>economy.action(account.id,{action:{kind:'bike',item:BICYCLE_ID},revision:cloud.revision,request:'secret-bike-buy-test'}),/Compra indisponível/);assert.deepEqual(db.cloud(account.id),before);
  const run=economy.start(account.id,{trackId:'costa',condition:'day',revision:before.revision});const state=run.initial!;nearFinish(state);state.riders=state.riders.slice(0,1);
  db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(snapshot(state),run.id);
  const body={id:run.id,cursor:0,segments:[{count:1,command:{...EMPTY_COMMAND,throttle:1}}]};now+=20;
  const settled=await economy.advance(account.id,body,true);assert.equal(settled.payout?.secretUnlocked,true);assert.ok(db.cloud(account.id).save!.owned.includes(BICYCLE_ID));
  const saved=db.cloud(account.id);await economy.advance(account.id,body,true);assert.deepEqual(db.cloud(account.id),saved);
  const fake=db.login('forged-unlock'),clean=economy.initialize(fake.id),rider=economy.start(fake.id,{trackId:'costa',condition:'day',revision:clean.revision});now+=20;
  await economy.advance(fake.id,{id:rider.id,cursor:0,segments:[],abandon:true,result:footResult},true);
  assert.equal(db.cloud(fake.id).save!.owned.includes(BICYCLE_ID),false);
 }finally{db.close();}
});
test('multiplayer grants and persists the secret to only the account which actually finished on foot',()=>{
 const db=new AccountsDB(':memory:'),a=db.login('walker'),b=db.login('racer'),economy=new Economy(db);
 try{
  const ma=makeMember('A',0),mb=makeMember('B',0);economy.equipMember(a.id,ma);economy.equipMember(b.id,mb);
  const room=makeRoom('ABCDEF','costa',ma,0);room.members.push(mb);room.race=createMultiplayerRace('costa',[ma,mb]);const p=nearFinish(room.race);room.race.riders[1].z=8300;
  stepRace(room.race,{[p.id]:{...EMPTY_COMMAND,throttle:1}});economy.recordRoom(room);
  assert.ok(db.cloud(a.id).save!.owned.includes(BICYCLE_ID));assert.equal(db.cloud(b.id).save!.owned.includes(BICYCLE_ID),false);assert.equal(room.race.multiplayer!.results[ma.id].secretUnlocked,true);
  const revision=db.cloud(a.id).revision;economy.recordRoom(room);assert.equal(db.cloud(a.id).revision,revision);
  const member=makeMember('A',0,BICYCLE_ID);economy.equipMember(a.id,member);assert.equal(member.bikeId,BICYCLE_ID);assert.equal(member.nitro,0);
  const guest=makeMember('Guest',0,BICYCLE_ID);economy.equipMember(undefined,guest);assert.equal(guest.bikeId,'ferro');
 }finally{db.close();}
});
test('reliable pedal packets apply once and cannot turn a held or retransmitted input into continuous acceleration',()=>{
 const a=makeMember('A',0,BICYCLE_ID),b=makeMember('B',0),room=makeRoom('ABCDEF','costa',a,0);joinRoom(room,b,0);lobbyClock(room,60000);
 const p=room.race!.riders[0];room.race!.traffic=[];room.race!.obstacles=[];
 let at=60000;
 for(let i=0;i<35;i++){
  at+=100;const actions=[{seq:1,kind:'pedal' as const}];
  pulseRoom(room,{[inputKey(a)]:{seq:i+1,at,command:{...EMPTY_COMMAND,throttle:1},actions},[inputKey(b)]:{seq:i+1,at,command:EMPTY_COMMAND}},at);
 }
 assert.equal(room.actionAck![a.id],1);assert.equal(p.speed,0);
 for(let i=0;i<20;i++){
  at+=180;pulseRoom(room,{[inputKey(a)]:{seq:36+i,at,command:EMPTY_COMMAND,actions:[{seq:2+i,kind:'pedal'}]},[inputKey(b)]:{seq:36+i,at,command:EMPTY_COMMAND}},at);
 }
 assert.ok(p.speed>15&&p.speed<=60/3.6+.01);assert.equal(room.actionAck![a.id],21);assert.equal(p.wheeliesLeft,3);
});
test('the bicycle can complete each road in dry and wet weather with repeated strokes and normal steering',()=>{
 for(const track of TRACKS)for(const condition of ['day','rain'] as const){
  const save=freshSave();unlockBicycle(save,footResult);buyBike(save,BICYCLE_ID);
  const s=createRace(track.id,save,321,condition);s.riders=s.riders.slice(0,1);s.heat=0;
  for(let i=0;i<72000&&s.mode!=='finished';i++){
   const cmd=safeDrivingCommand(s);
   if(cmd.throttle>.1 && i%18===0)cmd.action='pedal';
   stepRace(s,{player:cmd});
  }
  assert.equal(s.result?.reason,'finish',`${track.id}/${condition}: ${JSON.stringify(s.result)} at ${s.riders[0].z}`);
 }
});
