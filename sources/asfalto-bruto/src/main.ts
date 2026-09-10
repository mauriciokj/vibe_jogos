import './recovery.css';
import { newChampionship, championshipRoute, championshipGarageOpen, championshipBikeState, championshipStandings, startChampionshipRace, nextChampionshipStage, checkpointChampionship, finishChampionshipSimulation, recordChampionshipHeat } from './game/championship';
import { championshipMarkup } from './championship-ui';
import { pendingResults, queueResult, removeResult } from './account/pending-results';
import { AccountClient, SoloRecorder, ApiError } from './account/client';
import { accountUI } from './account/ui';
import { roadHalf, surfaceGrip } from './game/road-profile';
import { equippedHelmet, getHelmet, getHelmetColor } from './game/helmets';
import { upcomingWorks } from './game/port';
import './style.css';
import { equippedWeapon, weaponName } from './game/weapons';
import { jumpHeight, wheeliesLeft, stunting } from './game/stunts';
import './multiplayer/style.css';
import './menu.css';
import { showVisitorCount } from './visitors';
import './equipment.css';
import './touch.css';
import './hud.css';
import './finish.css';
import './championship.css';
import { FINISH_SECONDS, finishPullback, finishWinner, finishScene, finishPoliceArrival, type FinishPoliceArrival } from './game/finish';
import type { RacePayout } from './game/rewards';
import { supportsKneeDown } from './game/bikes';
import { cornerHandling, equippedKneePad, getKneePad, kneeSupport, nitroCount } from './game/equipment';
import { TAUNTS } from './game/banter';
import { DoubleTap } from './game/controls';
import { equipmentShop, garageNav, type GarageTab } from './equipment-ui';
import { OnlineClient } from './multiplayer/client';
import { PublicRoomBrowser } from './multiplayer/discovery';
import type { RoomView } from './multiplayer/protocol';
import { EMPTY_COMMAND } from './game/types';
import { BIKES, clamp, clockString, cornerForces, cornerPace, curveAt, upcomingCorner, getBike, handlingLabel, zeroToHundred, getTrack, money, TRACKS } from './game/content';
import { RACE_ROUTES, raceRoute, routeFromId, nextRaceRoute } from './game/routes';
import { conditionName, raceCondition, recordKey, scenicAppearance } from './game/conditions';
import { raceAwareness } from './game/awareness';
import { GameAudio, jumpSoundMaterial, jumpSoundKey, guardRailSoundSide } from './game/audio';
import { RaceInstruments } from './game/instruments';
import { Renderer } from './game/renderer';
import { createRace, finishRider, nearestTarget, ranking, restoreSnapshot, snapshot, STEP, stepRace } from './game/simulation';
import { bikePortrait } from './game/sprites';
import { buyHelmet, paintHelmet, buyBike, buyWeapon, buyKneePad, buyNitro, spendNitro, recordOnlineNitro, buyUpgrade, freshSave, repair, repairChampionshipBike, repairCost, settleRace, upgradeCost } from './game/save';
import type { Command, RaceState, RiderAction, Upgrade } from './game/types';

