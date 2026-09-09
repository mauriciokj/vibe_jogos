import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { CONDITIONS, advanceScenicEvent } from '../src/game/conditions';
import { BIKES } from '../src/game/content';
import { createRace } from '../src/game/simulation';
import { freshSave, SAVE_KEY } from '../src/game/save';

const folder='output/porto';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4362','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4362/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1280,height:800}});
const errors:string[]=[];for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(name:string,p=a)=>p.screenshot({path:`${folder}/${name}.png`});
try {
  await a.goto(base+'?test');assert.equal(await a.locator('[data-route]').count(),20);assert.equal(await a.locator('[data-route]:enabled').count(),4);
  const save=freshSave();save.races=1;save.unlocked=2;save.records['deserto:rain']={time:280,place:4};save.cash=9999;
  await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload();assert.equal((await state()).save.unlocked,3);
  await a.click('#garage-btn');for(const bike of BIKES.filter(b=>b.price>0)){const card=a.locator(`[data-bike="${bike.id}"]`);assert.match(await card.innerText(),new RegExp(bike.price.toLocaleString('pt-BR').replace('.','\\.')));assert.ok(await card.isDisabled());}await shot('garage-prices');await a.keyboard.press('Escape');
  for(const condition of CONDITIONS){
    await a.click(`[data-route="porto:${condition.id}"]`);await a.click('#start-btn');await a.evaluate(()=>window.advanceTime(3900));assert.equal((await state()).track,'porto');assert.equal((await state()).condition,condition.id);
    const s=createRace('porto',undefined,7,condition.id);s.mode='racing';s.time=30;s.tick=1800;s.countdown=0;
    s.riders.forEach((r,i)=>Object.assign(r,{z:2180+i*28,x:[1,3,-5,4,-4,1,-1,3][i],speed:40}));
    s.traffic[0].z=2220;s.traffic[1].z=2245;s.traffic[2].z=2340;
    await a.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));await shot(`works-${condition.id}`);assert.match(await a.locator('#corner-title').innerText(),/OBRAS/);
    await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(250));await a.keyboard.up('w');assert.ok((await state()).player.z>2180);
    await a.click('#pause-btn');const paused=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(500));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),paused);
    await a.click('#restart-btn');assert.equal((await state()).track,'porto');assert.equal((await state()).condition,condition.id);await a.click('#pause-btn');await a.click('#menu-btn');
  }
  let seed=0;while(createRace('porto',undefined,seed).scenicEvent?.kind!=='truckPassenger')seed++;
  const scenic=createRace('porto',undefined,seed,'day');scenic.mode='racing';scenic.time=40;scenic.tick=2400;
  const event=scenic.scenicEvent!;assert.equal(event.kind,'truckPassenger');if(event.kind!=='truckPassenger')throw Error('event');
  const truck=scenic.traffic.find(t=>t.id===event.trafficId)!;truck.z=5320;scenic.riders.forEach((r,i)=>Object.assign(r,{z:5290+i*65,x:i?5:1.7,speed:32}));advanceScenicEvent(scenic);
  await a.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(scenic));await shot('passenger');assert.equal((await state()).scenic.trafficId,truck.id);
  // Same rendering workload and viewport for the baseline and expansion.
  const renderMs:Record<string,number>={};for(const track of ['costa','porto']){
    const s=createRace(track,undefined,7,'rain');s.mode='racing';s.riders[0].z=2180;s.riders[0].speed=45;await a.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
    renderMs[track]=await a.evaluate(()=>{for(let i=0;i<12;i++)window.advanceTime(0);const start=performance.now();for(let i=0;i<80;i++)window.advanceTime(0);return (performance.now()-start)/80;});
  }
  await a.click('#pause-btn');await a.click('#menu-btn');await a.click('[data-route="porto:rain"]');await a.reload();assert.equal((await state()).track,'porto');
  await a.setViewportSize({width:390,height:844});await shot('mobile-menu');const hero=await a.locator('.menu-main').boundingBox(),dock=await a.locator('.route-select').boundingBox();assert.ok(hero&&dock&&hero.y+hero.height<=dock.y);
  await a.click('#start-btn');await a.evaluate(()=>window.advanceTime(3900));await shot('mobile-race');await a.click('#pause-btn');await a.click('#menu-btn');await a.setViewportSize({width:1440,height:900});
  const before=await a.evaluate(()=>window.__game!.save());await a.click('#online-btn');assert.equal(await a.locator('#online-track').inputValue(),'porto:rain');await a.check('#online-bots');await a.fill('#online-name','Ana');await a.selectOption('#online-bike','lobo');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  const code=(await state()).online.code;await a.click('#online-ready');await a.waitForTimeout(150);assert.equal((await state()).online.locked,false);
  await b.goto(base+`?test&sala=${code}`);await b.fill('#online-name','Bia');await b.selectOption('#online-bike','falcao');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;
  for(const p of [a,b]){const s=await state(p);assert.equal(s.track,'porto');assert.equal(s.condition,'rain');assert.equal(s.awareness.racers.length,8);}
  await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForTimeout(1100);await a.keyboard.up('w');await b.keyboard.up('w');
  await store.mutate(code,room=>{const s=room.race!;s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:i<2?2180:2450+i*30,x:i<2?i*1.5:5,speed:20,crash:0,immune:0,cooldown:0,health:100,integrity:100}));const t=s.traffic.find(t=>t.kind==='truck'&&t.speed<0)!;t.z=2320;s.scenicEvent={kind:'truckPassenger',trafficId:t.id,z:t.z,startedAt:s.time,duration:8};});
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).scenic?.kind==='truckPassenger');
  assert.equal((await state()).scenic.startedAt,(await state(b)).scenic.startedAt);await a.keyboard.press('l');await a.waitForTimeout(550);const after=(await store.read(code))!;assert.ok((after.attackAck[aid]??0)>0);assert.ok(after.race!.riders.find(r=>r.id===bid)!.health<100);
  await shot('online-rain');await b.reload();await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,bid);assert.equal((await state(b)).track,'porto');assert.equal((await state(b)).condition,'rain');
  const restored=await b.evaluate(()=>JSON.parse(window.__game!.snapshot()));assert.equal(restored.scenicEvent.startedAt,after.race!.scenicEvent!.startedAt);
  for(const p of [a,b]){await p.click('#pause-btn');await p.click('#menu-btn');}assert.equal(await a.evaluate(()=>window.__game!.save()),before);assert.deepEqual(errors,[]);
  const report={ok:true,checks:['new prices in real garage','20 routes and save migration','4 conditions / works / traffic / restart','rare passenger on actual truck','mobile menu and gameplay','2 humans + 6 bots / rain / combat / reconnect / solo preserved'],renderMs,errors};await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify(report,null,2));console.log(report);
} finally {await browser.close();vite.kill('SIGTERM');await app.close();}
