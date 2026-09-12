import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {MOTORBIKES as BIKES} from '../src/game/bikes';
import {freshSave,buyBike,SAVE_KEY} from '../src/game/save';
import {newChampionship,startChampionshipRace} from '../src/game/championship';

const folder='output/bike-selection',origin='http://127.0.0.1:4389';await fs.mkdir(folder,{recursive:true});
const seed=freshSave();seed.cash=1000000;seed.races=1;
for(const b of BIKES)buyBike(seed,b.id);buyBike(seed,'ferro');seed.cash=1234;
const db=new AccountsDB(':memory:'),identity=db.login('bike-selection-test');db.save(identity.id,0,seed,'bike-selection-fixture');
const accounts=new AccountService({db,clientId:'qa.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'bike-selection-test';}});
const app=createGameServer(new MemoryStore(),{accounts,origins:[origin]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4389','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as any).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:900}}),errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.options=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.options.callback({credential:this.options.nonce});t.append(b)}}}};`}));
await page.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(name:string)=>{await page.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(),null,2));};
const reload=async()=>{await page.reload();await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);};
try{
  await page.goto(origin+'/?test');await page.click('#account-btn');await page.click('#qa-google');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await page.click('#account-modal .close-btn');await page.click('#garage-btn');
  for(const b of [...BIKES.slice(1),BIKES[0]]){
    await page.click(`[data-bike="${b.id}"]`);await page.waitForFunction(id=>JSON.parse(window.render_game_to_text()).save.bike===id,b.id);
    assert.equal(db.cloud(identity.id).save!.bikeId,b.id);assert.equal((await state()).player.bikeId,b.id);assert.equal((await state()).save.cash,1234);
    assert.ok(await page.locator(`[data-bike="${b.id}"]`).isDisabled());
  }
  await reload();assert.equal((await state()).save.bike,'ferro');
  console.log('PASS: all owned bikes switch in account garage/preview, no charge, reload preserved');
  // Damaged purchased bike must not be silently replaced by the starter at the grid.
  db.mutate(identity.id,stored=>{const save=structuredClone(stored!);save.condition.veneno=19;return {save,value:null};});
  assert.equal(db.cloud(identity.id).save!.condition.veneno,19);
  await reload();await page.click('#garage-btn');await page.click('[data-bike="veneno"]');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.bike==='veneno');
  await page.click('[data-close="garage-modal"]');await shot('selected-damaged');
  await page.click('#start-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');await shot('damaged-grid');
  assert.equal((await state()).player.bikeId,'veneno','race must retain the selected purchased bike');
  assert.equal((await state()).player.integrity,19);assert.equal(db.cloud(identity.id).save!.bikeId,'veneno');
  assert.match(await page.locator('#toast').innerText(),/19%/);
  const leave=async()=>{await page.click('#pause-btn');await page.click('#menu-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='menu');};
  await leave();
  // A reload can leave a valid run pending; its lock must be explained inside the modal.
  const pending=accounts.economy.start(identity.id,{trackId:'costa',condition:'day',revision:db.cloud(identity.id).revision});
  await reload();await page.click('#garage-btn');await page.click('[data-bike="falcao"]');
  await page.locator('.garage-feedback[role="alert"]').waitFor();
  assert.match(await page.locator('.garage-feedback').innerText(),/Conclua ou abandone/);
  assert.ok(await page.locator('.garage-feedback').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'error is above the dialog backdrop');
  assert.equal((await state()).save.bike,'veneno');await shot('pending-run-error');
  await page.click('[data-close="garage-modal"]');await page.click('#start-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal(db.db.prepare('SELECT completed FROM economy_runs WHERE id=?').get(pending.id)!.completed,0);await leave();
  await page.click('#garage-btn');await page.click('[data-bike="falcao"]');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.bike==='falcao');
  // A revision conflict must refresh the cards and let the player retry the intended selection.
  db.mutate(identity.id,stored=>{const save=structuredClone(stored!);save.bikeId='ferro';return {save,value:null};});
  await page.click('[data-bike="lobo"]');await page.locator('.garage-feedback[role="alert"]').waitFor();
  assert.match(await page.locator('.garage-feedback').innerText(),/outro aparelho/);assert.equal((await state()).save.bike,'ferro');assert.ok(await page.locator('[data-bike="ferro"]').isDisabled());
  await page.click('[data-bike="lobo"]');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.bike==='lobo');
  // An unusable purchased bike does not consume a run, nitro, cash, or change selection.
  db.mutate(identity.id,stored=>{const save=structuredClone(stored!);save.bikeId='veneno';save.condition.veneno=0;return {save,value:null};});
  await reload();const before=db.cloud(identity.id),runs=db.db.prepare('SELECT COUNT(*) AS n FROM economy_runs').get()!.n;
  await page.click('#start-btn');await page.locator('#garage-modal[open]').waitFor();assert.match(await page.locator('.garage-feedback').innerText(),/0%/);
  assert.deepEqual(db.cloud(identity.id),before);assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM economy_runs').get()!.n,runs);await shot('broken-bike');
  await page.click('#repair-btn');await page.waitForFunction(()=>JSON.parse(window.__game!.save()).condition.veneno===100);assert.equal(db.cloud(identity.id).save!.cash,before.save!.cash-400);
  await page.click('[data-close="garage-modal"]');await page.click('#start-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).player.bikeId,'veneno');await leave();
  const guest=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});guest.on('pageerror',e=>errors.push(e.message));
  await guest.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
  const damaged=structuredClone(seed);damaged.bikeId='veneno';damaged.condition.veneno=5;damaged.condition.ferro=0;
  await guest.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,save:damaged});
  await guest.goto(origin+'/?test');await guest.click('#start-btn');assert.equal((await guest.evaluate(()=>JSON.parse(window.render_game_to_text()))).player.bikeId,'veneno');
  assert.match(await guest.locator('#toast').innerText(),/5%/);await guest.click('#pause-btn');await guest.click('#menu-btn');
  await guest.evaluate(key=>{const save=JSON.parse(localStorage.getItem(key)!);save.condition.veneno=0;localStorage.setItem(key,JSON.stringify(save));},SAVE_KEY);
  await guest.reload();await guest.click('#start-btn');assert.ok(await guest.locator('#garage-modal').isVisible());assert.match(await guest.locator('.garage-feedback').innerText(),/0%/);
  await guest.screenshot({path:`${folder}/mobile-broken.png`});
  await guest.click('[data-bike="ferro"]');await guest.click('[data-close="garage-modal"]');await guest.click('#start-btn');
  const starter=await guest.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(starter.player.bikeId,'ferro');assert.equal(starter.player.integrity,55);
  const champ=structuredClone(seed);champ.bikeId='veneno';champ.championship=newChampionship(41);startChampionshipRace(champ);champ.bikeId='lobo';
  await guest.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:champ});await guest.reload();await guest.click('#garage-btn');assert.match(await guest.locator('.garage-feedback').innerText(),/Veneno 750 continua inscrita/);
  await guest.screenshot({path:`${folder}/mobile-championship.png`});await guest.click('[data-close="garage-modal"]');await guest.click('#championship-btn');await guest.click('#champ-start');assert.equal((await guest.evaluate(()=>JSON.parse(window.render_game_to_text()))).player.bikeId,'veneno');
  assert.deepEqual(errors,[]);console.log('PASS: owned account selections/reload, damaged account/guest grids, pending-run and revision errors, repair then start, starter assistance, championship explanation, mobile');
}catch(e){await shot('failure');throw e;}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();vite.kill('SIGTERM');await app.close();db.close();}
