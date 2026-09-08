import './style.css';
import './multiplayer/style.css';
import { OnlineClient } from './multiplayer/client';
import type { RoomView } from './multiplayer/protocol';
import { EMPTY_COMMAND } from './game/types';
import { BIKES, clamp, clockString, cornerForces, cornerPace, curveAt, upcomingCorner, getTrack, money, TRACKS } from './game/content';
import { raceAwareness } from './game/awareness';
import { GameAudio } from './game/audio';
import { RaceInstruments } from './game/instruments';
import { Renderer } from './game/renderer';
import { createRace, nearestTarget, ranking, restoreSnapshot, snapshot, STEP, stepRace } from './game/simulation';
import { bikeSprite } from './game/sprites';
import { buyBike, buyUpgrade, freshSave, loadSave, persist, repair, repairCost, settleRace, upgradeCost } from './game/save';
import type { Command, RaceState, Upgrade } from './game/types';

const icons = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19 19 5M5 5h14v14"/></svg>',
  garage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21V9l9-6 9 6v12M6 21V11h12v10M6 15h12M6 18h12"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 3m0 2v1"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m11 5-5 4H3v6h3l5 4V5Zm4 3q5 4 0 8m3-11q8 7 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
};
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <canvas id="game" aria-label="Corrida de motos Asfalto Bruto"></canvas>
  <div id="ui">
    <section id="menu" aria-label="Menu principal">
      <div class="menu-shade"></div>
      <header class="topbar"><div class="brand"><span class="checker"></span> AB<span class="brand-separator"> / </span><small>CORRIDA SEM REGRAS</small></div>
        <div class="top-actions"><div class="wallet"><span>CRÉDITOS</span><b id="wallet"></b></div><button class="nav-btn" id="garage-btn">${icons.garage} GARAGEM</button><button class="icon-btn" data-action="help" aria-label="Como jogar">${icons.help}</button><button class="icon-btn" data-action="mute" aria-label="Silenciar áudio">${icons.sound}</button></div>
      </header>
      <div class="menu-main"><div class="eyebrow"><i class="live-dot"></i> OITO PILOTOS. UMA CHEGADA.</div>
        <h1>ASFALTO<span>BRUTO</span></h1><p>A estrada é de todos.<br>A chegada é de um só.</p>
        <div class="start-row"><button class="primary" id="start-btn">JOGAR SOZINHO ${icons.arrow}</button><button class="secondary online-entry" id="online-btn">MULTIPLAYER <span>2–8 PILOTOS ↗</span></button></div>
        <div class="bike-line"><span>NA SUA GARAGEM</span><b id="current-bike"></b><button id="change-bike">TROCAR ↗</button></div>
      </div>
      <div class="route-select"><div><div class="route-heading"><span>ESCOLHA A ESTRADA</span> / <span id="route-count">01 — 03</span></div><div class="routes" id="routes"></div></div><div class="menu-note"><b>INDIVIDUAL + ONLINE OPCIONAL</b><br>TRÂNSITO REAL. RIVAIS SEM PIEDADE.</div></div>
      <footer class="bottomline"><span>ESTRADAS ABERTAS. PUNHOS FECHADOS.</span><span><i class="live-dot"></i> PRONTO PARA A LARGADA</span></footer>
    </section>
    <section id="hud" hidden aria-label="Informações da corrida">
      <div class="hud-top"><div><div class="position"><strong id="position">8</strong><span>/ <b id="rider-total">8</b></span></div><div class="position-label">POSIÇÃO</div></div>
        <div class="hud-track"><div class="eyebrow" id="race-region">RODOVIA LITORÂNEA</div><h2 id="race-track">COSTA DO SOL</h2><span class="hud-time" id="race-time">00:00.0</span></div>
        <div class="hud-actions"><button class="icon-btn" data-action="mute" aria-label="Silenciar áudio">${icons.sound}</button><button class="icon-btn" data-action="fullscreen" aria-label="Tela cheia (F)">${icons.full}</button><button class="icon-btn" id="pause-btn" aria-label="Pausar (Esc)">${icons.pause}</button></div>
      </div>
      <canvas id="rear-view" class="rear-view" aria-label="Retrovisor: pilotos e trânsito até 200 metros atrás"></canvas><canvas id="race-map" class="race-map" aria-label="Mapa dos 300 metros à frente e atrás e distâncias entre pilotos"></canvas><div class="online-hud" id="online-hud" hidden></div><div class="heat-status"><span class="heat-dots" id="heat-dots">${'<i></i>'.repeat(8)}</span><span id="heat-label">PROCURADO</span></div>
      <div id="corner-warning" class="corner-warning" hidden><b id="corner-arrow">↱</b><div><strong id="corner-title"></strong><span id="corner-detail"></span></div></div><div class="rival-list" id="rival-list"></div><div class="race-message" id="race-message" aria-live="polite"></div>
      <div class="countdown" id="countdown"><strong id="count-number">3</strong><span>PREPARE-SE · SEGURE W OU ↑</span></div>
      <div class="crash-overlay" id="crash" hidden><strong>LEVANTA E VAI.</strong><small id="crash-time">VOLTANDO À PISTA...</small></div>
      <div class="race-bottom"><div class="vitals"><div class="meter-label"><span>PILOTO</span><b id="health-value">100%</b></div><div class="meter-track"><i id="health-bar"></i></div><div class="meter-label"><span>MOTO</span><b id="integrity-value">100%</b></div><div class="meter-track bike"><i id="integrity-bar"></i></div><div class="weapon"><span class="weapon-icon">╱</span><span id="weapon-label">BASTÃO</span><kbd>L</kbd><small>J SOCO · K CHUTE</small></div></div>
        <div class="speedometer"><div class="speed-label">KM/H</div><div class="speed-number"><span id="speed">000</span></div><div class="gear" id="gear">N</div><div class="rev-strip" id="revs">${'<i></i>'.repeat(18)}</div></div>
      </div>
      <div class="race-progress"><small id="distance">0.0 KM</small><div class="distance-track"><i id="progress-bar"></i><b id="progress-dot"></b></div><small id="distance-total">8.4 KM <span>⚑</span></small></div>
      <div class="touch-controls"><div class="touch-group"><button data-touch="ArrowLeft" aria-label="Esquerda">←</button><button data-touch="ArrowRight" aria-label="Direita">→</button></div><div class="touch-group"><button data-touch="KeyJ" aria-label="Socar">J</button><button data-touch="KeyK" aria-label="Chutar">K</button><button data-touch="KeyL" aria-label="Bastão">L</button></div><div class="touch-group"><button data-touch="KeyS" aria-label="Frear">↓</button><button data-touch="KeyW" aria-label="Acelerar">↑</button></div></div>
    </section>
  </div>
  <dialog id="help-modal" aria-labelledby="help-title"><div class="dialog-header"><div><div class="eyebrow">ANTES DE DAR A PARTIDA</div><h2 id="help-title">Conheça as regras da rua.</h2></div><button class="close-btn" data-close="help-modal" aria-label="Fechar">×</button></div><div class="dialog-body"><div class="help-grid">
    <div class="control">Acelerar <span class="keys"><kbd>W</kbd><kbd>↑</kbd></span></div><div class="control">Frear <span class="keys"><kbd>S</kbd><kbd>↓</kbd></span></div>
    <div class="control">Pilotar <span class="keys"><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></span></div><div class="control">Soco rápido <span class="keys"><kbd>J</kbd></span></div>
    <div class="control">Chute · empurra o rival <span class="keys"><kbd>K</kbd></span></div><div class="control">Usar bastão <span class="keys"><kbd>L</kbd></span></div>
    <div class="control">Pausar <span class="keys"><kbd>Esc</kbd></span></div><div class="control">Tela cheia / som <span class="keys"><kbd>F</kbd><kbd>M</kbd></span></div>
  </div><div class="tip"><b>Chegue perto e acerte.</b> O rival ao alcance recebe uma marca verde. Um soco em um piloto armado toma o bastão dele. O sinal “!” avisa que um ataque está vindo.</div><div class="tip"><b>Freie antes da curva.</b> O aviso mostra a direção, a distância e uma velocidade de referência. Entrar rápido demais faz a moto escorregar para fora. Solte W / ↑ ou freie com S / ↓, contorne e acelere na saída. O mapa mostra as distâncias; o retrovisor revela os últimos 200 metros.</div><div class="tip"><b>Cuide de você e da moto.</b> Piloto sem resistência cai e volta à pista; moto sem integridade encerra a corrida. Fuja do acostamento, desvie do óleo e observe o trânsito na contramão.</div><div class="tip"><b>A polícia não dorme.</b> Velocidade e golpes aumentam a procura. Caiu com a polícia a até 30 metros? Prisão imediata e fim da corrida. Ficar abaixo de 29 km/h ao lado do policial por 3 segundos também causa prisão. Chegue entre os 5 primeiros para abrir a próxima estrada.</div><div class="help-footer"><span>Progresso salvo neste navegador. No celular, use os botões na tela.</span><button id="help-go" class="primary">ENTENDI. VAMOS CORRER ${icons.arrow}</button></div></div></dialog>
  <dialog id="pause-modal" class="pause-modal" aria-labelledby="pause-title"><div class="dialog-body"><div class="eyebrow" style="justify-content:center">UM RESPIRO NO ACOSTAMENTO</div><h2 id="pause-title">CORRIDA PAUSADA</h2><p>A estrada espera por você.</p><button class="primary" id="resume-btn">CONTINUAR ↗</button><button class="secondary" id="restart-btn">RECOMEÇAR CORRIDA</button><button class="text-button" id="menu-btn">VOLTAR AO MENU</button></div></dialog>
  <dialog id="garage-modal" aria-labelledby="garage-title"></dialog>
  <dialog id="result-modal" class="result-modal" aria-labelledby="result-title"></dialog>
  <dialog id="reset-modal" class="pause-modal" aria-labelledby="reset-title"><div class="dialog-body"><h2 id="reset-title">COMEÇAR DO ZERO?</h2><p>Isso apaga créditos, motos, melhorias e recordes salvos neste navegador.</p><button class="secondary" data-close="reset-modal">MANTER MEU PROGRESSO</button><button class="text-button danger" id="confirm-reset">APAGAR PROGRESSO</button></div></dialog>
  <dialog id="online-modal" class="online-modal" aria-labelledby="online-title">
    <div class="dialog-header"><div><div class="eyebrow">CORRA COM OUTRAS PESSOAS</div><h2 id="online-title">Multiplayer</h2></div><button class="close-btn" id="online-close" aria-label="Voltar ao menu">×</button></div>
    <div class="dialog-body">
      <div id="online-form"><label class="online-label" for="online-name">SEU APELIDO</label><input id="online-name" class="online-input" maxlength="18" placeholder="Como você quer ser chamado?" autocomplete="nickname" />
        <div class="online-choices"><div><h3>Criar uma sala</h3><label class="online-label" for="online-track">ESTRADA</label><select id="online-track" class="online-input">${TRACKS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select><label class="bot-option"><input type="checkbox" id="online-bots" /><span>Completar com bots<small>Até 8 pilotos na largada · mínimo 2 pessoas</small></span></label><button class="primary" id="online-create">CRIAR SALA ↗</button></div>
        <div><h3>Entrar com amigos</h3><label class="online-label" for="online-code-input">CÓDIGO DA SALA</label><input id="online-code-input" class="online-input code-input" maxlength="6" placeholder="A1B2C3" autocapitalize="characters" autocomplete="off" spellcheck="false"/><button class="secondary" id="online-join">ENTRAR NA SALA ↗</button></div></div>
        <p class="online-note">De 2 a 8 pessoas. Todos correm com a Ferro 500, em condições iguais. Sua garagem e progresso individual ficam preservados.</p>
      </div>
      <div id="online-lobby" hidden><div class="lobby-heading"><div><span class="online-label">CONVIDE PELO CÓDIGO</span><div class="room-code" id="online-code"></div><button class="text-button" id="online-copy">COPIAR CONVITE ↗</button></div><div class="lobby-clock"><strong id="online-clock">60</strong><span id="online-clock-label">SEGUNDOS PARA LARGAR</span></div></div>
        <div class="lobby-meta"><span id="online-track-name"></span><span id="online-count">1 / 8 PILOTOS</span></div><div id="online-members" class="lobby-members"></div>
        <p id="online-lobby-hint" class="online-note"></p><button class="primary" id="online-ready">ESTOU PRONTO ↗</button><button class="text-button" id="online-leave">SAIR DA SALA</button>
      </div><p id="online-status" class="online-status" role="status" aria-live="polite"></p><p id="online-error" class="online-error" role="alert" hidden></p>
    </div>
  </dialog>
  <div class="toast" id="toast" role="status" hidden></div>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const renderer = new Renderer($<HTMLCanvasElement>('game'));
const instruments = new RaceInstruments($<HTMLCanvasElement>('rear-view'),$<HTMLCanvasElement>('race-map'));
const audio = new GameAudio();
let save = loadSave();
let selectedTrack = 'costa';
let race = createRace(selectedTrack, save);
let screen: 'menu' | 'race' | 'result' = 'menu';
let paused = false;
let onlineMode = false;
let onlineRaceStarted = false;
let lastOnlineEventTick = -1;
let helpStartsRace = false;
let settled = false;
let last = performance.now();
let accumulator = 0;
let menuTime = 0;
let messageUntil = 0;
let lastCount = 4;
let testMode = new URLSearchParams(location.search).has('test');
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const keys = new Set<string>();
const displayCache: Record<string, string> = {};
const setText = (id: string, value: string) => { if (displayCache[id] !== value) { $(id).textContent = value; displayCache[id] = value; } };

const online = new OnlineClient({
  room: receiveOnlineRoom,
  status: status => {
    $('online-status').textContent = {offline:'',connecting:'CONECTANDO À SALA…',connected:'CONECTADO',reconnecting:'RECONECTANDO · RESERVANDO SUA VAGA…'}[status];
    for (const id of ['online-create','online-join']) $<HTMLButtonElement>(id).disabled = status==='connecting' || status==='reconnecting';
  },
  error: message => { $('online-error').textContent=message; $('online-error').hidden=false; if(!$<HTMLDialogElement>('online-modal').open)toast(message); },
  left: () => { onlineMode=false;onlineRaceStarted=false;showMenu(); },
});
function localId() { return onlineMode && online.id ? online.id : 'player'; }
function localRider() { return race.riders.find(r=>r.id===localId()) ?? race.riders[0]; }
const escapeHTML = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function openOnline() {
  keys.clear();$('online-error').hidden=true;$('online-form').hidden=false;$('online-lobby').hidden=true;
  $<HTMLSelectElement>('online-track').value=selectedTrack;
  try{$<HTMLInputElement>('online-name').value=localStorage.getItem('asfalto:nickname') ?? '';}catch{}
  $<HTMLDialogElement>('online-modal').showModal();
}
function enterOnline(create: boolean) {
  onlineMode=true;onlineRaceStarted=false;lastOnlineEventTick=-1;$('online-error').hidden=true;
  const name=$<HTMLInputElement>('online-name').value.trim() || 'Piloto';
  try{localStorage.setItem('asfalto:nickname',name);}catch{}
  if(create)online.create(name,$<HTMLSelectElement>('online-track').value,$<HTMLInputElement>('online-bots').checked);
  else online.join(name,$<HTMLInputElement>('online-code-input').value);
  void audio.start();
}
function drawLobbyClock() {
  const room=online.room;if(!room || room.phase!=='lobby')return;
  const count=room.members.filter(m=>m.connected).length;
  $('online-clock').textContent=room.deadline===null?'—':String(Math.max(0,Math.ceil((room.deadline-online.serverNow())/1000)));
  $('online-clock-label').textContent=count<2?'AGUARDANDO OUTRO PILOTO':room.locked?'LARGADA FECHADA':'SEGUNDOS PARA LARGAR';
}
function receiveOnlineRoom(room: RoomView) {
  if(!onlineMode)return;
  if(room.phase==='lobby') {
    $('online-form').hidden=true;$('online-lobby').hidden=false;$('online-code').textContent=room.code;
    $('online-track-name').textContent=getTrack(room.trackId).name.toUpperCase();
    const present=room.members.filter(m=>m.connected),me=room.members.find(m=>m.id===online.id);
    $('online-count').textContent=`${present.length} / 8 PESSOAS${room.fillBots ? ` · +${8-present.length} CPU NA LARGADA` : ''}`;
    $('online-members').innerHTML=Array.from({length:8},(_,i)=>{
      const m=present[i];return m?`<div class="lobby-member ${m.id===online.id?'me':''}"><span class="lobby-number">${String(i+1).padStart(2,'0')}</span><b>${escapeHTML(m.name)}${m.id===online.id?' <small>VOCÊ</small>':''}</b><span class="ready-state ${m.ready?'is-ready':''}">${m.ready?'✓ PRONTO':'AGUARDANDO'}</span></div>`:`<div class="lobby-member empty"><span class="lobby-number">${String(i+1).padStart(2,'0')}</span><span>${room.fillBots ? 'Vaga aberta · CPU na largada' : 'Vaga aberta'}</span></div>`;
    }).join('');
    $('online-lobby-hint').textContent=present.length<2?'Precisamos de pelo menos 2 pessoas para largar. Convide um amigo.':room.locked?'Prepare-se! A entrada de novos pilotos está fechada.':'Todos prontos? A contagem cai para 5 segundos. Caso contrário, a corrida começa ao zerar o tempo.';
    const ready=$<HTMLButtonElement>('online-ready');ready.textContent=me?.ready?'✓ PRONTO · AGUARDANDO OS OUTROS':'ESTOU PRONTO ↗';ready.disabled=room.locked || online.status!=='connected';ready.setAttribute('aria-pressed',String(!!me?.ready));
    drawLobbyClock();return;
  }
  if(!room.race)return;
  race=online.view()!;
  if(!onlineRaceStarted) {
    onlineRaceStarted=true;closeDialogs();keys.clear();screen='race';paused=false;settled=false;messageUntil=0;
    $('menu').hidden=true;$('hud').hidden=false;$('online-hud').hidden=false;
    setText('race-track',getTrack(room.trackId).name.toUpperCase());setText('race-region',getTrack(room.trackId).region);
    setText('distance-total',`${(getTrack(room.trackId).distance/1000).toFixed(1)} KM ⚑`);setText('race-message','');
    void audio.start();
  }
  if(room.race.tick>lastOnlineEventTick) {
    for(const event of room.race.events)if((event.tick ?? room.race.tick)>lastOnlineEventTick && (event.actor===online.id || event.target===online.id || event.type==='police')) {
      audio.event(event);if(event.text){setText('race-message',event.text);messageUntil=race.time+1.6;}
      if(event.type==='hit' || event.type==='crash')renderer.hit();
    }
    lastOnlineEventTick=room.race.tick;
  }
  if(room.race.multiplayer?.results[online.id])showOnlineResult(room);
}
function showOnlineResult(room: RoomView) {
  const result=room.race!.multiplayer!.results[online.id];if(!result)return;
  if(!settled) {
    settled=true;screen='result';paused=false;keys.clear();closeDialogs();
    const title=result.reason==='finish'?`${result.place}º NA <span>CHEGADA.</span>`:result.reason==='caught'?'FIM DA <span>LINHA.</span>':'FIM DE <span>CORRIDA.</span>';
    $('result-modal').innerHTML=`<div class="result-top"><div class="eyebrow">MULTIPLAYER / SALA ${room.code}</div><h2 id="result-title" class="result-title">${title}</h2><p class="result-sub">${result.reason==='caught'?'Você foi preso e perdeu a corrida.':result.reason==='wrecked'?'Sua moto ficou sem integridade.':result.reason==='left'?'Você saiu da corrida.':result.reason==='timeout'?'O tempo máximo da corrida terminou.':'Você cruzou a linha de chegada.'}</p><p id="online-result-status" class="online-note"></p></div><div id="online-result-table" class="result-table"></div><div class="result-actions"><button id="online-menu-btn" class="primary">VOLTAR AO MENU ↗</button></div>`;
    $<HTMLDialogElement>('result-modal').showModal();audio.update(0,false,false,0);
  }
  $('online-result-status').textContent=room.phase==='finished'?'CORRIDA ENCERRADA':`${Object.keys(room.race!.multiplayer!.results).length} / ${ranking(room.race!).length} PILOTOS CONCLUÍRAM`;
  $('online-result-table').innerHTML=ranking(room.race!).map((r,i)=>{
    const result=room.race!.multiplayer!.results[r.id];
    const label=result?({finish:clockString(result.time),caught:'PRESO',wrecked:'MOTO QUEBRADA',left:'SAIU',timeout:r.profile==='player'?'TEMPO ESGOTADO':'NÃO CONCLUIU'}[result.reason]):'NA PISTA';
    return `<div class="result-rider ${r.id===online.id?'me':''}"><span>${result && result.reason!=='finish'?'—':i+1}. ${escapeHTML(r.name)}</span><span>${label}</span></div>`;
  }).join('');
}

function toast(message: string) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3000); }
function saveNow() { if (!persist(save)) toast('O navegador não permitiu salvar. O progresso vale para esta sessão.'); }
function syncSound() {
  audio.setMuted(save.muted);
  document.querySelectorAll<HTMLButtonElement>('[data-action="mute"]').forEach(b => { b.innerHTML = save.muted ? icons.mute : icons.sound; b.setAttribute('aria-label', save.muted ? 'Ativar áudio (M)' : 'Silenciar áudio (M)'); b.setAttribute('aria-pressed', String(save.muted)); });
}
function toggleMute() { save.muted = !save.muted; syncSound(); saveNow(); void audio.start(); }
function renderMenu() {
  $('wallet').textContent = money(save.cash);
  $('current-bike').textContent = BIKES.find(b => b.id === save.bikeId)!.name;
  $('route-count').textContent = `${String(getTrack(selectedTrack).index + 1).padStart(2, '0')} — 03`;
  $('routes').innerHTML = TRACKS.map(t => {
    const locked = t.index > save.unlocked;
    return `<button class="route ${t.id === selectedTrack ? 'selected' : ''}" data-track="${t.id}" ${locked ? 'disabled' : ''} aria-pressed="${t.id === selectedTrack}" aria-label="${t.name}${locked ? ', termine a pista anterior entre os 5 primeiros para liberar' : ''}"><div class="route-top"><span>0${t.index + 1} / ${locked ? 'BLOQUEADA' : t.difficulty}</span>${locked ? icons.lock : '<span>↗</span>'}</div><strong>${t.name}</strong><small>${locked ? 'TOP 5 NA PISTA ANTERIOR' : `${(t.distance / 1000).toFixed(1)} KM &nbsp; · &nbsp; PRÊMIO ${money(t.prize)}`}</small></button>`;
  }).join('');
}
function makeAttract() {
  race = createRace(selectedTrack, save);
  race.mode = 'racing'; localRider().z = 480; localRider().x = 2.2;
  race.riders.slice(1).forEach((r, i) => { r.z = 500 + i * 31; r.x = [-2, 2.3, -.8, 4.1, -3.8, 1.2, 3][i]; });
  race.traffic = race.traffic.filter(t => t.z > 700);
  menuTime = 0;
}
function showMenu() {
  if(onlineMode){online.leave();return;}
  $('online-hud').hidden=true;
  closeDialogs(); screen = 'menu'; paused = false; keys.clear();
  $('menu').hidden = false; $('hud').hidden = true;
  renderMenu(); makeAttract(); audio.update(0, false, false, 0);
}
function closeDialogs() { document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close()); }
function startRace() {
  if(onlineMode)online.leave();
  $('online-hud').hidden=true;
  closeDialogs(); keys.clear();
  if ((save.condition[save.bikeId] ?? 100) < 20) { save.bikeId = 'ferro'; save.condition.ferro = Math.max(55, save.condition.ferro); saveNow(); toast('Ferro 500 pronta: reparo básico gratuito para continuar.'); }
  race = createRace(selectedTrack, save);
  screen = 'race'; paused = false; settled = false; messageUntil = 0; lastCount = 4;
  $('menu').hidden = true; $('hud').hidden = false;
  setText('race-track', getTrack(selectedTrack).name.toUpperCase()); setText('race-region', getTrack(selectedTrack).region);
  setText('distance-total', `${(getTrack(selectedTrack).distance / 1000).toFixed(1)} KM ⚑`);
  setText('race-message', '');
  void audio.start(); updateHUD();
}
function requestStart() {
  void audio.start();
  if (save.races === 0 && !sessionStorage.getItem('asfalto-instructions')) { helpStartsRace = true; $<HTMLDialogElement>('help-modal').showModal(); }
  else startRace();
}
function pauseGame() {
  if (screen !== 'race' || race.mode === 'finished') return;
  setText('pause-title',onlineMode?'MENU DA CORRIDA':'CORRIDA PAUSADA');
  $('pause-modal').querySelector('p')!.textContent=onlineMode?'A corrida online continua enquanto este menu está aberto.':'A estrada espera por você.';
  $('restart-btn').hidden=onlineMode;
  keys.clear(); paused = true; audio.update(0, false, false, 0); $<HTMLDialogElement>('pause-modal').showModal();
}
function resumeGame() { $<HTMLDialogElement>('pause-modal').close(); paused = false; keys.clear(); last = performance.now(); accumulator = 0; }
function input(): Command {
  return { throttle: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0, brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0, steer: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), attack: keys.has('KeyL') ? 'weapon' : keys.has('KeyK') ? 'kick' : keys.has('KeyJ') ? 'punch' : null };
}
function updateHUD() {
  const p = localRider(), standings=onlineMode?(online.room?.race ?? race):race;
  const order = ranking(standings), place = order.findIndex(r => r.id === localId()) + 1;
  const standingZ=standings.riders.find(r=>r.id===localId())?.z ?? p.z;
  setText('rider-total',String(order.length));
  $('online-hud').textContent=onlineMode?`SALA ${online.code} · ${online.status==='connected'?`${Math.round(online.rtt)} MS`:'RECONECTANDO…'}`:'';
  setText('position', String(place)); setText('race-time', clockString(race.time));
  setText('speed', Math.round(p.speed * 3.6).toString().padStart(3, '0')); setText('gear', p.speed < 1 ? 'N' : String(Math.min(6, Math.floor(p.speed / 11) + 1)));
  setText('health-value', `${Math.ceil(p.health)}%`); setText('integrity-value', `${Math.max(0, Math.ceil(p.integrity))}%`);
  $('health-bar').style.width = `${p.health}%`; $('health-bar').style.background = p.health < 30 ? '#ffa281' : 'var(--acid)'; $('integrity-bar').style.width = `${Math.max(0, p.integrity)}%`;
  setText('weapon-label', p.weapon ? 'BASTÃO' : 'SEM ARMA');
  const pct = clamp(p.z / getTrack(race.trackId).distance * 100, 0, 100);
  $('progress-bar').style.width = `${pct}%`; $('progress-dot').style.left = `${pct}%`; setText('distance', `${(p.z / 1000).toFixed(1)} KM`);
  const corner = upcomingCorner(p.z, race.trackId, p.handling);
  $('corner-warning').hidden = !corner || !!p.out || race.mode !== 'racing';
  if (corner) {
    const fast = p.speed > cornerPace(p.z, race.trackId, p.handling) + 2;
    const sliding = cornerForces(p.speed,p.handling,curveAt(p.z,race.trackId)).sliding;
    $('corner-warning').classList.toggle('braking',fast);
    setText('corner-arrow',corner.direction === 'right' ? '↱' : '↰');
    setText('corner-title',sliding ? 'SEM ADERÊNCIA · FREIE' : fast ? 'FREIE ANTES DA CURVA' : corner.tight ? 'CURVA FECHADA' : 'CURVA À FRENTE');
    setText('corner-detail',`${corner.distance > 0 ? `${corner.distance} M · ` : ''}${corner.speed} KM/H · ${corner.direction === 'right' ? 'DIREITA' : 'ESQUERDA'}`);
  }
  const bars = Math.round(p.speed / p.maxSpeed * 18);
  $('revs').querySelectorAll('i').forEach((n, i) => n.classList.toggle('on', i < bars));
  $('heat-dots').querySelectorAll('i').forEach((n, i) => n.classList.toggle('on', i < Math.ceil(race.heat / 12.5)));
  const capture=onlineMode?(p.capture ?? 0):race.capture;
  const officer = race.riders.find(r => r.profile === 'police');
  setText('heat-label', capture > .1 ? `CAPTURA ${capture.toFixed(1)} / 3s · ACELERE` : race.policeActive ? Math.abs((officer?.z ?? 9999) - p.z) <= 30 ? 'POLÍCIA PERTO · NÃO CAIA' : `POLÍCIA · ${Math.round(Math.abs((officer?.z ?? 0) - p.z))} M` : 'PROCURADO');
  const inCountdown = race.mode === 'countdown';
  $('countdown').hidden = !inCountdown;
  if (inCountdown) setText('count-number', race.countdown > .5 ? String(Math.ceil(race.countdown - .5)) : 'VAI!');
  $('crash').hidden = p.crash === 0 || !!p.out || race.mode === 'finished';
  if (p.crash) setText('crash-time', `DE VOLTA EM ${p.crash.toFixed(1)}s · SEGURE O ACELERADOR`);
  if (race.time > messageUntil) setText('race-message', Math.abs(p.x) > 7 && p.speed > 6 ? 'ACOSTAMENTO · MENOS ADERÊNCIA' : race.time < 5 && race.mode === 'racing' ? 'ACELERA. A ESTRADA É SUA.' : '');
  if (race.tick % 6 === 0 || inCountdown) {
    const start = clamp(place - 2, 0, 4);
    $('rival-list').innerHTML = order.slice(start, start + 4).map((r, i) => `<div class="rival-entry ${r.id === localId() ? 'me' : ''}"><span>${start + i + 1}</span><span>${escapeHTML(r.name)}</span><span class="gap">${r.out==='caught'?'PRESO':r.out?'FORA':r.id === localId() ? '◂' : `${r.z >= standingZ ? '+' : '−'}${Math.round(Math.abs(r.z - standingZ))}m`}</span></div>`).join('');
  }
}
function renderGarage() {
  $('garage-modal').innerHTML = `<div class="dialog-header"><div><div class="eyebrow">SUA OFICINA. SUAS REGRAS.</div><h2 id="garage-title">Garagem</h2></div><button class="close-btn" data-close="garage-modal" aria-label="Fechar garagem">×</button></div><div class="dialog-body"><div class="garage-grid">${BIKES.map(b => {
    const owned = save.owned.includes(b.id), equipped = save.bikeId === b.id;
    return `<article class="bike-card ${equipped ? 'equipped' : ''}"><div class="bike-class">${b.class} / 0${BIKES.indexOf(b) + 1}</div><h3>${b.name}</h3><img class="bike-image" src="${bikeSprite(b.color).toDataURL()}" alt="${b.name}, moto ${b.class.toLowerCase()} vista por trás"/><p>${b.tagline}</p><div class="bike-stats"><div class="bike-stat">VELOCIDADE <strong>${Math.round(b.speed * 3.6)} KM/H</strong></div><div class="bike-stat">DIREÇÃO <strong>${b.handling >= 1.1 ? 'ÁGIL' : 'PESADA'}</strong></div><div class="bike-stat">RESISTÊNCIA <strong>${Math.round(b.armor * 100)}%</strong></div></div><button class="secondary" data-bike="${b.id}" ${equipped || (!owned && save.cash < b.price) ? 'disabled' : ''}>${equipped ? '✓ EQUIPADA' : owned ? 'EQUIPAR ↗' : `COMPRAR · ${money(b.price)}`}</button></article>`;
  }).join('')}</div><div class="garage-tools"><div><h3>MELHORIAS · ${BIKES.find(b => b.id === save.bikeId)!.name.toUpperCase()}</h3>${(['engine', 'armor', 'handling'] as const).map(k => {
    const level = save.upgrades[save.bikeId][k], label = { engine: 'Motor', armor: 'Resistência', handling: 'Dirigibilidade' }[k];
    return `<div class="upgrade"><span>${label}<span class="levels">${'▰'.repeat(level)}${'▱'.repeat(3 - level)}</span></span><button class="secondary" data-upgrade="${k}" ${level >= 3 || save.cash < upgradeCost(save, k) ? 'disabled' : ''}>${level >= 3 ? 'MÁXIMO' : `+ ${money(upgradeCost(save, k))}`}</button></div>`;
  }).join('')}</div><div class="repair-panel"><h3>MOTO EM ${Math.round(save.condition[save.bikeId])}%</h3><p>A Ferro 500 recebe reparos gratuitos até 55% após cada corrida. Você sempre pode voltar à estrada.</p><button class="secondary" id="repair-btn" ${repairCost(save) === 0 || save.cash < repairCost(save) ? 'disabled' : ''}>${repairCost(save) === 0 ? '✓ NENHUM REPARO NECESSÁRIO' : `REPARAR 100% · ${money(repairCost(save))}`}</button></div></div><div class="garage-footer"><span>SALDO <b>${money(save.cash)}</b></span><button class="text-button danger" id="reset-btn">Reiniciar progresso</button></div></div>`;
}
function showGarage() { renderGarage(); $<HTMLDialogElement>('garage-modal').showModal(); }
function showResult() {
  if (!race.result || settled) return;
  settled = true; settleRace(save, race); saveNow(); screen = 'result'; keys.clear();
  const r = race.result;
  const title = r.reason === 'caught' ? 'FIM DA <span>LINHA.</span>' : r.reason === 'wrecked' ? 'MOTOR <span>APAGADO.</span>' : r.place === 1 ? 'A RUA É <span>SUA.</span>' : `${r.place}º NA <span>CHEGADA.</span>`;
  const subtitle = r.reason === 'finish' ? r.place <= 5 && getTrack(race.trackId).index < 2 ? 'Top 5 conquistado. A próxima estrada está liberada.' : 'Dinheiro no bolso. Mais uma história no asfalto.' : r.reason === 'caught' ? r.arrestCause === 'fall' ? 'Você caiu perto da polícia. Prisão imediata: corrida perdida.' : 'O policial ficou perto por 3 segundos enquanto você estava devagar.' : 'A integridade da moto chegou a zero. A Ferro 500 te leva de volta à pista.';
  $('result-modal').innerHTML = `<div class="result-top"><div class="eyebrow">${getTrack(race.trackId).name.toUpperCase()} / ${r.reason === 'finish' ? 'CORRIDA CONCLUÍDA' : r.reason === 'caught' ? 'CAPTURADO' : 'MOTO DESTRUÍDA'}</div><h2 class="result-title" id="result-title">${title}</h2><div class="result-sub">${subtitle}</div></div><div class="result-stats"><div><small>SEU TEMPO</small><b>${clockString(r.time)}</b></div><div><small>GOLPES / QUEDAS</small><b>${r.hits} / ${r.falls}</b></div><div><small>${r.reason === 'finish' ? 'RECOMPENSA' : 'AJUDA DA OFICINA'}</small><b class="prize">+ ${money(r.reward)}</b></div></div><div class="result-table">${ranking(race).map((rider, i) => `<div class="result-rider ${rider.id === localId() ? 'me' : ''}"><span>${rider.id === localId() && r.reason !== 'finish' ? '—' : i + 1}. ${rider.name}</span><span>${rider.id === localId() && r.reason !== 'finish' ? r.reason === 'caught' ? 'PRESO' : 'FORA DA CORRIDA' : rider.finishedAt !== null ? clockString(rider.finishedAt) : rider.out==='caught'?'PRESO':rider.out?'FORA DA CORRIDA':'NA PISTA'}</span></div>`).join('')}</div><div class="result-actions"><button class="primary" id="again-btn">CORRER DE NOVO ${icons.arrow}</button><button class="secondary" id="result-menu-btn">ESTRADAS & GARAGEM</button></div>`;
  $<HTMLDialogElement>('result-modal').showModal(); audio.update(0, false, false, 0);
}
function update() {
  if (screen === 'menu') {
    if (document.querySelector('dialog[open]')) return;
    menuTime += STEP; race.time = menuTime; race.tick++;
    localRider().z += STEP * 17;
    localRider().lean = Math.sin(menuTime * .65) * .06;
    race.riders.slice(1).forEach((r, i) => { r.z = localRider().z + 27 + i * 31 + Math.sin(menuTime * .3 + i) * 7; r.lean = Math.sin(menuTime + i) * .03; });
    return;
  }
  if (screen !== 'race' || paused) return;
  stepRace(race, { player: input() });
  const count = Math.ceil(race.countdown - .5);
  if (race.mode === 'countdown' && count !== lastCount) { lastCount = count; audio.tone(count <= 0 ? 880 : 440, .15, .16, 'sine'); }
  for (const event of race.events) {
    const localEvent = event.actor === 'player' || event.type === 'police' || event.text?.startsWith('VOCÊ') || event.actor.startsWith('obstacle');
    if (localEvent) audio.event(event);
    if (localEvent && event.text) { setText('race-message', event.text); messageUntil = race.time + 1.6; $('race-message').classList.toggle('alert', event.type === 'police' || event.type === 'crash'); }
    if (localEvent && (event.type === 'hit' || event.type === 'crash')) renderer.hit();
  }
  audio.update(localRider().speed, true, race.policeActive && Math.abs((race.riders.find(r => r.id === 'police')?.z ?? 99999) - localRider().z) < 100, race.time);
  if (race.mode === 'finished') showResult();
}
function draw() { renderer.render(race, screen === 'menu',localId()); if (screen !== 'menu') { updateHUD(); instruments.draw(race,localId()); } }
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, .1); last = now;
  if(onlineMode) {
    accumulator+=dt;while(accumulator>=STEP){online.step(paused || screen!=='race'?{...EMPTY_COMMAND,brake:1}:input());accumulator-=STEP;}
    const view=online.view();if(view)race=view;drawLobbyClock();
    if(screen==='race'){const p=localRider();audio.update(p.speed,!paused,race.policeActive && Math.abs((race.riders.find(r=>r.profile==='police')?.z ?? 99999)-p.z)<100,race.time);}
  } else if (!testMode) { accumulator += dt; while (accumulator >= STEP) { update(); accumulator -= STEP; } }
  draw(); requestAnimationFrame(frame);
}
async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Tela cheia indisponível neste navegador.'); } }

