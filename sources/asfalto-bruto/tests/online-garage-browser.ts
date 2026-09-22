import {chromium,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AccountsDB} from '../server/accounts-db';
import {AccountService} from '../server/accounts';
import {createGameServer} from '../server/service';
import {MemoryStore} from '../server/store';
import {buyKneePad,buyWeapon,buyHelmet,paintHelmet,freshSave,SAVE_KEY} from '../src/game/save';
import {MOTORBIKES,getBike} from '../src/game/bikes';

const folder='output/online-garage',origin='http://127.0.0.1:4399';await fs.mkdir(folder,{recursive:true});
const db=new AccountsDB(':memory:'),account=db.login('online-garage-local-qa'),seed=freshSave();seed.cash=40000;seed.races=1;seed.muted=true;
db.save(account.id,0,seed,'local-fixture');const session=db.session(account.id);
const accounts=new AccountService({db,origins:[origin],secure:false,clientId:''});accounts.economy.initialize(account.id);
const action=(kind:string,item:string)=>accounts.economy.action(account.id,{request:crypto.randomUUID(),revision:db.cloud(account.id).revision,action:{kind,item}});
for(const id of ['white','green','blue'])action('knee',id);
action('upgrade','engine');action('helmet','racing');action('color','purple');
let offset=0;const store=new MemoryStore(),app=createGameServer(store,{accounts,origins:[origin],now:()=>Date.now()+offset});
app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4399','--strictPort'],{env:{...process.env,ASFALTO_SERVER_URL:`http://127.0.0.1:${(app.server.address() as any).port}`},stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch(),a=await browser.newPage({viewport:{width:1280,height:900}}),b=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors:string[]=[];
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function shot(p:Page,name:string){await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));}
async function prepare(p:Page){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));await p.addInitScript(()=>sessionStorage.setItem('asfalto-instructions','1'));await p.goto(origin+'/?test');}
async function leave(p:Page){await p.click('#pause-btn');await p.click('#menu-btn');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='menu');}
try{
 await a.context().addCookies([{name:'ab_session',value:session.value,url:origin,httpOnly:true,sameSite:'Lax'}]);
 const guest=freshSave();guest.cash=12000;guest.races=1;guest.muted=true;for(const id of ['white','green','blue'])buyKneePad(guest,id);buyWeapon(guest,'bottle');buyHelmet(guest,'retro');paintHelmet(guest,'orange');
 await b.addInitScript(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:SAVE_KEY,save:guest});
 await prepare(a);await prepare(b);await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).account.signedIn);
 for(const p of [a,b]){
  await p.click('#online-btn');assert.deepEqual(await p.locator('#online-bike option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value)),MOTORBIKES.map(m=>m.id));
  await p.selectOption('#online-bike','lobo');assert.match(await p.locator('#online-loadout').innerText(),/Joelheira Azul \(sem manobra nesta moto\)/);
 }
 await a.selectOption('#online-bike','brutal');await b.selectOption('#online-bike','falcao');
 assert.match(await b.locator('#online-loadout').innerText(),/Garrafa.*Joelheira Azul/);await shot(b,'guest-choice-mobile');
 // Another device finishes these purchases after this browser opened its modal.
 action('knee','purple');action('knee','gold');action('weapon','chain');
 await a.fill('#online-name','Conta');await a.selectOption('#online-track','costa:day');await a.check('#online-bots');await a.click('#online-create');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
 const code=(await state(a)).online.code;assert.match(await a.locator('#online-confirmed-loadout').innerText(),/Brutal 1000.*Corrente.*Joelheira Dourada/);await shot(a,'account-confirmed-lobby');
 await b.fill('#online-name','Convidado');await b.fill('#online-code-input',code);await b.click('#online-join');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.phase==='lobby');
 assert.match(await b.locator('#online-confirmed-loadout').innerText(),/Falcão 450.*Garrafa.*Joelheira Azul/);await shot(b,'guest-confirmed-lobby');
 const aid=(await state(a)).online.id,bid=(await state(b)).online.id;
 await a.click('#online-ready');await b.click('#online-ready');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).online?.locked);offset+=5100;
 for(const p of [a,b])await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');
 let room=(await store.read(code))!;
 for(const [id,bike,pad,weapon] of [[aid,'brutal','gold','chain'],[bid,'falcao','blue','bottle']]){
  const rider=room.race!.riders.find(r=>r.id===id)!;assert.equal(rider.bikeId,bike);assert.equal(rider.kneePadId,pad);assert.equal(rider.weaponId,weapon);assert.equal(rider.maxSpeed,getBike(bike).speed);assert.equal(rider.handling,getBike(bike).handling);
 }
 assert.equal((await state(a)).player.helmetId,'racing');assert.equal((await state(a)).player.helmetColorId,'purple');assert.equal((await state(b)).player.helmetId,'retro');assert.equal((await state(b)).player.helmetColorId,'orange');
 assert.deepEqual(db.cloud(account.id).save!.owned,['ferro']);assert.equal(db.cloud(account.id).save!.bikeId,'ferro');
 // A real double tap reaches the authoritative simulation, then the other peer.
 await store.mutate(code,r=>{const s=r.race!;s.traffic=[];s.obstacles=[];s.heat=0;s.riders.forEach((p,i)=>Object.assign(p,{z:1700+i*50,x:3,speed:35,immune:5}));Object.assign(s.riders.find(p=>p.id===aid)!,{z:1320,x:0,speed:40});});
 await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.z>1310);await a.keyboard.press('a');await a.keyboard.press('a');
 await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.kneeTime>0);await shot(a,'account-knee');
 room=(await store.read(code))!;assert.ok(room.race!.riders.find(r=>r.id===aid)!.kneeTime!>0);
 // The permanent chain deals damage, rather than silently using the basic bat.
 await store.mutate(code,r=>{const s=r.race!;s.riders.forEach((p,i)=>Object.assign(p,{z:2500+i*60,x:5,speed:0,kneeTime:0,immune:0,health:100,crash:0,recovery:undefined,attack:null,cooldown:0}));Object.assign(s.riders.find(p=>p.id===aid)!,{z:1500,x:1});Object.assign(s.riders.find(p=>p.id===bid)!,{z:1500,x:3});});
 await a.waitForFunction(()=>Math.abs(JSON.parse(window.render_game_to_text()).player.z-1500)<5);await a.keyboard.press('l');await b.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.health<100);assert.equal((await state(a)).player.weaponId,'chain');assert.ok((await state(b)).player.health>=68 && (await state(b)).player.health<69);await shot(b,'guest-hit-by-chain');
 await b.keyboard.press('l');await a.waitForFunction(()=>JSON.parse(window.render_game_to_text()).player.health<100);assert.ok((await state(a)).player.health>=76 && (await state(a)).player.health<77);
 for(const p of [a,b]){await p.reload();await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');}
 assert.equal((await state(a)).online.id,aid);assert.equal((await state(a)).player.kneePadId,'gold');assert.equal((await state(a)).player.weaponId,'chain');assert.equal((await state(b)).player.kneePadId,'blue');assert.equal((await state(b)).player.weaponId,'bottle');
 await leave(a);await leave(b);
 // Selecting an online motorcycle never equips/buys it in the solo garage.
 for(const p of [a,b]){await p.click('#start-btn');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).screen==='race');assert.equal((await state(p)).player.bikeId,'ferro');await leave(p);}
 // Expired account sessions must explain the problem instead of silently joining as guest.
 await a.context().clearCookies();await a.click('#online-btn');await a.click('#online-create');await a.waitForFunction(()=>!document.querySelector('#online-error')!.hasAttribute('hidden'));assert.match(await a.locator('#online-error').innerText(),/sessão expirou/);assert.equal((await state(a)).online,null);await shot(a,'expired-account');
 assert.deepEqual(errors,[]);console.log('PASS: seven unowned motorcycles, authoritative account and guest garage, fresh purchases, real knee action/chain damage, two peers/six bots, reconnect, solo preserved and expired session.');
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors,null,2));await browser.close();vite.kill('SIGTERM');await app.close();db.close();}
