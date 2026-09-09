import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {createRace} from '../src/game/simulation';
import {CONDITIONS} from '../src/game/conditions';
import type {RaceCondition,RaceState} from '../src/game/types';

const published=!!process.env.RURAL_CHECK_URL,base=process.env.RURAL_CHECK_URL||'http://127.0.0.1:4370/',folder='output/terra',prefix=published?'published':'local';await fs.mkdir(folder,{recursive:true});
const store=new MemoryStore(),app=published?null:createGameServer(store);
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4370','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']});
const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1100,height:800}}),errors:string[]=[];
for(const p of [a,b]){
  p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  if(!published)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0,since:'2026-09-08T00:00:00Z'}}));
  await p.addInitScript(()=>{
    const probe={filters:[] as BiquadFilterNode[],gains:[] as GainNode[]};(window as any).__ruralAudio=probe;
    const Native=window.AudioContext;window.AudioContext=class extends Native {
      createBiquadFilter(){const f=super.createBiquadFilter();probe.filters.push(f);return f;}
      createGain(){const g=super.createGain();probe.gains.push(g);return g;}
    };
  });
}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const restore=(s:RaceState)=>a.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
const shot=(name:string,p=a)=>p.screenshot({path:`${folder}/${prefix}-${name}.png`});
const leave=async(p:Page)=>{if((await state(p)).screen==='race'){await p.click('#pause-btn');await p.click('#menu-btn');}};
function scene(condition:RaceCondition,z=605){
  const s=createRace('terra',undefined,8,condition);s.mode='racing';s.countdown=0;s.time=30;s.tick=1800;s.heat=0;
  s.riders.forEach((r,i)=>Object.assign(r,{z:z+i*30,x:i%2?-2.1:2.1,speed:40}));
  s.traffic=[{id:'tractor-front',kind:'tractor',x:-2.1,z:z+48,speed:-8,color:'#8d9f5c'},{id:'tractor-back',kind:'tractor',x:2.1,z:z+130,speed:8,color:'#d68549'},{id:'mirror-tractor',kind:'tractor',x:-2.1,z:z-24,speed:8,color:'#729956'}];
  return s;
}
try{
  await a.goto(base+'?test',{waitUntil:'domcontentloaded'});assert.equal(await a.locator('[data-route]').count(),20);assert.ok(await a.locator('[data-route="terra:day"]').isDisabled());
  const save=freshSave();save.races=1;save.unlocked=3;save.records['porto:rain']={time:230,place:4};save.cash=6712;save.raceTrackId='terra';save.raceCondition='day';save.ownedHelmets=['integral','cross'];save.helmetId='cross';save.helmetColorId='red';save.ownedKneePads=['gold'];save.kneePadId='gold';
  await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload({waitUntil:'domcontentloaded'});assert.equal((await state()).save.unlocked,4);assert.equal((await state()).save.cash,6712);
  await a.click('[data-route="terra:day"]');await shot('menu');
  for(const condition of CONDITIONS){
    await a.click(`[data-route="terra:${condition.id}"]`);await a.click('#start-btn');await a.evaluate(()=>window.advanceTime(3900));assert.equal((await state()).road.lanes,2);assert.equal((await state()).condition,condition.id);
    await restore(scene(condition.id));await shot(condition.id);assert.equal((await state()).traffic[0].kind,'tractor');
    await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(150));await a.keyboard.up('w');assert.ok((await state()).player.z>605);
    await a.click('#pause-btn');const paused=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(500));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),paused);
    await a.click('#restart-btn');assert.equal((await state()).track,'terra');assert.equal((await state()).condition,condition.id);await leave(a);
  }
  await a.click('[data-route="terra:day"]');await a.click('#start-btn');
  const bank=scene('day');bank.riders=bank.riders.slice(0,1);bank.traffic=[];bank.obstacles=[];Object.assign(bank.riders[0],{x:-4.1,speed:45});await restore(bank);
  await a.keyboard.down('w');await a.keyboard.down('a');await a.evaluate(()=>window.advanceTime(350));await a.keyboard.up('a');await a.keyboard.up('w');
  assert.equal((await state()).player.x,-4.2);assert.equal((await state()).player.falls,0);assert.equal((await state()).player.integrity,100);assert.ok((await state()).player.speed<45);await a.waitForTimeout(250);
  const earthAudio=await a.evaluate(()=>{const p=(window as any).__ruralAudio;return {scrape:p.gains[3].gain.value,frequency:p.filters[2].frequency.value,q:p.filters[2].Q.value};});assert.ok(earthAudio.scrape>.03);assert.ok(earthAudio.frequency<1000);assert.ok(earthAudio.q<.6);await shot('bank');
  await a.keyboard.down('d');await a.evaluate(()=>window.advanceTime(400));await a.keyboard.up('d');assert.ok((await state()).player.x>-4);await a.waitForTimeout(250);assert.ok(await a.evaluate(()=>(window as any).__ruralAudio.gains[3].gain.value<.001));
  for(const [condition,kind] of [['day','saci'],['night','boitata']] as const){const s=scene(condition,2040);s.scenicEvent={kind,z:2070,startedAt:29,duration:8};s.traffic=[];s.riders=s.riders.slice(0,1);await restore(s);assert.equal((await state()).scenic.kind,kind);await shot(kind);}
  const tractors=scene('day',2080);tractors.riders=tractors.riders.slice(0,1);tractors.traffic[0].z=2100;tractors.traffic[1].z=2111;await restore(tractors);await shot('tractors-close');
  const patches=scene('rain',1990);patches.riders=patches.riders.slice(0,1);patches.traffic=[];await restore(patches);await shot('mud');
  await a.setViewportSize({width:390,height:844});await restore(scene('sunset'));await shot('mobile-race');await leave(a);await shot('mobile-menu');
  const hero=await a.locator('.menu-main').boundingBox(),routes=await a.locator('.route-select').boundingBox();assert.ok(hero&&routes&&hero.y+hero.height<=routes.y);await a.setViewportSize({width:1440,height:900});
  const renderMs:Record<string,number>={};for(const track of ['costa','terra']){const s=track==='terra'?scene('rain'):createRace('costa',undefined,8,'rain');s.mode='racing';s.riders[0].speed=45;await restore(s);renderMs[track]=await a.evaluate(()=>{for(let i=0;i<10;i++)window.advanceTime(0);const t=performance.now();for(let i=0;i<60;i++)window.advanceTime(0);return (performance.now()-t)/60;});}await leave(a);
  const before=await a.evaluate(()=>window.__game!.save());await a.click('#online-btn');await a.selectOption('#online-track','terra:rain');await a.fill('#online-name','Teste Terra A');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  await a.click('#online-ready');await a.waitForTimeout(150);assert.equal((await state()).online.locked,false);
  const other=published?'https://flowofdevelopment.com/asfalto-bruto/':base;await b.goto(other+`?test&sala=${code}`,{waitUntil:'domcontentloaded'});await b.fill('#online-name','Teste Terra B');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await b.click('#online-ready');
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;
  for(const p of [a,b]){const s=await state(p);assert.equal(s.road.lanes,2);assert.equal(s.condition,'rain');assert.equal(s.awareness.racers.length,8);}
  await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>25);await a.keyboard.up('w');await b.keyboard.up('w');
  if(app){
    await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:i<2?590:800+i*35,x:i===0?-4.2:i===1?-2.4:2.1,speed:i<2?38:35,crash:0,immune:0,health:100,integrity:100,cooldown:0}));});
    await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.z>590);await a.keyboard.down('a');await b.keyboard.press('k');await a.waitForTimeout(300);
    const authority=(await store.read(code))!.race!;assert.ok(authority.riders.find(r=>r.id===aid)!.health<100);assert.equal(authority.riders.find(r=>r.id===aid)!.falls,0);
    for(const p of [a,b]){const s=await p.evaluate(()=>JSON.parse(window.__game!.snapshot()));for(const r of s.riders.filter((r:any)=>r.z>550&&r.z<1000))assert.ok(r.x>=-4.20001);}
    await a.keyboard.up('a');
  }
  await shot('online');await b.reload({waitUntil:'domcontentloaded'});await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,bid);assert.equal((await state(b)).track,'terra');assert.equal((await state(b)).road.lanes,2);
  for(const p of [a,b])await leave(p);assert.equal(await a.evaluate(()=>window.__game!.save()),before);
  assert.deepEqual(errors,[]);const report={ok:true,routes:20,lanes:2,conditions:4,bankContact:true,earthAudio,tractors:true,folklore:true,menuMigration:true,mobile:true,humans:2,bots:6,reconnect:true,soloPreserved:true,renderMs,errors};await fs.writeFile(`${folder}/${prefix}.json`,JSON.stringify(report,null,2));console.log(report);
}finally{for(const p of [a,b])try{await leave(p);}catch{}await browser.close();vite?.kill('SIGTERM');await app?.close();}
