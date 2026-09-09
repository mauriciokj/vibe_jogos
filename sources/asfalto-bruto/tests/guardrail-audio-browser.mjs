import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGameServer} from '../server/service.ts';
import {MemoryStore} from '../server/store.ts';
import {freshSave,SAVE_KEY} from '../src/game/save.ts';

const published=!!process.env.GUARDRAIL_AUDIO_URL,base=process.env.GUARDRAIL_AUDIO_URL||'http://127.0.0.1:4368/';
const folder='output/guardrail-audio';await fs.mkdir(folder,{recursive:true});
let app,vite;
if(!published){
  app=createGameServer(new MemoryStore());app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4368','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${app.server.address().port}`},stdio:'ignore'});
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']});
const a=await browser.newPage({viewport:{width:1280,height:800}}),b=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
for(const p of [a,b]){
  p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  if(!published)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0,since:'2026-09-08T00:00:00Z'}}));
  await p.addInitScript(()=>{
    const Native=window.AudioContext;window.__audioProbe={gains:[],filters:[],sources:[],starts:[]};
    window.AudioContext=class extends Native{
      createGain(){const g=super.createGain();window.__audioProbe.gains.push(g);return g;}
      createBiquadFilter(){const f=super.createBiquadFilter();window.__audioProbe.filters.push(f);return f;}
      createBufferSource(){const s=super.createBufferSource();window.__audioProbe.sources.push(s);return s;}
      createOscillator(){const o=super.createOscillator();let frequency;const set=o.frequency.setValueAtTime.bind(o.frequency);o.frequency.setValueAtTime=(v,...args)=>{frequency=v;return set(v,...args);};const start=o.start.bind(o);o.start=(...args)=>{window.__audioProbe.starts.push(frequency??o.frequency.value);return start(...args);};return o;}
    };
  });
}
const state=(p=a)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const probe=(p=a)=>p.evaluate(()=>{const q=window.__audioProbe;return {master:q.gains[0]?.gain.value,scrape:q.gains[3]?.gain.value,impacts:q.starts.filter(f=>f===342).length,loops:q.sources.filter(s=>s.loop).length};});
const advance=ms=>a.evaluate(ms=>window.advanceTime(ms),ms);
const fixture=async(x=-6.8,speed=50,extra={})=>a.evaluate(({x,speed,extra})=>{
  const s=JSON.parse(window.__game.snapshot());s.mode='racing';s.countdown=0;s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];s.heat=0;s.policeActive=false;s.events=[];
  Object.assign(s.riders[0],{x,z:0,speed,health:100,integrity:100,crash:0,out:undefined,finishedAt:null,falls:0,kneeTime:0,jumpTime:0,wheelieTime:0,...extra});window.__game.restore(JSON.stringify(s));
},{x,speed,extra});
const settle=()=>a.waitForTimeout(250);
const leave=async p=>{if((await state(p)).screen==='race'){await p.click('#pause-btn');await p.click('#menu-btn');}};
try{
  await a.goto(base+'?test',{waitUntil:'domcontentloaded'});const save=freshSave();save.unlocked=3;save.races=1;save.raceTrackId='porto';save.raceCondition='rain';
  await a.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save});await a.reload({waitUntil:'domcontentloaded'});await a.click('#start-btn');
  await fixture();await a.keyboard.down('w');await a.keyboard.down('a');await advance(300);await settle();assert.equal((await state()).player.x,-7);assert.equal((await probe()).impacts,1);assert.ok((await probe()).scrape>.05);
  await advance(600);await settle();assert.equal((await probe()).impacts,1);assert.equal((await probe()).loops,2);assert.equal((await state()).player.falls,0);await a.screenshot({path:`${folder}/${published?'published':'local'}-contact.png`});
  await a.keyboard.up('a');await a.keyboard.up('w');await fixture(-7,45);await advance(17);await settle();const fast=(await probe()).scrape;
  await fixture(-7,10);await advance(17);await settle();const slow=(await probe()).scrape;assert.ok(fast>slow*1.5);assert.equal((await probe()).impacts,1);
  // A brief pose correction must not retrigger the impact.
  await fixture(-6.9,30);await advance(17);await fixture(-7,30);await advance(17);assert.equal((await probe()).impacts,1);
  await a.click('#pause-btn');await settle();assert.ok((await probe()).scrape<.001);await a.click('#resume-btn');await advance(17);await settle();assert.ok((await probe()).scrape>.05);assert.equal((await probe()).impacts,1);
  await a.keyboard.down('d');await advance(350);await a.keyboard.up('d');await settle();assert.ok((await probe()).scrape<.001);
  await fixture(-7,30);await advance(17);await settle();assert.equal((await probe()).impacts,2);
  const snap=await a.evaluate(()=>window.__game.snapshot());for(let i=0;i<3;i++){await a.evaluate(s=>window.__game.restore(s),snap);await advance(17);}assert.equal((await probe()).impacts,2);
  await a.keyboard.press('m');await settle();assert.ok((await probe()).master<.001);await fixture(-6,30);await advance(250);await fixture(-7,30);await advance(17);assert.equal((await probe()).impacts,2);await a.keyboard.press('m');await advance(17);assert.equal((await probe()).impacts,2);
  await fixture(-7,0);await advance(250);await settle();assert.ok((await probe()).scrape<.001);
  for(const extra of [{crash:2},{out:'caught'},{finishedAt:10}]){await fixture(-7,30,extra);await advance(17);await settle();assert.ok((await probe()).scrape<.001);assert.equal((await probe()).impacts,2);}
  await fixture(7,40);await advance(250);await settle();assert.ok((await probe()).scrape<.001);assert.equal((await probe()).impacts,2);
  await a.click('#pause-btn');await a.click('#restart-btn');await fixture(-7,30);await advance(17);await settle();assert.equal((await probe()).impacts,3);await leave(a);await settle();assert.ok((await probe()).scrape<.001);
  // Actual controls and WSS snapshots, without changing the online world.
  await a.click('#online-btn');await a.fill('#online-name','Teste som A');await a.selectOption('#online-track','porto:rain');await a.uncheck('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');const code=(await state()).online.code;
  const other=published?'https://flowofdevelopment.com/asfalto-bruto/':base;
  await b.goto(other+`?test&sala=${code}`,{waitUntil:'domcontentloaded'});await b.fill('#online-name','Teste som B');await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await a.click('#online-ready');await b.click('#online-ready');
  for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  const before=(await probe()).impacts;await a.keyboard.down('w');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>25);await a.keyboard.down('a');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.x===-7);await a.waitForTimeout(180);
  assert.equal((await probe()).impacts,before+1);assert.ok((await probe()).scrape>.01,JSON.stringify({audio:await probe(),player:(await state()).player}));assert.equal((await probe()).loops,2);assert.equal((await probe(b)).impacts,0);assert.ok((await probe(b)).scrape<.001);await a.screenshot({path:`${folder}/${published?'published':'local'}-online.png`});
  await a.keyboard.up('a');await a.keyboard.down('d');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.x> -6);await a.keyboard.up('d');await a.keyboard.up('w');await settle();assert.ok((await probe()).scrape<.001);for(const p of [a,b])await leave(p);await settle();assert.ok((await probe()).scrape<.001);
  assert.deepEqual(errors,[]);const report={ok:true,impactOnce:true,continuousScrape:true,speedControlsVolume:true,fastVolume:fast,slowVolume:slow,pauseResume:true,mute:true,stoppedOrOutSilent:true,openSideSilent:true,repeatedSnapshots:true,newRaceResets:true,onlineTwoHumans:true,loopsReused:true,errors};await fs.writeFile(`${folder}/${published?'published':'local'}.json`,JSON.stringify(report,null,2));console.log(report);
}finally{for(const p of [a,b])try{await leave(p);}catch{}await browser.close();vite?.kill('SIGTERM');await app?.close();}
