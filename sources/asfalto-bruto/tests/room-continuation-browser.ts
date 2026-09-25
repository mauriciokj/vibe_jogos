import { chromium, type Page } from 'playwright';
import { createServer, preview } from 'vite';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/service';
import { MemoryStore } from '../server/store';
import { AccountsDB } from '../server/accounts-db';
import { AccountService } from '../server/accounts';
import { finishRider } from '../src/game/simulation';
import { freshSave } from '../src/game/save';
import { getTrack } from '../src/game/content';
import { reopenRoom, lobbyClock } from '../server/room';

const folder='output/room-continuation',origin='http://127.0.0.1:4387';await fs.mkdir(folder,{recursive:true});
let offset=0;const now=()=>Date.now()+offset,store=new MemoryStore(),db=new AccountsDB(':memory:'),identity=db.login('room-qa');
const seed=freshSave();seed.nitro={ferro:2};db.save(identity.id,0,seed,'room-qa-seed');
const accounts=new AccountService({db,now,clientId:'qa.apps.googleusercontent.com',origins:[origin],secure:false,verify:async(credential,nonce)=>{if(credential!==nonce)throw Error();return 'room-qa';}});
const app=createGameServer(store,{now,accounts,origins:[origin]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const serverOptions={host:'127.0.0.1',port:4387,strictPort:true,proxy:{'/api/asfalto':{target:`http://127.0.0.1:${(app.server.address() as {port:number}).port}`,ws:true}}};
const vite=process.env.ROOM_PREVIEW?null:await createServer({server:serverOptions});await vite?.listen();
const built=process.env.ROOM_PREVIEW?await preview({preview:serverOptions}):null;
const browser=await chromium.launch(),errors:string[]=[],pages:Page[]=[];
const activity:{page:number;at:number;event:string}[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function shot(p:Page,name:string){await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));}
async function page(width:number,height:number){
 const p=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500});pages.push(p);
 const index=pages.length-1,log=(event:string)=>activity.push({page:index,at:Date.now(),event});
 p.on('framenavigated',f=>{if(f===p.mainFrame())log('navigate '+f.url());});p.on('crash',()=>log('renderer crash'));
 p.on('websocket',ws=>{ws.on('framesent',e=>{try{const m=JSON.parse(String(e.payload));if(!['input','ping','resume'].includes(m.type))log('send '+JSON.stringify({type:m.type,round:m.round,choice:m.choice}));}catch{}});ws.on('close',()=>log('socket closed'));});
 p.on('pageerror',e=>errors.push(e.stack ?? e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:12}}));
 await p.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(o){this.o=o},renderButton(t){const b=document.createElement('button');b.id='qa-google';b.textContent='Google QA';b.onclick=()=>this.o.callback({credential:this.o.nonce});t.append(b)}}}};`}));
 await p.addInitScript(raw=>{sessionStorage.setItem('asfalto-instructions','1');if(!localStorage.getItem('asfalto-bruto:v1'))localStorage.setItem('asfalto-bruto:v1',raw);},JSON.stringify(seed));
 await p.goto(origin+'/?test',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__game);return p;
}
async function result(p:Page){await p.waitForFunction(()=>!!JSON.parse(window.render_game_to_text()).result);await p.evaluate(()=>window.advanceTime(6000));await p.locator('#result-modal[open]').waitFor();}
async function finish(code:string,ids?:string[]){
 await store.mutate(code,r=>{
  const s=r.race!;s.time=90;s.traffic=[];s.obstacles=[];
  for(const rider of s.riders){if(rider.profile==='police'||s.multiplayer!.results[rider.id]||ids&&!ids.includes(rider.id))continue;
   rider.finishedAt=90+s.riders.indexOf(rider);rider.z=getTrack(s.trackId).distance;rider.speed=0;rider.feats!.policeKnockdowns=1;rider.feats!.rivalKnockdowns=2;rider.nitroUsed=1;rider.nitro=Math.max(0,(rider.nitro ?? 0)-1);finishRider(s,rider,'finish');}
  if(!ids){s.mode='finished';r.phase='finished';r.finishedAt=now();}
 });
}
async function jumpClock(code:string,ms:number){offset+=ms;await store.mutate(code,r=>r.members.forEach(m=>m.lastSeen=now()));}
try{
 const host=await page(1440,900),guest=await page(390,844),third=await page(320,568);
 await host.click('#account-btn');await host.click('#qa-google');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);await host.click('#account-modal .close-btn');
 await host.click('#online-btn');await host.fill('#online-name','Anfitrião');await host.selectOption('#online-track','costa:night');await host.check('#online-public');await host.check('#online-bots');await host.click('#online-create');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
 const code=(await state(host)).online.code;
 for(const [i,p] of [guest,third].entries()){await p.click('#online-btn');await p.fill('#online-name',`Amigo ${i+1}`);await p.fill('#online-code-input',code);await p.click('#online-join');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');}
 const ids=await Promise.all([host,guest,third].map(async p=>(await state(p)).online.id));
 assert.equal(await guest.locator('#lobby-track').isDisabled(),true);assert.equal(await host.locator('#lobby-track').isDisabled(),false);assert.equal(await guest.locator('#lobby-bike option[value="policial"]').count(),0);
 for(const p of [host,guest,third])await p.click('#online-ready');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.locked);await jumpClock(code,5001);
 for(const p of [host,guest,third])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
 await finish(code,ids.slice(0,2));await result(host);await result(guest);assert.equal(await host.locator('#online-next-btn').isDisabled(),true);assert.equal(await guest.locator('#online-lobby-btn').isDisabled(),true);assert.equal((await state(third)).screen,'race');await shot(guest,'mobile-waiting-for-finish');
 await finish(code);await result(third);await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.phase==='finished');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.cash===2650);
 assert.equal((await state(guest)).save.cash,2370);assert.equal((await state(guest)).save.nitro.ferro,1);assert.equal((await state(host)).payout.baseReward,1400);assert.equal((await state(guest)).payout.baseReward,1120);assert.equal((await state(host)).payout.total,2000);assert.match(await host.locator('.rival-bonus').innerText(),/2 derrubadas × 50 moedas/);assert.match(await host.locator('.police-bonus').innerText(),/1 derrubada × 500 moedas/);
 await host.click('#online-next-btn');await guest.click('#online-next-btn');await host.waitForFunction(()=>document.querySelector('#online-next-btn')?.textContent?.includes('2/3'));
 assert.equal((await state(host)).online.round,0);await shot(host,'desktop-two-of-three');await shot(third,'small-results');
 await guest.reload();await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='finished');await result(guest);assert.equal((await state(guest)).save.cash,2370);assert.equal(await guest.locator('#online-next-btn').getAttribute('aria-pressed'),'true');
 await third.click('#online-next-btn');for(const p of [host,guest,third])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.round===1&&JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
 assert.equal((await state(host)).online.code,code);assert.deepEqual(await Promise.all([host,guest,third].map(async p=>(await state(p)).online.id)),ids);assert.equal(await guest.inputValue('#lobby-track'),'costa:rain');assert.equal(await guest.locator('#lobby-bike').isDisabled(),true);await shot(host,'next-countdown-same-room');
 await jumpClock(code,5001);for(const p of [host,guest,third])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race'&&JSON.parse(window.render_game_to_text()).condition==='rain');
 assert.equal((await state(host)).result,null);await host.keyboard.down('w');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.speed>8);await host.keyboard.up('w');await shot(host,'second-race-driving');
 await finish(code);for(const p of [host,guest,third])await result(p);await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).save.cash===4650);assert.equal((await state(guest)).save.cash,4090);assert.equal((await state(guest)).save.nitro.ferro,0);
 assert.equal(db.ranking('multi','costa','night','time',identity.id).find(r=>r.me)!.races,1);assert.equal(db.ranking('multi','costa','rain','time',identity.id).find(r=>r.me)!.races,1);
 await guest.click('#online-lobby-btn');for(const p of [host,guest,third])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.round===2);
 assert.equal((await state(host)).online.manualStart,true);assert.equal((await state(host)).online.deadline,null);assert.equal((await state(host)).online.members.every((m:{ready:boolean})=>!m.ready),true);
 await host.selectOption('#lobby-track','porto:rain');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.trackId==='porto');
 await host.selectOption('#lobby-bike','brutal');await guest.selectOption('#lobby-bike','falcao');await third.selectOption('#lobby-bike','agulha');
 await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.members.map((m:{bikeId:string})=>m.bikeId).join(',')==='brutal,falcao,agulha');
 for(const [p,label] of [[host,'desktop'],[guest,'mobile'],[third,'small']] as const){await p.locator('#online-modal').evaluate(e=>e.scrollTop=0);await shot(p,`${label}-lobby-settings`);assert.ok(await p.locator('#online-modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await jumpClock(code,60001);await host.waitForTimeout(600);assert.equal((await state(host)).online.phase,'lobby');assert.equal((await state(host)).online.locked,false);
 await host.click('#online-ready');await guest.selectOption('#lobby-bike','lobo');await host.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.members[1].bikeId==='lobo');
 await host.selectOption('#lobby-track','serra:day');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.members.every((m:{ready:boolean})=>!m.ready));
 await host.click('#online-leave');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.hostId===JSON.parse(window.render_game_to_text()).online.id);assert.equal(await guest.locator('#lobby-track').isDisabled(),false);
 await guest.selectOption('#lobby-track','terra:sunset');await third.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.trackId==='terra');
 const publicRooms=await (await fetch(origin+'/api/asfalto/?op=rooms')).json();assert.ok(publicRooms.rooms.some((r:{code:string})=>r.code===code));
 await guest.reload();await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');assert.equal(await guest.inputValue('#lobby-bike'),'lobo');assert.equal(await guest.inputValue('#lobby-track'),'terra:sunset');assert.equal((await state(guest)).save.cash,4090);await shot(guest,'mobile-new-host-reconnected');
 await guest.click('#online-ready');await third.click('#online-ready');await guest.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online.locked);await jumpClock(code,5001);for(const p of [guest,third])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race'&&JSON.parse(window.render_game_to_text()).track==='terra');
 assert.equal((await state(guest)).player.bikeId,'lobo');assert.equal((await state(third)).player.bikeId,'agulha');assert.equal((await state(guest)).online.code,code);await shot(third,'small-third-race');
 // A moving rider behind the dirt starting line still emits valid dust circles.
 await store.mutate(code,r=>{const bot=r.race!.riders.find(rider=>rider.id==='cpu-2')!;bot.z=-7;bot.speed=15;});
 await guest.waitForTimeout(250);await shot(guest,'terra-dust-behind-start');
 // A resumed client may first see the next race, without any lobby snapshot.
 await finish(code);for(const p of [guest,third])await result(p);
 await store.mutate(code,r=>{reopenRoom(r,'again',now()-5001);lobbyClock(r,now());});
 for(const p of [guest,third])await p.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text());return s.online?.round===3&&s.screen==='race'&&s.result===null;});
 await shot(guest,'new-round-without-lobby-snapshot');
 await finish(code);for(const p of [guest,third])await result(p);await guest.click('#online-menu-btn');
 await third.waitForFunction(()=>document.querySelector('#online-continuation-status')?.textContent?.includes('Apenas você permanece'));
 assert.equal(await third.locator('#online-next-btn').isDisabled(),true);assert.equal(await third.locator('#online-lobby-btn').isDisabled(),false);
 await third.click('#online-lobby-btn');await third.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.round===4);
 assert.equal((await state(third)).online.members.length,1);assert.equal((await state(third)).online.locked,false);await third.click('#online-leave');
 assert.deepEqual(errors,[]);console.log('PASS persistent multiplayer: three clients, unanimous next, round reset, same code/IDs, account/guest receipts and nitro, return lobby, track/bike changes, host transfer, discovery, reload and three races across desktop/mobile.');
}catch(error){for(const [i,p] of pages.entries())if(!p.isClosed())await shot(p,`failure-${i}`).catch(()=>{});throw error;}
finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors));await fs.writeFile(`${folder}/activity.json`,JSON.stringify(activity,null,2));await browser.close();await vite?.close();if(built)await new Promise<void>(resolve=>built.httpServer.close(()=>resolve()));await app.close();db.close();}
