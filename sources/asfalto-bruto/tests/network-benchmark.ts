import {WebSocket} from 'ws';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import {NET_VERSION} from '../src/multiplayer/protocol';

const url=process.env.ASFALTO_BENCH_URL || 'wss://vibe-jogos-git-codex-asfalto-bruto-online-mauriciokjs-projects.vercel.app/api/asfalto/';
const duration=Number(process.env.ASFALTO_BENCH_MS || 8000);
const output=process.env.ASFALTO_BENCH_OUTPUT || 'output/latency/before.json';
const count=Number(process.env.ASFALTO_BENCH_PLAYERS || 2);
const trackId=process.env.ASFALTO_BENCH_TRACK || 'costa';
const fillBots=process.env.ASFALTO_BENCH_BOTS==='1';
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const stats=(values:number[])=>{const v=values.slice().sort((a,b)=>a-b);return {count:v.length,min:v[0],p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1)};};
class Peer {
  ws=new WebSocket(url);id='';room:any;messages:any[]=[];
  sent=new Map<number,number>();lastAt=0;lastTick=-1;ack=0;
  gaps:number[]=[];lag:number[]=[];rtt:number[]=[];age:number[]=[];sizes:number[]=[];
  constructor(){this.ws.on('message',raw=>{
    const m=JSON.parse(String(raw));this.messages.push(m);if(this.messages.length>100)this.messages.shift();
    if(m.type==='welcome')this.id=m.id;
    if(m.type==='pong')this.rtt.push(performance.now()-m.sentAt);
    if(m.room){this.room=m.room;if(m.room.phase==='racing'){
      const now=performance.now();
      if(m.room.race.tick>this.lastTick){if(this.lastAt)this.gaps.push(now-this.lastAt);this.lastAt=now;this.lastTick=m.room.race.tick;this.age.push(m.room.serverNow-m.room.simulationAt);this.sizes.push(Buffer.byteLength(String(raw)));}
      const ack=m.room.ack[this.id];if(ack>this.ack){const sent=this.sent.get(ack);if(sent!==undefined)this.lag.push(now-sent);this.ack=ack;}
    }}
  });}
  send(message:unknown){this.ws.send(JSON.stringify(message));}
  async wait(predicate:()=>boolean,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){if(predicate())return;await delay(10);}throw new Error('Network benchmark timed out: '+JSON.stringify(this.messages.filter(m=>m.type==='error')));}
}
const peers:Peer[]=[];let timer:ReturnType<typeof setInterval>|undefined;
try {
  for(let i=0;i<count;i++){
    const p=new Peer();peers.push(p);await once(p.ws,'open');
    p.send(i?{type:'join',version:NET_VERSION,name:`Medição ${i+1}`,code:peers[0].room.code}:{type:'create',version:NET_VERSION,name:'Medição 1',trackId,fillBots});
    await p.wait(()=>!!p.id);
  }
  for(const p of peers)p.send({type:'ready',ready:true});
  await Promise.all(peers.map(p=>p.wait(()=>p.room?.phase==='racing')));
  let seq=0;timer=setInterval(()=>{
    seq++;for(const p of peers){p.sent.set(seq,performance.now());p.send({type:'input',seq,command:{throttle:1,brake:0,steer:0,attack:null},attacks:[]});if(seq%10===0)p.send({type:'ping',sentAt:performance.now()});}
  },50);
  await delay(duration);clearInterval(timer);
  const result={url,trackId,players:count,bots:fillBots?Math.max(0,8-count):0,durationMs:duration,peers:peers.map(p=>({snapshotGapMs:stats(p.gaps),snapshotAgeOnServerMs:stats(p.age),inputAckMs:stats(p.lag),rttMs:stats(p.rtt),snapshotBytes:stats(p.sizes)}))};
  await fs.mkdir(output.slice(0,output.lastIndexOf('/')),{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{clearInterval(timer);for(const p of peers){if(p.ws.readyState===WebSocket.OPEN)p.send({type:'leave'});p.ws.close();}}
