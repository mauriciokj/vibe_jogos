import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),catalog=process.env.VIBE_CATALOG_DIR|| (existsSync('output/jogos-publish/infra/vps/catalog-server.cjs')?'output/jogos-publish':'../..');
const {createCatalogServer}=require(path.resolve(catalog,'infra/vps/catalog-server.cjs'));
const dir=await fs.mkdtemp(path.join(tmpdir(),'visitor-browser-')),folder='output/visitors';await fs.mkdir(folder,{recursive:true});
const app=createCatalogServer(path.join(dir,'db.sqlite'));app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const api=`http://127.0.0.1:${app.server.address().port}`,base='http://127.0.0.1:4365/';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4365','--strictPort'],{env:{...process.env,VIBE_CATALOG_URL:api},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:800}}),p=await context.newPage(),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const count=async()=>(await(await fetch(api+'/api/visitors')).json()).visitors;
const visible=page=>page.locator('#visitor-count').waitFor({state:'visible'});
try{
  await p.goto(base+'?test');await visible(p);assert.match(await p.locator('#visitor-count').innerText(),/primeira pessoa/);assert.equal(await count(),0);
  await p.goto(base);await visible(p);assert.match(await p.locator('#visitor-count').innerText(),/1 pessoa já tentou/);await p.screenshot({path:`${folder}/desktop.png`});
  await p.reload();await visible(p);assert.equal(await count(),1);
  const tab=await context.newPage();await tab.goto(base);await visible(tab);assert.equal(await count(),1);await tab.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.goto(base);await visible(mobile);assert.match(await mobile.locator('#visitor-count').innerText(),/2 pessoas já tentaram/);assert.equal(await count(),2);
  for(const [width,height,label] of [[390,844,'mobile'],[320,568,'mobile-small'],[844,390,'mobile-landscape']]){
    await mobile.setViewportSize({width,height});await mobile.locator('#visitor-count').scrollIntoViewIfNeeded();assert.ok(await mobile.locator('#menu').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    const counter=await mobile.locator('#visitor-count').boundingBox(),garage=await mobile.locator('.bike-line').boundingBox(),routes=await mobile.locator('.route-select').boundingBox();assert.ok(counter.y>=garage.y+garage.height-1);assert.ok(routes.y>=counter.y+counter.height-1||routes.x>=counter.x+counter.width-1);await mobile.screenshot({path:`${folder}/${label}.png`});
  }
  await mobile.close();await p.goto(base+'?test');await visible(p);assert.equal(await count(),2);await p.click('#start-btn');if(await p.locator('#help-go').isVisible())await p.click('#help-go');await p.evaluate(()=>window.advanceTime(3900));await p.keyboard.down('w');await p.evaluate(()=>window.advanceTime(1000));await p.keyboard.up('w');let game=JSON.parse(await p.evaluate(()=>window.render_game_to_text()));assert.equal(game.screen,'race');assert.ok(game.player.speed>0);assert.equal(await count(),2);await p.screenshot({path:`${folder}/race.png`});await p.click('#pause-btn');await p.click('#menu-btn');await visible(p);
  assert.deepEqual(errors,[]);
  await p.route('**/api/visitors*',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));await p.reload();await p.waitForTimeout(300);assert.equal(await p.locator('#visitor-count').isVisible(),false);await p.click('#start-btn');await p.evaluate(()=>window.advanceTime(3900));assert.equal(JSON.parse(await p.evaluate(()=>window.render_game_to_text())).screen,'race');
  const report={ok:true,readOnlyTests:true,reloadAndTabsDeduplicated:true,twoBrowsers:2,mobileSizes:3,gameplayAndPause:true,unavailableDoesNotBlock:true,errors};await fs.writeFile(`${folder}/browser.json`,JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();vite.kill('SIGTERM');await app.close();await fs.rm(dir,{recursive:true,force:true});}
