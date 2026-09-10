import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRace,crashRider} from '../src/game/simulation';
import {freshSave,SAVE_KEY} from '../src/game/save';
import {newChampionship,startChampionshipRace} from '../src/game/championship';
import type {RaceState} from '../src/game/types';
import {getTrack} from '../src/game/content';
const base=process.env.QA_URL||'http://127.0.0.1:4387/',folder=process.env.QA_DIR||'output/arrest-qa';await fs.mkdir(folder,{recursive:true});
const app=process.env.QA_URL?null:createGameServer(new MemoryStore());if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4387','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as any).port}`},stdio:'ignore'}):null;
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:800}}),errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
if(base.startsWith('http://127.'))await page.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
const garage={...freshSave(),cash:12000,races:1,unlocked:4,ownedKneePads:['gold'],kneePadId:'gold'};
await page.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));sessionStorage.setItem('asfalto-instructions','1')},{key:SAVE_KEY,save:garage});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=(ms:number)=>page.evaluate(ms=>window.advanceTime(ms),ms);
const restore=(s:RaceState)=>page.evaluate(s=>window.__game!.restore(JSON.stringify(s)),s);
const shot=async(name:string)=>{await page.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(),null,2));};
function fixture(track='porto',caught=true){
 const s=createRace(track,garage,88117,'day');s.mode='racing';s.time=40;s.tick=2400;s.countdown=0;s.traffic=[];s.obstacles=[];
 s.riders.forEach((r,i)=>Object.assign(r,{x:i?4:0,z:i?getTrack(track).distance-5-i*3:2100,speed:45,immune:i?10:0}));
 if(caught){s.riders.push({...s.riders[0],id:'police',name:'POLÍCIA',profile:'police',color:'#e7e9e5',bikeId:'estradeira',x:2.8,z:2108,finishedAt:null});s.policeActive=true;}
 crashRider(s,s.riders[0],true);return s;
}
try{
 await page.goto(base+'?test');await page.waitForFunction(()=>!!window.__game);
 await restore(fixture());const camera=(await state()).camera;
 await advance(1000/60);assert.equal((await state()).result.reason,'caught');assert.equal((await state()).screen,'finish');assert.ok(Math.abs((await state()).camera.z-camera.z)<.1);assert.ok(await page.locator('#result-modal').isHidden());await shot('arrest-start');
 await advance(1400);assert.equal((await state()).arrest.phase,'dismounting');await shot('arrest-dismount');
 await advance(1100);assert.equal((await state()).arrest.phase,'walking');await shot('arrest-walk');
 await advance(1500);assert.equal((await state()).arrest.phase,'cuffing');await shot('arrest-cuffing');
 await advance(1400);assert.equal((await state()).arrest.cuffed,true);await shot('arrest-cuffed');
 await advance(1500);await page.locator('#result-modal[open]').waitFor();assert.match(await page.locator('.result-sub').innerText(),/30 metros/);await shot('arrest-result');
 await page.click('#again-btn');await advance(16.667);assert.equal((await state()).camera.mode,'riding');assert.ok((await state()).camera.z<5);assert.equal((await state()).arrest,null);await shot('restart-grid');
 const stopped=fixture();delete stopped.riders[0].recovery;Object.assign(stopped.riders[0],{crash:0,speed:0,capture:2.99});stopped.capture=2.99;Object.assign(stopped.riders.at(-1)!,{x:0,z:2101,speed:0});await restore(stopped);await advance(30);assert.equal((await state()).result.arrestCause,'stopped');await advance(5400);await shot('stopped-cuffed');await page.click('#finish-skip');assert.match(await page.locator('.result-sub').innerText(),/3 segundos/);await page.click('#again-btn');
 // Championship starts from a real saved recovery; zero points and reason survive reload.
 const save=structuredClone(garage);save.championship=newChampionship(22);startChampionshipRace(save);
 const fall=fixture('costa');save.championship.checkpoint=fall;
 await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await page.reload();await page.click('#championship-btn');await page.click('#champ-start');await advance(30);assert.equal((await state()).arrest.phase,'arriving');await advance(6800);
 await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).championship.settling);assert.match(await page.locator('#result-modal').innerText(),/PRESO PELA POLÍCIA/);await shot('championship-reason');
 await page.click('#champ-start');await advance(16.667);assert.ok((await state()).camera.z<5);assert.equal((await state()).condition,'sunset');await shot('championship-next-grid');
 await page.reload();await page.click('#championship-btn');assert.match(await page.locator('#championship-modal').innerText(),/30 metros/);await page.keyboard.press('Escape');
 // Short standalone arrest and skip on a portrait phone.
 await page.setViewportSize({width:390,height:844});await restore(fixture());await advance(30);await advance(5400);await shot('mobile-cuffed');await page.click('#finish-skip');assert.equal((await state()).screen,'result');assert.ok(await page.locator('#result-modal').isVisible());await page.click('#result-menu-btn');
 // Work crews at both ends and all lighting conditions; retain full traffic/works.
 await page.setViewportSize({width:1280,height:800});
 for(const [condition,z,name] of [['day',2220,'queue-forward'],['sunset',2990,'queue-oncoming'],['night',2260,'workers-night'],['rain',6370,'workers-rain']] as const){
  const s=createRace('porto',garage,44,condition);s.mode='racing';s.time=12;s.tick=720;s.countdown=0;s.riders=s.riders.slice(0,1);Object.assign(s.riders[0],{x:-2,z,speed:0,immune:5});await restore(s);await shot(name);
 }
 assert.deepEqual(errors,[]);console.log('PASS: arrest phases/skip, unchanged result, championship reason/reload, both next-race cameras, mobile scene, workers/flaggers in all conditions');
}catch(error){await shot('failure');throw error;}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await app?.close();vite?.kill('SIGTERM');}
