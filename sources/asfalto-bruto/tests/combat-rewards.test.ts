import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS } from '../src/game/content';
import { createRace, createMultiplayerRace, stepRace, crashRider, finishRider, snapshot, restoreSnapshot } from '../src/game/simulation';
import { freshSave, settleRace, settleGuestOnlineResult, normalizeSave, awardOnlinePoliceReward } from '../src/game/save';
import { racePayout } from '../src/game/rewards';
import { EMPTY_COMMAND, type RaceState } from '../src/game/types';
import { AccountsDB } from '../server/accounts-db';
import { Economy } from '../server/economy';
import { makeMember, makeRoom } from '../server/room';

function fixture(s=createRace('costa',undefined,91,'day')){
 s.mode='racing';s.countdown=0;s.time=20;s.traffic=[];s.obstacles=[];s.policeActive=false;s.riders=s.riders.slice(0,2);
 const [p,target]=s.riders;Object.assign(p,{x:0,z:500,speed:0});Object.assign(target,{x:2.1,z:500,speed:0,health:1});
 return {s,p,target};
}
function punch(s:RaceState){const messages:string[]=[];for(let i=0;i<14;i++){stepRace(s,Object.fromEntries(s.riders.map((r,n)=>[r.id,{...EMPTY_COMMAND,attack:n===0&&i===0?'punch':null}])));messages.push(...s.events.flatMap(e=>e.text?[e.text]:[]));}return messages;}
function remount(s:RaceState){const [p,t]=s.riders;delete t.recovery;Object.assign(t,{crash:0,immune:0,health:1,attack:null,x:p.x+2.1,z:p.z,speed:0});p.cooldown=0;p.attack=null;}

test('multiplayer pays the same eight finishing places as solo on every track and condition',()=>{
 for(const track of TRACKS)for(const condition of ['day','sunset','night','rain'] as const){
  const people=Array.from({length:8},(_,i)=>({id:`person-${i}`,name:`Rider ${i}`}));
  const multi=createMultiplayerRace(track.id,people,91,false,condition);
  for(const [i,p] of multi.riders.entries()){p.finishedAt=100+i;p.z=track.distance;}
  for(const [i,p] of multi.riders.entries()){
   finishRider(multi,p,'finish');
   const solo=createRace(track.id,undefined,91,condition);
   solo.riders[0].finishedAt=100+i;solo.riders[0].z=track.distance;
   for(let j=1;j<=i;j++){solo.riders[j].finishedAt=100+j-1;solo.riders[j].z=track.distance;}
   finishRider(solo,solo.riders[0],'finish');
   const result=multi.multiplayer!.results[p.id];
   assert.equal(result.place,i+1);assert.equal(result.reward,Math.round(track.prize*[1,.8,.64,.5,.4,.32,.25,.2][i]));assert.equal(result.reward,solo.result!.reward);
  }
 }
});

test('every rival fall pays 50, repeated victims count, police pay only 500, and replay retains the counters',()=>{
 for(const profile of ['careful','player'] as const){
  const {s,p,target}=fixture();target.profile=profile;target.health=100;punch(s);assert.equal(p.feats?.rivalKnockdowns,undefined);
  remount(s);const messages=punch(s);assert.equal(p.feats?.rivalKnockdowns,1);assert.equal(p.feats?.policeKnockdowns,undefined);
  assert.ok(messages.includes('RIVAL DERRUBADO · +50 MOEDAS'));
  p.cooldown=0;p.attack=null;punch(s);assert.equal(p.feats?.rivalKnockdowns,1,'already fallen rider cannot pay again');
  remount(s);punch(s);assert.equal(p.feats?.rivalKnockdowns,2);assert.equal(p.feats?.knocked.length,1,'achievement retains unique victims');
  remount(s);target.profile='police';punch(s);assert.equal(p.feats?.policeKnockdowns,1);assert.equal(p.feats?.rivalKnockdowns,2);
  const restored=restoreSnapshot(snapshot(s));for(let i=0;i<15;i++){stepRace(s);stepRace(restored);}assert.equal(snapshot(s),snapshot(restored));
  finishRider(s,p,'left');const save=freshSave(),payout=settleRace(save,s)!;
  assert.equal(payout.rivalBonus,100);assert.equal(payout.policeBonus,500);assert.equal(payout.total,600);assert.equal(save.cash,1250);
 }
});

