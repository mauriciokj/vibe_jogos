import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { makeMember, makeRoom, joinRoom, setReady, lobbyClock, setContinuation, continuationChoice, reopenRoom, configureRoom, depart, hostId, viewRoom, type Room } from '../server/room';
import { finishRider } from '../src/game/simulation';
import { EMPTY_COMMAND } from '../src/game/types';
import { freshSave, normalizeSave, settleGuestOnlineResult } from '../src/game/save';
import { AccountService } from '../server/accounts';
import { AccountsDB } from '../server/accounts-db';
import { MemoryStore } from '../server/store';
import { createGameServer } from '../server/service';
import { NET_VERSION, RECONNECT_MS, type ServerMessage } from '../src/multiplayer/protocol';

const at=1_000_000;
function lobby(count=3){const room=makeRoom('ABCDEF','costa',makeMember('Host',at),at,true,'night',true);for(let i=1;i<count;i++)joinRoom(room,makeMember(`Player ${i}`,at),at);return room;}
function start(room:Room,now=at){for(const m of room.members)setReady(room,m.id,m.epoch,true,now);lobbyClock(room,now+5000);room.members.forEach(m=>m.lastSeen=now+5000);}
function finish(room:Room){const s=room.race!;s.time=120;for(const [i,r] of s.riders.entries()){if(r.profile==='police')continue;r.finishedAt=120+i;finishRider(s,r,'finish');}s.mode='finished';room.phase='finished';room.finishedAt=at+6000;}
function vote(room:Room,index:number,choice:'next'|'again'|'lobby',now=at+6000){const m=room.members[index];setContinuation(room,m.id,m.epoch,room.round ?? 0,choice,now);}

test('unanimous next keeps code, members, tokens, bots and visibility; changes route and starts one new round',()=>{
 const r=lobby();start(r);const ids=r.members.map(m=>m.id),tokens=r.members.map(m=>m.token);
 assert.throws(()=>vote(r,0,'next'),/terminarem/);finish(r);vote(r,0,'next');vote(r,1,'next');assert.equal(continuationChoice(r,at+6000),undefined);
 vote(r,2,'again');assert.equal(continuationChoice(r,at+6000),undefined);vote(r,2,'next');assert.equal(continuationChoice(r,at+6000),'next');
 r.ack[ids[0]]=20;r.attackAck[ids[0]]=3;r.actionAck={[ids[0]]:4};reopenRoom(r,'next',at+6000);
 assert.equal(r.code,'ABCDEF');assert.equal(r.round,1);assert.equal(r.condition,'rain');assert.equal(r.trackId,'costa');assert.equal(r.public,true);assert.equal(r.fillBots,true);
 assert.deepEqual(r.members.map(m=>m.id),ids);assert.deepEqual(r.members.map(m=>m.token),tokens);assert.equal(r.locked,true);assert.equal(r.deadline,at+11000);assert.equal(r.race,null);
 assert.equal(r.ack[ids[0]],20);assert.equal(r.attackAck[ids[0]],3);assert.equal(r.actionAck[ids[0]],4);assert.ok(r.members.every(m=>m.entryId&&m.entryId!==m.id));
 assert.throws(()=>setContinuation(r,ids[0],r.members[0].epoch,0,'next',at+6001),/terminarem/);
 lobbyClock(r,at+11000);assert.equal(r.phase,'racing');assert.equal(r.race!.riders.length,8);assert.equal(r.race!.tick,0);assert.deepEqual(r.race!.multiplayer!.results,{});
});

