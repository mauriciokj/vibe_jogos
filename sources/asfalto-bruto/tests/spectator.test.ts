import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, finishRider, crashRider } from '../src/game/simulation';
import { spectatorTarget, spectatorTargets } from '../src/multiplayer/spectator';
import type { RoomView } from '../src/multiplayer/protocol';

function fixture() {
  const race=createRace('costa');race.mode='racing';
  race.multiplayer={humanIds:race.riders.slice(0,3).map(r=>r.id),results:{}};
  const room:RoomView={code:'CAMERA',trackId:'costa',fillBots:true,phase:'racing',locked:true,deadline:null,serverNow:0,revision:1,ack:{},attackAck:{},simulationAt:0,race,
    members:race.riders.slice(0,3).map(r=>({id:r.id,name:r.name,bikeId:'ferro',ready:true,connected:true}))};
  return {room,race,local:race.riders[0],a:race.riders[1],b:race.riders[2]};
}
test('only a caught or wrecked player can watch other connected humans still racing',()=>{
  for(const reason of ['caught','wrecked','finish','left','timeout'] as const){
    const {room,race,local,a,b}=fixture();
    assert.deepEqual(spectatorTargets(room,local.id),[]);
    finishRider(race,local,reason);
    assert.deepEqual(spectatorTargets(room,local.id).map(r=>r.id),['caught','wrecked'].includes(reason)?[a.id,b.id]:[]);
  }
  assert.deepEqual(spectatorTargets(null,'player'),[]);
});
test('cycling wraps, keeps a sole target, and changing rank never changes the selected rider',()=>{
  const {room,race,local,a,b}=fixture();finishRider(race,local,'caught');
  const before=JSON.stringify(room),targets=spectatorTargets(room,local.id);
  assert.equal(spectatorTarget(targets,null),a.id);
  assert.equal(spectatorTarget(targets,a.id,true),b.id);
  assert.equal(spectatorTarget(targets,b.id,true),a.id);
  assert.equal(spectatorTarget([a],a.id,true),a.id);
  assert.equal(JSON.stringify(room),before,'spectating never mutates the race or results');
  b.z=a.z+1000;assert.equal(spectatorTarget(spectatorTargets(room,local.id),a.id),a.id);
});
test('loss, finish, departure, explosion and disconnect remove targets; a recoverable fall remains watchable',()=>{
  const {room,race,local,a,b}=fixture();finishRider(race,local,'wrecked');
  crashRider(race,a,true);assert.equal(spectatorTargets(room,local.id)[0].id,a.id);
  room.members[1].connected=false;assert.equal(spectatorTarget(spectatorTargets(room,local.id),a.id),b.id);
  room.members[1].connected=true;assert.equal(spectatorTargets(room,local.id).length,2);
  a.recovery!.phase='exploding';assert.equal(spectatorTargets(room,local.id).length,1);
  a.recovery=undefined;a.finishedAt=10;assert.equal(spectatorTargets(room,local.id).length,1);
  a.finishedAt=null;a.out='left';assert.equal(spectatorTargets(room,local.id).length,1);
  a.out=undefined;finishRider(race,a,'caught');finishRider(race,b,'finish');
  assert.equal(spectatorTarget(spectatorTargets(room,local.id),a.id),null);
});
test('finished rooms have no spectator targets even with stale riders',()=>{
  const {room,race,local}=fixture();finishRider(race,local,'caught');room.phase='finished';
  assert.deepEqual(spectatorTargets(room,local.id),[]);
});
