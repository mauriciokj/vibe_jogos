import {chromium,webkit,type Page} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {freshSave,SAVE_KEY} from '../src/game/save';

const origin=process.env.MOBILE_QA_URL || 'http://127.0.0.1:4398/',folder=process.env.MOBILE_QA_OUTPUT || 'output/mobile-controls';
await fs.mkdir(folder,{recursive:true});
const vite=process.env.MOBILE_QA_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4398','--strictPort'],{stdio:'ignore'});
for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const errors:string[]=[],seed=freshSave();seed.races=1;seed.muted=true;seed.nitro={ferro:2};seed.raceCondition='day';
const state=(p:Page)=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
const shot=async(p:Page,name:string)=>{await p.screenshot({path:`${folder}/${name}.png`});await fs.writeFile(`${folder}/${name}.json`,JSON.stringify(await state(p),null,2));};
const value=(p:Page,id:string)=>p.locator('#'+id).getAttribute('aria-valuenow');
async function prepare(p:Page){
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.route('**/api/visitors*',r=>r.fulfill({json:{visitors:18}}));
 await p.route('**/api/asfalto/account/session',r=>r.fulfill({json:{account:null,csrf:'qa',clientId:''}}));
 await p.addInitScript(({key,seed})=>{localStorage.setItem(key,JSON.stringify(seed));sessionStorage.setItem('asfalto-instructions','1');},{key:SAVE_KEY,seed});
 await p.goto(origin+'?test');await p.click('#start-btn');
 await p.evaluate(()=>{const s=JSON.parse(window.__game!.snapshot());s.mode='racing';s.countdown=0;s.time=20;s.riders=s.riders.slice(0,1);s.traffic=[];s.obstacles=[];s.heat=0;Object.assign(s.riders[0],{x:0,z:50,speed:30});window.__game!.restore(JSON.stringify(s));});
}
async function point(p:Page,selector:string){const r=await p.locator(selector).boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};}
async function pointer(p:Page,selector:string,type:string,id:number,x=0,y=0){await p.locator(selector).evaluate((el,a)=>el.dispatchEvent(new PointerEvent(a.type,{bubbles:true,cancelable:true,pointerId:a.id,pointerType:'touch',isPrimary:a.id===41,button:0,buttons:a.type==='pointerup'?0:1,clientX:a.x,clientY:a.y})),{type,id,x,y});}
async function neutral(p:Page){assert.equal(await value(p,'steering-stick'),'0');assert.equal(await value(p,'drive-stick'),'0');assert.equal(await p.locator('[data-touch].is-held').count(),0);}
try{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]] as const){
  const browser=await engine.launch();const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
   await prepare(p);
   for(const selector of ['#game','#race-track','.analog-control>span','#drive-stick','[data-touch="KeyJ"]']){
    const css=await p.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return {select:s.userSelect||s.getPropertyValue('-webkit-user-select'),touch:s.touchAction,callout:s.getPropertyValue('-webkit-touch-callout'),supportsCallout:CSS.supports('-webkit-touch-callout','none')};});
    assert.equal(css.select,'none',selector);if(css.supportsCallout)assert.equal(css.callout,'none',selector);
   }
   for(const selector of ['#game','#drive-stick'])assert.equal(await p.locator(selector).evaluate(el=>getComputedStyle(el).touchAction),'none');
   for(const event of ['selectstart','contextmenu','dragstart'])assert.equal(await p.locator('#race-track').evaluate((el,event)=>el.dispatchEvent(new Event(event,{bubbles:true,cancelable:true})),event),false);
   const l=await point(p,'#steering-stick'),r=await point(p,'#drive-stick');
   // Lifecycle tests run in both engines; synthetic events also exercise the capture fallback.
   await pointer(p,'#steering-stick','pointerdown',41,l.x-22,l.y);await pointer(p,'#drive-stick','pointerdown',42,r.x,r.y-36);await pointer(p,'[data-touch="KeyJ"]','pointerdown',43);
   assert.ok(Number(await value(p,'steering-stick'))< -50);assert.equal(await value(p,'drive-stick'),'100');
   await pointer(p,'[data-touch="KeyJ"]','pointerdown',44);await pointer(p,'[data-touch="KeyJ"]','pointerup',44);assert.equal(await p.locator('[data-touch="KeyJ"].is-held').count(),1,'another finger cannot release the owner');
   await p.evaluate(()=>window.advanceTime(250));assert.equal((await state(p)).player.attack.kind,'punch');assert.ok((await state(p)).player.speed>30);await shot(p,`${name}-held`);
   await pointer(p,'body','pointerup',43);await pointer(p,'body','pointercancel',42);assert.equal(await value(p,'drive-stick'),'0');assert.ok(Number(await value(p,'steering-stick'))<0);await pointer(p,'#steering-stick','lostpointercapture',41);await neutral(p);
   for(const interruption of ['blur','pagehide','orientationchange','visibilitychange']){
    await pointer(p,'#steering-stick','pointerdown',41,l.x-22,l.y);await pointer(p,'#drive-stick','pointerdown',42,r.x,r.y-36);await pointer(p,'[data-touch="KeyK"]','pointerdown',43);
    await p.evaluate(type=>{if(type==='visibilitychange'){Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event(type));delete (document as any).hidden;}else window.dispatchEvent(new Event(type));},interruption);await neutral(p);
    await pointer(p,'body','pointermove',42,r.x,r.y-36);await neutral(p);
   }
   await pointer(p,'#drive-stick','pointerdown',42,r.x,r.y-36);await p.click('#pause-btn');await neutral(p);await p.click('#resume-btn');await pointer(p,'body','pointermove',42,r.x,r.y-36);await neutral(p);
   // A real tap still activates click-based actions exactly once.
   const nitro=await point(p,'#touch-nitro');await p.touchscreen.tap(nitro.x,nitro.y);await p.evaluate(()=>window.advanceTime(17));assert.equal((await state(p)).player.nitro,1);
   if(name==='chromium'){
    const cdp=await p.context().newCDPSession(p),touches=new Map<number,{id:number,x:number,y:number}>();
    const send=async(type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel')=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[...touches.values()]});await p.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));};
    const j=await point(p,'[data-touch="KeyJ"]');touches.set(1,{id:1,x:l.x-16,y:l.y});touches.set(2,{id:2,x:r.x,y:r.y-36});touches.set(3,{id:3,...j});await send('touchStart');await p.waitForTimeout(1250);
    assert.equal(await p.evaluate(()=>getSelection()?.toString()),'');assert.equal(await value(p,'drive-stick'),'100');assert.equal(await p.locator('[data-touch="KeyJ"].is-held').count(),1);
    touches.set(2,{id:2,x:180,y:100});touches.set(3,{id:3,x:180,y:140});await send('touchMove');assert.equal(await value(p,'drive-stick'),'100');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[touches.get(3)!]});touches.delete(3);await p.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));assert.equal(await p.locator('[data-touch].is-held').count(),0);assert.ok(Number(await value(p,'steering-stick'))<0);assert.equal(await value(p,'drive-stick'),'100');await shot(p,'chromium-native-three-fingers');
    touches.clear();await send('touchCancel');await neutral(p);
    touches.set(2,{id:2,x:r.x,y:r.y-36});await send('touchStart');assert.equal(await value(p,'drive-stick'),'100');touches.clear();await send('touchEnd');await neutral(p);
    // Holding on HUD text must not start text selection, zoom or scrolling.
    const label=await point(p,'#race-track');touches.set(5,{id:5,...label});await send('touchStart');await p.waitForTimeout(1250);touches.clear();await send('touchEnd');assert.equal(await p.evaluate(()=>getSelection()?.toString()),'');assert.equal(await p.evaluate(()=>visualViewport?.scale),1);assert.equal(await p.evaluate(()=>scrollY),0);
   }
   // Dialogs keep their normal scrolling, editable text and context menu.
   await p.click('#pause-btn');await p.click('#menu-btn');await p.click('#garage-btn');await p.locator('#garage-modal').evaluate(el=>el.scrollTop=300);assert.ok(await p.locator('#garage-modal').evaluate(el=>el.scrollTop)>0);await shot(p,`${name}-garage`);await p.click('[data-close="garage-modal"]');
   await p.click('#online-btn');await p.fill('#online-name','Piloto de teste');const editable=await p.locator('#online-name').evaluate((el:HTMLInputElement)=>{el.select();return {selection:el.value.slice(el.selectionStart!,el.selectionEnd!),context:el.dispatchEvent(new Event('contextmenu',{bubbles:true,cancelable:true})),touch:getComputedStyle(el).touchAction};});assert.equal(editable.selection,'Piloto de teste');assert.equal(editable.context,true);assert.notEqual(editable.touch,'none');
   await p.locator('#online-modal .close-btn').click();await p.setViewportSize({width:844,height:390});await p.click('#start-btn');await p.evaluate(()=>window.advanceTime(3550));const drive=await point(p,'#drive-stick');await pointer(p,'#drive-stick','pointerdown',42,drive.x,drive.y-36);assert.equal(await value(p,'drive-stick'),'100');await pointer(p,'body','pointerup',42);await neutral(p);await shot(p,`${name}-landscape`);
   console.log(`PASS ${name}: selection/callout protection, pointer ownership, outside release/cancel/capture loss, background/rotation/pause recovery, nitro tap, forms and landscape.`);
  }catch(error){await shot(p,`${name}-failure`);throw error;}finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors,null,2));vite?.kill('SIGTERM');}
