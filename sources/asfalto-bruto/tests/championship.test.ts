import test from 'node:test';
import assert from 'node:assert/strict';
import { newChampionship, championshipPoints, championshipStandings, championshipRoute, championshipGarageOpen, startChampionshipRace, nextChampionshipStage, checkpointChampionship, championshipRemainder, advanceChampionshipRemainder, recordChampionshipHeat, type ChampHeat } from '../src/game/championship';
import { createRace, crashRider, finishRider, stepRace, snapshot } from '../src/game/simulation';
import { freshSave, normalizeSave, repair, repairChampionshipBike, settleRace } from '../src/game/save';
import { championshipBikeState } from '../src/game/championship';
import { TRACKS } from '../src/game/content';
import { CONDITIONS } from '../src/game/conditions';
import type { RaceState } from '../src/game/types';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { once } from 'node:events';
const ids=['player',...Array.from({length:7},(_,i)=>`rival-${i}`)];
function finishHeat(s:RaceState,place=2,dnf=false){
 s.mode='finished';s.time=200;s.multiplayer={humanIds:ids,results:{}};
 const order=ids.slice(1);order.splice(place-1,0,'player');
 for(const [i,id] of order.entries()){const r=s.riders.find(r=>r.id===id)!;const failed=dnf && id==='player';s.multiplayer.results[id]={reason:failed?'wrecked':'finish',place:i+1,time:180+i,reward:0,hits:0,falls:0};r.finishedAt=failed?null:180+i;r.integrity=id==='player'?46:60;}
 return s;
}
test('championship scores 10/6/4/3/2/1; seventh, eighth and every DNF score zero',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,8,null].map(championshipPoints),[10,6,4,3,2,1,0,0,0]);
 const save=freshSave();save.championship=newChampionship(6);
 const s=finishHeat(startChampionshipRace(save)!,1,true);assert.ok(recordChampionshipHeat(save.championship,s));
 const me=championshipStandings(save.championship.heats).find(r=>r.id==='player')!;assert.equal(me.points,0);assert.equal(me.finishes[0].place,null);assert.equal(save.championship.status,'standings');
});
test('a broken bike cannot consume a championship heat or lock a new stage loadout',()=>{
 const save=freshSave();save.championship=newChampionship(7);save.condition.ferro=0;
 const before=JSON.stringify(save);assert.equal(startChampionshipRace(save),null);assert.equal(JSON.stringify(save),before);
});
test('broken CPU bikes repair before the next heat, while partially damaged bikes keep their wear',()=>{
 const save=freshSave();save.championship=newChampionship(27);const c=save.championship;
 const first=finishHeat(startChampionshipRace(save)!,1);for(const r of first.riders.slice(1,5))r.integrity=0;first.riders[5].integrity=19;
 recordChampionshipHeat(c,first);const heats=JSON.stringify(c.heats),cash=save.cash;
 const next=startChampionshipRace(save)!;assert.deepEqual(next.riders.slice(1,5).map(r=>r.integrity),[100,100,100,100]);assert.equal(next.riders[5].integrity,19);assert.equal(save.cash,cash);assert.equal(JSON.stringify(c.heats),heats);
 const starts=next.riders.map(r=>r.z);for(let n=0;n<390;n++)stepRace(next);
 for(const [i,r] of next.riders.entries())if(i){assert.ok(r.z>starts[i]+10,`${r.name} must leave the grid`);assert.equal(r.out,undefined);}
});
test('old championship countdowns also repair broken CPUs, without reviving a DNF during the race',()=>{
 const save=freshSave();save.championship=newChampionship(28);const c=save.championship,race=startChampionshipRace(save)!;
 race.riders[1].integrity=0;checkpointChampionship(c,race);
 assert.equal(startChampionshipRace(save)!.riders[1].integrity,100);
 race.mode='racing';race.time=60;race.tick=3600;race.riders[1].out='wrecked';checkpointChampionship(c,race);
 assert.equal(startChampionshipRace(save)!.riders[1].integrity,0);assert.equal(startChampionshipRace(save)!.riders[1].out,'wrecked');
});
test('low integrity warns below 20; only exact zero unlocks repairs during a stage',()=>{
 const save=freshSave();save.cash=2000;save.championship=newChampionship(8);
 recordChampionshipHeat(save.championship,finishHeat(startChampionshipRace(save)!));
 for(const integrity of [20,19.9,15,1,.1,0]){
  save.championship.damage.player=integrity;save.championship.entry!.condition.ferro=integrity;
  const status=championshipBikeState(save);assert.equal(status.low,integrity<20);assert.equal(status.blocked,integrity===0);assert.equal(status.canRepair,integrity===0);
  const before=JSON.stringify(save);if(integrity>0){assert.equal(repairChampionshipBike(save),false);assert.equal(JSON.stringify(save),before);}
 }
});
test('repairing the entered bike costs once and preserves results, gear, nitro and opponent damage across reload',()=>{
 const save=freshSave();save.cash=399;save.nitro={ferro:2};save.championship=newChampionship(9);
 const first=startChampionshipRace(save)!;first.riders[0].nitro=0;checkpointChampionship(save.championship,first);
 const result=finishHeat(first,1,true);result.riders[0].integrity=0;recordChampionshipHeat(save.championship,result);
 const scored=JSON.stringify(save.championship.heats),before=JSON.stringify(save);assert.equal(repairChampionshipBike(save),false);assert.equal(JSON.stringify(save),before);
 // A different bike and repairs/purchases in the free-race garage cannot change
 // the stage's bike, equipment, nitro or the actual repair price.
 save.owned.push('brutal');save.bikeId='brutal';save.condition.brutal=70;save.condition.ferro=100;save.nitro.ferro=2;save.upgrades.ferro.engine=3;save.cash=1400;
 assert.equal(championshipBikeState(save).bikeId,'ferro');assert.equal(repairChampionshipBike(save),true);assert.equal(save.cash,1000);
 assert.equal(repairChampionshipBike(save),false);assert.equal(save.cash,1000);assert.equal(save.bikeId,'brutal');assert.equal(save.condition.brutal,70);assert.equal(JSON.stringify(save.championship.heats),scored);
 const restored=normalizeSave(JSON.parse(JSON.stringify(save))),next=startChampionshipRace(restored)!;
 assert.equal(next.condition,'sunset');assert.equal(next.riders[0].integrity,100);assert.equal(next.riders[1].integrity,60);assert.equal(next.riders[0].nitro??0,0);assert.equal(next.riders[0].maxSpeed,createRace().riders[0].maxSpeed);
 const db=new AccountsDB(':memory:');try{const a=db.login('repair-champ');db.save(a.id,0,restored,'repaired-championship-01');assert.equal(snapshot(startChampionshipRace(db.cloud(a.id).save!)!),snapshot(next));}finally{db.close();}
});
test('old zero-integrity countdowns can be repaired, while pending results must settle before repairing',()=>{
 const save=freshSave();save.cash=800;save.championship=newChampionship(10);const race=startChampionshipRace(save)!;
 race.riders[0].integrity=0;race.tick=120;race.countdown=1;checkpointChampionship(save.championship,race);
 assert.equal(startChampionshipRace(save),null);assert.ok(repairChampionshipBike(save));assert.equal(startChampionshipRace(save)!.tick,120);assert.equal(startChampionshipRace(save)!.riders[0].integrity,100);
 race.mode='finished';race.result={reason:'wrecked',place:8,time:10,reward:120,hits:0,falls:1};race.riders[0].out='wrecked';checkpointChampionship(save.championship,race);
 assert.equal(championshipBikeState(save).blocked,false);assert.equal(repairChampionshipBike(save),false);assert.equal(snapshot(startChampionshipRace(save)!),snapshot(race));
});
test('five stages each run day/sunset/night/rain, require top three, reset points and finish on Terra',()=>{
 const save=freshSave();save.championship=newChampionship(678);const c=save.championship;
 for(let stage=0;stage<5;stage++){
  assert.equal(c.stage,stage);assert.ok(championshipGarageOpen(c));assert.ok(championshipStandings(c.heats).every(r=>r.points===0));
  for(let heat=0;heat<4;heat++){
   assert.equal(championshipRoute(c).condition.id,CONDITIONS[heat].id);const s=startChampionshipRace(save)!;assert.equal(s.trackId,TRACKS[stage].id);assert.equal(s.condition,CONDITIONS[heat].id);assert.equal(championshipGarageOpen(c),false);
   assert.equal(nextChampionshipStage(c),false);assert.ok(recordChampionshipHeat(c,finishHeat(s,2)));assert.equal(recordChampionshipHeat(c,s),false,'cannot score the same race twice');
   assert.equal(championshipStandings(c.heats).find(r=>r.id==='player')!.points,(heat+1)*6);
  }
  assert.equal(c.history.length,stage+1);assert.equal(c.history[stage].place,2);assert.ok(championshipGarageOpen(c));
  if(stage<4){assert.equal(c.status,'service');assert.ok(nextChampionshipStage(c));}else{assert.equal(c.status,'complete');assert.equal(nextChampionshipStage(c),false);}
 }
 assert.equal(c.history.reduce((n,h)=>n+h.heats.length,0),20);
});
test('fourth in the stage is eliminated; restart resets only the championship to Costa day',()=>{
 const save=freshSave();save.cash=22123;save.owned.push('brutal');save.championship=newChampionship(1);
 for(let heat=0;heat<4;heat++)recordChampionshipHeat(save.championship,finishHeat(startChampionshipRace(save)!,4));
 assert.equal(save.championship.status,'eliminated');assert.equal(save.championship.history[0].place,4);assert.equal(nextChampionshipStage(save.championship),false);assert.equal(startChampionshipRace(save),null);
 save.championship=newChampionship(3);assert.equal(championshipRoute(save.championship).track.id,'costa');assert.equal(championshipRoute(save.championship).condition.id,'day');assert.equal(save.cash,22123);assert.ok(save.owned.includes('brutal'));
});
test('tiebreak uses best finishes then total time; all DNF never qualifies the player',()=>{
 const heats:ChampHeat[]=[0,1,2,3].map(()=>({reason:'left',finishes:ids.map(id=>({id,place:null,time:null}))}));
 assert.equal(championshipStandings(heats).find(r=>r.id==='player')!.rank,8);
 heats[0].finishes[0]={id:'player',place:1,time:190};heats[0].finishes[1]={id:'rival-0',place:2,time:191};heats[1].finishes[1]={id:'rival-0',place:3,time:192};
 const order=championshipStandings(heats);assert.equal(order[0].points,order[1].points);assert.equal(order[0].id,'player','one win beats a second + third at 10 points');
 const equal:ChampHeat[]=[{reason:'finish',finishes:ids.map((id,i)=>({id,place:i+1,time:190+i}))},{reason:'finish',finishes:ids.map((id,i)=>({id,place:i<2?2-i:i+1,time:i===0?192:190+i}))}];
 assert.equal(championshipStandings(equal)[0].id,'rival-0','same places: shorter total time wins');
});
test('damage persists for player and CPUs; outside repair/equipment cannot refresh an entered stage',()=>{
 const save=freshSave();save.cash=10000;save.championship=newChampionship(33);save.nitro={ferro:2};
 const s=startChampionshipRace(save)!;recordChampionshipHeat(save.championship,finishHeat(s));
 save.condition.ferro=46;assert.ok(repair(save));save.upgrades.ferro.engine=3;save.nitro.ferro=5;
 const next=startChampionshipRace(save)!;assert.equal(next.riders[0].integrity,46);assert.equal(next.riders[1].integrity,60);assert.equal(next.riders[0].maxSpeed,createRace().riders[0].maxSpeed);assert.equal(next.riders[0].nitro,2);
 const solo=createRace('costa',save);solo.result={reason:'wrecked',place:8,time:20,reward:120,hits:0,falls:4};solo.riders[0].integrity=0;
 settleRace(save,solo,{starterRepair:false});assert.equal(save.condition.ferro,0);settleRace(save,solo);assert.equal(save.condition.ferro,55,'quick race still has the sponsor repair');
});
test('mid-race checkpoints survive normalization and cloud storage without refilling health, nitro or stunts',()=>{
 const save=freshSave();save.championship=newChampionship(87);const race=startChampionshipRace(save)!;race.mode='racing';Object.assign(race.riders[0],{z:1234,integrity:37,health:26,wheeliesLeft:1,nitroUsed:2,nitro:0,kneeTime:1});race.tick=2100;race.time=31.5;checkpointChampionship(save.championship,race);
 const normalized=normalizeSave(JSON.parse(JSON.stringify(save)));assert.ok(normalized.championship);assert.equal(snapshot(startChampionshipRace(normalized)!),snapshot(race));
 const db=new AccountsDB(':memory:');try{const a=db.login('champ-checkpoint');db.save(a.id,0,save,'championship-save-0001');const restored=db.cloud(a.id).save!;assert.equal(snapshot(startChampionshipRace(restored)!),snapshot(race));assert.ok(JSON.stringify({save:restored,request:'x'.repeat(40),revision:0}).length<128_000);}finally{db.close();}
 const corrupt=structuredClone(save);corrupt.championship!.checkpoint!.riders=[];corrupt.cash=9800;assert.equal(normalizeSave(corrupt).championship,undefined);assert.equal(normalizeSave(corrupt).cash,9800);
 for(const field of ['time','rng']){const invalid=structuredClone(save);delete (invalid.championship!.checkpoint! as any)[field];assert.equal(normalizeSave(invalid).championship,undefined);}
 const brokenResult=structuredClone(save);brokenResult.championship!.checkpoint!.mode='finished';brokenResult.championship!.checkpoint!.result={} as any;assert.equal(normalizeSave(brokenResult).championship,undefined);
});
test('authenticated cloud API preserves a trusted beta checkpoint and rejects browser replacements',async()=>{
 const db=new AccountsDB(':memory:'),origin='https://game.example';
 const accounts=new AccountService({db,clientId:'test-client',origins:[origin],verify:async(credential,nonce)=>{assert.equal(credential,`test:${nonce}`);return 'champion';}});
 const app=createGameServer(new MemoryStore(),{accounts,origins:[origin]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const url=`http://127.0.0.1:${(app.server.address() as {port:number}).port}/api/asfalto/account`;
 async function device(){
  let cookie='',csrf='';
  const call=async(path:string,body?:unknown)=>{const response=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'X-Asfalto-CSRF':csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {response,data:await response.json()};};
  const session=await call('/session');cookie=session.response.headers.get('set-cookie')!.split(';')[0];csrf=session.data.csrf;
  const login=await call('/login',{credential:`test:${session.data.nonce}`});assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie')!.split(';')[0];csrf=login.data.csrf;
  return call;
 }
 try{
  const first=await device(),second=await device(),save=freshSave();save.championship=newChampionship(452);const race=startChampionshipRace(save)!;
  race.time=42;race.tick=2520;race.mode='racing';Object.assign(race.riders[0],{x:2,z:600,speed:45,integrity:10,wheeliesLeft:0});crashRider(race,race.riders[0],true,'impact');
  // Exercise the HTTP body boundary with a valid, bounded collision cache.
  race.collisions=Object.fromEntries(Array.from({length:1100},(_,i)=>[`player:traffic-collision-${i}`,41]));checkpointChampionship(save.championship,race);
  const body={revision:0,request:'championship-device-001',save};assert.ok(Buffer.byteLength(JSON.stringify(body))>32_000);
  const session=(await first('/session')).data;
  db.save(session.account.id,session.cloud.revision,save,'trusted-championship-beta');
  assert.equal((await first('/save',body)).response.status,409);assert.equal((await first('/save',body)).response.status,409);
  const remote=(await second('/session')).data.cloud;assert.equal(remote.revision,2);assert.equal(snapshot(startChampionshipRace(remote.save)!),snapshot(race));
  assert.equal((await second('/save',{revision:0,request:'championship-stale-002',save:freshSave()})).response.status,409);
  assert.equal((await first('/save',{...body,request:'championship-oversize-3',padding:'x'.repeat(128_000)})).response.status,413);
 }finally{await app.close();db.close();}
});
test('remaining opponents really finish or DNF after the player; police never score and source is untouched',()=>{
 const s=createRace('costa');s.mode='racing';s.time=190;s.tick=11400;s.traffic=[];s.obstacles=[];
 for(const [i,r] of s.riders.entries())Object.assign(r,{z:8400-i*12,x:i%2?-3:3,speed:35,integrity:i===7?0:100});finishRider(s,s.riders[0],'finish');s.riders[0].finishedAt=190;
 const raw=snapshot(s),remaining=championshipRemainder(s);assert.equal(Object.hasOwn(remaining.multiplayer!.results,'rival-0'),false);
 while(!advanceChampionshipRemainder(remaining,600)){}
 assert.equal(remaining.multiplayer!.results['rival-6'].reason,'wrecked');assert.equal(remaining.multiplayer!.results['rival-0'].reason,'finish');assert.ok(remaining.riders[1].finishedAt!>190);assert.equal(Object.keys(remaining.multiplayer!.results).length,8);assert.equal(snapshot(s),raw);
});
