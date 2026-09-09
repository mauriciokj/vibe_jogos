import test from 'node:test';
import assert from 'node:assert/strict';
import { HELMETS, HELMET_COLORS, equippedHelmet } from '../src/game/helmets';
import { buyBike, buyHelmet, paintHelmet, freshSave, loadSave, persist, SAVE_KEY, settleRace } from '../src/game/save';
import { createRace, createMultiplayerRace, stepRace, restoreSnapshot, snapshot } from '../src/game/simulation';
import { EMPTY_COMMAND } from '../src/game/types';
import { makeMember, makeRoom, joinRoom, lobbyClock, viewRoom } from '../server/room';
import { RacePresentation } from '../src/multiplayer/presentation';

test('helmet purchases are permanent and repainting/equipping never spends credits twice',()=>{
  const save=freshSave();assert.equal(equippedHelmet(save).id,'integral');assert.equal(buyHelmet(save,'retro'),false);assert.equal(buyHelmet(save,'invalid'),false);
  save.cash=10000;
  for(const helmet of HELMETS){const before=save.cash;assert.ok(buyHelmet(save,helmet.id));assert.equal(save.cash,before-helmet.price);assert.equal(equippedHelmet(save).id,helmet.id);const after=save.cash;assert.ok(buyHelmet(save,helmet.id));assert.equal(save.cash,after);}
  for(const color of HELMET_COLORS){const before=save.cash;assert.ok(paintHelmet(save,color.id));assert.equal(save.helmetColorId,color.id);assert.equal(save.cash,before);}
  assert.equal(paintHelmet(save,'#ff0000'),false);assert.equal(save.helmetColorId,'purple');
  assert.ok(buyHelmet(save,'integral'));assert.deepEqual(save.ownedHelmets,HELMETS.map(h=>h.id));assert.ok(buyHelmet(save,'racing'));
  const race=createRace('porto',save);race.result={reason:'caught',place:8,time:10,reward:120,hits:0,falls:1};settleRace(save,race);assert.equal(equippedHelmet(save).id,'racing');assert.equal(save.helmetColorId,'purple');assert.deepEqual(save.ownedHelmets,HELMETS.map(h=>h.id));
});
test('legacy saves retain equipment and cash; invalid or unowned helmet choices fall back safely',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
  try{
    const old=freshSave();delete old.helmetId;delete old.helmetColorId;delete old.ownedHelmets;old.cash=95000;old.ownedKneePads=['gold'];old.kneePadId='gold';old.ownedWeapons=['chain'];old.weaponId='chain';buyBike(old,'lobo');
    persist(old);const save=loadSave();assert.equal(save.cash,old.cash);assert.deepEqual(save.owned,old.owned);assert.equal(save.kneePadId,'gold');assert.equal(save.weaponId,'chain');assert.equal(save.helmetId,'integral');assert.equal(save.helmetColorId,'white');
    buyHelmet(save,'racing');paintHelmet(save,'red');persist(save);assert.deepEqual(loadSave(),save);
    data.set(SAVE_KEY,JSON.stringify({...save,ownedHelmets:['fake','retro','retro'],helmetId:'racing',helmetColorId:'url(bad)'}));const safe=loadSave();assert.deepEqual(safe.ownedHelmets,['integral','retro']);assert.equal(safe.helmetId,'integral');assert.equal(safe.helmetColorId,'white');
    assert.equal(createRace('costa',{...safe,helmetId:'racing'}).riders[0].helmetId,'integral');
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});
test('all helmet combinations leave handling, damage and seeded racing unchanged',()=>{
  const baseline=createRace('porto',freshSave(),817,'rain');baseline.mode='racing';
  const strip=(s:typeof baseline)=>JSON.parse(JSON.stringify(s,(_k,v)=>v && typeof v==='object' && 'helmetId' in v?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='helmetId'&&k!=='helmetColorId')):v));
  const command={...EMPTY_COMMAND,throttle:1,steer:.6,attack:'kick' as const};for(let i=0;i<120;i++)stepRace(baseline,{player:command});
  for(const h of HELMETS)for(const c of HELMET_COLORS){const save=freshSave();save.cash=10000;buyHelmet(save,h.id);paintHelmet(save,c.id);const s=createRace('porto',save,817,'rain');s.mode='racing';for(let i=0;i<120;i++)stepRace(s,{player:command});assert.deepEqual(strip(s),strip(baseline));}
});
test('multiplayer validates cosmetics, shares distinct humans and bots, and preserves them through snapshots and prediction',()=>{
  const a=makeMember('A',0,'lobo',{helmetId:'retro',helmetColorId:'orange'}),b=makeMember('B',0,'ferro',{helmetId:'racing',helmetColorId:'purple'});
  const invalid=makeMember('X',0,'ferro',{helmetId:'<script>',helmetColorId:'red;url(x)'});assert.equal(invalid.helmetId,'integral');assert.equal(invalid.helmetColorId,'white');
  const room=makeRoom('HLMETS','porto',a,0,true);joinRoom(room,b,0);lobbyClock(room,60000);const view=viewRoom(room,60000);assert.equal(view.members[0].helmetId,'retro');assert.equal(view.members[1].helmetColorId,'purple');assert.equal('token' in view.members[0],false);
  const race=room.race!;assert.equal(race.riders[0].helmetId,'retro');assert.equal(race.riders[1].helmetColorId,'purple');assert.equal(race.riders.length,8);assert.ok(new Set(race.riders.slice(2).map(r=>r.helmetId)).size>1);
  const before=snapshot(race);const presentation=new RacePresentation(a.id);presentation.accept(view,0,60000);presentation.control({...EMPTY_COMMAND,throttle:1},0);assert.equal(presentation.view(100)!.riders[0].helmetId,'retro');assert.equal(presentation.view(100)!.riders[1].helmetColorId,'purple');assert.equal(snapshot(race),before);assert.equal(snapshot(restoreSnapshot(before)),before);
  const legacy=createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}]);assert.equal(legacy.riders[0].helmetId,'integral');assert.equal(legacy.riders[1].helmetColorId,'white');
});
