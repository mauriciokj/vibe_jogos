import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.AUDIO_CHECK_URL||'http://127.0.0.1:4366/',folder='output/jump-audio';await fs.mkdir(folder,{recursive:true});
const vite=process.env.AUDIO_CHECK_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4366','--strictPort'],{stdio:'ignore'});
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']}),p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await p.addInitScript(()=>{
  const Native=window.AudioContext;
  window.__audioProbe={osc:[],gains:[],filters:[],starts:[]};
  window.AudioContext=class extends Native{
    constructor(...args){super(...args);window.__audioProbe.ctx=this;}
    createOscillator(){const o=super.createOscillator();window.__audioProbe.osc.push(o);let frequency;const set=o.frequency.setValueAtTime.bind(o.frequency);o.frequency.setValueAtTime=(value,...args)=>{frequency=value;return set(value,...args);};const start=o.start.bind(o);o.start=(...args)=>{window.__audioProbe.starts.push({frequency:frequency??o.frequency.value,type:o.type});return start(...args);};return o;}
    createGain(){const g=super.createGain();window.__audioProbe.gains.push(g);return g;}
    createBiquadFilter(){const f=super.createBiquadFilter();window.__audioProbe.filters.push(f);return f;}
  };
});
if(vite)await p.route('**/api/visitors*',route=>route.fulfill({json:{visitors:0,since:'2026-09-08T00:00:00Z'}}));
const probe=()=>p.evaluate(()=>{const a=window.__audioProbe;return {pitch:a.osc[0].frequency.value,engineGain:a.gains[1].gain.value,master:a.gains[0].gain.value,filter:a.filters[0].frequency.value,impacts:a.starts.filter(s=>s.frequency===228).length,oscillators:a.osc.length};});
const state=()=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>p.evaluate(ms=>window.advanceTime(ms),ms);
const fixture=async(kind='car',uses=3)=>p.evaluate(({kind,uses})=>{
  const s=JSON.parse(window.__game.snapshot());s.mode='racing';s.countdown=0;s.time=20;s.tick=1200;s.riders=s.riders.slice(0,1);s.heat=0;s.policeActive=false;s.obstacles=[];s.events=[];
  Object.assign(s.riders[0],{z:0,x:-1.7,speed:45,health:100,integrity:100,immune:0,crash:0,wheeliesLeft:uses,wheelieTime:0,jumpTime:0,jumpTarget:undefined,kneeTime:0,nitroTime:0,attack:null,falls:0});
  s.traffic=kind==='none'?[]:[{id:'audio-car',kind,x:-1.7,z:70,speed:-20,color:'#e5a577'}];window.__game.restore(JSON.stringify(s));
}, {kind,uses});
const jump=async()=>{await p.keyboard.press('w');await p.keyboard.down('w');await advance(900);};
try{
  await p.goto(base+'?test',{waitUntil:'domcontentloaded'});await p.click('#start-btn');if(await p.locator('#help-go').isVisible())await p.click('#help-go');
  await fixture();await advance(17);await p.waitForTimeout(220);const ground=await probe();assert.equal(ground.impacts,0);
  await jump();assert.ok((await state()).player.jumpTime>0);await p.waitForTimeout(200);const air=await probe();assert.equal(air.impacts,1);assert.ok(air.pitch>ground.pitch*1.5);assert.ok(air.filter>ground.filter+800);await p.screenshot({path:`${folder}/${vite?'local':'published'}-jump.png`});
  await p.keyboard.up('w');await p.click('#pause-btn');await p.waitForTimeout(500);assert.ok((await probe()).engineGain<.001);await advance(1000);assert.equal((await probe()).impacts,1);await p.click('#resume-btn');await advance(17);await p.waitForTimeout(180);assert.equal((await probe()).impacts,1);assert.ok((await probe()).pitch>ground.pitch*1.5);
  await advance(1000);await p.waitForTimeout(350);assert.equal((await state()).player.jumpTime,0);const landed=await probe();assert.ok(landed.pitch<air.pitch*.75);assert.equal(landed.impacts,1);await p.screenshot({path:`${folder}/${vite?'local':'published'}-landed.png`});
  // Repeated online-like snapshots of the same jump cannot replay the impact.
  await fixture('car',2);await jump();await p.waitForTimeout(80);assert.equal((await probe()).impacts,2);const snap=await p.evaluate(()=>window.__game.snapshot());
  for(let i=0;i<3;i++){await p.evaluate(s=>window.__game.restore(s),snap);await advance(17);}assert.equal((await probe()).impacts,2);await p.keyboard.up('w');
  await p.keyboard.press('m');await p.waitForTimeout(220);assert.ok((await probe()).master<.001);await fixture('car',1);await jump();assert.ok((await state()).player.jumpTime>0);assert.equal((await probe()).impacts,2);await p.keyboard.up('w');await p.keyboard.press('m');await advance(17);assert.equal((await probe()).impacts,2);
  await p.click('#pause-btn');await p.click('#restart-btn');await fixture('truck');await jump();await p.keyboard.up('w');assert.equal((await probe()).impacts,2);assert.equal((await state()).player.jumpTime,0);
  await p.click('#pause-btn');await p.click('#restart-btn');await fixture();await jump();await p.keyboard.up('w');assert.equal((await probe()).impacts,3);await p.click('#pause-btn');await p.click('#menu-btn');await p.waitForTimeout(500);assert.ok((await probe()).engineGain<.001);
  assert.deepEqual(errors,[]);const report={ok:true,groundPitch:ground.pitch,airPitch:air.pitch,landedPitch:landed.pitch,metalOncePerJump:true,pauseResume:true,snapshotDeduplication:true,mute:true,truckNoJumpSound:true,newRaceResets:true,errors};await fs.writeFile(`${folder}/${vite?'local':'published'}.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();vite?.kill('SIGTERM');}