const icons = {
  trophy: '<svg class="champ-trophy" viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M24 19H13v8c0 10 7 16 17 16m26-24h11v8c0 10-7 16-17 16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M23 14h34l-3 20c-1 10-7 16-14 16s-13-6-14-16l-3-20Z" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M40 50v12m-11 4h22l4 6H25l4-6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m40 23 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" fill="currentColor"/></svg>',
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
        <div class="menu-meta"><div class="menu-profile"><div class="bike-line"><span>NA SUA GARAGEM</span><b id="current-bike"></b><button id="change-bike">TROCAR ↗</button></div>
        <div id="visitor-count" class="visitor-count" hidden role="status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></svg><div><strong data-visitor-message></strong><small data-visitor-since></small></div></div>
        </div><button id="championship-btn" aria-label="Campeonato, 5 etapas e 20 corridas"><span id="champ-card-state" class="champ-card-state" hidden></span><span class="champ-card-arrow" aria-hidden="true">↗</span>${icons.trophy}<strong>CAMPEONATO</strong><span class="champ-card-detail">5 ETAPAS · 20 CORRIDAS</span></button></div>
      </div>
      <div class="route-select"><div class="route-heading"><div><span>ESCOLHA A PISTA</span><span id="route-count"></span></div><div class="route-navigation"><button id="routes-prev" aria-label="Ver pistas anteriores" aria-controls="routes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg></button><button id="routes-next" aria-label="Ver próximas pistas" aria-controls="routes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></button></div></div><div class="routes" id="routes" role="group" aria-label="Pistas disponíveis"></div><p class="route-detail" id="route-detail"></p></div>
      <footer class="bottomline"><span>ESTRADAS ABERTAS. PUNHOS FECHADOS.</span><span><i class="live-dot"></i> PRONTO PARA A LARGADA</span></footer>
    </section>
    <section id="finish-scene" hidden aria-label="Comemoração na chegada"><div class="finish-heading"><span id="finish-place"></span><strong id="finish-winner"></strong></div><button id="finish-skip" class="secondary">VER RESULTADO ↗</button></section>
    <section id="hud" hidden aria-label="Informações da corrida">
      <div class="hud-top"><div><div class="position"><strong id="position">8</strong><span>/ <b id="rider-total">8</b></span></div><div class="position-label">POSIÇÃO</div></div>
        <div class="hud-actions"><button class="icon-btn" data-action="mute" aria-label="Silenciar áudio">${icons.sound}</button><button class="icon-btn" data-action="fullscreen" aria-label="Tela cheia (F)">${icons.full}</button><button class="icon-btn" id="pause-btn" aria-label="Pausar (Esc)">${icons.pause}</button></div>
      </div>
      <div class="race-guidance">
        <span class="hud-time" id="race-time">00:00.0</span>
        <canvas id="rear-view" class="rear-view" aria-label="Retrovisor: pilotos e trânsito até 200 metros atrás"></canvas>
        <div id="corner-warning" class="corner-warning" hidden><b id="corner-arrow">↱</b><div><strong id="corner-title"></strong><span id="corner-detail"></span></div></div>
      </div>
      <div class="race-sidebar">
        <div class="heat-status"><span class="heat-dots" id="heat-dots">${'<i></i>'.repeat(8)}</span><span id="heat-label">PROCURADO</span></div>
        <canvas id="race-map" class="race-map" aria-label="Mapa dos 300 metros à frente e atrás; você em verde-limão, polícia em vermelho e azul"></canvas>
        <div class="hud-track"><h2 id="race-track">COSTA DO SOL</h2><div class="eyebrow" id="race-region">RODOVIA LITORÂNEA</div></div>
        <div class="online-hud" id="online-hud" hidden></div>
      </div>
      <div class="rival-list" id="rival-list"></div><div class="race-message" id="race-message" aria-live="polite"></div>
      <div class="countdown" id="countdown"><strong id="count-number">3</strong><span>PREPARE-SE · SEGURE W OU ↑</span></div>
      <div id="recovery-guide" hidden></div><div class="crash-overlay" id="crash" hidden><strong>LEVANTA E VAI.</strong><small id="crash-time">VOLTANDO À PISTA...</small></div>
      <div class="race-bottom"><div class="vitals"><div class="meter-label"><span>PILOTO</span><b id="health-value">100%</b></div><div class="meter-track"><i id="health-bar"></i></div><div class="meter-label"><span>MOTO</span><b id="integrity-value">100%</b></div><div class="meter-track bike"><i id="integrity-bar"></i></div><div class="weapon"><span class="weapon-icon">╱</span><span id="weapon-label">BASTÃO</span><kbd>L</kbd><small>J SOCO · K CHUTE</small></div><div class="equipment-hud"><span id="knee-indicator"></span><span id="nitro-indicator"></span><span id="wheelie-indicator"></span></div></div>
        <div class="speedometer"><div class="speed-label">KM/H</div><div class="speed-number"><span id="speed">000</span></div><div class="gear" id="gear">N</div><div class="rev-strip" id="revs">${'<i></i>'.repeat(18)}</div></div>
      </div>
      <div class="race-progress"><small id="distance">0.0 KM</small><div class="distance-track"><i id="progress-bar"></i><b id="progress-dot"></b></div><small id="distance-total">8.4 KM <span>⚑</span></small></div>
      <div class="touch-controls"><div class="analog-control"><span>VIRAR</span><div id="steering-stick" class="analog-stick" role="slider" tabindex="0" aria-label="Direção" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><i></i><b class="analog-knob"></b></div></div><div class="touch-combat"><div class="touch-group"><button data-touch="KeyJ" aria-label="Socar">J</button><button data-touch="KeyK" aria-label="Chutar">K</button><button data-touch="KeyL" aria-label="Bastão">L</button></div><button id="touch-nitro" aria-label="Ativar nitro">NITRO 0</button></div><div class="analog-control"><span>ACELERAR / FREAR</span><div id="drive-stick" class="analog-stick drive-stick" role="slider" tabindex="0" aria-orientation="vertical" aria-label="Acelerar e frear" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><i></i><b class="analog-knob"></b></div></div></div>
    </section>
  </div>
  <dialog id="help-modal" aria-labelledby="help-title"><div class="dialog-header"><div><div class="eyebrow">ANTES DE DAR A PARTIDA</div><h2 id="help-title">Conheça as regras da rua.</h2></div><button class="close-btn" data-close="help-modal" aria-label="Fechar">×</button></div><div class="dialog-body"><div class="help-grid">
    <div class="control">Acelerar <span class="keys"><kbd>W</kbd><kbd>↑</kbd></span></div><div class="control">Frear <span class="keys"><kbd>S</kbd><kbd>↓</kbd></span></div>
    <div class="control">Pilotar <span class="keys"><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></span></div><div class="control">Soco rápido <span class="keys"><kbd>J</kbd></span></div>
    <div class="control">Chute · empurra o rival <span class="keys"><kbd>K</kbd></span></div><div class="control">Usar equipamento <span class="keys"><kbd>L</kbd></span></div>
    <div class="control keyboard-only">Buzinar <span class="keys"><kbd>B</kbd></span></div><div class="control keyboard-only">Provocar <span class="keys"><kbd>Q</kbd></span></div><div class="control">Nitro <span class="keys"><kbd>N</kbd></span></div><div class="control">Pausar <span class="keys"><kbd>Esc</kbd></span></div><div class="control">Tela cheia / som <span class="keys"><kbd>F</kbd><kbd>M</kbd></span></div>
  </div><div class="tip"><b>Chegue perto e acerte.</b> O rival ao alcance recebe uma marca verde. Um soco pode tomar o bastão básico de um rival. Equipamentos comprados são permanentes e não podem ser tomados. Use L para golpear com o item equipado. O sinal “!” avisa que um ataque está vindo.</div><div class="tip"><b>Empine e salte.</b> Acima de 72 km/h, dê dois toques rápidos no acelerador (W / ↑). No celular, mova o analógico direito do centro para cima duas vezes. Você tem 3 ativações por corrida; cada uma dura até 2,4 segundos e gasta um uso, mesmo sem saltar. Aproxime-se alinhado de um carro na contramão para saltar automaticamente. Caminhões, vans e veículos no mesmo sentido exigem desvio. Frear cancela a empinada.</div><div class="tip"><b>Joelho no chão.</b> Com joelheira equipada, dê dois toques rápidos para o mesmo lado acima de 72 km/h. A manobra dura até 4 segundos; inverter a direção ou ir para o acostamento cancela. Choppers não fazem a manobra. Na chuva, mais de 2 segundos seguidos de joelho apoiado provocam queda. Ao tirar o joelho, a contagem zera.</div><div class="tip"><b>Analógicos no celular.</b> O esquerdo vira; o direito acelera para cima e freia para baixo. Para apoiar o joelho, mova o analógico de direção duas vezes rapidamente para o mesmo lado, voltando ao centro entre os movimentos.</div><div class="tip"><b>Freie antes da curva.</b> O aviso mostra a direção, a distância e uma velocidade de referência. Entrar rápido demais faz a moto escorregar para fora. Solte W / ↑ ou freie com S / ↓, contorne e acelere na saída. Na chuva, a aderência e a frenagem diminuem: antecipe a redução. O mapa mostra as distâncias; o retrovisor revela os últimos 200 metros.</div><div class="tip"><b>Cuide de você e da moto.</b> Depois da queda, piloto e moto deslizam separados. Corra até a moto usando W / ↑ para frente, S / ↓ para trás e A / D para os lados; no celular, use os analógicos. Ao encostar, você monta. Se a moto estiver com integridade zero, ela explode ao tentar pegá-la e a corrida termina. Fuja do acostamento, desvie do óleo e observe o trânsito na contramão.</div><div class="tip"><b>A polícia não dorme.</b> Velocidade e golpes aumentam a procura. Caiu com a polícia a até 30 metros? Prisão imediata e fim da corrida. Ficar abaixo de 29 km/h ao lado do policial por 3 segundos também causa prisão. Chegue entre os 5 primeiros para abrir a próxima estrada.</div><div class="help-footer"><span>Jogue como convidado ou conecte sua conta Google para sincronizar a garagem. No celular, use os analógicos e os botões de combate.</span><button id="help-go" class="primary">ENTENDI. VAMOS CORRER ${icons.arrow}</button></div></div></dialog>
  <dialog id="pause-modal" class="pause-modal" aria-labelledby="pause-title"><div class="dialog-body"><div class="eyebrow" style="justify-content:center">UM RESPIRO NO ACOSTAMENTO</div><h2 id="pause-title">CORRIDA PAUSADA</h2><p>A estrada espera por você.</p><button class="primary" id="resume-btn">CONTINUAR ↗</button><button class="secondary" id="restart-btn">RECOMEÇAR CORRIDA</button><button class="text-button" id="menu-btn">VOLTAR AO MENU</button></div></dialog>
  <dialog id="garage-modal" aria-labelledby="garage-title"></dialog>
  <dialog id="result-modal" class="result-modal" aria-labelledby="result-title"></dialog>
  <dialog id="reset-modal" class="pause-modal" aria-labelledby="reset-title"><div class="dialog-body"><h2 id="reset-title">COMEÇAR DO ZERO?</h2><p>Isso reinicia créditos, motos, melhorias e recordes da garagem atual. Se estiver conectado, a mudança também será salva na conta. O ranking permanente permanece.</p><button class="secondary" data-close="reset-modal">MANTER MEU PROGRESSO</button><button class="text-button danger" id="confirm-reset">APAGAR PROGRESSO</button></div></dialog>
  <dialog id="online-modal" class="online-modal" aria-labelledby="online-title">
    <div class="dialog-header"><div><div class="eyebrow">CORRA COM OUTRAS PESSOAS</div><h2 id="online-title">Multiplayer</h2></div><button class="close-btn" id="online-close" aria-label="Voltar ao menu">×</button></div>
    <div class="dialog-body">
      <div id="online-form"><details id="online-discovery" class="public-discovery"><summary>Encontrar partidas públicas <span>ENTRAR SEM CÓDIGO ↗</span></summary><div class="public-discovery-body"><p data-public-status role="status" aria-live="polite"></p><div data-public-list></div><button class="text-button" id="online-refresh">ATUALIZAR LISTA ↻</button></div></details><label class="online-label" for="online-name">SEU APELIDO</label><input id="online-name" class="online-input" maxlength="18" placeholder="Como você quer ser chamado?" autocomplete="nickname" />
        <div class="online-bike-choice"><label class="online-label" for="online-bike">SUA MOTO · TODOS OS MODELOS LIBERADOS NO ONLINE</label><select id="online-bike" class="online-input">${BIKES.map(b=>`<option value="${b.id}">${b.name} · ${b.class}</option>`).join('')}</select><div id="online-bike-preview" class="online-bike-preview"></div><p id="online-loadout" class="online-loadout"></p></div><div class="online-choices"><div><h3>Criar uma sala</h3><label class="online-label" for="online-track">PISTA</label><select id="online-track" class="online-input">${TRACKS.map(t=>`<optgroup label="${t.name}">${RACE_ROUTES.filter(r=>r.track.id===t.id).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</optgroup>`).join('')}</select><label class="bot-option"><input type="checkbox" id="online-public" /><span>Sala pública<small>Aparece na busca · espera até 120s<br>Todos prontos: 5s</small></span></label><label class="bot-option"><input type="checkbox" id="online-bots" /><span>Completar com bots<small>Até 8 pilotos na largada · mínimo 2 pessoas</small></span></label><button class="primary" id="online-create">CRIAR SALA ↗</button></div>
        <div><h3>Entrar com amigos</h3><label class="online-label" for="online-code-input">CÓDIGO DA SALA</label><input id="online-code-input" class="online-input code-input" maxlength="6" placeholder="A1B2C3" autocapitalize="characters" autocomplete="off" spellcheck="false"/><button class="secondary" id="online-join">ENTRAR NA SALA ↗</button></div></div>
        <p class="online-note">De 2 a 8 pessoas. Escolha seu estilo de pilotagem. No online, todos têm acesso às motos de fábrica, sem melhorias. O equipamento de combate, a joelheira equipada e as cargas compradas na garagem acompanham você. O nitro usado é descontado do seu estoque.</p>
      </div>
      <div id="online-lobby" hidden><p id="online-visibility" class="online-visibility"></p><div class="lobby-heading"><div><span class="online-label">CONVIDE PELO CÓDIGO</span><div class="room-code" id="online-code"></div><button class="text-button" id="online-copy">COPIAR CONVITE ↗</button></div><div class="lobby-clock"><strong id="online-clock">60</strong><span id="online-clock-label">SEGUNDOS PARA LARGAR</span></div></div>
        <div class="lobby-meta"><span id="online-track-name"></span><span id="online-count">1 / 8 PILOTOS</span></div><div id="online-members" class="lobby-members"></div>
        <p id="online-lobby-hint" class="online-note"></p><button class="primary" id="online-ready">ESTOU PRONTO ↗</button><button class="text-button" id="online-leave">SAIR DA SALA</button>
      </div><p id="online-status" class="online-status" role="status" aria-live="polite"></p><p id="online-error" class="online-error" role="alert" hidden></p>
    </div>
  </dialog>
  <dialog id="championship-modal" aria-label="Campeonato"></dialog>
  <div class="toast" id="toast" role="status" hidden></div>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const renderer = new Renderer($<HTMLCanvasElement>('game'));
const instruments = new RaceInstruments($<HTMLCanvasElement>('rear-view'),$<HTMLCanvasElement>('race-map'));
const audio = new GameAudio();
const accounts = new AccountClient(next=>{
  save=structuredClone(next);selectedTrack=save.raceTrackId ?? 'costa';selectedCondition=raceCondition(save.raceCondition);
  syncSound();renderMenu();makeAttract();
},()=>screen==='menu' && !online.active && !startingRace && !document.querySelector('dialog[open]:not(#account-modal)'));
let save = accounts.initialSave();
let soloRecorder:SoloRecorder|null=null;
let startingRace=false;
let selectedTrack = save.raceTrackId ?? 'costa';
let selectedCondition = raceCondition(save.raceCondition);
let race = createRace(selectedTrack, save, 88117, selectedCondition);
let screen: 'menu' | 'race' | 'finish' | 'result' = 'menu';
let finishElapsed: number | null = null;
let finishOfficer:FinishPoliceArrival|null=null,lastFinishStrike=-1;
let resultPayout: RacePayout | null = null;
let paused = false;
let onlineMode = false;
let championshipMode=false,champSettling=false,champGarageReturn=false,champCheckpointAt=0;
let lowIntegrityWarned=false;
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
const doubleTap = new DoubleTap();
const throttleTap = new DoubleTap();
const analog = {steer:0,drive:0};
const resetPointers: (()=>void)[]=[];
let pendingActions: RiderAction[] = [], soloNitroSpent=0;
let garageTab: GarageTab = 'bikes';
const displayCache: Record<string, string> = {};
let lastStandingsTick = -Infinity, lastStandingsPlace = 0;
const setText = (id: string, value: string) => { if (displayCache[id] !== value) { $(id).textContent = value; displayCache[id] = value; } };

const online = new OnlineClient({
  room: receiveOnlineRoom,
  status: status => {
    $('online-status').textContent = {offline:'',connecting:'CONECTANDO À SALA…',connected:'CONECTADO',reconnecting:'RECONECTANDO · RESERVANDO SUA VAGA…'}[status];
    publicRooms.setBusy(status==='connecting' || status==='reconnecting' || status==='connected');
    for (const id of ['online-create','online-join']) $<HTMLButtonElement>(id).disabled = status==='connecting' || status==='reconnecting';
  },
  error: message => { $('online-error').textContent=message; $('online-error').hidden=false; if(!$<HTMLDialogElement>('online-modal').open)toast(message); },
  left: () => { onlineMode=false;onlineRaceStarted=false;showMenu(); },
});
const publicRooms=new PublicRoomBrowser($<HTMLDetailsElement>('online-discovery'),code=>enterOnline(false,code));
function localId() { return onlineMode && online.id ? online.id : 'player'; }
function localRider() { return race.riders.find(r=>r.id===localId()) ?? race.riders[0]; }
const escapeHTML = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function openOnline() {
  clearControls();$('online-error').hidden=true;$('online-form').hidden=false;$('online-lobby').hidden=true;
  $<HTMLSelectElement>('online-track').value=raceRoute(selectedTrack,selectedCondition).id;
  $<HTMLSelectElement>('online-bike').value=save.bikeId; updateOnlineBikePreview();
  try{$<HTMLInputElement>('online-name').value=localStorage.getItem('asfalto:nickname') ?? '';}catch{}
  $<HTMLDialogElement>('online-modal').showModal();
  publicRooms.setBusy(online.active);
}
function updateOnlineBikePreview() {
  const bike=getBike($<HTMLSelectElement>('online-bike').value);
  const pad=equippedKneePad(save);
  $('online-loadout').textContent=`Capacete ${equippedHelmet(save).name} ${getHelmetColor(save.helmetColorId).name.toLowerCase()} · ${equippedWeapon(save)?.name ?? 'Bastão básico'} · ${pad&&supportsKneeDown(bike.id)?'Joelheira '+pad.name:!supportsKneeDown(bike.id)?'Chopper: sem manobra de joelho':'Sem joelheira'} · Nitro ${nitroCount(bike.id,save.nitro?.[bike.id])}/${bike.nitroCapacity}`;
  $('online-bike-preview').innerHTML=`<img src="${bikePortrait(bike).toDataURL()}" alt="${bike.name} vista de lado"/><div><b>${bike.class} · ${Math.round(bike.speed*3.6)} KM/H</b><span>${handlingLabel(bike.handling)} · 0–100 EM ${zeroToHundred(bike).toFixed(1)}S</span><small>${bike.tagline}</small></div>`;
}
$<HTMLSelectElement>('online-bike').addEventListener('change',updateOnlineBikePreview);
function enterOnline(create: boolean, publicCode?: string) {
  if(online.status==='connecting' || online.status==='reconnecting' || online.status==='connected')return;
  onlineMode=true;onlineRaceStarted=false;lastOnlineEventTick=-1;$('online-error').hidden=true;
  const name=$<HTMLInputElement>('online-name').value.trim() || 'Piloto';
  try{localStorage.setItem('asfalto:nickname',name);}catch{}
  const route=routeFromId($<HTMLSelectElement>('online-track').value);
  const bikeId=$<HTMLSelectElement>('online-bike').value;
  const loadout={helmetId:equippedHelmet(save).id,helmetColorId:getHelmetColor(save.helmetColorId).id,weaponId:equippedWeapon(save)?.id,kneePadId:equippedKneePad(save)?.id,nitro:nitroCount(bikeId,save.nitro?.[bikeId])};
  if(create)online.create(name,route.track.id,$<HTMLInputElement>('online-bots').checked,bikeId,route.condition.id,loadout,$<HTMLInputElement>('online-public').checked);
  else online.join(name,publicCode ?? $<HTMLInputElement>('online-code-input').value,bikeId,loadout,!!publicCode);
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
    publicRooms.stop();$('online-visibility').textContent=room.public?'SALA PÚBLICA · OUTROS PILOTOS PODEM ENCONTRAR VOCÊ':'SALA POR CONVITE · COMPARTILHE O CÓDIGO';
    $('online-form').hidden=true;$('online-lobby').hidden=false;$('online-code').textContent=room.code;
    $('online-track-name').textContent=`${getTrack(room.trackId).name.toUpperCase()} · ${conditionName(room.condition).toUpperCase()}`;
    const present=room.members.filter(m=>m.connected),me=room.members.find(m=>m.id===online.id);
    $('online-count').textContent=`${present.length} / 8 PESSOAS${room.fillBots ? ` · +${8-present.length} CPU NA LARGADA` : ''}`;
    $('online-members').innerHTML=Array.from({length:8},(_,i)=>{
      const m=present[i];return m?`<div class="lobby-member ${m.id===online.id?'me':''}"><span class="lobby-number">${String(i+1).padStart(2,'0')}</span><b>${escapeHTML(m.name)}${m.id===online.id?' <small>VOCÊ</small>':''}<small class="lobby-bike-name">${getBike(m.bikeId).name} · ${getHelmet(m.helmetId).name} ${getHelmetColor(m.helmetColorId).name.toLowerCase()}</small></b><span class="ready-state ${m.ready?'is-ready':''}">${m.ready?'✓ PRONTO':'AGUARDANDO'}</span></div>`:`<div class="lobby-member empty"><span class="lobby-number">${String(i+1).padStart(2,'0')}</span><span>${room.fillBots ? 'Vaga aberta · CPU na largada' : 'Vaga aberta'}</span></div>`;
    }).join('');
    $('online-lobby-hint').textContent=present.length<2?(room.public?'Sua sala aparece na busca. Aguardando pelo menos mais uma pessoa para largar.':'Precisamos de pelo menos 2 pessoas para largar. Convide um amigo.'):room.locked?'Prepare-se! A entrada de novos pilotos está fechada.':'Todos prontos? A contagem cai para 5 segundos. Caso contrário, a corrida começa ao zerar o tempo.';
    const ready=$<HTMLButtonElement>('online-ready');ready.textContent=me?.ready?'✓ PRONTO · AGUARDANDO OS OUTROS':'ESTOU PRONTO ↗';ready.disabled=room.locked || online.status!=='connected';ready.setAttribute('aria-pressed',String(!!me?.ready));
    drawLobbyClock();return;
  }
  if(!room.race)return;
  const mine=room.race.riders.find(r=>r.id===online.id);if(mine && recordOnlineNitro(save,mine))saveNow();
  race=online.view()!;
  if(!onlineRaceStarted) {
    resetFinish();onlineRaceStarted=true;audio.resetRace(jumpSoundKey(localRider()),guardRailSoundSide(race.trackId,localRider()));closeDialogs();clearControls();screen='race';paused=false;settled=false;messageUntil=0;
    $('menu').hidden=true;$('hud').hidden=false;$('online-hud').hidden=false;
    setText('race-track',getTrack(room.trackId).name.toUpperCase());setText('race-region',getTrack(room.trackId).region);
    setText('distance-total',`${(getTrack(room.trackId).distance/1000).toFixed(1)} KM ⚑`);setText('race-message','');
    void audio.start();
  }
  if(room.race.tick>lastOnlineEventTick) {
    for(const event of room.race.events)if((event.tick ?? room.race.tick)>lastOnlineEventTick && (event.actor===online.id || event.target===online.id || event.type==='police' || event.type==='horn' && Math.abs((race.riders.find(r=>r.id===event.actor)?.z ?? Infinity)-localRider().z)<100)) {
      audio.event(event);if(event.text){setText('race-message',event.text);messageUntil=race.time+1.6;}
      if(event.type==='hit' || event.type==='crash' || event.type==='explosion')renderer.hit();
    }
    lastOnlineEventTick=room.race.tick;
  }
  if(room.race.multiplayer?.results[online.id])showOnlineResult(room);
}
function showOnlineResult(room: RoomView) {
  const result=room.race!.multiplayer!.results[online.id];if(!result)return;
  if(!settled) {
    settled=true;screen='result';paused=false;clearControls();closeDialogs();
    const exploded=room.race!.riders.find(r=>r.id===online.id)?.recovery?.phase==='exploding';
    const title=exploded?'MOTO <span>EXPLODIU.</span>':result.reason==='finish'?`${result.place}º NA <span>CHEGADA.</span>`:result.reason==='caught'?'FIM DA <span>LINHA.</span>':'FIM DE <span>CORRIDA.</span>';
    $('result-modal').innerHTML=`<div class="result-top"><div class="eyebrow">MULTIPLAYER / ${conditionName(room.condition).toUpperCase()} / SALA ${room.code}</div><h2 id="result-title" class="result-title">${title}</h2><p class="result-sub">${exploded?'A moto explodiu ao tentar pegá-la com integridade zero.':result.reason==='caught'?'Você foi preso e perdeu a corrida.':result.reason==='wrecked'?'Sua moto ficou sem integridade.':result.reason==='left'?'Você saiu da corrida.':result.reason==='timeout'?'O tempo máximo da corrida terminou.':'Você cruzou a linha de chegada.'}</p><p id="online-result-status" class="online-note"></p></div><div id="online-result-table" class="result-table"></div><div class="result-actions"><button id="online-menu-btn" class="primary">VOLTAR AO MENU ↗</button></div>`;
    if(result.reason==='finish'){
      $('result-modal').querySelector('.result-actions')!.innerHTML=resultButtons(true,!!nextRaceRoute(room.trackId,room.condition));
      $('result-modal').querySelector('.result-actions')!.insertAdjacentHTML('beforebegin','<p class="finish-room-hint">Para correr outra vez, crie ou entre em uma nova sala.</p>');
    }
    beginResult(result.reason==='finish',result.place);
  }
  $('online-result-status').textContent=room.phase==='finished'?'CORRIDA ENCERRADA':`${Object.keys(room.race!.multiplayer!.results).length} / ${ranking(room.race!).length} PILOTOS CONCLUÍRAM`;
  $('online-result-table').innerHTML=ranking(room.race!).map((r,i)=>{
    const result=room.race!.multiplayer!.results[r.id];
    const label=result?({finish:clockString(result.time),caught:'PRESO',wrecked:'MOTO QUEBRADA',left:'SAIU',timeout:r.profile==='player'?'TEMPO ESGOTADO':'NÃO CONCLUIU'}[result.reason]):'NA PISTA';
    return `<div class="result-rider ${r.id===online.id?'me':''}"><span>${result && result.reason!=='finish'?'—':i+1}. ${escapeHTML(r.name)}</span><span>${label}</span></div>`;
  }).join('');
}

