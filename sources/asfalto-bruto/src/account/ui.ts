import { AccountClient, ApiError } from './client';
import { RACE_ROUTES } from '../game/routes';
import { clockString, getBike, money } from '../game/content';
import { loadSave } from '../game/save';
import type { RankingEntry } from './protocol';
import './style.css';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let googleScript:Promise<void>|undefined;
function loadGoogle(){
  return googleScript ??=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>resolve();script.onerror=()=>{googleScript=undefined;script.remove();reject(new Error('O Google não carregou. Confira sua conexão e tente novamente.'));};document.head.append(script);
  });
}
export function accountUI(client:AccountClient, canOpen:()=>boolean) {
  const entry=document.createElement('div');entry.className='community-row';entry.innerHTML='<div><button id="account-btn">CONTA ↗</button><button id="ranking-btn">RANKING ↗</button></div><small id="account-status" role="status"></small>';
  document.querySelector('.bike-line')!.after(entry);
  const dialog=document.createElement('dialog');dialog.id='account-modal';dialog.setAttribute('aria-labelledby','account-title');document.body.append(dialog);
  const board=document.createElement('dialog');board.id='ranking-modal';board.setAttribute('aria-labelledby','ranking-title');document.body.append(board);
  let displayMode='',request=0;
  function mode(){return client.conflict?'conflict':client.session?.account && !client.cache?'import':client.session?.account?'signed':'guest';}
  function update(){
    entry.querySelector('small')!.textContent=client.status;
    entry.querySelector('#account-btn')!.textContent=client.cache ? 'MINHA CONTA ↗':'CONTA ↗';
    const status=dialog.querySelector('[data-sync]');if(status)status.textContent=client.status;
    if(dialog.open && displayMode!==mode())render();
  }
  client.onChange(update);update();
  const header=(title:string,id:string)=>`<div class="dialog-header"><div><div class="eyebrow">SUA HISTÓRIA NA ESTRADA</div><h2 id="${id}">${title}</h2></div><button class="close-btn" aria-label="Fechar">×</button></div>`;
  async function act(fn:()=>Promise<unknown>){
    dialog.querySelectorAll<HTMLButtonElement>('button:not(.close-btn)').forEach(b=>b.disabled=true);
    try{await fn();render();}catch(e){dialog.querySelector('[data-error]')!.textContent=e instanceof Error?e.message:'Tente novamente.';dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);}
  }
  function render(){
    displayMode=mode();
    let body='';
    if(displayMode==='import'){
      const guest=loadSave();body=`<p>Como você quer começar sua conta?</p><div class="cloud-choice"><b>Garagem deste navegador</b><span>${money(guest.cash)} · ${guest.owned.length} moto(s) · ${guest.races} corrida(s)</span><button class="primary" data-import>LEVAR MEU PROGRESSO</button></div><button class="secondary" data-fresh>COMEÇAR UMA GARAGEM NOVA</button><p class="account-note">O progresso de convidado continuará guardado neste navegador. Recordes antigos continuam pessoais; o ranking conta novas corridas validadas.</p>`;
    }else if(displayMode==='conflict'){
      const local=client.cache!.save,cloud=client.conflict!;body=`<p>Os dois dispositivos jogaram desde a última sincronização. Escolha qual garagem deve continuar na conta.</p><div class="cloud-options"><div class="cloud-choice"><b>Este aparelho</b><span>${money(local.cash)} · ${local.owned.length} moto(s) · ${local.races} corrida(s)</span><button class="secondary" data-local>USAR ESTA GARAGEM</button></div><div class="cloud-choice"><b>Salva na conta</b><span>${money(cloud.save?.cash ?? 650)} · ${cloud.save?.owned.length ?? 1} moto(s) · ${cloud.save?.races ?? 0} corrida(s)</span><small>${new Date(cloud.updatedAt).toLocaleString('pt-BR')}</small><button class="primary" data-cloud>USAR A DA CONTA</button></div></div><p class="account-note">A escolha substitui a outra versão na conta. Créditos e consumíveis não são somados.</p>`;
    }else if(displayMode==='signed'){
      body=`<p>Suas motos, créditos e equipamentos acompanham esta conta no computador e no celular.</p><form id="nickname-form"><label for="account-nickname">APELIDO PÚBLICO NO RANKING</label><div class="nickname-row"><input id="account-nickname" maxlength="18" value="${escape(client.session!.account!.nickname)}" autocomplete="nickname" required><button class="secondary">SALVAR</button></div></form><p data-sync class="account-note">${escape(client.status)}</p><button class="secondary" data-refresh>SINCRONIZAR AGORA</button><button class="text-button" data-logout>SAIR DA CONTA NESTE APARELHO</button><p class="account-note">Ao sair, você volta à garagem de convidado. Alterações pendentes desta conta permanecem guardadas neste aparelho.</p>`;
    }else {
      body=`<p>Entre com o Google para levar sua garagem para outros dispositivos e participar dos rankings.</p>${client.cache?`<p>Há uma garagem de conta guardada neste aparelho. Entre na mesma conta para sincronizar.</p>`:''}<div id="google-button"></div><p data-sync class="account-note">${escape(client.status)}</p>${!client.session?.clientId?'<p>O login Google está sendo configurado. Você pode continuar jogando como convidado.</p>':''}<button class="secondary" data-refresh>TENTAR CONECTAR</button>${client.cache?'<button class="text-button" data-logout>VOLTAR AO CONVIDADO</button>':''}`;
    }
    dialog.innerHTML=header('Sua conta','account-title')+`<div class="dialog-body account-body">${body}<p data-error role="alert"></p><details class="account-privacy"><summary>Privacidade e progresso</summary><p>Usamos o identificador da conta Google para reconhecer você. O jogo não guarda seu e-mail, foto nem nome real. Apenas o apelido escolhido e os resultados aparecem no ranking. O progresso é salvo na nossa VPS, com uma cópia neste aparelho.</p><a href="./privacidade.html" target="_blank" rel="noopener">Política de privacidade ↗</a></details></div>`;
    dialog.querySelector('.close-btn')!.addEventListener('click',()=>dialog.close());
    dialog.querySelector('[data-import]')?.addEventListener('click',()=>void act(()=>client.chooseInitial(true)));
    dialog.querySelector('[data-fresh]')?.addEventListener('click',()=>void act(()=>client.chooseInitial(false)));
    dialog.querySelector('[data-local]')?.addEventListener('click',()=>void act(()=>client.resolve(true)));
    dialog.querySelector('[data-cloud]')?.addEventListener('click',()=>void act(()=>client.resolve(false)));
    dialog.querySelector('[data-logout]')?.addEventListener('click',()=>void act(()=>client.logout()));
    dialog.querySelector('[data-refresh]')?.addEventListener('click',()=>void act(()=>client.refresh()));
    dialog.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();void act(async()=>{const result=await client.api('/nickname',{nickname:dialog.querySelector<HTMLInputElement>('input')!.value});client.session!.account!.nickname=result.nickname;if(client.cache)client.cache.account.nickname=result.nickname;});});
    if(displayMode==='guest' && client.session?.clientId)void loadGoogle().then(()=>{
      const target=dialog.querySelector('#google-button');if(!target)return;
      const google=(window as any).google.accounts.id;
      google.initialize({client_id:client.session!.clientId,nonce:(client.session as any).nonce,auto_select:false,callback:(response:{credential:string})=>void act(()=>client.login(response.credential))});
      google.renderButton(target,{type:'standard',theme:'outline',size:'large',text:'signin_with',locale:'pt-BR',width:Math.min(320,dialog.clientWidth-60)});
    }).catch(e=>{const error=dialog.querySelector('[data-error]');if(error)error.textContent=e.message;});
  }
  entry.querySelector('#account-btn')!.addEventListener('click',async()=>{if(!canOpen())return;render();dialog.showModal();await client.refresh();render();});
  async function ranking(){
    const sequence=++request,route=RACE_ROUTES.find(r=>r.id===(board.querySelector('#rank-route') as HTMLSelectElement).value)!;
    const mode=(board.querySelector('#rank-mode') as HTMLSelectElement).value,order=(board.querySelector('#rank-order') as HTMLSelectElement).value;
    const target=board.querySelector('[data-ranking]')!;target.textContent='Buscando pilotos…';
    try{
      const data=await client.api(`/ranking?mode=${mode}&track=${route.track.id}&condition=${route.condition.id}&order=${order}`);
      if(sequence!==request)return;
      const rows=data.entries as RankingEntry[];
      target.innerHTML=rows.length?`<div class="rank-table"><table><thead><tr><th># / PILOTO</th><th>${order==='points'?'PONTOS':'TEMPO'}</th><th>MOTO</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.me?'me':''}"><td><b>${r.rank}. ${escape(r.nickname)}${r.me?' (você)':''}</b><small>${r.races} corrida(s) · ${r.points} pts</small></td><td>${order==='points'?r.points:clockString(r.time)}</td><td>${escape(getBike(r.bikeId).name)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ranking-empty">A estrada ainda não tem recordista.<small>Entre na sua conta e conclua uma corrida para deixar sua marca.</small></div>';
    }catch{if(sequence===request)target.textContent='Não foi possível carregar. Use Atualizar para tentar novamente.';}
  }
  entry.querySelector('#ranking-btn')!.addEventListener('click',()=>{
    if(!canOpen())return;
    board.innerHTML=header('Ranking permanente','ranking-title')+`<div class="dialog-body account-body"><div class="ranking-filters"><label>MODALIDADE<select id="rank-mode"><option value="solo">Individual</option><option value="multi">Multiplayer</option></select></label><label>CLASSIFICAÇÃO<select id="rank-order"><option value="time">Melhor tempo</option><option value="points">Pontos acumulados</option></select></label><label class="rank-route">PISTA<select id="rank-route">${RACE_ROUTES.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select></label></div><p class="account-note">Melhor tempo de cada piloto por pista e condição. Pontos por chegada: 25, 18, 15, 12, 10, 8, 6 e 4. Individual e multiplayer competem separados.</p><div data-ranking role="status"></div><button class="text-button" data-rank-refresh>ATUALIZAR ↻</button></div>`;
    board.querySelector('.close-btn')!.addEventListener('click',()=>board.close());board.querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>void ranking()));board.querySelector('[data-rank-refresh]')!.addEventListener('click',()=>void ranking());
    board.showModal();void ranking();
  });
}
