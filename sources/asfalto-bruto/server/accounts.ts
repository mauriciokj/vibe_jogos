import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { AccountsDB, hash, token } from './accounts-db';
import { googleVerifier } from './google';
import { ACCOUNT_API, RANK_RULES, type RankedRun, type ReplaySegment } from '../src/account/protocol';
import { normalizeSave } from '../src/game/save';
import { TRACKS } from '../src/game/content';
import { CONDITIONS } from '../src/game/conditions';
import { createRace, stepRace } from '../src/game/simulation';
import { cleanCommand, cleanName } from '../src/multiplayer/protocol';
import type { Room } from './room';

class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
function fail(status:number,message:string):never{throw new HttpError(status,message);}
const cookie=(req:IncomingMessage,name:string)=>(req.headers.cookie ?? '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1) ?? '';
export interface AccountOptions { db:AccountsDB; clientId:string; origins:string[]; secure?:boolean; now?:()=>number; verify?:(credential:string,nonce:string)=>Promise<string>; }
export class AccountService {
  readonly db:AccountsDB; private verify; private now; private secure;
  private challenges=new Map<string,{nonce:string;csrf:string;expires:number}>();
  private limits=new Map<string,{at:number;count:number}>();
  private verifying=false;
  private recorded=new Set<string>();
  constructor(private options:AccountOptions){this.db=options.db;this.verify=options.verify ?? googleVerifier(options.clientId);this.now=options.now ?? Date.now;this.secure=options.secure!==false;}
  private cookieName(name:string){return `${this.secure?'__Host-':''}ab_${name}`;}
  private setCookie(res:ServerResponse,name:string,value:string,seconds:number){res.setHeader('Set-Cookie',`${this.cookieName(name)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${this.secure?'; Secure':''}`);}
  identity(req:IncomingMessage){return this.db.authenticate(cookie(req,this.cookieName('session')),this.now());}
  async handle(req:IncomingMessage,res:ServerResponse) {
    const url=new URL(req.url ?? '/', 'http://internal');
    if(!url.pathname.startsWith(ACCOUNT_API))return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
    const send=(data:unknown,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
    try {
      const route=url.pathname.slice(ACCOUNT_API.length),method=req.method;
      const identity=this.identity(req);
      if(method==='GET' && route==='/session') {
        let csrf=identity?.csrf ?? '',nonce='';
        if(!identity && this.options.clientId){
          for(const [k,c] of this.challenges)if(c.expires<this.now())this.challenges.delete(k);
          const pending=this.challenges.get(hash(cookie(req,this.cookieName('login'))));
          if(pending){nonce=pending.nonce;csrf=pending.csrf;}
          else {
            if(this.challenges.size>=2048)fail(429,'Muitos acessos. Tente em alguns minutos.');
            const key=token();nonce=token();csrf=token();
            this.challenges.set(hash(key),{nonce,csrf,expires:this.now()+600_000});this.setCookie(res,'login',key,600);
          }
        }
        send({account:identity?.account ?? null,cloud:identity?this.db.cloud(identity.account.id):undefined,csrf,nonce,clientId:this.options.clientId});return true;
      }
      if(method==='GET' && route==='/ranking') {
        const mode=url.searchParams.get('mode')==='multi'?'multi':'solo',track=url.searchParams.get('track') ?? 'costa',condition=url.searchParams.get('condition') ?? 'sunset';
        const rules=url.searchParams.get('rules')==='1'?1:RANK_RULES;
        send({entries:this.db.ranking(mode,track,condition,url.searchParams.get('order') ?? 'time',identity?.account.id,rules),rules});return true;
      }
      if(method!=='POST')fail(405,'Operação não disponível.');
      if(!this.options.origins.includes(req.headers.origin ?? '') || !req.headers['content-type']?.startsWith('application/json'))fail(403,'Origem não permitida.');
      const ip=identity?.account.id ?? req.socket.remoteAddress ?? '';
      const limit=this.limits.get(ip) ?? {at:this.now(),count:0};
      if(this.now()-limit.at>60_000){limit.at=this.now();limit.count=0;}
      for(const [key,value] of this.limits)if(this.now()-value.at>60_000)this.limits.delete(key);
      this.limits.set(ip,limit);if(++limit.count>(identity?120:30))fail(429,'Muitas solicitações. Aguarde um minuto.');
      const login=this.challenges.get(hash(cookie(req,this.cookieName('login'))));
      const csrf=route==='/login'?login?.csrf:identity?.csrf;
      if(!csrf || req.headers['x-asfalto-csrf']!==csrf)fail(403,'Atualize a conta para continuar.');
      let bytes=0;const chunks:Buffer[]=[];
      for await(const chunk of req){bytes+=chunk.length;if(bytes>(route==='/finish'?4_000_000:route==='/save'?128_000:32_000))fail(413,'Envio muito grande.');chunks.push(chunk);}
      let body:any;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'Dados inválidos.');}
      if(!body || typeof body!=='object')fail(400,'Dados inválidos.');
      if(route==='/login') {
        if(!this.options.clientId || !login || login.expires<this.now() || typeof body.credential!=='string' || body.credential.length>12000)fail(401,'Entre novamente com o Google.');
        this.challenges.delete(hash(cookie(req,this.cookieName('login'))));
        let subject;try{subject=await this.verify(body.credential,login.nonce);}catch{fail(401,'Não foi possível confirmar sua conta Google. Tente novamente.');}
        const account=this.db.login(subject!,this.now()),session=this.db.session(account.id,this.now());
        this.setCookie(res,'session',session.value,30*86400);
        send({account,cloud:this.db.cloud(account.id),csrf:session.csrf,clientId:this.options.clientId});return true;
      }
      if(!identity)fail(401,'Entre com o Google para continuar.');
      const id=identity.account.id;
      if(route==='/logout'){this.db.logout(cookie(req,this.cookieName('session')));this.setCookie(res,'session','',0);send({ok:true});}
      else if(route==='/nickname') {const nickname=cleanName(body.nickname);this.db.rename(id,nickname);send({nickname});}
      else if(route==='/save') {
        if(!Number.isSafeInteger(body.revision) || body.revision<0 || typeof body.request!=='string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.request) || body.save?.version!==1)fail(400,'Salvamento inválido.');
        const result=this.db.save(id,body.revision,body.save,body.request,this.now());send(result,result.ok?200:409);
      } else if(route==='/start') {
        const cloud=this.db.cloud(id);
        if(body.revision!==cloud.revision){send({error:'O progresso da conta mudou. Sincronize antes de entrar no ranking.',cloud},409);return true;}
        if(!cloud.save)fail(409,'Escolha seu progresso na conta antes de correr.');
        const track=TRACKS.find(t=>t.id===body.trackId),condition=CONDITIONS.find(c=>c.id===body.condition);
        if(!track || !condition || track.index>cloud.save!.unlocked)fail(400,'Pista indisponível.');
        const run:RankedRun={id:token(),seed:randomBytes(4).readUInt32LE(),save:cloud.save!,trackId:track.id,condition:condition.id,rules:RANK_RULES};
        this.db.startRun(id,run,this.now());send(run);
      } else if(route==='/finish') {
        const stored=typeof body.id==='string'?this.db.run(body.id,id):null;
        if(!stored || stored.run.rules!==RANK_RULES || this.now()-stored.created>86400_000)fail(400,'Esta corrida não está disponível para o ranking.');
        if(stored.completed){send({ok:true});return true;}
        if(this.verifying)fail(503,'Ranking ocupado. O resultado será enviado novamente.');
        const segments=body.segments as ReplaySegment[];
        if(!Array.isArray(segments) || segments.length>72_000)fail(400,'Corrida inválida.');
        let ticks=0;
        for(const s of segments){
          const cmd=cleanCommand(s?.command);
          if(cmd && s.command.action!==undefined){if(!['kneeLeft','kneeRight','nitro','horn','taunt','wheelie'].includes(s.command.action))fail(400,'Ação inválida.');cmd.action=s.command.action;}
          if(!cmd || !Number.isSafeInteger(s.count) || s.count<1 || s.count>72_000 || JSON.stringify(cmd)!==JSON.stringify(s.command))fail(400,'Comandos inválidos.');
          ticks+=s.count;
        }
        if(ticks<1 || ticks>72_000 || ticks/60*1000>this.now()-stored.created+1500)fail(400,'Tempo de corrida inválido.');
        this.verifying=true;
        try {
          const run=stored.run,race=createRace(run.trackId,normalizeSave(run.save),run.seed,run.condition);
          let processed=0;
          for(const s of segments)for(let i=0;i<s.count;i++){
            if(race.mode==='finished')fail(400,'A corrida já terminou.');
            stepRace(race,{player:s.command});
            // Bounded batches leave the realtime multiplayer loop responsive.
            if(++processed%60===0)await yieldTurn();
          }
          if(race.result?.reason!=='finish')fail(400,'A chegada não foi confirmada.');
          this.db.result(run.id,id,'solo',run.trackId,run.condition,run.save.bikeId,race.result!,this.now());
          this.db.db.prepare('UPDATE runs SET completed=1 WHERE id=?').run(run.id);send({ok:true});
        } finally {this.verifying=false;}
      } else fail(404,'Operação não encontrada.');
    } catch(e) {send({error:e instanceof HttpError?e.message:'Não foi possível concluir. Tente novamente.'},e instanceof HttpError?e.status:503);}
    return true;
  }
  recordRoom(room:Room){
    if(!room.race?.multiplayer)return;
    for(const member of room.members){
      const result=room.race.multiplayer.results[member.id],key=`${room.code}:${room.createdAt}:${member.id}`;
      if(!member.accountId || result?.reason!=='finish' || this.recorded.has(key))continue;
      this.db.result(key,member.accountId,'multi',room.trackId,room.condition ?? 'sunset',member.bikeId,result,this.now());
      this.recorded.add(key);if(this.recorded.size>4096)this.recorded.delete(this.recorded.values().next().value!);
    }
  }
}