test('return to lobby waits for finish; host changes track, everyone changes only their own bike, and all must ready again',()=>{
 const r=lobby();start(r);assert.throws(()=>reopenRoom(r,'lobby',at+6000),/andamento/);finish(r);vote(r,1,'lobby');assert.equal(continuationChoice(r,at+6000),'lobby');reopenRoom(r,'lobby',at+6000);
 const [a,b]=r.members;assert.equal(r.deadline,null);assert.ok(r.members.every(m=>!m.ready));lobbyClock(r,at+200000);assert.equal(r.phase,'lobby');
 setReady(r,a.id,a.epoch,true,at+6001);assert.throws(()=>configureRoom(r,b.id,b.epoch,1,{trackId:'porto',condition:'rain'},at+6001),/anfitrião/);
 configureRoom(r,a.id,a.epoch,1,{trackId:'porto',condition:'rain'},at+6002);assert.equal(r.trackId,'porto');assert.equal(a.ready,false);
 configureRoom(r,b.id,b.epoch,1,{bikeId:'brutal',loadout:{nitro:3,weaponId:'chain'}},at+6003);assert.equal(b.bikeId,'brutal');assert.equal(b.nitro,3);assert.equal(a.bikeId,'ferro');
 configureRoom(r,b.id,b.epoch,1,{bikeId:'policial'},at+6004);assert.equal(b.bikeId,'ferro');
 assert.throws(()=>configureRoom(r,a.id,a.epoch,0,{bikeId:'lobo'},at+6004),/largada/);
 for(const m of r.members)setReady(r,m.id,m.epoch,true,at+7000);assert.equal(r.deadline,at+12000);
 assert.throws(()=>configureRoom(r,b.id,b.epoch,1,{bikeId:'lobo'},at+7001),/largada/);
});

test('disconnect grace blocks unanimous advance; explicit leave transfers host and no one starts alone',()=>{
 const r=lobby();start(r);finish(r);vote(r,1,'next');vote(r,2,'next');const a=r.members[0];depart(r,a.id,a.epoch,at+6000);
 assert.equal(continuationChoice(r,at+6001),undefined);assert.equal(hostId(r),r.members[1].id);
 assert.equal(viewRoom(r,at+6001).continuationCount,3);assert.equal(viewRoom(r,at+6001).reconnectingCount,1);
 assert.equal(continuationChoice(r,at+6000+RECONNECT_MS+1),'next');
 a.connected=true;depart(r,a.id,a.epoch,at+6002,true);assert.equal(continuationChoice(r,at+6002),'next');
 const b=r.members[1];depart(r,b.id,b.epoch,at+6003,true);assert.equal(continuationChoice(r,at+6003),undefined);
 vote(r,2,'lobby',at+6004);reopenRoom(r,'lobby',at+6004);assert.equal(r.members.length,1);assert.equal(r.locked,false);
 assert.equal(viewRoom(r,at+6004).hostId,r.members[0].id);
});

test('configuration cannot pass a countdown deadline before the next server pulse',()=>{
 const r=lobby(2),m=r.members[0];
 assert.throws(()=>configureRoom(r,m.id,m.epoch,0,{trackId:'terra',condition:'day'},at+115001),/largada/);
 assert.equal(r.trackId,'costa');
});

test('last route offers replay/lobby, and repeated replay does not change the route',()=>{
 const r=lobby(2);r.trackId='terra';r.condition='rain';start(r);finish(r);assert.throws(()=>vote(r,0,'next'),/última/);
 vote(r,0,'again');vote(r,1,'again');reopenRoom(r,'again',at+6000);assert.equal(r.trackId,'terra');assert.equal(r.condition,'rain');assert.equal(r.round,1);
 lobbyClock(r,at+11000);finish(r);vote(r,0,'again',at+12000);vote(r,1,'again',at+12000);reopenRoom(r,'again',at+12000);assert.equal(r.round,2);assert.equal(r.condition,'rain');
});

