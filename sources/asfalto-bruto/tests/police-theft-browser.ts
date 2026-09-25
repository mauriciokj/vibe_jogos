import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { theftFixture } from './police-theft-fixture';
import { createGameServer } from '../server/service';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { MemoryStore } from '../server/store';

const folder='output/police-theft',origin='http://127.0.0.1:4386';await fs.mkdir(folder,{recursive:true});
let offset=0;const now=()=>Date.now()+offset,db=new AccountsDB(':memory:'),identity=db.login('theft-qa');
const accounts=new AccountService({db,now,clientId:'qa.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'theft-qa';}});
const app=createGameServer(new MemoryStore(),{accounts,origins:[origin],now});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=await createServer({server:{host:'127.0.0.1',port:4386,strictPort:true,proxy:{'/api/asfalto':{target:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`,ws:true}}}});await vite.listen();
const browser=await chromium.launch(),errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function shot(p:Page,name:string){await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));}
async function setup(p:Page){
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:12}}));
 await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.o.callback({credential:this.o.nonce});t.append(b)}}}};`}));
 await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
 await p.goto(origin+'/?test');await p.waitForFunction(()=>!!window.__game);
}
async function login(p:Page){await p.click('#account-btn');await p.click('#qa-google');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await p.click('#account-modal .close-btn');}
async function steal(p:Page){
 await p.keyboard.down('w');await p.evaluate(()=>window.advanceTime(1200));await p.keyboard.up('w');
 const view=await state(p);assert.equal(view.player.bikeId,'policial');assert.equal(view.player.recovery,null);assert.equal(view.save.policeBikeUnlocked,false);
 assert.equal(view.player.weaponId,'chain');assert.equal(view.player.kneePadId,'gold');assert.equal(view.player.nitro,0);
 assert.equal(view.riders.find((r:{id:string})=>r.id==='police').recovery.bikeTaken,true);
}
async function arrive(p:Page){
 await p.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders[0].z=8399.9;s.riders[0].speed=40;window.__game!.restore(JSON.stringify(s));window.advanceTime(17);});
 if(await p.locator('#finish-skip').isVisible())await p.click('#finish-skip');
 await p.locator('#result-modal[open] .police-bike-unlock').waitFor();
}
try{
 for(const [name,width,height,mobile] of [['desktop',1440,900,false],['mobile',390,844,true],['small',320,568,true]] as const){
  const p=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});await setup(p);
  await p.click('#garage-btn');assert.equal(await p.locator('[data-bike="policial"]').count(),0);await p.click('[data-close="garage-modal"]');await p.click('#start-btn');
  const {s}=theftFixture();await p.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));await shot(p,`${name}-before`);
  await steal(p);await shot(p,`${name}-stolen`);
  const balance=(await state(p)).save.cash;await arrive(p);let view=await state(p);assert.equal(view.save.policeBikeUnlocked,true);assert.equal(view.payout.policeBikeUnlocked,true);assert.equal(view.save.cash,balance+view.result.reward);assert.equal(view.save.bike,'ferro');
  await shot(p,`${name}-unlocked`);assert.ok(await p.locator('#result-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await p.click('#result-menu-btn');await p.reload();await p.waitForFunction(()=>!!window.__game);
  assert.equal((await state(p)).save.policeBikeUnlocked,true);await p.click('#garage-btn');
  const card=p.locator('.bike-card').filter({has:p.locator('[data-bike="policial"]')});await card.scrollIntoViewIfNeeded();
  assert.match(await card.innerText(),/Patrulha 900/);assert.ok(!(await card.innerText()).includes('PEDALADAS'));await shot(p,`${name}-garage`);
  await p.click('[data-bike="policial"]');await p.click('[data-close="garage-modal"]');
  await p.click('#online-btn');assert.equal(await p.locator('#online-bike option[value="policial"]').count(),0);assert.equal(await p.locator('#online-bike').inputValue(),'ferro');await p.click('#online-close');
  await p.click('#start-btn');view=await state(p);assert.equal(view.player.bikeId,'policial');assert.equal(view.player.integrity,57);assert.equal(view.player.weaponId,null);assert.equal(view.player.kneePadId,null);
  await p.evaluate(()=>window.advanceTime(3550));await p.keyboard.down('w');await p.evaluate(()=>window.advanceTime(1800));await p.keyboard.up('w');assert.ok((await state(p)).player.speed>20);await shot(p,`${name}-equipped`);await p.close();
 }
 // Defeating/abandoning after the theft does not add the motorcycle to the garage.
 const fail=await browser.newPage();await setup(fail);await fail.click('#start-btn');const failed=theftFixture();await fail.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(failed.s));await steal(fail);
 await fail.click('#pause-btn');await fail.click('#menu-btn');await fail.reload();await fail.waitForFunction(()=>!!window.__game);assert.equal((await state(fail)).save.policeBikeUnlocked,false);await fail.close();
 // Official account: replay the walking/mounting, resume, finish, then read on another device.
 const account=await browser.newPage({viewport:{width:1280,height:900}});await setup(account);await login(account);
 const run=accounts.economy.start(identity.id,{trackId:'costa',condition:'day',revision:db.cloud(identity.id).revision});
 const verified=theftFixture(run.initial!);db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(verified.s),run.id);
 await account.reload();await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await account.click('#start-btn');await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');offset+=5000;
 await steal(account);
 // Checkpoint comes from the official command replay, not the browser snapshot.
 const checkpoint=account.waitForResponse(r=>r.url().endsWith('/checkpoint')&&r.request().method()==='POST');
 await account.evaluate(()=>window.advanceTime(1817));assert.equal((await checkpoint).status(),200);
 const recorded=accounts.economy.start(identity.id,{});assert.ok(recorded.initial!.riders[0].stolenPoliceBike);assert.equal(recorded.initial!.riders[0].bikeId,'policial');
 recorded.initial!.riders[0].z=8399.9;recorded.initial!.riders[0].speed=40;
 db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(recorded.initial),run.id);
 await account.reload();await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await account.click('#start-btn');await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');offset+=2000;await account.evaluate(()=>window.advanceTime(17));
 await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.policeBikeUnlocked);if(await account.locator('#finish-skip').isVisible())await account.click('#finish-skip');await account.locator('.police-bike-unlock').waitFor();await shot(account,'account-unlocked');
 const other=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await setup(other);await login(other);assert.equal((await state(other)).save.policeBikeUnlocked,true);await other.click('#online-btn');assert.equal(await other.locator('#online-bike option[value="policial"]').count(),0);await shot(other,'account-online-excluded');
 assert.deepEqual(errors,[]);console.log('PASS patrol theft: walking pickup, mounted finish, no extra rewards/gear, damage/garage/reload, desktop/mobile, multiplayer exclusion, abandonment and authoritative account replay/second device.');
}catch(error){for(const [i,p] of browser.contexts().flatMap(c=>c.pages()).entries())await shot(p,`failure-${i}`).catch(()=>{});throw error;}
finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await vite.close();await app.close();db.close();}
