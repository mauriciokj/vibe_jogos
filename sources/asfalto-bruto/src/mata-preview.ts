import { forestRoad, forestMudAt, forestCover, FOREST_WILDLIFE } from './game/forest';
import './mata-preview.css';
import { MOTORBIKES, supportsKneeDown } from './game/bikes';
import { curveAt, getTrack, upcomingCorner } from './game/content';
import { CONDITIONS, scenicAppearance } from './game/conditions';
import { DoubleTap } from './game/controls';
import { kneeSupport } from './game/equipment';
import { bindPointerControl } from './pointer-control';
import { Renderer } from './game/renderer';
import { createRace, snapshot, restoreSnapshot, stepRace, STEP } from './game/simulation';
import { freshSave } from './game/save';
import type { Command, RaceCondition, RiderAction } from './game/types';

// Separate local entry point: no storage, account, progression or online calls.
document.querySelector('#app')!.innerHTML=`<canvas id="game" aria-label="Corrida na Mata Fechada"></canvas>
<header><div><small>ASFALTO BRUTO · PROTÓTIPO JOGÁVEL</small><h1>Mata Fechada<span>7,6 km</span></h1></div><button id="pause-btn">Continuar</button></header>
<section class="preview-panel"><label>Condição<select id="condition">${CONDITIONS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label><label>Moto<select id="bike">${MOTORBIKES.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label><label>Começar em<select id="section"><option value="0">Largada</option><option value="480">Primeiras curvas · 2 + 1 faixas</option><option value="1280">Túnel de árvores · 1 + 1 faixas</option><option value="1490">Trecho de lama</option><option value="2000">Clareira e galhos</option><option value="2200">Cotovelo da Mata · curva fechada</option><option value="540">Bichos nas margens</option><option value="3100">Curvas do bosque</option><option value="6600">Mata fechada e lama</option></select></label><button id="start-btn">CORRER ↗</button><p>W/↑ acelera · S/↓ freia · A/D vira<br><b>Espaço + direção</b> ou dois toques: joelheira<br>J/K/L: golpes · Esc: pausa · F: tela cheia</p><small>Joelheira dourada equipada. Avaliação local, sem salvar prêmios ou progresso.</small></section>
<div class="preview-hud" aria-live="off"><span id="pace">0 <small>KM/H</small></span><span id="status">Explore a floresta</span><span id="distance">0,0 / 7,6 KM</span></div>
<div class="preview-touch"><div><button data-key="ArrowLeft" aria-label="Virar à esquerda">←</button><button data-key="ArrowRight" aria-label="Virar à direita">→</button></div><button data-action="knee" aria-label="Apoiar joelho">JOELHO</button><div><button data-key="ArrowDown" aria-label="Frear">↓</button><button data-key="ArrowUp" aria-label="Acelerar">↑</button></div></div>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const renderer=new Renderer($<HTMLCanvasElement>('game')),keys=new Set<string>(),taps=new DoubleTap(),throttleTaps=new DoubleTap();
const resets:(()=>void)[]=[],actions:RiderAction[]=[];
let race=createRace('mata',undefined,88117,'day'),paused=true,manual=new URLSearchParams(location.search).has('test'),accumulator=0,last=0;
function clear(){keys.clear();actions.length=0;taps.reset();throttleTaps.reset();resets.forEach(reset=>reset());}
const steering=()=>Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
function knee(){const side=steering();if(side && !paused && supportsKneeDown(race.riders[0].bikeId))actions.push(side<0?'kneeLeft':'kneeRight');}
function press(code:string){
  if(paused || keys.has(code))return;
  const side=code==='KeyA'||code==='ArrowLeft'?-1:code==='KeyD'||code==='ArrowRight'?1:0;
  if(side && taps.press(side,performance.now()))actions.push(side<0?'kneeLeft':'kneeRight');
  if((code==='KeyW'||code==='ArrowUp') && throttleTaps.press(1,performance.now()))actions.push('wheelie');
  if(code==='Space')knee();keys.add(code);
}
function input():Command{return {steer:steering(),throttle:Number(keys.has('KeyW')||keys.has('ArrowUp')),brake:Number(keys.has('KeyS')||keys.has('ArrowDown')),attack:keys.has('KeyL')?'weapon':keys.has('KeyK')?'kick':keys.has('KeyJ')?'punch':null,action:actions.shift()};}
function start(){
  clear();const save=freshSave(),bike=$<HTMLSelectElement>('bike').value;
  save.bikeId=bike;save.owned.push(bike);save.ownedKneePads=['gold'];save.kneePadId='gold';save.condition[bike]=100;
  race=createRace('mata',save,manual?88117:crypto.getRandomValues(new Uint32Array(1))[0],$<HTMLSelectElement>('condition').value as RaceCondition);
  const z=Number($<HTMLSelectElement>('section').value);
  if(z){race.riders.forEach(r=>r.z+=z);race.mode='racing';race.countdown=0;}
  paused=false;accumulator=0;renderer.resetCamera();draw();
}
function togglePause(){paused=!paused;clear();accumulator=0;draw();}
function update(){if(!paused && race.mode!=='finished')stepRace(race,{player:input()});}
function draw(){
  renderer.render(race);const p=race.riders[0],corner=upcomingCorner(p.z,'mata',p.handling,race.condition,p.kneeTime!>0?p.kneePadId:undefined);
  $('pace').innerHTML=`${Math.round(p.speed*3.6)} <small>KM/H</small>`;
  $('distance').textContent=`${(Math.max(0,p.z)/1000).toFixed(1).replace('.',',')} / 7,6 KM`;
  $('status').textContent=race.result?race.result.reason==='finish'?`${race.result.place}º na chegada · ${(race.result.time/60).toFixed(1)} min`:'Corrida encerrada · tente novamente':paused?'PAUSADO':race.mode==='countdown'?`LARGADA EM ${Math.ceil(race.countdown)}`:p.recovery?'CORRA ATÉ A MOTO':(p.mudSlip ?? 0)>.1?'DERRAPANDO NA LAMA!':forestMudAt(p.z,p.x)>.15?'LAMA · RISCO DE QUEDA':kneeSupport(p,curveAt(p.z,'mata'),'mata')>.35?'JOELHO APOIADO':corner?`${corner.direction==='right'?'→':'←'} ${corner.distance} m · ${corner.speed} km/h`:'RETA · ACELERE';
  $('pause-btn').textContent=paused?'Continuar':'Pausar';
  document.body.classList.toggle('driving',!paused && race.mode!=='finished');
}
$('start-btn').onclick=start;$('pause-btn').onclick=togglePause;
for(const id of ['condition','bike','section'])$(id).onchange=()=>{start();paused=true;clear();draw();};
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLSelectElement)return;
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){togglePause();return;}
  if(e.code==='KeyF'){void(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());return;}
  press(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
const suspend=()=>{paused=true;clear();draw();};
window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
window.addEventListener('orientationchange',clear);
document.querySelectorAll<HTMLButtonElement>('[data-key],[data-action]').forEach(button=>{
  resets.push(bindPointerControl(button,{enabled:()=>!paused,start:()=>{if(button.dataset.key)press(button.dataset.key);else knee();button.classList.add('held');},end:()=>{if(button.dataset.key)keys.delete(button.dataset.key);button.classList.remove('held');}}));
});
window.render_game_to_text=()=>JSON.stringify({screen:'mata-preview',paused,mode:race.mode,track:race.trackId,condition:race.condition,tick:race.tick,coordinates:'x em metros: esquerda negativa, direita positiva; limites da estrada em road.half. z avança em metros; velocidade em m/s.',road:forestRoad(race.riders[0].z),mud:forestMudAt(race.riders[0].z,race.riders[0].x),canopy:forestCover(race.riders[0].z),length:getTrack(race.trackId).distance,player:{...race.riders[0],kneeSupport:kneeSupport(race.riders[0],curveAt(race.riders[0].z,'mata'),'mata')},animals:FOREST_WILDLIFE.filter(a=>a.z>race.riders[0].z-15 && a.z<race.riders[0].z+260),scenic:scenicAppearance(race),obstacles:race.obstacles,result:race.result});
window.advanceTime=ms=>{manual=true;for(let i=0;i<Math.round(ms/(STEP*1000));i++)update();draw();};
if(manual)window.__game={snapshot:()=>snapshot(race),restore:raw=>{clear();race=restoreSnapshot(raw);paused=false;renderer.resetCamera();draw();},start,save:()=>'',command:(cmd,frames)=>{for(let i=0;i<frames && race.mode!=='finished';i++)stepRace(race,{player:cmd});draw();}};
function frame(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;if(!manual){accumulator+=dt;while(accumulator>=STEP){update();accumulator-=STEP;}}draw();requestAnimationFrame(frame);}
start();paused=true;draw();requestAnimationFrame(frame);
