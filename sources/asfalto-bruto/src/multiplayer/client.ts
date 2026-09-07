import { predictMovement } from '../game/simulation';
import { EMPTY_COMMAND, type Command, type RaceState, type Rider } from '../game/types';
import { NET_VERSION, RECONNECT_MS, type ClientMessage, type RoomView, type ServerMessage } from './protocol';

type Connection = 'offline' | 'connecting' | 'connected' | 'reconnecting';
interface Hooks { room: (room: RoomView) => void; status: (status: Connection) => void; error: (message: string) => void; left: () => void; }
const sessionKey = `asfalto:online-session:${location.pathname}`;
export class OnlineClient {
  id = ''; code = ''; token = ''; status: Connection = 'offline'; room: RoomView | null = null; rtt = 0;
  private ws?: WebSocket;
  private stopped = true;
  private reconnectStarted = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private sendTimer?: ReturnType<typeof setInterval>;
  private pending: {seq: number; command: Command}[] = [];
  private seq = 0;
  private current: Command = EMPTY_COMMAND;
  private predicted?: Rider;
  private before: RaceState | null = null;
  private receivedAt = performance.now();
  private offset = 0;
  private correction = {x:0,z:0};
  constructor(private hooks: Hooks) {}
  get active() { return !this.stopped; }
  serverNow() { return Date.now()+this.offset; }
  private setStatus(status: Connection) { this.status=status; this.hooks.status(status); }
  private persistSession() { try { sessionStorage.setItem(sessionKey,JSON.stringify({code:this.code,token:this.token})); } catch {} }
  private forgetSession() { try { sessionStorage.removeItem(sessionKey); } catch {} }
  resumeSaved(): boolean {
    try { const s=JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null'); if(s?.code && s?.token){this.code=s.code;this.token=s.token;this.open({type:'resume',version:NET_VERSION,code:s.code,token:s.token});return true;} } catch {}
    return false;
  }
  create(name: string, trackId: string) { this.open({type:'create',version:NET_VERSION,name,trackId}); }
  join(name: string, code: string) { this.open({type:'join',version:NET_VERSION,name,code:code.trim().toUpperCase()}); }
  ready(ready: boolean) { this.send({type:'ready',ready}); }
  private send(message: ClientMessage) { if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(message)); }
  private open(message: ClientMessage) {
    clearTimeout(this.reconnectTimer); clearTimeout(this.connectTimer); clearInterval(this.sendTimer);
    this.ws?.close(); this.stopped=false;
    this.setStatus(message.type==='resume'?'reconnecting':'connecting');
    const endpoint = new URL(import.meta.env.VITE_MULTIPLAYER_URL || '/api/asfalto/',location.href);
    endpoint.protocol=endpoint.protocol==='https:'?'wss:':endpoint.protocol==='http:'?'ws:':endpoint.protocol;
    const ws=new WebSocket(endpoint);this.ws=ws;
    this.connectTimer=setTimeout(()=>{if(ws===this.ws && this.status!=='connected'){this.hooks.error('Servidor online indisponível. Você pode continuar no modo individual.');ws.close();}},8000);
    ws.addEventListener('open',()=> {
      if(ws!==this.ws)return;this.send(message);
      let ticks=0;
      this.sendTimer=setInterval(()=> {
        if(this.room?.phase==='racing' && this.id)this.send({type:'input',seq:this.seq,command:this.current});
        if(++ticks%40===0)this.send({type:'ping',sentAt:performance.now()});
      },50);
      this.send({type:'ping',sentAt:performance.now()});
    });
    ws.addEventListener('message',event=> {
      if(ws!==this.ws)return;
      let data: ServerMessage;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='welcome') {
        clearTimeout(this.connectTimer);this.reconnectStarted=0;
        if(this.id!==data.id || this.code!==data.room.code){this.pending=[];this.predicted=undefined;this.seq=0;this.before=null;this.room=null;}
        this.id=data.id;this.code=data.room.code;this.token=data.token;
        this.seq=Math.max(this.seq,data.room.ack[this.id] ?? 0);this.persistSession();this.setStatus('connected');this.accept(data.room);
      } else if(data.type==='state')this.accept(data.room);
      else if(data.type==='pong') {this.rtt=Math.max(0,performance.now()-data.sentAt);this.offset=data.serverNow+this.rtt/2-Date.now();}
      else if(data.type==='left')this.leave(false);
      else if(data.type==='error') {this.hooks.error(data.message);if(data.fatal || !this.id){this.stop(false);this.forgetSession();}}
    });
    ws.addEventListener('close',()=> {
      if(ws!==this.ws || this.stopped)return;clearInterval(this.sendTimer);clearTimeout(this.connectTimer);
      if(!this.code || !this.token){this.setStatus('offline');this.stopped=true;this.hooks.error('Não foi possível conectar ao multiplayer. Tente novamente.');return;}
      this.reconnectStarted ||= performance.now();
      if(performance.now()-this.reconnectStarted>RECONNECT_MS){this.stop(false);this.forgetSession();this.hooks.error('A reconexão expirou. Volte ao menu para entrar em outra sala.');return;}
      this.setStatus('reconnecting');this.reconnectTimer=setTimeout(()=>this.open({type:'resume',version:NET_VERSION,code:this.code,token:this.token}),750);
    });
    ws.addEventListener('error',()=>{});
  }
  private accept(room: RoomView) {
    if(this.room?.code===room.code && this.room.revision>=room.revision)return;
    this.offset=room.serverNow+this.rtt/2-Date.now();
    this.before=this.room?.race ?? null;this.room=room;this.receivedAt=performance.now();
    const authoritative=room.race?.riders.find(r=>r.id===this.id);
    if(authoritative && room.race) {
      const previous=this.predicted;
      this.pending=this.pending.filter(i=>i.seq>(room.ack[this.id] ?? 0)).slice(-12);
      this.predicted={...authoritative};
      if(!authoritative.out && authoritative.finishedAt===null)for(const input of this.pending)predictMovement(room.race,this.predicted,input.command);
      this.correction={x:0,z:0};
      if(previous && previous.crash===0 && authoritative.crash===0 && !authoritative.out && Math.abs(previous.z-this.predicted.z)<10) {
        this.correction={x:previous.x-this.predicted.x,z:previous.z-this.predicted.z};
      }
    }
    this.hooks.room(room);
  }
  step(command: Command) {
    if(!this.room?.race || this.room.phase!=='racing' || this.status!=='connected')return;
    this.current=command;this.seq++;this.pending.push({seq:this.seq,command});if(this.pending.length>60)this.pending.shift();
    if(this.predicted)predictMovement(this.room.race,this.predicted,command);
    this.correction.x*=.76;this.correction.z*=.76;
  }
  view(): RaceState | null {
    const race=this.room?.race;if(!race)return null;
    const age=Math.max(0,performance.now()-this.receivedAt),blend=Math.min(1,age/50);
    const lead=Math.min(.1,(age+this.rtt/2)/1000);
    return {...race,riders:race.riders.map(r=> {
      if(r.id===this.id && this.predicted)return {...this.predicted,x:this.predicted.x+this.correction.x,z:this.predicted.z+this.correction.z};
      const prev=this.before?.riders.find(p=>p.id===r.id);
      return {...r,x:prev && !r.crash && !r.out ? prev.x+(r.x-prev.x)*blend : r.x,z:r.z+(!r.out && !r.crash && r.finishedAt===null?r.speed*lead:0)};
    }),traffic:race.traffic.map(t=>({...t,z:t.z+t.speed*lead}))};
  }
  leave(notify=true) { if(notify)this.send({type:'leave'});this.stop(true);this.forgetSession();this.hooks.left(); }
  private stop(clear: boolean) {
    this.stopped=true;clearTimeout(this.reconnectTimer);clearTimeout(this.connectTimer);clearInterval(this.sendTimer);this.ws?.close();this.ws=undefined;this.setStatus('offline');
    if(clear){this.id='';this.code='';this.token='';this.room=null;this.predicted=undefined;this.before=null;this.pending=[];this.seq=0;}
  }
}
