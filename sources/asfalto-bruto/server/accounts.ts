import type { IncomingMessage, ServerResponse } from 'node:http';
import { AccountsDB, hash, token } from './accounts-db';
import { googleVerifier } from './google';
import { ACCOUNT_API, RANK_RULES } from '../src/account/protocol';
import { cleanName } from '../src/multiplayer/protocol';
import type { Room } from './room';
import { Economy, EconomyError } from './economy';

class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
function fail(status:number,message:string):never{throw new HttpError(status,message);}
const cookie=(req:IncomingMessage,name:string)=>(req.headers.cookie ?? '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1) ?? '';
export interface AccountOptions { db:AccountsDB; clientId:string; origins:string[]; secure?:boolean; now?:()=>number; verify?:(credential:string,nonce:string)=>Promise<string>; }
export class AccountService {
  readonly economy:Economy;
  readonly db:AccountsDB; private verify; private now; private secure;
  private challenges=new Map<string,{nonce:string;csrf:string;expires:number}>();
  private limits=new Map<string,{at:number;count:number}>();
  private recorded=new Set<string>();
  constructor(private options:AccountOptions){this.db=options.db;this.verify=options.verify ?? googleVerifier(options.clientId);this.now=options.now ?? Date.now;this.secure=options.secure!==false;this.economy=new Economy(this.db,this.now);}
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
        send({account:identity?.account ?? null,cloud:identity?this.economy.initialize(identity.account.id):undefined,csrf,nonce,clientId:this.options.clientId});return true;
      }
      if(method==='GET' && route==='/ranking') {
        const mode=url.searchParams.get('mode')==='multi'?'multi':'solo',track=url.searchParams.get('track') ?? 'costa',condition=url.searchParams.get('condition') ?? 'sunset';
        const requestedRules=Number(url.searchParams.get('rules'));
        const rules=Number.isInteger(requestedRules)&&requestedRules>=1&&requestedRules<=RANK_RULES?requestedRules:RANK_RULES;
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
      for await(const chunk of req){bytes+=chunk.length;if(bytes>(['/finish','/checkpoint'].includes(route)?4_000_000:route==='/save'?128_000:32_000))fail(413,'Envio muito grande.');chunks.push(chunk);}
      let body:any;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'Dados inválidos.');}
      if(!body || typeof body!=='object')fail(400,'Dados inválidos.');
      if(route==='/login') {
        if(!this.options.clientId || !login || login.expires<this.now() || typeof body.credential!=='string' || body.credential.length>12000)fail(401,'Entre novamente com o Google.');
        this.challenges.delete(hash(cookie(req,this.cookieName('login'))));
        let subject;try{subject=await this.verify(body.credential,login.nonce);}catch{fail(401,'Não foi possível confirmar sua conta Google. Tente novamente.');}
        const account=this.db.login(subject!,this.now()),session=this.db.session(account.id,this.now());
        this.setCookie(res,'session',session.value,30*86400);
        send({account,cloud:this.economy.initialize(account.id),csrf:session.csrf,clientId:this.options.clientId});return true;
      }
      if(!identity)fail(401,'Entre com o Google para continuar.');
      const id=identity.account.id;
      if(['/save','/action','/start','/finish','/checkpoint'].includes(route)){
        if(route==='/save')send({error:'Atualize o jogo. A garagem agora é confirmada pelo servidor.',cloud:this.db.cloud(id)},409);
        else if(route==='/action')send(this.economy.action(id,body));
        else if(route==='/start')send(this.economy.start(id,body));
        else send(await this.economy.advance(id,body,route==='/finish'));
        return true;
      }
      if(route==='/logout'){this.db.logout(cookie(req,this.cookieName('session')));this.setCookie(res,'session','',0);send({ok:true});}
      else if(route==='/nickname') {const nickname=cleanName(body.nickname);this.db.rename(id,nickname);send({nickname});}
      else fail(404,'Operação não encontrada.');
    } catch(e) {const known=e instanceof HttpError||e instanceof EconomyError;send({error:known?e.message:'Não foi possível concluir. Tente novamente.',cloud:known&&e.status===409&&this.identity(req)?this.db.cloud(this.identity(req)!.account.id):undefined},known?e.status:503);}
    return true;
  }
  recordRoom(room:Room){
    this.economy.recordRoom(room);
    if(!room.race?.multiplayer)return;
    for(const member of room.members){
      const result=room.race.multiplayer.results[member.id],key=`${room.code}:${room.createdAt}:${member.id}`;
      if(!member.accountId || result?.reason!=='finish' || this.recorded.has(key))continue;
      this.db.result(key,member.accountId,'multi',room.trackId,room.condition ?? 'sunset',member.bikeId,result,this.now());
      this.recorded.add(key);if(this.recorded.size>4096)this.recorded.delete(this.recorded.values().next().value!);
    }
  }
}
