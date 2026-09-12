import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, curveAt, getBike, upcomingCorner, zeroToHundred } from '../src/game/content';
import { MOTORBIKES as BIKES } from '../src/game/bikes';
import { createRace, createMultiplayerRace, predictMovement, restoreSnapshot, snapshot, STEP, stepRace } from '../src/game/simulation';
import { buyBike, buyUpgrade, freshSave, loadSave, persist, SAVE_KEY } from '../src/game/save';
import { makeMember, makeRoom, joinRoom, lobbyClock, viewRoom } from '../server/room';
import { EMPTY_COMMAND } from '../src/game/types';

test('catalog has seven distinct silhouettes and retains ownership IDs with a longer price progression',()=>{
 assert.equal(BIKES.length,7);assert.equal(new Set(BIKES.map(b=>b.style)).size,7);
 assert.deepEqual([...BIKES].sort((a,b)=>a.price-b.price).map(b=>[b.id,b.price]),[['ferro',0],['falcao',10000],['estradeira',18000],['veneno',30000],['lobo',45000],['agulha',65000],['brutal',100000]]);
 assert.equal(getBike('unknown').id,'ferro');
 for(const b of BIKES){assert.ok(zeroToHundred(b)>1&&zeroToHundred(b)<4);assert.ok(b.speed>50&&b.handling>0&&b.armor>0);}
});

test('agile supermoto holds a tight curve that pushes the chopper onto the shoulder at equal entry speed',()=>{
 const results=BIKES.filter(b=>['falcao','lobo'].includes(b.id)).map(b=>{
  const save=freshSave();save.cash=1000000;buyBike(save,b.id);const s=createRace('costa',save);s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];s.mode='racing';
  const p=s.riders[0];Object.assign(p,{x:0,z:1320,speed:52});let maxX=0;
  for(let i=0;i<120;i++){stepRace(s,{player:{...EMPTY_COMMAND,steer:-.65}});maxX=Math.max(maxX,Math.abs(p.x));}
  return {id:b.id,maxX,speed:p.speed,advice:upcomingCorner(1320,'costa',p.handling)!.speed};
 });
 const fast=results.find(r=>r.id==='falcao')!,heavy=results.find(r=>r.id==='lobo')!;
 assert.ok(fast.maxX<7,JSON.stringify(results));assert.ok(heavy.maxX>7,JSON.stringify(results));assert.ok(fast.advice-heavy.advice>=35);assert.ok(fast.speed>heavy.speed+10);
});

test('buying and upgrading each model equips its actual attributes and never charges twice',()=>{
 const save=freshSave();assert.equal(buyBike(save,'lobo'),false);assert.equal(save.bikeId,'ferro');save.cash=1_000_000;
 for(const b of BIKES){assert.ok(buyBike(save,b.id));const balance=save.cash;assert.ok(buyBike(save,b.id));assert.equal(save.cash,balance);assert.ok(buyUpgrade(save,'handling'));
  const p=createRace('costa',save).riders[0];assert.equal(p.bikeId,b.id);assert.equal(p.maxSpeed,b.speed);assert.equal(p.handling,b.handling+.1);assert.equal(p.armor,b.armor);
 }
 assert.equal(save.owned.length,7);
});

test('version-one campaign saves retain cash, old bikes, upgrades and new purchases after reload',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 try{
  const old=freshSave();old.cash=16000;old.owned.push('veneno');old.bikeId='veneno';old.condition.veneno=100;old.upgrades.veneno={engine:0,armor:0,handling:0};buyUpgrade(old,'engine');old.unlocked=2;old.records.costa={time:150,place:2};persist(old);
  const restored=loadSave();assert.deepEqual(restored,old);assert.ok(buyBike(restored,'veneno'));assert.equal(restored.cash,old.cash);restored.cash=100000;assert.ok(buyBike(restored,'lobo'));buyUpgrade(restored,'handling');persist(restored);assert.deepEqual(loadSave(),restored);
  assert.equal(JSON.parse(data.get(SAVE_KEY)!).version,1);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});

test('server applies selected factory bikes, ignores invented stats, and publishes bike IDs without credentials',()=>{
 const a=makeMember('A',0,'falcao'),b=makeMember('B',0,'lobo');const room=makeRoom('ABCDEF','costa',a,0,true);joinRoom(room,b,0);lobbyClock(room,60000);
 assert.equal(room.race!.riders.length,8);
 for(const member of [a,b]){const p=room.race!.riders.find(r=>r.id===member.id)!;assert.equal(p.bikeId,member.bikeId);assert.equal(p.handling,getBike(member.bikeId).handling);assert.equal(p.maxSpeed,getBike(member.bikeId).speed);}
 const view=viewRoom(room,60000);assert.equal(view.members[1].bikeId,'lobo');assert.equal('token' in view.members[0],false);
 const forged=createMultiplayerRace('costa',[{id:'a',name:'A',bikeId:'invented',maxSpeed:900,handling:100} as any,{id:'b',name:'B',bikeId:'falcao'}]);
 assert.equal(forged.riders[0].bikeId,'ferro');assert.equal(forged.riders[0].maxSpeed,64);assert.equal(forged.riders[1].handling,1.6);
 assert.equal(makeMember('Invalid',0,{id:'lobo'}).bikeId,'ferro');
});

test('prediction and authoritative movement agree for every model through a curve',()=>{
 for(const b of BIKES){const s=createMultiplayerRace('costa',[{id:'a',name:'A',bikeId:b.id},{id:'b',name:'B'}]);s.mode='racing';s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,1);
  Object.assign(s.riders[0],{z:1290,speed:40,x:0});const copy=restoreSnapshot(snapshot(s));
  for(let i=0;i<90;i++){const command={throttle:i<30?1:0,brake:i>=30?.4:0,steer:-.6,attack:null};stepRace(s,{a:command});predictMovement(copy,copy.riders[0],command);}
  for(const key of ['x','z','speed','handling','bikeId'] as const)assert.equal(copy.riders[0][key],s.riders[0][key],b.id+' '+key);
 }
});
