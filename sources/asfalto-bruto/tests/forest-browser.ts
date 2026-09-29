import { forestRoad, FOREST_WILDLIFE } from '../src/game/forest';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRace } from '../src/game/simulation';
import { recoveryCommand } from '../src/game/recovery';
import { freshSave } from '../src/game/save';
import { CONDITIONS } from '../src/game/conditions';
import type { RaceCondition } from '../src/game/types';

const folder='output/mata',vite=await createServer({server:{host:'127.0.0.1',port:4395,strictPort:true}});
await fs.mkdir(folder,{recursive:true});await vite.listen();
const browser=await chromium.launch(),errors:string[]=[],requests:string[]=[];
const a=await browser.newPage({viewport:{width:1440,height:900}});
a.on('pageerror',e=>errors.push(e.message));a.on('console',m=>{if(m.type()==='error')errors.push(m.text());});a.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
const state=()=>a.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(name:string)=>{await a.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(),null,2));};
async function scene(condition:RaceCondition,z=580,monkey=false){
  const save=freshSave();save.ownedKneePads=['gold'];save.kneePadId='gold';
  const s=createRace('mata',save,91,condition);s.mode='racing';s.countdown=0;s.time=30;s.tick=1800;
  s.riders.forEach((p,i)=>Object.assign(p,{z:z+i*27,x:i?forestRoad(z+i*27).lanes[i%forestRoad(z+i*27).lanes.length]:0,speed:38}));
  if(monkey){s.scenicEvent={kind:'monkey',z:z+32,startedAt:29,duration:8};s.traffic=[];s.riders=s.riders.slice(0,1);}
  await a.evaluate(raw=>window.__game!.restore(raw),JSON.stringify(s));
}
try{
  await a.goto('http://127.0.0.1:4395/mata.html?test');await a.waitForFunction(()=>!!window.__game);assert.ok((await state()).paused);await shot('menu');
  for(const condition of CONDITIONS){
    if(!(await state()).paused)await a.click('#pause-btn');
    await a.selectOption('#condition',condition.id);await a.click('#start-btn');await a.evaluate(()=>window.advanceTime(3700));assert.equal((await state()).condition,condition.id);
    await scene(condition.id);await shot(condition.id);
    await a.keyboard.down('w');await a.keyboard.down('d');await a.keyboard.press('Space');await a.evaluate(()=>window.advanceTime(150));assert.ok((await state()).player.kneeSupport>.5);assert.ok((await state()).player.z>580);await a.keyboard.up('d');await a.keyboard.up('w');
    await a.keyboard.press('Escape');const paused=await a.evaluate(()=>window.__game!.snapshot());await a.evaluate(()=>window.advanceTime(500));assert.equal(await a.evaluate(()=>window.__game!.snapshot()),paused);await a.keyboard.press('Escape');
    await scene(condition.id,1120);await shot(`merge-${condition.id}`);
    await scene(condition.id,1390);assert.equal((await state()).road.lanes.length,2);assert.equal((await state()).canopy,1);await shot(`canopy-${condition.id}`);
    await scene(condition.id,1570);
    await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders=s.riders.slice(0,1);s.traffic=[];s.riders[0].x=2.7;window.__game!.restore(JSON.stringify(s));});
    assert.ok((await state()).mud>.9);await shot(`mud-${condition.id}`);const speed=(await state()).player.speed;
    await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(200));await a.keyboard.up('w');assert.ok((await state()).player.speed<speed);assert.equal((await state()).player.falls,0);assert.ok((await state()).player.mudSlip>.2);await shot(`skid-${condition.id}`);
    await a.keyboard.down('w');await a.evaluate(()=>window.advanceTime(600));await a.keyboard.up('w');assert.equal((await state()).player.falls,1);assert.ok((await state()).player.recovery);await shot(`mud-fall-${condition.id}`);
    if(condition.id==='day'){
      for(let i=0;i<100 && (await state()).player.recovery;i++){
        const command=recoveryCommand((await state()).player);await a.evaluate(cmd=>window.__game!.command(cmd,12),command);
      }
      assert.equal((await state()).player.recovery,undefined);assert.equal((await state()).player.falls,1);await shot('mud-remounted');
    }
    await scene(condition.id,2260);await shot(`hairpin-entry-${condition.id}`);
    await scene(condition.id,2400);await shot(`hairpin-${condition.id}`);
    for(const animal of FOREST_WILDLIFE.slice(0,4)){
      await scene(condition.id,animal.z-8);assert.ok((await state()).animals.some((a:{kind:string})=>a.kind===animal.kind));await shot(`animal-${animal.kind}-${condition.id}`);
    }
    await scene(condition.id,2100);await shot(`branches-${condition.id}`);await scene(condition.id,2170,true);await shot(`monkey-${condition.id}`);
  }
  await scene('day');await a.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];s.riders[0].z=7599.9;window.__game!.restore(JSON.stringify(s));window.advanceTime(17);});assert.equal((await state()).result.reason,'finish');await shot('finish');
  for(const [width,height] of [[390,844],[320,568],[844,390]]){
    await a.setViewportSize({width,height});await a.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));await scene('day',1390);await shot(`mobile-${width}`);
    await scene('day',FOREST_WILDLIFE[0].z-35);await shot(`animal-mobile-${width}`);
    await scene('day',2400);await shot(`hairpin-mobile-${width}`);
    assert.ok(await a.locator('body').evaluate(e=>e.scrollWidth<=innerWidth));
    await a.keyboard.press('Escape');await shot(`menu-${width}`);assert.ok(await a.locator('.preview-panel').evaluate(e=>e.scrollWidth<=e.clientWidth));
  }
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mobile.goto('http://127.0.0.1:4395/mata.html?test');await mobile.waitForFunction(()=>!!window.__game);
  await scene('day');await mobile.evaluate(raw=>window.__game!.restore(raw),await a.evaluate(()=>window.__game!.snapshot()));
  const cd=await mobile.context().newCDPSession(mobile),points=[];
  for(const [id,selector] of [[1,'[data-key="ArrowRight"]'],[2,'[data-key="ArrowUp"]'],[3,'[data-action="knee"]']] as const){
    const box=(await mobile.locator(selector).boundingBox())!;points.push({id,x:box.x+box.width/2,y:box.y+box.height/2});
  }
  await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points.slice(0,2)});
  await mobile.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));
  await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await mobile.evaluate(()=>window.advanceTime(100));
  const touched=await mobile.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.ok(touched.player.kneeSupport>.5);assert.ok(touched.player.speed>38);
  await mobile.screenshot({path:`${folder}/mobile-touch-knee.png`});
  await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.keyboard.press('Escape');const frozen=await mobile.evaluate(()=>window.__game!.snapshot());await mobile.evaluate(()=>window.advanceTime(500));assert.equal(await mobile.evaluate(()=>window.__game!.snapshot()),frozen);await mobile.close();
  const renderMs:Record<string,number>={};
  await a.setViewportSize({width:1440,height:900});
  for(const [name,z] of [['open',580],['canopy',1390],['mud',1570]] as const){
    await scene('day',z);renderMs[name]=await a.evaluate(()=>{for(let i=0;i<5;i++)window.advanceTime(0);const start=performance.now();for(let i=0;i<20;i++)window.advanceTime(0);return (performance.now()-start)/20;});
  }
  await fs.writeFile(`${folder}/render-ms.json`,JSON.stringify(renderMs,null,2));
  assert.equal(await a.evaluate(()=>localStorage.length),0);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS Mata v3: four conditions, 2+1 and 1+1 lanes, merge, canopy, mud skid/fall/remount, four roadside species, hairpin, Space, pause/resume, finish, branches, monkey, desktop/mobile/native multitouch, no account/storage writes.');
}catch(e){await shot('failure');throw e;}
finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await browser.close();await vite.close();}