test('environment falls give no bonus; simultaneous rival contact pays each attacker once',()=>{
 const env=fixture();crashRider(env.s,env.target,true);crashRider(env.s,env.p,true);finishRider(env.s,env.p,'left');
 assert.equal(racePayout('costa',env.s.result!).total,0);
 const {s,p,target}=fixture();p.health=1;target.x=.6;stepRace(s,Object.fromEntries(s.riders.map(r=>[r.id,EMPTY_COMMAND])));
 assert.ok(p.recovery&&target.recovery);assert.equal(p.feats?.rivalKnockdowns,1);assert.equal(target.feats?.rivalKnockdowns,1);
 assert.equal(p.feats?.policeKnockdowns,undefined);for(let i=0;i<10;i++)stepRace(s);assert.equal(p.feats?.rivalKnockdowns,1);
});

test('both bonuses survive defeat and abandonment; only finishing can add the existing solo record bonus',()=>{
 for(const reason of ['finish','caught','wrecked','timeout','left'] as const){
  const {s,p}=fixture();p.feats!.rivalKnockdowns=3;p.feats!.policeKnockdowns=2;finishRider(s,p,reason);
  const save=freshSave();save.records['costa:day']={time:200,place:1};const payout=settleRace(save,s,{mode:'championship'})!;
  assert.equal(payout.rivalBonus,150);assert.equal(payout.policeBonus,1000);assert.equal(payout.recordBonus,reason==='finish'?420:0);
  assert.equal(payout.baseReward,reason==='finish'?s.result!.reward:reason==='left'?0:120);assert.equal(save.cash,650+payout.total);
 }
});

test('guest multiplayer pays place and bonuses once across reload, without changing campaign records',()=>{
 const members=[makeMember('A',0),makeMember('B',0)],s=createMultiplayerRace('costa',members),save=freshSave();
 save.records.costa={time:300,place:2};const p=s.riders[0];p.finishedAt=100;p.feats!.rivalKnockdowns=2;p.feats!.policeKnockdowns=1;finishRider(s,p,'finish');
 // A pre-existing police-only receipt cannot make this settlement repeat that bonus.
 awardOnlinePoliceReward(save,p.id,s.multiplayer!.results[p.id]);assert.equal(save.cash,1150);
 const awarded=settleGuestOnlineResult(save,s,p.id)!;assert.equal(awarded.payout.total,2000);assert.equal(save.cash,2650);
 const reloaded=normalizeSave(JSON.parse(JSON.stringify(save)));assert.equal(settleGuestOnlineResult(reloaded,s,p.id),undefined);assert.equal(reloaded.cash,2650);
 assert.deepEqual(reloaded.records,{'costa':{time:300,place:2}});assert.equal(awarded.payout.recordBonus,0);
});

test('account multiplayer pays placement to all finishers and combat bonuses only to their author, once after restart',()=>{
 const db=new AccountsDB(':memory:');try{
  const e=new Economy(db),a=db.login('combat-a'),b=db.login('combat-b'),ma=makeMember('A',0),mb=makeMember('B',0);
  e.equipMember(a.id,ma);e.equipMember(b.id,mb);const {s,p,target}=fixture(createMultiplayerRace('costa',[ma,mb]));punch(s);
  assert.equal(p.feats?.rivalKnockdowns,1);remount(s);target.profile='police';punch(s);target.profile='player';
  p.finishedAt=100;p.z=8400;target.finishedAt=101;target.z=8400;finishRider(s,p,'finish');finishRider(s,target,'finish');
  const room=makeRoom('ABCDEF','costa',ma,0);room.members.push(mb);room.race=s;room.phase='finished';e.recordRoom(room);
  assert.equal(db.cloud(a.id).save!.cash,650+1400+50+500);assert.equal(db.cloud(b.id).save!.cash,650+1120);
  const before=[db.cloud(a.id),db.cloud(b.id)];e.recordRoom(room);new Economy(db).recordRoom(room);assert.deepEqual([db.cloud(a.id),db.cloud(b.id)],before);
 }finally{db.close();}
});

test('official solo replay counts real rival falls, ignores forged totals and preserves the bonus after abandonment',async()=>{
 const db=new AccountsDB(':memory:');try{
  const account=db.login('combat-solo'),e=new Economy(db),run=e.start(account.id,{trackId:'costa',condition:'day',revision:e.initialize(account.id).revision});
  const {s}=fixture(run.initial!);db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(s),run.id);
  const body={id:run.id,cursor:0,segments:[{count:1,command:{...EMPTY_COMMAND,attack:'punch'}},{count:13,command:EMPTY_COMMAND}],abandon:true,rivalKnockdowns:999,reward:999999};
  const result=await e.advance(account.id,body,true);assert.equal(result.payout?.rivalBonus,50);assert.equal(result.payout?.policeBonus,undefined);assert.equal(result.payout?.baseReward,0);assert.equal(db.cloud(account.id).save!.cash,700);
  const before=db.cloud(account.id);await e.advance(account.id,body,true);assert.deepEqual(db.cloud(account.id),before);
 }finally{db.close();}
});