document.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || button.disabled) return;
  if (button.dataset.close) { $<HTMLDialogElement>(button.dataset.close).close(); return; }
  if (button.dataset.action === 'mute') toggleMute();
  if (button.dataset.action === 'fullscreen') void fullscreen();
  if (button.dataset.action === 'help') { helpStartsRace = false; $<HTMLDialogElement>('help-modal').showModal(); }
  if (button.dataset.track && getTrack(button.dataset.track).index <= save.unlocked) { selectedTrack = button.dataset.track; renderMenu(); makeAttract(); }
  if (button.dataset.bike && buyBike(save, button.dataset.bike)) { saveNow(); renderMenu(); renderGarage(); makeAttract(); }
  if (button.dataset.upgrade && ['engine', 'armor', 'handling'].includes(button.dataset.upgrade) && buyUpgrade(save, button.dataset.upgrade as keyof Upgrade)) { saveNow(); renderMenu(); renderGarage(); toast('Melhoria instalada. Hora de sentir a diferença.'); }
  switch (button.id) {
    case 'online-btn': openOnline(); break;
    case 'online-create': enterOnline(true); break;
    case 'online-join': enterOnline(false); break;
    case 'online-ready': online.ready(!online.room?.members.find(m=>m.id===online.id)?.ready); break;
    case 'online-leave': case 'online-close': case 'online-menu-btn': if(onlineMode)online.leave();else closeDialogs(); break;
    case 'online-copy': { const url=new URL(location.href);url.search='';url.searchParams.set('sala',online.code);void navigator.clipboard.writeText(url.toString()).then(()=>{$('online-status').textContent='CONVITE COPIADO';}).catch(()=>{$('online-status').textContent=`COMPARTILHE O CÓDIGO ${online.code}`;});break;}
    case 'start-btn': requestStart(); break;
    case 'help-go': sessionStorage.setItem('asfalto-instructions', '1'); $<HTMLDialogElement>('help-modal').close(); if (helpStartsRace || screen === 'menu') startRace(); break;
    case 'garage-btn': case 'change-bike': showGarage(); break;
    case 'pause-btn': pauseGame(); break;
    case 'resume-btn': resumeGame(); break;
    case 'restart-btn': case 'again-btn': startRace(); break;
    case 'menu-btn': case 'result-menu-btn': showMenu(); break;
    case 'repair-btn': if (repair(save)) { saveNow(); renderGarage(); renderMenu(); toast('Moto reparada. Pronta para a próxima.'); } break;
    case 'reset-btn': $<HTMLDialogElement>('reset-modal').showModal(); break;
    case 'confirm-reset': save = freshSave(); saveNow(); selectedTrack = 'costa'; syncSound(); showMenu(); toast('Garagem e progresso reiniciados.'); break;
  }
});
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => dialog.addEventListener('cancel', e => { if(dialog.id==='online-modal'){e.preventDefault();if(onlineMode)online.leave();else dialog.close();} if (dialog.id === 'pause-modal') { e.preventDefault(); resumeGame(); } if (dialog.id === 'result-modal') { e.preventDefault(); showMenu(); } }));
window.addEventListener('keydown', e => {
  if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement){if(e.code==='Enter' && e.target.id==='online-code-input'){e.preventDefault();enterOnline(false);}return;}
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !document.querySelector('dialog[open]')) e.preventDefault();
  if (e.code === 'Escape') { if (screen === 'race' && !paused && !document.querySelector('dialog[open]')) { e.preventDefault(); pauseGame(); } return; }
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); return; }
  if (e.code === 'KeyF' && !e.repeat && !document.querySelector('dialog[open]')) { void fullscreen(); return; }
  if (document.querySelector('dialog[open]')) return;
  if (e.code === 'Enter' && screen === 'menu' && !e.repeat && (!(e.target instanceof HTMLButtonElement) || e.target.id === 'start-btn')) { e.preventDefault(); requestStart(); return; }
  if (screen === 'race' && !paused) {
    keys.add(e.code);
    if(onlineMode && !e.repeat){const kind=({KeyJ:'punch',KeyK:'kick',KeyL:'weapon'} as const)[e.code as 'KeyJ'];if(kind)online.attack(kind);}
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (!testMode) pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !testMode) pauseGame(); });
document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach(button => {
  button.addEventListener('pointerdown', e => {
    e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.touch!);void audio.start();
    if(onlineMode && screen==='race' && !paused){const kind=({KeyJ:'punch',KeyK:'kick',KeyL:'weapon'} as const)[button.dataset.touch as 'KeyJ'];if(kind)online.attack(kind);}
  });
  const release = () => keys.delete(button.dataset.touch!);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});

