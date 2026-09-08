import { EMPTY_COMMAND, type AttackKind, type Command, type RaceState } from '../game/types';
import { NET_VERSION, RECONNECT_MS, type AttackInput, type ClientMessage, type RoomView, type ServerMessage } from './protocol';
import { RacePresentation } from './presentation';

type Connection = 'offline' | 'connecting' | 'connected' | 'reconnecting';
interface Hooks { room: (room: RoomView) => void; status: (status: Connection) => void; error: (message: string) => void; left: () => void; }
const sessionKey = `asfalto:online-session:v${NET_VERSION}:${location.pathname}`;
export class OnlineClient {
  id = ''; code = ''; token = ''; status: Connection = 'offline'; room: RoomView | null = null; rtt = 0;
  private ws?: WebSocket;
  private stopped = true;
  private reconnectStarted = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private sendTimer?: ReturnType<typeof setInterval>;
  private attacks: AttackInput[] = [];
  private attackSeq = 0;
  private seq = 0;
  private current: Command = EMPTY_COMMAND;
  private presentation?: RacePresentation;
  private offset = 0;
  private clockReady = false;
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
  create(name: string, trackId: string, fillBots = false, bikeId = 'ferro') { this.open({type:'create',version:NET_VERSION,name,trackId,fillBots,bikeId}); }
  join(name: string, code: string, bikeId = 'ferro') { this.open({type:'join',version:NET_VERSION,name,bikeId,code:code.trim().toUpperCase()}); }
  ready(ready: boolean) { this.send({type:'ready',ready}); }
  private send(message: ClientMessage) { if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(message)); }
  private sendInput() {
    if(this.status==='connected' && this.room?.phase==='racing')this.send({type:'input',seq:++this.seq,command:{...this.current,attack:null},attacks:this.attacks});
  }
  attack(kind: AttackKind) {
    const now=performance.now();
    if(this.status!=='connected' || this.room?.phase!=='racing' || this.attacks.length>=8 || !this.presentation?.canAttack(kind,now))return;
    const seq=++this.attackSeq;this.attacks.push({kind,seq});this.presentation.attack(kind,seq,now);this.sendInput();
  }
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
        this.sendInput();
        if(++ticks%40===0)this.send({type:'ping',sentAt:performance.now()});
      },50);
      this.send({type:'ping',sentAt:performance.now()});
    });
    ws.addEventListener('message',event=> {
      if(ws!==this.ws)return;
      let data: ServerMessage;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='welcome') {
        clearTimeout(this.connectTimer);this.reconnectStarted=0;
        if(this.id!==data.id || this.code!==data.room.code){this.attacks=[];this.attackSeq=0;this.seq=0;this.presentation=new RacePresentation(data.id);this.room=null;}
        this.id=data.id;this.code=data.room.code;this.token=data.token;
        this.seq=Math.max(this.seq,data.room.ack[this.id] ?? 0);this.persistSession();this.setStatus('connected');this.accept(data.room);
      } else if(data.type==='state')this.accept(data.room);
      else if(data.type==='pong') {
        const sample=Math.max(0,performance.now()-data.sentAt);this.rtt=this.rtt?this.rtt*.75+sample*.25:sample;
        const offset=data.serverNow+sample/2-Date.now();
        this.offset=!this.clockReady || Math.abs(offset-this.offset)>1000?offset:this.offset+(offset-this.offset)*.15;
        this.clockReady=true;
      }
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
    const clock=room.serverNow+this.rtt/2-Date.now();
    if(!this.clockReady || Math.abs(clock-this.offset)>1000)this.offset=clock;
    this.room=room;
    const ack=room.attackAck[this.id] ?? 0;
    this.attacks=this.attacks.filter(a=>a.seq>ack);this.attackSeq=Math.max(this.attackSeq,ack);
    this.presentation?.accept(room,performance.now(),this.serverNow());
    this.hooks.room(room);
  }
  step(command: Command) {
    if(!this.room?.race || this.room.phase!=='racing' || this.status!=='connected')return;
    const changed=command.throttle!==this.current.throttle || command.brake!==this.current.brake || command.steer!==this.current.steer;
    this.current=command;this.presentation?.control(command,performance.now());
    if(changed)this.sendInput();
    if(command.attack)this.attack(command.attack);
  }
  view(): RaceState | null {
    return this.presentation?.view(performance.now()) ?? null;
  }
  leave(notify=true) { if(notify)this.send({type:'leave'});this.stop(true);this.forgetSession();this.hooks.left(); }
  private stop(clear: boolean) {
    this.stopped=true;clearTimeout(this.reconnectTimer);clearTimeout(this.connectTimer);clearInterval(this.sendTimer);this.ws?.close();this.ws=undefined;this.setStatus('offline');
    if(clear){this.id='';this.code='';this.token='';this.room=null;this.presentation=undefined;this.attacks=[];this.seq=0;this.attackSeq=0;this.current=EMPTY_COMMAND;this.clockReady=false;}
  }
}
