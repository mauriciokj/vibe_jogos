import { TRACKS, clamp } from './content';
import { CONDITIONS } from './conditions';
import { createRace, finishRider, stepRace } from './simulation';
import type { RaceState, SaveData } from './types';

export const CHAMP_POINTS=[10,6,4,3,2,1] as const;
const IDS=['player',...Array.from({length:7},(_,i)=>`rival-${i}`)];
const NAMES=['VOCÊ','NINA','COBRA','DANTE','LUNA','ROCHA','FAÍSCA','ZECA'];
export interface ChampFinish { id:string; place:number|null; time:number|null; }
export interface ChampHeat { finishes:ChampFinish[]; reason:string; }
export interface ChampStage { stage:number; heats:ChampHeat[]; place:number; }
export interface Championship {
 version:1; seed:number; stage:number;
 status:'ready'|'racing'|'standings'|'service'|'eliminated'|'complete';
 heats:ChampHeat[]; history:ChampStage[];
 entry?:Omit<SaveData,'championship'>; damage:Record<string,number>;
 checkpoint?:RaceState;
}
export const championshipPoints=(place:number|null)=>place===null?0:CHAMP_POINTS[place-1] ?? 0;
export function newChampionship(seed:number):Championship {return {version:1,seed:seed>>>0,stage:0,status:'ready',heats:[],history:[],damage:{}};}
export function championshipStandings(heats:ChampHeat[]){
 const rows=IDS.map((id,i)=>{
  const races=heats.map(h=>h.finishes.find(f=>f.id===id)!);
  return {id,name:NAMES[i],points:races.reduce((n,r)=>n+championshipPoints(r.place),0),
   places:Array.from({length:8},(_,n)=>races.filter(r=>r.place===n+1).length),
   time:races.reduce((n,r)=>n+(r.time ?? 360),0),rounds:races.map(r=>championshipPoints(r.place)),finishes:races};
 });
 return rows.sort((a,b)=>b.points-a.points || a.places.reduce((v,n,i)=>v || b.places[i]-n,0) || a.time-b.time || IDS.indexOf(b.id)-IDS.indexOf(a.id))
  .map((r,i)=>({...r,rank:i+1}));
}
export const championshipRoute=(c:Championship)=>({track:TRACKS[c.stage],condition:CONDITIONS[Math.min(c.heats.length,3)]});
export const championshipGarageOpen=(c:Championship)=>!c.entry || c.status==='service' || c.status==='eliminated' || c.status==='complete';
// Read the entered bike while a stage is locked, even if the free-race garage
// now has another bike selected or has repaired its own copy of the condition.
export function championshipBikeState(save:SaveData,c=save.championship){
 const locked=!!c?.entry && !championshipGarageOpen(c);
 const bikeId=locked?c!.entry!.bikeId:save.bikeId;
 const integrity=clamp(locked?(c!.checkpoint?.riders[0].integrity ?? c!.damage.player ?? c!.entry!.condition[bikeId] ?? 100):(save.condition[bikeId] ?? 100),0,100);
 const pendingResult=c?.status==='racing' && c.checkpoint?.mode==='finished';
 const beforeRace=!c || c.status!=='racing' || c.checkpoint?.mode==='countdown';
 return {bikeId,integrity,locked,pendingResult,low:integrity<20&&!pendingResult,
  blocked:integrity===0&&!pendingResult,canRepair:integrity===0&&!pendingResult&&beforeRace};
}
export function nextChampionshipStage(c:Championship){
 if(c.status!=='service' || c.stage>=TRACKS.length-1)return false;
 c.stage++;c.heats=[];c.status='ready';c.damage={};delete c.entry;delete c.checkpoint;return true;
}
export function startChampionshipRace(save:SaveData):RaceState|null {
 const c=save.championship;if(!c)return null;
 if(championshipBikeState(save).blocked)return null;
 if(c.status==='racing' && c.checkpoint)return structuredClone(c.checkpoint);
 if(!['ready','standings'].includes(c.status) || c.heats.length>=4)return null;
 if(!c.entry){const {championship:_,...garage}=save;c.entry=structuredClone(garage);}
 const entry=structuredClone(c.entry),bike=entry.bikeId;
 // Outside activities can consume nitro, but purchases/repairs cannot replenish
 // the equipment or condition already entered in this four-race stage.
 entry.nitro={...entry.nitro,[bike]:Math.min(entry.nitro?.[bike] ?? 0,save.nitro?.[bike] ?? 0)};
 const route=championshipRoute(c),race=createRace(route.track.id,entry,(c.seed+c.stage*1597+c.heats.length*733)>>>0,route.condition.id);
 for(const r of race.riders)if(c.damage[r.id]!==undefined)r.integrity=c.damage[r.id];
 c.status='racing';checkpointChampionship(c,race);
 return race;
}
export function checkpointChampionship(c:Championship,race:RaceState){
 if(c.status!=='racing' || race.trackId!==TRACKS[c.stage].id || race.condition!==CONDITIONS[c.heats.length]?.id)return false;
 c.checkpoint=structuredClone(race);
 const p=race.riders[0];if(c.entry){c.entry.condition[p.bikeId!]=p.integrity;c.entry.nitro={...c.entry.nitro,[p.bikeId!]:p.nitro ?? 0};}
 return true;
}
// Continue the actual AI simulation on a copy, including crashes/arrests, so a
// rider still behind the player is never awarded invented finishing points.
export function championshipRemainder(source:RaceState){
 if(!source.result)throw Error('A corrida ainda não terminou.');
 const s=structuredClone(source);s.mode='racing';s.countdown=0;
 s.multiplayer={humanIds:IDS.slice(),results:{player:structuredClone(source.result)}};
 const p=s.riders[0];if(source.result.reason!=='finish')p.out=source.result.reason as typeof p.out;
 for(const r of s.riders.slice(1)){
  if(r.profile==='police')continue;
  if(r.finishedAt!==null)finishRider(s,r,'finish');
  else if(r.out)s.multiplayer.results[r.id]={reason:r.out,place:8,time:s.time,reward:0,hits:r.hits,falls:r.falls};
 }
 return s;
}
export function advanceChampionshipRemainder(s:RaceState,frames=300){
 for(let n=0;n<frames && s.mode!=='finished';n++){
  if(IDS.every(id=>s.multiplayer!.results[id])){s.mode='finished';break;}
  stepRace(s);
 }
 return s.mode==='finished';
}
export async function finishChampionshipSimulation(source:RaceState){
 const s=championshipRemainder(source);
 while(!advanceChampionshipRemainder(s))await new Promise<void>(resolve=>setTimeout(resolve,0));
 return s;
}
export function recordChampionshipHeat(c:Championship,finished:RaceState){
 if(c.status!=='racing' || c.heats.length>=4 || finished.mode!=='finished' || finished.trackId!==TRACKS[c.stage].id || finished.condition!==CONDITIONS[c.heats.length].id)return false;
 const results=finished.multiplayer?.results;if(!results || !IDS.every(id=>results[id]))return false;
 const finishers=IDS.filter(id=>results[id].reason==='finish').sort((a,b)=>results[a].time-results[b].time || IDS.indexOf(b)-IDS.indexOf(a));
 c.heats.push({reason:results.player.reason,finishes:IDS.map(id=>({id,place:finishers.includes(id)?finishers.indexOf(id)+1:null,time:results[id].reason==='finish'?results[id].time:null}))});
 c.damage=Object.fromEntries(finished.riders.filter(r=>IDS.includes(r.id)).map(r=>[r.id,clamp(r.integrity,0,100)]));
 if(c.entry)c.entry.condition[c.entry.bikeId]=c.damage.player;
 delete c.checkpoint;
 if(c.heats.length===4){
  const place=championshipStandings(c.heats).find(r=>r.id==='player')!.rank;
  c.history.push({stage:c.stage,heats:structuredClone(c.heats),place});
  c.status=place>3?'eliminated':c.stage===TRACKS.length-1?'complete':'service';
 }else c.status='standings';
 return true;
}

