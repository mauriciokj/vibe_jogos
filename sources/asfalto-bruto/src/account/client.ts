import { ACCOUNT_API, type Session, type CloudSave, type Account, type RankedRun, type ReplaySegment, type GarageAction } from './protocol';
import { loadSave, normalizeSave, persist } from '../game/save';
import type { Command, SaveData, RaceCondition } from '../game/types';
const uniqueId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const ACTIVE='asfalto:account:active';
const cacheKey=(id:string)=>`asfalto:account:${id}`;
interface Cache { account:Account; revision:number; save:SaveData; dirty:boolean; }
export class ApiError extends Error {constructor(public status:number,public data:any){super(data.error ?? 'Conexão indisponível.');}}
export class AccountClient {
  session:Session|null=null;
  cache:Cache|null=null;
  conflict:CloudSave|null=null;
  status='Convidado · salvo neste navegador';
  available=false;
  private listeners=new Set<()=>void>();
  private authChanging=false;
  private epoch=0;
  private confirmedAccount='';
  private confirmedRevision=-1;
  private writes:Promise<unknown>=Promise.resolve();
  constructor(private apply:(save:SaveData)=>void,private safe:()=>boolean) {
    try{const id=localStorage.getItem(ACTIVE),raw=id?JSON.parse(localStorage.getItem(cacheKey(id)) ?? 'null'):null;if(raw?.account?.id===id)this.cache={...raw,save:normalizeSave(raw.save),dirty:false};}catch{}
    if(this.cache)this.status='Conectando à garagem da conta…';
    window.addEventListener('online',()=>void this.refresh());
    window.addEventListener('focus',()=>{if(this.safe())void this.refresh();});
  }
  initialSave(){return this.cache?.save ?? loadSave();}
  onChange(fn:()=>void){this.listeners.add(fn);}
  private changed(){for(const listener of this.listeners)listener();}
  private persistCache(){try{if(this.cache){localStorage.setItem(cacheKey(this.cache.account.id),JSON.stringify(this.cache));localStorage.setItem(ACTIVE,this.cache.account.id);}}catch{}}
  acceptCloud(cloud:CloudSave,apply=true){
    if(!this.session?.account||!cloud.save)return;
    if(this.confirmedAccount===this.session.account.id&&cloud.revision<this.confirmedRevision)return;
    this.confirmedAccount=this.session.account.id;this.confirmedRevision=cloud.revision;
    // Equal revisions must replace local data too: the browser is only a cache.
    this.cache={account:this.session.account,revision:cloud.revision,save:structuredClone(cloud.save),dirty:false};
    this.session.cloud=cloud;this.conflict=null;this.persistCache();this.status='Garagem confirmada na conta';
    if(apply)this.apply(structuredClone(cloud.save));this.changed();
  }
  save(save:SaveData) {
    if(!this.cache)return persist(save);
    const old=this.cache.save;
    if(save.muted!==old.muted||save.raceTrackId!==old.raceTrackId||save.raceCondition!==old.raceCondition)
      void this.action({kind:'preferences',muted:save.muted,trackId:save.raceTrackId,condition:save.raceCondition}).catch(()=>{});
    return true;
  }
  async api(path:string,body?:unknown,timeout=8000):Promise<any> {
    const res=await fetch(ACCOUNT_API+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-Asfalto-CSRF':this.session?.csrf ?? ''},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
    const data=await res.json();if(!res.ok)throw new ApiError(res.status,data);return data;
  }
  async refresh() {
    if(this.authChanging)return;const epoch=this.epoch;
    try{
      const session=await this.api('/session') as Session;
      if(epoch!==this.epoch||this.authChanging)return;
      if(!('account' in session))throw Error();
      this.session=session;this.available=true;
      if(session.account&&this.safe())this.acceptSession(session);
      else if(!session.account)this.status=this.cache?'Entre novamente para acessar a garagem da conta':'Convidado · salvo neste navegador';
    }catch{this.status=this.cache?'Sem conexão com a conta · tente novamente':'Convidado · salvo neste navegador';}
    this.changed();
  }
  acceptSession(session:Session){this.session=session;if(session.cloud)this.acceptCloud(session.cloud);}
  async login(credential:string){
    if(this.authChanging)return;this.authChanging=true;this.epoch++;
    try{this.acceptSession(await this.api('/login',{credential}));}finally{this.authChanging=false;}
  }
  async chooseInitial(_importGuest:boolean){await this.refresh();}
  async resolve(_useLocal:boolean){await this.refresh();}
  action(action:GarageAction):Promise<any>{
    const work=this.writes.catch(()=>{}).then(async()=>{
      if(!this.cache||this.session?.account?.id!==this.cache.account.id)throw Error('Conecte sua conta para confirmar esta operação.');
      const key=`asfalto:operation:${this.cache.account.id}`,pending=localStorage.getItem(key);
      // Preserve exact requests across uncertain responses/reloads.
      if(pending){
        try{const previous=JSON.parse(pending),data=await this.api('/action',previous);this.acceptCloud(data.cloud);if(JSON.stringify(previous.action)===JSON.stringify(action)){localStorage.removeItem(key);return data;}}
        catch(e){if(!(e instanceof ApiError)||e.status>=500)throw e;if(e.data.cloud)this.acceptCloud(e.data.cloud);}
        localStorage.removeItem(key);
      }
      const body={request:uniqueId(),revision:this.cache.revision,action};
      localStorage.setItem(key,JSON.stringify(body));
      try{const data=await this.api('/action',body);localStorage.removeItem(key);this.acceptCloud(data.cloud);return data;}
      catch(e){
        if(e instanceof ApiError&&e.status<500){localStorage.removeItem(key);if(e.data.cloud)this.acceptCloud(e.data.cloud);}
        this.status='Operação não confirmada · tente novamente';this.changed();throw e;
      }
    });
    this.writes=work;return work;
  }
  async flush(){await this.writes.catch(()=>{});}
  async logout(){
    await this.flush();if(this.authChanging)return;this.authChanging=true;this.epoch++;
    try{if(this.session?.account)await this.api('/logout',{});localStorage.removeItem(ACTIVE);this.cache=null;this.session=null;this.conflict=null;this.apply(loadSave());}
    finally{this.authChanging=false;}
    await this.refresh();
  }
  async startRun(trackId:string,condition:RaceCondition,championship=false):Promise<RankedRun|null>{
    await this.flush();
    if(!this.cache||this.session?.account?.id!==this.cache.account.id)return null;
    try{const run=await this.api('/start',{trackId,condition,championship,revision:this.cache.revision},8000);if(run.cloud)this.acceptCloud(run.cloud);return run;}
    catch(e){if(e instanceof ApiError&&e.data.cloud)this.acceptCloud(e.data.cloud);this.status=e instanceof Error?e.message:'Não foi possível iniciar a corrida.';this.changed();return null;}
  }
}
export class SoloRecorder {
  private segments:ReplaySegment[]=[];private ticks=0;private cursor:number;
  constructor(readonly run:RankedRun,readonly accountId:string){this.cursor=run.cursor ?? 0;}
  add(command:Command){
    if(++this.ticks+this.cursor>72_000)return;
    const last=this.segments.at(-1);
    if(last&&JSON.stringify(last.command)===JSON.stringify(command))last.count++;
    else this.segments.push({count:1,command:{...command}});
  }
  acknowledge(cursor:number){
    let count=cursor-this.cursor;if(count<0||count>this.ticks)throw Error('A corrida avançou em outro aparelho. Retome pelo menu.');
    this.ticks-=count;this.cursor=cursor;
    while(count>0&&this.segments.length){const s=this.segments[0],take=Math.min(count,s.count);s.count-=take;count-=take;if(!s.count)this.segments.shift();}
  }
  payload(){return this.ticks+this.cursor<=72_000?{id:this.run.id,cursor:this.cursor,segments:structuredClone(this.segments)}:null;}
}
