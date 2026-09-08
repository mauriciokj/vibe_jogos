import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';

const folder='output/race-tactics';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4354','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4354/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true});const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1280,height:800}});
const errors:string[]=[];for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(name:string)=>a.screenshot({path:`${folder}/${name}.png`});
try {
  await a.goto('http://127.0.0.1:4354/?test&race');await a.evaluate(()=>{
    const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.time=28;s.countdown=0;s.traffic=[];s.obstacles=[];
    s.riders.forEach((r:any,i:number)=>Object.assign(r,{z:[1270,1325,1390,1250,1220,1200,1130,1010][i],x:[0,-2,2,-3,3,0,2,-1][i],speed:i?60:64}));
    window.__game!.restore(JSON.stringify(s));
  });
  assert.equal((await state()).corner.direction,'left');assert.ok(await a.locator('#corner-warning.braking').isVisible());
  assert.ok((await state()).awareness.rear.length>=3);await shot('01-corner-and-rearview');
  for(const [name,width,height] of [['02-mobile',390,844],['03-landscape',844,390]] as const){
    await a.setViewportSize({width,height});await a.waitForTimeout(120);await shot(name);
    for(const id of ['rear-view','race-map','corner-warning']){
      const box=await a.locator(`#${id}`).boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height);
    }
  }
  await a.setViewportSize({width:1440,height:900});
  await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders[0].speed=36;window.__game!.restore(JSON.stringify(s));});
  assert.equal(await a.locator('#corner-warning').evaluate(el=>el.classList.contains('braking')),false);await shot('04-controlled-corner');
  // Position changes between periodic HUD refreshes must update both displays.
  await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.tick=5;s.riders[0].z=1500;window.__game!.restore(JSON.stringify(s));});
  assert.equal(await a.locator('.rival-entry.me > span').first().innerText(),await a.locator('#position').innerText());
  await a.goto('http://127.0.0.1:4354/?test');const save=(await state()).save;
  await a.click('#online-btn');assert.equal(await a.locator('#online-bots').isChecked(),false);await a.check('#online-bots');await a.fill('#online-name','Ana');await shot('05-bot-option');await a.click('#online-create');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  const code=(await state()).online.code;assert.equal((await state()).online.fillBots,true);await a.click('#online-ready');await a.waitForTimeout(200);assert.equal((await state()).online.locked,false);await shot('06-bot-lobby');
  await b.goto(`http://127.0.0.1:4354/?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  assert.equal((await state(b)).online.fillBots,true);await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  await Promise.all([a,b].map(p=>p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race')));
  const aid=(await state()).online.id,bid=(await state(b)).online.id;
  assert.equal((await state()).awareness.racers.length,8);assert.equal((await state()).awareness.racers.filter((r:any)=>r.bot).length,6);
  await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForTimeout(1600);await shot('07-bots-racing');
  const room=(await store.read(code))!;assert.ok(room.race!.riders.filter(r=>r.profile!=='player').every(r=>r.z>0));assert.ok(room.race!.riders.some(r=>r.profile!=='player'&&r.speed>10));
  await store.mutate(code,r=>{
    r.race!.traffic=[];r.race!.obstacles=[];r.race!.heat=0;
    r.race!.riders.forEach((p,i)=>Object.assign(p,{z:1180+(i-1)*14,x:[0,3,-3,1,-1,4,-4,2][i],speed:60,crash:0,immune:3,health:100,integrity:100}));
  });
  await a.keyboard.up('w');await a.keyboard.down('s');await a.waitForTimeout(550);await a.keyboard.up('s');
  assert.ok((await state()).player.speed<49);await a.waitForTimeout(250);
  const seen=(await state(b)).riders.find((r:any)=>r.id===aid);assert.ok(seen&&Math.abs(seen.speed-(await state()).player.speed)<4);
  await shot('08-online-braking');
  const oldId=(await state(b)).online.id;await b.reload();await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,oldId);assert.equal((await state(b)).awareness.racers.length,8);
  assert.equal((await state()).save.cash,save.cash);
  await store.mutate(code,r=>{r.race!.traffic=[];r.race!.obstacles=[];for(const p of r.race!.riders)Object.assign(p,{z:p.profile==='player'?8399.9:7800,speed:60,crash:0,immune:1});});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='finished');await shot('09-bot-results');
  assert.equal(Object.keys((await store.read(code))!.race!.multiplayer!.results).length,8);
  assert.equal((await state(b)).online.id,bid);
  await a.click('#online-menu-btn');await b.click('#online-menu-btn');await b.close();
  // Measure ordinary live racing with all eight riders and both instruments.
  await a.goto('http://127.0.0.1:4354/');await a.click('#start-btn');if(await a.locator('#help-go').isVisible())await a.click('#help-go');await a.keyboard.down('w');await a.waitForTimeout(3800);
  const perf=await a.evaluate(`(async()=>{const times=[];let before=0;await new Promise(resolve=>{function tick(now){if(before)times.push(now-before);before=now;if(times.length>=180)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});times.sort((a,b)=>a-b);return {frames:times.length,averageFPS:1000/(times.reduce((a,b)=>a+b,0)/times.length),p95FrameMs:times[Math.floor(times.length*.95)]};})()`);
  await a.keyboard.up('w');await shot('10-live-race');assert.deepEqual(errors,[]);
  await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify({checks:['desktop and two mobile orientations','overspeed and controlled corner warning','rear traffic and racers','bot option defaults off','two human requirement','six authoritative CPU racers','braking seen by both browsers','resume with bots','all results finalized','solo save preserved','ordinary live performance'],perf,errors},null,2));console.log(JSON.stringify({ok:true,perf,errors}));
} finally {await browser.close();await app.close();vite.kill('SIGTERM');}
