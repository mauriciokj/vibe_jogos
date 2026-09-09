import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKES } from '../src/game/content';
import { CONDITIONS } from '../src/game/conditions';
import { GUARD_RAIL_LIMIT, guardRailPosition } from '../src/game/guardrails';
import { createRace, stepRace, predictMovement, STEP, snapshot, restoreSnapshot } from '../src/game/simulation';
import { EMPTY_COMMAND, type RaceCondition } from '../src/game/types';
import { freshSave,buyBike } from '../src/game/save';
import { RacePresentation } from '../src/multiplayer/presentation';
import { makeRoom,makeMember,joinRoom,lobbyClock,viewRoom } from '../server/room';

function road(track='porto',condition:RaceCondition='day',bike='ferro') {
  const save=freshSave();save.cash=1e6;buyBike(save,bike);
  const s=createRace(track,save,88117,condition);s.mode='racing';s.traffic=[];s.obstacles=[];s.heat=0;s.riders=s.riders.slice(0,1);
  Object.assign(s.riders[0],{speed:50,z:0,x:-6.95});return s;
}
test('every bike and weather is contained and slowed by each visible rail without a fall or damage',()=>{
  for(const [track,side] of [['porto',-1],['costa',-1],['serra',-1],['serra',1]] as const)for(const condition of CONDITIONS)for(const bike of BIKES){
    const s=road(track,condition.id,bike.id),p=s.riders[0];p.x=side*6.95;
    for(let i=0;i<120;i++) {stepRace(s,{player:{...EMPTY_COMMAND,throttle:1,steer:side}});assert.ok(Math.abs(p.x)<=GUARD_RAIL_LIMIT+1e-10);}
    assert.ok(p.speed<30,`${track}/${condition.id}/${bike.id}: ${p.speed}`);assert.equal(p.falls,0);assert.equal(p.crash,0);assert.equal(p.health,100);assert.equal(p.integrity,100);
    const speed=p.speed;stepRace(s,{player:{...EMPTY_COMMAND,throttle:1,steer:-side}});assert.ok(Math.abs(p.x)<GUARD_RAIL_LIMIT);assert.ok(p.speed>speed,'can steer away and accelerate immediately');
  }
});
test('open roadsides have no invisible barriers, and riding beside a rail does not drag',()=>{
  for(const [track,side] of [['porto',1],['costa',1],['deserto',-1],['deserto',1]] as const){const s=road(track),p=s.riders[0];p.x=side*6.95;for(let i=0;i<60;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1,steer:side}});assert.ok(Math.abs(p.x)>8);}
  const s=road(),p=s.riders[0];p.x=-6.8;for(let i=0;i<60;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.equal(p.x,-6.8);assert.ok(p.speed>50);
});
test('high speed, nitro, jumps, wheelies and temporary immunity cannot cross a rail',()=>{
  for(const mode of [{immune:2},{nitroTime:5},{wheelieTime:2},{jumpTime:.8,jumpTarget:'car'}]){
    const s=road(),p=s.riders[0];Object.assign(p,{...mode,speed:110,x:-6.99});for(let i=0;i<20;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1,steer:-1}});assert.ok(p.x>=-GUARD_RAIL_LIMIT);assert.equal(p.falls,0);
  }
  const s=road(),p=s.riders[0];p.x=-10;stepRace(s,{player:EMPTY_COMMAND});assert.ok(p.x>=-GUARD_RAIL_LIMIT,'restored positions recover to the inside');
});
test('a kick into the rail applies its ordinary combat damage but cannot push a rider through',()=>{
  const s=road(),p=s.riders[0];p.speed=0;
  const rival={...createRace().riders[1],profile:'player' as const,x:-5.3,z:0,speed:0};s.riders.push(rival);
  for(let i=0;i<30;i++)stepRace(s,{[rival.id]:{...EMPTY_COMMAND,attack:'kick'}});
  assert.ok(p.health<100);assert.ok(p.x>=-GUARD_RAIL_LIMIT);assert.equal(p.integrity,100);assert.equal(p.falls,0);
});
test('prediction agrees with the server through contact, slowdown and release without altering snapshots',()=>{
  const server=road('serra','rain'),predicted=restoreSnapshot(snapshot(server));
  for(let i=0;i<180;i++){
    const cmd={...EMPTY_COMMAND,throttle:1,steer:i<120?-1:1};const original=snapshot(predicted);
    stepRace(server,{player:cmd});predictMovement(predicted,predicted.riders[0],cmd);
    assert.equal(predicted.riders[0].x,server.riders[0].x);assert.equal(predicted.riders[0].z,server.riders[0].z);assert.equal(predicted.riders[0].speed,server.riders[0].speed);
    assert.deepEqual(predicted.events,JSON.parse(original).events);
  }
});
test('remote extrapolation and blended corrections remain inside the visible rail',()=>{
  const room=makeRoom('RAIL00','porto',makeMember('Ana',0),0,true);joinRoom(room,makeMember('Bia',0),0);lobbyClock(room,60000);
  const s=room.race!;s.traffic=[];s.obstacles=[];s.riders.forEach((r,i)=>Object.assign(r,{x:i?-6.8:0,z:i*20,speed:40}));
  const view=new RacePresentation(room.members[0].id);view.accept(structuredClone(viewRoom(room,60000)),0,60000);
  s.riders[1].x=-7;room.updatedAt=60050;view.accept(structuredClone(viewRoom(room,60050)),50,60050);
  const original=snapshot(s);
  for(let t=50;t<500;t+=STEP*1000)for(const r of view.view(t)!.riders)assert.equal(r.x,guardRailPosition('porto',r.x));
  assert.equal(snapshot(s),original);
});
