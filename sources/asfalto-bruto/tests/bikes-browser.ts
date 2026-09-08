import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {BIKES,getBike} from '../src/game/content';
const folder='output/bike-roster';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4355','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4355/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1280,height:800}}),errors:string[]=[];
for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(name:string)=>a.screenshot({path:`${folder}/${name}.png`});
try{
 await a.goto('http://127.0.0.1:4355/?test');await a.click('#garage-btn');assert.equal(await a.locator('.bike-card').count(),7);assert.ok(await a.locator('[data-bike="lobo"]').isDisabled());
 await a.evaluate(()=>{const s=JSON.parse(window.__game!.save());s.cash=40000;localStorage.setItem('asfalto-bruto:v1',JSON.stringify(s));});await a.reload();await a.click('#garage-btn');
 const races=[];
 for(const bike of BIKES){
  if(bike.id!=='ferro')await a.click(`[data-bike="${bike.id}"]`);
  if(bike.id==='lobo'){await a.click('#garage-workshop');await a.click('[data-upgrade="handling"]');}
  await a.click('[data-close="garage-modal"]');await a.click('#start-btn');if(await a.locator('#help-go').isVisible())await a.click('#help-go');
  await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.countdown=0;s.time=24;const z=1310;s.riders.forEach((r:any,i:number)=>Object.assign(r,{z:z+(i===0?0:i<3?i*18:-(i-2)*18),x:i===0?1:(i%2?3:-2),speed:38,crash:0,health:100,immune:0}));s.traffic=[];s.obstacles=[];window.__game!.restore(JSON.stringify(s));});
  const s=await state();assert.equal(s.player.bikeId,bike.id);assert.equal(s.player.handling,bike.handling+(bike.id==='lobo'?.1:0));assert.ok(await a.locator('#corner-warning').isVisible());
  await shot(`race-${bike.id}`);races.push({id:bike.id,handling:s.player.handling,corner:s.corner});
  await a.keyboard.press('Escape');await a.click('#menu-btn');await a.click('#garage-btn');
 }
 await a.click('[data-bike="lobo"]');await a.click('[data-close="garage-modal"]');const owned=JSON.parse(await a.evaluate(()=>window.__game!.save()));assert.equal(owned.owned.length,7);
 await a.reload();const restored=JSON.parse(await a.evaluate(()=>window.__game!.save()));assert.deepEqual(restored,owned);
 await a.click('#online-btn');assert.equal(await a.locator('#online-bike').inputValue(),'lobo');await a.selectOption('#online-bike','estradeira');assert.match(await a.locator('#online-bike-preview').innerText(),/CRUISER/);await a.selectOption('#online-bike','lobo');
 await a.setViewportSize({width:390,height:844});await shot('online-bike-mobile');assert.ok(await a.locator('#online-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await a.setViewportSize({width:1440,height:900});
 await a.fill('#online-name','Lobo Ana');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
 await b.goto(`http://127.0.0.1:4355/?test&sala=${code}`);await b.fill('#online-name','Falcão Bia');await b.selectOption('#online-bike','falcao');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
 await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.members.length===2);assert.match(await a.locator('#online-members').innerText(),/Lobo 1200/);assert.match(await a.locator('#online-members').innerText(),/Falcão 450/);await shot('mixed-bike-lobby');
 await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;await Promise.all([a,b].map(p=>p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race')));
 const aid=(await state()).online.id,bid=(await state(b)).online.id;
 assert.equal((await state()).player.handling,getBike('lobo').handling,'Online ignores the purchased campaign upgrade');assert.equal((await state(b)).player.handling,getBike('falcao').handling);
 const room=(await store.read(code))!;assert.ok(new Set(room.race!.riders.map(r=>r.bikeId)).size>=5);
 await a.keyboard.down('w');await b.keyboard.down('w');await a.waitForTimeout(1800);assert.ok((await state()).player.speed>5);assert.ok((await state(b)).player.speed>5);
 assert.equal((await state()).riders.find((r:any)=>r.id===bid).bikeId,'falcao');assert.equal((await state(b)).riders.find((r:any)=>r.id===aid).bikeId,'lobo');await shot('mixed-bikes-racing');
 await a.keyboard.up('w');await b.keyboard.up('w');await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).online.id,aid);assert.equal((await state()).player.bikeId,'lobo');assert.equal((await state()).player.handling,.82);
 for(const p of [a,b]){await p.keyboard.press('Escape');await p.click('#menu-btn');}
 assert.deepEqual(JSON.parse(await a.evaluate(()=>window.__game!.save())),owned);assert.deepEqual(errors,[]);
 await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify({models:races,online:['Lobo 1200','Falcão 450'],bots:6,upgradesExcludedOnline:true,reconnectedWithSameModel:true,legacySavePreserved:true,errors},null,2));console.log('Seven models: garage purchases/equipment, handling upgrade, portraits and racing, mobile choice, mixed-model multiplayer, factory attributes and resume passed.');
}finally{await browser.close();await app.close();vite.kill('SIGTERM');}
