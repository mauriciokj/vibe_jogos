import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {createRace} from '../src/game/simulation';
import type {RaceCondition} from '../src/game/types';

const published=!!process.env.DIFFICULTY_CHECK_URL,base=process.env.DIFFICULTY_CHECK_URL||'http://127.0.0.1:4372/',folder='output/difficulty',prefix=published?'published':'local';await fs.mkdir(folder,{recursive:true});
const store=new MemoryStore(),app=published?null:createGameServer(store);
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4372','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']});
const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1100,height:800}}),errors:string[]=[];
for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});if(!published)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0,since:'2026-09-08T00:00:00Z'}}));}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const raw=(p=a)=>p.evaluate(()=>JSON.parse(window.__game!.snapshot()));
const shot=(name:string,p=a)=>p.screenshot({path:`${folder}/${prefix}-${name}.png`});
const leave=async(p:Page)=>{if((await state(p)).screen==='race'){await p.click('#pause-btn');await p.click('#menu-btn');}};
const save=freshSave();save.races=1;save.cash=9123;save.ownedKneePads=['gold'];save.kneePadId='gold';save.ownedHelmets=['integral','cross'];save.helmetId='cross';save.helmetColorId='red';save.raceCondition='day';
const scene=async(condition:RaceCondition)=>{
  const s=createRace('costa',save,42,condition),bot=s.riders.find(r=>r.profile==='fast')!;s.mode='racing';s.countdown=0;s.time=30;s.tick=1800;s.riders=[s.riders[0],bot];s.traffic=[];s.obstacles=[];
  Object.assign(s.riders[0],{x:1,z:1285,speed:38});Object.assign(bot,{x:-1.5,z:1305,speed:38,targetX:-1.5,decisionAt:999});
  await a.evaluate(s=>window.__game!.restore(s),JSON.stringify(s));return bot.id;
};
try{
  await a.goto(base+'?test',{waitUntil:'domcontentloaded'});await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload({waitUntil:'domcontentloaded'});await a.click('#start-btn');
  const start=await raw();assert.equal(start.riders.filter((r:any)=>r.profile!=='player'&&r.kneePadId).length,3);assert.equal(start.riders[0].kneePadId,'gold');assert.equal(start.riders[0].maxSpeed,64);assert.equal(start.riders[1].maxSpeed,73*.98);
  const botId=await scene('day');await a.evaluate(()=>window.advanceTime(150));const rival=(await raw()).riders.find((r:any)=>r.id===botId);assert.ok(rival.kneeTime>3);assert.equal(rival.kneePadId,'green');assert.ok((await state()).riders.find((r:any)=>r.id===botId).kneeSupport>.35);
  await a.keyboard.press('a');await a.waitForTimeout(60);await a.keyboard.down('a');await a.evaluate(()=>window.advanceTime(120));await a.keyboard.up('a');assert.ok((await state()).player.kneeTime>3);assert.equal((await state()).player.kneePadId,'gold');assert.equal((await state()).save.cash,9123);await shot('dry-knees');
  await a.click('#pause-btn');const frozen=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(500));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),frozen);await a.click('#resume-btn');
  await a.setViewportSize({width:390,height:844});await scene('sunset');await a.evaluate(()=>window.advanceTime(200));await shot('mobile');await a.setViewportSize({width:1440,height:900});
  await scene('rain');await a.evaluate(()=>window.advanceTime(900));assert.ok(!(await raw()).riders.find((r:any)=>r.id===botId).kneeTime);assert.equal((await state()).player.falls,0);await shot('rain-upright');
  await leave(a);const before=await a.evaluate(()=>window.__game!.save());await a.click('#online-btn');await a.selectOption('#online-track','costa:day');await a.fill('#online-name','Teste ritmo A');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  const other=published?'https://flowofdevelopment.com/asfalto-bruto/':base;await b.goto(other+`?test&sala=${code}`,{waitUntil:'domcontentloaded'});await b.fill('#online-name','Teste ritmo B');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await a.click('#online-ready');await b.click('#online-ready');for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const bid=(await state(b)).online.id;for(const p of [a,b]){const s=await raw(p);assert.equal(s.riders.length,8);assert.ok(s.riders.some((r:any)=>r.profile!=='player'&&r.kneePadId));assert.equal((await state(p)).player.bikeId,'ferro');}
  assert.equal((await state()).player.kneePadId,'gold');assert.equal((await state(b)).player.kneePadId,null);
  await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>25);await a.keyboard.up('w');await b.keyboard.up('w');
  if(app){
    await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{x:i%2?2:-2,z:1270+i*20,speed:38,targetX:i%2?2:-2,decisionAt:999,kneeTime:0,crash:0,immune:0,health:100,integrity:100}));});
    for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.kneeSupport>.35));
  }
  await shot('online');await b.reload({waitUntil:'domcontentloaded'});await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,bid);assert.ok((await raw(b)).riders.some((r:any)=>r.profile!=='player'&&r.kneePadId));
  for(const p of [a,b])await leave(p);assert.equal(await a.evaluate(()=>window.__game!.save()),before);assert.deepEqual(errors,[]);
  const report={ok:true,specialists:3,visibleKneeTechnique:true,playerGoldUnchanged:true,firstBikeUnchanged:true,rainUpright:true,mobile:true,humans:2,bots:6,sharedEquipment:true,reconnect:true,savePreserved:true,errors};await fs.writeFile(`${folder}/${prefix}.json`,JSON.stringify(report,null,2));console.log(report);
}finally{for(const p of [a,b])try{await leave(p);}catch{}await browser.close();vite?.kill('SIGTERM');await app?.close();}
