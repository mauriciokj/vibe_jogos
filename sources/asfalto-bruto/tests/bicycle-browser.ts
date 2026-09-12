import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {crashRider,createRace} from '../src/game/simulation';
import {newChampionship,startChampionshipRace} from '../src/game/championship';

const folder='output/bicycle/browser',origin='http://127.0.0.1:4394';await fs.mkdir(folder,{recursive:true});
let offset=0;const now=()=>Date.now()+offset;
const db=new AccountsDB(':memory:'),identity=db.login('bicycle-qa'),seed=freshSave();seed.cash=1e6;seed.races=1;db.save(identity.id,0,seed,'bicycle-fixture');
const accounts=new AccountService({db,now,clientId:'qa.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'bicycle-qa';}});
const app=createGameServer(new MemoryStore(),{accounts,origins:[origin],now});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4394','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as any).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),errors:string[]=[];
const page=await browser.newPage({viewport:{width:1280,height:900}});
async function prepare(p:typeof page,save=seed){
 p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
 await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.o.callback({credential:this.o.nonce});t.append(b)}}}};`}));
 await p.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,save});
 await p.goto(origin+'/?test');await p.waitForFunction(()=>typeof window.render_game_to_text==='function');
}
const state=(p=page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(name:string,p=page)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
async function finishView(p=page){if(await p.locator('#finish-skip').isVisible())await p.click('#finish-skip');await p.locator('#result-modal[open] .secret-unlock').waitFor();}
async function login(p:typeof page){await p.click('#account-btn');await p.click('#qa-google');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await p.click('#account-modal .close-btn');}
function footFixture(s:ReturnType<typeof createRace>){
 const p=s.riders[0],end=8400;s.mode='racing';s.time=200;s.countdown=0;s.traffic=[];s.obstacles=[];
 Object.assign(p,{x:0,z:end-.2,speed:0});crashRider(s,p,true);p.x=0;
 Object.assign(p.recovery!,{phase:'walking',bikeX:0,bikeZ:end-12,bikeVX:0,bikeVZ:0,vx:0,vz:0,cycle:1});
 s.riders.slice(1).forEach((r,i)=>{r.z=end;r.finishedAt=180+i;r.speed=0;});return s;
}
try{
 await prepare(page);await page.click('#garage-btn');
 assert.equal(await page.locator('.secret-vehicle').count(),1);assert.equal(await page.locator('[data-bike="bicicleta"]').count(),0);
 assert.equal(await page.locator('.secret-vehicle').innerText(),'item ainda não disponível');await page.locator('.secret-vehicle').scrollIntoViewIfNeeded();await shot('locked');await page.click('[data-close="garage-modal"]');
 await page.click('#start-btn');
 // Real collision -> slide -> get up -> choose the finish over returning to the bike.
 await page.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.time=200;s.countdown=0;s.riders=s.riders.slice(0,1);s.riders[0].z=8386;s.riders[0].speed=25;s.riders[0].x=1.7;s.traffic=[{id:'qa-car',x:1.7,z:8387,speed:0,color:'#c7aa80',kind:'car'}];s.obstacles=[];window.__game!.restore(JSON.stringify(s));window.advanceTime(50);});
 assert.equal((await state()).player.recovery.phase,'sliding');
 await page.evaluate(()=>window.advanceTime(3000));assert.equal((await state()).player.recovery.phase,'walking');assert.ok((await state()).player.z<8400);await shot('walking-to-finish');
 await page.keyboard.down('w');await page.evaluate(()=>window.advanceTime(1600));await page.keyboard.up('w');
 assert.equal((await state()).result.onFoot,true);assert.equal((await state()).save.bicycleUnlocked,true);
 await page.evaluate(()=>window.advanceTime(3200));await shot('foot-finish');await finishView();await shot('unlocked');
 await page.click('#result-menu-btn');await page.click('#garage-btn');assert.equal(await page.locator('.secret-vehicle').count(),0);
 await page.locator('[data-bike="bicicleta"]').scrollIntoViewIfNeeded();await shot('bicycle-card');await page.click('[data-bike="bicicleta"]');
 await page.click('[data-close="garage-modal"]');await page.reload();assert.equal((await state()).save.bike,'bicicleta');await page.click('#start-btn');await page.evaluate(()=>window.advanceTime(3550));
 await page.keyboard.down('w');await page.evaluate(()=>window.advanceTime(3000));assert.equal((await state()).player.speed,0);await page.keyboard.up('w');
 for(let i=0;i<20;i++){await page.keyboard.press('w');await page.evaluate(()=>window.advanceTime(180));}
 assert.ok((await state()).player.speed>30);assert.equal((await state()).player.wheeliesLeft,3);assert.equal((await state()).player.nitro,0);await shot('pedaling');
 await page.keyboard.down('s');await page.evaluate(()=>window.advanceTime(500));await page.keyboard.up('s');assert.ok((await state()).player.speed<25);
 await page.click('#pause-btn');await page.click('#menu-btn');
 const unlocked=JSON.parse(await page.evaluate(()=>window.__game!.save()));
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await prepare(mobile,unlocked);await mobile.click('#start-btn');await mobile.evaluate(()=>window.advanceTime(3550));
 await shot('mobile-start',mobile);
 assert.equal(await mobile.locator('#drive-label').innerText(),'TOQUE PARA PEDALAR');assert.equal(await mobile.locator('#touch-nitro').isVisible(),false);
 const rect=await mobile.locator('#drive-stick').boundingBox();assert.ok(rect);
 for(let i=0;i<20;i++){await mobile.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height*.22);await mobile.evaluate(()=>window.advanceTime(180));}
 assert.ok((await state(mobile)).player.speed>30);await shot('mobile-pedaling',mobile);
 const beforeHold=(await state(mobile)).player.speed;
 await mobile.mouse.move(rect.x+rect.width/2,rect.y+rect.height*.22);await mobile.mouse.down();await mobile.evaluate(()=>window.advanceTime(3000));await mobile.mouse.up();assert.ok((await state(mobile)).player.speed<beforeHold-3);assert.equal((await state(mobile)).player.pedalTime,0);
 await mobile.click('#pause-btn');await mobile.click('#menu-btn');
 // Championship settles the same achievement without changing the entered bike.
 const champ=freshSave();champ.races=1;champ.championship=newChampionship(45);const champRace=startChampionshipRace(champ);assert.ok(champRace);footFixture(champRace);champ.championship.checkpoint=structuredClone(champRace);
 await mobile.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:champ});await mobile.reload();await mobile.click('#championship-btn');await mobile.click('#champ-start');
 await mobile.keyboard.down('w');await mobile.evaluate(()=>window.advanceTime(100));await mobile.keyboard.up('w');await mobile.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.bicycleUnlocked);await finishView(mobile);await shot('championship-unlock',mobile);
 // The account achievement is computed by the real API from replayed commands.
 const accountPage=await browser.newPage({viewport:{width:1280,height:900}});await prepare(accountPage);await login(accountPage);
 const run=accounts.economy.start(identity.id,{trackId:'costa',condition:'day',revision:db.cloud(identity.id).revision});footFixture(run.initial!);db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(run.initial),run.id);
 await accountPage.reload();await accountPage.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await accountPage.click('#start-btn');await accountPage.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');offset+=5000;
 await accountPage.keyboard.down('w');await accountPage.evaluate(()=>window.advanceTime(100));await accountPage.keyboard.up('w');await accountPage.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.bicycleUnlocked);await finishView(accountPage);await shot('account-unlock',accountPage);
 const other=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await prepare(other);await login(other);assert.equal((await state(other)).save.bicycleUnlocked,true);await other.click('#garage-btn');await other.click('[data-bike="bicicleta"]');await other.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.bike==='bicicleta');assert.equal(db.cloud(identity.id).save!.bikeId,'bicicleta');await shot('account-other-device',other);
 assert.deepEqual(errors,[]);console.log('PASS: hidden secret, actual fall/run/finish, one-time unlock and reload, pedal vs hold, braking, mobile touch, championship, authoritative account reward and other device.');
}catch(e){await shot('failure');throw e;}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();vite.kill('SIGTERM');await app.close();db.close();}
