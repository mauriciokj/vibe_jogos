import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { makeRoom, makeMember, joinRoom, setReady, depart, lobbyClock, publicRoomView } from '../server/room';
import { MemoryStore } from '../server/store';
import { createGameServer } from '../server/service';
import { NET_VERSION, type ClientMessage, type ServerMessage } from '../src/multiplayer/protocol';
const at=100_000;
const lobby=(code='ABCDEF',isPublic=true,bots=false)=>makeRoom(code,'costa',makeMember('Ana',at),at,bots,'night',isPublic);
const add=(room:ReturnType<typeof lobby>,n=1)=>{for(let i=0;i<n;i++)joinRoom(room,makeMember('Piloto',at),at);};

test('public rooms wait 120s, private rooms retain 60s, bots cannot replace the second human',()=>{
  const one=lobby('000001',true,true);assert.equal(one.deadline,at+120_000);
  setReady(one,one.members[0].id,one.members[0].epoch,true,at);lobbyClock(one,at+120_001);
  assert.equal(one.phase,'lobby');assert.equal(one.deadline,null);assert.equal(one.locked,false);
  joinRoom(one,makeMember('Bia',at+130_000),at+130_000);
  assert.equal(one.deadline,at+250_000);assert.equal(one.phase,'lobby');
  const two=lobby();add(two);lobbyClock(two,at+119_999);assert.equal(two.phase,'lobby');
  lobbyClock(two,at+120_000);assert.equal(two.phase,'racing');
  const privateRoom=lobby('000002',false);assert.equal(privateRoom.deadline,at+60_000);
  add(privateRoom);lobbyClock(privateRoom,at+60_000);assert.equal(privateRoom.phase,'racing');
});
test('all ready shortens public lobby to five seconds and losing the second human resets to 120s',()=>{
  const room=lobby();add(room);
  for(const m of room.members)setReady(room,m.id,m.epoch,true,at+10_000);
  assert.equal(room.deadline,at+15_000);assert.equal(room.locked,true);
  assert.throws(()=>joinRoom(room,makeMember('Late',at+11_000),at+11_000),/fechada/);
  const second=room.members[1];depart(room,second.id,second.epoch,at+11_000,true);
  assert.equal(room.locked,false);assert.equal(room.deadline,at+131_000);assert.equal(room.phase,'lobby');
  joinRoom(room,makeMember('New',at+11_100),at+11_100);
  for(const m of room.members)setReady(room,m.id,m.epoch,true,at+12_000);
  lobbyClock(room,at+17_000);assert.equal(room.phase,'racing');
});
test('discovery contains only joinable public lobbies and no member credentials',async()=>{
  const store=new MemoryStore();const room=lobby();add(room);await store.create(room);
  const hidden=lobby('000001',false);await store.create(hidden);
  const legacy=lobby('000002');delete legacy.public;await store.create(legacy);
  const full=lobby('000003');add(full,7);await store.create(full);
  const locked=lobby('000004');add(locked);locked.locked=true;await store.create(locked);
  const racing=lobby('000005');racing.phase='racing';await store.create(racing);
  const finished=lobby('000006');finished.phase='finished';await store.create(finished);
  const empty=lobby('000007');empty.members=[];await store.create(empty);
  const disconnected=lobby('000008');disconnected.members[0].connected=false;await store.create(disconnected);
  const stale=lobby('000009');stale.members[0].lastSeen=at-15_001;await store.create(stale);
  const solo=lobby('00000A',true,true);await store.create(solo);
  const result=await store.publicRooms(at);assert.deepEqual(result.map(r=>r.code),['ABCDEF','00000A']);
  assert.deepEqual(Object.keys(result[0]).sort(),['code','trackId','condition','fillBots','players','maxPlayers','deadline'].sort());
  assert.equal(result[0].players,2);assert.equal(result[0].condition,'night');assert.equal(result[1].players,1);
  await store.mutate(full.code,r=>depart(r,r.members[1].id,r.members[1].epoch,at,true));
  assert.equal((await store.publicRooms(at))[0].code,full.code);
  room.members.forEach(m=>m.lastSeen=at+115_000);
  assert.equal(publicRoomView(room,at+115_000),null);
  assert.equal(publicRoomView({...solo,createdAt:at-30*60_000-1},at),null);
  await store.close();
});
test('concurrent joins cannot overfill a public room',async()=>{
  const store=new MemoryStore();await store.create(lobby());
  const joins=await Promise.allSettled(Array.from({length:12},()=>store.mutate('ABCDEF',r=>joinRoom(r,makeMember('Piloto',at),at))));
  assert.equal(joins.filter(r=>r.status==='fulfilled').length,7);
  assert.equal((await store.read('ABCDEF'))!.members.length,8);assert.deepEqual(await store.publicRooms(at),[]);
  await store.close();
});

