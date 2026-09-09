import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISH_SECONDS, finishPullback, finishScene, finishWinner } from '../src/game/finish';
import { createMultiplayerRace, createRace, finishRider, stepRace } from '../src/game/simulation';
import { getTrack } from '../src/game/content';
import { EMPTY_COMMAND } from '../src/game/types';

test('only the first real finisher celebrates, for solo rivals and either online identity',()=>{
  for(const s of [createRace(),createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}],42,true)]){
    assert.equal(finishWinner(s),undefined);
    const [a,b]=s.riders;a.z=getTrack(s.trackId).distance;b.z=a.z;
    b.finishedAt=110;a.finishedAt=120;
    assert.equal(finishWinner(s)?.id,b.id);
    const police={...a,id:'police',profile:'police' as const,finishedAt:100};s.riders.push(police);
    assert.equal(finishWinner(s)?.id,b.id);
    b.out='caught';assert.equal(finishWinner(s)?.id,a.id);
    a.finishedAt=null;assert.equal(finishWinner(s),undefined);
  }
});

test('finish scene parks winner and others without changing snapshots, finish times, or rewards',()=>{
  const s=createRace('terra',undefined,77,'rain');s.mode='racing';s.time=120;s.traffic=[];s.obstacles=[];
  const p=s.riders[0];p.z=7200;p.finishedAt=120;p.speed=52;p.attack={kind:'weapon',age:.12,side:1,hit:false};
  s.riders[1].finishedAt=121;finishRider(s,p,'finish');
  const before=JSON.stringify(s),initial=finishScene(s,p.id,0),wide=finishScene(s,p.id,FINISH_SECONDS);
  assert.equal(initial.state.riders[0].z,7200);assert.equal(initial.pullback,0);
  assert.equal(wide.state.riders[0].z,7218);assert.equal(wide.state.riders[0].x,0);assert.equal(wide.state.riders[0].attack,null);
  assert.notEqual(wide.state.riders[1].x,0);assert.equal(wide.state.riders[0].finishedAt,120);
  assert.equal(wide.state.result?.reward,s.result?.reward);assert.equal(wide.pullback,1);assert.equal(JSON.stringify(s),before);
  let previous=0;for(let t=0;t<FINISH_SECONDS;t+=.1){const progress=finishPullback(t);assert.ok(progress>=previous&&progress<=1);previous=progress;}
});

test('one online arrival does not end the other player’s race while its camera celebrates',()=>{
  const s=createMultiplayerRace('costa',[{id:'host',name:'Host'},{id:'guest',name:'Guest'}]);s.mode='racing';s.time=120;s.traffic=[];s.obstacles=[];
  const [a,b]=s.riders;Object.assign(a,{z:8400,finishedAt:120,speed:50});Object.assign(b,{z:8000,speed:40});finishRider(s,a,'finish');
  const before=b.z;for(let i=0;i<120;i++)stepRace(s,{host:EMPTY_COMMAND,guest:{...EMPTY_COMMAND,throttle:1}});
  assert.equal(s.mode,'racing');assert.ok(b.z>before);assert.equal(Object.keys(s.multiplayer!.results).length,1);
  assert.equal(finishScene(s,'host',3).winnerId,'host');assert.equal(finishScene(s,'guest',null).winnerId,'host');
});
