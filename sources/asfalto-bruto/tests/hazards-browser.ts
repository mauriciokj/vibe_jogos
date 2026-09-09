import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createRace} from '../src/game/simulation';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {obstacleX} from '../src/game/hazards';
import type {RaceCondition,RaceState} from '../src/game/types';

const base=process.env.PUBLIC_URL||'http://127.0.0.1:4386/',published=!!process.env.PUBLIC_URL,folder=process.env.QA_DIR||'output/hazards/local';await fs.mkdir(folder,{recursive:true});
const store=new MemoryStore(),db=published?null:new AccountsDB(':memory:');
if(db){const account=db.login('historical-qa');db.result('old-qa',account.id,'solo','costa','day','ferro',{reason:'finish',time:234,place:1,reward:0,hits:0,falls:0});db.db.prepare('UPDATE results SET rules=1').run();}
const app=db?createGameServer(store,{accounts:new AccountService({db,clientId:'',origins:[],secure:false})}):null;
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4386','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']});
const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:390,height:844}}),errors:string[]=[];
for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 if(!published)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0}}));
 await p.addInitScript(({key,save})=>{localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,save:{...freshSave(),unlocked:4,races:1}});
}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const restore=(s:RaceState,p=a)=>p.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
const advance=(ms:number,p=a)=>p.evaluate(ms=>window.advanceTime(ms),ms);
const shot=async(name:string,p=a)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
const leave=async(p:Page)=>{if((await state(p)).screen==='race'){await p.click('#pause-btn');await p.click('#menu-btn');}};
function scene(track:string,z:number,condition:RaceCondition='day',x=1.75){const s=createRace(track,undefined,811,condition);s.mode='racing';s.countdown=0;s.time=30;s.tick=1800;s.heat=0;s.riders=s.riders.slice(0,1);Object.assign(s.riders[0],{z,x,speed:40});for(const o of s.obstacles)if(o.motion)o.x=obstacleX(o,s.time);return s;}
try{
 for(const p of [a,b]){await p.goto(base+'?test',{waitUntil:'domcontentloaded'});await p.click('#start-btn');await advance(4000,p);}
 for(const condition of ['day','sunset','night','rain'] as const){
  const s=scene('serra',1975,condition);s.traffic=[];await restore(s);await shot(`tree-${condition}`);assert.equal((await state()).obstacles.find((o:any)=>o.kind==='fallenTree').width,10.5);
 }
 const jump=scene('serra',1985,'rain',-1.75);jump.traffic=[];await restore(jump);await a.keyboard.press('w');await a.keyboard.down('w');await advance(1150);assert.ok((await state()).player.jumpHeight>1.3);await shot('tree-jump');await advance(1000);await a.keyboard.up('w');assert.equal((await state()).player.falls,0);assert.equal((await state()).player.wheeliesLeft,2);
 const free=scene('serra',2005,'day',5.25);free.traffic=[];free.riders[0].wheeliesLeft=0;await restore(free);await a.keyboard.down('w');await advance(1300);await a.keyboard.up('w');assert.equal((await state()).player.falls,0);assert.ok((await state()).player.z>2040);
 const crash=scene('serra',2028,'day',-1.75);crash.traffic=[];crash.riders[0].wheeliesLeft=0;await restore(crash);await advance(700);assert.equal((await state()).player.falls,1);await shot('tree-crash');
 for(const [i,z] of [2150,3035].entries())for(const condition of ['day','rain'] as const){const s=scene('porto',z,condition,i?1.75:-1.75);await restore(s);await shot(`queue-${i}-${condition}`);const q=(await state()).traffic.filter((t:any)=>t.queued&&t.id.startsWith('port-queue-'));assert.equal(q.length,5);assert.ok(q.every((t:any)=>t.direction===(i?'oncoming':'forward')));}
 for(const kind of ['tumbleweed','armadillo'] as const){
  const s=scene('deserto',0,'sunset');s.traffic=[];const o=s.obstacles.find(o=>o.kind===kind)!;s.obstacles=[o];s.riders[0].z=o.z-12;s.riders[0].x=3.5;
  o.motion!.phase=Math.abs(o.motion!.from)/o.motion!.speed-10;s.time=10;o.x=obstacleX(o,10);await restore(s);await shot(kind);const before=(await state()).obstacles[0].x;await advance(150);assert.notEqual((await state()).obstacles[0].x,before);
  s.riders[0].z=o.z-1;s.riders[0].x=0;s.riders[0].speed=55;await restore(s);await advance(100);assert.equal((await state()).player.falls,kind==='armadillo'?1:0);await shot(`${kind}-contact`);
 }
 for(const [i,z] of [2060,3560].entries()){
  const s=scene('terra',z-32,i?'night':'day',i?-2.1:2.1);s.traffic=[];s.riders[0].wheeliesLeft=0;await restore(s);await shot(`ramp-${i}`);await a.keyboard.down('w');await advance(1000);assert.ok((await state()).player.jumpHeight>1);assert.equal((await state()).player.wheeliesLeft,0);await shot(`ramp-${i}-jump`);await advance(1000);await a.keyboard.up('w');assert.equal((await state()).player.falls,0);assert.equal((await state()).player.jumpTime,0);
 }
 for(const [name,track,z,x] of [['tree','serra',1995,1.75],['queue','porto',2150,-1.75],['ramp','terra',2030,2.1]] as const){const s=scene(track,z,'day',x);await restore(s,b);await shot(`mobile-${name}`,b);}
 await leave(a);await a.click('#ranking-btn');assert.equal(await a.locator('#rank-rules option').count(),2);const response=a.waitForResponse(r=>r.url().includes('/ranking?')&&r.url().includes('rules=1'));await a.selectOption('#rank-rules','1');const history=await (await response).json();assert.equal(history.rules,1);if(db)assert.equal(history.entries[0].time,234);await a.waitForTimeout(100);assert.ok(!(await a.locator('[data-ranking]').innerText()).includes('Não foi possível'));await shot('ranking-history');await a.locator('#ranking-modal .close-btn').click();
 let online=false;
 if(app){
  await leave(b);await a.click('#online-btn');await a.selectOption('#online-track','terra:rain');await a.fill('#online-name','QA Obstáculos A');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  await a.click('#online-ready');await b.goto(base+`?test&sala=${code}`,{waitUntil:'domcontentloaded'});await b.fill('#online-name','QA Obstáculos B');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await b.click('#online-ready');
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id;await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForTimeout(3600);
  await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=s.obstacles.filter(o=>o.id==='ramp-0');s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:i===0?2048:i===1?2020:2800+i*30,x:i===0?2.1:-2.1,speed:40,crash:0,immune:0,wheeliesLeft:0,jumpTime:0,health:100,integrity:100}));});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.jumpHeight>1,{},{timeout:5000});
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.jumpHeight>1),{},{timeout:3000});await shot('online-ramp');await shot('online-ramp-observer',b);
  await a.waitForTimeout(1000);await a.keyboard.up('w');await b.keyboard.up('w');const authority=(await store.read(code))!.race!,p=authority.riders.find(r=>r.id===aid)!;assert.equal(p.falls,0);assert.equal(p.wheeliesLeft,0);assert.equal(p.jumpTime,0);
  await b.reload({waitUntil:'domcontentloaded'});await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).player.wheeliesLeft,0);online=true;
 }
 for(const p of [a,b])await leave(p);assert.deepEqual(errors,[]);const report={ok:true,treeConditions:4,treeJump:true,freeLane:true,queues:2,desertCrossings:true,automaticRamps:true,mobile:true,online,history:true,errors};await fs.writeFile(`${folder}/report.json`,JSON.stringify(report,null,2));console.log(report);
}finally{for(const p of [a,b])try{await leave(p);}catch{}await browser.close();vite?.kill('SIGTERM');await app?.close();db?.close();}
