import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { freshSave } from '../src/game/save';
import { NET_VERSION } from '../src/multiplayer/protocol';

test('WebSocket account binding prevents forged equipment, refunds failed joins and closes lobby reservations',async()=>{
  const db=new AccountsDB(':memory:'),origin='http://game.example',a=db.login('wire-beta'),save=freshSave();save.nitro={ferro:2};
  db.save(a.id,0,save,'trusted-wire-fixture');const session=db.session(a.id);
  const accounts=new AccountService({db,origins:[origin],secure:false,clientId:''});
  const store=new MemoryStore(),game=createGameServer(store,{accounts,origins:[origin]});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');
  const endpoint=`ws://127.0.0.1:${(game.server.address() as {port:number}).port}`,sockets:WebSocket[]=[];
  async function peer(auth=true){const ws=new WebSocket(endpoint,{origin,headers:auth?{Cookie:`ab_session=${session.value}`}:{}});sockets.push(ws);await once(ws,'open');return ws;}
  async function send(ws:WebSocket,data:unknown,type:string){
    return new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',onMessage);reject(Error('WebSocket timeout'));},4000);
      const onMessage=(raw:WebSocket.RawData)=>{const msg=JSON.parse(raw.toString());if(msg.type===type){clearTimeout(timer);ws.off('message',onMessage);resolve(msg);}};ws.on('message',onMessage);ws.send(JSON.stringify(data));});
  }
  const create={type:'create',version:NET_VERSION,name:'Piloto',trackId:'costa',condition:'day',bikeId:'brutal',loadout:{nitro:5,kneePadId:'gold',weaponId:'chain'},fillBots:true};
  try{
    const bad=await peer();await send(bad,{type:'join',version:NET_VERSION,name:'Me',code:'AAAAAA'},'error');assert.equal(db.cloud(a.id).save!.nitro!.ferro,2,'failed join refunds the reservation');
    const first=await peer(),welcome=await send(first,create,'welcome'),me=welcome.room.members[0];assert.equal(me.bikeId,'ferro');assert.equal(me.nitro,2);assert.equal(me.kneePadId,undefined);assert.equal(me.weaponId,undefined);assert.equal(db.cloud(a.id).save!.nitro!.ferro,0);
    const clone=await peer();assert.match((await send(clone,create,'error')).message,/sala/);assert.equal(db.cloud(a.id).save!.nitro!.ferro,0);
    const guest=await peer(false),gw=await send(guest,create,'welcome');assert.equal(gw.room.members[0].bikeId,'ferro');assert.equal(gw.room.members[0].nitro,0);
    await send(first,{type:'leave'},'left');assert.equal(db.cloud(a.id).save!.nitro!.ferro,2);
    const again=await send(first,create,'welcome');assert.equal(again.room.members[0].nitro,2);await send(first,{type:'leave'},'left');assert.equal(db.cloud(a.id).save!.nitro!.ferro,2);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM economy_multiplayer WHERE closed=0').get()!.n,0);
  }finally{for(const ws of sockets)ws.terminate();await game.close();db.close();}
});