function toast(message: string) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3000); }
function saveNow() { if (!accounts.save(save)) toast('O navegador não permitiu salvar. O progresso vale para esta sessão.'); }
function syncSound() {
  audio.setMuted(save.muted);
  document.querySelectorAll<HTMLButtonElement>('[data-action="mute"]').forEach(b => { b.innerHTML = save.muted ? icons.mute : icons.sound; b.setAttribute('aria-label', save.muted ? 'Ativar áudio (M)' : 'Silenciar áudio (M)'); b.setAttribute('aria-pressed', String(save.muted)); });
}
function toggleMute() { save.muted = !save.muted; syncSound(); saveNow(); void audio.start(); }
function updateRouteNavigation() {
  const list=$('routes');
  $<HTMLButtonElement>('routes-prev').disabled=list.scrollLeft<2;
  $<HTMLButtonElement>('routes-next').disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;
}
function revealSelectedRoute() {
  const list=$('routes'),card=list.querySelector<HTMLElement>('[aria-pressed="true"]');
  if(!card)return;
  const a=list.getBoundingClientRect(),b=card.getBoundingClientRect();
  if(b.left<a.left+6 || b.right>a.right-6)list.scrollLeft+=b.left-a.left-6;
  updateRouteNavigation();
}
$('routes').addEventListener('scroll',updateRouteNavigation,{passive:true});
window.addEventListener('resize',()=>requestAnimationFrame(revealSelectedRoute));
function renderMenu() {
  const championship=save.championship;
  const continuing=championship && !['eliminated','complete'].includes(championship.status);
  $('champ-card-state').hidden=!continuing;
  setText('champ-card-state',continuing?`RETOMAR · ${championship.stage+1} / ${TRACKS.length}`:'');
  $('championship-btn').setAttribute('aria-label',continuing?`Continuar campeonato, etapa ${championship.stage+1} de ${TRACKS.length}`:'Campeonato, 5 etapas e 20 corridas');
  const selected=raceRoute(selectedTrack,selectedCondition),best=save.records[recordKey(selectedTrack,selectedCondition)];
  $('route-detail').textContent=`${selected.name} — ${selected.condition.description}`+(best ? ` · RECORDE ${clockString(best.time)}` : '');
  $('wallet').textContent=money(save.cash);
  $('current-bike').textContent=getBike(save.bikeId).name;
  $('route-count').textContent=`${String(RACE_ROUTES.indexOf(selected)+1).padStart(2,'0')} / ${RACE_ROUTES.length} PISTAS`;
  const focused=(document.activeElement as HTMLElement)?.dataset.route;
  const list=$('routes'),left=list.scrollLeft;
  list.innerHTML=RACE_ROUTES.map((r,i)=>{
    const locked=r.track.index>save.unlocked,active=r.id===selected.id;
    const tint={day:'#376875',sunset:'#765545',night:'#263c5a',rain:'#455a63'}[r.condition.id];
    return `<button class="route ${active?'selected':''}" style="--route-tint:${tint}" data-route="${r.id}" data-track="${r.track.id}" data-condition="${r.condition.id}" ${locked?'disabled':''} aria-pressed="${active}" aria-label="${r.name}${locked?', termine a pista anterior entre os 5 primeiros para liberar':''}"><span class="route-top"><span>${String(i+1).padStart(2,'0')} / ${locked?'BLOQUEADA':r.track.difficulty}</span>${locked?icons.lock:'<span>↗</span>'}</span><strong>${r.track.name}</strong><span class="route-condition"><span aria-hidden="true">${r.condition.icon}</span>${r.condition.name}</span><small>${locked?'TOP 5 NA PISTA ANTERIOR':`${(r.track.distance/1000).toFixed(1)} KM · PRÊMIO ${money(r.track.prize)}`}</small></button>`;
  }).join('');
  list.scrollLeft=left;
  if(focused)list.querySelector<HTMLButtonElement>(`[data-route="${focused}"]`)?.focus({preventScroll:true});
  requestAnimationFrame(revealSelectedRoute);
}
function makeAttract() {
  race = createRace(selectedTrack, save, 88117, selectedCondition);
  race.scenicEvent=undefined;
  race.mode = 'racing'; localRider().z = 480; localRider().x = 2.2;
  race.riders.slice(1).forEach((r, i) => { r.z = 500 + i * 31; r.x = [-2, 2.3, -.8, 4.1, -3.8, 1.2, 3][i]; });
  race.traffic = race.traffic.filter(t => t.z > 700);
  menuTime = 0;
}
function showMenu() {
  championshipMode=false;
  resetFinish();
  soloRecorder=null;
  if(onlineMode){online.leave();return;}
  clearTimeout(toastTimer);$('toast').hidden=true;
  $('online-hud').hidden=true;
  closeDialogs(); screen = 'menu'; paused = false; clearControls();
  $('menu').hidden = false; $('hud').hidden = true;
  renderMenu(); makeAttract(); audio.update(0, false, false, 0);
}
function closeDialogs() { document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close()); }
async function startRace(championship=false) {
  if(startingRace || champSettling)return;
  if(championship && championshipBikeState(save).blocked){showChampionship();return;}
  startingRace=true;
  resetFinish();
  soloRecorder=null;
  if(onlineMode)online.leave();
  clearTimeout(toastTimer);$('toast').hidden=true;
  $('online-hud').hidden=true;
  closeDialogs(); clearControls();
  if (!championship && (save.condition[save.bikeId] ?? 100) < 20) { save.bikeId = 'ferro'; save.condition.ferro = Math.max(55, save.condition.ferro); saveNow(); toast('Ferro 500 pronta: reparo básico gratuito para continuar.'); }
  soloNitroSpent=0;lowIntegrityWarned=false;audio.resetRace();
  $('start-btn').textContent='PREPARANDO…';
  championshipMode=championship;
  const run=championship || testMode || !accounts.session?.account?null:await accounts.startRun(selectedTrack,selectedCondition);
  if(run)soloRecorder=new SoloRecorder(run,accounts.cache!.account.id);
  if(championship){
    const next=startChampionshipRace(save);if(!next){startingRace=false;showChampionship();return;}
    race=next;selectedTrack=race.trackId;selectedCondition=raceCondition(race.condition);soloNitroSpent=race.riders[0].nitroUsed ?? 0;champCheckpointAt=race.time;saveNow();
  }else race = createRace(selectedTrack, run?.save ?? save, run?.seed ?? (testMode ? 88117 : crypto.getRandomValues(new Uint32Array(1))[0]), selectedCondition);
  startingRace=false;$('start-btn').innerHTML=`JOGAR SOZINHO ${icons.arrow}`;
  if(!championship && !testMode && accounts.cache && !run)toast('Corrida local: o progresso será salvo. Ranking indisponível nesta largada.');
  screen = 'race'; paused = false; settled = false; messageUntil = 0; lastCount = 4;
  $('menu').hidden = true; $('hud').hidden = false;
  setText('race-track', getTrack(selectedTrack).name.toUpperCase()); setText('race-region', getTrack(selectedTrack).region);
  setText('distance-total', `${(getTrack(selectedTrack).distance / 1000).toFixed(1)} KM ⚑`);
  setText('race-message', '');
  void audio.start(); updateHUD();
  if(championship && race.mode==='finished')showResult();
}
function requestStart() {
  void audio.start();
  if (save.races === 0 && !sessionStorage.getItem('asfalto-instructions')) { helpStartsRace = true; $<HTMLDialogElement>('help-modal').showModal(); }
  else startRace();
}
function pauseGame() {
  if (screen !== 'race' || race.mode === 'finished') return;
  setText('pause-title',onlineMode?'MENU DA CORRIDA':'CORRIDA PAUSADA');
  $('pause-modal').querySelector('p')!.textContent=onlineMode?'A corrida online continua enquanto este menu está aberto.':championshipMode?'Abandonar dá zero pontos nesta corrida. A classificação da etapa continua.':'A estrada espera por você.';
  $('restart-btn').hidden=onlineMode || championshipMode;
  $('menu-btn').textContent=championshipMode?'ABANDONAR CORRIDA · 0 PONTOS':'VOLTAR AO MENU';
  clearControls(); paused = true; audio.update(0, false, false, 0); $<HTMLDialogElement>('pause-modal').showModal();
}
function resumeGame() { $<HTMLDialogElement>('pause-modal').close(); paused = false; clearControls(); last = performance.now(); accumulator = 0; }
function input(): Command {
  return { throttle: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : Math.max(0,analog.drive), brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : Math.max(0,-analog.drive), steer: clamp((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)+analog.steer,-1,1), attack: keys.has('KeyL') ? 'weapon' : keys.has('KeyK') ? 'kick' : keys.has('KeyJ') ? 'punch' : null, action:pendingActions.shift() };
}
function syncSoloNitro() {
  if(onlineMode)return;
  const p=localRider(),used=p.nitroUsed ?? 0;
  if(used>soloNitroSpent){spendNitro(save,p.bikeId ?? 'ferro',used-soloNitroSpent);soloNitroSpent=used;saveNow();}
}
function clearControls() {
  keys.clear();pendingActions=[];doubleTap.reset();throttleTap.reset();analog.steer=0;analog.drive=0;
  resetPointers.forEach(reset=>reset());
  document.querySelectorAll<HTMLElement>('.analog-knob').forEach(k=>k.style.transform='translate(0px,0px)');
  document.querySelectorAll<HTMLElement>('.analog-stick').forEach(k=>k.setAttribute('aria-valuenow','0'));
}
function queueAction(action: RiderAction) {
  if(screen!=='race' || paused || race.mode!=='racing' || document.querySelector('dialog[open]'))return;
  const p=localRider();
  if(p.recovery)return;
  if(action==='kneeLeft' || action==='kneeRight') {
    if(!supportsKneeDown(p.bikeId)){toast('Choppers não fazem a manobra de joelho.');return;}
    if(!getKneePad(p.kneePadId) || p.speed<20)return;
  }
  if(action==='wheelie'){
    if(wheeliesLeft(p)<=0){toast('Você já usou as 3 empinadas desta corrida.');return;}
    if(p.speed<20){toast('Empine acima de 72 km/h.');return;}
    if(stunting(p))return;
  }
  if(onlineMode)online.action(action);else if(pendingActions.length<8)pendingActions.push(action);
}
function acceleratorTap(at: number) { if(throttleTap.press(1,at))queueAction('wheelie'); }
function directionTap(side: number, at: number) {
  if(doubleTap.press(side,at))queueAction(side<0?'kneeLeft':'kneeRight');
}
function updateHUD() {
  setText('race-track',getTrack(race.trackId).name.toUpperCase());
  setText('race-region',conditionName(race.condition).toUpperCase());
  const p = localRider(), standings=onlineMode?(online.room?.race ?? race):race;
  const order = ranking(standings), place = order.findIndex(r => r.id === localId()) + 1;
  const standingZ=standings.riders.find(r=>r.id===localId())?.z ?? p.z;
  setText('rider-total',String(order.length));
  $('online-hud').textContent=onlineMode?`SALA ${online.code} · ${online.status==='offline'?'CONEXÃO PERDIDA · VOLTE AO MENU':online.status!=='connected'?'RECONECTANDO…':online.syncing?'SINCRONIZANDO…':`${Math.round(online.rtt)} MS`}`:'';
  setText('position', String(place)); setText('race-time', clockString(race.time));
  setText('speed', Math.round(p.speed * 3.6).toString().padStart(3, '0')); setText('gear', p.speed < 1 ? 'N' : String(Math.min(6, Math.floor(p.speed / 11) + 1)));
  setText('health-value', `${Math.ceil(p.health)}%`); setText('integrity-value', `${Math.max(0, Math.ceil(p.integrity))}%`);
  $('health-bar').style.width = `${p.health}%`; $('health-bar').style.background = p.health < 30 ? '#ffa281' : 'var(--acid)'; $('integrity-bar').style.width = `${Math.max(0, p.integrity)}%`;
  setText('weapon-label',weaponName(p).toUpperCase());
  document.querySelector('[data-touch=KeyL]')?.setAttribute('aria-label',weaponName(p));
  setText('wheelie-indicator',`${p.jumpTime!>0?'SALTO':p.wheelieTime!>0?'EMPINANDO':'EMPINADAS'} ${wheeliesLeft(p)}/3`);
  $('wheelie-indicator').classList.toggle('active',stunting(p));
  const knee=kneeSupport(p,curveAt(p.z,race.trackId),race.trackId);
  setText('knee-indicator',p.crash||p.out?'':knee>.25?'JOELHO APOIADO':p.kneeTime!>0?'MANOBRA ATIVA':getKneePad(p.kneePadId)&&supportsKneeDown(p.bikeId)?'JOELHEIRA PRONTA':'');
  $('knee-indicator').classList.toggle('knee-active',knee>.25);
  setText('nitro-indicator',`NITRO ${p.nitro ?? 0}/${getBike(p.bikeId).nitroCapacity}${p.nitroTime!>0?' · '+p.nitroTime!.toFixed(1)+'s':''}`);
  $('nitro-indicator').classList.toggle('active',p.nitroTime!>0);
  $<HTMLButtonElement>('touch-nitro').disabled=!(p.nitro!>0)||p.nitroTime!>0||!!p.crash;
  $('touch-nitro').textContent=`NITRO ${p.nitro ?? 0}`;
  const pct = clamp(p.z / getTrack(race.trackId).distance * 100, 0, 100);
  $('progress-bar').style.width = `${pct}%`; $('progress-dot').style.left = `${pct}%`; setText('distance', `${(p.z / 1000).toFixed(1)} KM`);
  const corner = upcomingCorner(p.z, race.trackId, p.handling, race.condition, p.kneeTime!>0 && supportsKneeDown(p.bikeId)?p.kneePadId:undefined);
  $('corner-warning').hidden = !corner || !!p.out || race.mode !== 'racing';
  if (corner) {
    const fast = p.speed > cornerPace(p.z, race.trackId, p.handling, race.condition, p.kneeTime!>0 && supportsKneeDown(p.bikeId)?p.kneePadId:undefined) + 2;
    const sliding = cornerForces(p.speed,cornerHandling(p,curveAt(p.z,race.trackId),race.trackId)*surfaceGrip(race.trackId,race.condition),curveAt(p.z,race.trackId)).sliding;
    $('corner-warning').classList.toggle('braking',fast);
    setText('corner-arrow',corner.direction === 'right' ? '↱' : '↰');
    setText('corner-title',sliding ? 'SEM ADERÊNCIA · FREIE' : fast ? 'FREIE ANTES DA CURVA' : corner.tight ? 'CURVA FECHADA' : 'CURVA À FRENTE');
    setText('corner-detail',`${corner.distance > 0 ? `${corner.distance} M · ` : ''}${corner.speed} KM/H · ${corner.direction === 'right' ? 'DIREITA' : 'ESQUERDA'}`);
  }
  const works=race.trackId==='porto'?upcomingWorks(p.z):null;
  if(works && !p.out && race.mode==='racing' && (!corner || (!corner.tight && works.distance<corner.distance))){
    $('corner-warning').hidden=false;$('corner-warning').classList.remove('braking');
    setText('corner-arrow',works.side>0?'←':'→');setText('corner-title','OBRAS NA PISTA');
    setText('corner-detail',`${works.distance?works.distance+' M · ':''}DESVIE PELA ${works.side>0?'ESQUERDA':'DIREITA'}`);
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
  $('crash').hidden = !!p.recovery || p.crash === 0 || !!p.out || race.mode === 'finished';
  $('hud').classList.toggle('is-crashed',!$('crash').hidden);
  if (p.crash) setText('crash-time', `DE VOLTA EM ${p.crash.toFixed(1)}s · SEGURE O ACELERADOR`);
  if (race.time > messageUntil) setText('race-message', Math.abs(p.x) > roadHalf(race.trackId) && p.speed > 6 ? 'ACOSTAMENTO · MENOS ADERÊNCIA' : race.time < 5 && race.mode === 'racing' ? 'ACELERA. A ESTRADA É SUA.' : '');
  if (race.tick < lastStandingsTick || race.tick - lastStandingsTick >= 6 || place !== lastStandingsPlace || inCountdown) {
    lastStandingsTick = race.tick; lastStandingsPlace = place;
    const start = clamp(place - 2, 0, 4);
    $('rival-list').innerHTML = order.slice(start, start + 4).map((r, i) => `<div class="rival-entry ${r.id === localId() ? 'me' : ''}"><span>${start + i + 1}</span><span>${escapeHTML(r.name)}</span><span class="gap">${r.out==='caught'?'PRESO':r.out?'FORA':r.id === localId() ? '◂' : `${r.z >= standingZ ? '+' : '−'}${Math.round(Math.abs(r.z - standingZ))}m`}</span></div>`).join('');
  }
}
function renderGarage() {
  if(garageTab!=='bikes'){
    $('garage-modal').innerHTML=`<div class="dialog-header"><div><div class="eyebrow">SUA OFICINA. SUAS REGRAS.</div><h2 id="garage-title">Garagem</h2></div><button class="close-btn" data-close="garage-modal" aria-label="Fechar garagem">×</button></div><div class="dialog-body">${garageNav(garageTab)}${equipmentShop(save,garageTab)}<div class="garage-footer"><span>SALDO <b>${money(save.cash)}</b></span></div></div>`;return;
  }
  $('garage-modal').innerHTML = `<div class="dialog-header"><div><div class="eyebrow">SUA OFICINA. SUAS REGRAS.</div><h2 id="garage-title">Garagem</h2></div><button class="close-btn" data-close="garage-modal" aria-label="Fechar garagem">×</button></div><div class="dialog-body">${garageNav(garageTab)}<div class="garage-intro"><div><b>${BIKES.length} MOTOS. ESCOLHA SEU ESTILO.</b><p>Compare os dados de fábrica. As melhorias valem para a moto equipada.</p></div><button class="secondary" id="garage-workshop">MELHORIAS & REPAROS ↓</button></div><div class="garage-grid">${BIKES.slice().sort((a,b)=>a.price-b.price).map((b,index) => {
    const owned = save.owned.includes(b.id), equipped = save.bikeId === b.id;
    return `<article class="bike-card ${equipped ? 'equipped' : ''}"><div class="bike-class">${b.class} / 0${index + 1}</div><h3>${b.name}</h3><img class="bike-image" src="${bikePortrait(b).toDataURL()}" alt="${b.name}, moto ${b.class.toLowerCase()} vista de lado"/><p>${b.tagline}</p><div class="bike-stats"><div class="bike-stat">VELOCIDADE <strong>${Math.round(b.speed * 3.6)} KM/H</strong></div><div class="bike-stat">0–100 KM/H <strong>${zeroToHundred(b).toFixed(1)} S</strong></div><div class="bike-stat curve-stat">CURVAS <strong>${handlingLabel(b.handling)}</strong><meter min="0" max="1.6" value="${b.handling}" aria-label="Agilidade nas curvas: ${handlingLabel(b.handling)}"></meter></div><div class="bike-stat">NITRO <strong>ATÉ ${b.nitroCapacity} CARGAS</strong></div><div class="bike-stat">JOELHEIRA <strong>${supportsKneeDown(b.id)?'COMPATÍVEL':'INCOMPATÍVEL'}</strong></div><div class="bike-stat">RESISTÊNCIA DA MOTO <strong>${Math.round(b.armor * 100)}%</strong></div></div><button class="secondary" data-bike="${b.id}" ${equipped || (!owned && save.cash < b.price) ? 'disabled' : ''}>${equipped ? '✓ EQUIPADA' : owned ? 'EQUIPAR ↗' : `COMPRAR · ${money(b.price)}`}</button></article>`;
  }).join('')}</div><div class="garage-tools" id="garage-tools"><div><h3>MELHORIAS · ${BIKES.find(b => b.id === save.bikeId)!.name.toUpperCase()}</h3>${(['engine', 'armor', 'handling'] as const).map(k => {
    const level = save.upgrades[save.bikeId][k], label = { engine: 'Motor', armor: 'Resistência', handling: 'Dirigibilidade' }[k];
    return `<div class="upgrade"><span>${label}<span class="levels">${'▰'.repeat(level)}${'▱'.repeat(3 - level)}</span></span><button class="secondary" data-upgrade="${k}" ${level >= 3 || save.cash < upgradeCost(save, k) ? 'disabled' : ''}>${level >= 3 ? 'MÁXIMO' : `+ ${money(upgradeCost(save, k))}`}</button></div>`;
  }).join('')}</div><div class="repair-panel"><h3>MOTO EM ${Math.round(save.condition[save.bikeId])}%</h3><p>Nas corridas livres, a Ferro 500 recebe reparos gratuitos até 55% após cada corrida. No campeonato, os reparos ficam entre as etapas ou quando a moto chega a 0%.</p><button class="secondary" id="repair-btn" ${repairCost(save) === 0 || save.cash < repairCost(save) ? 'disabled' : ''}>${repairCost(save) === 0 ? '✓ NENHUM REPARO NECESSÁRIO' : `REPARAR 100% · ${money(repairCost(save))}`}</button></div></div><div class="garage-footer"><span>SALDO <b>${money(save.cash)}</b></span><button class="text-button danger" id="reset-btn">Reiniciar progresso</button></div></div>`;
}
function showGarage() { if(championshipMode && save.championship && !championshipGarageOpen(save.championship))return;renderGarage(); $<HTMLDialogElement>('garage-modal').showModal(); }

function showChampionship() {
  if(champSettling)return;
  showMenu();$('championship-modal').innerHTML=championshipMarkup(save.championship,save);
  $<HTMLDialogElement>('championship-modal').showModal();$('championship-modal').scrollTop=0;
}
function launchChampionship(){
  // Validate before advancing the stage, capturing equipment or recording a race.
  if(championshipBikeState(save).blocked){showChampionship();return;}
  save.championship ??=newChampionship(crypto.getRandomValues(new Uint32Array(1))[0]);
  if(save.championship.status==='service')nextChampionshipStage(save.championship);
  saveNow();void startRace(true);
}
async function showChampionshipResult(){
  const c=save.championship;if(!c || !race.result || settled)return;
  settled=true;champSettling=true;checkpointChampionship(c,race);saveNow();
  const completedRace=race,payoutResult=race.result;
  $('result-modal').classList.add('championship-result');
  $('result-modal').removeAttribute('aria-labelledby');$('result-modal').setAttribute('aria-label','Classificação do campeonato');
  $('result-modal').innerHTML='<div class="dialog-body champ-body"><h2>FECHANDO A CLASSIFICAÇÃO…</h2><p>Os demais pilotos estão concluindo a corrida.</p></div>';
  beginResult(payoutResult.reason==='finish',payoutResult.place);
  try{
    const completed=await finishChampionshipSimulation(completedRace);
    if(recordChampionshipHeat(c,completed)){
      resultPayout=settleRace(save,completedRace,{starterRepair:false}) ?? null;
      saveNow();
    }
    $('result-modal').innerHTML=championshipMarkup(c,save,resultPayout?.total);$('result-modal').scrollTop=0;
  }finally{champSettling=false;}
}
function saveChampionshipCheckpoint(){
  if(championshipMode && !settled && save.championship){syncSoloNitro();checkpointChampionship(save.championship,race);saveNow();}
}
window.addEventListener('pagehide',saveChampionshipCheckpoint);
window.addEventListener('beforeunload',saveChampionshipCheckpoint);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveChampionshipCheckpoint();});

