import test from 'node:test';
import assert from 'node:assert/strict';
import { theftFixture } from './police-theft-fixture';
import { createRace, createMultiplayerRace, stepRace, finishRider, crashRider, snapshot, restoreSnapshot } from '../src/game/simulation';
import { freshSave, normalizeSave, settleRace, buyBike, unlockPoliceBike } from '../src/game/save';
import { POLICE_BIKE_ID, getBike, MOTORBIKES } from '../src/game/bikes';
import { EMPTY_COMMAND, type RaceResult } from '../src/game/types';
import { enteredBike } from '../src/game/police-bike';
import { newChampionship, startChampionshipRace, checkpointChampionship, championshipRemainder, recordChampionshipHeat, championshipBikeState } from '../src/game/championship';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { makeMember } from '../server/room';

const walk={...EMPTY_COMMAND,throttle:1};
function take(f=theftFixture()){
 for(let i=0;i<80&&f.p.recovery;i++)stepRace(f.s,{[f.p.id]:walk});
 assert.equal(f.p.bikeId,POLICE_BIKE_ID);assert.equal(f.p.recovery,undefined);return f;
}
function finish(f:ReturnType<typeof theftFixture>,reason:RaceResult['reason']='finish'){
 f.p.finishedAt=reason==='finish'?f.s.time:null;finishRider(f.s,f.p,reason);return f.s;
}

test('first pedestrian to the police bike takes it, with damage, personal gear and health preserved',()=>{
 const f=theftFixture(),original={...enteredBike(f.p)},health=f.p.health,gear=[f.p.weaponId,f.p.kneePadId,f.p.helmetId,f.p.helmetColorId],speed=f.cop.maxSpeed,damage=f.cop.integrity;
 take(f);assert.equal(f.p.integrity,damage);assert.ok(f.p.health>=health&&f.p.health<health+2);assert.deepEqual([f.p.weaponId,f.p.kneePadId,f.p.helmetId,f.p.helmetColorId],gear);
 assert.equal(f.p.maxSpeed,speed);assert.equal(f.p.nitro,0);assert.equal(f.p.profile,'player');
 assert.equal(f.cop.recovery?.bikeTaken,true);assert.equal(f.p.stolenPoliceBike!.originalBike.bikeId,original.bikeId);assert.equal(f.p.stolenPoliceBike!.originalBike.integrity,original.integrity);assert.equal(f.p.stolenPoliceBike!.originalBike.nitro,1);
 for(let i=0;i<300;i++)stepRace(f.s,{player:walk});
 assert.equal(f.cop.recovery?.phase,'walking');assert.ok(f.cop.crash>0);assert.equal(f.s.result,null);assert.ok(f.p.z>510);
});

test('officer already mounting, ties, moving/destroyed bikes, mounted players and multiplayer cannot be stolen',()=>{
 for(const variant of ['mounting','tie','moving','destroyed','mounted','multi'] as const){
  const f=theftFixture();f.p.z=502;
  if(variant==='mounting'){f.cop.recovery!.phase='mounting';f.cop.recovery!.timer=.5;}
  if(variant==='tie')f.cop.z=502;
  if(variant==='moving')f.cop.recovery!.bikeVZ=10;
  if(variant==='destroyed')f.cop.integrity=0;
  if(variant==='mounted'){delete f.p.recovery;f.p.crash=0;}
  if(variant==='multi')f.s.multiplayer={humanIds:['player','other'],results:{}};
  stepRace(f.s,{player:walk});assert.equal(f.p.stolenPoliceBike,undefined,variant);
 }
 const f=theftFixture();f.p.recovery!.phase='sliding';f.p.recovery!.vx=2;f.p.z=502;stepRace(f.s,{player:walk});assert.equal(f.p.stolenPoliceBike,undefined);
});

