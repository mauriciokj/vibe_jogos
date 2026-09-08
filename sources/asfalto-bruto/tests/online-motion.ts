import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { type AttackKind } from '../src/game/types';

const folder='output/online-motion';await fs.mkdir(folder,{recursive:true});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
class DelayedStore extends MemoryStore {
  override async mutate(...args:Parameters<MemoryStore['mutate']>) {await wait(65);return super.mutate(...args);}
}
let offset=0;const store=new DelayedStore();const app=createGameServer(store,{now:()=>Date.now()+offset});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const backend=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}`;
const relay=createServer();const bridge=new WebSocketServer({server:relay});
bridge.on('connection',client=>{
  const upstream=new WebSocket(backend);const pending:string[]=[];
  upstream.on('open',()=>pending.splice(0).forEach(s=>upstream.send(s)));
  function forward(destination:WebSocket){let due=0,index=0;return(data:unknown)=>{
    // Jitter without reordering a WebSocket's reliable stream.
    due=Math.max(due+1,Date.now()+[80,140,95,170,65][index++%5]);
    setTimeout(()=>{if(destination.readyState===WebSocket.OPEN)destination.send(String(data));else if(destination===upstream && destination.readyState===WebSocket.CONNECTING)pending.push(String(data));},due-Date.now());
  };}
  client.on('message',forward(upstream));upstream.on('message',forward(client));
  client.on('close',()=>upstream.close());upstream.on('close',()=>client.close());upstream.on('error',()=>client.close());
});
relay.listen(0,'127.0.0.1');await once(relay,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4353','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(relay.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4353/')).ok)break;}catch{}await wait(100);}
const browser=await chromium.launch({headless:true});const a=await browser.newPage({viewport:{width:1280,height:800}}),b=await browser.newPage({viewport:{width:1280,height:800}});
const errors:string[]=[];for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try {
  await a.goto('http://127.0.0.1:4353/?test');await a.click('#online-btn');await a.fill('#online-name','Ana');await a.click('#online-create');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  await b.goto(`http://127.0.0.1:4353/?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await a.click('#online-ready');await b.click('#online-ready');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race')));
  const aid=(await state()).online.id,bid=(await state(b)).online.id;
  await a.keyboard.down('w');await b.keyboard.down('w');
  async function arrange(kind?:AttackKind) {
    await store.mutate(code,r=>{
      r.race!.traffic=[];r.race!.obstacles=[];r.race!.policeActive=false;r.race!.heat=0;r.race!.riders=r.race!.riders.filter(p=>p.profile!=='police');
      for(const p of r.race!.riders)Object.assign(p,{z:50,x:p.id===aid?1:2.8,speed:62,health:100,immune:0,crash:0,integrity:100,cooldown:0,attack:null,weapon:kind==='punch'?p.id===bid:true});
    });await wait(700);
  }
  await arrange();
  const samples:any[]=await a.evaluate(`new Promise(resolve=>{
    const samples=[],start=performance.now();function sample(){const s=JSON.parse(window.render_game_to_text());samples.push({at:performance.now(),z:s.player.z,x:s.player.x,speed:s.player.speed,dz:s.riders[0]?.dz,otherX:s.riders[0]?.x,tick:s.tick});if(performance.now()-start<4500)requestAnimationFrame(sample);else resolve(samples);}requestAnimationFrame(sample);
  })`);
  const dz=samples.map(s=>s.dz as number);const minimumAdvance=Math.min(...samples.slice(1).map((s,i)=>s.z-samples[i].z));
  const maxGapJump=Math.max(...samples.slice(1).map((s,i)=>Math.abs(s.dz-samples[i].dz)));
  await a.screenshot({path:`${folder}/moving.png`});
  await a.keyboard.down('a');await wait(500);await a.keyboard.up('a');await wait(600);
  const left=(await state()).player.x;
  assert.ok(left<-.8,'Steering responds while travelling at full speed');
  assert.ok(Math.abs(left-(await state(b)).riders.find((p:{id:string})=>p.id===aid).x)<.6,'The other browser sees the same lane');
  await a.keyboard.down('d');await wait(500);await a.keyboard.up('d');await wait(600);
  assert.ok((await state()).player.x>left+2,'Changing direction reaches the server');
  const attacks=[];
  for(const [kind,key] of [['punch','j'],['kick','k'],['weapon','l']] as const){
    await arrange(kind);const hits=(await store.read(code))!.race!.riders.find(p=>p.id===aid)!.hits;
    await a.keyboard.press(key,{delay:5});await wait(40);
    assert.equal((await state()).player.attack?.kind,kind,'The local swing must animate before the network round trip');
    await wait(80);await a.screenshot({path:`${folder}/${kind}.png`});
    await wait(1000);const r=(await store.read(code))!.race!;const source=r.riders.find(p=>p.id===aid)!,target=r.riders.find(p=>p.id===bid)!;
    attacks.push({kind,hits:source.hits-hits,health:target.health,stolen:kind==='punch'?source.weapon&&!target.weapon:undefined});
  }
  await arrange('punch');await a.setViewportSize({width:390,height:844});
  const touchHits=(await store.read(code))!.race!.riders.find(p=>p.id===aid)!.hits;
  await a.locator('[data-touch="KeyJ"]').click({delay:5});await wait(130);
  await a.screenshot({path:`${folder}/mobile-punch.png`});await wait(1000);
  assert.equal((await store.read(code))!.race!.riders.find(p=>p.id===aid)!.hits-touchHits,1,'The on-screen attack button also preserves a short tap');
  const result={minimumAdvance,maxGapJump,gapRange:Math.max(...dz)-Math.min(...dz),attacks,errors};
  await fs.writeFile(`${folder}/motion-check.json`,JSON.stringify(result,null,2));await fs.writeFile(`${folder}/samples.json`,JSON.stringify(samples));console.log(result);
  assert.ok(minimumAdvance>=-.15,'An advancing bike must not snap backward');assert.ok(maxGapJump<.65,'Rivals must not jump past the local rider on snapshots');
  for(const attack of attacks){assert.equal(attack.hits,1,`${attack.kind}: a 5ms tap must produce exactly one hit`);assert.ok(attack.health<95);if(attack.kind==='punch')assert.equal(attack.stolen,true);}
  assert.deepEqual(errors,[]);console.log('✓ Moving multiplayer: jitter, delayed storage, smooth positions and single-tap punch/kick/weapon hits.');
} finally {
  await browser.close();for(const ws of bridge.clients)ws.terminate();await new Promise<void>(resolve=>bridge.close(()=>resolve()));await new Promise<void>(resolve=>relay.close(()=>resolve()));await app.close();vite.kill('SIGTERM');
}
