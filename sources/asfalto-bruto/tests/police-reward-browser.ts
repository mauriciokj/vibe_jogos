import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { createRace, stepRace, finishRider } from '../src/game/simulation';
import { EMPTY_COMMAND, type RaceState } from '../src/game/types';

const folder='output/police-reward';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=await createServer({server:{host:'127.0.0.1',port:4386,strictPort:true,proxy:{'/api/asfalto':{target:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`,ws:true}}}});
await vite.listen();const base='http://127.0.0.1:4386/';
const browser=await chromium.launch(),errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function setup(p:Page){
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:12}}));
  await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
  await p.goto(base+'?test');await p.waitForFunction(()=>!!window.__game);
}
async function shot(p:Page,name:string){await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));}
function officer(s:RaceState,id:string,simultaneous=false){
  s.mode='racing';s.countdown=0;s.time=30;s.traffic=[];s.obstacles=[];s.policeActive=true;
  const p=s.riders.find(r=>r.id===id)!;
  Object.assign(p,{x:0,z:500,speed:0,health:simultaneous?1:100,immune:0,attack:null,cooldown:0});
  const cop={...structuredClone(createRace().riders[1]),id:'qa-police',name:'POLÍCIA',profile:'police' as const,x:simultaneous?.6:2.1,z:500,speed:0,health:1};
  s.riders=s.riders.filter(r=>r.profile!=='police');s.riders.push(cop);
  return {p,cop};
}
async function fixture(p:Page,s:RaceState){await p.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));}
async function reveal(p:Page){if(await p.locator('#finish-skip').isVisible())await p.click('#finish-skip');await p.locator('#result-modal[open]').waitFor();}
try{
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['small',320,568]] as const){
    const p=await browser.newPage({viewport:{width,height}});await setup(p);await p.click('#start-btn');
    const s=createRace('costa',undefined,91,'day');s.riders=s.riders.slice(0,1);officer(s,'player');await fixture(p,s);
    await p.keyboard.down('j');await p.evaluate(()=>window.advanceTime(250));await p.keyboard.up('j');
    assert.equal((await state(p)).player.policeBonus,500);assert.match(await p.locator('#race-message').innerText(),/500 MOEDAS/);
    await shot(p,`${name}-knockdown`);
    // Put the recovered officer back within reach to verify a second actual fall.
    await p.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot()),p=s.riders[0],cop=s.riders[1];delete cop.recovery;Object.assign(cop,{crash:0,immune:0,health:1,attack:null,speed:0,x:p.x+2.1,z:p.z});p.cooldown=0;p.attack=null;window.__game!.restore(JSON.stringify(s));});
    await p.keyboard.down('j');await p.evaluate(()=>window.advanceTime(250));await p.keyboard.up('j');
    assert.equal((await state(p)).player.policeBonus,1000);
    const completed=JSON.parse(await p.evaluate(()=>window.__game!.snapshot())) as RaceState;completed.riders[0].finishedAt=100;finishRider(completed,completed.riders[0],'finish');
    await fixture(p,completed);await p.evaluate(()=>window.__game!.command({throttle:0,brake:0,steer:0,attack:null},0));await reveal(p);
    assert.equal((await state(p)).save.cash,3050);assert.equal((await state(p)).payout.policeBonus,1000);
    assert.match(await p.locator('.police-bonus').innerText(),/2 derrubadas × 500 moedas/);assert.match(await p.locator('.prize').innerText(),/2.400/);
    await shot(p,`${name}-result`);assert.ok(await p.locator('#result-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    await p.evaluate(()=>window.advanceTime(6000));assert.equal((await state(p)).save.cash,3050);
    await p.reload();await p.waitForFunction(()=>!!window.__game);assert.equal((await state(p)).save.cash,3050);
    // Leaving pays only the earned bonus, with no extra workshop income.
    await p.click('#start-btn');const left=createRace();left.riders=left.riders.slice(0,1);officer(left,'player');await fixture(p,left);
    await p.keyboard.down('j');await p.evaluate(()=>window.advanceTime(250));await p.keyboard.up('j');
    await p.click('#pause-btn');await p.click('#menu-btn');assert.equal((await state(p)).save.cash,3550);
    await p.reload();await p.waitForFunction(()=>!!window.__game);assert.equal((await state(p)).save.cash,3550);
    await p.close();
  }
  // Two real clients: server physics credits one rider, and reload/leave cannot pay twice.
  const a=await browser.newPage({viewport:{width:1280,height:900}}),b=await browser.newPage({viewport:{width:390,height:844}});
  await setup(a);await setup(b);await a.click('#online-btn');await a.fill('#online-name','Prêmio QA');await a.locator('#online-bots').setChecked(false);await a.click('#online-create');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state(a)).online.code;
  await b.click('#online-btn');await b.fill('#online-name','Outro piloto');await b.fill('#online-code-input',code);await b.click('#online-join');
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');const aid=(await state(a)).online.id,bid=(await state(b)).online.id;
  await store.mutate(code,room=>{
    const s=room.race!,{p,cop}=officer(s,aid,true),other=s.riders.find(r=>r.id===bid)!;Object.assign(other,{z:900,x:0,speed:0});
    stepRace(s,{[p.id]:EMPTY_COMMAND,[cop.id]:EMPTY_COMMAND});assert.ok(p.recovery&&cop.recovery);assert.equal(s.multiplayer!.results[aid],undefined);
    p.recovery!.bikeZ+=80;
  });
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.policeBonus===500);await shot(a,'online-simultaneous');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).result?.reason==='caught');
  if((await state(a)).screen==='finish')await a.click('#finish-skip');
  if((await state(a)).screen==='spectate')await a.click('#spectator-result');
  assert.equal((await state(a)).save.cash,1150);assert.equal((await state(b)).save.cash,650);
  assert.match(await a.locator('.police-bonus').innerText(),/500/);await shot(a,'online-result');
  await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).result?.reason==='caught');assert.equal((await state(a)).save.cash,1150);
  if((await state(a)).screen==='finish')await a.click('#finish-skip');
  if((await state(a)).screen==='spectate')await a.click('#spectator-result');
  await a.click('#online-menu-btn');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='menu');assert.equal((await state(a)).save.cash,1150);
  await b.click('#pause-btn');await b.click('#menu-btn');
  assert.deepEqual(errors,[]);console.log('PASS police rewards: actual repeated falls, HUD, desktop/mobile results, cash, abandonment, reload, simultaneous fall/arrest, two online clients and reconnect idempotency.');
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await vite.close();await app.close();}
