import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {KNEE_PADS} from '../src/game/equipment';
import {freshSave,SAVE_KEY} from '../src/game/save';

const remote=process.env.QA_URL,base=remote||'http://127.0.0.1:4388/',folder=process.env.QA_DIR||'output/knee-progression';
await fs.mkdir(folder,{recursive:true});
const db=remote?null:new AccountsDB(':memory:'),identity=db?.login('knee-browser');
const seed={...freshSave(),cash:20000,races:1};
if(db&&identity)db.save(identity.id,0,seed,'trusted-knee-browser');
const accounts=db?new AccountService({db,clientId:'qa.apps.googleusercontent.com',origins:[new URL(base).origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'knee-browser';}}):undefined;
const game=remote?null:createGameServer(new MemoryStore(),{accounts,origins:[new URL(base).origin]});
if(game){game.server.listen(0,'127.0.0.1');await once(game.server,'listening');}
const vite=game?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4388','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(game.server.address() as any).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(p:Page,name:string)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
const shop=async(p:Page)=>{await p.click('#garage-btn');await p.click('[data-garage-tab="knees"]');};
async function page(mobile=false,save=seed){
  const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('400 (Bad Request)'))errors.push(m.text());});
  await p.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,save});
  if(!remote){
    await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
    await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.options=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.options.callback({credential:this.options.nonce});t.append(b)}}}};`}));
  }
  await p.goto(base+'?test');await p.waitForFunction(()=>!!window.__game);return p;
}
async function purchase(p:Page,id:string){await p.click(`[data-knee-pad="${id}"]`);await p.waitForFunction(id=>JSON.parse(window.render_game_to_text()).save.kneePadId===id,id);}
async function login(p:Page){await p.click('#account-btn');await p.click('#qa-google');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await p.click('#account-modal .close-btn');}
try{
  const p=await page();await shop(p);await shot(p,'desktop-locked');
  assert.match(await p.locator('.knee-card').last().innerText(),/Compre a roxa/);
  // Enabling a disabled button cannot bypass the shared guest purchase rule.
  await p.locator('[data-knee-pad="gold"]').evaluate((el:any)=>{el.disabled=false;el.click();});
  assert.equal((await state(p)).save.cash,20000);assert.deepEqual((await state(p)).save.ownedKneePads,[]);
  await p.reload();await shop(p);
  for(let i=0;i<KNEE_PADS.length;i++){
    for(const locked of KNEE_PADS.slice(i+1))assert.ok(await p.locator(`[data-knee-pad="${locked.id}"]`).isDisabled());
    await purchase(p,KNEE_PADS[i].id);
    if(i===2){await p.reload();await shop(p);await shot(p,'blue-unlocks-purple');}
  }
  assert.equal((await state(p)).save.cash,10450);await purchase(p,'white');await purchase(p,'gold');assert.equal((await state(p)).save.cash,10450);await shot(p,'all-owned');
  await p.click('[data-close="garage-modal"]');await p.click('#start-btn');await p.keyboard.down('ArrowUp');await p.evaluate(()=>window.advanceTime(8000));await p.keyboard.up('ArrowUp');
  assert.equal((await state(p)).player.kneePadId,'gold');assert.ok((await state(p)).player.speed>0);await shot(p,'equipped-in-race');
  const m=await page(true);await shop(m);await m.locator('[data-knee-pad="white"]').scrollIntoViewIfNeeded();await shot(m,'mobile-locked');assert.ok(await m.locator('#garage-modal').evaluate(e=>e.scrollWidth<=e.clientWidth));await purchase(m,'white');assert.ok(await m.locator('[data-knee-pad="green"]').isEnabled());
  const legacy=await page(false,{...seed,cash:0,ownedKneePads:['gold'],kneePadId:'gold'} as typeof seed);
  await shop(legacy);await legacy.click('#remove-knee');await purchase(legacy,'gold');assert.equal((await state(legacy)).save.cash,0);assert.deepEqual((await state(legacy)).save.ownedKneePads,['gold']);await shot(legacy,'legacy-gold');
  if(db&&identity){
    const a=await page();await login(a);await shop(a);
    const response=await a.evaluate(async()=>{const s=await(await fetch('/api/asfalto/account/session')).json();const r=await fetch('/api/asfalto/account/action',{method:'POST',headers:{'Content-Type':'application/json','X-Asfalto-CSRF':s.csrf},body:JSON.stringify({revision:s.cloud.revision,request:crypto.randomUUID(),action:{kind:'knee',item:'gold'}})});return {status:r.status,body:await r.text()};});
    assert.equal(response.status,400);assert.match(response.body,/joelheira roxa/);assert.equal(db.cloud(identity.id).save!.cash,20000);
    for(const pad of KNEE_PADS)await purchase(a,pad.id);
    assert.equal(db.cloud(identity.id).save!.cash,10450);await shot(a,'account-gold');
    const other=await page(true);await login(other);assert.equal((await state(other)).save.cash,10450);assert.deepEqual((await state(other)).save.ownedKneePads,KNEE_PADS.map(p=>p.id));
  }
  assert.deepEqual(errors,[]);console.log('PASS: locked tiers with sufficient funds, complete purchase order, reload, free re-equipping, legacy items, mobile, equipped in race'+(db?', authoritative API and second device':''));
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();vite?.kill('SIGTERM');await game?.close();db?.close();}
