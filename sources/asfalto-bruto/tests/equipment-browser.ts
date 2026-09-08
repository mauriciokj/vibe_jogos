import {chromium, type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {BIKES} from '../src/game/bikes';
import {KNEE_PADS} from '../src/game/equipment';
import {TAUNTS} from '../src/game/banter';
import {buyBike,buyKneePad,buyNitro,freshSave,SAVE_KEY} from '../src/game/save';

const folder='output/equipment';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4360','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4360/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true});
const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:1280,height:800}}),errors:string[]=[];
function observe(p:Page){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}observe(a);observe(b);
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(name:string,p=a)=>p.screenshot({path:`${folder}/${name}.png`});
const back=async(p=a)=>{await p.click('#pause-btn');await p.click('#menu-btn');};
const fixture=async(p=a,z=1320)=>p.evaluate(z=>{
  const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.countdown=0;s.time=20;s.tick=1200;s.heat=0;s.traffic=[];s.obstacles=[];s.riders=s.riders.slice(0,4);
  s.riders.forEach((r:any,i:number)=>Object.assign(r,{z:z+(i===0?0:i===1?20:-25-i*20),x:i===0?0:4,speed:40,health:100,integrity:100,immune:0,crash:0,kneeTime:0,nitroTime:0,attack:null,out:undefined,finishedAt:null}));
  window.__game!.restore(JSON.stringify(s));
},z);
const doubleLeft=async(p=a)=>{await p.keyboard.press('a');await p.keyboard.down('a');};
try{
  await a.goto(base+'?test');await a.click('#garage-btn');await a.click('[data-garage-tab="knees"]');
  assert.equal(await a.locator('[data-knee-pad]').count(),5);assert.ok(await a.locator('[data-knee-pad="blue"]').isDisabled());
  await a.click('[data-knee-pad="white"]');assert.equal((await state()).save.cash,200);await a.reload();assert.equal((await state()).save.kneePadId,'white');
  const rich=freshSave();rich.cash=100000;rich.races=1;for(const bike of BIKES)buyBike(rich,bike.id);buyBike(rich,'ferro');
  await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:rich});await a.reload();
  await a.click('#garage-btn');await a.click('[data-garage-tab="knees"]');
  for(const pad of KNEE_PADS)await a.click(`[data-knee-pad="${pad.id}"]`);
  const cash=(await state()).save.cash;await a.click('[data-knee-pad="white"]');await a.click('[data-knee-pad="gold"]');assert.equal((await state()).save.cash,cash);await shot('shop-kneepads');
  await a.setViewportSize({width:390,height:844});await shot('shop-kneepads-mobile');assert.ok(await a.locator('#garage-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await a.setViewportSize({width:1440,height:900});
  await a.click('[data-garage-tab="nitro"]');
  for(const [id,count] of [['ferro',2],['brutal',5],['veneno',3]] as const){await a.selectOption('#nitro-bike',id);for(let i=0;i<count;i++)await a.click('#buy-nitro');assert.ok(await a.locator('#buy-nitro').isDisabled());assert.equal((await state()).save.nitro[id],count);if(id==='brutal')await shot('shop-nitro');}
  await a.selectOption('#nitro-bike','ferro');await a.click('[data-close="garage-modal"]');await a.reload();assert.equal((await state()).save.nitro.ferro,2);assert.equal((await state()).save.ownedKneePads.length,5);
  await a.click('[data-route="costa:day"]');await a.click('#start-btn');await fixture();assert.equal((await state()).player.kneeSupport,0);
  await doubleLeft();await a.evaluate(()=>window.advanceTime(17));assert.ok((await state()).player.kneeSupport>.9);await shot('knee-left');await a.keyboard.up('a');
  await a.keyboard.press('q');await a.evaluate(()=>window.advanceTime(17));assert.ok(TAUNTS.includes((await state()).player.speech));await shot('taunt');
  await a.keyboard.press('b');await a.evaluate(()=>window.advanceTime(17));assert.ok(await a.evaluate(()=>JSON.parse(window.__game!.snapshot()).events.some((e:any)=>e.type==='horn')));
  await a.keyboard.press('d');await a.evaluate(()=>window.advanceTime(17));await a.keyboard.up('d');
  await fixture(a,0);await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders[0].speed=64;window.__game!.restore(JSON.stringify(s));});
  await a.keyboard.press('n');await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(1000));assert.equal((await state()).player.nitro,1);assert.equal((await state()).save.nitro.ferro,1);assert.ok((await state()).player.speed>64);await shot('nitro-running');
  await a.keyboard.press('n');await a.evaluate(()=>window.advanceTime(17));assert.equal((await state()).player.nitro,1);await a.keyboard.up('w');
  await a.click('#pause-btn');const frozen=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(1000));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),frozen);
  await a.click('#restart-btn');assert.equal((await state()).player.nitro,1);await back();await a.reload();assert.equal((await state()).save.nitro.ferro,1);
  await a.click('#garage-btn');await a.click('[data-bike="lobo"]');await a.click('[data-close="garage-modal"]');await a.click('#start-btn');await fixture();await doubleLeft();await a.evaluate(()=>window.advanceTime(17));await a.keyboard.up('a');assert.equal((await state()).player.kneeTime,0);await shot('chopper-no-knee');await back();
  await a.click('#garage-btn');await a.click('[data-bike="ferro"]');await a.click('[data-close="garage-modal"]');await a.click('[data-route="costa:rain"]');await a.click('#start-btn');await fixture();await doubleLeft();await a.evaluate(()=>window.advanceTime(17));await a.keyboard.up('a');assert.equal((await state()).player.falls,1);assert.ok((await state()).player.crash>0);await shot('rain-fall');await back();
  // Native multi-touch: steering and throttle at the same time, including the double flick.
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});observe(mobile);
  const mobileSave=freshSave();mobileSave.cash=10000;mobileSave.races=1;buyKneePad(mobileSave,'gold');buyNitro(mobileSave);mobileSave.raceCondition='day';
  await mobile.goto(base+'?test');await mobile.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:mobileSave});await mobile.reload();await mobile.click('#start-btn');await fixture(mobile);
  const cd=await mobile.context().newCDPSession(mobile),left=(await mobile.locator('#steering-stick').boundingBox())!,right=(await mobile.locator('#drive-stick').boundingBox())!;
  const centerL={x:left.x+left.width/2,y:left.y+left.height/2,id:1},centerR={x:right.x+right.width/2,y:right.y+right.height/2,id:2};
  let touchAt=Date.now()/1000;
  const touch=async(type:'touchStart'|'touchMove'|'touchEnd',l=centerL,r=centerR)=>{
    touchAt+=.04;
    await cd.send('Input.dispatchTouchEvent',{type,timestamp:touchAt,touchPoints:type==='touchEnd'?[]:[l,r]});
    // Allow each neutral/deflected position to be delivered before the next;
    // timestamps retain the 40ms human gesture even on a busy test machine.
    await mobile.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  };
  await touch('touchStart');await touch('touchMove',{...centerL,x:centerL.x-28},{...centerR,y:centerR.y-28});await touch('touchMove',centerL,{...centerR,y:centerR.y-28});await touch('touchMove',{...centerL,x:centerL.x-28},{...centerR,y:centerR.y-28});
  await mobile.evaluate(()=>window.advanceTime(17));await shot('mobile-analogs',mobile);assert.ok((await state(mobile)).player.kneeSupport>.9,JSON.stringify((await state(mobile)).player));assert.ok(Number(await mobile.locator('#drive-stick').getAttribute('aria-valuenow'))>90);
  await mobile.keyboard.press('Escape');await mobile.click('#resume-btn');
  await touch('touchMove',{...centerL,x:centerL.x-28},{...centerR,y:centerR.y-28});
  assert.equal(await mobile.locator('#steering-stick').getAttribute('aria-valuenow'),'0','Pausing cancels the captured steering finger');
  assert.equal(await mobile.locator('#drive-stick').getAttribute('aria-valuenow'),'0','Pausing cancels the captured accelerator finger');
  await touch('touchEnd');assert.equal(await mobile.locator('#steering-stick').getAttribute('aria-valuenow'),'0');assert.equal(await mobile.locator('#drive-stick').getAttribute('aria-valuenow'),'0');
  await mobile.click('#touch-nitro');await mobile.evaluate(()=>window.advanceTime(17));assert.equal((await state(mobile)).player.nitro,0);
  assert.equal(await mobile.locator('[data-touch="ArrowLeft"],[data-touch="ArrowRight"],[data-touch="KeyW"],[data-touch="KeyS"],[data-touch="KeyB"],[data-touch="KeyQ"]').count(),0);
  await mobile.setViewportSize({width:844,height:390});await shot('mobile-landscape',mobile);await mobile.close();
  // Purchased loadouts in a real room; actions and consumption survive reload.
  await a.click('[data-route="costa:day"]');await a.click('#online-btn');await a.fill('#online-name','Ana');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  const blue=freshSave();blue.cash=10000;buyBike(blue,'falcao');buyKneePad(blue,'blue');buyNitro(blue);
  await b.goto(base+'?test');await b.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:blue});await b.goto(base+`?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;assert.equal((await state()).awareness.racers.length,8);assert.equal((await state()).player.kneePadId,'gold');assert.equal((await state(b)).player.kneePadId,'blue');
  await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:i<2?1320:2000+i*20,x:i===0?0:3,speed:40,crash:0,immune:0,health:100,integrity:100,attack:null}));});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.z>1300);await doubleLeft();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.kneeSupport>.5);await a.keyboard.up('a');
  await b.keyboard.press('q');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.speech));await a.keyboard.press('b');await a.keyboard.press('n');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.nitroUsed===1);assert.equal((await state()).save.nitro.ferro,0);await shot('online-equipment');
  await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).online.id,aid);assert.equal((await state()).player.kneePadId,'gold');assert.equal((await state()).player.nitro,0);assert.equal((await state()).save.nitro.ferro,0);
  assert.equal((await state(b)).online.id,bid);assert.equal((await state(b)).save.nitro.falcao,1);
  for(const p of [a,b])await back(p);
  assert.deepEqual(errors,[]);const report={ok:true,checks:['5 colors and prices','purchase, equipment, save migration','2/3/5 nitro capacities','double-tap knee animation','chopper restriction','fall in rain','nitro power and permanent consumption','B horn and Q bubble','native simultaneous analog touch','pause cancels held touch controls','2 humans + 6 bots','shared loadouts and actions','reconnect without replenishment or duplicate debit'],errors};await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();await app.close();vite.kill('SIGTERM');}
