import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';

const live=process.env.PUBLIC_URL;
const folder=`output/public-rooms/${live?'public':'local'}`;await fs.mkdir(folder,{recursive:true});
const store=new MemoryStore();const app=live?undefined:createGameServer(store);
if(app){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');}
const vite=app?spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4375','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`},stdio:'ignore'}):undefined;
const url=live || 'http://127.0.0.1:4375/';
if(!live)for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({headless:true,args:live?['--host-resolver-rules=MAP flowofdevelopment.com 2.25.126.149, MAP asfaltobruto.flowofdevelopment.com 2.25.126.149']:[]});
const desktop=await browser.newContext({viewport:{width:1280,height:900}});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const host=await desktop.newPage(),guest=await mobile.newPage();host.setDefaultTimeout(12000);guest.setDefaultTimeout(12000);const errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=(p:Page,name:string)=>p.screenshot({path:`${folder}/${name}.png`});
const leave=async(p:Page)=>{const s=await state(p);if(s.screen==='race'){await p.keyboard.press('Escape');await p.click('#menu-btn');}else if(s.screen==='result')await p.click('#online-menu-btn');else if(s.online?.phase==='lobby')await p.click('#online-leave');};
try {
  for(const page of [host,guest]) {
    page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
    if(!live)await page.route('**/api/visitors*',route=>route.fulfill({json:{visitors:42,count:42,total:42}}));
    await page.goto(`${page===guest && live?'https://flowofdevelopment.com/asfalto-bruto/':url}?test`,{waitUntil:'domcontentloaded'});
  }
  const save=(await state(host)).save;
  await guest.click('#online-btn');await guest.fill('#online-name','QA Visitante');
  await guest.click('#online-discovery summary');
  await guest.waitForFunction(()=>!!document.querySelector('[data-public-status]')?.textContent && !document.querySelector('[data-public-status]')?.textContent?.includes('Procurando'));
  if(!live)assert.match(await guest.locator('[data-public-status]').innerText(),/Nenhuma sala pública/);
  await shot(guest,'01-mobile-search');
  await host.click('#online-btn');await host.fill('#online-name','QA Anfitriao');
  assert.equal(await host.isChecked('#online-public'),false);
  await host.check('#online-public');await host.check('#online-bots');await host.selectOption('#online-track','terra:night');
  await host.click('#online-create');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  let s=await state(host);const code=s.online.code;
  assert.equal(s.online.public,true);assert.ok(s.online.deadline-s.online.serverNow>117_000);assert.match(await host.locator('#online-visibility').innerText(),/PÚBLICA/);
  await host.click('#online-ready');await host.waitForTimeout(300);assert.equal((await state(host)).online.locked,false);await shot(host,'02-public-120s');
  await guest.locator(`[data-public-room="${code}"]`).waitFor();await shot(guest,'03-mobile-public-room');
  assert.ok(await guest.locator('#online-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.equal(await guest.inputValue('#online-code-input'),'');
  await guest.locator(`[data-public-room="${code}"]`).click();
  await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  assert.equal((await state(guest)).online.code,code);assert.equal((await state(guest)).online.members.length,2);
  await guest.click('#online-ready');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);
  assert.ok((await state(host)).online.deadline-(await state(host)).online.serverNow<=5000);await shot(host,'04-all-ready-5s');
  await Promise.all([host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race'),guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race')]);
  const memberId=(await state(guest)).online.id;
  if(!live)assert.equal((await store.read(code))!.race!.riders.filter(r=>r.profile!=='police').length,8);
  await host.keyboard.down('w');await guest.keyboard.down('w');await host.waitForTimeout(1400);await host.keyboard.up('w');await guest.keyboard.up('w');
  assert.ok((await state(host)).player.speed>5);assert.ok((await state(guest)).player.speed>5);await shot(guest,'05-mobile-race');
  await guest.reload({waitUntil:'domcontentloaded'});await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
  assert.equal((await state(guest)).online.id,memberId);assert.equal((await state(guest)).online.public,true);
  await leave(host);await leave(guest);
  // Private invitation remains the default and never appears in discovery.
  await host.click('#online-btn');await host.uncheck('#online-public');await host.click('#online-create');
  await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  const hidden=(await state(host)).online.code;assert.equal((await state(host)).online.public,false);
  assert.ok((await state(host)).online.deadline-(await state(host)).online.serverNow>57_000);
  await guest.click('#online-btn');if(!await guest.locator('#online-discovery').evaluate(el=>(el as HTMLDetailsElement).open))await guest.click('#online-discovery summary');
  await guest.waitForTimeout(1100);await guest.click('#online-refresh');await guest.waitForTimeout(400);
  assert.equal(await guest.locator(`[data-public-room="${hidden}"]`).count(),0);
  await guest.fill('#online-code-input',hidden);await guest.click('#online-join');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
  await leave(guest);await leave(host);
  if(!live) {
    // The room can close after a list response; a failed join must remain retryable.
    await host.click('#online-btn');await host.check('#online-public');await host.click('#online-create');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
    const gone=(await state(host)).online.code;
    await guest.click('#online-btn');await guest.locator(`[data-public-room="${gone}"]`).waitFor();
    await leave(host);
    await guest.locator(`[data-public-room="${gone}"]`).click();await guest.locator('#online-error').waitFor();
    assert.match(await guest.locator('#online-error').innerText(),/não está mais disponível/);
    assert.equal(await guest.locator('#online-create').isEnabled(),true);
    await guest.check('#online-public');await guest.click('#online-create');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');await leave(guest);
  }
  await host.click('#start-btn');if(await host.locator('#help-modal').isVisible())await host.click('#help-go');
  await host.keyboard.down('w');await host.evaluate(()=>window.advanceTime(7000));await host.keyboard.up('w');
  assert.equal((await state(host)).online,null);assert.ok((await state(host)).player.speed>10);assert.deepEqual((await state(host)).save,save);await shot(host,'06-solo-preserved');
  assert.deepEqual(errors,[]);
  await fs.writeFile(`${folder}/report.json`,JSON.stringify({url,checks:['public 120s','minimum two humans','find and join without code','all ready 5s','bots','mobile layout and race','reconnect','private code rooms 60s','stale join retry (local)','single player and save intact'],errors},null,2));
  console.log('✓ Public rooms: 120s, discovery, ready 5s, bots, mobile, reconnect, private invites, retry and solo.');
} finally {await browser.close();await app?.close();vite?.kill('SIGTERM');}
