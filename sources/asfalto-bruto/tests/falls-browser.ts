import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer,request} from 'node:http';
import {WebSocket,WebSocketServer} from 'ws';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {crashRider} from '../src/game/simulation';

const folder='output/falls-integration/online';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const port=(app.server.address() as any).port,relay=createServer((req,res)=>{const upstream=request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode!,r.headers);r.pipe(res)});req.pipe(upstream);upstream.on('error',()=>res.end());}),bridge=new WebSocketServer({server:relay});
bridge.on('connection',client=>{const upstream=new WebSocket(`ws://127.0.0.1:${port}`);const pending:string[]=[];upstream.on('open',()=>pending.splice(0).forEach(s=>upstream.send(s)));
 const forward=(to:WebSocket)=>{let due=0,i=0;return (data:unknown)=>{due=Math.max(due+1,Date.now()+[65,95,70,110][i++%4]);setTimeout(()=>{if(to.readyState===WebSocket.OPEN)to.send(String(data));else if(to===upstream&&to.readyState===WebSocket.CONNECTING)pending.push(String(data));},due-Date.now());}};
 client.on('message',forward(upstream));upstream.on('message',forward(client));client.on('close',()=>upstream.close());upstream.on('close',()=>client.close());upstream.on('error',()=>client.close());});relay.listen(0,'127.0.0.1');await once(relay,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4391','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(relay.address() as any).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4391/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),a=await browser.newPage({viewport:{width:1280,height:800}}),b=await browser.newPage({viewport:{width:390,height:844}}),errors:string[]=[];
for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:0}}));}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(name:string,p=a)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
let code='',aid='',bid='';
async function arrange(kind:'impact'|'spill',integrity=100){await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=[];s.policeActive=false;s.heat=0;s.capture=0;s.collisions={};s.riders=s.riders.filter(r=>r.profile!=='police');s.riders.forEach((r,i)=>Object.assign(r,{x:1.5,z:r.id===aid?600:r.id===bid?650:1100+i*100,speed:r.id===aid?45:0,integrity:r.id===aid?integrity:100,health:100,crash:0,recovery:undefined,immune:0,out:undefined,finishedAt:null,attack:null,cooldown:0}));crashRider(s,s.riders.find(r=>r.id===aid)!,true,kind);});await a.waitForFunction(()=>!!JSON.parse(window.render_game_to_text()).player.recovery);}
try{
 await a.goto(base+'?test');assert.equal(await a.locator('#prototype-toggle').count(),0);await a.click('#online-btn');await a.fill('#online-name','Ana');await a.selectOption('#online-track','costa:rain');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');code=(await state()).online.code;
 await b.goto(base+`?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
 for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');aid=(await state()).online.id;bid=(await state(b)).online.id;assert.equal((await state()).awareness.racers.length,8);
 for(const [kind,key] of [['impact','ArrowDown'],['spill','ArrowUp']] as const){
  await arrange(kind);await shot(`${kind}-sliding`);await b.waitForFunction(id=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.id===id&&r.recovery),aid);await shot(`${kind}-observer`,b);
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery?.phase==='walking',{},{timeout:15000});const before=(await state()).player.z,authoritativeBefore=(await store.read(code))!.race!.riders.find(r=>r.id===aid)!.z;
  // Reload a client while on foot; its session and both positions must survive.
  if(kind==='impact'){await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).online.id,aid);assert.equal((await state()).player.recovery.phase,'walking');const authoritativeAfter=(await store.read(code))!.race!.riders.find(r=>r.id===aid)!.z;assert.equal(authoritativeAfter,authoritativeBefore);assert.ok(Math.abs((await state()).player.z-authoritativeBefore)<1,'reconnected pose matches the unchanged authoritative pedestrian');}
  await a.keyboard.down(key);await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery===null,{},{timeout:20000});await a.keyboard.up(key);
  await b.waitForFunction(id=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.id===id&&!r.recovery),aid);assert.equal((await state()).result,null);assert.equal((await state()).player.z<before,kind==='impact');await shot(`${kind}-mounted`);
 }
 // A server-confirmed contact with a standing pedestrian knocks them down on both clients.
 await arrange('impact');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery?.phase==='walking');const hp=(await state()).player.health;
 await store.mutate(code,room=>{const s=room.race!,p=s.riders.find(r=>r.id===aid)!;s.traffic=[{id:'runover',kind:'car',x:p.x,z:p.z-3,speed:24,color:'#999999'}];});await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery?.hits>0);assert.ok((await state()).player.health<hp);await shot('runover');
 // A motorcycle remains solid as a ramp for the rider who is still mounted.
 await store.mutate(code,room=>{const s=room.race!,p=s.riders.find(r=>r.id===aid)!,other=s.riders.find(r=>r.id===bid)!;s.traffic=[];Object.assign(p.recovery!,{bikeX:1.5,bikeZ:other.z+3,bikeVZ:0,bikeVX:0});p.x=-5;p.z=other.z+25;Object.assign(other,{x:1.5,speed:45,immune:0,jumpTime:0,jumpTarget:undefined});});await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.jumpTime>0);assert.ok((await state(b)).player.jumpTarget.startsWith('fallen:'));await shot('fallen-bike-ramp',b);
 await arrange('impact',10);await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery?.phase==='walking');assert.equal((await state()).result,null);assert.equal((await state()).player.integrity,0);await a.keyboard.down('ArrowDown');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery?.phase==='exploding',{},{timeout:20000});await a.keyboard.up('ArrowDown');await shot('explosion');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).result?.reason==='wrecked');assert.match(await a.locator('#result-title').innerText(),/EXPLODIU/);assert.equal((await state(b)).screen,'race');await shot('destroyed');
 assert.deepEqual(errors,[]);console.log('Multiplayer passed: 2 humans + 6 CPUs, 130–220ms relay latency/jitter, both slide positions, walking both directions, reload, runover, ramp and explosion.');
}catch(error){console.log('Diagnostic',JSON.stringify({client:await state(),server:code?(await store.read(code))?.race?.riders.filter(r=>r.id===aid||r.id===bid).map(r=>({id:r.id,z:r.z,x:r.x,recovery:r.recovery,out:r.out})):null,errors}));throw error;}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();for(const ws of bridge.clients)ws.terminate();await new Promise<void>(r=>bridge.close(()=>r()));await new Promise<void>(r=>relay.close(()=>r()));await app.close();vite.kill('SIGTERM');}
