import test from 'node:test';
import assert from 'node:assert/strict';
import {BIKES,TRACKS,getBike,curveAt} from '../src/game/content';
import {supportsKneeDown} from '../src/game/bikes';
import {kneeSupport,KNEE_DURATION} from '../src/game/equipment';
import {botCommand,createRace,createMultiplayerRace,stepRace,snapshot,restoreSnapshot} from '../src/game/simulation';
import {freshSave} from '../src/game/save';

test('cornering specialists equip visible shop pads; factory limits, choppers and player purchases are respected',()=>{
  for(const track of TRACKS){
    const save=freshSave();save.ownedKneePads=['gold'];save.kneePadId='gold';const before=JSON.stringify(save);
    const s=createRace(track.id,save),me=s.riders[0];assert.equal(JSON.stringify(save),before);assert.equal(me.kneePadId,'gold');assert.equal(me.maxSpeed,BIKES[0].speed);assert.equal(me.handling,BIKES[0].handling);
    assert.equal(s.riders.filter(r=>r.profile!=='player' && r.kneePadId).length,3);
    for(const r of s.riders.slice(1)){
      const bike=getBike(r.bikeId);assert.equal(r.handling,bike.handling);assert.equal(r.acceleration,bike.acceleration);assert.equal(r.armor,bike.armor);
      assert.ok(r.maxSpeed>=bike.speed*.95 && r.maxSpeed<=bike.speed);
      if(r.profile==='aggressive' || !supportsKneeDown(r.bikeId))assert.equal(r.kneePadId,undefined);
      else assert.equal(r.kneePadId,r.profile==='fast'&&track.level>=2?'purple':track.level>=1?'blue':'green');
    }
  }
});

function bend(condition:'day'|'rain'='day'){
  const s=createRace('costa',undefined,42,condition);s.mode='racing';s.traffic=[];s.obstacles=[];
  const bot=s.riders.find(r=>r.profile==='fast')!;s.riders=[s.riders[0],bot];s.riders[0].z=-1000;
  Object.assign(bot,{x:0,z:1295,speed:40,targetX:0,decisionAt:999});return {s,bot};
}
test('bots activate the same timed knee technique on dry bends and gain time without special physics',()=>{
  const {s,bot}=bend();assert.equal(botCommand(s,bot).action,'kneeLeft');stepRace(s);
  assert.equal(bot.kneeTime,KNEE_DURATION);assert.ok(kneeSupport(bot,curveAt(bot.z,s.trackId))>.35);
  assert.equal(snapshot(restoreSnapshot(snapshot(s))),snapshot(s));
  let maxTime=0,contactTicks=0;while(bot.z<1560 && s.time<30){stepRace(s);maxTime=Math.max(maxTime,bot.kneeTime??0);contactTicks+=Number(kneeSupport(bot,curveAt(bot.z,s.trackId))>.35);}
  assert.ok(maxTime<=4);assert.ok(contactTicks>150);assert.equal(bot.falls,0);const trainedTime=s.time;
  const plain=bend();plain.bot.kneePadId=undefined;while(plain.bot.z<1560 && plain.s.time<30)stepRace(plain.s);
  assert.ok(plain.s.time-trainedTime>.15,JSON.stringify({trainedTime,plainTime:plain.s.time}));
});
test('wet roads, choppers, police, shoulders and opposite steering never request knee down',()=>{
  const rain=bend('rain');assert.equal(botCommand(rain.s,rain.bot).action,undefined);
  for(let i=0;i<600;i++)stepRace(rain.s);assert.equal(rain.bot.wetKneeTicks,0);assert.ok(!rain.bot.kneeTime);assert.equal(rain.bot.falls,0);
  for(const change of [{bikeId:'lobo',kneePadId:'gold'},{profile:'police' as const,kneePadId:'gold'},{x:8},{x:-4,targetX:5}]){
    const {s,bot}=bend();Object.assign(bot,change);assert.equal(botCommand(s,bot).action,undefined,JSON.stringify(change));
  }
});
test('online CPU equipment matches its own bike; human loadouts and stock stats stay unchanged',()=>{
  for(const track of TRACKS){
    const players=[{id:'a',name:'A',bikeId:'ferro',kneePadId:'gold'},{id:'b',name:'B',bikeId:'lobo'}];
    const s=createMultiplayerRace(track.id,players,42,true);assert.equal(s.riders[0].kneePadId,'gold');assert.equal(s.riders[1].kneePadId,undefined);
    for(const r of s.riders){assert.equal(r.maxSpeed,getBike(r.bikeId).speed);assert.equal(r.handling,getBike(r.bikeId).handling);if(r.profile!=='player'&&!supportsKneeDown(r.bikeId))assert.equal(r.kneePadId,undefined);}
    assert.ok(s.riders.some(r=>r.profile!=='player'&&r.kneePadId));
    assert.equal(createMultiplayerRace(track.id,players,42,false).riders.length,2);
  }
});
