import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,unlockBicycle} from '../src/game/save';
import {NET_VERSION} from '../src/multiplayer/protocol';
import {EMPTY_COMMAND} from '../src/game/types';

test('two WebSocket peers see the unlocked bicycle and reliable pedal taps, without resends creating extra strokes',async()=>{
 const db=new AccountsDB(':memory:'),a=db.login('bike-wire'),save=freshSave(),origin='http://bicycle.test';
 unlockBicycle(save,{reason:'finish',onFoot:true,place:8,time:250,reward:0,hits:0,falls:1});db.save(a.id,0,save,'trusted-bike-unlock');const session=db.session(a.id);
 let offset=0;const accounts=new AccountService({db,origins:[origin],secure:false,clientId:''}),store=new MemoryStore(),game=createGameServer(store,{accounts,origins:[origin],now:()=>Date.now()+offset});
 game.server.listen(0,'127.0.0.1');await once(game.server,'listening');const endpoint=`ws://127.0.0.1:${(game.server.address() as any).port}`,sockets:WebSocket[]=[];
 const latest=new Map<WebSocket,any>();
 async function peer(auth=false){const ws=new WebSocket(endpoint,{origin,headers:auth?{Cookie:`ab_session=${session.value}`}:{}});sockets.push(ws);ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.room)latest.set(ws,m.room);});await once(ws,'open');return ws;}
 function receive(ws:WebSocket,predicate:(m:any)=>boolean,send?:any){return new Promise<any>((resolve,reject)=>{
  const timer=setTimeout(()=>{ws.off('message',handle);reject(Error('Timed out awaiting bicycle state'));},5000);
  const handle=(raw:WebSocket.RawData)=>{const m=JSON.parse(String(raw));if(m.type==='error'||predicate(m)){clearTimeout(timer);ws.off('message',handle);m.type==='error'?reject(Error(m.message)):resolve(m);}};ws.on('message',handle);if(send)ws.send(JSON.stringify(send));
 });}
 try{
  const rider=await peer(true),guest=await peer();
  const welcome=await receive(rider,m=>m.type==='welcome',{type:'create',version:NET_VERSION,name:'Ciclista',trackId:'costa',condition:'day',bikeId:'bicicleta'}),id=welcome.id;
  const second=await receive(guest,m=>m.type==='welcome',{type:'join',version:NET_VERSION,name:'Rival',code:welcome.room.code,bikeId:'bicicleta'});assert.equal(second.room.members[1].bikeId,'ferro');
  await receive(rider,m=>m.room?.members.some((p:any)=>p.id===id&&p.ready),{type:'ready',ready:true});
  await receive(guest,m=>m.room?.locked,{type:'ready',ready:true});
  const start=receive(rider,m=>m.room?.phase==='racing');offset+=5100;await start;
  for(let i=1;i<=20;i++){
   const ack=receive(rider,m=>m.room?.actionAck?.[id]>=i);rider.send(JSON.stringify({type:'input',seq:i,command:EMPTY_COMMAND,actions:[{seq:i,kind:'pedal'}]}));offset+=180;await ack;
  }
  const beforeHold=latest.get(rider).race.riders.find((r:any)=>r.id===id).speed;assert.ok(beforeHold>15&&beforeHold<=60/3.6+.01);
  const visible=latest.get(guest).race.riders.find((r:any)=>r.id===id);assert.equal(visible.bikeId,'bicicleta');assert.ok(visible.pedalPhase>=0);assert.equal(visible.wheeliesLeft,3);
  // Acknowledged strokes may be retransmitted, but cannot sustain acceleration.
  for(let i=21;i<=55;i++){
   const ack=receive(rider,m=>m.room?.ack?.[id]>=i);rider.send(JSON.stringify({type:'input',seq:i,command:{...EMPTY_COMMAND,throttle:1},actions:[{seq:20,kind:'pedal'}]}));offset+=200;await ack;
  }
  const after=latest.get(rider),coasting=after.race.riders.find((r:any)=>r.id===id);assert.equal(after.actionAck[id],20);assert.ok(coasting.speed<beforeHold-10);assert.equal(coasting.pedalTime,0);
  await receive(rider,m=>m.type==='left',{type:'leave'});await receive(guest,m=>m.type==='left',{type:'leave'});
 }finally{for(const ws of sockets)ws.terminate();await game.close();db.close();}
});
