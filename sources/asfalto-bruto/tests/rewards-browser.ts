import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { createRace, finishRider } from '../src/game/simulation';
import { getTrack } from '../src/game/content';
import { EMPTY_COMMAND, type RaceCondition } from '../src/game/types';

const live=process.env.PUBLIC_URL,folder=process.env.REWARDS_OUTPUT ?? 'output/rewards';await fs.mkdir(folder,{recursive:true});
const app=live?null:createGameServer(new MemoryStore());
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4387','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):null;
const base=live ?? 'http://127.0.0.1:4387/';
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:live?['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']:[]});
const errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=(p:Page,ms:number)=>p.evaluate(ms=>window.advanceTime(ms),ms);
async function finish(p:Page,time:number,place=1,track='costa',condition:RaceCondition='day',caught=false){
  const s=createRace(track,undefined,77,condition),end=getTrack(track).distance;
  s.mode='racing';s.time=time;s.countdown=0;s.traffic=[];s.obstacles=[];
  s.riders.forEach((r,i)=>Object.assign(r,{z:end-50-i*30,x:i%2?-2.7:2.7,speed:40}));
  Object.assign(s.riders[0],{z:end,finishedAt:caught?null:time});
  if(place===2)Object.assign(s.riders[1],{z:end,finishedAt:time-3});
  finishRider(s,s.riders[0],caught?'caught':'finish');
  await p.evaluate(({raw,cmd})=>{window.__game!.restore(raw);window.__game!.command(cmd,0);},{raw:JSON.stringify(s),cmd:EMPTY_COMMAND});
  return state(p);
}
try{
  for(const [name,width,height,mobile] of [['desktop',1440,900,false],['portrait',390,844,true],['small-portrait',320,568,true],['landscape',844,390,true]] as const){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1}),p=await context.newPage();
    p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    if(!live)await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:42}}));
    await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));
    await p.goto(base+'?test',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__game);await p.evaluate(()=>document.fonts.ready);
    let view=await finish(p,200);assert.equal(view.payout.recordBonus,0);assert.equal(view.save.cash,2050);
    await advance(p,5000);assert.equal(await p.locator('.record-bonus').count(),0);
    await p.click('#again-btn');view=await finish(p,190,2);
    assert.equal(view.screen,'finish');assert.equal(view.result.place,2);assert.equal(view.result.reward,1120);
    assert.deepEqual(view.payout,{baseReward:1120,recordBonus:420,previousRecord:200,total:1540});assert.equal(view.save.cash,3590);
    const snapshot=await p.evaluate(()=>window.__game!.snapshot());await advance(p,5000);
    assert.equal(await p.evaluate(()=>window.__game!.snapshot()),snapshot);assert.equal((await state(p)).save.cash,3590);
    assert.match(await p.locator('.record-bonus').innerText(),/RECORDE PESSOAL BATIDO/);assert.match(await p.locator('.record-bonus b').innerText(),/420/);
    assert.match(await p.locator('.prize').innerText(),/1.540/);assert.match(await p.locator('.result-stats').innerText(),/RECOMPENSA TOTAL/);
    await p.screenshot({path:`${folder}/${name}-bonus.png`});
    assert.ok(await p.locator('#result-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'bonus must fit the result card');
    const bonusBox=await p.locator('.record-bonus').boundingBox(),actionsBox=await p.locator('.result-actions').boundingBox();
    assert.ok(bonusBox&&actionsBox&&bonusBox.y+bonusBox.height<=actionsBox.y+1,'sticky navigation must leave the bonus visible');
    await advance(p,6000);assert.equal((await state(p)).save.cash,3590);assert.equal((await state(p)).save.races,2);
    await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__game);
    assert.equal((await state(p)).save.cash,3590);assert.equal(JSON.parse(await p.evaluate(()=>window.__game!.save())).records['costa:day'].time,190);
    for(const time of [190,210]){
      const before=(await state(p)).save.cash;view=await finish(p,time);assert.equal(view.payout.recordBonus,0);assert.equal(view.save.cash,before+view.result.reward);
      await advance(p,5000);assert.equal(await p.locator('.record-bonus').count(),0);await p.click('#again-btn');
    }
    for(const [track,condition] of [['costa','rain'],['serra','day']] as const){view=await finish(p,170,1,track,condition);assert.equal(view.payout.recordBonus,0);await advance(p,5000);await p.click('#again-btn');}
    view=await finish(p,180,1,'costa','day',true);assert.equal(view.payout.recordBonus,0);assert.equal(view.screen,'result');assert.equal(await p.locator('.record-bonus').count(),0);
    await p.click('#result-menu-btn');view=await finish(p,180);assert.equal(view.payout.recordBonus,420);await p.click('#finish-skip');
    await p.click('#next-race-btn');assert.equal((await state(p)).payout,null);assert.equal((await state(p)).track,'serra');
    await context.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${folder}/report.json`,JSON.stringify({ok:true,checks:['30% of track prize in second place','total and bonus visible','four viewports','first/equal/slower times excluded','track and condition separation','failure excluded','cash paid once during finish camera','reload preserves record and cash','next race clears payout'],errors},null,2));console.log('Record bonus browser checks passed');
}finally{await browser.close();await app?.close();vite?.kill('SIGTERM');}
