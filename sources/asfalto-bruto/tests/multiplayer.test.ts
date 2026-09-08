import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { makeMember, makeRoom, joinRoom, lobbyClock, setReady, depart, pulseRoom, inputKey, viewRoom } from '../server/room';
import { MemoryStore } from '../server/store';
import { createGameServer } from '../server/service';
import { createMultiplayerRace, createRace, stepRace, policeTarget, STEP } from '../src/game/simulation';
import { NET_VERSION, cleanCommand, cleanName, type ServerMessage, type ClientMessage } from '../src/multiplayer/protocol';
import { EMPTY_COMMAND } from '../src/game/types';

const at=100_000;
function lobby(count=2) {
  const room=makeRoom('ABCDEF','costa',makeMember('Ana',at),at);
  for(let i=1;i<count;i++)joinRoom(room,makeMember(`Piloto ${i+1}`,at),at);
  return room;
}
test('lobby waits 60 seconds, requires two humans and shortens to five only when everyone is ready',()=> {
  const room=lobby();assert.equal(room.deadline,at+60_000);
  setReady(room,room.members[0].id,room.members[0].epoch,true,at+1000);assert.equal(room.deadline,at+60_000);assert.equal(room.locked,false);
  setReady(room,room.members[1].id,room.members[1].epoch,true,at+2000);assert.equal(room.deadline,at+7000);assert.equal(room.locked,true);
  lobbyClock(room,at+6999);assert.equal(room.phase,'lobby');lobbyClock(room,at+7000);assert.equal(room.phase,'racing');assert.equal(room.race!.countdown,0);assert.equal(room.race!.riders.length,2);
});
test('one ready player cannot start; expired empty wait restarts when a second arrives',()=> {
  const room=lobby(1),p=room.members[0];setReady(room,p.id,p.epoch,true,at+1000);lobbyClock(room,at+60_001);assert.equal(room.phase,'lobby');assert.equal(room.deadline,null);
  joinRoom(room,makeMember('Bia',at+61_000),at+61_000);assert.equal(room.deadline,at+121_000);assert.equal(room.phase,'lobby');
});
test('60-second expiry starts without ready votes, closes last five seconds and enforces eight slots',()=> {
  const room=lobby(8);assert.throws(()=>joinRoom(room,makeMember('Nona',at),at),/cheia/);
  lobbyClock(room,at+55_000);assert.equal(room.locked,true);assert.throws(()=>joinRoom(room,makeMember('Tarde',at),at+55_001),/fechada/);
  lobbyClock(room,at+60_000);assert.equal(room.phase,'racing');assert.equal(room.race!.multiplayer!.humanIds.length,8);
});
test('departure cancels a two-person final countdown and the remaining player never starts alone',()=> {
  const room=lobby();for(const p of room.members)setReady(room,p.id,p.epoch,true,at);
  depart(room,room.members[1].id,room.members[1].epoch,at+1000,true);assert.equal(room.locked,false);assert.equal(room.deadline,at+61_000);
  lobbyClock(room,at+70_000);assert.equal(room.phase,'lobby');assert.equal(room.race,null);
});
test('new joins do not extend the original wait; readiness cannot extend an imminent start',()=> {
  const room=lobby(2);joinRoom(room,makeMember('Terceiro',at+20_000),at+20_000);assert.equal(room.deadline,at+60_000);
  for(const p of room.members)setReady(room,p.id,p.epoch,true,at+58_000);
  assert.equal(room.deadline,at+60_000);
});
test('multiplayer arrest loses only that rider and police select whoever is nearby',()=> {
  const s=createMultiplayerRace('costa',[{id:'a',name:'Ana'},{id:'b',name:'Bia'}]);s.mode='racing';s.traffic=[];s.obstacles=[];
  const [a,b]=s.riders;Object.assign(a,{x:1,z:1500,crash:1});Object.assign(b,{x:-1,z:1650,speed:30});
  const police={...createRace().riders[1],id:'police',profile:'police' as const,x:2,z:1510,speed:20,cooldown:100};s.riders.push(police);
  assert.equal(policeTarget(s,police)?.id,'a');stepRace(s,{a:EMPTY_COMMAND,b:{...EMPTY_COMMAND,throttle:1}});
  assert.equal(s.multiplayer!.results.a.reason,'caught');assert.equal(s.multiplayer!.results.a.arrestCause,'fall');assert.equal(s.multiplayer!.results.b,undefined);assert.equal(s.mode,'racing');assert.ok(b.z>1650);
  assert.equal(policeTarget(s,police)?.id,'b');
});
test('police target selection has no human preference and ignores eliminated/finished racers',()=> {
  const s=createRace(),p=s.riders[0],bot=s.riders[1];p.z=1000;bot.z=10;bot.x=2;
  const police={...s.riders[2],id:'police',profile:'police' as const,z:9,x:2};s.riders=[p,bot,police];
  assert.equal(policeTarget(s,police)?.id,bot.id);bot.out='caught';assert.equal(policeTarget(s,police)?.id,p.id);p.finishedAt=5;assert.equal(policeTarget(s,police),undefined);
});
test('simultaneous finishes have independent correct places and a wreck cannot end everyone else’s race',()=> {
  const s=createMultiplayerRace('costa',[{id:'a',name:'Ana'},{id:'b',name:'Bia'},{id:'c',name:'Caio'}]);s.mode='racing';s.traffic=[];s.obstacles=[];
  Object.assign(s.riders[0],{z:8399.4,speed:60});Object.assign(s.riders[1],{z:8399.7,speed:60});s.riders[2].integrity=0;
  stepRace(s,{a:EMPTY_COMMAND,b:EMPTY_COMMAND,c:EMPTY_COMMAND});assert.equal(s.multiplayer!.results.b.place,1);assert.equal(s.multiplayer!.results.a.place,2);assert.equal(s.multiplayer!.results.c.reason,'wrecked');assert.equal(s.mode,'finished');assert.equal(s.result,null);
});
test('server wall clock and stale-input braking bound movement independently of client sequence',()=> {
  const room=lobby();lobbyClock(room,at+60_000);const p=room.members[0];
  const cmd={seq:9_000_000,at:at+60_100,command:{...EMPTY_COMMAND,throttle:1}};
  pulseRoom(room,{[inputKey(p)]:cmd},at+60_000);assert.equal(room.ack[p.id],undefined,'Do not acknowledge input before a simulation tick applies it');
  pulseRoom(room,{[inputKey(p)]:cmd},at+60_100);assert.equal(room.race!.tick,6);assert.ok(room.race!.riders[0].z<.1);
  room.race!.riders[0].speed=50;const z=room.race!.riders[0].z;room.members.forEach(m=>{m.connected=true;m.lastSeen=at+61_000;});
  pulseRoom(room,{[inputKey(p)]:cmd},at+61_000);assert.ok(room.race!.riders[0].speed<40);assert.ok(room.race!.riders[0].z-z<50);
});
test('room snapshots exclude session credentials and inputs reject invalid numbers and attacks',()=> {
  const room=lobby();const view=JSON.stringify(viewRoom(room,at));for(const p of room.members){assert.ok(!view.includes(p.token));assert.ok(!view.includes(p.epoch));}
  assert.equal(cleanCommand({...EMPTY_COMMAND,steer:NaN}),null);assert.equal(cleanCommand({...EMPTY_COMMAND,attack:'cheat'}),null);
  assert.deepEqual(cleanCommand({throttle:999,brake:-1,steer:-99,attack:'punch'}),{throttle:1,brake:0,steer:-1,attack:'punch'});
  assert.ok(!cleanName('<img src=x onerror=alert(1)>').includes('<'));
});

