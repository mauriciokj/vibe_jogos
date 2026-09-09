import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { createRace, finishRider } from '../src/game/simulation';
import { getTrack } from '../src/game/content';
import { EMPTY_COMMAND } from '../src/game/types';

const live=process.env.PUBLIC_URL,folder=process.env.FINISH_OUTPUT ?? 'output/finish';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=live?null:createGameServer(store,{now:()=>Date.now()+offset});
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4386','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
const base=live ?? 'http://127.0.0.1:4386/';
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:live?['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']:[]});
const errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=(p:Page,ms:number)=>p.evaluate(ms=>window.advanceTime(ms),ms);
const shot=(p:Page,name:string)=>p.screenshot({path:`${folder}/${name}.png`});
async function setup(p:Page){
  p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  if(!live)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:42}}));
  await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
  await p.goto(base+'?test',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__game);await p.evaluate(()=>document.fonts.ready);
}
function fixture(track='costa',rivalWon=false,condition:'day'|'rain'|'night'='day'){
  const s=createRace(track,undefined,77,condition),end=getTrack(track).distance;s.mode='racing';s.time=120;s.tick=7200;s.countdown=0;s.traffic=[];s.obstacles=[];
  s.riders.forEach((r,i)=>Object.assign(r,{z:end-35-i*30,x:i%2?-2.7:2.7,speed:50,crash:0,immune:0}));
  if(rivalWon)Object.assign(s.riders[1],{z:end,finishedAt:112,speed:0});
  return s;
}
async function restore(p:Page,s:ReturnType<typeof createRace>){await p.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));}
try{
  for(const [name,width,height,mobile] of [['desktop',1440,900,false],['portrait',390,844,true],['small-portrait',320,568,true],['landscape',844,390,true]] as const){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1}),p=await context.newPage();await setup(p);
    const before=(await state(p)).save;
    const s=fixture('costa');await restore(p,s);await shot(p,`${name}-approach`);
    await p.keyboard.down('w');await advance(p,900);await p.keyboard.up('w');
    let view=await state(p);assert.equal(view.screen,'finish');assert.equal(view.finish.winnerId,'player');assert.equal(view.result.place,1);assert.equal(await p.locator('#result-modal').isVisible(),false);assert.equal(await p.locator('#hud').isVisible(),false);
    assert.equal(view.save.cash,before.cash+view.result.reward);assert.equal(view.save.races,before.races+1);
    const frozen=await p.evaluate(()=>window.__game!.snapshot()),cash=view.save.cash;
    await advance(p,1000);await shot(p,`${name}-victory`);
    await advance(p,1500);await shot(p,`${name}-pullback`);assert.ok((await state(p)).finish.pullback>.5);
    await advance(p,2600);view=await state(p);assert.equal(view.screen,'result');assert.equal(view.finish.pullback,1);assert.equal(await p.evaluate(()=>window.__game!.snapshot()),frozen);assert.equal(view.save.cash,cash);
    await shot(p,`${name}-results`);assert.ok(await p.locator('#next-race-btn').isVisible());
    const dialog=await p.locator('#result-modal').boundingBox();assert.ok(dialog&&dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=width+1&&dialog.y+dialog.height<=height+1);
    await p.click('#next-race-btn');assert.equal((await state(p)).track,'serra');assert.equal((await state(p)).condition,'day');assert.equal((await state(p)).mode,'countdown');assert.equal((await state(p)).finish.stage,'none');
    await p.click('#pause-btn');await p.click('#menu-btn');await p.click('#start-btn');
    const second=fixture('porto',true,'rain');second.riders[0].bikeId='lobo';await restore(p,second);assert.equal((await state(p)).finish.winnerId,'rival-0');await shot(p,`${name}-rival-waiting`);
    await p.keyboard.down('w');await advance(p,1100);await p.keyboard.up('w');assert.equal((await state(p)).result.place,2);assert.equal((await state(p)).screen,'finish');
    await advance(p,1800);await shot(p,`${name}-second-place`);await p.click('#finish-skip');assert.equal((await state(p)).screen,'result');
    const secondSnapshot=await p.evaluate(()=>window.__game!.snapshot()),secondCash=(await state(p)).save.cash;
    await advance(p,10000);await shot(p,`${name}-late-arrivals`);
    await advance(p,20000);await shot(p,`${name}-late-arrivals-parked`);
    assert.equal(await p.evaluate(()=>window.__game!.snapshot()),secondSnapshot);assert.equal((await state(p)).save.cash,secondCash);
    await p.click('#again-btn');assert.equal((await state(p)).mode,'countdown');assert.equal((await state(p)).track,'porto');assert.equal((await state(p)).condition,'rain');assert.equal((await state(p)).finish.stage,'none');
    const caught=fixture();caught.riders[0].finishedAt=null;finishRider(caught,caught.riders[0],'caught','fall');await restore(p,caught);await p.evaluate(cmd=>window.__game!.command(cmd,0),EMPTY_COMMAND);
    assert.equal((await state(p)).screen,'result');assert.equal((await state(p)).finish.stage,'none');assert.equal(await p.locator('#result-modal').isVisible(),true);assert.equal(await p.locator('#next-race-btn').count(),0);
    await p.click('#result-menu-btn');assert.equal((await state(p)).screen,'menu');await context.close();
  }
  const locked=await browser.newPage({viewport:{width:1280,height:800}});await setup(locked);
  for(const track of ['costa','terra']){
    const s=fixture(track);s.riders.slice(1,6).forEach((r,i)=>Object.assign(r,{z:getTrack(track).distance,finishedAt:110+i}));
    await restore(locked,s);await locked.keyboard.down('w');await advance(locked,1100);await locked.keyboard.up('w');await locked.click('#finish-skip');
    assert.equal((await state(locked)).result.place,6);assert.equal(await locked.locator('#next-race-btn').count(),0);
  }
  await locked.close();
  // Keep the authoritative multiplayer clock running during one person's camera.
  if(app){
    const host=await browser.newPage({viewport:{width:1440,height:900}}),guest=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await setup(host);await setup(guest);
    await host.click('#online-btn');await host.fill('#online-name','Campeão QA');await host.selectOption('#online-track','costa:night');await host.click('#online-create');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
    const code=(await state(host)).online.code;await guest.click('#online-btn');await guest.fill('#online-name','Piloto QA');await guest.fill('#online-code-input',code);await guest.click('#online-join');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
    await host.click('#online-ready');await guest.click('#online-ready');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
    for(const p of [host,guest])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
    const hostId=(await state(host)).online.id,guestId=(await state(guest)).online.id;
    await store.mutate(code,room=>{const s=room.race!;s.mode='racing';s.countdown=0;s.time=120;s.traffic=[];s.obstacles=[];s.riders.forEach(r=>Object.assign(r,{z:r.id===hostId?8399:8000,x:1.7,speed:50,crash:0,immune:0,integrity:100,health:100}));});
    await host.keyboard.down('w');await guest.keyboard.down('w');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='finish');await host.keyboard.up('w');
    const z=(await state(guest)).player.z;await guest.waitForTimeout(700);assert.ok((await state(guest)).player.z>z);assert.equal((await state(guest)).screen,'race');assert.equal((await state(guest)).finish.winnerId,hostId);
    await shot(host,'online-winner');await advance(host,5000);assert.equal((await state(host)).screen,'result');assert.match(await host.locator('#online-result-status').innerText(),/1 \/ 2/);await shot(host,'online-result');
    await host.click('#online-next-btn');assert.equal(await host.locator('#online-modal').isVisible(),true);assert.equal(await host.inputValue('#online-track'),'serra:night');assert.equal((await state(host)).online,null);
    assert.equal((await state(guest)).online.id,guestId);assert.equal((await state(guest)).screen,'race');
    await guest.keyboard.up('w');await guest.click('#pause-btn');await guest.click('#menu-btn');await host.close();await guest.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${folder}/report.json`,JSON.stringify({ok:true,checks:['winner and rival celebrate','camera before result','reward once','frozen authoritative solo state','late solo arrivals remain parked after second-place finish','next unlocked race','retry and menu','four screen sizes','rain and night','loss skips celebration',...app?['online winner while guest continues','new online track lobby without moving other racer']:[]],errors},null,2));console.log('Finish scenes and result navigation passed');
}finally{await browser.close();await app?.close();vite?.kill('SIGTERM');}
