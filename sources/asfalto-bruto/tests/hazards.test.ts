import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKES, curveAt } from '../src/game/content';
import { createRace, createMultiplayerRace, performAction, predictMovement, stepRace, snapshot, restoreSnapshot, POLICE_TOP_SPEED, policeTarget, STEP } from '../src/game/simulation';
import { TREE_SITES, RAMP_SITES, obstacleX, obstacleShape, trackHazards, trafficDirection } from '../src/game/hazards';
import { jumpHeight, wheeliesLeft } from '../src/game/stunts';
import { jumpSoundMaterial } from '../src/game/audio';
import { PORT_WORKS, stopAtPortQueue } from '../src/game/port';
import { EMPTY_COMMAND, type Obstacle, type RaceCondition } from '../src/game/types';
import { NITRO_MULTIPLIER } from '../src/game/equipment';
import { RacePresentation } from '../src/multiplayer/presentation';
import { makeMember, makeRoom, joinRoom, lobbyClock, viewRoom } from '../server/room';
import { AccountsDB } from '../server/accounts-db';
const drive={...EMPTY_COMMAND,throttle:1};
function scene(track:string,condition:RaceCondition='day'){
 const s=createRace(track,undefined,811,condition);s.mode='racing';s.countdown=0;s.traffic=[];s.riders=s.riders.slice(0,1);s.heat=0;return s;
}
test('three fallen trees span exactly three lanes, with an alternating usable fourth lane in all conditions',()=>{
 for(const condition of ['day','sunset','night','rain'] as const)for(const [i,site] of TREE_SITES.entries()){
  assert.equal(curveAt(site.z,'serra'),0);
  for(const x of [-5.25,-1.75,1.75,5.25]){
   const s=scene('serra',condition),p=s.riders[0],tree=s.obstacles.find(o=>o.id===`fallen-tree-${i}`)!;s.obstacles=[tree];Object.assign(p,{z:site.z-30,x,speed:45,wheeliesLeft:0});
   for(let n=0;n<85;n++)stepRace(s,{player:drive});
   const free=x===(site.x<0?5.25:-5.25);assert.equal(p.falls,free?0:1,`${condition}/${i}/${x}`);if(free)assert.ok(p.z>site.z);
   assert.equal(obstacleShape(tree).width,10.5);
  }
 }
});
test('wheelie clears a tree with one use; empty inventory, late input and braking do not',()=>{
 for(const condition of ['day','rain'] as const)for(const mode of ['jump','empty','late','brake']){
  const s=scene('serra',condition),p=s.riders[0];s.obstacles=s.obstacles.filter(o=>o.kind==='fallenTree').slice(0,1);
  Object.assign(p,{z:2040-(mode==='late'?3:55),x:-1.75,speed:45,wheeliesLeft:mode==='empty'?0:3});performAction(s,p,'wheelie');let peak=0;
  for(let n=0;n<130;n++){stepRace(s,{player:mode==='brake'?{...drive,throttle:0,brake:.25}:drive});peak=Math.max(peak,jumpHeight(p));}
  assert.equal(p.falls,mode==='jump'?0:1,`${condition}/${mode}`);if(mode==='jump'){assert.ok(peak>2);assert.ok(p.z>2040);assert.equal(p.integrity,100);assert.equal(wheeliesLeft(p),2);}
 }
});
test('each rural mound/log launches automatically and lands without spending manual wheelies; prediction matches',()=>{
 for(const site of RAMP_SITES)for(const condition of ['day','rain'] as const){
  const s=scene('terra',condition),p=s.riders[0];s.obstacles=s.obstacles.filter(o=>o.z===site.z);Object.assign(p,{z:site.z-8,x:site.x,speed:40,wheeliesLeft:0});
  const predicted=restoreSnapshot(snapshot(s));let peak=0;
  for(let i=0;i<90;i++){stepRace(s,{player:drive});predictMovement(predicted,predicted.riders[0],drive);peak=Math.max(peak,jumpHeight(p));assert.equal(predicted.riders[0].jumpTime,p.jumpTime);assert.equal(predicted.riders[0].z,p.z);}
  assert.ok(peak>2);assert.equal(p.falls,0);assert.equal(p.integrity,100);assert.equal(wheeliesLeft(p),0);assert.equal(p.jumpTime,0);assert.ok(p.z>site.z+30);
 }
 const s=scene('terra'),p=s.riders[0];s.obstacles=s.obstacles.filter(o=>o.kind==='dirtRamp');Object.assign(p,{z:2059,x:-2.1,speed:40});for(let i=0;i<50;i++)stepRace(s,{player:drive});assert.equal(p.jumpTarget,undefined,'other lane does not launch');
});
test('a rural jump does not turn trucks or cars into pass-through objects',()=>{
 const s=scene('terra'),p=s.riders[0];s.obstacles=s.obstacles.filter(o=>o.id==='ramp-0');Object.assign(p,{z:2055,x:2.1,speed:40});s.traffic=[{id:'truck',kind:'truck',x:2.1,z:2083,speed:-10,color:'#888'}];
 for(let i=0;i<80;i++)stepRace(s,{player:drive});assert.equal(p.falls,1);assert.equal(wheeliesLeft(p),3);
});
test('tumbleweeds and armadillos cross reproducibly; only armadillo contact causes a fall',()=>{
 const hazards=trackHazards('deserto',87);assert.ok(hazards.some(o=>o.kind==='armadillo'));assert.ok(hazards.some(o=>o.kind==='tumbleweed'));
 assert.deepEqual(hazards,trackHazards('deserto',87));assert.notDeepEqual(hazards,trackHazards('deserto',88));
 for(const o of hazards){const m=o.motion!;for(const x of [-6,0,6]){const at=Math.abs(x-m.from)/m.speed-m.phase;assert.ok(Math.abs(obstacleX(o,at)-x)<1e-10);assert.ok(Math.abs(obstacleX(o,at+m.period)-x)<1e-10);}}
 for(const kind of ['armadillo','tumbleweed'] as const){
  const s=scene('deserto'),p=s.riders[0];const o:Obstacle={id:'crossing',kind,z:100,x:0,motion:{from:-14,to:14,speed:3,phase:14/3-STEP,period:13}};s.obstacles=[o];Object.assign(p,{x:0,z:99.5,speed:70});stepRace(s,{player:drive});
  assert.equal(p.falls,kind==='armadillo'?1:0);if(kind==='tumbleweed'){assert.equal(p.integrity,100);assert.ok(p.speed<70);}
  const replay=restoreSnapshot(snapshot(s));for(let i=0;i<300;i++){stepRace(s,{player:drive});stepRace(replay,{player:drive});}assert.equal(snapshot(s),snapshot(replay));
 }
});
test('Porto has five stationary cars per direction; two-lane barriers leave the opposite half open',()=>{
 const s=scene('porto'); // scene removes traffic, use production generation below
 const traffic=createRace('porto').traffic,queues=traffic.filter(t=>t.queued);assert.equal(queues.length,10);
 for(const direction of [-1,1]){const cars=queues.filter(t=>trafficDirection(t)===direction);assert.equal(cars.length,5);assert.ok(cars.every(t=>t.speed===0&&Math.sign(t.x)===direction));
  const w=PORT_WORKS.find(w=>w.queue&&w.side===direction)!;assert.ok(cars.every(t=>direction===1?t.z<w.start:t.z>w.end));
  const wall=s.obstacles.find(o=>o.kind==='concrete'&&o.z>w.start&&o.z<w.end)!;assert.equal(wall.width,6.8);
  assert.ok(Math.abs(-direction*1.75-wall.x)>obstacleShape(wall).contact);
 }
 const tail=queues.filter(t=>t.heading===1).sort((a,b)=>a.z-b.z)[0];
 const follower={...tail,id:'following',queued:false,z:tail.z-20,speed:20};traffic.push(follower);
 for(let i=0;i<120;i++){stopAtPortQueue(traffic,STEP);for(const t of traffic)t.z+=t.speed*STEP;}
 assert.equal(follower.speed,0);assert.ok(tail.z-follower.z>=12);assert.equal(follower.heading,1);
 const positions=queues.map(t=>t.z);s.traffic=queues;Object.assign(s.riders[0],{z:4000,speed:0});for(let i=0;i<5;i++)stepRace(s);assert.deepEqual(queues.map(t=>t.z),positions,'passed queues never recycle');
});
test('two multiplayer views share animated hazards, stationary heading and authoritative launch state',()=>{
 const room=makeRoom('HAZARD','deserto',makeMember('Ana',0),0,true,'rain');joinRoom(room,makeMember('Bia',0),0);lobbyClock(room,60000);
 room.race!.mode='racing';room.race!.time=20;
 const view=viewRoom(room,60000),a=new RacePresentation(room.members[0].id),b=new RacePresentation(room.members[1].id);a.accept(view,0,60000);b.accept(view,0,60000);
 assert.deepEqual(a.view(100)!.obstacles,b.view(100)!.obstacles);for(const o of a.view(100)!.obstacles.filter(o=>o.motion))assert.equal(o.x,obstacleX(o,20.1));
 const s=createMultiplayerRace('terra',[{id:'a',name:'Ana'},{id:'b',name:'Bia'}],123,false,'rain');s.mode='racing';s.traffic=[];s.obstacles=s.obstacles.filter(o=>o.id==='ramp-0');Object.assign(s.riders[0],{x:2.1,z:2058,speed:40,wheeliesLeft:0});Object.assign(s.riders[1],{x:-2.1,z:2020,speed:40});
 for(let i=0;i<20;i++)stepRace(s,{a:drive,b:drive});assert.ok(jumpHeight(s.riders[0])>1);assert.equal(wheeliesLeft(s.riders[0]),0);assert.equal(jumpHeight(s.riders[1]),0);assert.equal(snapshot(restoreSnapshot(snapshot(s))),snapshot(s));
});
test('police outrun all fully upgraded nitro bikes and keep targeting the nearest competitor',()=>{
 const s=scene('costa');s.heat=55;Object.assign(s.riders[0],{z:1400,speed:60});stepRace(s,{player:drive});const cop=s.riders.find(r=>r.profile==='police')!;assert.ok(cop);
 for(const b of BIKES)assert.ok(cop.maxSpeed>(b.speed+7.5)*NITRO_MULTIPLIER);assert.equal(cop.maxSpeed,POLICE_TOP_SPEED);
 const rival={...createRace().riders[1],x:cop.x,z:cop.z+3};s.riders.push(rival);assert.equal(policeTarget(s,cop)?.id,rival.id);
 s.riders[0].z=cop.z+1;s.riders[0].x=cop.x;assert.equal(policeTarget(s,cop)?.id,'player');
});
test('jump impact material matches wood, earth or a car; historic rankings remain accessible',()=>{
 const s=scene('terra'),p=s.riders[0];for(const [kind,material] of [['dirtRamp','earth'],['woodRamp','wood'],['fallenTree','wood']] as const){s.obstacles=[{kind,id:'target',x:0,z:1}];p.jumpTarget='target';assert.equal(jumpSoundMaterial(s,p),material);}p.jumpTarget='car';assert.equal(jumpSoundMaterial(s,p),'metal');
 const db=new AccountsDB(':memory:');try{const a=db.login('history');db.result('old',a.id,'solo','serra','day','ferro',{reason:'finish',time:200,place:1,reward:0,hits:0,falls:0});db.db.prepare('UPDATE results SET rules=1').run();assert.equal(db.ranking('solo','serra','day','time').length,0);assert.equal(db.ranking('solo','serra','day','time',a.id,1)[0].time,200);assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM results').get()!.n,1);}finally{db.close();}
});