test('HTTP discovery and public-only websocket join reject stale/private rooms; code invites still work',async()=>{
  let clock=Date.now();const store=new MemoryStore();const app=createGameServer(store,{now:()=>clock});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const url=`http://127.0.0.1:${(app.server.address() as {port:number}).port}/api/asfalto/`;
  const sockets:WebSocket[]=[];
  const connect=async()=>{const ws=new WebSocket(url.replace('http:','ws:'));sockets.push(ws);await once(ws,'open');return ws;};
  const send=(ws:WebSocket,data:ClientMessage)=>new Promise<ServerMessage>((resolve,reject)=>{
    const timeout=setTimeout(()=>{ws.off('message',receive);reject(new Error('message timeout'));},4000);
    function receive(raw:Buffer){const msg=JSON.parse(raw.toString()) as ServerMessage;if(msg.type==='welcome'||msg.type==='error'){clearTimeout(timeout);ws.off('message',receive);resolve(msg);}}
    ws.on('message',receive);ws.send(JSON.stringify(data));
  });
  const list=async()=>{clock+=1001;const res=await fetch(`${url}?op=rooms`);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.status,200);return res.json();};
  try {
    const host=await connect();const created=await send(host,{type:'create',version:NET_VERSION,name:'Host',trackId:'costa',public:true,fillBots:true});
    assert.equal(created.type,'welcome');if(created.type!=='welcome')return;
    assert.equal(created.room.deadline!-created.room.serverNow,120_000);assert.equal(created.room.public,true);
    const code=created.room.code;const listed=await list();assert.equal(listed.rooms[0].code,code);
    assert.ok(!JSON.stringify(listed).includes(created.token));assert.ok(!JSON.stringify(listed).includes(created.id));
    const privateHost=await connect();const privateMsg=await send(privateHost,{type:'create',version:NET_VERSION,name:'Hidden',trackId:'costa'});
    assert.equal(privateMsg.type,'welcome');if(privateMsg.type!=='welcome')return;
    const guest=await connect();
    assert.equal((await send(guest,{type:'join',version:NET_VERSION,name:'Guest',code:privateMsg.room.code,publicOnly:true})).type,'error');
    const joined=await send(guest,{type:'join',version:NET_VERSION,name:'Guest',code,publicOnly:true});assert.equal(joined.type,'welcome');
    await store.mutate(code,r=>{r.locked=true;});
    assert.deepEqual((await list()).rooms,[]);
    const late=await connect();assert.equal((await send(late,{type:'join',version:NET_VERSION,name:'Late',code,publicOnly:true})).type,'error');
    assert.equal((await send(late,{type:'join',version:NET_VERSION,name:'Friend',code:privateMsg.room.code})).type,'welcome');
    assert.equal((await fetch(`${url}?op=rooms`,{method:'POST'})).status,405);
    assert.equal((await (await fetch(`${url}?op=health`)).json()).service,'asfalto-bruto');
  } finally {sockets.forEach(s=>s.terminate());await app.close();}
});
