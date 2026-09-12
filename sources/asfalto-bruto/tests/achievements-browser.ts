import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,SAVE_KEY,unlockBicycle,buyBike} from '../src/game/save';

const folder='output/achievements/browser',origin='http://127.0.0.1:4396';await fs.mkdir(folder,{recursive:true});
let offset=0;const now=()=>Date.now()+offset;
const db=new AccountsDB(':memory:'),identity=db.login('achievement-qa'),seed=freshSave();seed.races=1;
const accounts=new AccountService({db,now,clientId:'qa.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'achievement-qa';}});
const app=createGameServer(new MemoryStore(),{accounts,origins:[origin],now});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4396','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as any).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),errors:string[]=[];const page=await browser.newPage({viewport:{width:1280,height:900}});
const state=(p=page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(name:string,p=page)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
async function prepare(p:typeof page,save=seed){
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
 await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.o.callback({credential:this.o.nonce});t.append(b)}}}};`}));
 await p.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,save});
 await p.goto(origin+'/?test');await p.waitForFunction(()=>typeof window.render_game_to_text==='function');
}
async function login(p:typeof page){await p.click('#account-btn');await p.click('#qa-google');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await p.click('#account-modal .close-btn');}
try{
 await prepare(page);
 const layouts=[];
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[568,320],[667,375],[844,390],[1024,768],[1280,720],[1280,900],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const fit=await page.evaluate(()=>{const menu=document.querySelector('#menu')!,a=document.querySelector('#achievements-btn')!.getBoundingClientRect(),c=document.querySelector('#championship-btn')!.getBoundingClientRect();return {scroll:menu.scrollHeight-menu.clientHeight,overflow:menu.scrollWidth-menu.clientWidth,beside:a.left>=c.right-1,visible:a.right<=innerWidth&&a.bottom<=innerHeight};});
  layouts.push({width,height,...fit});await page.screenshot({path:`${folder}/menu-${width}x${height}.png`});assert.ok(fit.scroll<=1&&fit.overflow<=1&&fit.beside&&fit.visible,JSON.stringify(layouts.at(-1)));
 }
 await fs.writeFile(`${folder}/layouts.json`,JSON.stringify(layouts,null,2));await page.setViewportSize({width:1280,height:900});
 assert.equal(await page.locator('#achievement-count').innerText(),'0 / 25');await page.click('#achievements-btn');assert.equal(await page.locator('.achievement-card').count(),25);assert.equal(await page.locator('.achievement-card.secret').count(),12);assert.ok(!(await page.locator('#achievements-modal').innerText()).includes('Na raça'));await shot('panel-secret');
 await page.click('[data-achievement-filter="earned"]');assert.equal(await page.locator('.achievement-card').count(),0);await page.click('[data-achievement-filter="pending"]');assert.equal(await page.locator('.achievement-card').count(),25);await page.keyboard.press('Escape');assert.equal(await page.locator('#achievements-modal').isVisible(),false);
 await page.click('#start-btn');
 await page.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.time=20;s.riders=s.riders.slice(0,1);Object.assign(s.riders[0],{z:500,x:-1.75,speed:40,wheelieTime:2.4});s.traffic=[{id:'qa-car',kind:'car',x:-1.75,z:520,speed:-20,color:'#a98'}];s.obstacles=[];window.__game!.restore(JSON.stringify(s));window.advanceTime(1200);});
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.__game!.snapshot())).riders[0].feats.carJumps,['qa-car']);
 await page.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders[0].integrity=0;window.__game!.restore(JSON.stringify(s));window.advanceTime(17);});await page.locator('#result-modal[open] .achievement-rewards').waitFor();await shot('jump-reward');
 await page.click('#view-achievements');assert.ok((await page.locator('#achievements-modal').innerText()).includes('Por cima do trânsito'));await page.click('[data-achievement-filter="earned"]');assert.equal(await page.locator('.achievement-card.earned').count(),1);await page.click('[data-close="achievements-modal"]');assert.ok(await page.locator('#result-modal').isVisible());await page.click('#result-menu-btn');await page.reload();assert.equal(await page.locator('#achievement-count').innerText(),'1 / 25');
 // Old bicycle ownership reveals only its confirmed secret, and stock speed is 60 km/h.
 const bicycle=freshSave();bicycle.races=1;unlockBicycle(bicycle,{reason:'finish',onFoot:true,place:8,time:250,reward:0,hits:0,falls:1});buyBike(bicycle,'bicicleta');delete bicycle.achievements;
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await prepare(mobile,bicycle);assert.equal(await mobile.locator('#achievement-count').innerText(),'1 / 25');await mobile.click('#achievements-btn');assert.equal(await mobile.locator('.achievement-card.secret').count(),11);await shot('mobile-unlocked-secret',mobile);await mobile.click('[data-close="achievements-modal"]');await mobile.click('#start-btn');await mobile.evaluate(()=>window.advanceTime(3550));
 const rect=await mobile.locator('#drive-stick').boundingBox();assert.ok(rect);for(let i=0;i<20;i++){await mobile.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height*.22);await mobile.evaluate(()=>window.advanceTime(180));}
 const speed=(await state(mobile)).player.speed;assert.ok(speed>15&&speed<=16.68);await shot('mobile-60kmh',mobile);await mobile.click('#pause-btn');await mobile.click('#menu-btn');
 // Real account API replays the final movement; another device reads its badges.
 const account=await browser.newPage({viewport:{width:1280,height:900}});await prepare(account);await login(account);
 const run=accounts.economy.start(identity.id,{trackId:'costa',condition:'rain',revision:db.cloud(identity.id).revision}),s=run.initial!;s.mode='racing';s.time=200;s.countdown=0;s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];Object.assign(s.riders[0],{z:8399.9,speed:40});db.db.prepare('UPDATE economy_runs SET state=? WHERE id=?').run(JSON.stringify(s),run.id);
 await account.reload();await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await account.click('#start-btn');await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');offset+=5000;await account.evaluate(()=>window.advanceTime(17));await account.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.achievements.unlocked.includes('rain-win'));
 if(await account.locator('#finish-skip').isVisible())await account.click('#finish-skip');await account.locator('#result-modal[open] .achievement-rewards').waitFor();await shot('account-reward',account);
 const other=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await prepare(other);await login(other);await other.click('#achievements-btn');await other.click('[data-achievement-filter="earned"]');assert.ok((await other.locator('#achievements-modal').innerText()).includes('Rei da chuva'));assert.ok((await other.locator('#achievements-modal').innerText()).includes('Sem um arranhão'));await shot('account-other-device',other);
 assert.deepEqual(errors,[]);console.log('PASS achievements: 12 menu sizes, secret privacy/filter/close, actual jump + defeat reward, reload, legacy bicycle, mobile 60 km/h, authoritative account reward and second device.');
}catch(e){await shot('failure');throw e;}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();vite.kill('SIGTERM');await app.close();db.close();}
