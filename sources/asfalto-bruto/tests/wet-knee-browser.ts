import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {freshSave,buyKneePad,SAVE_KEY} from '../src/game/save';

const folder='output/wet-knee';await fs.mkdir(folder,{recursive:true});
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{now:()=>Date.now()+offset});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4363','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base='http://127.0.0.1:4363/';for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),a=await browser.newPage({viewport:{width:1280,height:800}}),b=await browser.newPage({viewport:{width:1100,height:760}}),errors:string[]=[];
for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
try {
  await a.goto(base+'?test');const save=freshSave();save.races=1;buyKneePad(save,'white');await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload();
  await a.click('#online-btn');await a.fill('#online-name','Ana');await a.selectOption('#online-track','porto:rain');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  await b.goto(base+`?test&sala=${code}`);await b.fill('#online-name','Bia');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5001;
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const aid=(await state()).online.id,bid=(await state(b)).online.id;assert.equal((await state()).condition,'rain');assert.equal((await state()).awareness.racers.length,8);
  const reset=async()=>{await store.mutate(code,room=>{const s=room.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.riders.forEach((r,i)=>Object.assign(r,{z:r.id===aid?1000:r.id===bid?1040:2500+i*60,x:r.id===aid?-5:5,speed:i<2?50:0,kneeTime:0,wetKneeTicks:0,immune:0,crash:0,health:100,integrity:100,attack:null}));});await a.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.player.z>990&&s.player.z<1030&&s.player.speed>35&&s.player.kneeTime===0;});};
  await reset();await a.keyboard.press('d');await a.keyboard.down('d');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.wetKneeTime>1);assert.equal((await state()).player.falls,0);assert.ok((await state()).player.kneeSupport>.35);await a.screenshot({path:`${folder}/online-safe.png`});
  await a.keyboard.up('d');await a.keyboard.down('a');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.kneeTime===0);await a.keyboard.up('a');assert.equal((await state()).player.wetKneeTime,0);
  await reset();await a.keyboard.press('d');await a.keyboard.down('d');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.wetKneeTime>1.6);
  const before=(await store.read(code))!.race!.riders.find(r=>r.id===aid)!;assert.ok(before.wetKneeTicks!>70);assert.equal(before.falls,0);
  await a.reload();await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');await a.keyboard.up('d');assert.equal((await state()).online.id,aid);
  await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.falls===1,{},{timeout:10000});await b.waitForFunction(id=>JSON.parse(window.render_game_to_text()).riders.some((r:any)=>r.id===id&&r.crash>0),aid);
  const after=(await store.read(code))!.race!.riders.find(r=>r.id===aid)!;assert.equal(after.wetKneeTicks,0);assert.ok(after.integrity<100);assert.equal((await store.read(code))!.race!.riders.find(r=>r.id===bid)!.falls,0);
  await a.screenshot({path:`${folder}/online-fall.png`});for(const p of [a,b]){await p.click('#pause-btn');await p.click('#menu-btn');}
  assert.deepEqual(errors,[]);const report={ok:true,shortContactSafe:true,liftResets:true,reconnectKeepsExposure:true,authoritativeDelayedFall:true,humans:2,bots:6,errors};await fs.writeFile(`${folder}/online.json`,JSON.stringify(report,null,2));console.log(report);
} catch(error) {const snapshot=await store.read((await state()).online.code);console.log('failure state',snapshot?.race?.riders.filter(r=>snapshot?.race?.multiplayer?.humanIds.includes(r.id)).map(({id,speed,x,z,kneeTime,wetKneeTicks,crash,falls})=>({id,speed,x,z,kneeTime,wetKneeTicks,crash,falls})));throw error;} finally {await browser.close();vite.kill('SIGTERM');await app.close();}
