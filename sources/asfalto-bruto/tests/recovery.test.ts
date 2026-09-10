import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,crashRider,stepRace,STEP,snapshot,restoreSnapshot,botCommand} from '../src/game/simulation';
import {advanceRecovery,recoveryCommand,hitPedestrian,RUN_SPEED} from '../src/game/recovery';
import {EMPTY_COMMAND,type RaceCondition} from '../src/game/types';
import {freshSave,normalizeSave} from '../src/game/save';
import {newChampionship,startChampionshipRace,checkpointChampionship} from '../src/game/championship';
import {TRACKS,getTrack} from '../src/game/content';
import {guardRailPosition} from '../src/game/guardrails';
function setup(speed=45,kind:'impact'|'spill'='impact',track='costa',condition:RaceCondition='day'){
 const s=createRace(track,undefined,887,condition);s.mode='racing';s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,1);
 const p=s.riders[0];Object.assign(p,{x:1.5,z:600,speed,immune:0});crashRider(s,p,true,kind);return {s,p};
}
function rest(s:ReturnType<typeof createRace>,p=s.riders[0]){for(let i=0;i<600;i++)advanceRecovery(s,p,EMPTY_COMMAND,STEP);assert.equal(p.recovery?.phase,'walking');}
test('speed affects sliding; impact leaves the bike behind and spill ahead',()=>{
 for(const kind of ['impact','spill'] as const){let last=0;for(const speed of [20,45,70]){const {s,p}=setup(speed,kind);rest(s);assert.ok(p.z-600>last);last=p.z-600;assert.equal(p.recovery!.bikeZ<p.z,kind==='impact');}}
 const dry=setup(45,'spill'),wet=setup(45,'spill','costa','rain');rest(dry.s);rest(wet.s);assert.ok(wet.p.z>dry.p.z);assert.ok(wet.p.recovery!.bikeZ>dry.p.recovery!.bikeZ);
});
test('on-foot input moves forward, backward and sideways without teleport; diagonal running stays capped',()=>{
 const {s,p}=setup();rest(s);const z=p.z;for(let i=0;i<180;i++)advanceRecovery(s,p,EMPTY_COMMAND,STEP);assert.equal(p.z,z);
 advanceRecovery(s,p,{...EMPTY_COMMAND,throttle:1},1);assert.equal(p.z,z+RUN_SPEED);
 advanceRecovery(s,p,{...EMPTY_COMMAND,brake:1},1);assert.equal(p.z,z);
 const x=p.x;advanceRecovery(s,p,{...EMPTY_COMMAND,throttle:1,steer:-1},.1);assert.ok(Math.abs(Math.hypot(p.x-x,p.z-z)-RUN_SPEED*.1)<1e-9);assert.ok(Math.abs(p.recovery!.facingZ-Math.SQRT1_2)<1e-12);
});
test('player and bot recover bikes ahead and behind preserving purchased items and damage',()=>{
 for(const kind of ['impact','spill'] as const){const {s,p}=setup(70,kind);Object.assign(p,{weaponId:'chain',kneePadId:'gold',nitro:2,wheeliesLeft:2,helmetId:'integral',health:55});const integrity=p.integrity;rest(s);
 for(let i=0;i<2400&&p.recovery;i++)advanceRecovery(s,p,recoveryCommand(p),STEP);
 assert.equal(p.recovery,undefined);assert.equal(p.crash,0);assert.equal(p.integrity,integrity);assert.equal(p.health,55);assert.equal(p.nitro,2);assert.equal(p.weaponId,'chain');assert.equal(p.wheeliesLeft,2);
 const {s:bs,p:b}=setup(45,kind);b.profile='careful';bs.riders.push({...createRace().riders[1],x:-3,z:1000});for(let i=0;i<1500&&b.recovery;i++)stepRace(bs);assert.equal(b.recovery,undefined);assert.ok(botCommand(bs,b).throttle>0);
 }
});
test('all track/weather combinations keep slides reachable and finite',()=>{
 for(const t of TRACKS)for(const condition of ['day','sunset','night','rain'] as const)for(const kind of ['impact','spill'] as const){const {s,p}=setup(70,kind,t.id,condition);p.x=guardRailPosition(t.id,-6.8,p.z);p.recovery!.bikeX=p.x;p.recovery!.bikeVX=-5;p.recovery!.vx=-5;rest(s);
 for(let i=0;i<2400&&p.recovery;i++)advanceRecovery(s,p,recoveryCommand(p),STEP);
 assert.equal(p.recovery,undefined,`${t.id}/${condition}/${kind}`);assert.ok(Number.isFinite(p.z)&&Number.isFinite(p.x));assert.equal(p.x,guardRailPosition(t.id,p.x,p.z));}
});
test('runovers cause damage, knockdown and cooldown while retaining the bike position',()=>{
 const {s,p}=setup();rest(s);const bike=p.recovery!.bikeZ;assert.equal(hitPedestrian(s,p,'car',45,1),true);assert.equal(p.recovery!.phase,'sliding');assert.ok(p.health<100);const hp=p.health;assert.equal(hitPedestrian(s,p,'car',45,1),false);assert.equal(p.health,hp);assert.equal(p.recovery!.bikeZ,bike);
 for(let i=0;i<140;i++)advanceRecovery(s,p,EMPTY_COMMAND,STEP);assert.equal(hitPedestrian(s,p,'rival',60,-1),true);assert.equal(p.recovery!.hits,2);
});
test('real traffic collision starts recovery and subsequent runover damages the pedestrian',()=>{
 const s=createRace('costa',undefined,88,'day');s.mode='racing';s.obstacles=[];s.riders=s.riders.slice(0,1);const p=s.riders[0];Object.assign(p,{x:1.5,z:600,speed:45,immune:0});s.traffic=[{id:'car',kind:'car',x:1.5,z:601,speed:-24,color:'#aaa'}];stepRace(s);assert.ok(p.recovery);s.traffic=[];rest(s);const hp=p.health;s.traffic=[{id:'other',kind:'car',x:p.x,z:p.z-2,speed:24,color:'#aaa'}];stepRace(s);assert.ok(p.health<hp);assert.equal(p.recovery!.hits,1);
});
function fallenRival(){const s=createRace('costa',undefined,88,'day');s.mode='racing';s.obstacles=[];s.traffic=[];s.riders=s.riders.slice(0,2);const [p,r]=s.riders;Object.assign(p,{x:1.5,z:600,speed:45});Object.assign(r,{x:1.5,z:601,speed:0});crashRider(s,r,true);Object.assign(r.recovery!,{phase:'gettingUp',timer:2,bikeX:-4,bikeZ:620,hitCooldown:0});r.x=1.5;return {s,p,r};}
test('mounted competitors run over rivals; airborne riders clear them',()=>{
 const {s,p,r}=fallenRival();stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.ok(r.health<100);assert.equal(r.recovery!.hits,1);assert.ok(p.hits>0);
 const next=fallenRival();next.p.jumpTime=.7;next.p.jumpTarget='ramp';stepRace(next.s);assert.equal(next.r.health,100);
});
test('a fallen motorcycle launches a jump without spending wheelies',()=>{
 const {s,p,r}=fallenRival();r.x=-3;r.z=620;Object.assign(r.recovery!,{bikeX:p.x,bikeZ:p.z+1});const used=p.wheeliesLeft;stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.ok(p.jumpTime!>0);assert.ok(p.jumpTarget!.startsWith('fallen:'));assert.equal(p.wheeliesLeft,used);assert.equal(p.crash,0);
});
test('police arrests the pedestrian, not the abandoned bike',()=>{
 const {s,p}=setup();rest(s);p.recovery!.bikeZ=p.z-100;const cop={...createRace().riders[1],id:'police',profile:'police' as const,x:p.x,z:p.recovery!.bikeZ,speed:0};s.riders.push(cop);s.policeActive=true;stepRace(s);assert.equal(p.out,undefined);cop.z=p.z+10;stepRace(s);assert.equal(s.result?.reason,'caught');
});
test('on foot cannot finish; snapshots preserve both positions and recover deterministically',()=>{
 const {s,p}=setup();rest(s);p.z=getTrack(s.trackId).distance+1;p.recovery!.bikeZ=p.z-10;stepRace(s);assert.equal(p.finishedAt,null);assert.equal(Boolean(s.result),false);
 const restored=restoreSnapshot(snapshot(s));for(let i=0;i<60;i++){stepRace(s,{player:{...EMPTY_COMMAND,brake:1}});stepRace(restored,{player:{...EMPTY_COMMAND,brake:1}});}assert.equal(snapshot(restored),snapshot(s));
});

