import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { freshSave, buyBike, SAVE_KEY } from '../src/game/save';
import { MOTORBIKES, getBike } from '../src/game/bikes';
import { finishRider } from '../src/game/simulation';

const folder='output/garage-only',origin='http://127.0.0.1:4402';await fs.mkdir(folder,{recursive:true});
let offset=0;const now=()=>Date.now()+offset,store=new MemoryStore(),db=new AccountsDB(':memory:');
const account=db.login('garage-only-browser'),seed=freshSave();seed.cash=100000;seed.races=1;seed.muted=true;
buyBike(seed,'veneno');seed.bikeId='ferro';db.save(account.id,0,seed,'garage-only-fixture');
const accounts=new AccountService({db,origins:[origin],secure:false,clientId:'',now}),session=db.session(account.id);
const app=createGameServer(store,{accounts,origins:[origin],now});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=await createServer({
  plugins:[{name:'qa-visitors',configureServer(server){server.middlewares.use((req,res,next)=>{
    if(!req.url?.startsWith('/api/visitors'))return next();
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({visitors:12}));
  });}}],
  server:{host:'127.0.0.1',port:4402,strictPort:true,proxy:{'/api/asfalto':{target:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`,ws:true}}}
});await vite.listen();
const browser=await chromium.launch(),errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const choices=(p:Page,id='lobby-bike')=>p.locator(`#${id} option`).evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value));
async function shot(p:Page,name:string){await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));}
async function page(width:number,height:number,auth=false){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
  p.on('pageerror',e=>errors.push(e.stack ?? e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  p.on('websocket',ws=>{
    if(!ws.url().includes('/api/asfalto/'))return;
    console.log('Socket opened',auth?'account':'guest');
    ws.on('framesent',frame=>{const m=JSON.parse(String(frame.payload));if(!['input','ping'].includes(m.type))console.log('Sent',m.type);});
    ws.on('framereceived',frame=>{const m=JSON.parse(String(frame.payload));if(!['state','pong'].includes(m.type))console.log('Received',m.type,m.message ?? '');});
    ws.on('socketerror',message=>console.log('Socket error',message));
  });
  if(auth)await p.context().addCookies([{name:'ab_session',value:session.value,url:origin,httpOnly:true,sameSite:'Lax'}]);
  const guest=freshSave();guest.cash=20000;guest.races=1;guest.muted=true;buyBike(guest,'falcao');guest.bikeId='ferro';
  await p.addInitScript(({key,save})=>{sessionStorage.setItem('asfalto-instructions','1');if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));},{key:SAVE_KEY,save:guest});
  await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:12}}));
  await p.goto(origin+'/?test',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__game);
  if(auth)await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);
  return p;
}
async function finish(code:string){await store.mutate(code,r=>{
  const s=r.race!;s.time=90;
  for(const [i,rider] of s.riders.entries()){if(rider.profile==='police')continue;rider.finishedAt=90+i;finishRider(s,rider,'finish');}
  s.mode='finished';r.phase='finished';r.finishedAt=now();
});}
try{
  const host=await page(1440,1000,true),guest=await page(390,844);
  await host.click('#online-btn');assert.equal(await host.isChecked('#online-garage-only'),false);
  assert.deepEqual(await choices(host,'online-bike'),MOTORBIKES.map(b=>b.id));
  await host.selectOption('#online-bike','brutal');await host.check('#online-garage-only');
  assert.deepEqual(await choices(host,'online-bike'),['ferro','veneno']);assert.equal(await host.inputValue('#online-bike'),'ferro');
  await host.uncheck('#online-garage-only');assert.equal((await choices(host,'online-bike')).length,7);
  await host.check('#online-garage-only');await host.selectOption('#online-bike','veneno');
  await host.check('#online-public');await host.check('#online-bots');await host.fill('#online-name','Anfitrião');
  await host.locator('#online-garage-only').scrollIntoViewIfNeeded();await shot(host,'desktop-create');
  await host.click('#online-create');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  const code=(await state(host)).online.code;
  assert.deepEqual(await choices(host),['ferro','veneno']);assert.equal(await host.inputValue('#lobby-bike'),'veneno');
  await host.locator('#online-modal').evaluate(e=>e.scrollTop=0);await shot(host,'desktop-lobby');
  await guest.click('#online-btn');await guest.check('#online-garage-only');
  assert.deepEqual(await choices(guest,'online-bike'),['ferro','falcao']);
  await guest.locator('#online-garage-only').scrollIntoViewIfNeeded();await shot(guest,'mobile-create');
  await guest.uncheck('#online-garage-only');await guest.selectOption('#online-bike','brutal');
  await guest.locator('#online-discovery summary').click();
  const row=guest.locator('.public-room').filter({has:guest.locator(`[data-public-room="${code}"]`)});
  await row.waitFor();assert.match(await row.innerText(),/Somente motos da garagem/);
  await guest.locator('#online-modal').evaluate(e=>e.scrollTop=0);await shot(guest,'mobile-discovery');
  await guest.click(`[data-public-room="${code}"]`);await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  assert.equal((await state(guest)).online.garageOnly,true);assert.equal(await guest.inputValue('#lobby-bike'),'ferro');
  assert.deepEqual(await choices(guest),['ferro','falcao']);await guest.selectOption('#lobby-bike','falcao');
  await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.members[1]?.bikeId==='falcao');
  for(const [width,height] of [[390,844],[320,568],[844,390]]){
    await guest.setViewportSize({width,height});await guest.locator('#online-modal').evaluate(e=>e.scrollTop=0);
    assert.ok(await guest.locator('#online-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await shot(guest,`lobby-${width}`);
  }
  await guest.setViewportSize({width:390,height:844});await guest.reload();
  await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  assert.equal(await guest.inputValue('#lobby-bike'),'falcao');assert.deepEqual(await choices(guest),['ferro','falcao']);
  await host.click('#online-ready');await guest.click('#online-ready');
  await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.locked);offset+=5100;
  for(const p of [host,guest])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  assert.equal((await state(host)).player.bikeId,'veneno');assert.equal((await state(guest)).player.bikeId,'falcao');
  const room=(await store.read(code))!;assert.equal(room.race!.riders.length,8);
  for(const member of room.members)assert.equal(room.race!.riders.find(r=>r.id===member.id)!.maxSpeed,getBike(member.bikeId).speed);
  await host.keyboard.down('w');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>8);await host.keyboard.up('w');
  await shot(host,'race-owned-bikes');await shot(guest,'race-mobile');
  await finish(code);
  for(const p of [host,guest]){await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='finished');await p.evaluate(()=>window.advanceTime(6000));await p.locator('#result-modal[open]').waitFor();}
  await guest.click('#online-lobby-btn');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.round===1);
  assert.equal((await state(host)).online.garageOnly,true);assert.deepEqual(await choices(host),['ferro','veneno']);
  assert.deepEqual(await choices(guest),['ferro','falcao']);await host.selectOption('#lobby-bike','ferro');
  await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.members[0]?.bikeId==='ferro');
  await guest.locator('#online-modal').evaluate(e=>e.scrollTop=0);await shot(guest,'mobile-reopened');
  await host.click('#online-leave');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.hostId===JSON.parse(window.render_game_to_text()).online.id);
  assert.equal((await state(guest)).online.garageOnly,true);
  // The skill's standard browser client joins this restricted room via an invite.
  if(process.env.WEB_GAME_CLIENT){
    // Forced SwiftShader makes actionability checks time out on this macOS host.
    // Keep the standard skill client and select Chromium's native renderer.
    const preload=`${folder}/native-renderer.mjs`;
    await fs.writeFile(preload,`import { createRequire } from 'node:module';\nconst {chromium}=createRequire(process.env.WEB_GAME_CLIENT)('playwright');\nconst {chromium:local}=createRequire(process.cwd()+'/package.json')('playwright');\nconst launch=local.launch.bind(local);\nchromium.launch=options=>launch({...options,args:options?.args?.filter(arg=>!arg.startsWith('--use-gl=')&&!arg.startsWith('--use-angle='))});\n`);
    await fs.rm(`${folder}/skill/errors-0.json`,{force:true});
    const child=spawn(process.execPath,['--import',`${process.cwd()}/${preload}`,process.env.WEB_GAME_CLIENT,'--url',`${origin}/?test&sala=${code}`,'--click-selector','#online-join','--actions-json',JSON.stringify({steps:[{buttons:[],frames:6}]}),'--iterations','1','--pause-ms','500','--screenshot-dir',`${folder}/skill`],{stdio:['ignore','pipe','pipe']});
    let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
    const [status]=await once(child,'exit');await fs.writeFile(`${folder}/skill.log`,log);assert.equal(status,0,log);
    const skill=JSON.parse(await fs.readFile(`${folder}/skill/state-0.json`,'utf8'));
    assert.equal(skill.online.garageOnly,true);assert.equal(skill.online.members.find((m:any)=>m.id===skill.online.id).bikeId,'ferro');
  }
  await guest.click('#online-leave');
  assert.deepEqual(errors,[]);console.log('PASS: owned-bike option, accounts/guests, public discovery, mobile layouts, reconnect, racing, reopened lobby and host transfer.');
}catch(error){
  for(const [i,context] of browser.contexts().entries())for(const p of context.pages()){
    await shot(p,`failure-${i}`);await fs.writeFile(`${folder}/failure-${i}.txt`,await p.locator('body').innerText());
  }
  throw error;
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors,null,2));await browser.close();await vite.close();await app.close();db.close();}
