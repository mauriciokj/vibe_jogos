import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, curveAt, getTrack, elevationAt, cornerPace } from '../src/game/content';
import { FOREST_CORNERS, FOREST_BRANCHES, forestEvent, FOREST_NARROWS, FOREST_MUD, forestRoad, forestTrafficX, forestMudAt, FOREST_WILDLIFE, FOREST_HAIRPIN } from '../src/game/forest';
import { recoveryCommand } from '../src/game/recovery';
import { MOTORBIKES } from '../src/game/bikes';
import { CONDITIONS, advanceScenicEvent, scenicAppearance } from '../src/game/conditions';
import { RACE_ROUTES } from '../src/game/routes';
import { createRace, createMultiplayerRace, stepRace, predictMovement, snapshot, restoreSnapshot } from '../src/game/simulation';
import { freshSave, buyBike } from '../src/game/save';
import { roadHalf, surfaceGrip, surfaceDrag } from '../src/game/road-profile';
import { EMPTY_COMMAND } from '../src/game/types';
import { safeDrivingCommand } from './driving';

test('Mata is the sixth track with four conditions and its own readable course',()=>{
  assert.equal(TRACKS.length,6);assert.equal(RACE_ROUTES.length,24);assert.equal(TRACKS[5].id,'mata');assert.equal(RACE_ROUTES.filter(r=>r.track.id==='mata').length,4);
  assert.equal(getTrack('mata').distance,7600);assert.equal(curveAt(100,'mata'),0);assert.equal(curveAt(7200,'mata'),0);
  assert.equal(FOREST_CORNERS.length,20);
  for(const c of FOREST_CORNERS)assert.equal(Math.sign(curveAt((c.start+c.end)/2,'mata')),Math.sign(c.bend));
  for(const site of FOREST_BRANCHES){assert.equal(curveAt(site.z,'mata'),0);assert.equal(curveAt(site.z-100,'mata'),0);assert.ok(Math.abs(elevationAt(site.z+1,'mata')-elevationAt(site.z,'mata'))<.04);}
});
test('Mata uses the same deterministic four-condition simulation and snapshots',()=>{
  for(const condition of CONDITIONS){
    const a=createRace('mata',undefined,91,condition.id),b=createRace('mata',undefined,91,condition.id);
    assert.deepEqual(a,b);assert.equal(a.obstacles.length,3);assert.ok(a.obstacles.every(o=>o.width===2.6));
    const online=createMultiplayerRace('mata',[{id:'a',name:'A'},{id:'b',name:'B'}],91,true,condition.id);
    assert.deepEqual(a.obstacles,online.obstacles);assert.deepEqual(a.traffic,online.traffic);
    for(let i=0;i<400;i++){stepRace(a);stepRace(b);}assert.equal(snapshot(a),snapshot(b));
    const restored=restoreSnapshot(snapshot(a));stepRace(a);stepRace(restored);assert.equal(snapshot(a),snapshot(restored));
  }
});
test('monkey appears briefly, survives snapshots, and changes no simulation or reward',()=>{
  const seeds=Array.from({length:1000},(_,i)=>i).filter(s=>forestEvent(s));assert.ok(seeds.length>260 && seeds.length<400);
  const a=createRace('mata',undefined,seeds[0],'rain');a.mode='racing';a.riders[0].z=a.scenicEvent!.z-150;
  advanceScenicEvent(a);assert.equal(scenicAppearance(a)?.kind,'monkey');assert.deepEqual(scenicAppearance(restoreSnapshot(snapshot(a))),scenicAppearance(a));
  const b=restoreSnapshot(snapshot(a));delete b.scenicEvent;
  for(let i=0;i<600;i++){stepRace(a);stepRace(b);}
  assert.equal(scenicAppearance(a),null);delete a.scenicEvent;assert.deepEqual(a,b);
});
test('three lanes merge gradually to one per direction, with traffic remaining on asphalt',()=>{
  assert.equal(forestRoad(0).lanes.length,3);assert.equal(forestRoad(0).center,-2.1);
  for(const section of FOREST_NARROWS){
    const middle=(section.start+section.end)/2;
    assert.equal(forestRoad(middle).lanes.length,2);assert.ok(Math.abs(roadHalf('mata',middle)-4.2)<1e-9);
    let previous=forestRoad(section.start).half;
    for(let z=section.start;z<section.end;z++){
      const road=forestRoad(z);assert.ok(Math.abs(road.half-previous)<.02);previous=road.half;
      for(const speed of [-20,20])for(const forestLane of [0,1] as const){
        const x=forestTrafficX({id:'t',kind:'car',color:'red',x:0,z,speed,forestLane});
        assert.ok(Math.abs(x)+1.85<=road.half+.001);
        assert.equal(x<road.center,speed<0);
      }
    }
  }
});
test('mud affects only its visible strip and authoritative movement matches prediction',()=>{
  for(const site of FOREST_MUD){
    const z=(site.start+site.end)/2,x=site.side*(forestRoad(z).half-1.5);
    assert.equal(forestMudAt(z,x),1);assert.equal(forestMudAt(z,-x),0);assert.equal(forestMudAt(site.end+1,x),0);
    assert.ok(surfaceGrip('mata','day',z,x)<surfaceGrip('mata','day',z,-x));
    assert.ok(surfaceGrip('mata','rain',z,x)<surfaceGrip('mata','day',z,x));
    assert.ok(surfaceDrag('mata','day',z,x)>0);
    const s=createRace('mata');s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];Object.assign(s.riders[0],{x,z,speed:28});
    const predicted=restoreSnapshot(snapshot(s)),before=s.riders[0].speed;
    for(let i=0;i<12;i++){
      predictMovement(predicted,predicted.riders[0],EMPTY_COMMAND);stepRace(s,{player:EMPTY_COMMAND});
      for(const field of ['x','z','speed','mudSlip','mudSide'] as const)assert.equal(predicted.riders[0][field],s.riders[0][field]);
    }
    assert.ok(s.riders[0].speed<before-2);assert.equal(s.riders[0].falls,0);
  }
});
test('all seven motorcycles can complete the forest with ordinary inputs in dry and rain',()=>{
  const runs=[];
  for(const condition of ['day','rain'] as const)for(const bike of MOTORBIKES){
    const save=freshSave();save.cash=1000000;buyBike(save,bike.id);
    const race=createRace('mata',save,88117,condition);let frames=0;
    while(race.mode!=='finished' && frames++<60*420)stepRace(race,{player:safeDrivingCommand(race)});
    const run={bike:bike.id,condition,reason:race.result?.reason,time:race.result?.time,falls:race.riders[0].falls};runs.push(run);
    assert.equal(race.result?.reason,'finish',JSON.stringify(run));
  }
  console.log(JSON.stringify(runs));
});
test('all motorcycles can start from rest and steer out of mud before losing control',()=>{
  for(const bike of MOTORBIKES){
    const save=freshSave();save.cash=1000000;buyBike(save,bike.id);
    const s=createRace('mata',save,91,'rain');s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
    Object.assign(s.riders[0],{z:1630,x:2.7,speed:0});
    for(let i=0;i<180;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1,steer:s.riders[0].x>0?-1:0}});
    assert.ok(s.riders[0].speed>5,bike.id);assert.ok(s.riders[0].z>1640,bike.id);assert.equal(s.riders[0].falls,0);
  }
});
test('roadside wildlife stays outside the riding surface and never becomes a physical obstacle',()=>{
  assert.equal(new Set(FOREST_WILDLIFE.map(a=>a.kind)).size,4);
  for(const animal of FOREST_WILDLIFE){
    assert.ok(Math.abs(animal.x)-2>forestRoad(animal.z).half);
    assert.ok(animal.z>0 && animal.z<7600);
  }
  const s=createRace('mata');assert.ok(s.obstacles.every(o=>o.kind==='fallenTree'));
});
test('mud visibly skids before causing one recoverable fall, with deterministic snapshot resumption',()=>{
  for(const condition of ['day','rain'] as const)for(const site of FOREST_MUD){
    const s=createRace('mata',undefined,91,condition);s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
    const p=s.riders[0],z=(site.start+site.end)/2;Object.assign(p,{z,x:site.side*(forestRoad(z).half-1.5),speed:38});
    const cmd={...EMPTY_COMMAND,throttle:1};
    for(let i=0;i<8;i++)stepRace(s,{player:cmd});
    assert.ok(p.mudSlip!>.2);assert.equal(p.falls,0);assert.equal(p.integrity,100);
    const resumed=restoreSnapshot(snapshot(s)),predicted=restoreSnapshot(snapshot(s));
    for(let i=0;i<90 && !p.recovery;i++){
      stepRace(s,{player:cmd});stepRace(resumed,{player:cmd});predictMovement(predicted,predicted.riders[0],cmd);
      assert.equal(snapshot(s),snapshot(resumed));
    }
    assert.equal(p.falls,1);assert.equal(p.recovery?.phase,'sliding');assert.ok(p.integrity<100);assert.equal(p.mudSlip,0);
    assert.match(s.events.find(e=>e.type==='crash')!.text!,/LAMA/);
    assert.equal(predicted.riders[0].falls,0,'Prediction cannot award damage or confirm a fall');
    for(let i=0;i<1200 && p.recovery;i++)stepRace(s,{player:recoveryCommand(p)});
    assert.equal(p.recovery,undefined);assert.ok(p.immune>0);assert.equal(p.falls,1);
  }
});
test('slow escape, asphalt and airborne wheels do not start a mud skid',()=>{
  for(const mode of ['slow','asphalt','airborne','immune'] as const){
    const s=createRace('mata',undefined,91,'day');s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
    const p=s.riders[0];Object.assign(p,{z:1630,x:mode==='asphalt'?0:2.7,speed:mode==='slow'?7:30});
    if(mode==='airborne')p.jumpTime=1;
    if(mode==='immune')p.immune=1;
    for(let i=0;i<24;i++)stepRace(s,{player:EMPTY_COMMAND});
    assert.equal(p.falls,0,mode);assert.equal(p.mudSlip,0,mode);
  }
});
test('the tight bend rewards handling using ordinary steering and braking',()=>{
  const results:Record<string,number>={};
  for(const bike of MOTORBIKES){
    const save=freshSave();save.cash=1000000;buyBike(save,bike.id);
    const s=createRace('mata',save,91,'day');s.mode='racing';s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];
    const p=s.riders[0];Object.assign(p,{z:2200,x:0,speed:35});
    let frames=0;while(p.z<2600 && frames++<3600)stepRace(s,{player:safeDrivingCommand(s)});
    assert.ok(p.z>=2600,bike.id);assert.equal(p.falls,0,bike.id);results[bike.id]=frames/60;
  }
  assert.ok(results.falcao<results.brutal*.85,JSON.stringify(results));
  assert.ok(results.agulha<results.lobo*.85,JSON.stringify(results));
  assert.ok(cornerPace(FOREST_HAIRPIN.start+100,'mata',1.6)>cornerPace(FOREST_HAIRPIN.start+100,'mata',.95));
  console.log('Hairpin seconds',JSON.stringify(results));
});
