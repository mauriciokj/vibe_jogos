import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { ownedOnlineBikes } from '../src/game/bikes';
import { freshSave } from '../src/game/save';
import { finishRider } from '../src/game/simulation';
import { NET_VERSION } from '../src/multiplayer/protocol';
import { makeMember, makeRoom, joinRoom, configureRoom, viewRoom, publicRoomView, setReady, lobbyClock, reopenRoom } from '../server/room';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';

const at=1_000_000;
test('garage rooms filter inventories, normalize entry and reject unowned switches without changing readiness',()=>{
  assert.deepEqual(ownedOnlineBikes(['veneno','veneno','policial','cavalo','bicicleta','unknown']),['ferro','veneno']);
  assert.deepEqual(ownedOnlineBikes('veneno'),['ferro']);
  assert.deepEqual(ownedOnlineBikes(['bicicleta'],true),['ferro','bicicleta']);
  const host=makeMember('Host',at,'brutal',{ownedBikes:['ferro','veneno'],nitro:5});
  const room=makeRoom('ABCDEF','costa',host,at,true,'day',true,true);
  assert.equal(host.bikeId,'ferro');assert.equal(host.nitro,0);
  assert.equal(viewRoom(room,at).garageOnly,true);assert.equal(publicRoomView(room,at)!.garageOnly,true);
  assert.ok(!JSON.stringify(viewRoom(room,at)).includes('ownedBikes'),'private inventory is not broadcast');
  const guest=makeMember('Guest',at,'agulha',{ownedBikes:['ferro','falcao'],nitro:3});joinRoom(room,guest,at);
  assert.equal(guest.bikeId,'ferro');assert.equal(guest.nitro,0);
  setReady(room,guest.id,guest.epoch,true,at);
  assert.throws(()=>configureRoom(room,guest.id,guest.epoch,0,{bikeId:'brutal',loadout:{ownedBikes:['brutal']}},at),/somente motos da sua garagem/);
  assert.equal(guest.ready,true);assert.equal(guest.bikeId,'ferro');assert.deepEqual(guest.ownedBikes,['ferro','falcao']);
  configureRoom(room,guest.id,guest.epoch,0,{bikeId:'falcao'},at);
  assert.equal(guest.bikeId,'falcao');assert.equal(guest.ready,false);
  for(const m of room.members)setReady(room,m.id,m.epoch,true,at);
  lobbyClock(room,at+5000);assert.equal(room.race!.riders.find(r=>r.id===guest.id)!.bikeId,'falcao');
  for(const rider of room.race!.riders){if(rider.profile==='police')continue;finishRider(room.race!,rider,'left');}
  room.phase='finished';room.members.forEach(m=>m.lastSeen=at+6000);
  reopenRoom(room,'lobby',at+6000);assert.equal(room.garageOnly,true);assert.deepEqual(room.members[1].ownedBikes,['ferro','falcao']);
  assert.throws(()=>configureRoom(room,guest.id,guest.epoch,1,{bikeId:'veneno'},at+6001),/garagem/);
});

test('free choice remains the default for new and legacy rooms',()=>{
  const host=makeMember('Host',at,'brutal'),room=makeRoom('ABCDEF','costa',host,at);
  assert.equal(room.garageOnly,false);assert.equal(host.bikeId,'brutal');
  delete room.garageOnly;
  configureRoom(room,host.id,host.epoch,0,{bikeId:'agulha'},at);
  assert.equal(host.bikeId,'agulha');assert.equal(viewRoom(room,at).garageOnly,false);
});

