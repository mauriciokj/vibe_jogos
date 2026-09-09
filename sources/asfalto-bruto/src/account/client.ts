import { ACCOUNT_API, type Session, type CloudSave, type Account, type RankedRun, type ReplaySegment } from './protocol';
import { freshSave, loadSave, normalizeSave, persist } from '../game/save';
import type { Command, SaveData, RaceCondition } from '../game/types';
const uniqueId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const ACTIVE='asfalto:account:active';
const tabId=(()=>{try{const key='asfalto:account:tab',id=sessionStorage.getItem(key) ?? uniqueId();sessionStorage.setItem(key,id);return id;}catch{return uniqueId();}})();
const recoveryKey=(id:string)=>`asfalto:account:recovery:${id}:${tabId}`;
const cacheKey=(id:string)=>`asfalto:account:${id}`;
interface Cache { account:Account; revision:number; save:SaveData; dirty:boolean; request?:{id:string;revision:number;save:SaveData}; }
export class ApiError extends Error {constructor(public status:number,public data:any){super(data.error ?? 'Conexão indisponível.');}}
export class AccountClient {
  session:Session|null=null;
  cache:Cache|null=null;
  conflict:CloudSave|null=null;
  status='Convidado · salvo neste navegador';
  available=false;
  private timer?:ReturnType<typeof setTimeout>;
  private sending:Promise<void>|null=null;
  private listeners=new Set<()=>void>();
  constructor(private apply:(save:SaveData)=>void,private safe:()=>boolean) {
    try{const id=localStorage.getItem(ACTIVE);if(id){const recovery=JSON.parse(localStorage.getItem(recoveryKey(id)) ?? 'null');const raw=recovery?.dirty?recovery:JSON.parse(localStorage.getItem(cacheKey(id)) ?? 'null');if(raw?.account?.id===id)this.cache={...raw,save:normalizeSave(raw.save)};}}catch{}
    if(this.cache)this.status='Progresso neste aparelho · conectando…';
    window.addEventListener('online',()=>void this.refresh());
    window.addEventListener('focus',()=>{if(this.safe())void this.refresh();});
  }
  initialSave(){return this.cache?.save ?? loadSave();}
  onChange(fn:()=>void){this.listeners.add(fn);}
  private changed(){for(const listener of this.listeners)listener();}
  private persistCache(){try{if(this.cache){localStorage.setItem(recoveryKey(this.cache.account.id),JSON.stringify(this.cache));localStorage.setItem(cacheKey(this.cache.account.id),JSON.stringify(this.cache));localStorage.setItem(ACTIVE,this.cache.account.id);}return true;}catch{return false;}}
  save(save:SaveData) {
    if(!this.cache)return persist(save);
    this.cache.save=structuredClone(save);this.cache.dirty=true;
    const ok=this.persistCache();this.status=this.conflict?'Há progresso em dois dispositivos':'Alterações salvas aqui · sincronizando…';this.changed();
    clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),1000);return ok;
  }
  async api(path:string,body?:unknown,timeout=8000):Promise<any> {
    const res=await fetch(ACCOUNT_API+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Asfalto-CSRF':this.session?.csrf ?? ''},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
    const data=await res.json();if(!res.ok)throw new ApiError(res.status,data);return data;
  }
  async refresh() {
    try {
      const session=await this.api('/session') as Session;
      if(!('account' in session))throw new Error('Conta indisponível');
      this.session=session;this.available=true;
      if(session.account){
        if(this.safe())this.acceptSession(session);
        else if(this.cache?.account.id!==session.account.id){this.status='Conta alterada · abra Conta no menu';}
        if(this.cache?.account.id===session.account.id)await this.flush();
      } else this.status=this.cache?'Entre no Google para sincronizar este progresso':'Convidado · salvo neste navegador';
    } catch {this.status=this.cache?'Sem conexão · progresso salvo neste aparelho':'Convidado · salvo neste navegador';}
    this.changed();
  }
  acceptSession(session:Session) {
    this.session=session;
    if(!session.account || !session.cloud)return;
    const cloud=session.cloud;
    if(this.cache?.account.id!==session.account.id){
      let existing:Cache|null=null;
      try{existing=JSON.parse(localStorage.getItem(cacheKey(session.account.id)) ?? 'null');}catch{}
      this.cache=existing?.account?.id===session.account.id ? {...existing,save:normalizeSave(existing.save)} : null;
      if(!this.cache && cloud.save)this.cache={account:session.account,revision:cloud.revision,save:cloud.save,dirty:false};
      if(this.cache)this.apply(this.cache.save);
    }
    if(!this.cache){localStorage.removeItem(ACTIVE);this.status='Escolha o progresso para sua conta';this.changed();return;}
    this.cache.account=session.account;
    if(cloud.revision!==this.cache.revision && !this.cache.request){
      if(this.cache.dirty && JSON.stringify(normalizeSave(this.cache.save))!==JSON.stringify(cloud.save)){this.conflict=cloud;this.status='Há progresso em dois dispositivos';}
      else if(cloud.save){this.cache.save=cloud.save;this.cache.revision=cloud.revision;this.cache.dirty=false;this.apply(cloud.save);this.conflict=null;}
    }
    this.persistCache();if(!this.conflict)this.status=this.cache.dirty?'Sincronizando…':'Progresso sincronizado';this.changed();
  }
  async login(credential:string){const session=await this.api('/login',{credential});this.acceptSession(session);this.changed();}
  async chooseInitial(importGuest:boolean) {
    if(!this.session?.account || this.cache)return;
    this.cache={account:this.session.account,revision:this.session.cloud?.revision ?? 0,save:importGuest?loadSave():freshSave(),dirty:true};
    this.persistCache();this.apply(this.cache.save);await this.flush();this.changed();
  }
  async resolve(useLocal:boolean) {
    if(!this.cache || !this.conflict)return;
    this.cache.revision=this.conflict.revision;this.cache.request=undefined;
    if(!useLocal && this.conflict.save){this.cache.save=this.conflict.save;this.cache.dirty=false;this.apply(this.cache.save);}
    else this.cache.dirty=true;
    this.conflict=null;this.persistCache();await this.flush();this.changed();
  }
  async flush() {
    if(this.sending)return this.sending;
    this.sending=this.sendPending();try{await this.sending;}finally{this.sending=null;}
  }
  private async sendPending() {
    const cache=this.cache;
    if(!cache || !cache.dirty || this.conflict || this.session?.account?.id!==cache.account.id)return;
    try {
      while(cache.dirty && this.cache===cache && !this.conflict) {
        cache.request ??={id:uniqueId(),revision:cache.revision,save:structuredClone(cache.save)};this.persistCache();
        const request=cache.request;
        const result=await this.api('/save',{request:request.id,revision:request.revision,save:request.save});
        if(this.cache!==cache)return;
        cache.revision=result.revision;cache.dirty=JSON.stringify(cache.save)!==JSON.stringify(request.save);cache.request=undefined;
        if(result.cloud.revision!==cache.revision){this.conflict=result.cloud;cache.dirty=true;this.status='Há progresso em dois dispositivos';break;}
        this.persistCache();
      }
      if(!this.conflict)this.status='Progresso sincronizado';
    }catch(e){
      if(e instanceof ApiError && e.status===409){this.conflict=e.data.cloud;this.status='Há progresso em dois dispositivos';}
      else if(e instanceof ApiError && [401,403].includes(e.status)){this.session=null;this.status='Entre no Google para sincronizar este progresso';}
      else this.status='Salvo neste aparelho · sincronização pendente';
    }
    this.persistCache();this.changed();
  }
  async logout() {
    await this.flush();
    if(this.session?.account)await this.api('/logout',{});
    localStorage.removeItem(ACTIVE);this.cache=null;this.session=null;this.conflict=null;this.apply(loadSave());await this.refresh();
  }
  async startRun(trackId:string,condition:RaceCondition):Promise<RankedRun|null>{
    if(!this.cache || !this.session?.account || this.conflict)return null;
    await this.flush();if(this.cache.dirty)return null;
    try{return await this.api('/start',{trackId,condition,revision:this.cache.revision},5000);}catch(e){if(e instanceof ApiError && e.status===409 && e.data.cloud){this.conflict=e.data.cloud;this.status='Há progresso em dois dispositivos';this.changed();}return null;}
  }
}
export class SoloRecorder {
  private segments:ReplaySegment[]=[];private ticks=0;
  constructor(readonly run:RankedRun,readonly accountId:string){}
  add(command:Command){
    if(++this.ticks>72_000)return;
    const last=this.segments.at(-1);
    if(last && JSON.stringify(last.command)===JSON.stringify(command))last.count++;
    else this.segments.push({count:1,command:{...command}});
  }
  payload(){return this.ticks<=72_000?{id:this.run.id,segments:this.segments}:null;}
}