let retryingRanking=false;
async function retryRankedResults() {
  if(retryingRanking || !accounts.session?.account)return;
  retryingRanking=true;
  const accountId=accounts.session.account.id;
  try {
    const pending=await pendingResults(accountId);
    for(const entry of pending){
      if(accounts.session?.account?.id!==accountId)break;
      try{await accounts.api('/finish',{id:entry.id,segments:entry.segments},45_000);}
      catch(e){if(!(e instanceof ApiError) || ![400,404,413].includes(e.status))break;toast('Esta corrida ficou nos seus recordes pessoais; o ranking não confirmou o resultado.');}
      await removeResult(entry.id);
    }
  }catch{}finally{retryingRanking=false;}
}
async function submitSoloResult(){
  const recorder=soloRecorder;soloRecorder=null;
  if(!recorder || race.result?.reason!=='finish')return;
  const payload=recorder.payload();if(!payload)return;
  try{
    await queueResult({...payload,account:recorder.accountId,created:Date.now()});
  }catch{toast('Sem espaço neste aparelho para guardar o envio ao ranking.');return;}
  await retryRankedResults();
}
window.addEventListener('online',()=>void accounts.refresh().then(()=>retryRankedResults()));
window.addEventListener('focus',()=>{if(screen==='menu')void retryRankedResults();});