test('WebSockets enforce account ownership on create/join/configure and retain the rule after reconnect',async()=>{
  const db=new AccountsDB(':memory:'),origin='http://garage.test',account=db.login('garage-rule'),save=freshSave();
  save.owned.push('veneno');save.condition.veneno=100;save.upgrades.veneno={engine:0,armor:0,handling:0};save.nitro={ferro:2,veneno:3};
  db.save(account.id,0,save,'garage-fixture');const session=db.session(account.id);
  const accounts=new AccountService({db,origins:[origin],secure:false,clientId:''}),store=new MemoryStore();
  const app=createGameServer(store,{accounts,origins:[origin]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const endpoint=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}`,sockets:WebSocket[]=[];
  async function connect(auth=false){const ws=new WebSocket(endpoint,{origin,headers:auth?{Cookie:`ab_session=${session.value}`}:{}});sockets.push(ws);await once(ws,'open');return ws;}
  function send(ws:WebSocket,data:unknown,predicate:(m:any)=>boolean){
    return new Promise<any>((resolve,reject)=>{
      const timer=setTimeout(()=>{ws.off('message',receive);reject(Error('WebSocket timeout'));},5000);
      function receive(raw:WebSocket.RawData){const m=JSON.parse(raw.toString());if(predicate(m)){clearTimeout(timer);ws.off('message',receive);resolve(m);}}
      ws.on('message',receive);ws.send(JSON.stringify(data));
    });
  }
  const type=(name:string)=>(m:any)=>m.type===name;
  const create={type:'create',version:NET_VERSION,name:'Host',trackId:'costa',condition:'day',garageOnly:true,public:true};
  try{
    const host=await connect(true);
    const first=await send(host,{...create,bikeId:'brutal',loadout:{ownedBikes:['brutal'],nitro:5}},type('welcome'));
    assert.equal(first.room.garageOnly,true);assert.equal(first.room.members[0].bikeId,'ferro');assert.equal(first.room.members[0].nitro,2);
    assert.deepEqual((await store.read(first.room.code))!.members[0].ownedBikes,['ferro','veneno']);
    const rejected=await send(host,{type:'configure',round:0,bikeId:'brutal',loadout:{ownedBikes:['brutal']}},type('error'));
    assert.match(rejected.message,/garagem/);assert.equal(db.cloud(account.id).save!.nitro!.ferro,0);
    const changed=await send(host,{type:'configure',round:0,bikeId:'veneno'},m=>m.type==='state'&&m.room.members[0].bikeId==='veneno');
    assert.equal(changed.room.members[0].nitro,3);assert.equal(db.cloud(account.id).save!.nitro!.ferro,2);
    const guest=await connect();const joined=await send(guest,{type:'join',version:NET_VERSION,name:'Guest',code:first.room.code,bikeId:'brutal',loadout:{ownedBikes:['falcao'],nitro:5}},type('welcome'));
    assert.equal(joined.room.members[1].bikeId,'ferro');assert.equal(joined.room.members[1].nitro,0);
    await send(guest,{type:'configure',round:0,bikeId:'falcao'},m=>m.type==='state'&&m.room.members[1].bikeId==='falcao');
    const list=await (await fetch(endpoint.replace('ws:','http:')+'/?op=rooms')).json();assert.equal(list.rooms[0].garageOnly,true);
    host.close();await once(host,'close');const resumed=await connect(true);
    const welcome=await send(resumed,{type:'resume',version:NET_VERSION,code:first.room.code,token:first.token},type('welcome'));
    assert.equal(welcome.id,first.id);assert.equal(welcome.room.garageOnly,true);assert.equal(welcome.room.members[0].bikeId,'veneno');
    assert.match((await send(resumed,{type:'configure',round:0,bikeId:'brutal'},type('error'))).message,/garagem/);
    await send(resumed,{type:'leave'},type('left'));assert.equal(db.cloud(account.id).save!.nitro!.veneno,3);
    // A room invitation must use the same authoritative inventory as creation.
    const rejoined=await send(resumed,{type:'join',version:NET_VERSION,name:'Account',code:first.room.code,bikeId:'brutal',loadout:{ownedBikes:['brutal']}},type('welcome'));
    assert.equal(rejoined.room.members.find((m:any)=>m.id===rejoined.id).bikeId,'ferro');
    await send(resumed,{type:'leave'},type('left'));
    const free=await send(resumed,{...create,garageOnly:false,bikeId:'brutal'},type('welcome'));
    assert.equal(free.room.members[0].bikeId,'brutal');assert.equal(free.room.garageOnly,false);
    await send(resumed,{type:'leave'},type('left'));await send(guest,{type:'leave'},type('left'));
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM economy_multiplayer WHERE closed=0').get()!.n,0);
  }finally{sockets.forEach(ws=>ws.terminate());await app.close();db.close();}
});
