import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { createRace } from '../src/game/simulation';

const folder='output/online';await fs.mkdir(folder,{recursive:true});
let clockOffset=0;const now=()=>Date.now()+clockOffset;
const store=new MemoryStore();const app=createGameServer(store,{now,origins:['http://127.0.0.1:4352']});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const backend=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}/api/asfalto/`;
// Each direction adds 100ms to exercise prediction, corrections and reconnects.
const relay=createServer((_req,res)=>res.end('test relay'));const bridge=new WebSocketServer({server:relay});
bridge.on('connection',client=> {
  const upstream=new WebSocket(backend);const queued:(string|Buffer)[]=[];
  upstream.on('open',()=>queued.splice(0).forEach(data=>upstream.send(data)));
  client.on('message',data=>setTimeout(()=>{if(upstream.readyState===WebSocket.OPEN)upstream.send(data.toString());else if(upstream.readyState===WebSocket.CONNECTING)queued.push(data.toString());},100));
  upstream.on('message',data=>setTimeout(()=>{if(client.readyState===WebSocket.OPEN)client.send(data.toString());},100));
  client.on('close',()=>upstream.close());upstream.on('close',()=>client.close());upstream.on('error',()=>client.close());
});
relay.listen(0,'127.0.0.1');await once(relay,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4352','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(relay.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4352/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800}});
const a=await context.newPage();const b=await browser.newPage({viewport:{width:1280,height:800}});
const errors:string[]=[];for(const page of [a,b]){page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}
const state=(page= a)=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shots=(page: typeof a,name:string)=>page.screenshot({path:`${folder}/${name}.png`});
const sockets:WebSocket[]=[];
async function socketJoin(code:string,name:string){const ws=new WebSocket(backend);sockets.push(ws);await once(ws,'open');ws.send(JSON.stringify({type:'join',version:1,code,name}));const [raw]=await once(ws,'message');const welcome=JSON.parse(raw.toString());assert.equal(welcome.type,'welcome');return ws;}
try {
  await a.goto('http://127.0.0.1:4352/?test');const offlineSave=(await state()).save;await shots(a,'01-menu');
  await a.click('#online-btn');await a.fill('#online-name','Ana');await shots(a,'02-online-form');await a.click('#online-create');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  await shots(a,'03-one-player');assert.equal(await a.locator('#online-count').innerText(),'1 / 8 PILOTOS');
  await a.click('#online-ready');await a.waitForTimeout(250);assert.equal((await state()).online.locked,false);
  await b.goto(`http://127.0.0.1:4352/?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  for(let i=0;i<6;i++)await socketJoin(code,`Amigo ${i+1}`);
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.members.filter((m:{connected:boolean})=>m.connected).length===8);await shots(a,'04-eight-players');
  await a.setViewportSize({width:390,height:844});await shots(a,'05-mobile-lobby');assert.ok(await a.locator('#online-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await a.setViewportSize({width:1280,height:800});
  for(const ws of sockets)ws.send(JSON.stringify({type:'ready',ready:true}));await b.click('#online-ready');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);await shots(a,'06-five-seconds');
  const before=(await state()).online;assert.ok(before.deadline-before.serverNow<=5100);clockOffset+=5001;
  await Promise.all([a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race'),b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race')]);
  const aid=(await state()).online.id,bid=(await state(b)).online.id;assert.notEqual(aid,bid);
  await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForTimeout(2300);assert.ok((await state()).player.speed>15);assert.ok((await state(b)).player.speed>15);
  await shots(a,'07-racing-ana');await shots(b,'08-racing-bia');
  await a.keyboard.press('Escape');const time=(await state(b)).time;await a.waitForTimeout(300);assert.ok((await state(b)).time>time);assert.ok(await a.locator('#pause-modal').innerText().then(t=>t.includes('continua')));await a.click('#resume-btn');
  await a.keyboard.up('w');await b.keyboard.up('w');await a.waitForTimeout(300);
  await store.mutate(code,r=> {
    const s=r.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.policeActive=false;s.riders=s.riders.filter(p=>p.profile!=='police');
    for(const p of s.riders)Object.assign(p,{z:3000,x:5,speed:0,health:100,integrity:100,immune:0,crash:0,attack:null,cooldown:0});
    Object.assign(s.riders.find(p=>p.id===aid)!,{z:1000,x:1,weapon:false});Object.assign(s.riders.find(p=>p.id===bid)!,{z:1000,x:2.8,weapon:true});
  });
  await a.waitForFunction(()=>Math.abs(JSON.parse(window.render_game_to_text()).player.z-1000)<2);await a.waitForTimeout(250);
  await a.keyboard.down('j');await a.waitForTimeout(190);await a.keyboard.up('j');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.weapon===true);
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.weapon===false);assert.ok((await state(b)).player.health<95);await shots(a,'09-network-punch');
  // Reload resumes the same server-controlled rider, rather than creating a new one.
  const oldPosition=(await state(b)).player.z;await b.reload();await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,bid);assert.ok(Math.abs((await state(b)).player.z-oldPosition)<15);await shots(b,'10-reconnected');
  await store.mutate(code,r=> {
    const s=r.race!;s.policeActive=true;s.heat=0;
    Object.assign(s.riders.find(p=>p.id===aid)!,{z:1700,x:1,speed:64,health:100,integrity:100,immune:0,crash:0,cooldown:0,attack:null});
    Object.assign(s.riders.find(p=>p.id===bid)!,{z:1800,x:-1,speed:35,health:100,integrity:100,immune:0,crash:0});
    const cop={...createRace().riders[1],id:'police',name:'POLÍCIA',profile:'police' as const,z:1680,x:-1,speed:30,cooldown:100};s.riders.push(cop);
    s.traffic=[{id:'crash-car',x:1,z:1702,speed:-20,color:'#ddd',kind:'car'}];
  });
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).result?.reason==='caught');assert.equal((await state()).result.arrestCause,'fall');assert.equal((await state(b)).screen,'race');assert.equal(await a.locator('#crash').isVisible(),false);await shots(a,'11-arrest-only-ana');
  await store.mutate(code,r=>{r.race!.traffic=[];r.race!.riders=r.race!.riders.filter(p=>p.profile!=='police');for(const p of r.race!.riders)if(!p.out)Object.assign(p,{z:8399.9,speed:60,x:0,crash:0,immune:1});});
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).result?.reason==='finish');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='finished');await shots(b,'12-online-result');assert.equal((await state()).save.cash,offlineSave.cash);
  await a.click('#online-menu-btn');assert.equal((await state()).online,null);await a.click('#start-btn');await a.click('#help-go');await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(9000));await a.keyboard.up('w');assert.ok((await state()).player.speed>35);assert.equal((await state()).online,null);await shots(a,'13-solo-after-online');
  assert.deepEqual(errors,[]);await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify({latencyEachDirectionMs:100,participants:8,checks:['optional solo','one-player waiting','eight-player room','five-second ready','independent cameras','input synchronization','online pause','combat and weapon theft','reload reconnection','individual arrest','individual finish','solo save preserved','solo after online'],errors},null,2));
  console.log('✓ Online browser: 8 players, 200ms round-trip relay, lobby/ready, cameras, combat, reconnect, arrest/results and solo save preserved. No console errors.');
} finally {
  sockets.forEach(ws=>ws.terminate());await browser.close();for(const ws of bridge.clients)ws.terminate();await new Promise<void>(resolve=>bridge.close(()=>resolve()));await new Promise<void>(resolve=>relay.close(()=>resolve()));await app.close();vite.kill('SIGTERM');
}
