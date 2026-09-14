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
async function pointer(p:Page,selector:string,type:string,id:number,x=0,y=0){await p.locator(selector).evaluate((el,a)=>el.dispatchEvent(new PointerEvent(a.type,{bubbles:true,cancelable:true,pointerId:a.id,pointerType:'mouse',isPrimary:a.id===41,button:0,buttons:a.type==='pointerup'?0:1,clientX:a.x,clientY:a.y})),{type,id,x,y});}
type Finger={id:number,selector:string,x:number,y:number};
// Fault injection: deliver native touch cancellation without pointerup/cancel,
// or omit an end entirely. Real multi-touch and taps are exercised below too.
async function touch(p:Page,selector:string,type:string,active:Finger[],changed:Finger[]){
 return p.locator(selector).evaluate((el,a)=>{
  const event=new Event(a.type,{bubbles:true,cancelable:true});
  Object.defineProperties(event,{touches:{value:a.active.map(t=>({identifier:t.id,target:document.querySelector(t.selector)!,clientX:t.x,clientY:t.y}))},changedTouches:{value:a.changed.map(t=>({identifier:t.id,target:document.querySelector(t.selector)!,clientX:t.x,clientY:t.y}))}});
  return el.dispatchEvent(event);
 },{type,active,changed});
}
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
   // Mouse/pen lifecycle and the capture fallback remain supported.
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
   const throttle:Finger={id:71,selector:'#drive-stick',x:r.x,y:r.y-36},brake:Finger={...throttle,id:72,y:r.y+36},steer:Finger={id:73,selector:'#steering-stick',x:l.x-22,y:l.y};
   for(const event of ['touchend','touchcancel']){
    assert.equal(await touch(p,'#drive-stick','touchstart',[throttle],[throttle]),false);assert.equal(await value(p,'drive-stick'),'100');
    assert.equal(await touch(p,'#drive-stick',event,[],[throttle]),false);await neutral(p);
   }
   // No end event at all: a new braking finger replaces the vanished owner.
   await touch(p,'#drive-stick','touchstart',[throttle],[throttle]);
   await touch(p,'#drive-stick','touchstart',[brake],[brake]);assert.equal(await value(p,'drive-stick'),'-100');
   const beforeBrake=(await state(p)).player.speed;await p.evaluate(()=>window.advanceTime(300));assert.ok((await state(p)).player.speed<beforeBrake);
   await touch(p,'#steering-stick','touchstart',[brake,steer],[steer]);
   await touch(p,'#drive-stick','touchend',[steer],[brake]);assert.equal(await value(p,'drive-stick'),'0');assert.ok(Number(await value(p,'steering-stick'))<0);
   await touch(p,'#steering-stick','touchcancel',[],[steer]);await neutral(p);
   // An event on another control also clears a stale accelerating finger.
   await touch(p,'#drive-stick','touchstart',[throttle],[throttle]);await touch(p,'#steering-stick','touchstart',[steer],[steer]);assert.equal(await value(p,'drive-stick'),'0');
   await touch(p,'#steering-stick','touchend',[],[steer]);await neutral(p);
   // Browsers may reuse the vanished finger's identifier for the very next tap.
   const reused={...brake,id:throttle.id};
   await touch(p,'#drive-stick','touchstart',[throttle],[throttle]);await touch(p,'#drive-stick','touchstart',[reused],[reused]);assert.equal(await value(p,'drive-stick'),'-100');await touch(p,'#drive-stick','touchend',[],[reused]);await neutral(p);
   for(const interruption of ['blur','pagehide','orientationchange','visibilitychange']){
    await touch(p,'#drive-stick','touchstart',[throttle],[throttle]);
    await p.evaluate(type=>{if(type==='visibilitychange'){Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event(type));delete (document as any).hidden;}else window.dispatchEvent(new Event(type));},interruption);await neutral(p);
    await touch(p,'#drive-stick','touchmove',[throttle],[throttle]);await neutral(p);await touch(p,'#drive-stick','touchend',[],[throttle]);
   }
   for(const event of ['gesturestart','gesturechange','gestureend','dblclick'])assert.equal(await p.locator('#game').evaluate((el,event)=>el.dispatchEvent(new Event(event,{bubbles:true,cancelable:true})),event),false);
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
    // Repeated acceleration/braking with a second thumb held on steering.
    touches.set(1,{id:1,x:l.x-16,y:l.y});await send('touchStart');
    for(let i=0;i<12;i++){
     touches.set(2,{id:2,x:r.x,y:r.y-36});await send('touchStart');assert.equal(await value(p,'drive-stick'),'100');
     touches.set(2,{id:2,x:r.x,y:r.y+36});await send('touchMove');assert.equal(await value(p,'drive-stick'),'-100');
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[touches.get(2)!]});touches.delete(2);assert.equal(await value(p,'drive-stick'),'0');assert.ok(Number(await value(p,'steering-stick'))<0);
    }
    touches.clear();await send('touchEnd');await neutral(p);
    // Pinch and repeated taps over the actual playing surface cannot zoom it.
    touches.set(6,{id:6,x:170,y:380});touches.set(7,{id:7,x:220,y:380});await send('touchStart');
    for(let i=1;i<=8;i++){touches.set(6,{id:6,x:170-i*12,y:380});touches.set(7,{id:7,x:220+i*12,y:380});await send('touchMove');}
    touches.clear();await send('touchEnd');
   }
   for(let i=0;i<8;i++){await p.touchscreen.tap(r.x,r.y-36);await neutral(p);await p.touchscreen.tap(195,380);}
   assert.equal(await p.evaluate(()=>visualViewport?.scale),1);assert.equal(await p.evaluate(()=>scrollY),0);await shot(p,`${name}-zoom-and-release`);
   // Dialogs keep their normal scrolling, editable text and context menu.
   const pause=await point(p,'#pause-btn');await p.touchscreen.tap(pause.x,pause.y);assert.equal((await state(p)).paused,true);await p.click('#menu-btn');await p.click('#garage-btn');await p.locator('#garage-modal').evaluate(el=>el.scrollTop=300);assert.ok(await p.locator('#garage-modal').evaluate(el=>el.scrollTop)>0);await shot(p,`${name}-garage`);await p.click('[data-close="garage-modal"]');
   await p.click('#online-btn');await p.fill('#online-name','Piloto de teste');const editable=await p.locator('#online-name').evaluate((el:HTMLInputElement)=>{el.select();return {selection:el.value.slice(el.selectionStart!,el.selectionEnd!),context:el.dispatchEvent(new Event('contextmenu',{bubbles:true,cancelable:true})),touch:getComputedStyle(el).touchAction};});assert.equal(editable.selection,'Piloto de teste');assert.equal(editable.context,true);assert.notEqual(editable.touch,'none');
   for(const event of ['touchstart','touchmove','touchend','gesturestart','gesturechange','dblclick'])assert.equal(await p.locator('#online-name').evaluate((el,event)=>el.dispatchEvent(Object.assign(new Event(event,{bubbles:true,cancelable:true}),{touches:[],changedTouches:[]})),event),true);
   await p.locator('#online-modal .close-btn').click();await p.setViewportSize({width:844,height:390});await p.click('#start-btn');await p.evaluate(()=>window.advanceTime(3550));const drive=await point(p,'#drive-stick');await pointer(p,'#drive-stick','pointerdown',42,drive.x,drive.y-36);assert.equal(await value(p,'drive-stick'),'100');await pointer(p,'body','pointerup',42);await neutral(p);await shot(p,`${name}-landscape`);
   console.log(`PASS ${name}: native touch release/cancel, missing end recovery, brake takeover, independent fingers, rapid taps/zoom, pointer fallback, interruptions, nitro, forms and landscape.`);
  }catch(error){await shot(p,`${name}-failure`);throw error;}finally{await browser.close();}
 }
 assert.deepEqual(errors,[]);
}finally{await fs.writeFile(`${folder}/errors.json`,JSON.stringify(errors,null,2));vite?.kill('SIGTERM');}
