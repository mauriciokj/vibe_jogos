import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, createMultiplayerRace, stepRace, crashRider, finishRider, snapshot, restoreSnapshot } from '../src/game/simulation';
import { freshSave, settleRace, normalizeSave, awardOnlinePoliceReward } from '../src/game/save';
import { racePayout } from '../src/game/rewards';
import { EMPTY_COMMAND, type RaceState, type RaceResult } from '../src/game/types';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { makeMember, makeRoom, depart } from '../server/room';

function prepare(s=createRace('costa',undefined,91,'day')){
  s.mode='racing';s.countdown=0;s.time=20;s.traffic=[];s.obstacles=[];s.policeActive=true;
  s.riders=s.riders.slice(0,2);
  const [p,cop]=s.riders;
  Object.assign(p,{x:0,z:500,speed:0});
  Object.assign(cop,{id:'police',name:'POLÍCIA',profile:'police',x:2.1,z:500,speed:0,health:1});
  return {s,p,cop};
}
function punch(s:RaceState){
  const [p,cop]=s.riders;
  for(let i=0;i<14;i++)stepRace(s,{[p.id]:{...EMPTY_COMMAND,attack:i===0?'punch':null},[cop.id]:EMPTY_COMMAND});
}

test('each actual police knockdown earns 500, including the same officer after recovery; replay is deterministic',()=>{
  const {s,p,cop}=prepare();
  cop.health=100;punch(s);assert.equal(p.feats?.policeKnockdowns,undefined,'a hit is not a knockdown');
  p.cooldown=0;p.attack=null;cop.health=1;cop.x=2.1;cop.z=p.z;
  punch(s);assert.equal(cop.falls,1);assert.equal(p.feats?.policeKnockdowns,1);
  const restored=restoreSnapshot(snapshot(s));
  for(let i=0;i<160;i++){stepRace(s);stepRace(restored);}
  assert.equal(snapshot(s),snapshot(restored));assert.equal(cop.recovery,undefined);
  Object.assign(cop,{health:1,x:p.x+2.1,z:p.z,speed:0,immune:0,attack:null});p.cooldown=0;p.attack=null;
  punch(s);assert.equal(cop.falls,2);assert.equal(p.feats?.policeKnockdowns,2);
  for(let i=0;i<10;i++)stepRace(s);
  assert.equal(p.feats?.policeKnockdowns,2,'no repeat credit while down');
  finishRider(s,p,'wrecked');const save=freshSave(),payout=settleRace(save,s)!;
  assert.equal(payout.policeBonus,1000);assert.equal(payout.total,1120);assert.equal(save.cash,1770);
});

test('environment crashes and rival knockdowns do not pay a police bonus',()=>{
  const {s,p,cop}=prepare();crashRider(s,cop,true);finishRider(s,p,'finish');
  assert.equal(racePayout(s.trackId,s.result!).policeBonus,undefined);
  const other=prepare();other.cop.profile='careful';punch(other.s);finishRider(other.s,other.p,'finish');
  assert.equal(other.cop.falls,1);assert.equal(racePayout(other.s.trackId,other.s.result!).policeBonus,undefined);
});

test('simultaneous contact falls count the bonus and delay arrest until the officer mounts again',()=>{
  const {s,p,cop}=prepare();p.health=1;cop.x=.6;
  stepRace(s,{[cop.id]:EMPTY_COMMAND});
  assert.equal(p.falls,1);assert.equal(cop.falls,1);assert.equal(s.result,null);
  assert.equal(p.feats?.policeKnockdowns,1);
  assert.ok(s.events.some(e=>e.actor===p.id && e.text==='POLICIAL DERRUBADO · +500 MOEDAS'));
  p.recovery!.bikeZ+=80;p.x=10;
  for(let i=0;i<300&&!s.result;i++){
    stepRace(s);
    if(cop.recovery)assert.equal(s.result,null,'a recovering officer cannot arrest');
  }
  const result=s.result as RaceResult|null;assert.equal(result?.reason,'caught');assert.equal(result?.arrestCause,'fall');
  assert.equal(racePayout(s.trackId,s.result!).policeBonus,500);
  const another=prepare();another.p.health=1;another.cop.x=.6;stepRace(another.s,{police:EMPTY_COMMAND});
  another.s.riders.push({...createRace().riders[1],id:'backup',profile:'police',x:another.p.x,z:another.p.z+10,speed:0});
  stepRace(another.s);assert.equal(another.s.result?.reason,'caught','another active officer can arrest immediately');
});

