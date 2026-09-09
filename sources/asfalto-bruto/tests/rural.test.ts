import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKES, curveAt, getTrack } from '../src/game/content';
import { CONDITIONS, advanceScenicEvent, scenicAppearance } from '../src/game/conditions';
import { RURAL_BANKS, ruralEvent, ruralSlope } from '../src/game/rural';
import { roadHalf, roadLanes, surfaceGrip } from '../src/game/road-profile';
import { contactGuardRail, guardRailPosition, roadsideBarrier } from '../src/game/guardrails';
import { guardRailSoundSide } from '../src/game/audio';
import { RACE_ROUTES } from '../src/game/routes';
import { createRace, createMultiplayerRace, predictMovement, stepRace, snapshot, restoreSnapshot } from '../src/game/simulation';
import { freshSave, buyBike, loadSave, persist } from '../src/game/save';
import { EMPTY_COMMAND } from '../src/game/types';
import { safeDrivingCommand } from './driving';

test('Terra has two lanes, four conditions and staggered eight-rider starts in both modes',()=>{
  assert.equal(getTrack('terra').index,4);assert.equal(RACE_ROUTES.filter(r=>r.track.id==='terra').length,4);
  assert.equal(roadHalf('terra'),4.2);assert.deepEqual(roadLanes('terra'),[-2.1,2.1]);
  for(const s of [createRace('terra'),createMultiplayerRace('terra',[{id:'a',name:'A'},{id:'b',name:'B'}],5,true),createMultiplayerRace('terra',Array.from({length:8},(_,i)=>({id:String(i),name:String(i)})))]){
    assert.equal(s.riders.length,8);assert.equal(new Set(s.riders.map(r=>`${r.x}:${r.z}`)).size,8);
    for(const r of s.riders)assert.ok(Math.abs(r.x)<roadHalf('terra'));
    for(const t of s.traffic)assert.ok(roadLanes('terra').includes(t.x));
  }
  assert.equal(curveAt(100,'terra'),0);assert.equal(curveAt(7050,'terra'),0);
  assert.ok(ruralSlope(0)>.08);assert.ok(ruralSlope(1100)<-.03);
});
test('banks contain and slow every bike without damage, keep open gaps and taper smoothly',()=>{
  for(const bank of RURAL_BANKS)for(const bike of BIKES){
    const z=bank.start+120,p=createRace('terra').riders[0];p.bikeId=bike.id;p.x=bank.side*5;p.z=z;p.speed=45;
    assert.equal(roadsideBarrier('terra',bank.side,z)?.material,'earth');
    assert.ok(contactGuardRail('terra',p,1/60));assert.equal(p.x,bank.side*4.2);assert.ok(p.speed<45);
    assert.equal(guardRailSoundSide('terra',p),bank.side);assert.equal(p.health,100);assert.equal(p.integrity,100);assert.equal(p.crash,0);
    assert.equal(guardRailPosition('terra',-bank.side*6,z),-bank.side*6);
    assert.equal(guardRailPosition('terra',bank.side*6,bank.end+1),bank.side*6);
    assert.equal(guardRailSoundSide('terra',{...p,z:bank.end+1}),0);
    let previous=guardRailPosition('terra',bank.side*7.7,bank.start);
    for(let dz=1;dz<=64;dz++){const x=guardRailPosition('terra',bank.side*7.7,bank.start+dz);assert.ok(Math.abs(x-previous)<.09);previous=x;}
  }
});
test('dirt movement and bank transitions predict exactly like the authoritative race',()=>{
  for(const condition of CONDITIONS){
    const s=createRace('terra',undefined,1,condition.id);s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];s.mode='racing';
    Object.assign(s.riders[0],{z:430,x:-5,speed:32});const predicted=restoreSnapshot(snapshot(s));
    for(let i=0;i<600;i++){
      const command={...EMPTY_COMMAND,throttle:1,brake:i>200?.2:0,steer:i<250?-1:1};
      predictMovement(predicted,predicted.riders[0],command);stepRace(s,{player:command});
      for(const key of ['x','z','speed'] as const)assert.equal(predicted.riders[0][key],s.riders[0][key],`${condition.id} ${key} ${i}`);
    }
  }
  assert.ok(surfaceGrip('terra','rain')<surfaceGrip('terra','day'));
});
test('tractors collide even when wheelie is active; mud/gravel slow without a forced fall',()=>{
  for(const speed of [-8,8]){
    const s=createRace('terra');s.mode='racing';s.riders=s.riders.slice(0,1);s.obstacles=[];
    Object.assign(s.riders[0],{x:2.1,z:100,speed:36,wheelieTime:2});s.traffic=[{id:'tractor',kind:'tractor',x:2.1,z:102,speed,color:'#78934d'}];
    stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.equal(s.riders[0].falls,1);assert.ok(!s.riders[0].jumpTime);
  }
  for(const kind of ['gravel','mud'] as const){
    const s=createRace('terra');s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[{id:'patch',kind,x:2.7,z:100}];
    Object.assign(s.riders[0],{x:2.7,z:99,speed:35});stepRace(s,{player:EMPTY_COMMAND});
    assert.equal(s.riders[0].falls,0);assert.equal(s.riders[0].integrity,100);assert.ok(s.riders[0].speed<30);
  }
});
test('farm folklore is rare, shared, cosmetic and changes to Boitata at night',()=>{
  const seeds=Array.from({length:1000},(_,i)=>i).filter(seed=>ruralEvent(seed,'day'));assert.ok(seeds.length>270&&seeds.length<390);
  const s=createRace('terra',undefined,seeds[0],'night');s.mode='racing';assert.equal(s.scenicEvent?.kind,'boitata');
  assert.equal(ruralEvent(seeds[0],'day')?.kind,'saci');
  s.riders[0].z=s.scenicEvent!.z-100;advanceScenicEvent(s);assert.equal(scenicAppearance(s)?.startedAt,0);
  const other=restoreSnapshot(snapshot(s));delete other.scenicEvent;
  for(let i=0;i<600;i++){stepRace(s);stepRace(other);}
  assert.equal(scenicAppearance(s),null);delete s.scenicEvent;assert.deepEqual(s,other);
});
test('a prior Porto top-five record unlocks Terra and preserves purchased equipment',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
  try{
    for(const condition of CONDITIONS){const save=freshSave();save.unlocked=3;save.cash=6734;save.ownedHelmets=['integral','cross'];save.helmetId='cross';save.helmetColorId='purple';save.ownedKneePads=['gold'];save.kneePadId='gold';save.ownedWeapons=['chain'];save.weaponId='chain';
      save.records[condition.id==='sunset'?'porto':`porto:${condition.id}`]={time:240,place:5};persist(save);assert.deepEqual(loadSave(),{...save,unlocked:4});}
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});
test('every stock bike finishes Terra in dry and wet conditions using ordinary controls',()=>{
  const runs=[];
  for(const condition of ['day','rain'] as const)for(const bike of BIKES){
    const save=freshSave();save.cash=1000000;assert.ok(buyBike(save,bike.id));const s=createRace('terra',save,88117,condition);let frames=0;
    while(s.mode!=='finished'&&frames++<60*420)stepRace(s,{player:safeDrivingCommand(s)});
    const run={bike:bike.id,condition,reason:s.result?.reason,time:s.result?.time,falls:s.riders[0].falls,integrity:s.riders[0].integrity};runs.push(run);
    assert.equal(s.result?.reason,'finish',JSON.stringify(run));assert.ok(s.riders[0].integrity>0);
  }
  console.log('Terra full races:',JSON.stringify(runs));
});