test('championship reload preserves the pedestrian, bike and damage; malformed recovery is rejected',()=>{
 const save=freshSave();save.championship=newChampionship(78);const s=startChampionshipRace(save)!;s.mode='racing';s.time=12;s.tick=720;const p=s.riders[0];Object.assign(p,{speed:45,z:600,x:2});crashRider(s,p,true,'impact');for(let i=0;i<70;i++)advanceRecovery(s,p,EMPTY_COMMAND,STEP);checkpointChampionship(save.championship,s);
 const clean=normalizeSave(structuredClone(save)),restored=startChampionshipRace(clean)!;assert.deepEqual(restored.riders[0].recovery,p.recovery);assert.equal(restored.riders[0].integrity,p.integrity);
 (save.championship.checkpoint!.riders[0].recovery as any).bikeZ='invalid';assert.equal(normalizeSave(save).championship,undefined);
});

test('zero-integrity falls wait for pickup, then explode once and finish only after the effect',()=>{
 for(const kind of ['impact','spill'] as const){
  const {s,p}=setup(45,kind);p.integrity=0;let bursts=0;
  for(let i=0;i<720;i++){stepRace(s);bursts+=s.events.filter(e=>e.type==='explosion').length;}
  assert.equal(s.mode,'racing');assert.equal(Boolean(s.result),false);assert.equal(p.recovery!.phase,'walking');assert.equal(bursts,0);
  for(let i=0;i<900&&String(p.recovery?.phase)!=='exploding';i++){stepRace(s,{player:recoveryCommand(p)});bursts+=s.events.filter(e=>e.type==='explosion').length;}
  assert.equal(p.recovery!.phase,'exploding');assert.equal(bursts,1);assert.equal(p.integrity,0);assert.ok(p.crash>0);assert.equal(Boolean(s.result),false);
  const health=p.health;assert.equal(hitPedestrian(s,p,'car',40,1),false);assert.equal(p.health,health);
  for(let i=0;i<50;i++){stepRace(s);bursts+=s.events.filter(e=>e.type==='explosion').length;}assert.equal(s.mode,'racing');
  const restored=restoreSnapshot(snapshot(s));
  for(let i=0;i<90;i++){stepRace(s);stepRace(restored);bursts+=s.events.filter(e=>e.type==='explosion').length;}
  assert.equal(s.result?.reason,'wrecked');assert.equal(p.out,'wrecked');assert.equal(p.recovery!.phase,'exploding');assert.equal(p.recovery!.timer,0);assert.equal(bursts,1);assert.equal(snapshot(s),snapshot(restored));
 }
});
test('a real destructive crash defers wrecked; bikes with any remaining integrity can still mount',()=>{
 const s=createRace('costa',undefined,88,'day');s.mode='racing';s.obstacles=[];s.riders=s.riders.slice(0,1);const p=s.riders[0];Object.assign(p,{x:1.5,z:600,speed:45,immune:0,integrity:20});s.traffic=[{id:'car',kind:'car',x:1.5,z:601,speed:-24,color:'#aaa'}];stepRace(s);assert.equal(p.integrity,0);assert.equal(Boolean(s.result),false);assert.ok(p.recovery);
 const healthy=setup();healthy.p.integrity=.1;rest(healthy.s);for(let i=0;i<1200&&healthy.p.recovery;i++)stepRace(healthy.s,{player:recoveryCommand(healthy.p)});assert.equal(healthy.p.recovery,undefined);assert.equal(healthy.s.result,null);assert.equal(healthy.p.integrity,.1);
});
test('bots also explode on pickup; police approaching an already exploding bike does not replace the result',()=>{
 const s=createRace('costa',undefined,7,'day');s.mode='racing';s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,2);const p=s.riders[0],bot=s.riders[1];Object.assign(bot,{x:1.5,z:600,speed:45,immune:0,integrity:10});crashRider(s,bot,true,'impact');
 for(let i=0;i<1600&&!bot.out;i++)stepRace(s);assert.equal(bot.out,'wrecked');assert.equal(bot.recovery!.phase,'exploding');assert.equal(s.mode,'racing');assert.equal(p.out,undefined);
 const own=setup();own.p.integrity=0;rest(own.s);Object.assign(own.p,{x:own.p.recovery!.bikeX,z:own.p.recovery!.bikeZ});stepRace(own.s);assert.equal(own.p.recovery!.phase,'exploding');
 own.s.riders.push({...createRace().riders[1],id:'police',profile:'police',x:own.p.x,z:own.p.z+3,speed:0});own.s.policeActive=true;
 for(let i=0;i<150;i++)stepRace(own.s);assert.equal(own.s.result?.reason,'wrecked');
});

test('a championship with zero integrity during recovery can resume until pickup/explosion completes',()=>{
 const save=freshSave();save.championship=newChampionship(42);const s=startChampionshipRace(save)!;s.mode='racing';s.time=12;s.tick=720;const p=s.riders[0];Object.assign(p,{speed:45,z:600,integrity:10});crashRider(s,p,true,'impact');checkpointChampionship(save.championship,s);
 const restored=startChampionshipRace(normalizeSave(structuredClone(save)));assert.ok(restored);assert.equal(restored.riders[0].integrity,0);assert.equal(restored.riders[0].recovery!.phase,'sliding');assert.equal(restored.mode,'racing');
});