test('police bonus adds to finish/record rewards and survives every non-finishing outcome',()=>{
  for(const reason of ['finish','caught','wrecked','timeout','left'] as const){
    const {s,p}=prepare();punch(s);finishRider(s,p,reason);
    if(reason==='left')s.result!.reward=0;
    const save=freshSave();save.records['costa:day']={time:200,place:1};
    const payout=settleRace(save,s,{mode:'championship'})!;
    assert.equal(payout.policeBonus,500);assert.equal(payout.recordBonus,reason==='finish'?420:0);
    assert.equal(save.cash,650+s.result!.reward+payout.recordBonus+500);
  }
});

test('guest multiplayer receipts survive save reload, pay the attacker only, and do not pay twice',()=>{
  const id='human-0123456789abcdef',save=freshSave(),result:RaceResult={reason:'left',place:1,time:30,reward:0,hits:2,falls:0,policeKnockdowns:2};
  assert.equal(awardOnlinePoliceReward(save,id,result),1000);
  const reloaded=normalizeSave(JSON.parse(JSON.stringify(save)));
  assert.equal(awardOnlinePoliceReward(reloaded,id,result),0);assert.equal(reloaded.cash,1650);
  assert.equal(awardOnlinePoliceReward(reloaded,'human-fedcba9876543210',{...result,policeKnockdowns:undefined}),0);
  assert.equal(awardOnlinePoliceReward(reloaded,id,{...result,policeKnockdowns:3}),500);
  assert.equal(reloaded.cash,2150);
});

test('official solo replays pay confirmed knockdowns once on abandonment, ignoring claimed counts',async()=>{
  const db=new AccountsDB(':memory:');
  try{
    const account=db.login('police-reward-solo'),e=new Economy(db),run=e.start(account.id,{trackId:'costa',condition:'day',revision:e.initialize(account.id).revision});
    const {s}=prepare(run.initial!);db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(s),run.id);
    const body={id:run.id,cursor:0,segments:[{count:1,command:{...EMPTY_COMMAND,attack:'punch'}},{count:13,command:EMPTY_COMMAND}],abandon:true,policeKnockdowns:999};
    const result=await e.advance(account.id,body,true);
    assert.equal(result.payout?.policeBonus,500);assert.equal(result.payout?.baseReward,0);assert.equal(db.cloud(account.id).save!.cash,1150);
    const before=db.cloud(account.id);await e.advance(account.id,body,true);assert.deepEqual(db.cloud(account.id),before);
  }finally{db.close();}
});

test('official multiplayer pays only the credited player and receipts prevent duplicate payouts after server restart',()=>{
  const db=new AccountsDB(':memory:');
  try{
    const e=new Economy(db),a=db.login('police-reward-a'),b=db.login('police-reward-b'),ma=makeMember('A',0),mb=makeMember('B',0);
    e.equipMember(a.id,ma);e.equipMember(b.id,mb);
    const multi=createMultiplayerRace('costa',[ma,mb]),other=structuredClone(multi.riders[1]);
    const {s,p}=prepare(multi);other.z=800;s.riders.push(other);
    punch(s);const room=makeRoom('ABCDEF','costa',ma,0);room.members.push(mb);room.phase='racing';room.race=s;
    depart(room,ma.id,ma.epoch,1000,true);e.recordRoom(room);
    assert.equal(db.cloud(a.id).save!.cash,1150);assert.equal(db.cloud(b.id).save!.cash,650);
    const before=db.cloud(a.id);e.recordRoom(room);new Economy(db).recordRoom(room);assert.deepEqual(db.cloud(a.id),before);
    finishRider(s,other,'finish');e.recordRoom(room);assert.equal(db.cloud(b.id).save!.cash,650);
    assert.equal(s.multiplayer!.results[p.id].policeKnockdowns,1);
  }finally{db.close();}
});