test('mounted finish unlocks only the police bike, with no added cash, gear or achievement',()=>{
 const f=take(),save=freshSave();finish(f);
 const noTheft=structuredClone(f.s);delete noTheft.riders[0].stolenPoliceBike;delete noTheft.result!.stolenPoliceBike;
 const control=freshSave();const expected=settleRace(control,noTheft)!;
 const payout=settleRace(save,f.s)!;
 assert.equal(payout.policeBikeUnlocked,true);assert.equal(payout.total,expected.total);assert.equal(save.cash,control.cash);assert.deepEqual(save.achievements,control.achievements);
 assert.equal(save.bikeId,'ferro');assert.equal(save.condition.ferro,67);assert.equal(save.condition[POLICE_BIKE_ID],f.p.integrity);
 assert.deepEqual(save.upgrades[POLICE_BIKE_ID],{engine:0,armor:0,handling:0});assert.equal(save.weaponId,undefined);assert.equal(save.kneePadId,undefined);
 const reloaded=normalizeSave(save);assert.ok(buyBike(reloaded,POLICE_BIKE_ID));assert.equal(createRace('costa',reloaded).riders[0].bikeId,POLICE_BIKE_ID);
 const before=structuredClone(reloaded);assert.equal(unlockPoliceBike(reloaded,f.s),false);assert.deepEqual(reloaded,before);
});

test('defeat, abandonment, walking finish, mounting at the line and forged result flags never unlock',()=>{
 for(const reason of ['caught','wrecked','left','timeout'] as const){const f=take(),save=freshSave();finish(f,reason);settleRace(save,f.s);assert.equal(save.owned.includes(POLICE_BIKE_ID),false);assert.equal(save.condition[POLICE_BIKE_ID],undefined);assert.equal(save.condition.ferro,67);}
 for(const phase of ['walking','mounting'] as const){const f=take(),save=freshSave();crashRider(f.s,f.p,true);f.p.recovery!.phase=phase;f.p.finishedOnFoot=phase==='walking';finish(f);assert.equal(f.s.result!.stolenPoliceBike,undefined);settleRace(save,f.s);assert.equal(save.owned.includes(POLICE_BIKE_ID),false);}
 const s=createRace(),save=freshSave();s.mode='racing';finishRider(s,s.riders[0],'finish');s.result!.stolenPoliceBike=true;assert.equal(unlockPoliceBike(save,s),false);
 assert.equal(buyBike(save,POLICE_BIKE_ID),false);
});

test('a second fall and recovery retain theft provenance; snapshots continue identically',()=>{
 const f=take();crashRider(f.s,f.p,true);const copy=restoreSnapshot(snapshot(f.s));
 for(let i=0;i<200;i++){const cmd={...EMPTY_COMMAND,brake:1};stepRace(f.s,{player:cmd});stepRace(copy,{player:cmd});}
 assert.equal(snapshot(f.s),snapshot(copy));assert.ok(f.p.stolenPoliceBike);assert.ok(f.cop.recovery!.bikeTaken);
});

test('championship checkpoint/reload and next heat preserve original bike damage and nitro',()=>{
 const save=freshSave();save.championship=newChampionship(12);save.nitro={ferro:1};const f=take(theftFixture(startChampionshipRace(save)!));
 checkpointChampionship(save.championship!,f.s);
 const reloaded=normalizeSave(save),resumed=startChampionshipRace(reloaded)!;assert.equal(snapshot(resumed),snapshot(f.s));
 assert.equal(championshipBikeState(reloaded).integrity,67);assert.equal(reloaded.championship!.entry!.nitro!.ferro,1);
 finish(f);const completed=championshipRemainder(f.s);
 for(const r of completed.riders)if(r.profile!=='police'&&r.id!=='player')finishRider(completed,r,'timeout');
 assert.ok(recordChampionshipHeat(save.championship!,completed));settleRace(save,f.s,{starterRepair:false,mode:'championship'});
 assert.equal(save.championship!.damage.player,67);assert.equal(save.championship!.entry!.condition.ferro,67);
 const next=startChampionshipRace(save)!;assert.equal(next.riders[0].bikeId,'ferro');assert.equal(next.riders[0].integrity,67);assert.equal(next.riders[0].nitro,1);
 assert.ok(save.owned.includes(POLICE_BIKE_ID));
});

