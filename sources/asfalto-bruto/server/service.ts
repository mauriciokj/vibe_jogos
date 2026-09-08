import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { finishRider } from '../src/game/simulation';
import { cleanAttacks, cleanCommand, NET_VERSION, RECONNECT_MS, type ServerMessage } from '../src/multiplayer/protocol';
import { depart, inputKey, joinRoom, lobbyClock, makeMember, makeRoom, pulseRoom, secret, setReady, viewRoom, type Inputs, type Member, type Room, type StoredInput } from './room';
import { BusyRoom, MemoryStore, type RoomStore } from './store';

interface Peer { ws: WebSocket; code: string; id: string; epoch: string; seq: number; pending?: StoredInput; latestInput?: StoredInput; writing: boolean; lastSeen: number; alive: boolean; }
export function createGameServer(store: RoomStore, options: { origins?: string[]; now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  const peers = new Set<Peer>();
  const revisions = new Map<string,number>();
  const pumping = new Set<string>();
  const latest = new Map<string,Room>();
  const limits = new Map<string,{ at: number; count: number }>();
  const server = createServer((req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('Content-Type','application/json');
    res.statusCode = 200; res.end(JSON.stringify({service:'asfalto-bruto',version:NET_VERSION,multiplayer:true,sharedRooms:store.shared,region:process.env.VERCEL_REGION ?? 'local'}));
  });
  const wss = new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head) => {
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const allowed = !origin || origin === `https://${host}` || origin === `http://${host}` || options.origins?.includes(origin);
    if (!allowed || peers.size >= 256) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    const ip = req.socket.remoteAddress ?? 'unknown';
    const limit = limits.get(ip) ?? {at:now(),count:0};
    if (now()-limit.at > 60_000) { limit.at = now(); limit.count = 0; }
    limits.set(ip,limit);
    if (++limit.count > 80) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req,socket,head,ws => wss.emit('connection',ws,req));
  });
  function send(peer: Peer, message: ServerMessage) {
    if (peer.ws.readyState !== WebSocket.OPEN) return;
    if (peer.ws.bufferedAmount > 512_000) { peer.ws.close(1013,'Conexão lenta'); return; }
    peer.ws.send(JSON.stringify(message));
  }
  function broadcast(room: Room) {
    latest.set(room.code,room);
    if ((revisions.get(room.code) ?? -1) >= room.revision) return;
    revisions.set(room.code,room.revision);
    const message: ServerMessage = {type:'state',room:viewRoom(room,now())};
    for (const peer of peers) if (peer.code === room.code) send(peer,message);
  }
  async function flush(peer: Peer) {
    if (peer.writing || !peer.code) return;
    peer.writing = true;
    try {
      while (peer.pending && peer.code) {
        const pending = peer.pending; peer.pending = undefined;
        await store.input(peer.code,`${peer.id}:${peer.epoch}`,pending);
      }
    } catch { send(peer,{type:'error',message:'A conexão com a sala está instável. Reconectando…'}); peer.ws.close(1013); }
    finally { peer.writing = false; }
  }
  async function attach(peer: Peer, room: Room, member: Member) {
    if (peer.ws.readyState !== WebSocket.OPEN) { await store.mutate(room.code,r=>depart(r,member.id,member.epoch,now())).catch(()=>{}); return; }
    peer.code = room.code; peer.id = member.id; peer.epoch = member.epoch; peer.seq = room.ack[member.id] ?? 0;
    send(peer,{type:'welcome',id:member.id,token:member.token,room:viewRoom(room,now())}); broadcast(room);
  }
  wss.on('connection',ws => {
    const peer: Peer = {ws,code:'',id:'',epoch:'',seq:0,writing:false,lastSeen:now(),alive:true}; peers.add(peer);
    let busy = false, messages = 0, windowStart = now();
    ws.on('pong',()=> { peer.alive = true; peer.lastSeen = now(); });
    ws.on('message',async raw => {
      if (now()-windowStart > 1000) { messages = 0; windowStart = now(); }
      if (++messages > 100) { ws.close(1008,'Muitas mensagens'); return; }
      let data;
      try { data = JSON.parse(raw.toString()); } catch { send(peer,{type:'error',message:'Mensagem inválida.'}); return; }
      if (!data || typeof data !== 'object') return;
      peer.lastSeen = now();
      if (data.type === 'ping') { send(peer,{type:'pong',sentAt:Number(data.sentAt)||0,serverNow:now()}); return; }
      if (data.type === 'input') {
        const command = cleanCommand(data.command), attacks=cleanAttacks(data.attacks);
        if (!peer.code || !command || !attacks || !Number.isSafeInteger(data.seq) || data.seq <= peer.seq) return;
        peer.seq = data.seq; peer.pending = peer.latestInput = {seq:data.seq,command,attacks,at:now()};
        void flush(peer);return;
      }
      if (busy) return; busy = true;
      try {
        if (['create','join','resume'].includes(data.type)) {
          if (peer.code) throw new Error('Você já está em uma sala.');
          if (data.version !== NET_VERSION) throw new Error('Atualize a página para entrar nesta versão.');
          if (data.type === 'create') {
            const member = makeMember(data.name,now()); let room: Room;
            do { room = makeRoom(randomBytes(4).toString('hex').slice(0,6).toUpperCase(),data.trackId,member,now()); } while (!await store.create(room));
            await attach(peer,room,member);
          } else {
            const code = String(data.code ?? '').toUpperCase();
            if (!/^[A-F0-9]{6}$/.test(code)) throw new Error('Digite o código de 6 caracteres da sala.');
            let member = makeMember(data.name,now());
            const room = await store.mutate(code,r => {
              if (data.type === 'join') joinRoom(r,member,now());
              else {
                const found = r.members.find(m => typeof data.token === 'string' && m.token === data.token);
                if (!found || (now()-found.lastSeen > RECONNECT_MS && r.phase === 'lobby')) throw new Error('Sua vaga expirou. Entre novamente.');
                if(r.race && now()-found.lastSeen > RECONNECT_MS) {
                  const rider=r.race.riders.find(p=>p.id===found.id);if(rider)finishRider(r.race,rider,'left');
                }
                found.connected = true; found.lastSeen = now(); found.epoch = secret(); member = found;
                lobbyClock(r,now());
              }
            });
            await attach(peer,room,member);
          }
        } else if (data.type === 'ready' && peer.code && typeof data.ready === 'boolean') {
          broadcast(await store.mutate(peer.code,r => setReady(r,peer.id,peer.epoch,data.ready,now())));
        } else if (data.type === 'leave' && peer.code) {
          const code = peer.code; peer.code = ''; peer.pending = undefined;
          broadcast(await store.mutate(code,r => depart(r,peer.id,peer.epoch,now(),true)));
          send(peer,{type:'left'});
        }
      } catch (error) {
        const message=error instanceof Error && !(error instanceof TypeError) ? error.message : 'Não foi possível entrar na sala.';
        const fatal=data.type==='resume' && /vaga expirou|não encontrada|Atualize/.test(message);
        send(peer,{type:'error',message,fatal});
        if(data.type==='resume' && !fatal)peer.ws.close(1013);
      }
      finally { busy = false; }
    });
    ws.on('close',()=> {
      peers.delete(peer); peer.pending = undefined;
      if (peer.code) void store.mutate(peer.code,r=>depart(r,peer.id,peer.epoch,now())).then(broadcast).catch(()=>{});
    });
    ws.on('error',()=>{});
  });
  async function pump(code: string) {
    if (pumping.has(code)) return;
    pumping.add(code);
    try {
      const inputs:Inputs={};
      for(const p of peers)if(p.code===code && p.latestInput)inputs[`${p.id}:${p.epoch}`]=p.latestInput;
      broadcast(await store.mutate(code,(r,inputs)=>pulseRoom(r,inputs,now()),0,inputs));
    }
    catch (e) {
      if (e instanceof BusyRoom) { const room = await store.read(code).catch(()=>null); if (room) broadcast(room); }
      else for (const peer of peers) if (peer.code === code) { send(peer,{type:'error',message:'Não foi possível sincronizar a sala. Reconectando…'}); peer.ws.close(1013); }
    } finally { pumping.delete(code); }
  }
  let cycles = 0;
  const timer = setInterval(()=> {
    cycles++;
    for (const peer of peers) void flush(peer);
    const codes = new Set([...peers].map(p=>p.code).filter(Boolean));
    for (const code of codes) if (latest.get(code)?.phase === 'racing' || latest.get(code)?.locked || cycles%10===0) void pump(code);
    if (cycles%100===0) {
      for (const peer of peers) {
        if (!peer.alive || (!peer.code && now()-peer.lastSeen > 20_000)) { peer.ws.terminate(); continue; }
        peer.alive = false; peer.ws.ping();
        if (peer.code && latest.get(peer.code)?.phase === 'lobby') void store.mutate(peer.code,r=> {
          const m=r.members.find(m=>m.id===peer.id && m.epoch===peer.epoch); if(m){m.lastSeen=now();m.connected=true;}
        }).then(broadcast).catch(()=>{});
      }
      for (const code of latest.keys()) if (!codes.has(code)) { latest.delete(code); revisions.delete(code); }
      for (const [ip,l] of limits) if (now()-l.at>60_000) limits.delete(ip);
      if (store instanceof MemoryStore) store.sweep(now());
    }
  },50);
  timer.unref();
  return {server,wss, async close() { clearInterval(timer); for (const p of peers) p.ws.terminate(); await new Promise<void>(resolve=>wss.close(()=>resolve())); await new Promise<void>(resolve=>server.close(()=>resolve())); await store.close(); }};
}
