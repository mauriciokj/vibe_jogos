import { NET_VERSION } from '../src/multiplayer/protocol';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { RedisStore } from '../server/store';
import { createGameServer } from '../server/service';
import { makeMember, makeRoom, joinRoom } from '../server/room';

const url=process.env.ASFALTO_TEST_REDIS_URL;
if(!url)throw new Error('Defina ASFALTO_TEST_REDIS_URL para uma instância Redis de teste.');
const stores=[new RedisStore({url}),new RedisStore({url})];
const code=Math.random().toString(16).slice(2,8).toUpperCase().padEnd(6,'A');
const room=makeRoom(code,'costa',makeMember('Original',Date.now()),Date.now());await stores[0].create(room);
await Promise.all(Array.from({length:7},(_,i)=>stores[i%2].mutate(code,r=>joinRoom(r,makeMember(`Piloto ${i}`,Date.now()),Date.now()))));
const filled=await stores[1].read(code);assert.equal(filled!.members.length,8);assert.equal(new Set(filled!.members.map(m=>m.id)).size,8);assert.equal(filled!.revision,7);
await assert.rejects(()=>stores[0].mutate(code,r=>joinRoom(r,makeMember('Nono',Date.now()),Date.now())),/cheia/);
// Monotonic input sequences are enforced atomically, even across instances.
await Promise.all([stores[0].input(code,'fixture',{seq:20,at:Date.now(),command:{throttle:1,brake:0,steer:0,attack:null}}),stores[1].input(code,'fixture',{seq:2,at:Date.now(),command:{throttle:0,brake:0,steer:0,attack:null}})]);
await stores[0].mutate(code,(_r,inputs)=>assert.equal(inputs.fixture.seq,20));
// Inputs arriving with the simulation read must win atomically, retain JSON
// arrays/nulls and remain monotonic against concurrent writes from other nodes.
const inline={seq:21,at:Date.now(),command:{throttle:1,brake:0,steer:0,attack:null},attacks:[]};
await stores[0].mutate(code,(_r,inputs)=>assert.deepEqual(inputs.fixture,inline),0,{fixture:inline});
await stores[1].mutate(code,(_r,inputs)=>assert.deepEqual(inputs.fixture,inline),0,{fixture:{...inline,seq:19}});
await assert.rejects(()=>stores[0].mutate(code,()=>{throw new Error('fixture rollback');}),/fixture rollback/);
await stores[1].mutate(code,(_r,inputs)=>assert.deepEqual(inputs.fixture,inline));
let skew=0;const now=()=>Date.now()+skew;
const apps=stores.map(store=>createGameServer(store,{now}));
for(const app of apps){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const peers:WebSocket[]=[];
async function connect(index:number){const ws=new WebSocket(`ws://127.0.0.1:${(apps[index].server.address() as {port:number}).port}`);peers.push(ws);await once(ws,'open');return ws;}
async function message(ws:WebSocket,command:unknown){const promise=new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Resposta Redis expirou')),6000);const listen=(raw:Buffer)=>{const data=JSON.parse(raw.toString());if(data.type==='welcome' || data.type==='error'){clearTimeout(timer);ws.off('message',listen);resolve(data);}};ws.on('message',listen);});ws.send(JSON.stringify(command));return promise;}
try {
  await stores[0].mutate(code,r=>{r.members[0].connected=true;r.members[0].lastSeen=Date.now()-17_000;});
  const ghost=await connect(1);const expired=await message(ghost,{type:'resume',version:NET_VERSION,code,token:filled!.members[0].token});assert.equal(expired.type,'error');assert.match(expired.message,/vaga expirou/);
  const first=await connect(0);const welcome=await message(first,{type:'create',version:NET_VERSION,name:'Servidor 1',trackId:'costa'});assert.equal(welcome.type,'welcome');
  const second=await connect(1);const joined=await message(second,{type:'join',version:NET_VERSION,name:'Servidor 2',code:welcome.room.code});assert.equal(joined.type,'welcome');assert.equal(joined.room.members.length,2);
  first.send(JSON.stringify({type:'ready',ready:true}));second.send(JSON.stringify({type:'ready',ready:true}));
  async function waitRoom(predicate:(r:NonNullable<Awaited<ReturnType<RedisStore['read']>>>)=>boolean) {
    for(let i=0;i<100;i++){const r=await stores[0].read(welcome.room.code);if(r && predicate(r))return r;await new Promise(r=>setTimeout(r,30));}throw new Error('Sala Redis não avançou.');
  }
  await waitRoom(r=>r.locked);skew+=5100;await waitRoom(r=>r.phase==='racing');
  first.send(JSON.stringify({type:'input',seq:1,command:{throttle:1,brake:0,steer:0,attack:null}}));
  await waitRoom(r=>(r.race?.riders.find(p=>p.id===welcome.id)?.speed ?? 0)>0);
  first.close();await once(first,'close');await new Promise(r=>setTimeout(r,100));
  const third=await connect(1);const resumed=await message(third,{type:'resume',version:NET_VERSION,code:welcome.room.code,token:welcome.token});assert.equal(resumed.id,welcome.id);assert.equal(resumed.room.code,welcome.room.code);assert.equal(resumed.room.phase,'racing');assert.ok(resumed.room.race.tick>0);
  const snapshots=await Promise.all(stores.map(s=>s.read(welcome.room.code)));assert.deepEqual(snapshots[0]?.members,snapshots[1]?.members);
  console.log('✓ Real Redis: concurrent eight-player capacity, atomic input ordering, expired sessions, racing on two instances and reconnection across instances.');
} finally {peers.forEach(p=>p.terminate());for(const app of apps)await app.close();}
