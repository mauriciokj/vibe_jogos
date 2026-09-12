import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDITIONS, advanceScenicEvent, coastalEvent, conditionTrack, recordKey, scenicAppearance } from '../src/game/conditions';
import { BIKES, TRACKS, cornerPace } from '../src/game/content';
import { createMultiplayerRace, createRace, predictMovement, restoreSnapshot, snapshot, stepRace } from '../src/game/simulation';
import { freshSave, loadSave, persist, settleRace, SAVE_KEY } from '../src/game/save';
import { makeRoom, makeMember, joinRoom, lobbyClock, viewRoom } from '../server/room';
import { EMPTY_COMMAND } from '../src/game/types';
import { safeDrivingCommand } from './driving';

test('legacy saves preserve garage, progression and sunset records; new condition records remain separate',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
  try{
    const old=freshSave();delete old.raceCondition;delete old.raceTrackId;old.cash=7345;old.unlocked=2;old.races=15;old.owned.push('veneno');old.bikeId='veneno';old.condition.veneno=73;old.upgrades.veneno={engine:2,armor:1,handling:3};old.records.costa={time:140,place:1};persist(old);
    const save=loadSave();assert.deepEqual(save,{...old,raceCondition:'sunset',raceTrackId:'costa',achievements:{...old.achievements,finishedTracks:['costa'],conditionWins:['costa']}});
    for(const [i,condition] of CONDITIONS.entries()){
      const s=createRace('costa',save,42,condition.id);s.result={reason:'finish',place:3,time:180+i,reward:10,hits:1,falls:0};settleRace(save,s);
    }
    assert.deepEqual(save.records.costa,{time:140,place:1});assert.equal(Object.keys(save.records).length,4);
    save.raceTrackId='serra';save.raceCondition='rain';persist(save);assert.deepEqual(loadSave(),save);assert.equal(JSON.parse(data.get(SAVE_KEY)!).version,1);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});

test('all four palettes retain geometry; rain lowers corner pace without changing dry handling',()=>{
  for(const track of TRACKS)for(const c of CONDITIONS){
    const palette=conditionTrack(track,c.id);assert.equal(palette.distance,track.distance);assert.equal(palette.id,track.id);assert.equal(palette.index,track.index);
    assert.equal(conditionTrack(track,c.id),palette);
    assert.ok(cornerPace(1290,track.id,1.1,'rain')<cornerPace(1290,track.id,1.1,'sunset'));
  }
  assert.equal(recordKey('costa',undefined),'costa');
  const baseline=createRace('serra',undefined,999,'sunset');
  for(const c of ['day','night'] as const){const state=createRace('serra',undefined,999,c);for(let i=0;i<600;i++)stepRace(state,{player:{...EMPTY_COMMAND,throttle:1}});const dry=restoreSnapshot(snapshot(baseline));for(let i=0;i<600;i++)stepRace(dry,{player:{...EMPTY_COMMAND,throttle:1}});state.condition='sunset';assert.equal(snapshot(state),snapshot(dry));}
});

test('rain prediction matches server movement for every bike, including braking in a bend',()=>{
  for(const bike of BIKES){
    const s=createMultiplayerRace('costa',[{id:'a',name:'A',bikeId:bike.id},{id:'b',name:'B'}],99,false,'rain');
    assert.equal(s.condition,'rain');s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
    Object.assign(s.riders[0],{z:1280,speed:35,x:0});const copy=restoreSnapshot(snapshot(s));
    for(let i=0;i<60;i++){const command={throttle:0,brake:.6,steer:-.45,attack:null};stepRace(s,{a:command});predictMovement(copy,copy.riders[0],command);}
    for(const key of ['x','z','speed'] as const)assert.equal(s.riders[0][key],copy.riders[0][key],bike.id+' '+key);
  }
  const dry=createRace(),wet=createRace('costa',undefined,88117,'rain');for(const s of [dry,wet]){s.mode='racing';s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,1);s.riders[0].speed=50;for(let i=0;i<30;i++)stepRace(s,{player:{...EMPTY_COMMAND,brake:1}});}
  assert.ok(wet.riders[0].speed>dry.riders[0].speed,'Wet stopping distance must be longer');
});

test('decorative events are rare, seeded and independent of physics and RNG',()=>{
  const seeds=Array.from({length:1000},(_,i)=>i).filter(seed=>coastalEvent('costa',seed));assert.ok(seeds.length>280&&seeds.length<380);
  const s=createRace('costa',undefined,seeds[0],'night');assert.deepEqual(s.scenicEvent,coastalEvent('costa',seeds[0]));
  assert.equal(coastalEvent('serra',seeds[0]),undefined);assert.equal(coastalEvent('deserto',seeds[0]),undefined);
  s.mode='racing';s.riders[0].z=s.scenicEvent!.z-179;const other=restoreSnapshot(snapshot(s));delete other.scenicEvent;
  for(let i=0;i<600;i++){const cmd={...EMPTY_COMMAND,throttle:1};stepRace(s,{player:cmd});stepRace(other,{player:cmd});}
  assert.notEqual(s.scenicEvent!.startedAt,null);delete s.scenicEvent;assert.deepEqual(s,other);
});

test('a room shares condition and one decorative timeline across start, snapshots and late views',()=>{
  const room=makeRoom('ABCDEF','costa',makeMember('A',0),0,true,'rain');joinRoom(room,makeMember('B',0),0);lobbyClock(room,60000);
  assert.equal(room.race!.condition,'rain');assert.equal(viewRoom(room,60000).condition,'rain');assert.equal(room.race!.riders.length,8);
  const s=room.race!;s.scenicEvent={kind:'mermaid',z:440,startedAt:null,duration:8};s.riders[2].z=500;advanceScenicEvent(s);assert.equal(s.scenicEvent.startedAt,null,'A bot does not use up the sighting');
  s.riders[1].z=270;s.time=20;advanceScenicEvent(s);assert.equal(s.scenicEvent.startedAt,20);
  s.time=23;assert.deepEqual(scenicAppearance(restoreSnapshot(snapshot(s))),scenicAppearance(s));s.time=29;assert.equal(scenicAppearance(s),null);advanceScenicEvent(s);assert.equal(s.scenicEvent.startedAt,20);
  assert.throws(()=>makeRoom('ABCDEF','costa',makeMember('A',0),0,false,'snow'),/Condição inválida/);
  assert.equal(makeRoom('ABCDEF','costa',makeMember('A',0),0).condition,'sunset');
});

test('all existing tracks remain finishable in rain using bounded driving commands',()=>{
  for(const track of TRACKS){const s=createRace(track.id,undefined,88117,'rain');let frames=0;
    while(s.mode!=='finished'&&frames++<60*450)stepRace(s,{player:safeDrivingCommand(s)});
    assert.equal(s.result?.reason,'finish',track.id);assert.ok(s.riders[0].integrity>0);console.log(`${track.id} rain: ${s.result!.time.toFixed(1)}s, ${s.result!.falls} falls`);
  }
});
