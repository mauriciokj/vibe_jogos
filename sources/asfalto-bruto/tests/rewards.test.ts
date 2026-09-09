import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS } from '../src/game/content';
import { racePayout } from '../src/game/rewards';
import type { RaceResult } from '../src/game/types';
import { freshSave, normalizeSave, settleRace } from '../src/game/save';
import { createRace, createMultiplayerRace } from '../src/game/simulation';
import { recordKey } from '../src/game/conditions';
import { AccountsDB } from '../server/accounts-db';

const finish: RaceResult = {reason:'finish',time:200,place:2,reward:1120,hits:0,falls:0};

test('record bonus uses 30% of the advertised track prize, independent of finishing position',()=>{
  for(const track of TRACKS)for(const place of [1,2,8]){
    const result={...finish,place,reward:place===1?track.prize:100};
    const before=structuredClone(result),payout=racePayout(track.id,result,201);
    assert.equal(payout.recordBonus,Math.round(track.prize*.3));
    assert.equal(payout.total,result.reward+payout.recordBonus);
    assert.equal(payout.previousRecord,201);
    assert.deepEqual(result,before,'presentation rewards must not change physics/replay results');
  }
});

test('first time, equal/slower times and unfinished races cannot collect a record bonus',()=>{
  for(const previous of [undefined,200,199,0,NaN,Infinity])assert.equal(racePayout('costa',finish,previous).recordBonus,0);
  for(const reason of ['caught','wrecked','left','timeout'] as const)assert.equal(racePayout('costa',{...finish,reason},300).recordBonus,0);
  for(const time of [0,-1,NaN,Infinity])assert.equal(racePayout('costa',{...finish,time},300).recordBonus,0);
});

test('settlement pays the bonus before updating the saved record and isolates tracks/conditions',()=>{
  const save=freshSave();save.records.costa={time:201,place:1};
  const state=createRace('costa',save,42,'sunset');state.result={...finish};
  const snapshot=structuredClone(state);
  assert.equal(settleRace(save,state)!.recordBonus,420);
  assert.equal(save.cash,650+1120+420);assert.equal(save.races,1);
  assert.deepEqual(save.records.costa,{time:200,place:1});assert.deepEqual(state,snapshot);
  assert.deepEqual(normalizeSave(save).records,save.records);
  for(const [track,condition] of [['costa','rain'],['costa','night'],['costa','day'],['serra','sunset']] as const){
    const first=createRace(track,save,42,condition);first.result={...finish,time:190};
    assert.equal(settleRace(save,first)!.recordBonus,0);
    assert.equal(save.records[recordKey(track,condition)].time,190);
  }
  assert.equal(settleRace(save,state)!.recordBonus,0,'the old finish no longer beats the saved record');
  state.result={...finish,time:199};assert.equal(settleRace(save,state)!.recordBonus,420);
});

test('failed races and multiplayer do not change campaign records or earn the bonus',()=>{
  const save=freshSave();save.records.costa={time:201,place:1};
  const state=createRace();state.result={...finish,reason:'caught',reward:120};
  assert.equal(settleRace(save,state)!.recordBonus,0);assert.equal(save.cash,770);assert.equal(save.records.costa.time,201);
  const multi=createMultiplayerRace('costa',[{id:'one',name:'One'},{id:'two',name:'Two'}]);multi.result=finish;
  const before=structuredClone(save);assert.equal(settleRace(save,multi),undefined);assert.deepEqual(save,before);
});

test('cloud retries and normalization preserve the settled bonus and new record once',()=>{
  const db=new AccountsDB(':memory:');
  try{
    const account=db.login('bonus-test'),save=freshSave();save.records.costa={time:201,place:1};
    db.save(account.id,0,save,'before-race');
    const state=createRace();state.result=finish;settleRace(save,state);
    db.save(account.id,1,save,'after-race');
    const retry=db.save(account.id,1,save,'after-race');assert.equal(retry.revision,2);
    assert.equal(db.cloud(account.id).save!.cash,2190);
    assert.deepEqual(db.cloud(account.id).save!.records.costa,{time:200,place:1});
  }finally{db.close();}
});
