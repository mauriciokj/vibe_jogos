import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {WebSocket,WebSocketServer} from 'ws';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {NET_VERSION} from '../src/multiplayer/protocol';
const folder='output/freeze';await fs.mkdir(folder,{recursive:true});
const baseline=process.env.FREEZE_BASELINE==='1';
const app=createGameServer(new MemoryStore());app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const endpoint=`ws://127.0.0.1:${(app.server.address() as {port:number}).port}`;
const relay=createServer();const bridge=new WebSocketServer({server:relay});
const links:{client:WebSocket;upstream:WebSocket;drop:'none'|'states'|'all'}[]=[];
let blackhole=false;
bridge.on('connection',client=>{
  const upstream=new WebSocket(endpoint);const link={client,upstream,drop:'none' as 'none'|'states'|'all'};links.push(link);
  const queued:string[]=[];
  client.on('message',raw=>{if(blackhole || link.drop==='all')return;const data=String(raw);if(upstream.readyState===WebSocket.OPEN)upstream.send(data);else queued.push(data);});
  upstream.on('open',()=>{if(!blackhole)queued.splice(0).forEach(data=>upstream.send(data));});
  upstream.on('message',raw=>{if(blackhole || link.drop==='all' || link.drop==='states' && JSON.parse(String(raw)).type==='state')return;if(client.readyState===WebSocket.OPEN)client.send(String(raw));});
  client.on('close',()=>upstream.close());upstream.on('close',()=>client.close());upstream.on('error',()=>client.close());
});
relay.listen(0,'127.0.0.1');await once(relay,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4380','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(relay.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4380')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(10000);
const other=new WebSocket(endpoint);await once(other,'open');const errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
let timer:ReturnType<typeof setInterval>|undefined;
try {
  await page.route('**/api/visitors*',route=>route.fulfill({json:{count:42}}));await page.goto('http://127.0.0.1:4380/?test',{waitUntil:'domcontentloaded'});
  await page.click('#online-btn');await page.check('#online-public');await page.check('#online-bots');await page.click('#online-create');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  const code=(await state()).online.code;const welcome=once(other,'message');other.send(JSON.stringify({type:'join',version:NET_VERSION,code,name:'QA Parceiro'}));await welcome;
  other.send(JSON.stringify({type:'ready',ready:true}));await page.click('#online-ready');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  let seq=0;timer=setInterval(()=>{if(other.readyState===WebSocket.OPEN)other.send(JSON.stringify({type:'input',seq:++seq,command:{throttle:1,brake:0,steer:0,attack:null}}));},50);
  await page.keyboard.down('w');await page.waitForTimeout(1200);const id=(await state()).online.id;
  if(!baseline) {
    links.at(-1)!.drop='states';await page.waitForTimeout(1100);
    assert.equal((await state()).online.syncing,true);assert.match(await page.locator('#online-hud').innerText(),/SINCRONIZANDO/);
    await page.screenshot({path:`${folder}/brief-sync.png`});links.at(-1)!.drop='none';
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.syncing===false);
    assert.equal(links.length,1,'Brief jitter must recover without replacing the socket');
  }
  links.at(-1)!.drop='states';await page.waitForTimeout(400);const frozen=(await state()).tick;
  if(baseline) {
    await page.waitForTimeout(4500);const after=await state();assert.equal(after.tick,frozen);assert.equal(after.online.status,'connected');assert.equal(links.length,1);
    await page.screenshot({path:`${folder}/before-frozen.png`});await fs.writeFile(`${folder}/before.json`,JSON.stringify({tick:frozen,afterTick:after.tick,status:after.online.status,connections:links.length,errors},null,2));
    console.log('Reproduced: race frozen for >4.5s while socket and ping remain connected.');
  } else {
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.status==='reconnecting');await page.screenshot({path:`${folder}/reconnecting.png`});
    await page.waitForFunction(t=>{const s=JSON.parse(window.render_game_to_text());return s.online?.status==='connected' && s.tick>t+60;},frozen);assert.equal((await state()).online.id,id);assert.equal(links.length,2);
    links.at(-1)!.drop='all';const tick=(await state()).tick;
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.status==='reconnecting');
    await page.waitForFunction(t=>{const s=JSON.parse(window.render_game_to_text());return s.online?.status==='connected' && s.tick>t+60;},tick);assert.equal((await state()).online.id,id);assert.equal(links.length,3);
    await page.screenshot({path:`${folder}/recovered.png`});
    blackhole=true;await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.status==='reconnecting');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.status==='offline',undefined,{timeout:20000});
    assert.match(await page.locator('#online-hud').innerText(),/CONEXÃO PERDIDA/);
    await page.keyboard.press('Escape');await page.click('#menu-btn');await page.click('#start-btn');if(await page.locator('#help-modal').isVisible())await page.click('#help-go');
    await page.keyboard.down('w');await page.evaluate(()=>window.advanceTime(7000));await page.keyboard.up('w');assert.equal((await state()).online,null);assert.ok((await state()).player.speed>10);
    await page.screenshot({path:`${folder}/solo-after-loss.png`});
    await fs.writeFile(`${folder}/recovery.json`,JSON.stringify({checks:['brief loss without reconnect','silent state loss while pings work','silent full transport loss','same identity','bounded reconnect timeout','return to solo'],connections:links.length,errors},null,2));
    console.log('✓ Silent stalls reconnect, identity preserved, prolonged loss ends retry, solo works.');
  }
  assert.deepEqual(errors,[]);
} finally {
  clearInterval(timer);other.close();await browser.close();for(const l of links){l.client.terminate();l.upstream.terminate();}await new Promise<void>(r=>bridge.close(()=>r()));await new Promise<void>(r=>relay.close(()=>r()));await app.close();vite.kill('SIGTERM');
}
