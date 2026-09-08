import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, cornerForces, cornerPace, curveAt, getTrack, trackCorners, upcomingCorner } from '../src/game/content';
import { botCommand, createMultiplayerRace, createRace, finishRider, stepRace } from '../src/game/simulation';
import { raceAwareness } from '../src/game/awareness';
import { joinRoom, lobbyClock, makeMember, makeRoom, setReady, viewRoom } from '../server/room';
import { EMPTY_COMMAND } from '../src/game/types';

test('every road has alternating braking zones, a readable approach and a straight finish', () => {
  for (const id of ['costa','serra','deserto']) {
    const bends=trackCorners(id); assert.ok(bends.length>=13);
    for (const [i,c] of bends.entries()) {
      assert.ok(Math.abs(curveAt(c.start,id))<1e-9); assert.ok(Math.abs(curveAt(c.end,id))<1e-9);
      assert.equal(curveAt(c.start+c.ramp,id),c.bend);
      if(i)assert.ok(c.bend*bends[i-1].bend<0);
    }
    const sign=upcomingCorner(bends[1].start-150,id)!;
    assert.equal(sign.distance,150);assert.equal(sign.direction,'left');assert.ok(sign.speed<160);
    assert.equal(curveAt(getTrack(id).distance-50,id),0);
  }
});

test('braking gains time against full throttle through a tight bend, without crashes or opponents', () => {
  function drive(brakes:boolean) {
    const s=createRace();s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
    const p=s.riders[0];Object.assign(p,{z:1100,speed:64,x:0});let shoulder=0;
    while(p.z<1650&&s.time<30) {
      const f=cornerForces(p.speed,p.handling,curveAt(p.z,s.trackId),Math.abs(p.x)>7),pace=cornerPace(p.z,s.trackId,p.handling);
      stepRace(s,{player:{throttle:brakes&&p.speed>pace-.5?0:1,brake:brakes?clamp((p.speed-pace)*.3,0,1):0,steer:clamp(-p.x*.9+f.drift/f.lateral,-1,1),attack:null}});
      shoulder+=Number(Math.abs(p.x)>7)/60;
    }
    assert.equal(p.falls,0);return {time:s.time,shoulder,integrity:p.integrity};
  }
  const fast=drive(false),controlled=drive(true);
  assert.ok(fast.time-controlled.time>.5,JSON.stringify({fast,controlled}));
  assert.ok(fast.shoulder>2);assert.equal(controlled.shoulder,0);assert.equal(controlled.integrity,100);
});

test('optional bots leave eight human slots open, need two humans and only fill at the start', () => {
  const a=makeMember('Ana',0),room=makeRoom('ABCDEF','costa',a,0,true);
  setReady(room,a.id,a.epoch,true,0);lobbyClock(room,60_001);
  assert.equal(room.phase,'lobby');assert.equal(room.race,null);
  assert.equal(viewRoom(room,60_001).fillBots,true);
  const b=makeMember('Bia',60_001);joinRoom(room,b,60_001);setReady(room,b.id,b.epoch,true,60_002);
  lobbyClock(room,65_003);assert.equal(room.phase,'racing');assert.equal(room.members.length,2);
  const s=room.race!;assert.equal(s.riders.length,8);assert.deepEqual(s.multiplayer!.humanIds,[a.id,b.id]);
  assert.equal(s.riders.filter(r=>r.profile!=='player'&&r.name.endsWith(' CPU')).length,6);
  assert.equal(new Set(s.riders.map(r=>r.id)).size,8);assert.ok(s.riders.every(r=>r.maxSpeed===64));
  const crowded=makeRoom('GHIJKL','costa',makeMember('1',0),0,true);
  for(let i=1;i<8;i++)joinRoom(crowded,makeMember(String(i+1),0),0);
  lobbyClock(crowded,60_000);assert.equal(crowded.race!.riders.length,8);assert.ok(crowded.race!.riders.every(r=>r.profile==='player'));
  const off=createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}]);assert.equal(off.riders.length,2);
});

test('bots use authoritative AI, brake for corners, and stop when every human is done', () => {
  const s=createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}],42,true);s.mode='racing';s.traffic=[];s.obstacles=[];
  const bot=s.riders[2];Object.assign(bot,{z:1295,speed:64,x:0});
  const cmd=botCommand(s,bot);assert.equal(cmd.throttle,0);assert.ok(cmd.brake>.5);
  const start=s.riders[3].z;for(let i=0;i<120;i++)stepRace(s,{a:EMPTY_COMMAND,b:EMPTY_COMMAND});assert.ok(s.riders[3].z>start+10);
  finishRider(s,s.riders[0],'caught');assert.equal(s.mode,'racing');
  finishRider(s,s.riders[1],'left');assert.equal(s.mode,'finished');assert.equal(Object.keys(s.multiplayer!.results).length,8);
  const done=JSON.stringify(s.riders),tick=s.tick;stepRace(s);assert.equal(JSON.stringify(s.riders),done);assert.equal(s.tick,tick);
});

test('map and mirror use the local identity, signed route distances and the 200m boundary', () => {
  const s=createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}],42,true);
  const me=s.riders[1];me.z=1000;me.speed=40;s.riders[0].z=1075;
  s.riders.slice(2).forEach((r,i)=>{r.z=1000-[18,200,201,400,650,700][i];r.speed=50;});
  s.riders[7].out='caught';
  const view=raceAwareness(s,'b');assert.equal(view.ahead?.id,'a');assert.equal(view.ahead?.gap,75);
  assert.equal(view.behind?.gap,-18);assert.equal(view.racers.find(r=>r.local)?.id,'b');
  assert.deepEqual(view.rear.map(r=>r.distance),[200,18]);assert.ok(view.rear.every(r=>r.closing));
  assert.equal(view.racers.find(r=>r.id===s.riders[7].id)?.out,'caught');
});
