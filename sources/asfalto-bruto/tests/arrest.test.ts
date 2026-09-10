import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrestScene,ARREST_SECONDS} from '../src/game/arrest';
import {createRace,crashRider,stepRace,FALL_ARREST_RADIUS} from '../src/game/simulation';
import {freshSave,normalizeSave} from '../src/game/save';
import {newChampionship,recordChampionshipHeat} from '../src/game/championship';
import {championshipMarkup} from '../src/championship-ui';
import {PORT_CREW} from '../src/game/port-workers';
import {PORT_WORKS,portTraffic} from '../src/game/port';
import {raceOutcome} from '../src/game/race-outcome';

function fixture(track='porto',officerDistance?:number){
 const s=createRace(track,freshSave(),88117,'rain');s.mode='racing';s.time=40;s.countdown=0;s.traffic=[];s.obstacles=[];
 const p=s.riders[0];p.z=2000;p.x=0;p.speed=45;s.riders=[p];
 if(officerDistance!==undefined){s.riders.push({...p,id:'police',profile:'police',x:0,z:p.z+officerDistance,finishedAt:null,integrity:100,health:100});s.policeActive=true;}
 crashRider(s,p,true);return s;
}
test('Porto has no special disqualification: a fall without nearby police stays recoverable',()=>{
 for(const track of ['costa','serra','vale','porto','terra'])for(const distance of [undefined,FALL_ARREST_RADIUS+3]){
  const s=fixture(track,distance);stepRace(s);assert.equal(s.result,null);assert.ok(s.riders[0].recovery);
 }
});
test('fall arrest records the actual reason, and every scene phase leaves official state intact',()=>{
 const s=fixture('porto',8);stepRace(s);assert.equal(s.result?.reason,'caught');assert.equal(s.result?.arrestCause,'fall');const before=structuredClone(s);
 for(const [age,phase] of [[0,'arriving'],[1.3,'dismounting'],[2.4,'walking'],[4,'cuffing'],[5.4,'cuffed']] as const){
  const scene=arrestScene(s,'player',age);assert.equal(scene.police.phase,phase);assert.equal(scene.cuffed,age>=4.8);assert.deepEqual(s,before);assert.equal(scene.state.result?.reason,'caught');
 }
 assert.deepEqual(arrestScene(s,'player',ARREST_SECONDS),arrestScene(s,'player',100));
 const online=structuredClone(s);online.multiplayer={humanIds:['player','other'],results:{player:online.result!}};online.result=null;
 assert.equal(arrestScene(online,'player',6).cuffed,true);assert.equal(online.multiplayer.results.player.reason,'caught');
});
test('championship persists cause after reload and explains failures before the standings',()=>{
 const save=freshSave(),c=newChampionship(44);save.championship=c;c.status='racing';const {championship:_,...entry}=save;c.entry=structuredClone(entry);
 const s=createRace('costa',save,44,'day');s.mode='finished';s.multiplayer={humanIds:s.riders.map(r=>r.id),results:{}};
 for(const [i,r] of s.riders.entries())s.multiplayer.results[r.id]={reason:i?'finish':'caught',arrestCause:i?undefined:'fall',place:i+1,time:120+i,reward:0,hits:0,falls:i?0:1};
 assert.ok(recordChampionshipHeat(c,s));assert.equal(c.heats[0].arrestCause,'fall');
 const restored=normalizeSave(JSON.parse(JSON.stringify(save)));assert.equal(restored.championship?.heats[0].arrestCause,'fall');
 const html=championshipMarkup(restored.championship,restored);assert.match(html,/PRESO PELA POLÍCIA/);assert.match(html,/30 metros/);assert.ok(html.indexOf('PRESO PELA POLÍCIA')<html.indexOf('champ-table'));
 for(const reason of ['left','timeout','wrecked'])assert.ok(raceOutcome(reason).description.length>20);
 assert.match(raceOutcome('wrecked',{exploded:true}).description,/explodiu/);
});
test('both queue leaders have a flagger, and workers remain in the closed half',()=>{
 const traffic=portTraffic(()=>.5),flaggers=PORT_CREW.filter(w=>w.kind==='stop');assert.equal(flaggers.length,2);
 for(const [i,work] of PORT_WORKS.entries()){
  const workers=PORT_CREW.filter(w=>w.id.startsWith(`worker-${i}-`));assert.equal(workers.length,2);
  for(const worker of workers){assert.ok(worker.z>work.start&&worker.z<work.end);assert.equal(Math.sign(worker.x),work.side);}
  if(work.queue){const head=traffic.find(t=>t.id===`port-queue-${i}-0`)!,flag=flaggers.find(w=>w.id===`flagger-${i}`)!;assert.equal(flag.z,head.z);assert.ok(Math.abs(flag.x-head.x)>2);}
 }
});
