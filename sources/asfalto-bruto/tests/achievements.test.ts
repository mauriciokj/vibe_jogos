import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, awardRaceAchievements, reconcileAchievements, normalizeAchievements } from '../src/game/achievements';
import { achievementsMarkup } from '../src/achievements-ui';
import { newRaceFeats, trackRaceFeats } from '../src/game/race-feats';
import { freshSave, normalizeSave, settleRace, buyBike, unlockBicycle } from '../src/game/save';
import { createRace, createMultiplayerRace, stepRace, snapshot } from '../src/game/simulation';
import { getBike, MOTORBIKES } from '../src/game/bikes';
import { TRACKS, trackCorners } from '../src/game/content';
import { CONDITIONS, recordKey } from '../src/game/conditions';
import { newChampionship } from '../src/game/championship';
import { EMPTY_COMMAND, type RaceState, type RaceResult } from '../src/game/types';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { makeMember, makeRoom } from '../server/room';

function race(track='costa',condition:'day'|'rain'|'night'|'sunset'='day'){
 const s=createRace(track,undefined,891,condition);s.mode='racing';s.time=200;s.countdown=0;s.traffic=[];s.obstacles=[];return s;
}
function result(s:RaceState,place=1,reason:RaceResult['reason']='finish'){
 const p=s.riders[0];s.mode='finished';s.result={reason,place,time:200,reward:100,hits:p.hits,falls:p.falls};p.finishedAt=reason==='finish'?200:null;return s;
}
const has=(save:ReturnType<typeof freshSave>,...ids:string[])=>ids.forEach(id=>assert.ok(save.achievements?.unlocked.includes(id as any),id));
test('25 unique badges; difficult goals hide names, descriptions and progress until earned',()=>{
 assert.equal(ACHIEVEMENTS.length,25);assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,25);
 const save=freshSave(),hidden=achievementsMarkup(save);
 for(const a of ACHIEVEMENTS){if('secret' in a){assert.ok(!hidden.includes(a.name));assert.ok(!hidden.includes(a.description));}else assert.ok(hidden.includes(a.description));}
 assert.equal((hidden.match(/<h3>\?\?\?<\/h3>/g) ?? []).length,12);
 save.achievements!.unlocked=['on-foot'];const shown=achievementsMarkup(save,'earned');assert.ok(shown.includes('Na raça'));assert.ok(shown.includes('MAGRELA DESBLOQUEADA'));assert.ok(!shown.includes('Último homem de pé'));
});
test('legacy migration recognizes only documented equipment, finishes, wins and championship history',()=>{
 const save=freshSave();delete save.achievements;save.owned.push('bicicleta');
 for(const c of CONDITIONS)save.records[recordKey('costa',c.id)]={time:180,place:1};
 const migrated=normalizeSave(save);has(migrated,'on-foot','rain-win','night-win','all-weather');assert.equal(migrated.achievements!.winStreak,0);assert.ok(!migrated.achievements!.unlocked.includes('pristine'));assert.ok(!migrated.achievements!.unlocked.includes('solo-win'));
 assert.deepEqual(normalizeSave(migrated),migrated);assert.deepEqual(normalizeAchievements({unlocked:['police','made-up','police'],winStreak:-9,conditionWins:['bogus'],finishedTracks:['terra','terra','bogus']}),{unlocked:['police'],winStreak:0,conditionWins:[],finishedTracks:['terra']});
});
test('single-race feats, finish-only challenges, record improvement and three wins are distinct',()=>{
 const save=freshSave(),s=race('costa','rain'),p=s.riders[0];save.records.costa={time:250,place:2};save.records[recordKey('costa','rain')]={time:250,place:2};save.achievements!.winStreak=2;
 p.feats={...newRaceFeats(false),knocked:s.riders.slice(1).map(r=>r.id),policeDown:true,carJumps:['a','b','c'],terraJump:true,kneeCurve:true,lastAtHalf:true,latePass:true};p.integrity=5;p.falls=3;
 result(s);s.result!.onFoot=true;
 const paid=settleRace(save,s)!;has(save,'on-foot','all-rivals','police','car-jump','three-jumps','terra-jump','knee-curve','fragile','comeback-falls','last-to-first','late-pass','solo-win','record','streak','rain-win');assert.ok(paid.secretUnlocked);assert.ok(paid.achievements!.includes('late-pass'));assert.ok(!save.achievements!.unlocked.includes('pristine'));
 const lost=freshSave(),bad=race();bad.riders[0].feats={...p.feats,knocked:['rival-0']};result(bad,1,'wrecked');awardRaceAchievements(lost,bad,'player','solo');has(lost,'police','car-jump','terra-jump','knee-curve','three-jumps');for(const id of ['all-rivals','solo-win','fragile','comeback-falls','late-pass','last-to-first'])assert.ok(!lost.achievements!.unlocked.includes(id as any),id);
});
test('clean finish, low integrity, bicycle and first/changed record edge cases',()=>{
 const save=freshSave(),s=result(race(),8);s.riders[0].integrity=10;settleRace(save,s);has(save,'pristine');assert.ok(!save.achievements!.unlocked.includes('fragile'));assert.ok(!save.achievements!.unlocked.includes('record'));
 const bike=result(race(),8);bike.riders[0].bikeId='bicicleta';bike.result!.time=200;settleRace(save,bike);has(save,'bicycle-finish');assert.ok(!save.achievements!.unlocked.includes('record'));
 bike.result!.time=199;settleRace(save,bike);has(save,'record');
});
test('streak resets on every defeat/abandonment but earned badges are permanent',()=>{
 const save=freshSave();for(let i=0;i<2;i++)settleRace(save,result(race()));assert.equal(save.achievements!.winStreak,2);
 settleRace(save,result(race(),1,'left'));assert.equal(save.achievements!.winStreak,0);
 for(let i=0;i<3;i++)settleRace(save,result(race()));has(save,'streak');settleRace(save,result(race(),2));has(save,'streak');assert.equal(save.achievements!.winStreak,0);
});
test('exploration, weather, garage and championship badges complete the catalog',()=>{
 const save=freshSave();for(const t of TRACKS)for(const c of CONDITIONS)settleRace(save,result(race(t.id,c.id)));
 has(save,'all-tracks','all-weather','night-win','rain-win');save.cash=1e6;for(const b of MOTORBIKES)buyBike(save,b.id);has(save,'garage');assert.ok(!save.owned.includes('bicicleta'));
 const c=save.championship=newChampionship(19),heat={reason:'finish',finishes:race().riders.map((r,i)=>({id:r.id,place:i+1,time:200+i}))};c.heats=Array.from({length:4},()=>structuredClone(heat));c.history=[{stage:4,heats:structuredClone(c.heats),place:1}];c.stage=4;c.status='complete';reconcileAchievements(save);has(save,'champ-win','perfect-stage','champion');
 const third=freshSave();third.championship=structuredClone(c);third.championship.history[0].place=3;reconcileAchievements(third);assert.ok(!third.achievements!.unlocked.includes('champion'));
 const champ=freshSave();settleRace(champ,result(race()),{mode:'championship'});has(champ,'champ-win');assert.ok(!champ.achievements!.unlocked.includes('solo-win'));
});
test('real combat credits the attacker for a fall, not ordinary hits or unrelated crashes',()=>{
 for(const police of [false,true]){
  const s=race();s.riders=s.riders.slice(0,2);const [p,t]=s.riders;Object.assign(p,{x:0,z:500,speed:40});Object.assign(t,{x:2.1,z:500,speed:40,health:17,profile:police?'police':'player'});
  stepRace(s,{player:{...EMPTY_COMMAND,attack:'punch'},[t.id]:EMPTY_COMMAND});
  for(let i=0;i<12;i++)stepRace(s,{player:EMPTY_COMMAND,[t.id]:EMPTY_COMMAND});assert.equal(t.falls,0);assert.equal(p.feats!.policeDown,false);assert.deepEqual(p.feats!.knocked,[]);
  p.cooldown=0;p.attack=null;Object.assign(t,{health:1,x:2.1,z:p.z,speed:p.speed});
  for(let i=0;i<14;i++)stepRace(s,{player:{...EMPTY_COMMAND,attack:i===0?'punch':null},[t.id]:EMPTY_COMMAND});
  assert.equal(t.falls,1);assert.equal(p.feats!.policeDown,police);assert.deepEqual(p.feats!.knocked,police?[]:[t.id]);
 }
});
test('actual car crossing and Terra Brava ramp launches are tracked, not wheelie activation alone',()=>{
 const s=race(),p=s.riders[0];s.riders=[p];Object.assign(p,{x:-1.75,z:500,speed:40});s.traffic=[{id:'car',kind:'car',x:-1.75,z:520,speed:-20,color:'#aaa'}];
 stepRace(s,{player:{...EMPTY_COMMAND,action:'wheelie'}});assert.equal(p.feats!.carJumps.length,0);
 for(let i=0;i<50;i++)stepRace(s,{player:{...EMPTY_COMMAND,throttle:1}});assert.deepEqual(p.feats!.carJumps,['car']);assert.equal(p.falls,0);
 for(const track of ['terra','costa']){const r=race(track),p=r.riders[0];r.riders=[p];Object.assign(p,{x:0,z:500,speed:12});r.obstacles=[{id:'ramp',kind:'dirtRamp',x:0,z:501.5}];stepRace(r);assert.ok(p.jumpTime!>0);assert.equal(p.feats!.terraJump,track==='terra');}
});
test('position and corner tracking requires real boundaries and rejects leaving the road',()=>{
 const s=race(),[p,t]=s.riders;s.riders=[p,t];p.z=4200;t.z=4300;trackRaceFeats(s,new Map([[p.id,{z:4199,health:100,integrity:100}]]),[t.id,p.id],1/60);assert.ok(p.feats!.lastAtHalf);
 p.z=8391;t.z=8390;trackRaceFeats(s,new Map([[p.id,{z:8388,health:100,integrity:100}]]),[t.id,p.id],1/60);assert.ok(p.feats!.latePass);
 for(const offRoad of [false,true]){const q=race(),r=q.riders[0],c=trackCorners(q.trackId)[0];q.riders=[r];r.z=c.start;trackRaceFeats(q,new Map([[r.id,{z:c.start-1,health:100,integrity:100}]]),[r.id],1/60);
  r.kneeTime=1;r.kneePadId='white';r.kneeSide=Math.sign(c.bend);r.speed=40;r.x=offRoad?8:0;r.z=(c.start+c.end)/2;
  trackRaceFeats(q,new Map([[r.id,{z:r.z-1,health:100,integrity:100}]]),[r.id],.6);
  r.z=c.end;trackRaceFeats(q,new Map([[r.id,{z:c.end-1,health:100,integrity:100}]]),[r.id],1/60);assert.equal(r.feats!.kneeCurve,!offRoad);
 }
});
test('bike is 60 km/h stock with the former proportional transmission gain; online riding survives the motorcycle deadline',()=>{
 const save=freshSave();unlockBicycle(save,{reason:'finish',onFoot:true,place:8,time:200,hits:0,falls:1,reward:0});buyBike(save,'bicicleta');assert.ok(Math.abs(getBike('bicicleta').speed*3.6-60)<1e-10);
 const stock=createRace('costa',save).riders[0].maxSpeed;save.upgrades.bicicleta.engine=3;assert.ok(Math.abs(createRace('costa',save).riders[0].maxSpeed/stock-(58+7.5)/58)<1e-10);
 const s=createMultiplayerRace('deserto',[{id:'a',name:'A',bikeId:'bicicleta'},{id:'b',name:'B'}]);s.mode='racing';s.time=360;s.traffic=[];s.obstacles=[];stepRace(s);assert.equal(Object.hasOwn(s.multiplayer!.results,'a'),false);assert.equal(s.multiplayer!.results.b.reason,'timeout');s.time=1150;stepRace(s);assert.equal(s.multiplayer!.results.a.reason,'timeout');
});
test('authoritative solo receipt awards once and ignores a client-supplied achievement list',async()=>{
 const db=new AccountsDB(':memory:');let now=Date.now();const e=new Economy(db,()=>now),a=db.login('achievements');
 try{
  const cloud=e.initialize(a.id),run=e.start(a.id,{trackId:'costa',condition:'rain',revision:cloud.revision}),s=run.initial!;s.mode='racing';s.riders=s.riders.slice(0,1);Object.assign(s.riders[0],{z:8399.9,speed:40});s.traffic=[];s.obstacles=[];db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(snapshot(s),run.id);now+=20;
  const body={id:run.id,cursor:0,segments:[{count:1,command:EMPTY_COMMAND}],achievements:['champion']},out=await e.advance(a.id,body,true);has(out.cloud.save!,'solo-win','rain-win');assert.ok(!out.cloud.save!.achievements!.unlocked.includes('champion'));
  const saved=db.cloud(a.id);await e.advance(a.id,body,true);assert.deepEqual(db.cloud(a.id),saved);assert.equal(saved.save!.achievements!.winStreak,1);
 }finally{db.close();}
});
test('multiplayer saves the correct account winner once and carries unlocked badge IDs in the result',()=>{
 const db=new AccountsDB(':memory:'),e=new Economy(db),a=db.login('first'),b=db.login('second');
 try{const ma=makeMember('A',0),mb=makeMember('B',0);e.equipMember(a.id,ma);e.equipMember(b.id,mb);const room=makeRoom('ABCDEF','costa',ma,0);room.members.push(mb);const s=room.race=createMultiplayerRace('costa',[ma,mb]);s.mode='racing';s.traffic=[];s.obstacles=[];Object.assign(s.riders[0],{z:8399.9,speed:40});stepRace(s);e.recordRoom(room);has(db.cloud(a.id).save!,'online-win');assert.ok(s.multiplayer!.results[ma.id].achievements!.includes('online-win'));assert.ok(!db.cloud(b.id).save!.achievements!.unlocked.includes('online-win'));const saved=db.cloud(a.id);e.recordRoom(room);assert.deepEqual(db.cloud(a.id),saved);
 }finally{db.close();}
});
test('old server ranking results migrate once and reset does not resurrect old badges',()=>{
 const db=new AccountsDB(':memory:'),e=new Economy(db),a=db.login('legacy-rank');
 const existing=freshSave();existing.cash=8123;db.save(a.id,0,existing,'legacy-fixture');
 try{const r={reason:'finish' as const,place:1,time:200,reward:0,hits:0,falls:0};db.result('old-solo',a.id,'solo','costa','night','ferro',r);db.result('old-online',a.id,'multi','porto','rain','ferro',r);
  const migrated=e.initialize(a.id);has(migrated.save!,'solo-win','online-win','rain-win','night-win');assert.equal(migrated.save!.achievements!.winStreak,0);assert.equal(migrated.save!.cash,8123);
  e.initialize(a.id);assert.equal(db.cloud(a.id).revision,migrated.revision);
  e.action(a.id,{request:'reset-achievements-test',revision:migrated.revision,action:{kind:'reset'}});assert.deepEqual(e.initialize(a.id).save!.achievements!.unlocked,[]);
 }finally{db.close();}
});
