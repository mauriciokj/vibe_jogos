import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { createRace } from '../src/game/simulation';
import { getTrack } from '../src/game/content';

const folder=process.env.HUD_OUTPUT ?? 'output/hud';await fs.mkdir(folder,{recursive:true});
const app=createGameServer(new MemoryStore());app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=process.env.PUBLIC_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4383','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'});
const base=process.env.PUBLIC_URL ?? 'http://127.0.0.1:4383/';
if(vite)for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:process.env.PUBLIC_URL?['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']:[]});
const errors:string[]=[],report:unknown[]=[];
try{
  for(const [name,width,height,mobile] of [['desktop',1440,900,false],['portrait',390,844,true],['small-portrait',320,568,true],['landscape',844,390,true],['small-landscape',667,375,true]] as const){
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
    if(!process.env.PUBLIC_URL)await page.route('**/api/visitors*',route=>route.fulfill({json:{visitors:42,since:'2026-09-09T00:00:00Z'}}));
    await page.goto(base+'?test&race',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__game);
    await page.evaluate(()=>document.fonts.ready);
    for(const [track,condition,z] of [['costa','day',1270],['porto','rain',2180],['serra','sunset',1270]] as const){
      const s=createRace(track,undefined,7,condition);s.mode='racing';s.countdown=0;s.time=28;s.tick=1680;s.heat=60;s.policeActive=true;s.traffic=[];s.obstacles=[];
      s.riders.forEach((r,i)=>Object.assign(r,{z:z+[0,55,120,-20,-50,-70,-140,-260][i],x:[0,-2,2,-3,3,0,2,-1][i],speed:i?60:64}));
      s.riders.push({...s.riders[0],id:'police',name:'POLÍCIA',profile:'police',z:z-85,x:2,color:'#e7e9e5'});
      await page.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
      assert.equal(await page.locator('#race-track').innerText(),getTrack(track).name.toUpperCase());
      assert.equal(await page.locator('#corner-warning').isVisible(),true);
      if(track==='porto')assert.match(await page.locator('#corner-title').innerText(),/OBRAS/);
      // Exercise the longest connection label as well as the ordinary solo layout.
      if(track==='serra')await page.evaluate(()=>{const status=document.getElementById('online-hud')!;status.hidden=false;status.textContent='SALA ABCDEF · CONEXÃO PERDIDA · VOLTE AO MENU';});
      const boxes=await page.evaluate(()=>Object.fromEntries(['.hud-actions','#race-time','#rear-view','#corner-warning','.race-sidebar','#race-map','.hud-track','.rival-list','.speedometer','.touch-controls'].map(selector=>{
        const r=document.querySelector(selector)!.getBoundingClientRect();return [selector,{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}];
      })));
      for(const [selector,r] of Object.entries(boxes)){if(!r.width)continue;assert.ok(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height,`${name} ${selector} inside viewport: ${JSON.stringify(r)}`);}
      const overlap=(a:typeof boxes[string],b:typeof boxes[string])=>Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;
      for(const a of ['#race-time','#rear-view','#corner-warning'])for(const b of ['.hud-actions','.race-sidebar','.rival-list'])assert.ok(!overlap(boxes[a],boxes[b]),`${name} ${track}: ${a} overlaps ${b}`);
      assert.ok(boxes['.hud-track'].y>=boxes['#race-map'].bottom,`${name}: track below map`);
      assert.ok(!overlap(boxes['.race-sidebar'],boxes['.speedometer']),`${name} ${track}: sidebar overlaps speedometer: ${JSON.stringify(boxes)}`);
      assert.ok(boxes['#corner-warning'].bottom<=(height<520?125:180),`${name}: warning near top`);
      await page.screenshot({path:`${folder}/${name}-${track}.png`});
      if(track==='costa'){
        const pixels=()=>page.evaluate(()=>{const map=document.querySelector<HTMLCanvasElement>('#race-map')!,data=map.getContext('2d')!.getImageData(0,0,map.width,map.height).data;let red=0,blue=0;for(let i=0;i<data.length;i+=4){if(data[i]===255&&data[i+1]===82&&data[i+2]===99)red++;if(data[i]===88&&data[i+1]===166&&data[i+2]===255)blue++;}return {red,blue};});
        const red=await pixels();assert.ok(red.red>=25&&red.blue===0,`${name}: red police beacon`);
        s.time+=.25;await page.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));const blue=await pixels();assert.ok(blue.blue>=25&&blue.red===0,`${name}: blue police beacon`);
        await page.locator('#race-map').screenshot({path:`${folder}/${name}-beacon-blue.png`});
        s.riders.at(-1)!.z=z-301;await page.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));assert.deepEqual(await pixels(),{red:0,blue:0});
        await page.click('#pause-btn');const before=await page.evaluate(()=>window.__game!.snapshot());await page.evaluate(()=>window.advanceTime(500));assert.equal(await page.evaluate(()=>window.__game!.snapshot()),before);
      }
      report.push({name,track,boxes});
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(`${folder}/report.json`,JSON.stringify({ok:true,report,errors},null,2));console.log(JSON.stringify({ok:true,viewports:5,scenarios:report.length,errors}));
}finally{await browser.close();await app.close();vite?.kill('SIGTERM');}
