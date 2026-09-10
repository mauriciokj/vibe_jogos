import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {TRACKS,getTrack} from '../src/game/content';

const base=process.env.PUBLIC_URL||'http://127.0.0.1:4386/',published=!!process.env.PUBLIC_URL,folder=process.env.QA_DIR||'output/championship/local';await fs.mkdir(folder,{recursive:true});
const store=new MemoryStore(),app=published?null:createGameServer(store);
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4386','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
if(!published)await page.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0}}));
const save={...freshSave(),cash:12000,races:1,unlocked:0};
await page.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,save});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const snapshot=()=>page.evaluate(()=>JSON.parse(window.__game!.snapshot()));
const persisted=()=>page.evaluate(()=>JSON.parse(window.__game!.save()));
const advance=(ms:number)=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=async(name:string)=>{await page.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(),null,2));};
async function finish(place=1,integrity=67,reason='finish',brokenRivals=0){
 const s=await snapshot(),end=getTrack(s.trackId).distance;s.mode='racing';s.countdown=0;s.time=180;s.tick=10800;s.result=null;s.traffic=[];s.obstacles=[];s.heat=0;s.policeActive=false;s.riders=s.riders.filter((r:any)=>r.profile!=='police');
 s.riders.forEach((r:any,i:number)=>Object.assign(r,{x:i%2?-3:3,z:end-4-i*14,speed:40,integrity:i?80:integrity,health:100,finishedAt:i>0&&i<place?170+i:null,out:undefined,crash:0,immune:10,attack:null,cooldown:100}));
 s.riders.forEach((r:any)=>{if(r.finishedAt!==null)r.z=end;});
 s.riders.slice(1,1+brokenRivals).forEach((r:any)=>r.integrity=0);
 if(reason!=='finish'){s.riders[0].out=reason;s.mode='finished';s.result={reason,place:8,time:180,reward:120,hits:0,falls:0};}
 await page.evaluate(s=>window.__game!.restore(JSON.stringify(s)),s);await page.evaluate(()=>window.__game!.command({throttle:1,brake:0,steer:0,attack:null},10));
 await page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return !s.championship.settling && s.championship.status!=='racing';});
 if((await state()).screen==='finish')await page.click('#finish-skip');
 await page.waitForFunction(()=>document.querySelector('#result-modal')?.matches('[open]'));
 assert.equal(await page.locator('#result-modal').evaluate(d=>d.scrollTop),0,'new standings always begin at the top');
}
async function layout(){const data=await page.evaluate(()=>{const d=document.querySelector('dialog[open]')!,table=d.querySelector('.champ-table');return {dialog:d.clientWidth,scroll:d.scrollWidth,table:table?.getBoundingClientRect().width,body:window.innerWidth};});assert.ok(data.scroll<=data.dialog+1,JSON.stringify(data));}
try{
 await page.goto(base+'?test',{waitUntil:'domcontentloaded'});assert.ok(await page.locator('#start-btn').isVisible());assert.ok(await page.locator('#online-btn').isVisible());await shot('menu');await page.click('#championship-btn');await shot('intro');await layout();await page.click('#champ-start');assert.equal((await state()).track,'costa');assert.equal((await state()).condition,'day');
 await advance(4000);await page.keyboard.down('w');await advance(3500);await page.keyboard.up('w');assert.ok((await state()).player.speed>20);await page.click('#pause-btn');assert.ok(await page.locator('#restart-btn').isHidden());await page.click('#resume-btn');
 const active=await snapshot();Object.assign(active.riders[0],{integrity:42,health:58,wheeliesLeft:1,nitro:0,nitroUsed:0});await page.evaluate(s=>window.__game!.restore(JSON.stringify(s)),active);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));const checkpoint=(await persisted()).championship.checkpoint;await page.reload({waitUntil:'domcontentloaded'});assert.ok((await state()).championship.checkpoint);await page.click('#championship-btn');await page.click('#champ-start');assert.equal((await state()).player.integrity,42);assert.equal((await state()).player.wheeliesLeft,1);assert.equal((await snapshot()).tick,checkpoint.tick);await shot('resumed');
 const conditions=['day','sunset','night','rain'];
 for(let stage=0;stage<5;stage++){
  for(let heat=0;heat<4;heat++){
   const race=await state();assert.equal(race.track,TRACKS[stage].id);assert.equal(race.condition,conditions[heat]);
   const broken=stage===0&&heat===3 || stage===1&&heat===0,low=stage===1&&heat===1;
   let carried=broken?0:low?15:67-heat*9;
   await finish(1,carried,broken?'wrecked':'finish',stage===0&&heat===0?4:0);const c=(await state()).championship;assert.equal(c.heats,heat+1);
   assert.equal(c.standings.find((r:any)=>r.id==='player').points,stage===0&&heat===3?30:stage===1?heat*10:(heat+1)*10);assert.equal(c.garageOpen,heat===3);
   if(stage===1&&heat===0){
    assert.equal(c.bike.canRepair,true);assert.ok(await page.locator('dialog[open] #champ-start').isDisabled());assert.equal(await page.locator('dialog[open] #champ-garage').count(),0);
    const cash=(await persisted()).cash,heats=JSON.stringify((await persisted()).championship.heats);await page.reload({waitUntil:'domcontentloaded'});await page.click('#championship-btn');
    assert.equal((await state()).championship.stage,1);assert.equal((await state()).championship.heats,1);await shot('broken-inside-stage');await page.click('dialog[open] #champ-repair');
    assert.equal((await persisted()).cash,cash-400);assert.equal(JSON.stringify((await persisted()).championship.heats),heats);assert.equal(await page.locator('dialog[open] #champ-repair').count(),0);assert.equal((await state()).championship.bike.integrity,100);carried=100;
   }
   if(low){assert.ok(await page.locator('dialog[open] .champ-integrity-alert').isVisible());assert.equal(await page.locator('dialog[open] #champ-repair').count(),0);assert.ok(await page.locator('dialog[open] #champ-start').isEnabled());await shot('low-integrity');}
   if(stage===0&&heat===3){
    assert.ok(await page.locator('#result-modal #champ-start').isDisabled());const saved=JSON.stringify((await persisted()).championship),races=(await persisted()).races;
    await page.locator('#result-modal #champ-start').evaluate(b=>{b.removeAttribute('disabled');(b as HTMLButtonElement).click();});
    assert.equal(JSON.stringify((await persisted()).championship),saved);assert.equal((await persisted()).races,races);assert.equal((await state()).championship.stage,0);assert.equal((await state()).championship.heats,4);
    for(const width of [1440,390,320]){await page.setViewportSize({width,height:width===1440?900:width===390?844:568});await page.locator('#championship-modal').evaluate(d=>d.scrollTop=0);await layout();await shot(`blocked-next-stage-${width}`);}
    await page.setViewportSize({width:1440,height:900});
   }
   if(stage===0){await shot(`costa-round-${heat+1}`);await layout();const cash=(await persisted()).cash;await advance(2000);assert.equal((await persisted()).cash,cash,'result never pays twice');}
   if(heat<3){assert.equal(await page.locator('dialog[open] #champ-garage').count(),0);await page.click('dialog[open] #champ-start');assert.equal((await state()).player.integrity,carried);if(low){await advance(100);assert.match(await page.locator('#toast').textContent()??'',/15% de integridade/);}}
   if(stage===0&&heat===0){const grid=await snapshot();assert.deepEqual(grid.riders.slice(1,5).map((r:any)=>r.integrity),[100,100,100,100]);await advance(6500);const moving=await snapshot();for(let i=1;i<8;i++)assert.ok(moving.riders[i].z>grid.riders[i].z+10,`${moving.riders[i].name} left grid`);await shot('all-rivals-leave-grid');}
  }
  if(stage<4){
   assert.equal((await state()).championship.status,'service');await page.click('dialog[open] #champ-garage');assert.ok(await page.locator('#garage-modal').isVisible());await page.locator('#repair-btn').scrollIntoViewIfNeeded();await page.click('#repair-btn');assert.equal((await persisted()).condition.ferro,100);await page.locator('[data-close="garage-modal"]').click();await page.click('#championship-modal #champ-start');assert.equal((await state()).championship.stage,stage+1);assert.equal((await state()).player.integrity,100);assert.ok((await state()).championship.standings.every((r:any)=>r.points===0));
  }
 }
 assert.equal((await state()).championship.status,'complete');assert.equal((await persisted()).championship.history.length,5);await shot('complete');
 for(const viewport of [{width:390,height:844},{width:320,height:568}]){await page.setViewportSize(viewport);await page.locator('#result-modal').evaluate(d=>d.scrollTop=0);await layout();await shot(`complete-${viewport.width}-top`);await page.locator('#result-modal #champ-restart').scrollIntoViewIfNeeded();await shot(`complete-${viewport.width}-actions`);}
 await page.setViewportSize({width:1440,height:900});await page.click('#result-modal #champ-restart');assert.equal((await state()).championship.stage,0);assert.equal((await state()).championship.heats,0);await page.click('#championship-modal #champ-start');
 for(let heat=0;heat<4;heat++){await finish(4,62);if(heat<3)await page.click('#result-modal #champ-start');}
 assert.equal((await state()).championship.status,'eliminated');assert.equal((await state()).championship.standings.find((r:any)=>r.id==='player').rank,4);assert.equal(await page.locator('#result-modal #champ-start').count(),0);await shot('eliminated');
 const cash=(await persisted()).cash;await page.click('#result-modal #champ-restart');assert.equal((await persisted()).cash,cash);await page.click('#championship-modal #champ-start');
 for(const [i,reason] of ['caught','wrecked','timeout','left'].entries()){await finish(1,i===1?0:30,reason);assert.equal((await state()).championship.standings.find((r:any)=>r.id==='player').points,0);if(i<3){if((await state()).championship.bike.canRepair)await page.click('dialog[open] #champ-repair');await page.click('dialog[open] #champ-start');}}
 assert.equal((await state()).championship.status,'eliminated');await shot('all-dnf');
 await page.click('#result-modal #champ-restart');await page.click('#championship-modal #champ-start');await page.click('#pause-btn');await page.click('#menu-btn');await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).championship.settling);assert.equal((await state()).championship.heats,1);assert.equal((await persisted()).championship.heats[0].reason,'left');await shot('abandoned');
 await page.click('#result-modal #champ-menu');const c=structuredClone((await persisted()).championship);await page.click('#start-btn');await advance(4000);assert.equal((await state()).championship.active,false);assert.deepEqual((await persisted()).championship,c);await page.click('#pause-btn');assert.ok(await page.locator('#restart-btn').isVisible());await page.click('#menu-btn');await page.click('#online-btn');assert.ok(await page.locator('#online-create').isVisible());await page.click('#online-close');
 for(const viewport of [{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(viewport);await page.locator('#championship-btn').scrollIntoViewIfNeeded();await shot(`menu-${viewport.width}`);
  const bounds=await page.locator('#championship-btn').boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y>=0&&bounds.y+bounds.height<=viewport.height);
  await page.click('#championship-btn');await layout();await shot(`board-${viewport.width}`);await page.locator('#championship-modal #champ-start').scrollIntoViewIfNeeded();await shot(`board-${viewport.width}-actions`);await page.click('#championship-modal #champ-close');
 }
 assert.deepEqual(errors,[]);const report={ok:true,stages:5,races:20,qualification:true,elimination:true,allDnfReasons:true,zeroOnlyEmergencyRepair:true,blockedBrokenStarts:true,lowIntegrityWarning:true,garageBetweenStages:true,checkpointReload:true,classicPreserved:true,mobileWidths:[390,320],errors};await fs.writeFile(`${folder}/report.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();vite?.kill('SIGTERM');await app?.close();}
