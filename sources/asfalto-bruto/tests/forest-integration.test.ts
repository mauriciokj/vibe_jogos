import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, normalizeSave, settleRace, buyBike } from '../src/game/save';
import { createRace, createMultiplayerRace, stepRace, snapshot } from '../src/game/simulation';
import { CONDITIONS, recordKey } from '../src/game/conditions';
import { nextRaceRoute } from '../src/game/routes';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { safeDrivingCommand } from './driving';
import type { ReplaySegment } from '../src/account/protocol';

test('top five on Terra unlocks Mata, including old records, without losing garage or earned badges',()=>{
  for(const condition of CONDITIONS){
    const save=freshSave();save.unlocked=4;save.cash=12345;save.ownedKneePads=['gold'];save.kneePadId='gold';save.achievements!.unlocked=['all-tracks'];
    save.records[recordKey('terra',condition.id)]={place:5,time:190};save.raceTrackId='mata';
    const migrated=normalizeSave(save);assert.equal(migrated.unlocked,5);assert.equal(migrated.raceTrackId,'mata');assert.equal(migrated.cash,12345);assert.equal(migrated.kneePadId,'gold');assert.ok(migrated.achievements!.unlocked.includes('all-tracks'));assert.deepEqual(normalizeSave(migrated),migrated);
    save.records[recordKey('terra',condition.id)].place=6;assert.equal(normalizeSave(save).unlocked,4);
    const race=createRace('terra',save,91,condition.id);race.result={reason:'finish',place:5,time:195,reward:500,hits:0,falls:0};settleRace(save,race);assert.equal(save.unlocked,5);
  }
  assert.equal(nextRaceRoute('terra','rain')!.id,'mata:day');assert.equal(nextRaceRoute('mata','rain'),null);
});
test('Mata supports a complete human grid and mixed rooms in every condition',()=>{
  for(const condition of CONDITIONS)for(const humans of [2,8]){
    const s=createMultiplayerRace('mata',Array.from({length:humans},(_,i)=>({id:`human-${i}`,name:`Piloto ${i}`})),91,true,condition.id);
    assert.equal(s.riders.length,8);assert.equal(s.multiplayer!.humanIds.length,humans);assert.equal(new Set(s.riders.map(r=>`${r.x}:${r.z}`)).size,8);
    assert.ok(s.riders.every(r=>Math.abs(r.x)<6.3));
    for(let i=0;i<360;i++)stepRace(s,Object.fromEntries(s.multiplayer!.humanIds.map(id=>[id,{throttle:1,brake:0,steer:0,attack:null}])));
    assert.ok(s.riders.every(r=>r.z>0));
  }
});
test('account authority accepts Mata, resumes its checkpoint and pays a verified finish once',async()=>{
  const db=new AccountsDB(':memory:');let now=Date.now();const economy=new Economy(db,()=>now);
  try{
    const a=db.login('mata-verified'),save=freshSave();save.cash=50000;buyBike(save,'falcao');save.records['terra:rain']={place:3,time:180};save.upgrades.falcao={engine:0,handling:3,armor:3};
    db.save(a.id,0,save,'trusted-mata-unlock');const before=db.cloud(a.id).save!.cash;
    const run=economy.start(a.id,{trackId:'mata',condition:'day',revision:db.cloud(a.id).revision}),race=structuredClone(run.initial!);
    let cursor=0,segments:ReplaySegment[]=[];
    for(let i=0;i<600;i++){const command=safeDrivingCommand(race);stepRace(race,{player:command});segments.push({count:1,command});}
    now+=12000;await economy.advance(a.id,{id:run.id,cursor,segments});cursor=600;segments=[];
    const resumed=economy.start(a.id,{trackId:'mata',condition:'day',revision:db.cloud(a.id).revision});assert.equal(snapshot(resumed.initial!),snapshot(race));
    while(race.mode!=='finished' && segments.length<30000){const command=safeDrivingCommand(race);stepRace(race,{player:command});segments.push({count:1,command});}
    assert.equal(race.result?.reason,'finish');now+=segments.length/60*1000+2000;
    const body={id:run.id,cursor,segments},result=await economy.advance(a.id,body,true);assert.equal(result.ok,true);assert.equal(result.completed,true);
    const after=db.cloud(a.id);assert.equal(after.save!.races,1);assert.ok(after.save!.cash>before);assert.ok(after.save!.records['mata:day']);assert.equal(db.ranking('solo','mata','day','time',a.id).find(r=>r.me)!.races,1);
    await economy.advance(a.id,body,true);assert.deepEqual(db.cloud(a.id),after);
  }finally{db.close();}
});