// Keep malformed/older championship data from affecting an otherwise valid garage.
// Snapshot size and shape are bounded before it is allowed back into simulation.
export function normalizeChampionship(value:any,normalizeGarage:(v:any)=>SaveData):Championship|undefined {
 try{
  if(!value || value.version!==1 || !Number.isInteger(value.seed) || !Number.isInteger(value.stage) || value.stage<0 || value.stage>=TRACKS.length)return;
  if(!['ready','racing','standings','service','eliminated','complete'].includes(value.status))return;
  if(JSON.stringify(value).length>100_000)return;
  const heat=(h:any):ChampHeat=>{
   if(!h || !Array.isArray(h.finishes) || h.finishes.length!==8 || !['finish','caught','wrecked','left','timeout'].includes(h.reason))throw Error();
   const rows=IDS.map(id=>{const f=h.finishes.find((r:any)=>r?.id===id);if(!f || !(f.place===null && f.time===null || Number.isInteger(f.place)&&f.place>=1&&f.place<=8&&Number.isFinite(f.time)&&f.time>0&&f.time<=1200))throw Error();return {id,place:f.place,time:f.time};});
   const places=rows.filter(f=>f.place!==null).map(f=>f.place);if(new Set(places).size!==places.length)throw Error();
   return {reason:h.reason,finishes:rows};
  };
  if(!Array.isArray(value.heats)||value.heats.length>4 || !Array.isArray(value.history)||value.history.length>5)return;
  const c:Championship={version:1,seed:value.seed>>>0,stage:value.stage,status:value.status,heats:value.heats.map(heat),history:value.history.map((h:any,i:number)=>{
   if(h.stage!==i || !Array.isArray(h.heats)||h.heats.length!==4)throw Error();const heats=h.heats.map(heat);return {stage:i,heats,place:championshipStandings(heats).find(r=>r.id==='player')!.rank};
  }),damage:{}};
  for(const id of IDS)if(value.damage?.[id]!==undefined){if(!Number.isFinite(value.damage[id]))return;c.damage[id]=clamp(value.damage[id],0,100);}
  if(value.entry){if(value.entry.version!==1)return;const {championship:_,...entry}=value.entry;c.entry=normalizeGarage(entry);}
  const complete=['service','eliminated','complete'].includes(c.status);
  if(complete!== (c.heats.length===4) || c.history.length!==c.stage+(complete?1:0) || c.status==='ready'&&c.heats.length!==0 || c.status==='standings'&&c.heats.length===0)return;
  if(complete){const place=championshipStandings(c.heats).find(r=>r.id==='player')!.rank;c.status=place>3?'eliminated':c.stage===TRACKS.length-1?'complete':'service';}
  if(c.status==='racing'){
   const s=value.checkpoint as RaceState;
   if(!c.entry || !validCheckpoint(s,c))return;
   c.checkpoint=structuredClone(s);
  }
  if(c.heats.length && !c.entry)return;
  return c;
 }catch{return;}
}
function validCheckpoint(s:RaceState,c:Championship){
 if(!s || s.version!==1 || s.multiplayer || s.trackId!==TRACKS[c.stage].id || s.condition!==CONDITIONS[c.heats.length]?.id || !['countdown','racing','finished'].includes(s.mode))return false;
 const finiteTree=(v:any):boolean=>v===null || ['string','boolean','undefined'].includes(typeof v) || typeof v==='number'&&Number.isFinite(v) || Array.isArray(v)&&v.every(finiteTree) || typeof v==='object'&&Object.values(v).every(finiteTree);
 if(!finiteTree(s) || !Number.isFinite(s.rng) || !Number.isInteger(s.tick)||s.tick<0||s.tick>72000||!Number.isFinite(s.time)||s.time<0||s.time>1200)return false;
 if(!Array.isArray(s.riders)||s.riders.length<8||s.riders.length>9||!IDS.every(id=>s.riders.some(r=>r.id===id))||s.riders[0].id!=='player')return false;
 const numeric=['x','z','speed','lean','health','integrity','maxSpeed','acceleration','handling','armor','cooldown','crash','immune','targetX','decisionAt','hits','falls'];
 if(!s.riders.every(r=>numeric.every(k=>Number.isFinite((r as any)[k])) && typeof r.name==='string'&&typeof r.color==='string'&&['player','fast','careful','aggressive','police'].includes(r.profile)&& (r.finishedAt===null||Number.isFinite(r.finishedAt))&& (!r.attack || ['punch','kick','weapon'].includes(r.attack.kind)&&Number.isFinite(r.attack.age))))return false;
 if(!Array.isArray(s.traffic)||s.traffic.length>80||!s.traffic.every(t=>['car','truck','van','tractor'].includes(t.kind)&&typeof t.id==='string'&&typeof t.color==='string'&&['x','z','speed'].every(k=>Number.isFinite((t as any)[k]))))return false;
 if(!Array.isArray(s.obstacles)||s.obstacles.length>100||!s.obstacles.every(o=>typeof o.id==='string'&&['oil','barrier','cone','concrete','gravel','mud','fallenTree','tumbleweed','armadillo','dirtRamp','woodRamp'].includes(o.kind)&&Number.isFinite(o.x)&&Number.isFinite(o.z)&&(!o.motion||['from','to','speed','phase','period'].every(k=>Number.isFinite((o.motion as any)[k]))&&o.motion.period>0)))return false;
 const result=s.result;
 if(s.mode==='finished' && (!result || !['finish','caught','wrecked','left','timeout'].includes(result.reason) || ![result.time,result.reward,result.place,result.hits,result.falls].every(Number.isFinite) || result.time<0 || result.place<1 || result.place>8 || result.reward<0))return false;
 return !!s.collisions && typeof s.collisions==='object' && Array.isArray(s.events) && [s.heat,s.capture,s.countdown].every(Number.isFinite);
}