function showResult() {
  if (!race.result || settled) return;
  if(championshipMode){void showChampionshipResult();return;}
  void submitSoloResult();
  settled = true; resultPayout = settleRace(save, race) ?? null; saveNow(); screen = 'result'; clearControls();
  const r = race.result;
  const exploded=localRider().recovery?.phase==='exploding';
  const title = exploded ? 'MOTO <span>EXPLODIU.</span>' : r.reason === 'caught' ? 'FIM DA <span>LINHA.</span>' : r.reason === 'wrecked' ? 'MOTOR <span>APAGADO.</span>' : r.place === 1 ? 'A RUA É <span>SUA.</span>' : `${r.place}º NA <span>CHEGADA.</span>`;
  const subtitle = exploded ? 'A moto estava com a integridade zerada e explodiu ao tentar levantá-la. Fim da corrida.' : r.reason === 'finish' ? r.place <= 5 && getTrack(race.trackId).index < TRACKS.length-1 ? 'Top 5 conquistado. A próxima estrada está liberada.' : 'Dinheiro no bolso. Mais uma história no asfalto.' : r.reason === 'caught' ? r.arrestCause === 'fall' ? 'Você caiu perto da polícia. Prisão imediata: corrida perdida.' : 'O policial ficou perto por 3 segundos enquanto você estava devagar.' : 'A integridade da moto chegou a zero. A Ferro 500 te leva de volta à pista.';
  $('result-modal').innerHTML = `<div class="result-top"><div class="eyebrow">${getTrack(race.trackId).name.toUpperCase()} · ${conditionName(race.condition).toUpperCase()} / ${r.reason === 'finish' ? 'CORRIDA CONCLUÍDA' : r.reason === 'caught' ? 'CAPTURADO' : 'MOTO DESTRUÍDA'}</div><h2 class="result-title" id="result-title">${title}</h2><div class="result-sub">${subtitle}</div></div><div class="result-stats"><div><small>SEU TEMPO</small><b>${clockString(r.time)}</b></div><div><small>GOLPES / QUEDAS</small><b>${r.hits} / ${r.falls}</b></div><div><small>${r.reason === 'finish' ? 'RECOMPENSA' : 'AJUDA DA OFICINA'}</small><b class="prize">+ ${money(r.reward)}</b></div></div><div class="result-table">${ranking(race).map((rider, i) => `<div class="result-rider ${rider.id === localId() ? 'me' : ''}"><span>${rider.id === localId() && r.reason !== 'finish' ? '—' : i + 1}. ${rider.name}</span><span>${rider.id === localId() && r.reason !== 'finish' ? r.reason === 'caught' ? 'PRESO' : 'FORA DA CORRIDA' : rider.finishedAt !== null ? clockString(rider.finishedAt) : rider.out==='caught'?'PRESO':rider.out?'FORA DA CORRIDA':'NA PISTA'}</span></div>`).join('')}</div><div class="result-actions"><button class="primary" id="again-btn">CORRER DE NOVO ${icons.arrow}</button><button class="secondary" id="result-menu-btn">ESTRADAS & GARAGEM</button></div>`;
  if(resultPayout?.recordBonus){
    $('result-modal').querySelector('.prize')!.textContent=`+ ${money(resultPayout.total)}`;
    $('result-modal').querySelector('.prize')!.previousElementSibling!.textContent='RECOMPENSA TOTAL';
    $('result-modal').querySelector('.result-table')!.insertAdjacentHTML('beforebegin',`<div class="record-bonus"><div><strong>RECORDE PESSOAL BATIDO</strong><small>${clockString(resultPayout.previousRecord!)} → ${clockString(r.time)} · Bônus de 30% do prêmio da pista</small></div><b>+ ${money(resultPayout.recordBonus)}</b></div>`);
  }
  const next=nextRaceRoute(race.trackId,race.condition);
  $('result-modal').querySelector('.result-actions')!.innerHTML=resultButtons(false,r.reason==='finish' && !!next && next.track.index<=save.unlocked);
  beginResult(r.reason==='finish',r.place);
}
function resultButtons(multiplayer: boolean, hasNext: boolean) {
  return `${hasNext?`<button class="primary" id="${multiplayer?'online-next-btn':'next-race-btn'}">PRÓXIMA CORRIDA ${icons.arrow}</button>`:''}<button class="${hasNext?'secondary':'primary'}" id="${multiplayer?'online-again-btn':'again-btn'}">CORRER DE NOVO ${icons.arrow}</button><button class="secondary" id="${multiplayer?'online-menu-btn':'result-menu-btn'}">VOLTAR AO MENU</button>`;
}
function resetFinish() {
  renderer.resetCamera();
  finishOfficer=null;lastFinishStrike=-1;
  $('result-modal').removeAttribute('aria-label');$('result-modal').setAttribute('aria-labelledby','result-title');
  $('result-modal').classList.remove('championship-result');resultPayout=null;finishElapsed=null;$('finish-scene').hidden=true;$('result-modal').classList.remove('finish-result');
}
function beginResult(finished: boolean, place: number) {
  clearControls();closeDialogs();paused=false;audio.update(0,false,false,0);
  $('result-modal').classList.toggle('finish-result',finished);
  if(!finished){screen='result';finishElapsed=null;$<HTMLDialogElement>('result-modal').showModal();return;}
  finishElapsed=0;finishOfficer=finishPoliceArrival(race,localId());lastFinishStrike=-1;screen='finish';$('hud').hidden=true;$('finish-scene').hidden=false;
  const winner=finishWinner(race);
  setText('finish-place',`${place}º NA CHEGADA`);
  setText('finish-winner',winner?.id===localId()?'A RUA É SUA.':`${winner?.name ?? 'O PRIMEIRO COLOCADO'} VENCEU.`);
  $('finish-skip').focus({preventScroll:true});
}
function revealResult() {
  if(screen!=='finish')return;
  finishElapsed=Math.max(finishElapsed ?? 0,FINISH_SECONDS);screen='result';$('finish-scene').hidden=true;
  $<HTMLDialogElement>('result-modal').showModal();
  if(championshipMode)$('result-modal').scrollTop=0;
}
function advanceFinish(dt: number) {
  if(finishElapsed===null)return;
  finishElapsed+=dt;
  const officer=finishScene(race,localId(),finishElapsed,finishOfficer).police;
  if(officer && officer.strike>lastFinishStrike){lastFinishStrike=officer.strike;audio.event({type:'hit',actor:officer.id,target:officer.targetId ?? undefined});}
  if(finishElapsed>=FINISH_SECONDS)revealResult();
}
function nextSoloRace() {
  const next=nextRaceRoute(race.trackId,race.condition);
  if(!race.result || race.result.reason!=='finish' || !next || next.track.index>save.unlocked)return;
  selectedTrack=next.track.id;selectedCondition=next.condition.id;save.raceTrackId=selectedTrack;save.raceCondition=selectedCondition;saveNow();void startRace();
}
function nextOnlineRace(advance: boolean) {
  const room=online.room;if(!room)return;
  const route=advance?nextRaceRoute(room.trackId,room.condition):raceRoute(room.trackId,room.condition);if(!route)return;
  const bots=room.fillBots,isPublic=room.public,bike=localRider().bikeId;
  online.leave();openOnline();
  $<HTMLSelectElement>('online-track').value=route.id;$<HTMLInputElement>('online-bots').checked=bots;$<HTMLInputElement>('online-public').checked=!!isPublic;
  $<HTMLSelectElement>('online-bike').value=getBike(bike).id;updateOnlineBikePreview();
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
  const p=localRider();
  if(championshipMode && !lowIntegrityWarned && p.integrity>0 && p.integrity<20){lowIntegrityWarned=true;toast(`Atenção: moto com ${Math.max(1,Math.floor(p.integrity))}% de integridade.`);}
  const command=input();soloRecorder?.add(command);
  stepRace(race, { player: command });
  syncSoloNitro();
  if(championshipMode && save.championship && race.time-champCheckpointAt>=3){checkpointChampionship(save.championship,race);champCheckpointAt=race.time;saveNow();}
  const count = Math.ceil(race.countdown - .5);
  if (race.mode === 'countdown' && count !== lastCount) { lastCount = count; audio.tone(count <= 0 ? 880 : 440, .15, .16, 'sine'); }
  for (const event of race.events) {
    const localEvent = event.target === 'player' || event.actor === 'player' || event.type === 'police' || event.text?.startsWith('VOCÊ') || event.actor.startsWith('obstacle');
    if (localEvent || event.type==='horn' && Math.abs((race.riders.find(r=>r.id===event.actor)?.z ?? Infinity)-localRider().z)<100) audio.event(event);
    if (localEvent && event.text) { setText('race-message', event.text); messageUntil = race.time + 1.6; $('race-message').classList.toggle('alert', event.type === 'police' || event.type === 'crash'); }
    if (localEvent && (event.type === 'hit' || event.type === 'crash' || event.type === 'explosion')) renderer.hit();
  }
  audio.update(localRider().speed, !localRider().recovery, race.policeActive && Math.abs((race.riders.find(r => r.id === 'police')?.z ?? 99999) - localRider().z) < 100, race.time, getBike(localRider().bikeId).style, jumpSoundKey(localRider()),guardRailSoundSide(race.trackId,localRider()),race.trackId==='terra'?'earth':'metal',jumpSoundMaterial(race,localRider()));
  audio.updateRecovery(localRider(),race.trackId);
  if (race.mode === 'finished') showResult();
}
function draw() { renderer.render(race, screen === 'menu',localId(),finishElapsed,finishOfficer); if (screen !== 'menu' && finishElapsed===null) { updateHUD(); instruments.draw(race,localId()); } updateRecoveryGuide(); }
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, .1); last = now;
  if(onlineMode) {
    accumulator+=dt;while(accumulator>=STEP){online.step(paused || screen!=='race'?{...EMPTY_COMMAND,brake:1}:input());accumulator-=STEP;}
    const view=online.view();if(view)race=view;drawLobbyClock();
    if(screen==='race'){const p=localRider();audio.update(p.speed,!paused && !p.recovery,race.policeActive && Math.abs((race.riders.find(r=>r.profile==='police')?.z ?? 99999)-p.z)<100,race.time,getBike(p.bikeId).style,jumpSoundKey(p),guardRailSoundSide(race.trackId,p),race.trackId==='terra'?'earth':'metal',jumpSoundMaterial(race,localRider()));if(!paused)audio.updateRecovery(p,race.trackId);}
  } else if (!testMode) { accumulator += dt; while (accumulator >= STEP) { update(); accumulator -= STEP; } }
  if(!testMode || onlineMode)advanceFinish(dt);
  draw(); requestAnimationFrame(frame);
}
async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Tela cheia indisponível neste navegador.'); } }

