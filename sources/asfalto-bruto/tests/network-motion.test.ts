import test from 'node:test';
import assert from 'node:assert/strict';
import { RacePresentation } from '../src/multiplayer/presentation';
import { cleanAttacks } from '../src/multiplayer/protocol';
import { EMPTY_COMMAND } from '../src/game/types';
import { STEP } from '../src/game/simulation';
import { inputKey, joinRoom, lobbyClock, makeMember, makeRoom, pulseRoom, viewRoom } from '../server/room';

function raceRoom() {
  const room=makeRoom('ABCDEF','costa',makeMember('Ana',0),0);joinRoom(room,makeMember('Bia',0),0);lobbyClock(room,60_000);
  room.race!.traffic=[];room.race!.obstacles=[];
  room.race!.riders.forEach((r,i)=>Object.assign(r,{x:1+i*1.8,z:0,speed:62,weapon:true}));
  return room;
}
test('a released tap survives coalesced movement packets and executes exactly once',()=>{
  const room=raceRoom(),member=room.members[0],key=inputKey(member),[a,b]=room.race!.riders;
  a.weapon=false;
  const input={seq:9,at:60_020,command:{...EMPTY_COMMAND,throttle:1},attacks:[{seq:1,kind:'punch' as const}]};
  for(let n=1;n<=60;n++){
    input.at=60_000+n*STEP*1000;input.seq++;
    pulseRoom(room,{[key]:input,[inputKey(room.members[1])]:{...input,attacks:[]}},input.at+.01);
  }
  assert.equal(room.attackAck[member.id],1);assert.equal(a.id,member.id);
  assert.equal(room.race!.riders[0].hits,1);assert.ok(room.race!.riders[1].health<90);
  assert.equal(room.race!.riders[0].weapon,true);assert.equal(room.race!.riders[1].weapon,false);
  assert.ok(room.race!.events.some(e=>e.type==='hit' && e.tick!==undefined),'hit feedback survives later empty snapshots');
  assert.equal(room.race!.riders[0].attack,null,'resending acknowledged actions cannot restart an attack');
});
test('queued attacks obey cooldowns and invalid payloads cannot bypass the queue bound',()=>{
  assert.equal(cleanAttacks([{seq:1,kind:'punch'},{seq:1,kind:'kick'}]),null);
  assert.equal(cleanAttacks([{seq:NaN,kind:'punch'}]),null);
  assert.equal(cleanAttacks(Array.from({length:9},(_,i)=>({seq:i+1,kind:'kick'}))),null);
  const room=raceRoom(),p=room.members[0];
  const input={seq:1,at:60_020,command:EMPTY_COMMAND,attacks:[{seq:1,kind:'punch' as const},{seq:2,kind:'weapon' as const}]};
  pulseRoom(room,{[inputKey(p)]:input},60_020);assert.equal(room.attackAck[p.id],1);
  input.at=60_300;pulseRoom(room,{[inputKey(p)]:input},60_300);assert.equal(room.attackAck[p.id],1);
  input.at=60_550;pulseRoom(room,{[inputKey(p)]:input},60_550);assert.equal(room.attackAck[p.id],2);
});
test('new snapshots preserve the drawn pose, including correction still in progress',()=>{
  const room=raceRoom(),id=room.members[0].id,presentation=new RacePresentation(id);
  presentation.control({...EMPTY_COMMAND,throttle:1},0);presentation.accept(structuredClone(viewRoom(room,60_000)),0,60_000);
  for(let i=1;i<=20;i++) {
    const now=i*50,before=presentation.view(now)!;
    room.updatedAt=60_000+now;room.race!.tick=i*3;
    room.race!.riders.forEach((r,index)=>{r.z=now*.062+(i%2?1:-1);r.x=1+index*1.8+(i%2?.2:-.2);});
    presentation.accept(structuredClone(viewRoom(room,room.updatedAt)),now,room.updatedAt);
    const after=presentation.view(now)!;
    for(let index=0;index<2;index++) {
      assert.ok(Math.abs(before.riders[index].z-after.riders[index].z)<.0001);
      assert.ok(Math.abs(before.riders[index].x-after.riders[index].x)<.0001);
    }
  }
});
test('local and remote riders share snapshot time, and visual prediction never changes server state',()=>{
  const room=raceRoom(),id=room.members[0].id,presentation=new RacePresentation(id);
  room.race!.riders.forEach(r=>r.speed=r.maxSpeed);
  presentation.control({...EMPTY_COMMAND,throttle:1},0);presentation.accept(viewRoom(room,60_000),0,60_100);
  const original=JSON.stringify(room.race);
  for(let t=0;t<180;t+=STEP*1000){presentation.control({...EMPTY_COMMAND,throttle:1},t);presentation.view(t);}
  const view=presentation.view(180)!;
  assert.ok(Math.abs(view.riders[0].z-view.riders[1].z)<.1);
  presentation.attack('weapon',1,180);
  assert.equal(presentation.view(220)!.riders[0].attack?.kind,'weapon');
  assert.equal(presentation.view(800)!.riders[0].attack,null);
  assert.equal(JSON.stringify(room.race),original);
});
test('authoritative falls and elimination clear local attack previews immediately',()=>{
  const room=raceRoom(),id=room.members[0].id,presentation=new RacePresentation(id);
  presentation.accept(viewRoom(room,60_000),0,60_000);presentation.attack('punch',1,0);
  room.race!.riders[0].crash=2;room.race!.riders[0].attack=null;
  presentation.accept(viewRoom(room,60_030),30,60_030);
  assert.equal(presentation.view(40)!.riders[0].attack,null);
  assert.equal(presentation.canAttack('punch',1000),false);
});

test('a long gap in snapshots freezes extrapolation without pulling a bike backwards',()=>{
  const room=raceRoom(),id=room.members[0].id,presentation=new RacePresentation(id);
  presentation.control({...EMPTY_COMMAND,throttle:1},0);presentation.accept(structuredClone(viewRoom(room,60_000)),0,60_000);
  room.updatedAt+=100;room.race!.tick+=6;room.race!.riders.forEach(r=>r.z+=2);
  presentation.accept(structuredClone(viewRoom(room,60_100)),100,60_100);
  const frozen=presentation.view(500)!,later=presentation.view(1000)!;
  for(let i=0;i<2;i++)assert.ok(later.riders[i].z>=frozen.riders[i].z-.0001);
});
