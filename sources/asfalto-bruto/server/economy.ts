import { randomBytes } from 'node:crypto';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { AccountsDB, hash, token } from './accounts-db';
import { RANK_RULES, type GarageAction, type RankedRun, type ReplaySegment } from '../src/account/protocol';
import { buyBike, buyHelmet, buyKneePad, buyNitro, buyUpgrade, buyWeapon, freshSave, paintHelmet, repair, repairChampionshipBike, settleRace } from '../src/game/save';
import { championshipBikeState, checkpointChampionship, finishChampionshipSimulation, newChampionship, nextChampionshipStage, recordChampionshipHeat, startChampionshipRace } from '../src/game/championship';
import { CONDITIONS } from '../src/game/conditions';
import { TRACKS } from '../src/game/content';
import { createRace, finishRider, stepRace } from '../src/game/simulation';
import { cleanCommand } from '../src/multiplayer/protocol';
import type { RaceState, SaveData } from '../src/game/types';
import type { Member, Room } from './room';

export class EconomyError extends Error { constructor(public status:number,message:string){super(message);} }
const fail=(message:string,status=409):never=>{throw new EconomyError(status,message);};
const seed=()=>randomBytes(4).readUInt32LE();
export class Economy {
  private busy=new Set<string>();
  private onlineUsage=new Map<string,number>();
  private closedSlots=new Set<string>();
  constructor(private db:AccountsDB,private now:()=>number=Date.now){}
  recoverMemoryRooms(){
    // Memory rooms do not survive a process restart. Release only the unused
    // stock recorded by the server; old slot tokens cannot recreate a room.
    for(const row of this.db.db.prepare('SELECT id,account FROM economy_multiplayer WHERE closed=0').all())
      this.releaseMember({id:String(row.id),accountId:String(row.account)} as Member);
  }
  initialize(id:string){this.db.mutate(id,save=>({save:save ?? freshSave(),value:null}),this.now());return this.db.cloud(id);}
  private active(id:string){return this.db.db.prepare('SELECT * FROM economy_runs WHERE account=? AND completed=0 ORDER BY created DESC LIMIT 1').get(id);}
  private ensureIdle(id:string){
    if(this.busy.has(id) || this.active(id))fail('Conclua ou abandone a corrida da conta antes de alterar a garagem.');
    if(this.db.db.prepare('SELECT 1 FROM economy_multiplayer WHERE account=? AND closed=0').get(id))fail('Saia da sala multiplayer antes de alterar a garagem.');
  }
  action(id:string,body:any){
    if(typeof body.request!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(body.request)||!Number.isSafeInteger(body.revision)||!body.action)fail('Pedido inválido.',400);
    const digest=hash(JSON.stringify([body.revision,body.action]));
    this.db.mutate(id,(stored,revision)=>{
      const prior=this.db.db.prepare('SELECT digest FROM economy_requests WHERE account=? AND request=?').get(id,body.request);
      if(prior){if(prior.digest!==digest)fail('Identificador já utilizado.',400);return {save:stored,value:null};}
      if(revision!==body.revision)fail('A conta mudou em outro aparelho. Atualize e tente novamente.');
      const save=structuredClone(stored ?? freshSave()),a=body.action as GarageAction;
      if(a.kind!=='preferences')this.ensureIdle(id);
      let ok=false;
      switch(a.kind){
        case 'bike':ok=buyBike(save,a.item!);break;
        case 'helmet':ok=buyHelmet(save,a.item!);break;
        case 'color':ok=paintHelmet(save,a.item!);break;
        case 'weapon':ok=buyWeapon(save,a.item!);break;
        case 'knee':ok=buyKneePad(save,a.item!);break;
        case 'nitro':ok=buyNitro(save);break;
        case 'upgrade':if(['engine','armor','handling'].includes(a.item!))ok=buyUpgrade(save,a.item as 'engine'|'armor'|'handling');break;
        case 'repair':ok=repair(save);break;
        case 'champRepair':ok=repairChampionshipBike(save);break;
        case 'removeWeapon':delete save.weaponId;ok=true;break;
        case 'removeKnee':delete save.kneePadId;ok=true;break;
        case 'champRestart':save.championship=newChampionship(seed());ok=true;break;
        case 'reset':Object.assign(save,freshSave());for(const key of Object.keys(save))if(!(key in freshSave()))delete (save as any)[key];ok=true;break;
        case 'preferences':
          if(typeof a.muted==='boolean')save.muted=a.muted;
          if(TRACKS.some(t=>t.id===a.trackId&&t.index<=save.unlocked))save.raceTrackId=a.trackId;
          if(CONDITIONS.some(c=>c.id===a.condition))save.raceCondition=a.condition;
          ok=true;break;
      }
      if(!ok)fail('Compra indisponível: confira saldo, item e limite de uso.',400);
      this.db.db.prepare('INSERT INTO economy_requests VALUES(?,?,?)').run(id,body.request,digest);
      return {save,value:null};
    },this.now());
    return {cloud:this.db.cloud(id)};
  }
  start(id:string,body:any):RankedRun {
    if(this.busy.has(id))fail('A corrida está sendo conferida. Aguarde.');
    const active=this.active(id);
    if(active){
      if((active.kind==='championship')!==!!body.championship)fail('Retome ou abandone a corrida anterior antes de iniciar outra.');
      return this.describe(id,active);
    }
    this.ensureIdle(id);
    const expired='SELECT id FROM economy_runs WHERE completed=1 AND created<?';
    this.db.db.prepare(`DELETE FROM economy_chunks WHERE run IN (${expired})`).run(this.now()-86400_000);
    this.db.db.prepare(`DELETE FROM economy_completions WHERE run IN (${expired})`).run(this.now()-86400_000);
    this.db.db.prepare('DELETE FROM economy_runs WHERE completed=1 AND created<?').run(this.now()-86400_000);
    this.db.mutate(id,(stored,revision)=>{
      if(body.revision!==revision)fail('A conta mudou. Atualize antes da largada.');
      const save=structuredClone(stored ?? freshSave());
      let race:RaceState|null;
      if(body.championship===true){
        save.championship ??=newChampionship(seed());
        if(championshipBikeState(save).blocked)fail('A moto está zerada. Repare antes de iniciar.');
        if(save.championship.status==='service')nextChampionshipStage(save.championship);
        race=startChampionshipRace(save);
        if(!race)fail('Esta etapa não está disponível.');
      }else{
        const track=TRACKS.find(t=>t.id===body.trackId),condition=CONDITIONS.find(c=>c.id===body.condition);
        if(!track||!condition||track.index>save.unlocked)fail('Pista indisponível.',400);
        if((save.condition[save.bikeId] ?? 100)<20){save.bikeId='ferro';save.condition.ferro=Math.max(55,save.condition.ferro ?? 100);}
        race=createRace(track!.id,save,seed(),condition!.id);
      }
      // Reserve consumables before racing. Only verified remaining stock is
      // returned; closing the browser cannot restore spent nitro.
      const bike=race!.riders[0].bikeId!;
      save.nitro={...save.nitro,[bike]:Math.max(0,(save.nitro?.[bike] ?? 0)-(race!.riders[0].nitro ?? 0))};
      this.db.db.prepare('INSERT INTO economy_runs(id,account,kind,state,cursor,created) VALUES(?,?,?,?,0,?)').run(token(),id,body.championship===true?'championship':'solo',JSON.stringify(race),this.now());
      return {save,value:null};
    },this.now());
    return this.describe(id,this.active(id)!);
  }
  private describe(id:string,row:any):RankedRun {
    const initial=JSON.parse(String(row.state)) as RaceState,cloud=this.db.cloud(id);
    return {id:String(row.id),seed:initial.rng,save:cloud.save!,initial,trackId:initial.trackId,condition:initial.condition!,rules:RANK_RULES,championship:row.kind==='championship',cursor:Number(row.cursor),cloud};
  }
  async advance(id:string,body:any,finish=false){
    if(this.busy.has(id))fail('Corrida sendo conferida. Tente novamente.',503);
    const row=this.db.db.prepare('SELECT * FROM economy_runs WHERE id=? AND account=?').get(body.id ?? '',id);
    if(!row)fail('Corrida não encontrada. Atualize a página.',400);
    if(row!.completed){const receipt=this.db.db.prepare('SELECT payout FROM economy_completions WHERE run=?').get(row!.id);return {ok:true,completed:true,cloud:this.db.cloud(id),cursor:Number(row!.cursor),payout:receipt?JSON.parse(String(receipt.payout)):null};}
    if(!Number.isSafeInteger(body.cursor)||body.cursor<0)fail('Trecho de corrida inválido.',400);
    const digest=hash(JSON.stringify(body.segments));
    if(body.cursor!==row!.cursor){
      const prior=this.db.db.prepare('SELECT digest,end_cursor FROM economy_chunks WHERE run=? AND cursor=?').get(row!.id,body.cursor);
      let remaining=Number(row!.cursor)-body.cursor;
      const prefix=Array.isArray(body.segments)?body.segments.flatMap((s:ReplaySegment)=>{if(!remaining)return [];const count=Math.min(remaining,s.count);remaining-=count;return [{count,command:s.command}];}):[];
      return {ok:false,resync:!prior||prior.digest!==hash(JSON.stringify(prefix))||prior.end_cursor!==row!.cursor||remaining!==0,cursor:Number(row!.cursor),cloud:this.db.cloud(id),initial:JSON.parse(String(row!.state))};
    }
    const segments=body.segments as ReplaySegment[];
    if(!Array.isArray(segments)||segments.length>72000)fail('Corrida inválida.',400);
    let ticks=0;
    for(const s of segments){
      const command=cleanCommand(s?.command);
      if(command&&s.command.action!==undefined){if(!['kneeLeft','kneeRight','nitro','horn','taunt','wheelie'].includes(s.command.action))fail('Ação inválida.',400);command.action=s.command.action;}
      if(!command||!Number.isSafeInteger(s.count)||s.count<1||s.count>72000||JSON.stringify(command)!==JSON.stringify(s.command))fail('Comandos inválidos.',400);
      ticks+=s.count;
    }
    if(ticks+body.cursor>72000||(ticks+body.cursor)/60*1000>this.now()-Number(row!.created)+1500)fail('Tempo de corrida inválido.',400);
    if(this.busy.size>=2)fail('Servidor conferindo corridas. Tente novamente.',503);
    this.busy.add(id);
    try{
      const race=JSON.parse(String(row!.state)) as RaceState;
      let processed=0;
      for(const segment of segments)for(let i=0;i<segment.count;i++){
        if(race.mode==='finished')fail('Há comandos após o fim da corrida.',400);
        stepRace(race,{player:segment.command});
        if(++processed%60===0)await yieldTurn();
      }
      if(finish&&body.abandon===true&&!race.result)finishRider(race,race.riders[0],'left');
      if(finish&&!race.result)fail('O fim da corrida não foi confirmado.',400);
      const completed=finish&&row!.kind==='championship'?await finishChampionshipSimulation(race):null;
      let payout:ReturnType<typeof settleRace>;
      this.db.mutate(id,stored=>{
        const save=structuredClone(stored!);
        if(row!.kind==='championship'&&save.championship){
          checkpointChampionship(save.championship,race);
          if(completed&&!recordChampionshipHeat(save.championship,completed))fail('Etapa não corresponde à corrida.',400);
        }
        if(finish){
          // Abandoning is not an income source. Legitimate defeats retain the
          // existing workshop assistance computed by the simulation.
          if(body.abandon===true)race.result!.reward=0;
          payout=settleRace(save,race,{starterRepair:row!.kind!=='championship'});
          const p=race.riders[0],bike=p.bikeId!;
          save.nitro={...save.nitro,[bike]:(save.nitro?.[bike] ?? 0)+(p.nitro ?? 0)};
          if(row!.kind==='solo')this.db.result(String(row!.id),id,'solo',race.trackId,race.condition!,bike,race.result!,this.now());
          this.db.db.prepare('INSERT INTO economy_completions VALUES(?,?)').run(row!.id,JSON.stringify(payout ?? null));
        }
        if(ticks)this.db.db.prepare('INSERT INTO economy_chunks VALUES(?,?,?,?)').run(row!.id,body.cursor,digest,body.cursor+ticks);
        this.db.db.prepare('UPDATE economy_runs SET state=?,cursor=?,completed=? WHERE id=?').run(JSON.stringify(race),body.cursor+ticks,finish?1:0,row!.id);
        return {save,value:null};
      },this.now());
      return {ok:true,completed:finish,cursor:body.cursor+ticks,cloud:this.db.cloud(id),payout};
    }finally{this.busy.delete(id);}
  }
  equipMember(id:string|undefined,member:Member){
    // Guests can race without a login; account equipment is never supplied by
    // localStorage or by WebSocket messages.
    const save=id?this.initialize(id).save!:freshSave();
    if(id)this.ensureIdle(id);
    const bike=save.owned.includes(member.bikeId)?member.bikeId:save.bikeId;
    member.accountId=id;member.bikeId=bike;member.weaponId=save.weaponId;member.kneePadId=save.kneePadId;
    member.helmetId=save.helmetId;member.helmetColorId=save.helmetColorId;member.nitro=save.nitro?.[bike] ?? 0;
    if(id)this.db.mutate(id,stored=>{
      const next=structuredClone(stored!);next.nitro={...next.nitro,[bike]:0};
      this.db.db.prepare('INSERT INTO economy_multiplayer(id,account,bike,stock) VALUES(?,?,?,?)').run(member.id,id,bike,member.nitro!);
      return {save:next,value:null};
    },this.now());
  }
  releaseMember(member:Member,used=0){
    if(!member.accountId||this.closedSlots.has(member.id))return;
    this.db.mutate(member.accountId,stored=>{
      const row=this.db.db.prepare('SELECT * FROM economy_multiplayer WHERE id=? AND closed=0').get(member.id);
      if(!row)return {save:stored,value:null};
      const save=structuredClone(stored!),remaining=Math.max(0,Number(row.stock)-Math.max(Number(row.used),used));
      save.nitro={...save.nitro,[String(row.bike)]:(save.nitro?.[String(row.bike)] ?? 0)+remaining};
      this.db.db.prepare('UPDATE economy_multiplayer SET closed=1 WHERE id=?').run(member.id);
      return {save,value:null};
    },this.now());
    this.closedSlots.add(member.id);this.onlineUsage.delete(member.id);
    if(this.closedSlots.size>4096)this.closedSlots.delete(this.closedSlots.values().next().value!);
  }
  recordRoom(room:Room){
    for(const member of room.members){
      if(!member.accountId||this.closedSlots.has(member.id))continue;
      const rider=room.race?.riders.find(r=>r.id===member.id),used=rider?.nitroUsed ?? 0;
      if(used>(this.onlineUsage.get(member.id) ?? 0)){
        this.db.db.prepare('UPDATE economy_multiplayer SET used=MAX(used,?) WHERE id=? AND used<? AND closed=0').run(used,member.id,used);
        this.onlineUsage.set(member.id,used);
      }
      if(room.race?.multiplayer?.results[member.id])this.releaseMember(member,used);
    }
  }
}