class TestPeer {
  ws: WebSocket; messages: ServerMessage[]=[];
  constructor(url: string) {this.ws=new WebSocket(url);this.ws.on('message',raw=>this.messages.push(JSON.parse(raw.toString())));}
  send(data: ClientMessage) {this.ws.send(JSON.stringify(data));}
  async wait(predicate: (message: ServerMessage)=>boolean,timeout=5000) {
    const until=Date.now()+timeout;
    while(Date.now()<until){const found=this.messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,15));}
    throw new Error('Expected socket message did not arrive: '+JSON.stringify(this.messages.slice(-2)));
  }
}
test('real sockets: eight joins, ninth rejection, ready start, authoritative inputs, resume and leaving',async()=> {
  let clock=at;const store=new MemoryStore();const app=createGameServer(store,{now:()=>clock});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const url=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}/api/asfalto`;const clients:TestPeer[]=[];
  const connect=async()=>{const p=new TestPeer(url);clients.push(p);await once(p.ws,'open');return p;};
  try {
    const owner=await connect();owner.send({type:'create',version:NET_VERSION,name:'Ana',trackId:'costa'});
    const welcome=await owner.wait(m=>m.type==='welcome');assert.equal(welcome.type,'welcome');if(welcome.type!=='welcome')return;
    const code=welcome.room.code;
    for(let i=1;i<8;i++){const p=await connect();p.send({type:'join',version:NET_VERSION,name:`Piloto ${i}`,code});await p.wait(m=>m.type==='welcome');}
    const ninth=await connect();ninth.send({type:'join',version:NET_VERSION,name:'Nona',code});const rejected=await ninth.wait(m=>m.type==='error');assert.ok(rejected.type==='error' && rejected.message.includes('cheia'));
    clients.slice(0,8).forEach(p=>p.send({type:'ready',ready:true}));await owner.wait(m=>m.type==='state' && m.room.locked);
    clock+=5001;await owner.wait(m=>m.type==='state' && m.room.phase==='racing');
    owner.send({type:'input',seq:12,command:{...EMPTY_COMMAND,throttle:1}});await new Promise(r=>setTimeout(r,80));clock+=100;
    await owner.wait(m=>m.type==='state' && m.room.ack[welcome.id]===12 && (m.room.race?.tick ?? 0)>0);
    const before=await store.read(code);assert.ok(before!.race!.riders.find(r=>r.id===welcome.id)!.speed>0);
    owner.ws.close();await once(owner.ws,'close');await new Promise(r=>setTimeout(r,60));clock+=100;
    const resume=await connect();resume.send({type:'resume',version:NET_VERSION,code,token:welcome.token});const resumed=await resume.wait(m=>m.type==='welcome');assert.ok(resumed.type==='welcome' && resumed.id===welcome.id);
    resume.send({type:'leave'});await resume.wait(m=>m.type==='left');const after=await store.read(code);assert.equal(after!.race!.multiplayer!.results[welcome.id].reason,'left');assert.equal(after!.race!.mode,'racing');
  } finally {clients.forEach(p=>p.ws.terminate());await app.close();}
});