document.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || button.disabled) return;
  if(startingRace || champSettling){event.preventDefault();event.stopImmediatePropagation();return;}
  if (button.dataset.close) { $<HTMLDialogElement>(button.dataset.close).close();if(button.dataset.close==='garage-modal'&&champGarageReturn){champGarageReturn=false;showChampionship();}return; }
  if (button.dataset.action === 'mute') toggleMute();
  if (button.dataset.action === 'fullscreen') void fullscreen();
  if (button.dataset.action === 'help') { helpStartsRace = false; $<HTMLDialogElement>('help-modal').showModal(); }
  if (button.dataset.route) {
    const route=routeFromId(button.dataset.route);
    if(route.track.index<=save.unlocked){selectedTrack=route.track.id;selectedCondition=route.condition.id;save.raceTrackId=selectedTrack;save.raceCondition=selectedCondition;saveNow();renderMenu();makeAttract();}
  }
  if(button.dataset.garageTab){garageTab=button.dataset.garageTab as GarageTab;renderGarage();return;}
  if(button.dataset.helmet || button.dataset.helmetColor){
    const model=button.dataset.helmet,color=button.dataset.helmetColor,dialog=$<HTMLDialogElement>('garage-modal'),scroll=dialog.scrollTop;
    const changed=model?buyHelmet(save,model):paintHelmet(save,color!);
    if(changed){saveNow();renderMenu();renderGarage();makeAttract();dialog.scrollTop=scroll;dialog.querySelector<HTMLButtonElement>(model?`[data-helmet="${model}"]`:`[data-helmet-color="${color}"]`)?.focus({preventScroll:true});}
    return;
  }
  if(button.dataset.weapon && buyWeapon(save,button.dataset.weapon)){saveNow();renderGarage();makeAttract();return;}
  if(button.dataset.kneePad && buyKneePad(save,button.dataset.kneePad)){saveNow();renderGarage();makeAttract();return;}
  if (button.dataset.bike && buyBike(save, button.dataset.bike)) { saveNow(); renderMenu(); renderGarage(); makeAttract(); }
  if (button.dataset.upgrade && ['engine', 'armor', 'handling'].includes(button.dataset.upgrade) && buyUpgrade(save, button.dataset.upgrade as keyof Upgrade)) { saveNow(); renderMenu(); renderGarage(); toast('Melhoria instalada. Hora de sentir a diferença.'); }
  switch (button.id) {
    case 'routes-prev': case 'routes-next': $('routes').scrollBy({left:(button.id==='routes-next'?1:-1)*$('routes').clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); break;
    case 'online-btn': openOnline(); break;
    case 'online-create': enterOnline(true); break;
    case 'online-join': enterOnline(false); break;
    case 'online-ready': online.ready(!online.room?.members.find(m=>m.id===online.id)?.ready); break;
    case 'online-leave': case 'online-close': case 'online-menu-btn': if(onlineMode)online.leave();else closeDialogs(); break;
    case 'online-copy': { const url=new URL(location.href);url.search='';url.searchParams.set('sala',online.code);void navigator.clipboard.writeText(url.toString()).then(()=>{$('online-status').textContent='CONVITE COPIADO';}).catch(()=>{$('online-status').textContent=`COMPARTILHE O CÓDIGO ${online.code}`;});break;}
    case 'championship-btn': showChampionship();break;
    case 'champ-start': launchChampionship();break;
    case 'champ-repair': if(repairChampionshipBike(save)){saveNow();showChampionship();}break;
    case 'champ-restart': save.championship=newChampionship(crypto.getRandomValues(new Uint32Array(1))[0]);saveNow();showChampionship();break;
    case 'champ-garage': if(!save.championship || championshipGarageOpen(save.championship)){showMenu();champGarageReturn=true;showGarage();}break;
    case 'champ-close': case 'champ-menu': showMenu();break;
    case 'start-btn': requestStart(); break;
    case 'help-go': sessionStorage.setItem('asfalto-instructions', '1'); $<HTMLDialogElement>('help-modal').close(); if (helpStartsRace || screen === 'menu') startRace(); break;
    case 'buy-nitro': if(buyNitro(save)){saveNow();renderGarage();makeAttract();} break;
    case 'remove-weapon': delete save.weaponId;saveNow();renderGarage();makeAttract();break;
    case 'remove-knee': delete save.kneePadId;saveNow();renderGarage();makeAttract();break;
    case 'touch-nitro': queueAction('nitro');break;
    case 'garage-workshop': $('garage-tools').scrollIntoView({block:'start'}); break;
    case 'garage-btn': case 'change-bike': showGarage(); break;
    case 'pause-btn': pauseGame(); break;
    case 'resume-btn': resumeGame(); break;
    case 'restart-btn': case 'again-btn': if(championshipMode)break;selectedTrack=race.trackId;selectedCondition=raceCondition(race.condition);startRace(); break;
    case 'finish-skip': revealResult();break;
    case 'next-race-btn': nextSoloRace();break;
    case 'online-next-btn': nextOnlineRace(true);break;
    case 'online-again-btn': nextOnlineRace(false);break;
    case 'menu-btn': if(championshipMode){finishRider(race,localRider(),'left');showResult();break;}showMenu();break;
    case 'result-menu-btn': showMenu(); break;
    case 'repair-btn': if (repair(save)) { saveNow(); renderGarage(); renderMenu(); toast('Moto reparada. Pronta para a próxima.'); } break;
    case 'reset-btn': $<HTMLDialogElement>('reset-modal').showModal(); break;
    case 'confirm-reset': save = freshSave(); saveNow(); selectedTrack = 'costa'; selectedCondition='sunset'; syncSound(); showMenu(); toast('Garagem e progresso reiniciados.'); break;
  }
});
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => dialog.addEventListener('cancel', e => { if(champSettling){e.preventDefault();return;}if(dialog.id==='garage-modal'&&champGarageReturn){e.preventDefault();dialog.close();champGarageReturn=false;showChampionship();}if(dialog.id==='online-modal'){e.preventDefault();if(onlineMode)online.leave();else dialog.close();} if (dialog.id === 'pause-modal') { e.preventDefault(); resumeGame(); } if (dialog.id === 'result-modal') { e.preventDefault(); showMenu(); } }));
document.addEventListener('change',event=>{
  const element=event.target;
  if(element instanceof HTMLSelectElement && element.id==='nitro-bike' && save.owned.includes(element.value)){
    buyBike(save,element.value);saveNow();renderGarage();renderMenu();makeAttract();
  }
});
window.addEventListener('keydown', e => {
  if(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement){if(e.code==='Enter' && e.target.id==='online-code-input'){e.preventDefault();enterOnline(false);}return;}
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && !document.querySelector('dialog[open]')) e.preventDefault();
  if(screen==='finish' && (e.code==='Escape' || e.code==='Enter') && !e.repeat){e.preventDefault();revealResult();return;}
  if (e.code === 'Escape') { if (screen === 'race' && !paused && !document.querySelector('dialog[open]')) { e.preventDefault(); pauseGame(); } return; }
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); return; }
  if (e.code === 'KeyF' && !e.repeat && !document.querySelector('dialog[open]')) { void fullscreen(); return; }
  if (document.querySelector('dialog[open]')) return;
  if (e.code === 'Enter' && screen === 'menu' && !e.repeat && (!(e.target instanceof HTMLButtonElement) || e.target.id === 'start-btn')) { e.preventDefault(); requestStart(); return; }
  if (screen === 'race' && !paused) {
    const side=e.code==='KeyA'||e.code==='ArrowLeft'?-1:e.code==='KeyD'||e.code==='ArrowRight'?1:0;
    const alreadyHeld=side<0?keys.has('KeyA')||keys.has('ArrowLeft'):keys.has('KeyD')||keys.has('ArrowRight');
    if((e.code==='KeyW'||e.code==='ArrowUp') && !e.repeat && !keys.has('KeyW') && !keys.has('ArrowUp'))acceleratorTap(e.timeStamp);
    if((e.code==='KeyS'||e.code==='ArrowDown') && !e.repeat)throttleTap.reset();
    if(side && !e.repeat && !alreadyHeld)directionTap(side,e.timeStamp);
    if(!e.repeat){const action=({KeyB:'horn',KeyQ:'taunt',KeyN:'nitro'} as const)[e.code as 'KeyB'];if(action)queueAction(action);}
    keys.add(e.code);
    if(onlineMode && !e.repeat){const kind=({KeyJ:'punch',KeyK:'kick',KeyL:'weapon'} as const)[e.code as 'KeyJ'];if(kind)online.attack(kind);}
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { clearControls(); if (!testMode) pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !testMode) pauseGame(); });
document.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach(button => {
  button.addEventListener('pointerdown', e => {
    e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.touch!);void audio.start();
    if(onlineMode && screen==='race' && !paused){const kind=({KeyJ:'punch',KeyK:'kick',KeyL:'weapon'} as const)[button.dataset.touch as 'KeyJ'];if(kind)online.attack(kind);}
  });
  const release = () => keys.delete(button.dataset.touch!);
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
for(const [id,axis] of [['steering-stick','steer'],['drive-stick','drive']] as const) {
  const stick=$(id),knob=stick.querySelector<HTMLElement>('.analog-knob')!;
  let pointer: number | null=null,deflected=0;
  resetPointers.push(()=>{pointer=null;deflected=0;});
  const move=(event:PointerEvent)=>{
    if(event.pointerId!==pointer || screen!=='race' || paused)return;
    const box=stick.getBoundingClientRect(),radius=box.width*.32;
    let value=clamp((axis==='steer'?event.clientX-box.x-box.width/2:box.y+box.height/2-event.clientY)/radius,-1,1);
    if(Math.abs(value)<.15)value=0;
    analog[axis]=value;stick.setAttribute('aria-valuenow',String(Math.round(value*100)));
    knob.style.transform=axis==='steer'?`translate(${value*radius}px,0px)`:`translate(0px,${-value*radius}px)`;
    if(axis==='drive'){
      if(value<.22)deflected=0;
      if(value<-.22)throttleTap.reset();
      if(value>.55 && !deflected){deflected=1;acceleratorTap(event.timeStamp);}
    }
    if(axis==='steer'){
      if(Math.abs(value)<.22)deflected=0;
      if(Math.abs(value)>.55 && deflected!==Math.sign(value)){deflected=Math.sign(value);directionTap(deflected,event.timeStamp);}
    }
  };
  stick.addEventListener('pointerdown',event=>{
    if(pointer!==null || screen!=='race' || paused)return;
    event.preventDefault();pointer=event.pointerId;deflected=0;stick.setPointerCapture(pointer);void audio.start();move(event);
  });
  stick.addEventListener('pointermove',move);
  const release=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;pointer=null;deflected=0;analog[axis]=0;knob.style.transform='translate(0px,0px)';stick.setAttribute('aria-valuenow','0');};
  stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);stick.addEventListener('lostpointercapture',release);
  window.addEventListener('blur',()=>{pointer=null;deflected=0;});
}

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
  return JSON.stringify({ camera:renderer.cameraState(),championship:save.championship?{active:championshipMode,settling:champSettling,stage:save.championship.stage,status:save.championship.status,heats:save.championship.heats.length,garageOpen:championshipGarageOpen(save.championship),bike:championshipBikeState(save),standings:championshipStandings(save.championship.heats).map(r=>({id:r.id,points:r.points,rank:r.rank})),integrity:save.championship.entry?.condition[save.championship.entry.bikeId],checkpoint:!!save.championship.checkpoint}:null,payout:resultPayout, finish:{police:finishScene(race,localId(),finishElapsed,finishOfficer).police,stage:finishElapsed===null?'none':screen==='finish'?'camera':'result',elapsed:finishElapsed===null?null:+finishElapsed.toFixed(2),pullback:finishElapsed===null?0:+finishPullback(finishElapsed).toFixed(3),winnerId:finishWinner(race)?.id ?? null}, account:{signedIn:!!accounts.session?.account,status:accounts.status,pending:accounts.cache?.dirty ?? false,conflict:!!accounts.conflict,rankedRace:!!soloRecorder}, online: onlineMode?{status:online.status,syncing:online.syncing,id:online.id,code:online.code,phase:online.room?.phase,locked:online.room?.locked,deadline:online.room?.deadline,serverNow:online.serverNow(),members:online.room?.members,fillBots:online.room?.fillBots,public:online.room?.public,condition:online.room?.condition}:null, screen, paused, modal: document.querySelector('dialog[open]')?.id ?? null, mode: race.mode, coordinates: `x in metres: negative left, positive right; road ±${roadHalf(race.trackId)}. z forward in metres. speed m/s.`, road:{lanes:race.trackId==='terra'?2:4,halfWidth:roadHalf(race.trackId),surface:race.trackId==='terra'?'dirt':'asphalt'}, tick: race.tick, time: +race.time.toFixed(2), countdown: +race.countdown.toFixed(2), track: race.trackId, condition:raceCondition(race.condition), scenic:scenicAppearance(race), length: getTrack(race.trackId).distance, player: { recovery:p.recovery??null,helmetId:getHelmet(p.helmetId).id,helmetColorId:getHelmetColor(p.helmetColorId).id,weaponId:p.weaponId??null,weaponName:weaponName(p),wheeliesLeft:wheeliesLeft(p),wheelieTime:p.wheelieTime??0,jumpTime:p.jumpTime??0,jumpHeight:jumpHeight(p),jumpTarget:p.jumpTarget??null,kneePadId:p.kneePadId??null,kneeTime:p.kneeTime??0,wetKneeTime:(p.wetKneeTicks??0)*STEP,kneeSide:p.kneeSide??0,kneeSupport:kneeSupport(p,curveAt(p.z,race.trackId),race.trackId),nitro:p.nitro??0,nitroTime:p.nitroTime??0,nitroUsed:p.nitroUsed??0,speech:p.speech&&p.speech.until>race.time?TAUNTS[p.speech.index]:null,bikeId:getBike(p.bikeId).id,bike:getBike(p.bikeId).name,handling:p.handling,armor:p.armor,out:p.out ?? null, x: +p.x.toFixed(2), z: +p.z.toFixed(1), speed: +p.speed.toFixed(2), health: +p.health.toFixed(1), integrity: +p.integrity.toFixed(1), weapon: p.weapon, attack: p.attack, cooldown: +p.cooldown.toFixed(2), crash: p.recovery?p.crash:+p.crash.toFixed(2), immune: +p.immune.toFixed(2), hits: p.hits, falls: p.falls, place: ranking(onlineMode ? (online.room?.race ?? race) : race).findIndex(r => r.id === localId()) + 1 }, awareness:raceAwareness(race,localId()), corner:upcomingCorner(p.z,race.trackId,p.handling,race.condition,p.kneeTime!>0 && supportsKneeDown(p.bikeId)?p.kneePadId:undefined), curve: +curveAt(p.z, race.trackId).toFixed(2), target: target?.id ?? null, riders: race.riders.filter(r => r.id !== localId() && Math.abs(r.z - p.z) < 400).map(r => ({ id: r.id, name: r.name,helmetId:getHelmet(r.helmetId).id,helmetColorId:getHelmetColor(r.helmetColorId).id,weaponId:r.weaponId??null,wheeliesLeft:wheeliesLeft(r),wheelieTime:r.wheelieTime??0,jumpTime:r.jumpTime??0,jumpHeight:jumpHeight(r),kneePadId:r.kneePadId??null,kneeSupport:kneeSupport(r,curveAt(r.z,race.trackId),race.trackId),speech:r.speech&&r.speech.until>race.time?TAUNTS[r.speech.index]:null, bikeId:getBike(r.bikeId).id, x: +r.x.toFixed(1), dz: +(r.z - p.z).toFixed(1), speed: +r.speed.toFixed(1), health: +r.health.toFixed(1),recovery:r.recovery??null, weapon: r.weapon, attack: r.attack, crash: r.recovery?r.crash:+r.crash.toFixed(1) })), traffic: race.traffic.filter(t => t.z - p.z > -10 && t.z - p.z < 350).map(t => ({ id:t.id,kind:t.kind,x: t.x, dz: +(t.z - p.z).toFixed(1), direction: (t.heading ?? Math.sign(t.speed)) < 0 ? 'oncoming' : 'forward',queued:!!t.queued })), obstacles: race.obstacles.filter(o => o.z - p.z > -10 && o.z - p.z < 200).map(o => ({ id:o.id,kind: o.kind, x: o.x,width:o.width ?? null,moving:!!o.motion, dz: +(o.z - p.z).toFixed(1) })), heat: +race.heat.toFixed(1), police: race.policeActive, capture: +race.capture.toFixed(2), result: onlineMode?(race.multiplayer?.results[online.id] ?? null):race.result, save: { ownedHelmets:save.ownedHelmets??['integral'],helmetId:equippedHelmet(save).id,helmetColorId:getHelmetColor(save.helmetColorId).id,ownedWeapons:save.ownedWeapons??[],weaponId:save.weaponId??null,ownedKneePads:save.ownedKneePads??[],kneePadId:save.kneePadId??null,nitro:save.nitro??{},cash: save.cash, bike: save.bikeId, unlocked: save.unlocked, races: save.races } });
};
window.advanceTime = ms => { if(onlineMode){advanceFinish(ms/1000);draw();return;} testMode = true; for (let i = 0; i < Math.round(ms / (STEP * 1000)); i++) {update();advanceFinish(STEP);} draw(); };
if (testMode) window.__game = {
  snapshot: () => snapshot(race),
  restore: raw => { if(onlineMode)throw new Error('Use o servidor para testar uma corrida online.'); resetFinish();messageUntil=0;race = restoreSnapshot(raw); settled = false; screen = race.mode === 'finished' ? 'result' : 'race'; paused = false; closeDialogs(); $('menu').hidden = true; $('hud').hidden = false; draw(); },
  start: startRace,
  save: () => JSON.stringify(save),
  command: (cmd, frames) => { for (let i = 0; i < frames; i++) stepRace(race, { player: cmd }); syncSoloNitro();if (race.mode === 'finished') showResult(); draw(); },
};
document.addEventListener('click',e=>{if(startingRace){e.preventDefault();e.stopImmediatePropagation();}},true);
accountUI(accounts,()=>screen==='menu' && !online.active && !startingRace);
void accounts.refresh().then(()=>retryRankedResults());
syncSound(); renderMenu(); makeAttract(); draw(); requestAnimationFrame(frame);
void showVisitorCount($('visitor-count'), testMode);
if (testMode && new URLSearchParams(location.search).has('race')) startRace();

