import {chromium, type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave, buyWeapon, SAVE_KEY} from '../src/game/save';
import {WEAPONS} from '../src/game/weapons';

const folder='output/stunts-weapons';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4361','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4361/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),a=await browser.newPage({viewport:{width:1280,height:800}}),b=await browser.newPage({viewport:{width:1280,height:800}}),errors:string[]=[];
function observe(p:Page){p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});}observe(a);observe(b);
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(name:string,p=a)=>p.screenshot({path:`${folder}/${name}.png`});
const back=async(p=a)=>{await p.click('#pause-btn');await p.click('#menu-btn');};
const advance=(ms:number,p=a)=>p.evaluate(ms=>window.advanceTime(ms),ms);
const fixture=async(p=a,kind='none')=>p.evaluate(kind=>{
  const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.condition='day';s.countdown=0;s.time=20;s.tick=1200;s.heat=0;s.obstacles=[];s.riders=s.riders.slice(0,2);
  s.riders.forEach((r:any,i:number)=>Object.assign(r,{z:i?60:0,x:i?4:-1.7,speed:45,health:100,integrity:100,immune:0,crash:0,wheeliesLeft:3,wheelieTime:0,jumpTime:0,jumpTarget:undefined,kneeTime:0,nitroTime:0,attack:null,cooldown:0,out:undefined,finishedAt:null}));
  s.traffic=kind==='none'?[]:[{id:'jump-car',kind,x:-1.7,z:70,speed:-20,color:'#e5a577'}];window.__game!.restore(JSON.stringify(s));
},kind);
const doubleUp=async(p=a)=>{await p.keyboard.press('w');await p.keyboard.down('w');};
try{
  await a.goto(base+'?test');await a.click('#garage-btn');await a.click('[data-garage-tab="weapons"]');assert.equal(await a.locator('[data-weapon]').count(),3);assert.ok(await a.locator('[data-weapon="chain"]').isDisabled());
  await a.click('[data-weapon="bottle"]');assert.equal((await state()).save.cash,0);await a.reload();assert.equal((await state()).save.weaponId,'bottle');
  const save=freshSave();save.cash=10000;save.races=1;save.raceCondition='day';await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload();
  await a.click('#garage-btn');await a.click('[data-garage-tab="weapons"]');for(const w of WEAPONS)await a.click(`[data-weapon="${w.id}"]`);
  assert.equal((await state()).save.cash,5450);await a.click('[data-weapon="bottle"]');await a.click('[data-weapon="chain"]');assert.equal((await state()).save.cash,5450);await shot('garage');
  await a.setViewportSize({width:390,height:844});await shot('garage-mobile');assert.ok(await a.locator('#garage-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await a.setViewportSize({width:1280,height:800});
  await a.click('[data-close="garage-modal"]');await a.click('#start-btn');await fixture(a,'car');await doubleUp();await advance(17);assert.equal((await state()).player.wheeliesLeft,2);assert.ok((await state()).player.wheelieTime>0);await shot('wheelie');
  await advance(900);assert.ok((await state()).player.jumpHeight>1.4);await shot('jump');await advance(900);assert.equal((await state()).player.falls,0);assert.equal((await state()).player.jumpTime,0);await a.keyboard.up('w');
  await doubleUp();await advance(17);assert.equal((await state()).player.wheeliesLeft,1);await a.keyboard.up('w');await a.click('#pause-btn');const frozen=await a.evaluate(()=>window.__game!.snapshot());await advance(1000);assert.equal(await a.evaluate(()=>window.__game!.snapshot()),frozen);await a.click('#resume-btn');await advance(2500);
  await doubleUp();await advance(17);await a.keyboard.up('w');assert.equal((await state()).player.wheeliesLeft,0);await advance(2500);await doubleUp();await advance(17);await a.keyboard.up('w');assert.equal((await state()).player.wheelieTime,0);
  await a.click('#pause-btn');await a.click('#restart-btn');assert.equal((await state()).player.wheeliesLeft,3);assert.equal((await state()).player.weaponId,'chain');
  await fixture(a,'truck');await doubleUp();await advance(1000);await a.keyboard.up('w');assert.equal((await state()).player.falls,1);await shot('truck-collision');
  // Inspect each actual attack pose and authoritative damage with a fixed rival.
  for(const w of WEAPONS){await back();await a.click('#garage-btn');await a.click('[data-garage-tab="weapons"]');if((await state()).save.weaponId!==w.id)await a.click(`[data-weapon="${w.id}"]`);await a.click('[data-close="garage-modal"]');await a.click('#start-btn');await fixture();
    await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders[0].x=0;s.riders[0].speed=0;Object.assign(s.riders[1],{x:2,z:0,speed:0,profile:'player'});window.__game!.restore(JSON.stringify(s));});
    await a.keyboard.press('l');await advance(17); // A tap in solo must last a frame.
    await a.keyboard.down('l');await advance(150);await shot(`attack-${w.id}`);await a.keyboard.up('l');await advance(350);
    assert.equal((await state()).player.hits>0,true,w.id);assert.ok((await state()).riders[0].health<=100-w.damage+1);
  }
  await back();await a.reload();assert.equal((await state()).save.ownedWeapons.length,3);assert.equal((await state()).save.weaponId,'chain');
  // Native mobile double accelerator flick, with simultaneous steering held.
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});observe(mobile);await mobile.goto(base+'?test&race');await fixture(mobile,'car');
  const cd=await mobile.context().newCDPSession(mobile),left=(await mobile.locator('#steering-stick').boundingBox())!,right=(await mobile.locator('#drive-stick').boundingBox())!;
  const l={x:left.x+left.width/2,y:left.y+left.height/2,id:1},r={x:right.x+right.width/2,y:right.y+right.height/2,id:2};let timestamp=Date.now()/1000;
  const touch=async(type:'touchStart'|'touchMove'|'touchEnd',dy=0)=>{timestamp+=.04;await cd.send('Input.dispatchTouchEvent',{type,timestamp,touchPoints:type==='touchEnd'?[]:[l,{...r,y:r.y+dy}]});await mobile.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));};
  await touch('touchStart');await touch('touchMove',-30);await touch('touchMove',0);await touch('touchMove',-30);await advance(17,mobile);assert.equal((await state(mobile)).player.wheeliesLeft,2);await shot('mobile-wheelie',mobile);await advance(900,mobile);assert.ok((await state(mobile)).player.jumpHeight>1.4);await shot('mobile-jump',mobile);await touch('touchEnd');
  await mobile.setViewportSize({width:844,height:390});await shot('mobile-landscape',mobile);await mobile.close();
  // Real two-human/six-bot room: shared gear, jump, weapon damage and resume.
  await a.click('#online-btn');await a.fill('#online-name','Ana');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  const second=freshSave();second.cash=5000;buyWeapon(second,'bat');await b.goto(base+'?test');await b.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:second});await b.goto(base+`?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;assert.equal((await state()).awareness.racers.length,8);assert.equal((await state()).player.weaponId,'chain');assert.equal((await state(b)).player.weaponId,'bat');
  await store.mutate(code,room=>{const s=room.race!;s.traffic=[{id:'network-car',kind:'car',x:-1.7,z:110,speed:-20,color:'#dba573'}];s.obstacles=[];s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:i<2?0:1200+i*20,x:i===0?-1.7:4,speed:45,crash:0,immune:0,health:100,integrity:100,attack:null}));});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>40);await doubleUp();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.wheeliesLeft===2);await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.jumpTime>0);await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.jumpTime>0));await shot('online-jump');await a.keyboard.up('w');
  await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state()).online.id,aid);assert.equal((await state()).player.wheeliesLeft,2);assert.equal((await state()).player.weaponId,'chain');assert.equal((await state()).player.falls,0);
  await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.riders.forEach((r,i)=>Object.assign(r,{z:i<2?300:1500+i*20,x:i===0?0:4,speed:0,crash:0,immune:0,health:100,integrity:100,attack:null,cooldown:0,wheelieTime:0,jumpTime:0}));});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.z>290);await a.keyboard.press('l');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.hits>0);await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.health<70);assert.equal((await state(b)).player.weaponId,'bat');await shot('online-combat');
  assert.equal((await state(b)).online.id,bid);for(const p of [a,b])await back(p);assert.deepEqual(errors,[]);
  const report={ok:true,checks:['three permanent weapon purchases and free equipment changes','save survives reload and race restart','keyboard wheelie, automatic jump and landing','three activations, pause and exhaustion','truck remains collidable','three distinct combat sprites and damage','native mobile accelerator double flick','2 humans + 6 bots, shared equipment and jumping','reconnect preserves remaining uses and equipment','online chain hit at extended range'],errors};await fs.writeFile(`${folder}/browser-check.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();await app.close();vite.kill('SIGTERM');}
