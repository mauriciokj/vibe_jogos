import { chromium, type Page } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRace } from '../src/game/simulation';

const folder='output/combat-rewards',port=4388;
await fs.mkdir(folder,{recursive:true});
const vite=await preview({preview:{host:'127.0.0.1',port,strictPort:true}});
const browser=await chromium.launch(),errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function shot(p:Page,name:string){await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));}
async function setup(p:Page){
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:12}}));
 await p.route('**/api/asfalto/account/session',r=>r.fulfill({json:{account:null,csrf:'qa',clientId:''}}));
 await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
 await p.goto(`http://127.0.0.1:${port}/?test`);await p.waitForFunction(()=>!!window.__game);
}
async function fixture(p:Page){
 const s=createRace('costa',undefined,91,'day');s.mode='racing';s.countdown=0;s.time=30;s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,2);
 Object.assign(s.riders[0],{x:0,z:500,speed:0});Object.assign(s.riders[1],{x:2.1,z:500,speed:0,health:1});
 await p.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
}
async function punch(p:Page){await p.keyboard.down('j');await p.evaluate(()=>window.advanceTime(250));await p.keyboard.up('j');}
async function remount(p:Page,police=false){await p.evaluate(police=>{
 const s=JSON.parse(window.__game!.snapshot()),p=s.riders[0],target=s.riders[1];delete target.recovery;
 Object.assign(target,{crash:0,immune:0,health:1,attack:null,speed:0,x:p.x+2.1,z:p.z,...(police?{profile:'police'}:{})});p.cooldown=0;p.attack=null;window.__game!.restore(JSON.stringify(s));
},police);}
try{
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['small',320,568]] as const){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500});await setup(p);await p.click('#start-btn');await fixture(p);
  await punch(p);assert.equal((await state(p)).player.rivalBonus,50);assert.equal((await state(p)).player.policeBonus,0);assert.match(await p.locator('#race-message').innerText(),/RIVAL DERRUBADO · \+50 MOEDAS/);await shot(p,`${name}-rival`);
  await remount(p);await punch(p);assert.equal((await state(p)).player.rivalBonus,100);
  await remount(p,true);await punch(p);assert.equal((await state(p)).player.policeBonus,500);assert.equal((await state(p)).player.rivalBonus,100);await shot(p,`${name}-police`);
  await p.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders[0].z=8399.9;s.riders[0].speed=40;window.__game!.restore(JSON.stringify(s));window.advanceTime(17);});
  if(await p.locator('#finish-skip').isVisible())await p.click('#finish-skip');await p.locator('#result-modal[open]').waitFor();
  let v=await state(p);assert.equal(v.payout.baseReward,1400);assert.equal(v.payout.rivalBonus,100);assert.equal(v.payout.policeBonus,500);assert.equal(v.payout.total,2000);assert.equal(v.save.cash,2650);
  assert.match(await p.locator('.rival-bonus').innerText(),/2 derrubadas × 50 moedas/);assert.match(await p.locator('.police-bonus').innerText(),/1 derrubada × 500 moedas/);assert.match(await p.locator('.prize').innerText(),/2.000/);
  assert.ok(await p.locator('#result-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await shot(p,`${name}-result`);
  await p.click('#result-menu-btn');await p.reload();await p.waitForFunction(()=>!!window.__game);assert.equal((await state(p)).save.cash,2650);
  await p.click('#start-btn');await fixture(p);await punch(p);await p.click('#pause-btn');await p.click('#menu-btn');assert.equal((await state(p)).save.cash,2700);
  await p.reload();await p.waitForFunction(()=>!!window.__game);assert.equal((await state(p)).save.cash,2700);await p.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS combat rewards: actual repeated rival falls, exclusive police bonus, placement plus both bonuses, HUD/results, reload and abandonment in desktop/390/320px.');
}catch(e){for(const [i,p] of browser.contexts().flatMap(c=>c.pages()).entries())await shot(p,`failure-${i}`).catch(()=>{});throw e;}
finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await new Promise<void>(resolve=>vite.httpServer.close(()=>resolve()));}
