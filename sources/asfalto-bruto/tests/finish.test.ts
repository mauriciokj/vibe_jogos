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

test('solo riders arriving after a second-place player coast across the line and remain parked',()=>{
  const s=createRace('costa');s.mode='racing';s.time=120;
  const end=getTrack(s.trackId).distance,[player,winner,third,fourth]=s.riders;
  Object.assign(player,{z:end,finishedAt:120,speed:50});
  Object.assign(winner,{z:end,finishedAt:118,speed:50});
  Object.assign(third,{z:end-100,speed:40,x:1.7});
  Object.assign(fourth,{z:end-130,speed:50,x:-1.7});
  for(const r of s.riders.slice(4))Object.assign(r,{z:end-500,speed:30});
  finishRider(s,player,'finish');assert.equal(s.result!.place,2);
  const before=JSON.stringify(s),approaching=finishScene(s,player.id,2),crossing=finishScene(s,player.id,2.5);
  assert.equal(approaching.state.riders[2].z,end-20);
  assert.equal(crossing.state.riders[2].z,end);assert.equal(crossing.state.riders[2].x,third.x);
  const coasting=finishScene(s,player.id,3).state.riders[2];
  assert.ok(coasting.z>end && coasting.z<end+14);assert.ok(coasting.speed>0 && coasting.speed<third.speed);
  const parked=finishScene(s,player.id,6),later=finishScene(s,player.id,120);
  assert.equal(parked.state.riders[2].z,end+14);assert.equal(parked.state.riders[2].x,-2.8);assert.equal(parked.state.riders[2].speed,0);
  assert.equal(parked.state.riders[3].z,end+19);assert.equal(parked.state.riders[3].x,2.8);
  assert.deepEqual(later.state.riders[2],parked.state.riders[2]);assert.deepEqual(later.state.riders[3],parked.state.riders[3]);
  assert.equal(later.winnerId,winner.id);assert.equal(later.state.riders[2].finishedAt,null,'visual arrival must not invent an official time');
  assert.equal(new Set(later.state.riders.map(r=>`${r.x},${r.z}`)).size,8,'all riders have separate parking spaces');
  assert.equal(JSON.stringify(s),before,'no changes to results, snapshots or rewards');
});

test('visual solo arrivals exclude police and eliminated riders, and never extrapolate online racers',()=>{
  const s=createRace();s.mode='racing';s.time=120;
  Object.assign(s.riders[0],{z:8400,finishedAt:120});
  Object.assign(s.riders[1],{z:8390,speed:40,out:'caught'});
  Object.assign(s.riders[2],{z:8390,speed:40,profile:'police'});
  finishRider(s,s.riders[0],'finish');
  const view=finishScene(s,'player',60);
  assert.deepEqual(view.state.riders[1],s.riders[1]);assert.deepEqual(view.state.riders[2],s.riders[2]);
  const multi=createMultiplayerRace('costa',[{id:'a',name:'A'},{id:'b',name:'B'}]);
  multi.mode='racing';multi.time=120;Object.assign(multi.riders[0],{z:8400,finishedAt:120});Object.assign(multi.riders[1],{z:8390,speed:40});
  finishRider(multi,multi.riders[0],'finish');
  assert.deepEqual(finishScene(multi,'a',60).state.riders[1],multi.riders[1]);
});
