import { chromium,type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { AccountService } from '../server/accounts';
import { AccountsDB } from '../server/accounts-db';
import { MemoryStore } from '../server/store';
import { freshSave } from '../src/game/save';
import { stepRace } from '../src/game/simulation';
import { safeDrivingCommand } from './driving';
import { BIKES } from '../src/game/content';
import { NITRO_PRICE } from '../src/game/equipment';
import { GAME_VERSION } from '../src/version';
import type { Command, RaceState } from '../src/game/types';

const folder='output/economy-qa',origin='http://127.0.0.1:4381';await fs.mkdir(folder,{recursive:true});
const db=new AccountsDB(':memory:'),identity=db.login('qa-beta'),legacy=freshSave();legacy.cash=50000;legacy.kneePadId='gold';legacy.ownedKneePads=['gold'];legacy.races=10;
db.save(identity.id,0,legacy,'trusted-beta-browser');let now=Date.now();
const accounts=new AccountService({db,now:()=>now,clientId:'qa.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'qa-beta';}});
const game=createGameServer(new MemoryStore(),{accounts,origins:[origin]});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4381','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(game.server.address() as {port:number}).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),desktop=await browser.newContext({viewport:{width:1280,height:900}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const p=await desktop.newPage(),m=await mobile.newPage(),errors:string[]=[];
const state=(page:Page)=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function setup(page:Page){
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
  await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.options=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.options.callback({credential:this.options.nonce});t.append(b)}}}};`}));
  await page.addInitScript(()=>{sessionStorage.setItem('asfalto-instructions','1');});
  await page.goto(origin+'/?test');await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
}
async function login(page:Page){await page.click('#account-btn');await page.click('#qa-google');await page.locator('#account-nickname').waitFor();await page.click('#account-modal .close-btn');}
async function shot(page:Page,name:string){await page.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(page),null,2));}
try{
  await setup(p);await setup(m);
  await p.click('#version-btn');assert.match(await p.locator('#releases-modal').innerText(),new RegExp(GAME_VERSION));
  assert.ok(await p.locator('#releases-modal details').count()>35);await shot(p,'desktop-history');await p.keyboard.press('Escape');assert.equal(await p.locator('#version-btn').evaluate(e=>e===document.activeElement),true);
  await m.click('#version-btn');await shot(m,'mobile-history');await m.click('#releases-modal .close-btn');await shot(m,'mobile-menu');
  await login(p);await login(m);assert.equal((await state(p)).save.cash,50000);assert.equal((await state(m)).save.cash,50000);
  await p.evaluate(()=>{const id=localStorage.getItem('asfalto:account:active')!,key=`asfalto:account:${id}`,cache=JSON.parse(localStorage.getItem(key)!);cache.save.cash=1e8;cache.save.owned=['ferro','brutal'];cache.save.bikeId='brutal';cache.dirty=true;localStorage.setItem(key,JSON.stringify(cache));});
  await p.reload();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);assert.equal((await state(p)).save.cash,50000);assert.equal((await state(p)).player.bikeId,'ferro');
  const rejection=await p.evaluate(async()=>{const s=await(await fetch('/api/asfalto/account/session')).json();const r=await fetch('/api/asfalto/account/save',{method:'POST',headers:{'Content-Type':'application/json','X-Asfalto-CSRF':s.csrf},body:JSON.stringify({revision:s.cloud.revision,request:'forged-browser-save',save:{...s.cloud.save,cash:1e8}})});return r.status;});
  assert.equal(rejection,409);assert.equal(db.cloud(identity.id).save!.cash,50000);
  const second=BIKES.filter(b=>b.price>0).sort((a,b)=>a.price-b.price)[0];
  await p.click('#garage-btn');await p.click(`[data-bike="${second.id}"]`);await p.waitForFunction(cash=>JSON.parse(window.render_game_to_text()).save.cash===cash,50000-second.price);
  await p.click('[data-garage-tab="nitro"]');
  let lost=true;await p.route('**/account/action',async route=>{if(lost&&route.request().postDataJSON().action?.kind==='nitro'){lost=false;await route.fetch();await route.abort();}else await route.continue();});
  const before=db.cloud(identity.id).save!.cash;
  await p.click('#buy-nitro');await p.waitForFunction(()=>document.querySelector('#account-status')!.textContent!.includes('não confirmada'));
  await p.click('#buy-nitro');await p.waitForFunction(cash=>JSON.parse(window.render_game_to_text()).save.cash===cash,before-NITRO_PRICE);
  assert.equal(db.cloud(identity.id).save!.nitro![second.id],1);assert.equal(db.cloud(identity.id).save!.cash,before-NITRO_PRICE);
  await p.unroute('**/account/action');await p.click('[data-close="garage-modal"]');
  await m.reload();await m.waitForFunction(cash=>JSON.parse(window.render_game_to_text()).save.cash===cash,before-NITRO_PRICE);
  // Drive the actual shared simulation with recorded commands, not forged results.
  const started=p.waitForResponse(r=>r.url().endsWith('/account/start'));await p.click('#start-btn');const run=await(await started).json();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const simulation=structuredClone(run.initial) as RaceState,segments:{command:Command;count:number}[]=[];
  while(simulation.mode!=='finished'&&simulation.tick<72000){const command=safeDrivingCommand(simulation),last=segments.at(-1);if(last&&JSON.stringify(last.command)===JSON.stringify(command))last.count++;else segments.push({command,count:1});stepRace(simulation,{player:command});}
  now+=simulation.tick/60*1000+2000;
  await p.evaluate(segments=>{for(const s of segments)window.__game!.command(s.command,s.count,false);},segments);
  await p.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).account.rankedRace,{},{timeout:45000});
  assert.equal(db.cloud(identity.id).save!.races,11);await p.evaluate(()=>window.advanceTime(7000));await shot(p,'verified-finish');
  await p.click('#result-menu-btn');await p.click('#championship-btn');await p.click('#champ-start');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  now+=12000;await p.keyboard.down('ArrowUp');await p.evaluate(()=>window.advanceTime(9500));await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(700);await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await p.waitForTimeout(700);
  const progress=db.cloud(identity.id).save!.championship!.checkpoint!;assert.ok(progress.tick>400);
  await p.reload();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await p.click('#championship-btn');await p.click('#champ-start');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(p)).tick,progress.tick);
  await shot(p,'resumed-championship');
  await p.click('#pause-btn');await p.click('#menu-btn');await p.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).championship.settling,{},{timeout:45000});
  assert.equal(db.cloud(identity.id).save!.championship!.heats.length,1);assert.equal(db.cloud(identity.id).save!.championship!.heats[0].finishes.find(f=>f.id==='player')!.place,null);
  await p.evaluate(()=>window.advanceTime(7000));await p.click('#champ-menu');
  await p.click('#start-btn');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const firstRestart=String(db.db.prepare('SELECT id FROM economy_runs WHERE completed=0').get()!.id);
  await p.click('#pause-btn');await p.click('#restart-btn');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race'&&!JSON.parse(window.render_game_to_text()).paused);
  assert.notEqual(db.db.prepare('SELECT id FROM economy_runs WHERE completed=0').get()!.id,firstRestart,'restart abandons the prior run before reserving the next');
  await p.click('#pause-btn');await p.click('#menu-btn');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='menu');
  await p.click('#online-btn');await p.click('#online-create');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await shot(p,'account-lobby');await p.click('#online-leave');
  await p.click('#account-btn');await p.click('[data-logout]');await p.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).account.signedIn);await p.click('#account-modal .close-btn');await p.click('#start-btn');await p.keyboard.down('ArrowUp');await p.evaluate(()=>window.advanceTime(5000));await p.keyboard.up('ArrowUp');assert.ok((await state(p)).player.speed>0);await shot(p,'guest-race');
  await m.setViewportSize({width:320,height:740});await m.reload();await m.click('#version-btn');assert.ok(await m.locator('#releases-modal').evaluate(e=>e.scrollWidth<=e.clientWidth));await shot(m,'small-mobile-history');
  assert.deepEqual(errors,[]);
  await fs.writeFile(folder+'/report.json',JSON.stringify({ok:true,version:GAME_VERSION,checks:['clickable history and keyboard focus','desktop/mobile/320px','trusted beta garage preserved','edited localStorage replaced even at equal revision','forged API save denied','server purchases','lost reply retry charged once','two devices','verified reward','championship checkpoint resume and abandonment','account multiplayer lobby','guest solo preserved'],errors},null,2));
  console.log('Economy browser QA passed');
}finally{await browser.close();vite.kill('SIGTERM');await game.close();db.close();}
