import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKES, curveAt, getTrack } from '../src/game/content';
import { CONDITIONS, advanceScenicEvent, scenicAppearance } from '../src/game/conditions';
import { PORT_WORKS, portPassengerEvent, upcomingWorks } from '../src/game/port';
import { RACE_ROUTES } from '../src/game/routes';
import { freshSave, buyBike, settleRace, loadSave, persist } from '../src/game/save';
import { createRace, stepRace, restoreSnapshot, snapshot } from '../src/game/simulation';
import { EMPTY_COMMAND } from '../src/game/types';
import { safeDrivingCommand } from './driving';
import { makeRoom, makeMember, joinRoom, lobbyClock, viewRoom } from '../server/room';

test('two clean wins cannot buy a replacement bike; exact 10k buys the first step',()=>{
  const save=freshSave();
  for(let i=0;i<2;i++){const s=createRace('costa',save);s.result={reason:'finish',place:1,time:180,reward:getTrack('costa').prize,hits:0,falls:0};settleRace(save,s);}
  for(const b of BIKES.filter(b=>b.price>0))assert.equal(buyBike(save,b.id),false,b.id);
  save.cash=9999;assert.equal(buyBike(save,'falcao'),false);save.cash=10000;assert.ok(buyBike(save,'falcao'));assert.equal(save.cash,0);
});
test('Porto is the fourth track, with four routes, a broad start and a straight finish',()=>{
  assert.equal(RACE_ROUTES.length,20);assert.equal(RACE_ROUTES.filter(r=>r.track.id==='porto').length,4);
  assert.equal(getTrack('porto').distance,7800);assert.equal(getTrack('porto').index,3);
  for(const z of [0,200,500,780,7440,7700,7800])assert.equal(curveAt(z,'porto'),0);
  assert.ok(curveAt(2535,'porto')>1.9);assert.ok(curveAt(2890,'porto')<-2);
  for(const w of PORT_WORKS){assert.equal(upcomingWorks(w.start-100)?.side,w.side);}
});
test('old Vale top-five record unlocks Porto while preserving the entire garage and balance',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
  try {
    for(const condition of CONDITIONS){
      const old=freshSave();old.cash=321;old.unlocked=2;old.owned=['ferro','brutal'];old.bikeId='brutal';old.upgrades.brutal={engine:2,armor:1,handling:3};old.condition.brutal=72;
      old.ownedWeapons=['chain'];old.weaponId='chain';old.ownedKneePads=['gold'];old.kneePadId='gold';old.nitro={brutal:4};
      const key=condition.id==='sunset'?'deserto':`deserto:${condition.id}`;old.records[key]={time:280,place:6};persist(old);assert.equal(loadSave().unlocked,2);
      old.records[key].place=5;persist(old);assert.deepEqual(loadSave(),{...old,unlocked:3});const s=loadSave();assert.ok(buyBike(s,'brutal'));assert.equal(s.cash,321);
    }
    const save=freshSave();save.unlocked=2;const race=createRace('deserto',save);race.result={reason:'finish',place:5,time:260,reward:400,hits:0,falls:0};settleRace(save,race);assert.equal(save.unlocked,3);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});
test('port traffic and works leave usable passing lanes; cones slow, concrete crashes',()=>{
  const s=createRace('porto');assert.ok(s.traffic.filter(t=>t.kind==='truck' && t.speed<0).length>=3);
  assert.ok(s.traffic.some(t=>t.kind==='truck' && t.speed>0));assert.ok(s.obstacles.some(o=>o.kind==='cone'));
  for(const t of s.traffic)assert.equal(Math.abs(t.x),1.75);
  for(const o of s.obstacles)assert.ok(Math.abs(o.x)<=7);
  assert.equal(s.traffic.filter(t=>t.queued).length,10);
  for(const kind of ['cone','concrete'] as const){
    const race=createRace('porto');race.riders=race.riders.slice(0,1);race.traffic=[];race.obstacles=[{id:'test',x:0,z:100,kind}];race.mode='racing';Object.assign(race.riders[0],{z:99,x:0,speed:30});
    stepRace(race,{player:EMPTY_COMMAND});const p=race.riders[0];assert.ok(p.speed<28);
    if(kind==='cone'){assert.equal(p.falls,0);assert.equal(p.integrity,100);assert.equal(p.health,96);}else{assert.equal(p.falls,1);assert.ok(p.integrity<80);}
  }
});
test('passenger follows an existing truck, uses a shared human-triggered clock and never affects physics',()=>{
  const example=createRace('porto'),seeds=Array.from({length:1000},(_,i)=>i).filter(seed=>portPassengerEvent(seed,example.traffic));assert.ok(seeds.length>280&&seeds.length<380);
  const s=createRace('porto',undefined,seeds[0]);const e=s.scenicEvent!;assert.equal(e.kind,'truckPassenger');if(e.kind!=='truckPassenger')throw Error('event');
  const truck=s.traffic.find(t=>t.id===e.trafficId)!;assert.equal(truck.kind,'truck');assert.ok(truck.speed<0);truck.z=1800;s.mode='racing';s.riders[1].z=truck.z-100;advanceScenicEvent(s);assert.equal(e.startedAt,null);
  s.riders[0].z=truck.z-100;s.time=30;advanceScenicEvent(s);assert.equal(e.startedAt,30);truck.z-=20;s.time=31;assert.equal(scenicAppearance(s)?.z,truck.z);
  assert.deepEqual(scenicAppearance(restoreSnapshot(snapshot(s))),scenicAppearance(s));
  const other=restoreSnapshot(snapshot(s));delete other.scenicEvent;
  for(let i=0;i<600;i++){stepRace(s,{player:EMPTY_COMMAND});stepRace(other,{player:EMPTY_COMMAND});}
  assert.equal(scenicAppearance(s),null);delete s.scenicEvent;assert.deepEqual(s,other);
});
test('each stock bike can finish Porto in dry weather and rain with ordinary controls',()=>{
  const runs=[];
  for(const condition of ['day','rain'] as const)for(const bike of BIKES){
    const save=freshSave();save.cash=1000000;assert.ok(buyBike(save,bike.id));const s=createRace('porto',save,88117,condition);let frames=0;
    while(s.mode!=='finished'&&frames++<60*450)stepRace(s,{player:safeDrivingCommand(s)});
    const run={bike:bike.id,condition,reason:s.result?.reason,time:s.result?.time,falls:s.riders[0].falls,integrity:s.riders[0].integrity};runs.push(run);
    assert.equal(s.result?.reason,'finish',JSON.stringify(run));assert.ok(s.riders[0].integrity>0);
  }
  console.log('Porto full races:',JSON.stringify(runs));
});
test('Porto room allows two humans and six bots, shares rain and preserves world on resume',()=>{
  const room=makeRoom('PORTOX','porto',makeMember('Ana',0,'lobo'),0,true,'rain');joinRoom(room,makeMember('Bia',0,'falcao'),0);lobbyClock(room,60000);
  const s=room.race!;assert.equal(s.trackId,'porto');assert.equal(s.condition,'rain');assert.equal(s.riders.length,8);
  assert.equal(snapshot(restoreSnapshot(snapshot(s))),snapshot(s));assert.equal(viewRoom(room,60000).trackId,'porto');
});
