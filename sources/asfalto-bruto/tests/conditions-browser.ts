import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { CONDITIONS } from '../src/game/conditions';
import { TRACKS } from '../src/game/content';
import { freshSave, SAVE_KEY } from '../src/game/save';

const folder='output/conditions';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4356','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4356/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1280,height:800}});
const errors:string[]=[];for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(name:string,p=a)=>p.screenshot({path:`${folder}/${name}.png`});
try{
  await a.goto(base+'?test');
  assert.equal(await a.locator('[data-route]').count(),20);assert.equal(await a.locator('[data-route]:enabled').count(),4);assert.equal(await a.locator('[data-route]:disabled').count(),16);
  const old=freshSave();delete old.raceCondition;old.cash=8040;old.unlocked=3;old.records.costa={time:156,place:2};old.races=7;
  await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:old});await a.reload();
  assert.equal((await state()).condition,'sunset');assert.equal((await state()).save.cash,8040);assert.match(await a.locator('#route-detail').innerText(),/RECORDE/);
  await a.click('[data-route="serra:night"]');await a.reload();assert.equal((await state()).track,'serra');assert.equal((await state()).condition,'night');assert.equal((await state()).save.cash,8040);await a.click('[data-route="costa:sunset"]');
  for(const track of TRACKS)for(const c of CONDITIONS){
    await a.click(`[data-route="${track.id}:${c.id}"]`);
    assert.equal((await state()).condition,c.id);assert.equal((await state()).scenic,null);
    if(track.id==='costa')await shot(`menu-${c.id}`);
    await a.click('#start-btn');assert.equal((await state()).condition,c.id);
    await a.evaluate(()=>window.advanceTime(3900));
    await a.evaluate(({condition,trackId})=>{
      const s=JSON.parse(window.__game!.snapshot());
      s.mode='racing';s.countdown=0;s.time=30;s.tick=1800;s.traffic=[];s.obstacles=[];
      s.scenicEvent=trackId==='costa'?{kind:'mermaid',z:440,startedAt:28,duration:8}:undefined;
      s.riders.forEach((r:any,i:number)=>Object.assign(r,{z:330+i*28,x:[0,2,-2,4,-4,1,-1,3][i],speed:40}));window.__game!.restore(JSON.stringify(s));
    },{condition:c.id,trackId:track.id});
    await shot(`${track.id}-${c.id}`);
    assert.match(await a.locator('#race-region').innerText(),new RegExp(c.name.toUpperCase()));
    await a.click('#pause-btn');const frozen=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(1500));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),frozen);
    await a.click('#resume-btn');await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(200));await a.keyboard.up('w');assert.ok((await state()).time>30);
    await a.click('#pause-btn');await a.click('#restart-btn');assert.equal((await state()).condition,c.id);
    await a.click('#pause-btn');await a.click('#menu-btn');
  }
  await a.click('[data-route="costa:rain"]');await a.reload();assert.equal((await state()).condition,'rain');assert.equal((await state()).save.cash,8040);
  for(const [name,width,height] of [['mobile',390,844],['small-phone',375,667],['panel',681,620],['short-panel',681,420],['landscape',844,390],['laptop',1280,720]] as const){
    await a.setViewportSize({width,height});await a.waitForTimeout(120);await shot(`menu-${name}`);
    const dock=await a.locator('.route-select').boundingBox(),hero=await a.locator('.menu-main').boundingBox();assert.ok(dock&&hero);assert.ok(dock.x>=0&&dock.x+dock.width<=width+1);assert.ok(hero.y+hero.height<=dock.y || hero.x+hero.width<=dock.x,'Menu sections must not overlap');
    const list=await a.locator('#routes').boundingBox(),selected=await a.locator('.route.selected').boundingBox();assert.ok(list&&selected&&selected.x>=list.x-1&&selected.x+selected.width<=list.x+list.width+1,'Selected route remains visible after resize');
    assert.equal(await a.locator('[data-route]').count(),20);assert.equal(await a.locator('#conditions').count(),0);
    await a.click('#routes-next');await a.waitForTimeout(400);assert.ok(await a.locator('#routes').evaluate(el=>el.scrollLeft)>0);
    await a.locator('[data-route="deserto:rain"]').click();assert.equal((await state()).track,'deserto');assert.equal((await state()).condition,'rain');
    await a.locator('[data-route="costa:rain"]').click();

  }
  await a.setViewportSize({width:1440,height:900});
  const saveBefore=await a.evaluate(()=>window.__game!.save());
  await a.click('#online-btn');assert.equal(await a.locator('#online-track').inputValue(),'costa:rain');await a.check('#online-bots');await a.fill('#online-name','Ana');await a.selectOption('#online-bike','lobo');await shot('online-create-rain');await a.click('#online-create');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;assert.match(await a.locator('#online-track-name').innerText(),/CHUVA/);await a.click('#online-ready');await a.waitForTimeout(150);assert.equal((await state()).online.locked,false);
  await b.goto(`${base}?test&sala=${code}`);await b.fill('#online-name','Bia');await b.selectOption('#online-bike','falcao');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');assert.match(await b.locator('#online-track-name').innerText(),/CHUVA/);
  await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  for(const p of [a,b]){assert.equal((await state(p)).condition,'rain');assert.equal((await state(p)).awareness.racers.length,8);}
  await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForTimeout(500);await a.keyboard.up('w');await b.keyboard.up('w');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;
  await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.scenicEvent={kind:'mermaid',z:440,startedAt:s.time,duration:8};s.riders.forEach((r,i)=>Object.assign(r,{z:i<2?330:700+i*25,x:i<2?i*1.5:2,speed:18,health:100,integrity:100,crash:0,cooldown:0,immune:0,attack:null}));});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).scenic?.kind==='mermaid');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).scenic?.kind==='mermaid');
  assert.equal((await state()).scenic.startedAt,(await state(b)).scenic.startedAt);assert.equal((await state()).scenic.z,(await state(b)).scenic.z);
  await shot('online-rain-a');await shot('online-rain-b',b);
  await a.keyboard.press('l');await a.waitForTimeout(550);const after=(await store.read(code))!;assert.ok((after.attackAck[aid]??0)>0);assert.ok(after.race!.riders.find(r=>r.id===bid)!.health<100,'Wet race combat must remain authoritative');
  await b.reload();await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,bid);assert.equal((await state(b)).condition,'rain');
  // The decorative appearance may have ended while reloading; its saved timeline must survive.
  const resumedEvent=await b.evaluate(()=>JSON.parse(window.__game!.snapshot()).scenicEvent);
  assert.equal(resumedEvent.startedAt,after.race!.scenicEvent!.startedAt);assert.equal(resumedEvent.z,after.race!.scenicEvent!.z);
  assert.equal(await a.evaluate(()=>window.__game!.save()),saveBefore);
  for(const p of [a,b]){await p.click('#pause-btn');await p.click('#menu-btn');}
  await b.close();
  // Performance uses the ordinary animation loop and keyboard, without time hooks.
  const perf:Record<string,unknown>={};
  for(const condition of ['day','night','rain']){
    await a.goto(base);await a.click(`[data-route="costa:${condition}"]`);await a.click('#start-btn');await a.keyboard.down('w');await a.waitForTimeout(4100);
    perf[condition]=await a.evaluate(`(async()=>{const times=[];let before=0;await new Promise(resolve=>{function tick(now){if(before)times.push(now-before);before=now;if(times.length>=120)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});times.sort((a,b)=>a-b);return{fps:1000/(times.reduce((a,b)=>a+b,0)/times.length),p95FrameMs:times[Math.floor(times.length*.95)]};})()`);
    await a.keyboard.up('w');await shot(`live-${condition}`);
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify({ok:true,checks:['12 visual variants','legacy save migration','persistent selection','pause and restart','responsive menu and carousel across 7 sizes','persisted track and condition','room condition shared','2 humans + 6 bots','shared decorative timeline','authoritative combat in rain','reconnection','solo save untouched by online'],perf,errors},null,2));console.log(JSON.stringify({ok:true,perf,errors}));
}finally{await browser.close();await app.close();vite.kill('SIGTERM');}