test('guest result and nitro receipts are independent per race and idempotent after reload',()=>{
 const r=lobby(2),save=freshSave();save.nitro={ferro:2};start(r);const m=r.members[0],p=r.race!.riders[0];p.nitroUsed=1;p.nitro=1;p.feats!.policeKnockdowns=1;finish(r);
 const first=m.entryId ?? m.id;settleGuestOnlineResult(save,r.race!,m.id,first);const after=structuredClone(save);assert.equal(save.cash,1150);assert.equal(save.nitro.ferro,1);
 const reload=normalizeSave(save);assert.equal(settleGuestOnlineResult(reload,r.race!,m.id,first),undefined);assert.deepEqual(reload.onlineResults,after.onlineResults);assert.equal(reload.cash,1150);
 reopenRoom(r,'again',at+6000);assert.equal(r.members[0].nitro,1);lobbyClock(r,at+11000);const second=r.race!.riders[0];second.nitroUsed=1;second.nitro=0;second.feats!.policeKnockdowns=1;finish(r);
 settleGuestOnlineResult(save,r.race!,m.id,r.members[0].entryId!);assert.equal(save.cash,1650);assert.equal(save.nitro.ferro,0);assert.equal(save.onlineResults!.length,2);
 settleGuestOnlineResult(save,r.previous!.race,m.id,first);assert.equal(save.cash,1650);
});

test('account reservations, rewards and rankings renew every race; bike switch refunds the previous stock',()=>{
 const db=new AccountsDB(':memory:');try{
  const accounts=new AccountService({db,clientId:'',origins:[]}),a=db.login('round-a'),b=db.login('round-b'),r=lobby(2);
  for(const [i,account] of [a,b].entries()){const save=freshSave();save.owned.push('veneno');save.upgrades.veneno={engine:0,armor:0,handling:0};save.condition.veneno=100;save.nitro={ferro:2,veneno:1};db.save(account.id,0,save,`setup-${i}`);r.members[i].accountId=account.id;accounts.economy.equipMember(account.id,r.members[i]);}
  start(r);r.race!.riders[0].nitroUsed=1;r.race!.riders[0].nitro=1;r.race!.riders[0].feats!.policeKnockdowns=1;finish(r);accounts.recordRoom(r);accounts.recordRoom(r);
  assert.equal(db.cloud(a.id).save!.cash,1150);assert.equal(db.cloud(a.id).save!.nitro!.ferro,1);
  reopenRoom(r,'again',at+6000,(next,old)=>accounts.economy.prepareMembers(next,old));assert.equal(r.members[0].nitro,1);assert.equal(db.cloud(a.id).save!.nitro!.ferro,0);
  lobbyClock(r,at+11000);r.race!.riders[0].nitroUsed=1;r.race!.riders[0].nitro=0;r.race!.riders[0].feats!.policeKnockdowns=2;finish(r);accounts.recordRoom(r);accounts.recordRoom(r);
  assert.equal(db.cloud(a.id).save!.cash,2150);assert.equal(db.cloud(a.id).save!.nitro!.ferro,0);assert.equal(db.ranking('multi','costa','night','time',a.id).find(row=>row.me)!.races,2);
  reopenRoom(r,'lobby',at+12000,(next,old)=>accounts.economy.prepareMembers(next,old));const m=r.members[0];
  configureRoom(r,m.id,m.epoch,2,{bikeId:'veneno',loadout:{nitro:999,weaponId:'chain'}},at+12001,(next,old)=>accounts.economy.equipMember(next.accountId,next,old));assert.equal(m.nitro,1);assert.equal(m.weaponId,undefined);assert.equal(db.cloud(a.id).save!.nitro!.veneno,0);
  configureRoom(r,m.id,m.epoch,2,{bikeId:'lobo'},at+12002,(next,old)=>accounts.economy.equipMember(next.accountId,next,old));assert.equal(db.cloud(a.id).save!.nitro!.veneno,1);assert.equal(m.nitro,0);
  accounts.economy.releaseMember(m);accounts.economy.releaseMember(m);assert.equal(db.cloud(a.id).save!.nitro!.veneno,1);
 }finally{db.close();}
});