test('multiplayer disallows the patrol bike in every entry path, even for an owner',()=>{
 const f=take(),save=freshSave();finish(f);settleRace(save,f.s);assert.equal(MOTORBIKES.length,7);
 const member=makeMember('Guest',0,POLICE_BIKE_ID);assert.equal(member.bikeId,'ferro');
 const race=createMultiplayerRace('costa',[{id:'a',name:'A',bikeId:POLICE_BIKE_ID},{id:'b',name:'B'}]);assert.equal(race.riders[0].bikeId,'ferro');
 const db=new AccountsDB(':memory:');try{const a=db.login('theft-online'),e=new Economy(db);db.save(a.id,0,save,'trusted-theft-qa');member.bikeId=POLICE_BIKE_ID;e.equipMember(a.id,member);assert.equal(member.bikeId,'ferro');e.releaseMember(member);}finally{db.close();}
});

test('simultaneous contact falls allow theft once the player reaches the police bike first',()=>{
 const f=theftFixture();delete f.p.recovery;delete f.cop.recovery;
 Object.assign(f.p,{x:0,z:500,crash:0,health:1});Object.assign(f.cop,{x:.6,z:500,crash:0,health:1});
 stepRace(f.s,{police:EMPTY_COMMAND});assert.ok(f.p.recovery&&f.cop.recovery);assert.equal(f.p.feats?.policeKnockdowns,1);
 // Both remain in recovery while the player takes a shorter route to the bike.
 Object.assign(f.p,{x:0,z:500});Object.assign(f.p.recovery!,{phase:'walking',bikeX:0,bikeZ:520,vx:0,vz:0});
 Object.assign(f.cop,{x:0,z:510});Object.assign(f.cop.recovery!,{phase:'walking',bikeX:0,bikeZ:502,vx:0,vz:0});
 take(f);finish(f);const payout=settleRace(freshSave(),f.s)!;assert.equal(payout.policeBonus,500);assert.equal(payout.policeBikeUnlocked,true);
});

test('a broken original bike does not prevent resuming a championship on the stolen bike',()=>{
 const save=freshSave();save.championship=newChampionship(15);const f=theftFixture(startChampionshipRace(save)!);f.p.integrity=0;
 take(f);checkpointChampionship(save.championship!,f.s);
 const copy=normalizeSave(save);assert.equal(championshipBikeState(copy).blocked,false);assert.equal(startChampionshipRace(copy)!.riders[0].bikeId,POLICE_BIKE_ID);
 const malformed=structuredClone(save);malformed.championship!.checkpoint!.riders[0].stolenPoliceBike!.originalBike.bikeZ=NaN;
 assert.equal(normalizeSave(malformed).championship,undefined);
});

test('account replay confirms theft and unlock once, returns original nitro and rejects claimed unlocks',async()=>{
 const db=new AccountsDB(':memory:');let now=Date.now();
 try{
  const a=db.login('theft-solo'),save=freshSave();save.nitro={ferro:1};db.save(a.id,0,save,'trusted-theft-account');const e=new Economy(db,()=>now);
  const run=e.start(a.id,{trackId:'costa',condition:'day',revision:e.initialize(a.id).revision});const f=theftFixture(run.initial!);
  db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(f.s),run.id);
  const segments=[{count:70,command:walk}];now+=2000;await e.advance(a.id,{id:run.id,cursor:0,segments});
  const resumed=e.start(a.id,{});assert.equal(resumed.initial!.riders[0].bikeId,POLICE_BIKE_ID);assert.ok(resumed.initial!.riders[0].stolenPoliceBike);
  const s=resumed.initial!;s.riders[0].z=8399.9;s.riders[0].speed=40;
  db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(s),run.id);
  const body={id:run.id,cursor:70,segments:[{count:1,command:walk}]};const done=await e.advance(a.id,body,true);
  assert.equal(done.payout?.policeBikeUnlocked,true);assert.equal(db.cloud(a.id).save!.nitro!.ferro,1);assert.equal(db.cloud(a.id).save!.condition.ferro,67);
  const after=db.cloud(a.id);await e.advance(a.id,body,true);assert.deepEqual(db.cloud(a.id),after);
  const other=db.login('theft-forged'),next=e.start(other.id,{trackId:'costa',condition:'day',revision:e.initialize(other.id).revision});
  await e.advance(other.id,{id:next.id,cursor:0,segments:[],abandon:true,stolenPoliceBike:true,result:{stolenPoliceBike:true}},true);
  assert.equal(db.cloud(other.id).save!.owned.includes(POLICE_BIKE_ID),false);
 }finally{db.close();}
});
