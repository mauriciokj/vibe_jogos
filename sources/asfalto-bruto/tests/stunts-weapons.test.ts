import { RacePresentation } from '../src/multiplayer/presentation';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buyWeapon, freshSave, loadSave, persist, SAVE_KEY, settleRace } from '../src/game/save';
import { createRace, createMultiplayerRace, finishRider, performAction, predictMovement, restoreSnapshot, snapshot, stepRace, STEP } from '../src/game/simulation';
import { EMPTY_COMMAND, type Traffic, type RaceCondition } from '../src/game/types';
import { WEAPONS } from '../src/game/weapons';
import { jumpHeight, wheeliesLeft } from '../src/game/stunts';
import { inputKey, joinRoom, lobbyClock, makeMember, makeRoom, pulseRoom, viewRoom } from '../server/room';
import { cleanActions } from '../src/multiplayer/protocol';

function road(condition: RaceCondition='day') {
  const s=createRace('costa',undefined,777,condition);s.mode='racing';s.countdown=0;s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,1);
  Object.assign(s.riders[0],{x:-1.7,z:0,speed:45});return s;
}
const drive={...EMPTY_COMMAND,throttle:1};
const car=(kind:Traffic['kind']='car',speed=-20,z=40):Traffic=>({id:'target',kind,x:-1.7,z,speed,color:'#abc'});
test('three wheelie activations per race, no stacking, pause/reconnect preserve uses, new race resets',()=>{
  const s=road(),p=s.riders[0];p.speed=10;performAction(s,p,'wheelie');assert.equal(wheeliesLeft(p),3);p.speed=45;
  for(let remaining=2;remaining>=0;remaining--){performAction(s,p,'wheelie');performAction(s,p,'wheelie');assert.equal(wheeliesLeft(p),remaining);for(let i=0;i<150;i++)stepRace(s,{player:drive});}
  performAction(s,p,'wheelie');assert.equal(p.wheelieTime,0);assert.equal(wheeliesLeft(restoreSnapshot(snapshot(s)).riders[0]),0);assert.equal(wheeliesLeft(createRace().riders[0]),3);
});
test('wheelie automatically clears one oncoming car and lands without damage in dry and rain',()=>{
  for(const condition of ['day','rain'] as const){const s=road(condition),p=s.riders[0];s.traffic=[car()];performAction(s,p,'wheelie');let peak=0;
    for(let i=0;i<100;i++){stepRace(s,{player:drive});peak=Math.max(peak,jumpHeight(p));}
    assert.ok(peak>2);assert.equal(p.falls,0);assert.equal(p.integrity,100);assert.ok(p.z>s.traffic[0].z);assert.equal(p.jumpTime,0);assert.equal(p.jumpTarget,undefined);assert.equal(wheeliesLeft(p),2);
  }
});
test('wheelie grants no immunity to vans, trucks, forward traffic or a second car during the jump',()=>{
  for(const [kind,speed,z] of [['van',-20,30],['truck',-20,30],['car',20,24]] as const){const s=road(),p=s.riders[0];s.traffic=[car(kind,speed,z)];performAction(s,p,'wheelie');
    for(let i=0;i<100&&!p.crash;i++)stepRace(s,{player:drive});assert.equal(p.falls,1,`${kind}/${speed}`);assert.equal(p.jumpTime,0);assert.equal(wheeliesLeft(p),2);
  }
  const s=road(),p=s.riders[0];s.traffic=[car(),{...car(),id:'second',z:47}];performAction(s,p,'wheelie');for(let i=0;i<100&&!p.crash;i++)stepRace(s,{player:drive});assert.equal(p.falls,1);
});
test('late activation, braking and shoulder do not provide free escape; police still arrest a fallen rider',()=>{
  const s=road(),p=s.riders[0];s.traffic=[car('truck',-20,20)];const cop={...createRace().riders[1],id:'police',profile:'police' as const,x:2,z:0,speed:45};s.riders.push(cop);performAction(s,p,'wheelie');
  for(let i=0;i<60&&s.mode!=='finished';i++)stepRace(s,{player:drive,police:drive});assert.equal(s.result?.reason,'caught');
  const late=road();late.traffic=[car('car',-20,4)];performAction(late,late.riders[0],'wheelie');for(let i=0;i<5;i++)stepRace(late,{player:drive});assert.equal(late.riders[0].falls,1);
  const brake=road();performAction(brake,brake.riders[0],'wheelie');stepRace(brake,{player:{...EMPTY_COMMAND,brake:1}});assert.equal(brake.riders[0].wheelieTime,0);assert.equal(wheeliesLeft(brake.riders[0]),2);
  brake.riders[0].x=8;performAction(brake,brake.riders[0],'wheelie');assert.equal(wheeliesLeft(brake.riders[0]),2);
});
test('stunt snapshot restores a midair jump and movement prediction uses the same timers',()=>{
  const s=road();s.traffic=[car()];performAction(s,s.riders[0],'wheelie');for(let i=0;i<25;i++)stepRace(s,{player:drive});assert.ok(s.riders[0].jumpTime!>0);
  const copy=restoreSnapshot(snapshot(s));for(let i=0;i<80;i++){stepRace(s,{player:drive});stepRace(copy,{player:drive});}assert.equal(snapshot(copy),snapshot(s));
  const local=road();performAction(local,local.riders[0],'wheelie');const predicted=restoreSnapshot(snapshot(local));
  for(let i=0;i<60;i++){stepRace(local,{player:drive});predictMovement(predicted,predicted.riders[0],drive);}assert.equal(predicted.riders[0].z,local.riders[0].z);assert.equal(predicted.riders[0].wheelieTime,local.riders[0].wheelieTime);
});
test('weapon purchases persist across losses, re-equipping is free, legacy and invalid saves stay safe',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
  try{const save=freshSave();save.cash=10000;persist(save);assert.deepEqual(loadSave(),save);
    for(const w of WEAPONS){const old=save.cash;assert.ok(buyWeapon(save,w.id));assert.equal(save.cash,old-w.price);assert.ok(buyWeapon(save,w.id));assert.equal(save.cash,old-w.price);}
    const s=createRace('costa',save);finishRider(s,s.riders[0],'caught');settleRace(save,s);persist(save);assert.deepEqual(loadSave(),save);assert.equal(createRace('costa',loadSave()).riders[0].weaponId,'chain');
    save.cash=0;assert.ok(buyWeapon(save,'bottle'));assert.equal(buyWeapon(save,'fake'),false);assert.equal(buyWeapon(freshSave(),'chain'),false);
    data.set(SAVE_KEY,JSON.stringify({...save,ownedWeapons:['bottle','bottle','fake'],weaponId:'chain'}));const safe=loadSave();assert.deepEqual(safe.ownedWeapons,['bottle']);assert.equal(safe.weaponId,undefined);
    assert.equal(createRace('costa',{...freshSave(),weaponId:'chain'}).riders[0].weaponId,undefined);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as any).localStorage;}
});
test('each purchased weapon inflicts its own damage after windup and range matters; punches cannot steal it',()=>{
  for(const w of WEAPONS){const s=createMultiplayerRace('costa',[{id:'a',name:'A',weaponId:w.id},{id:'b',name:'B',weaponId:'bottle'}]);s.mode='racing';s.traffic=[];s.obstacles=[];const [a,b]=s.riders;Object.assign(a,{x:0,z:0});Object.assign(b,{x:2,z:0});
    stepRace(s,{a:{...EMPTY_COMMAND,attack:'weapon'},b:EMPTY_COMMAND});assert.equal(b.health,100);
    for(let i=0;i<100&&!s.events.some(e=>e.type==='hit');i++)stepRace(s,{a:EMPTY_COMMAND,b:EMPTY_COMMAND});assert.equal(b.health,100-w.damage);assert.equal(a.hits,1);
    a.attack=null;a.cooldown=0;Object.assign(b,{x:2,z:a.z,immune:0});stepRace(s,{a:{...EMPTY_COMMAND,attack:'punch'},b:EMPTY_COMMAND});for(let i=0;i<15;i++)stepRace(s,{a:EMPTY_COMMAND,b:EMPTY_COMMAND});assert.equal(b.weapon,true);assert.equal(b.weaponId,'bottle');assert.equal(a.weaponId,w.id);
  }
  for(const [id,hit] of [['bottle',false],['bat',false],['chain',true]] as const){const s=createMultiplayerRace('costa',[{id:'a',name:'A',weaponId:id},{id:'b',name:'B'}]);s.mode='racing';s.traffic=[];s.obstacles=[];s.riders[0].x=0;s.riders[1].x=4;s.riders[0].z=s.riders[1].z=0;stepRace(s,{a:{...EMPTY_COMMAND,attack:'weapon'},b:EMPTY_COMMAND});for(let i=0;i<45;i++)stepRace(s,{a:EMPTY_COMMAND,b:EMPTY_COMMAND});assert.equal(s.riders[0].hits>0,hit);}
});
test('server normalizes loadouts and consumes a retransmitted wheelie only once, including snapshot resume',()=>{
  const a=makeMember('A',0,'ferro',{weaponId:'chain'}),b=makeMember('B',0,'lobo',{weaponId:'invented'}),room=makeRoom('ABCDEF','costa',a,0,true);joinRoom(room,b,0);lobbyClock(room,60000);
  const p=room.race!.riders[0];Object.assign(p,{speed:45,x:0});room.race!.traffic=[];room.race!.obstacles=[];
  assert.equal(viewRoom(room,60000).members[0].weaponId,'chain');assert.equal(room.race!.riders[1].weaponId,undefined);
  const actions=[{seq:1,kind:'wheelie' as const}];assert.deepEqual(cleanActions(actions),actions);
  for(let i=1;i<=20;i++){const at=60000+i*20;pulseRoom(room,{[inputKey(a)]:{seq:i,at,command:drive,actions}},at);}assert.equal(wheeliesLeft(p),2);assert.equal(room.actionAck![a.id],1);
  const display=new RacePresentation(p.id);display.accept(viewRoom(room,60400),0,60400);display.attack('weapon',1,10);assert.ok(display.view(10)!.riders[0].attack);p.jumpTime=.8;p.attack=null;display.accept(viewRoom(room,60401),20,60401);assert.equal(display.view(20)!.riders[0].attack,null,'Takeoff cancels an unfinished local attack preview');
  const restored=JSON.parse(JSON.stringify(room));const at=60500;pulseRoom(restored,{[inputKey(restored.members[0])]:{seq:22,at,command:drive,actions}},at);assert.equal(wheeliesLeft(restored.race.riders[0]),2);assert.equal(restored.race.riders[0].weaponId,'chain');
});
