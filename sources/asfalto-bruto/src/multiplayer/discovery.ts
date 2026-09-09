import { conditionName } from '../game/conditions';
import { getTrack } from '../game/content';
import { NET_VERSION, type PublicRoomsResponse } from './protocol';

// Searching does not join a room or open the race's WebSocket connection.
export class PublicRoomBrowser {
  private timer?: ReturnType<typeof setTimeout>;
  private request?: AbortController;
  private busy = false;
  private signature = '';
  constructor(private panel: HTMLDetailsElement, private join: (code:string)=>void) {
    panel.addEventListener('toggle',()=>this.refresh());
    panel.closest('dialog')?.addEventListener('close',()=>this.stop());
    panel.querySelector('button')!.addEventListener('click',()=>this.refresh());
    document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.refresh());
  }
  private available() {
    return this.panel.open && !!this.panel.closest('dialog[open]') && !document.hidden && !this.busy && !this.panel.parentElement!.hidden;
  }
  setBusy(busy:boolean) {
    this.busy=busy;
    this.panel.querySelectorAll('button').forEach(b=>b.disabled=busy);
    if(busy)this.stop();else this.refresh();
  }
  stop() { clearTimeout(this.timer);this.request?.abort();this.request=undefined; }
  async refresh() {
    this.stop();if(!this.available())return;
    const request=new AbortController();this.request=request;
    const status=this.panel.querySelector<HTMLElement>('[data-public-status]')!;
    const list=this.panel.querySelector<HTMLElement>('[data-public-list]')!;
    if(!list.childElementCount)status.textContent='Procurando pilotos na estrada…';
    const endpoint=new URL(import.meta.env.VITE_MULTIPLAYER_URL || '/api/asfalto/',location.href);
    endpoint.protocol=endpoint.protocol==='wss:'?'https:':endpoint.protocol==='ws:'?'http:':endpoint.protocol;
    endpoint.searchParams.set('op','rooms');
    const timeout=setTimeout(()=>request.abort(),8000);
    try {
      const response=await fetch(endpoint,{cache:'no-store',signal:request.signal});
      if(!response.ok)throw new Error('Busca indisponível. Tente atualizar a lista.');
      const data=await response.json() as PublicRoomsResponse;
      if(data.version!==NET_VERSION)throw new Error('Atualize a página para encontrar partidas nesta versão.');
      if(!Array.isArray(data.rooms))throw new Error('Busca indisponível. Tente atualizar a lista.');
      if(this.request!==request || !this.available())return;
      status.textContent=data.rooms.length?'Escolha uma pista para entrar. A lista atualiza a cada 5 segundos.':'Nenhuma sala pública aberta agora. Crie uma abaixo e marque “Sala pública” para outros pilotos encontrarem você.';
      const signature=JSON.stringify(data.rooms);
      if(signature!==this.signature) {
        const focused=(document.activeElement as HTMLElement)?.dataset.publicRoom;
        list.replaceChildren();this.signature=signature;
        for(const room of data.rooms) {
          const row=document.createElement('div');row.className='public-room';
          const info=document.createElement('div');
          const title=document.createElement('b');title.textContent=`${getTrack(room.trackId).name} · ${conditionName(room.condition)}`;
          const detail=document.createElement('span');
          detail.textContent=`${room.players}/${room.maxPlayers} pessoas · ${room.fillBots?'com bots nas vagas livres':'sem bots'}`;
          const timing=document.createElement('small');timing.dataset.deadline=String(room.deadline ?? '');timing.dataset.players=String(room.players);
          const button=document.createElement('button');button.className='secondary';button.dataset.publicRoom=room.code;button.textContent='ENTRAR ↗';button.setAttribute('aria-label',`Entrar em ${title.textContent}, ${room.players} pessoas, sala ${room.code}`);
          button.addEventListener('click',()=>{if(!this.busy)this.join(room.code);});
          info.append(title,detail,timing);row.append(info,button);list.append(row);
        }
        if(focused)Array.from(list.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.dataset.publicRoom===focused)?.focus({preventScroll:true});
      }
      list.querySelectorAll<HTMLElement>('[data-deadline]').forEach(el=>{
        const seconds=el.dataset.deadline?Math.max(0,Math.ceil((Number(el.dataset.deadline)-data.serverNow)/1000)):0;
        el.textContent=Number(el.dataset.players)<2?'Aguardando outro piloto':`Largada em ${seconds}s · todos prontos: 5s`;
      });
    } catch(error) {
      if(this.request!==request || !this.available())return;
      this.signature='';list.replaceChildren();
      status.textContent=error instanceof Error && error.name!=='AbortError'?error.message:'A busca demorou demais. Tente atualizar a lista.';
    } finally {
      clearTimeout(timeout);
      if(this.request===request){this.request=undefined;if(this.available())this.timer=setTimeout(()=>this.refresh(),5000);}
    }
  }
}
