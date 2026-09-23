import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { crashRider, finishRider } from '../src/game/simulation';
import { inputKey } from '../server/room';
import type { RaceState } from '../src/game/types';

const folder='output/spectator';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4388','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4388/';
for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),errors:string[]=[];
const a=await browser.newPage({viewport:{width:1440,height:900}}),b=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),c=await browser.newPage({viewport:{width:1280,height:800}});
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const screen=(p:Page,value:string)=>p.waitForFunction(value=>JSON.parse(window.render_game_to_text()).screen===value,value);
const shot=(p:Page,name:string)=>p.screenshot({path:`${folder}/${name}.png`});
const watching=(p:Page,id:string)=>p.waitForFunction(id=>JSON.parse(window.render_game_to_text()).spectator?.id===id,id);
async function setup(p:Page){
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:12}}));
  await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
  await p.goto(base+'?test');await p.waitForFunction(()=>!!window.__game);
}
async function join(p:Page,code:string,name:string){
  await p.click('#online-btn');await p.fill('#online-name',name);await p.fill('#online-code-input',code);await p.click('#online-join');
  await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
}
async function race(pages:Page[],bots=true){
  await a.click('#online-btn');await a.fill('#online-name','Espectador QA');await a.locator('#online-bots').setChecked(bots);await a.click('#online-create');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state(a)).online.code as string;
  for(let i=1;i<pages.length;i++)await join(pages[i],code,i===1?'Piloto Azul':'Piloto Verde');
  for(const p of pages)await p.click('#online-ready');
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  for(const p of pages)await screen(p,'race');
  const ids=await Promise.all(pages.map(async p=>(await state(p)).online.id as string));
  await store.mutate(code,room=>{
    const s=room.race!;s.mode='racing';s.countdown=0;s.traffic=[];s.obstacles=[];s.policeActive=false;s.heat=0;s.time=30;
    s.riders=s.riders.filter(r=>r.profile!=='police');s.riders.forEach((r,i)=>Object.assign(r,{z:600+i*160,x:0,speed:0,crash:0,immune:100,integrity:100,health:100}));
  });
  return {code,ids};
}
function arrest(s:RaceState,id:string){
  const r=s.riders.find(r=>r.id===id)!;r.immune=0;s.policeActive=true;
  s.riders.push({...r,id:'qa-police',name:'POLÍCIA',profile:'police',x:2.8,z:r.z+8});crashRider(s,r,true);
}
async function leave(p:Page){
  const view=await state(p);
  if(view.screen==='finish')await p.click('#finish-skip');
  if((await state(p)).screen==='spectate')await p.click('#spectator-result');
  if((await state(p)).screen==='result')await p.click('#online-menu-btn');
  else {await p.click('#pause-btn');await p.click('#menu-btn');}
  await screen(p,'menu');
}
try{
  for(const p of [a,b,c])await setup(p);
  const {code,ids:[aid,bid,cid]}=await race([a,b,c]);
  await a.keyboard.press('c');assert.equal((await state(a)).spectator,null,'C has no effect before elimination');
  await store.mutate(code,room=>arrest(room.race!,aid));await screen(a,'finish');assert.equal((await state(a)).arrest!==null,true);
  await a.evaluate(()=>window.advanceTime(9000));await screen(a,'spectate');await watching(a,bid);
  assert.equal((await state(a)).camera.riderId,bid);assert.equal((await state(a)).arrest,null);
  assert.equal((await state(a)).player.out,'caught');assert.equal(await a.locator('#result-modal').isVisible(),false);
  const saved=(await state(a)).save;
  await b.keyboard.down('w');const z=(await state(a)).spectator.z;
  await a.waitForFunction(z=>JSON.parse(window.render_game_to_text()).spectator.z>z+12,z);
  let v=await state(a);assert.ok(Math.abs(v.camera.z-v.spectator.z)<35);assert.ok(Number(await a.locator('#speed').innerText())>0);assert.notEqual(await a.locator('#gear').innerText(),'A PÉ');
  await shot(a,'01-arrest-spectator');
  await a.keyboard.press('c');await watching(a,cid);await a.keyboard.press('c');await watching(a,bid);
  await a.keyboard.down('c');await watching(a,cid);await a.keyboard.down('c');assert.equal((await state(a)).spectator.id,cid);await a.keyboard.up('c');
  await a.click('#spectator-next');await watching(a,bid);
  for(const key of ['w','d','j','n','b'])await a.keyboard.press(key);
  await store.mutate(code,(room,controls)=>{
    const myInput=controls[inputKey(room.members.find(m=>m.id===aid)!)];
    assert.equal(myInput.command.throttle,0);assert.equal(myInput.command.steer,0);assert.equal(myInput.command.attack,null);
    assert.deepEqual(myInput.attacks??[],[]);assert.deepEqual(myInput.actions??[],[]);
  });
  await a.keyboard.press('Escape');assert.equal(await a.locator('#pause-modal').isVisible(),true);await a.click('#resume-btn');await watching(a,bid);
  await a.click('#spectator-result');await screen(a,'result');assert.match(await a.locator('.result-sub').innerText(),/30 metros/);
  await a.keyboard.press('c');await watching(a,bid);assert.deepEqual((await state(a)).save,saved);
  // A falling target can still recover. Switching away must discard its held camera.
  await b.keyboard.up('w');await store.mutate(code,room=>{room.race!.riders=room.race!.riders.filter(r=>r.profile!=='police');const r=room.race!.riders.find(r=>r.id===bid)!;r.immune=0;r.speed=20;crashRider(room.race!,r,true);});
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).spectator?.recovery!==null);
  await a.keyboard.press('c');await watching(a,cid);v=await state(a);assert.equal(v.camera.mode,'riding');assert.ok(Math.abs(v.camera.z-v.spectator.z)<35);
  await shot(a,'02-switched-camera');
  // A real departure removes that target; no bots are ever selected.
  await leave(c);await watching(a,bid);assert.equal(await a.locator('#spectator-next').isDisabled(),true);
  await a.keyboard.press('c');await watching(a,bid);
  await store.mutate(code,room=>{const r=room.race!.riders.find(r=>r.id===bid)!;finishRider(room.race!,r,'finish');});
  await screen(a,'result');assert.equal((await state(a)).spectator,null);assert.equal(await a.locator('#online-spectate-btn').isVisible(),false);
  assert.deepEqual((await state(a)).save,saved);await shot(a,'03-no-targets-result');await leave(a);await leave(b);
  // Wreck the mobile player through the real pickup/explosion sequence.
  const second=await race([a,b]);const [a2,b2]=second.ids;
  await store.mutate(second.code,room=>{const s=room.race!,r=s.riders.find(r=>r.id===b2)!;r.immune=0;crashRider(s,r,true);r.integrity=0;r.recovery!.phase='walking';Object.assign(r.recovery!,{bikeX:r.x,bikeZ:r.z,bikeVX:0,bikeVZ:0});});
  await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.recovery?.phase==='exploding');await shot(b,'04-explosion');
  await screen(b,'spectate');await watching(b,a2);assert.equal((await state(b)).result.reason,'wrecked');assert.equal(await b.locator('.touch-controls').isVisible(),false);
  await shot(b,'05-mobile-spectator');const box=await b.locator('#spectator-bar').boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=391);
  await b.click('#spectator-result');await b.click('#online-spectate-btn');await watching(b,a2);
  // Reload/reconnect retains the result and re-enters spectating without re-awarding anything.
  const mobileSave=(await state(b)).save;await b.reload();await watching(b,a2);assert.deepEqual((await state(b)).save,mobileSave);
  await b.setViewportSize({width:844,height:390});await shot(b,'06-landscape-spectator');
  await b.setViewportSize({width:320,height:568});await shot(b,'07-small-spectator');
  // Losing the last active human ends the match and opens the spectator's own result.
  await store.mutate(second.code,room=>{const r=room.race!.riders.find(r=>r.id===a2)!;r.integrity=0;});
  await screen(b,'result');await screen(a,'result');assert.equal((await state(b)).online.phase,'finished');assert.equal((await state(b)).result.reason,'wrecked');
  await leave(a);await leave(b);
  // A new race cannot inherit the previous spectator target or camera.
  await a.click('#start-btn');await screen(a,'race');assert.equal((await state(a)).spectator,null);assert.equal((await state(a)).camera.riderId,'player');
  assert.equal(await a.locator('#spectator-bar').isVisible(),false);await a.keyboard.press('c');assert.equal((await state(a)).screen,'race');
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${folder}/report.json`,JSON.stringify({ok:true,checks:['arrest cinematic to spectator','C cycles and ignores repeats','camera HUD and audio target','no driving attacks or actions from spectator','results and awards retained','recoverable falls','departure and last finish','explosion to mobile spectator','reconnect','portrait and landscape','all eliminated','new solo race'],errors},null,2));
  console.log('PASS: multiplayer spectator in three browsers, arrest, explosion, cycling, departure, finish and reset');
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await app.close();vite.kill('SIGTERM');}
