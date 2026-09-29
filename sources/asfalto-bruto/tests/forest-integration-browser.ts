import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { freshSave, SAVE_KEY } from '../src/game/save';
import { createRace, finishRider } from '../src/game/simulation';
import { CONDITIONS } from '../src/game/conditions';
import { forestRoad } from '../src/game/forest';
import { getTrack } from '../src/game/content';
import { recoveryCommand } from '../src/game/recovery';
import type { RaceCondition } from '../src/game/types';

const live=process.env.MATA_CHECK_URL,base=live||'http://127.0.0.1:4397/',folder=process.env.MATA_OUTPUT||'output/mata-integrated';
await fs.mkdir(folder,{recursive:true});
let offset=0;const now=()=>Date.now()+offset,store=new MemoryStore(),app=live?null:createGameServer(store,{now});
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?await createServer({server:{host:'127.0.0.1',port:4397,strictPort:true,proxy:{'/api/asfalto':{target:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`,ws:true}}}}):null;
await vite?.listen();
const browser=await chromium.launch({args:live?['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']:[]});
const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors:string[]=[];
for(const p of [a,b]){
 p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
 if(!live)await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:0}}));
}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(name:string,p=a)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
async function leave(p:Page){const s=await state(p);if(s.screen==='race'){await p.click('#pause-btn');await p.click('#menu-btn');}else if(s.online?.phase==='lobby')await p.click('#online-leave');else if(s.screen==='finish'||s.screen==='result'){if(s.screen==='finish')await p.click('#finish-skip');await p.click(s.online?'#online-menu-btn':'#result-menu-btn');}}
function scene(condition:RaceCondition,z=580){const s=createRace('mata',undefined,91,condition);s.mode='racing';s.countdown=0;s.time=30;s.tick=1800;s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:z+i*32,x:i?forestRoad(z+i*32).lanes[i%forestRoad(z+i*32).lanes.length]:0,speed:38}));s.riders[0].kneePadId='gold';return s;}
const restore=(s:ReturnType<typeof createRace>)=>a.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
async function finishRoom(code:string){await store.mutate(code,r=>{const s=r.race!;s.time=120;s.traffic=[];s.obstacles=[];for(const [i,p] of s.riders.entries()){if(p.profile==='police')continue;delete p.recovery;p.crash=0;p.mudSlip=0;p.finishedAt=120+i;p.z=7600;p.speed=0;finishRider(s,p,'finish');}s.mode='finished';r.phase='finished';r.finishedAt=now();});}
async function result(p:Page){await p.waitForFunction(()=>!!JSON.parse(window.render_game_to_text()).result);await p.evaluate(()=>window.advanceTime(6000));await p.locator('#result-modal[open]').waitFor();}
async function jumpClock(code:string){offset+=5001;await store.mutate(code,r=>r.members.forEach(m=>m.lastSeen=now()));}
try{
 await a.goto(base+'?test');await a.waitForFunction(()=>!!window.__game);assert.equal(await a.locator('[data-route]').count(),24);assert.ok(await a.locator('[data-route="mata:day"]').isDisabled());assert.match(await a.locator('#version-btn').innerText(),/1\.8\.0/);
 const save=freshSave();save.races=1;save.unlocked=4;save.records['terra:rain']={time:200,place:5};save.cash=7612;save.ownedKneePads=['gold'];save.kneePadId='gold';save.raceTrackId='mata';save.raceCondition='day';
 await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload();await a.waitForFunction(()=>!!window.__game);assert.equal((await state()).save.unlocked,5);assert.equal((await state()).save.cash,7612);await shot('menu');
 await a.click('#championship-btn');assert.equal(await a.locator('.champ-stages li').count(),6);await shot('championship');await a.click('#champ-close');
 for(const condition of CONDITIONS){
  await a.click(`[data-route="mata:${condition.id}"]`);await a.click('#start-btn');await a.evaluate(()=>window.advanceTime(3800));assert.equal((await state()).track,'mata');assert.equal((await state()).road.lanes,3);
  await restore(scene(condition.id));await a.keyboard.down('w');await a.keyboard.down('d');await a.keyboard.press('Space');await a.evaluate(()=>window.advanceTime(120));await a.keyboard.up('d');await a.keyboard.up('w');assert.ok((await state()).player.kneeSupport>.5);await shot(`knee-${condition.id}`);
  await restore(scene(condition.id,1390));assert.equal((await state()).road.lanes,2);await shot(`canopy-${condition.id}`);
  const mud=scene(condition.id,1570);mud.riders=mud.riders.slice(0,1);mud.traffic=[];mud.obstacles=[];mud.riders[0].x=2.7;await restore(mud);
  await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(200));assert.ok((await state()).player.mudSlip>.2);assert.equal((await state()).player.falls,0);await shot(`skid-${condition.id}`);
  await a.evaluate(()=>window.advanceTime(600));await a.keyboard.up('w');assert.equal((await state()).player.falls,1);await shot(`fall-${condition.id}`);
  for(let i=0;i<110 && (await state()).player.recovery;i++){const command=recoveryCommand((await state()).player);await a.evaluate(cmd=>window.__game!.command(cmd,12),command);}
  assert.equal((await state()).player.recovery,null);await a.click('#pause-btn');const frozen=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(500));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),frozen);await a.click('#restart-btn');assert.equal((await state()).track,'mata');assert.equal((await state()).condition,condition.id);await leave(a);
 }
 await a.click('[data-route="mata:day"]');await a.click('#start-btn');const end=scene('day',7598);end.traffic=[];end.obstacles=[];end.riders.forEach((r,i)=>Object.assign(r,{z:7598-i*20,immune:5}));await restore(end);await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(200));await a.keyboard.up('w');await a.click('#finish-skip');assert.equal((await state()).payout.baseReward,2700);await shot('solo-result');await a.click('#next-race-btn');assert.equal((await state()).condition,'sunset');await leave(a);
 const renderMs:Record<string,number>={};
 for(const track of ['costa','mata']){const s=track==='mata'?scene('day',1390):createRace('costa');s.mode='racing';await restore(s);renderMs[track]=await a.evaluate(()=>{for(let i=0;i<5;i++)window.advanceTime(0);const start=performance.now();for(let i=0;i<20;i++)window.advanceTime(0);return (performance.now()-start)/20;});}await leave(a);
 for(const [width,height] of [[390,844],[320,568],[844,390]]){await a.setViewportSize({width,height});await a.click('[data-route="mata:day"]');await shot(`menu-${width}`);await a.click('#start-btn');await restore(scene('day',1390));await shot(`race-${width}`);assert.ok(await a.locator('body').evaluate(e=>e.scrollWidth<=innerWidth));await leave(a);}
 await a.setViewportSize({width:1440,height:900});await a.click('#online-btn');await a.selectOption('#online-track','mata:day');await a.fill('#online-name','Mata QA A');await a.check('#online-bots');await a.uncheck('#online-public');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
 const other=live?'https://flowofdevelopment.com/asfalto-bruto/':base;await b.goto(other+`?test&sala=${code}`);await b.fill('#online-name','Mata QA B');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await shot('online-lobby-mobile',b);
 const aid=(await state()).online.id,bid=(await state(b)).online.id;
 await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.locked);if(app)await jumpClock(code);
 for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).awareness.racers.length,8);
 await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>20);await a.keyboard.up('w');await b.keyboard.up('w');await shot('online');
 if(app){
  await store.mutate(code,r=>{const s=r.race!;s.mode='racing';s.time=30;s.tick=1800;s.traffic=[];s.obstacles=[];s.heat=0;s.riders.forEach((p,i)=>{Object.assign(p,{z:p.id===aid||p.id===bid?1570:2000+i*30,x:p.id===aid?2.7:-2.1,speed:38,mudSlip:0,immune:0});});});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.falls===1);await b.waitForFunction(id=>JSON.parse(window.render_game_to_text()).riders.some((r:{id:string;recovery:unknown})=>r.id===id&&r.recovery),aid);await shot('online-mud-fall');
 }
 await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).online.id,aid);assert.equal((await state()).track,'mata');if(app)assert.equal((await state()).player.falls,1);
 if(app){
  await finishRoom(code);for(const p of [a,b])await result(p);assert.equal((await state()).payout.baseReward,2700);await shot('online-result');await a.click('#online-next-btn');await b.click('#online-next-btn');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.round===1);await jumpClock(code);
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race'&&JSON.parse(window.render_game_to_text()).condition==='sunset');assert.equal((await state()).online.code,code);
  await finishRoom(code);for(const p of [a,b])await result(p);await b.click('#online-lobby-btn');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.round===2);await a.selectOption('#lobby-track','mata:rain');await b.selectOption('#lobby-bike','falcao');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.members[1].bikeId==='falcao');await shot('configured-lobby');
 }
 for(const p of [a,b])await leave(p);
 assert.deepEqual(errors,[]);await fs.writeFile(`${folder}/report.json`,JSON.stringify({routes:24,conditions:4,migration:true,championshipStages:6,soloReward:2700,humans:2,bots:6,reconnection:true,mudAuthority:!!app,roomContinuation:!!app,renderMs,errors},null,2));console.log('PASS integrated Mata: menu/migration, four conditions, Space, mud fall/recovery, pause/restart, finish/reward, mobile, real multiplayer/reconnect'+(app?', authoritative mud and room continuation':''));
}catch(e){await shot('failure').catch(()=>{});throw e;}
finally{for(const p of [a,b])try{await leave(p);}catch{}await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await vite?.close();await app?.close();}
