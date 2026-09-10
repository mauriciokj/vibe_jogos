import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {once} from 'node:events';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';import {MemoryStore} from '../server/store';import {crashRider} from '../src/game/simulation';
const folder='output/arrest-qa/online';await fs.mkdir(folder,{recursive:true});let offset=0;
const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4386','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as any).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4386/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),a=await browser.newPage({viewport:{width:1280,height:800}}),b=await browser.newPage({viewport:{width:390,height:844}}),errors:string[]=[];
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try{
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));await p.goto(base+'?test');await p.waitForFunction(()=>!!window.__game);}
 await a.click('#online-btn');await a.fill('#online-name','Prisão QA');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>!!JSON.parse(window.render_game_to_text()).online?.code);const code=(await state()).online.code;
 await b.goto(base+`?test&sala=${code}`);await b.fill('#online-name','Segue na pista');await b.click('#online-join');await b.waitForFunction(()=>!!JSON.parse(window.render_game_to_text()).online?.code);await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
 for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
 const aid=(await state()).online.id,bid=(await state(b)).online.id;
 await store.mutate(code,room=>{
  const s=room.race!;s.countdown=0;s.mode='racing';s.traffic=[];s.obstacles=[];s.policeActive=true;s.riders=s.riders.filter(r=>r.profile!=='police');
  s.riders.forEach((r,i)=>Object.assign(r,{x:r.id===aid?0:4,z:r.id===aid?2100:2500+i*80,speed:40,integrity:100,health:100,crash:0,immune:0,out:undefined,recovery:undefined}));
  const local=s.riders.find(r=>r.id===aid)!;s.riders.push({...local,id:'police',profile:'police',color:'#e7e9e5',name:'POLÍCIA',x:2.8,z:2108});crashRider(s,local,true);
 });
 await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).arrest?.phase==='arriving');const otherStart=(await state(b)).player.z;
 await b.keyboard.down('ArrowUp');await b.waitForFunction(z=>JSON.parse(window.render_game_to_text()).player.z>z+10,otherStart);await b.keyboard.up('ArrowUp');assert.equal((await state(b)).screen,'race');assert.equal((await state(b)).arrest,null);
 await a.evaluate(()=>window.advanceTime(5400));assert.equal((await state()).arrest.cuffed,true);await a.screenshot({path:folder+'/cuffed.png'});await b.screenshot({path:folder+'/still-racing.png'});
 const room=await store.read(code);assert.equal(room!.race!.multiplayer!.results[aid].reason,'caught');assert.equal(room!.race!.multiplayer!.results[bid],undefined);assert.equal(room!.phase,'racing');
 await a.click('#finish-skip');assert.match(await a.locator('.result-sub').innerText(),/30 metros/);await a.click('#online-menu-btn');await a.locator('#menu').waitFor();assert.equal((await state()).arrest,null);assert.equal((await state(b)).screen,'race');
 assert.deepEqual(errors,[]);console.log('PASS: authoritative online arrest, personal cinematic, second human and bots keep racing, result reason, leave resets scene');
}finally{await fs.writeFile(folder+'/errors.json',JSON.stringify(errors));await browser.close();await app.close();vite.kill('SIGTERM');}