const invite=new URLSearchParams(location.search).get('sala');
if(online.resumeSaved()){onlineMode=true;openOnline();}
else if(invite){openOnline();$<HTMLInputElement>('online-code-input').value=invite.toUpperCase();}

function updateRecoveryGuide(){
 const guide=document.getElementById('recovery-guide');if(!guide)return;const p=localRider(),f=p.recovery;
 document.body.classList.toggle('on-foot',!!f && screen==='race');guide.hidden=!f || screen!=='race';
 const labels=document.querySelectorAll('.analog-control > span');if(labels[0])labels[0].textContent=f?'ESQUERDA / DIREITA':'VIRAR';if(labels[1])labels[1].textContent=f?'FRENTE / TRÁS':'ACELERAR / FREAR';
 if(!f)return;
 const dz=f.bikeZ-p.z,dx=f.bikeX-p.x,dist=Math.round(Math.hypot(dx,dz)),where=dz< -1?'ATRÁS':dz>1?'À FRENTE':dx<0?'À ESQUERDA':'À DIREITA';
 const status=f.phase==='exploding'?'A MOTO EXPLODIU!':f.phase==='sliding'?'DESLIZANDO…':f.phase==='gettingUp'?'LEVANTANDO…':f.phase==='mounting'?'PEGANDO A MOTO…':`SUA MOTO ESTÁ ${where} · ${dist}m`;
 guide.innerHTML=`${status}<small>${f.phase==='exploding'?'INTEGRIDADE ZERO · FIM DA CORRIDA':f.phase==='walking'?(matchMedia('(pointer: coarse)').matches?'Use os analógicos para buscar a moto':'W / ↑ frente · S / ↓ trás · A / D lados'):'Piloto e moto deslizam separados'}</small>`;
 setText('gear','A PÉ');
}