test('a failed multi-account preparation rolls back every new reservation',()=>{
 const db=new AccountsDB(':memory:');try{
  const accounts=new AccountService({db,clientId:'',origins:[]}),a=db.login('atomic-a'),b=db.login('atomic-b');const r=lobby(2);
  for(const [i,account] of [a,b].entries()){const save=freshSave();save.nitro={ferro:2};db.save(account.id,0,save,`atomic-${i}`);r.members[i].accountId=account.id;accounts.economy.equipMember(account.id,r.members[i]);}
  start(r);finish(r);accounts.recordRoom(r);accounts.economy.start(b.id,{trackId:'costa',condition:'day',revision:db.cloud(b.id).revision});const before=db.cloud(a.id);
  assert.throws(()=>reopenRoom(r,'next',at+6000,(next,old)=>accounts.economy.prepareMembers(next,old)),/Conclua/);
  assert.deepEqual(db.cloud(a.id),before);assert.equal(r.phase,'finished');assert.equal(r.round,0);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM economy_multiplayer WHERE account=? AND closed=0').get(a.id)!.n,0);
 }finally{db.close();}
});

test('real sockets preserve session on next, reconnect, configure and host departure',async()=>{
 let now=at;const store=new MemoryStore(),app=createGameServer(store,{now:()=>now}),clients:WebSocket[]=[];app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${(app.server.address() as {port:number}).port}`),messages:ServerMessage[]=[];clients.push(ws);ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));await once(ws,'open');return {ws,send:(value:unknown)=>ws.send(JSON.stringify(value)),async wait(predicate:(m:ServerMessage)=>boolean){for(let i=0;i<300;i++){const found=messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,10));}throw Error(JSON.stringify(messages.slice(-2)));}};}
 try{
  const a=await connect();a.send({type:'create',version:NET_VERSION,name:'A',trackId:'costa',condition:'night',public:true});const wa=await a.wait(m=>m.type==='welcome');assert.equal(wa.type,'welcome');if(wa.type!=='welcome')return;
  const code=wa.room.code,b=await connect();b.send({type:'join',version:NET_VERSION,name:'B',code});const wb=await b.wait(m=>m.type==='welcome');if(wb.type!=='welcome')throw Error();
  a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await a.wait(m=>m.type==='state'&&m.room.locked);now+=5001;await a.wait(m=>m.type==='state'&&m.room.phase==='racing');
  await store.mutate(code,r=>finish(r));await a.wait(m=>m.type==='state'&&m.room.phase==='finished');a.send({type:'continue',round:0,choice:'next'});await a.wait(m=>m.type==='state'&&m.room.members[0].continuation==='next');assert.equal((await store.read(code))!.round,0);
  b.send({type:'continue',round:0,choice:'next'});const next=await a.wait(m=>m.type==='state'&&m.room.round===1);assert.ok(next.type==='state'&&next.room.condition==='rain');
  now+=5001;await a.wait(m=>m.type==='state'&&m.room.round===1&&m.room.phase==='racing');
  a.send({type:'input',seq:50,command:{...EMPTY_COMMAND,throttle:1}});await new Promise(r=>setTimeout(r,80));now+=100;await a.wait(m=>m.type==='state'&&m.room.round===1&&m.room.ack[wa.id]===50);
  await store.mutate(code,r=>finish(r));await a.wait(m=>m.type==='state'&&m.room.round===1&&m.room.phase==='finished');b.send({type:'continue',round:1,choice:'lobby'});await a.wait(m=>m.type==='state'&&m.room.round===2);
  assert.ok((await store.publicRooms(now)).some(r=>r.code===code));b.ws.close();await once(b.ws,'close');const resumed=await connect();resumed.send({type:'resume',version:NET_VERSION,code,token:wb.token});const wr=await resumed.wait(m=>m.type==='welcome');assert.ok(wr.type==='welcome'&&wr.id===wb.id&&wr.room.round===2);
  a.send({type:'leave'});await a.wait(m=>m.type==='left');await resumed.wait(m=>m.type==='state'&&m.room.hostId===wb.id);
  resumed.send({type:'configure',round:2,trackId:'porto',condition:'rain',bikeId:'brutal'});await resumed.wait(m=>m.type==='state'&&m.room.trackId==='porto'&&m.room.members[0].bikeId==='brutal');
  assert.equal((await store.read(code))!.members.length,1);
 }finally{clients.forEach(ws=>ws.terminate());await app.close();}
});