// Deterministic hooks used by the automated game client. Debug mutation is limited to ?test.
declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    __game?: { snapshot: () => string; restore: (raw: string) => void; start: () => void; save: () => string; command: (cmd: Command, frames: number) => void; };
  }
}
window.render_game_to_text = () => {
  const p = localRider(), target = nearestTarget(race, p, p.weapon ? 'weapon' : 'punch');
  return JSON.stringify({ online: onlineMode?{status:online.status,id:online.id,code:online.code,phase:online.room?.phase,locked:online.room?.locked,deadline:online.room?.deadline,serverNow:online.serverNow(),members:online.room?.members,fillBots:online.room?.fillBots}:null, screen, paused, modal: document.querySelector('dialog[open]')?.id ?? null, mode: race.mode, coordinates: 'x in metres: negative left, positive right; road ±7. z forward in metres. speed m/s.', tick: race.tick, time: +race.time.toFixed(2), countdown: +race.countdown.toFixed(2), track: race.trackId, length: getTrack(race.trackId).distance, player: { out:p.out ?? null, x: +p.x.toFixed(2), z: +p.z.toFixed(1), speed: +p.speed.toFixed(2), health: +p.health.toFixed(1), integrity: +p.integrity.toFixed(1), weapon: p.weapon, attack: p.attack, cooldown: +p.cooldown.toFixed(2), crash: +p.crash.toFixed(2), immune: +p.immune.toFixed(2), hits: p.hits, falls: p.falls, place: ranking(onlineMode ? (online.room?.race ?? race) : race).findIndex(r => r.id === localId()) + 1 }, awareness:raceAwareness(race,localId()), corner:upcomingCorner(p.z,race.trackId,p.handling), curve: +curveAt(p.z, race.trackId).toFixed(2), target: target?.id ?? null, riders: race.riders.filter(r => r.id !== localId() && Math.abs(r.z - p.z) < 400).map(r => ({ id: r.id, name: r.name, x: +r.x.toFixed(1), dz: +(r.z - p.z).toFixed(1), speed: +r.speed.toFixed(1), health: +r.health.toFixed(1), weapon: r.weapon, attack: r.attack, crash: +r.crash.toFixed(1) })), traffic: race.traffic.filter(t => t.z - p.z > -10 && t.z - p.z < 350).map(t => ({ x: t.x, dz: +(t.z - p.z).toFixed(1), direction: t.speed < 0 ? 'oncoming' : 'forward' })), obstacles: race.obstacles.filter(o => o.z - p.z > -10 && o.z - p.z < 200).map(o => ({ kind: o.kind, x: o.x, dz: +(o.z - p.z).toFixed(1) })), heat: +race.heat.toFixed(1), police: race.policeActive, capture: +race.capture.toFixed(2), result: onlineMode?(race.multiplayer?.results[online.id] ?? null):race.result, save: { cash: save.cash, bike: save.bikeId, unlocked: save.unlocked, races: save.races } });
};
window.advanceTime = ms => { if(onlineMode){draw();return;} testMode = true; for (let i = 0; i < Math.round(ms / (STEP * 1000)); i++) update(); draw(); };
if (testMode) window.__game = {
  snapshot: () => snapshot(race),
  restore: raw => { if(onlineMode)throw new Error('Use o servidor para testar uma corrida online.'); race = restoreSnapshot(raw); settled = false; screen = race.mode === 'finished' ? 'result' : 'race'; paused = false; closeDialogs(); $('menu').hidden = true; $('hud').hidden = false; draw(); },
  start: startRace,
  save: () => JSON.stringify(save),
  command: (cmd, frames) => { for (let i = 0; i < frames; i++) stepRace(race, { player: cmd }); if (race.mode === 'finished') showResult(); draw(); },
};
syncSound(); renderMenu(); makeAttract(); draw(); requestAnimationFrame(frame);
if (testMode && new URLSearchParams(location.search).has('race')) startRace();

const invite=new URLSearchParams(location.search).get('sala');
if(online.resumeSaved()){onlineMode=true;openOnline();}
else if(invite){openOnline();$<HTMLInputElement>('online-code-input').value=invite.toUpperCase();}
