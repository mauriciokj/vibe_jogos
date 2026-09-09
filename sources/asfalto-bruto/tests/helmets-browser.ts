import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {HELMETS,HELMET_COLORS} from '../src/game/helmets';

const published=!!process.env.HELMET_CHECK_URL,base=process.env.HELMET_CHECK_URL||'http://127.0.0.1:4369/',folder='output/helmets',prefix=published?'published':'local';await fs.mkdir(folder,{recursive:true});
const app=published?null:createGameServer(new MemoryStore());
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4369','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']}),a=await browser.newPage({viewport:{width:1280,height:960}}),b=await browser.newPage({viewport:{width:1100,height:800}}),errors:string[]=[];
for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});if(!published)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0,since:'2026-09-08T00:00:00Z'}}));}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const seed=async(p:Page,save:ReturnType<typeof freshSave>)=>{await p.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await p.reload({waitUntil:'domcontentloaded'});};
const garage=async(p=a)=>{await p.click('#garage-btn');await p.click('[data-garage-tab="helmets"]');};
const leave=async(p:Page)=>{if((await state(p)).screen==='race'){await p.click('#pause-btn');await p.click('#menu-btn');}};
try{
  await a.goto(base+'?test',{waitUntil:'domcontentloaded'});await garage();assert.equal(await a.locator('.helmet-card').count(),4);assert.equal(await a.locator('.helmet-swatch').count(),8);assert.ok(await a.locator('[data-helmet="retro"]').isDisabled());
  await a.click('[data-helmet-color="purple"]');assert.equal((await state()).save.cash,650);assert.equal((await state()).save.helmetColorId,'purple');await a.reload({waitUntil:'domcontentloaded'});assert.equal((await state()).save.helmetColorId,'purple');
  const save=freshSave();save.cash=10000;save.races=1;save.unlocked=3;save.raceTrackId='porto';save.owned.push('lobo');save.bikeId='lobo';save.upgrades.lobo={engine:0,armor:0,handling:0};save.condition.lobo=100;save.ownedKneePads=['gold'];save.kneePadId='gold';
  await seed(a,save);await garage();
  for(const h of HELMETS.slice(1)){const before=(await state()).save.cash;assert.match(await a.locator(`[data-helmet="${h.id}"]`).innerText(),new RegExp(h.price.toLocaleString('pt-BR').replace('.','\\.')));await a.click(`[data-helmet="${h.id}"]`);assert.equal((await state()).save.cash,before-h.price);assert.equal((await state()).save.helmetId,h.id);}
  assert.equal((await state()).save.cash,500);
  const previews=new Set<string>();for(const c of HELMET_COLORS){await a.click(`[data-helmet-color="${c.id}"]`);assert.equal((await state()).save.cash,500);assert.equal((await state()).save.helmetColorId,c.id);previews.add((await a.locator('.helmet-card img').first().getAttribute('src'))!);}
  assert.equal(previews.size,8);assert.equal((await state()).save.kneePadId,'gold');await a.locator('#garage-modal').evaluate(e=>e.scrollTop=0);await a.screenshot({path:`${folder}/${prefix}-garage.png`});
  await a.setViewportSize({width:390,height:844});await a.locator('#garage-modal').evaluate(e=>e.scrollTop=0);assert.ok(await a.locator('#garage-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await a.screenshot({path:`${folder}/${prefix}-mobile.png`});
  await a.click('[data-helmet="retro"]');assert.equal((await state()).save.helmetId,'retro');assert.equal((await state()).save.cash,500);await a.click('[data-helmet-color="orange"]');await a.reload({waitUntil:'domcontentloaded'});assert.equal((await state()).save.helmetId,'retro');assert.equal((await state()).save.helmetColorId,'orange');
  await a.setViewportSize({width:1280,height:800});await a.click('#start-btn');await a.evaluate(()=>window.advanceTime(3900));assert.equal((await state()).player.helmetId,'retro');assert.equal((await state()).player.helmetColorId,'orange');assert.equal((await state()).player.bikeId,'lobo');
  await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.countdown=0;s.time=20;s.tick=1200;s.traffic=[];s.obstacles=[];s.heat=0;s.riders=s.riders.slice(0,2);Object.assign(s.riders[0],{z:1000,x:0,speed:40});Object.assign(s.riders[1],{z:984,x:2,speed:40,helmetId:'cross',helmetColorId:'blue'});window.__game!.restore(JSON.stringify(s));});await a.screenshot({path:`${folder}/${prefix}-race-mirror.png`});
  await a.keyboard.down('w');await a.keyboard.down('d');await a.evaluate(()=>window.advanceTime(400));await a.keyboard.up('d');await a.keyboard.up('w');assert.equal((await state()).player.helmetId,'retro');await leave(a);
  await a.click('#online-btn');assert.match(await a.locator('#online-loadout').innerText(),/Retrô laranja/);await a.fill('#online-name','Capacete Retrô');await a.selectOption('#online-track','porto:day');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  const other=published?'https://flowofdevelopment.com/asfalto-bruto/':base;await b.goto(other+'?test',{waitUntil:'domcontentloaded'});const saveB=freshSave();saveB.cash=5000;saveB.races=1;await seed(b,saveB);await garage(b);await b.click('[data-helmet="racing"]');await b.click('[data-helmet-color="blue"]');await b.click('[data-close="garage-modal"]');await b.click('#online-btn');await b.fill('#online-name','Capacete Racing');await b.fill('#online-code-input',code);await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.members.length===2);assert.match(await a.locator('#online-members').innerText(),/Racing azul/);await a.click('#online-ready');await b.click('#online-ready');for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;assert.equal((await state()).player.helmetId,'retro');assert.equal((await state(b)).player.helmetId,'racing');assert.equal((await state()).awareness.racers.length,8);assert.equal((await state()).riders.find((r:{id:string})=>r.id===bid).helmetColorId,'blue');assert.equal((await state(b)).riders.find((r:{id:string})=>r.id===aid).helmetColorId,'orange');
  await a.keyboard.down('w');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>25);await a.screenshot({path:`${folder}/${prefix}-online.png`});await a.keyboard.up('w');await b.reload({waitUntil:'domcontentloaded'});await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(b)).online.id,bid);assert.equal((await state(b)).player.helmetId,'racing');assert.equal((await state(b)).player.helmetColorId,'blue');for(const p of [a,b])await leave(p);
  if(!published){
    // Inspect actual game sprites across all bike styles, including a raised front wheel.
    const sheet=await browser.newPage({viewport:{width:1120,height:1300}});await sheet.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0,since:'2026-09-08T00:00:00Z'}}));sheet.on('pageerror',e=>errors.push(e.message));await sheet.goto(base+'?test',{waitUntil:'domcontentloaded'});
    await sheet.evaluate(async()=>{
      const spriteUrl='/src/game/sprites.ts';const {bikeSprite,bikeFrontSprite}=await import(spriteUrl);const canvas=document.createElement('canvas');canvas.width=1120;canvas.height=1300;const c=canvas.getContext('2d')!;c.fillStyle='#24383e';c.fillRect(0,0,1120,1300);c.imageSmoothingEnabled=false;
      ['street','sport','cruiser','chopper','supermoto','cafe','muscle','wheelie'].forEach((style,row)=>{
        c.fillStyle='#ecf1da';c.font='14px monospace';c.fillText(style,10,row*160+15);
        ['integral','retro','cross','racing'].forEach((helmet,col)=>{for(const front of [false,true]){const fn=front?bikeFrontSprite:bikeSprite,bike=style==='wheelie'?'street':style,args=front?['#a8db78',bike,'ride',1,false,0,'',0,'',style==='wheelie',helmet,'red']:['#a8db78','ride',1,false,0,bike,'',0,'',style==='wheelie',helmet,'red'];c.drawImage(fn(...args),col*280+(front?145:15),row*160+26,88,128);}});
      });canvas.style.cssText='position:absolute;left:0;top:0;z-index:99999';document.body.appendChild(canvas);
    });await sheet.screenshot({path:`${folder}/sprites.png`,fullPage:true});await sheet.close();
  }
  assert.deepEqual(errors,[]);const report={ok:true,models:4,colors:8,permanentPurchases:true,freeColors:true,legacyEquipmentPreserved:true,mobile:true,chopper:true,mirror:true,humans:2,bots:6,sharedCosmetics:true,reconnect:true,errors};await fs.writeFile(`${folder}/${prefix}.json`,JSON.stringify(report,null,2));console.log(report);
}finally{for(const p of [a,b])try{await leave(p);}catch{}await browser.close();vite?.kill('SIGTERM');await app?.close();}
