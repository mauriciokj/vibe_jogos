import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { AccountService } from '../server/accounts';
import { AccountsDB } from '../server/accounts-db';
import { MemoryStore } from '../server/store';
import { freshSave } from '../src/game/save';
import { createRace, stepRace } from '../src/game/simulation';
import { safeDrivingCommand } from './driving';
import { BIKES } from '../src/game/content';

const folder='output/accounts/browser';await fs.mkdir(folder,{recursive:true});
const db=new AccountsDB(':memory:'),origin='http://127.0.0.1:4381';
let serverNow=Date.now();
const accounts=new AccountService({db,now:()=>serverNow,clientId:'test-client.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{const [subject,claim]=credential.split('|');if(claim!==nonce || !subject.startsWith('qa-'))throw new Error('Invalid');return subject;}});
const store=new MemoryStore(),app=createGameServer(store,{accounts});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4381','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true});
const desktop=await browser.newContext({viewport:{width:1280,height:900}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const p=await desktop.newPage(),m=await mobile.newPage();
const state=(page:Page)=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const errors:string[]=[];const rankResponses:unknown[]=[];p.on('response',async r=>{if(r.url().endsWith('/finish'))rankResponses.push({status:r.status(),body:await r.json()});});
const guest=freshSave();guest.cash=25000;guest.ownedKneePads=['gold'];guest.kneePadId='gold';guest.ownedWeapons=['chain'];guest.weaponId='chain';
const stock=freshSave();
async function setup(page:Page,save:typeof guest){
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/visitors*',r=>r.fulfill({json:{visitors:42}}));
  await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(options){this.options=options;},renderButton(target){const b=document.createElement('button');b.textContent='Entrar com Google (QA)';b.id='qa-google';b.onclick=()=>this.options.callback({credential:(window.qaSubject||'qa-main')+'|'+this.options.nonce});target.append(b);}}}};`}));
  await page.addInitScript(save=>{if(!localStorage.getItem('qa-prepared')){localStorage.setItem('asfalto-bruto:v1',JSON.stringify(save));localStorage.setItem('qa-prepared','yes');}sessionStorage.setItem('asfalto-instructions','1');},save);
  await page.goto(origin+'/?test',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
}
async function login(page:Page){
  await page.click('#account-btn');await page.locator('#qa-google').waitFor();
  const response=page.waitForResponse(r=>r.url().endsWith('/account/session'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await response;await page.waitForTimeout(100);
  await page.click('#qa-google');
}
async function close(page:Page){await page.click('#account-modal .close-btn');}
try{
  await setup(p,guest);await setup(m,stock);
  assert.equal((await state(p)).save.cash,25000);
  await p.click('#account-btn');await p.locator('#qa-google').waitFor();
  let releaseRefresh!:()=>void;let refreshHeld!:()=>void;
  const held=new Promise<void>(r=>refreshHeld=r),released=new Promise<void>(r=>releaseRefresh=r);
  await p.route('**/api/asfalto/account/session',async route=>{const response=await route.fetch();refreshHeld();await released;await route.fulfill({response});});
  await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await held;
  await p.click('#qa-google');await p.locator('[data-import]').waitFor();releaseRefresh();await p.waitForTimeout(200);
  await p.unroute('**/api/asfalto/account/session');assert.equal((await state(p)).account.signedIn,true);
  await p.locator('[data-import]').waitFor();await p.screenshot({path:folder+'/01-import.png'});await p.click('[data-import]');
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.status==='Progresso sincronizado');
  await p.fill('#account-nickname','Piloto QA');await p.click('#nickname-form button');await close(p);
  await login(m);await m.locator('#account-nickname').waitFor();await m.screenshot({path:folder+'/02-mobile-account.png'});
  assert.equal((await state(m)).save.cash,25000);assert.equal((await state(m)).save.kneePadId,'gold');assert.equal(await m.inputValue('#account-nickname'),'Piloto QA');
  await close(m);
  const next=BIKES.filter(b=>b.price>0).sort((a,b)=>a.price-b.price)[0];
  await p.click('#garage-btn');await p.click(`[data-bike="${next.id}"]`);await p.waitForTimeout(1400);await p.click('#garage-modal .close-btn');
  await m.click('#account-btn');await m.locator('#account-nickname').waitFor();
  assert.equal((await state(m)).save.bike,next.id);assert.equal((await state(m)).save.cash,25000-next.price);await close(m);
  // Both devices edit the same revision while one is offline. Cloud version must be a choice.
  await mobile.setOffline(true);await m.click('[data-route="costa:rain"]');await m.waitForTimeout(1200);
  await p.keyboard.press('m');await p.waitForTimeout(1400);
  await mobile.setOffline(false);await m.click('#account-btn');await m.locator('[data-cloud]').waitFor();
  await m.screenshot({path:folder+'/03-mobile-conflict.png'});await m.click('[data-cloud]');await m.locator('#account-nickname').waitFor();
  assert.equal((await state(m)).account.conflict,false);await close(m);
  // Commit succeeds but HTTP response is lost: reload retries the same request receipt.
  let dropped=false;
  await p.route('**/api/asfalto/account/save',async route=>{if(!dropped){dropped=true;await route.fetch();await route.abort('failed');}else await route.continue();});
  await p.keyboard.press('m');await p.waitForTimeout(1500);assert.equal((await state(p)).account.pending,true);
  await p.unroute('**/api/asfalto/account/save');await p.reload({waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.pending===false && JSON.parse(window.render_game_to_text()).account.signedIn);
  assert.equal((await state(p)).account.conflict,false);assert.equal((await state(p)).save.cash,25000-next.price);
  // Signed account is never exposed in a room snapshot; guests can still race.
  await p.click('#online-btn');await p.fill('#online-name','QA');await p.click('#online-create');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  const online=(await state(p)).online,room=(await store.read(online.code))!;assert.equal(room.members[0].accountId,db.login('qa-main').id);assert.ok(!JSON.stringify(online).includes(db.login('qa-main').id));await p.click('#online-leave');
  const account=db.login('qa-main');db.result('qa-browser-result',account.id,'solo','costa','day',next.id,{reason:'finish',time:210,place:2,reward:0,hits:0,falls:0});
  await m.click('#ranking-btn');await m.locator('tbody tr').waitFor();assert.match(await m.locator('tbody').innerText(),/Piloto QA/);
  await m.screenshot({path:folder+'/04-mobile-ranking.png'});assert.ok(await m.locator('#ranking-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await m.selectOption('#rank-mode','multi');await m.locator('.ranking-empty').waitFor();await m.click('#ranking-modal .close-btn');
  await m.click('#account-btn');await m.click('[data-logout]');await m.locator('#qa-google').waitFor();
  assert.equal((await state(m)).save.cash,650);assert.equal((await state(m)).save.kneePadId,null);
  await m.evaluate(()=>{(window as any).qaSubject='qa-other';});await m.click('#qa-google');await m.locator('[data-import]').waitFor();await m.click('[data-fresh]');await m.locator('#account-nickname').waitFor();assert.equal((await state(m)).save.cash,650);await close(m);
  // Solo controls and equipped gear survive integration.
  await p.click('#start-btn');await p.keyboard.down('w');await p.evaluate(()=>window.advanceTime(8000));await p.keyboard.up('w');
  assert.ok((await state(p)).player.speed>10);assert.equal((await state(p)).player.kneePadId,'gold');await p.screenshot({path:folder+'/05-solo.png'});
  // Test-only response instrumentation drives the real update/recorder/result pipeline.
  // No debug hook or alternate verifier is present in the production build.
  await p.route('**/src/main.ts',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nwindow.__qaStart=async()=>{await startRace();testMode=true;};window.__qaDrive=(commands)=>{const original=input;for(const command of commands){input=()=>command;update();}input=original;draw();};`});});
  await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);
  await p.evaluate(()=>(window as any).__qaStart());await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.rankedRace);
  const row=db.db.prepare('SELECT payload FROM runs WHERE account=? ORDER BY created DESC LIMIT 1').get(account.id)!;
  const run=JSON.parse(String(row.payload)),simulation=createRace(run.trackId,run.save,run.seed,run.condition),commands=[];
  while(simulation.mode!=='finished' && simulation.tick<72000){const cmd=safeDrivingCommand(simulation);commands.push(cmd);stepRace(simulation,{player:cmd});}
  assert.equal(simulation.result?.reason,'finish');serverNow+=simulation.tick/60*1000+3000;
  await p.evaluate(commands=>(window as any).__qaDrive(commands),commands);
  assert.equal((await state(p)).screen,'finish');await p.evaluate(()=>window.advanceTime(5000));
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='result');
  for(let i=0;i<100;i++){if(db.run(run.id,account.id)?.completed)break;await p.waitForTimeout(100);}
  if(!db.run(run.id,account.id)?.completed)console.log(JSON.stringify({rankResponses,state:await state(p),toast:await p.locator('#toast').innerText()},null,2));
  assert.equal(db.run(run.id,account.id)?.completed,true,'browser-recorded race verified and stored');
  assert.ok(db.db.prepare('SELECT time FROM results WHERE race=?').get(run.id));
  await p.screenshot({path:folder+'/06-ranked-finish.png'});
  assert.deepEqual(errors,[]);await fs.writeFile(folder+'/report.json',JSON.stringify({passed:true,errors,checks:['Google UI callback with test-only verifier','legacy import','two devices','purchases and permanent equipment','CAS conflict','lost response receipt and reload','private multiplayer account binding','separate ranking UI','logout guest preservation','switch Google account','solo controls']},null,2));
  console.log('Account desktop/mobile browser checks passed');
}finally{await browser.close();vite.kill('SIGTERM');await app.close();db.close();}
