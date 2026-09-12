import { MOTORBIKES, BICYCLE_ID } from './bikes';
import { TRACKS } from './content';
import { CONDITIONS, recordKey } from './conditions';
import type { RaceState, SaveData } from './types';

export const ACHIEVEMENTS = [
 {id:'on-foot',name:'Na raça',description:'Cruzar a linha de chegada a pé após cair.',secret:true},
 {id:'all-rivals',name:'Último homem de pé',description:'Derrubar todos os adversários na mesma corrida.',secret:true},
 {id:'police',name:'Sirene calada',description:'Derrubar um policial.',secret:true},
 {id:'car-jump',name:'Por cima do trânsito',description:'Saltar sobre um carro na contramão.'},
 {id:'terra-jump',name:'Pedra no caminho',description:'Saltar usando um bloco de terra ou madeira na Terra Brava.'},
 {id:'online-win',name:'Respeita o campeão',description:'Vencer uma corrida multiplayer.'},
 {id:'champ-win',name:'Primeiro passo para a glória',description:'Vencer uma corrida do campeonato.'},
 {id:'solo-win',name:'Primeira bandeirada',description:'Vencer sua primeira corrida individual.'},
 {id:'pristine',name:'Sem um arranhão',description:'Terminar uma corrida sem sofrer dano no piloto ou no veículo.',secret:true},
 {id:'fragile',name:'Por um fio',description:'Terminar uma corrida com menos de 10% de integridade.',secret:true},
 {id:'comeback-falls',name:'Levanta e vence',description:'Vencer depois de cair pelo menos três vezes na mesma corrida.',secret:true},
 {id:'last-to-first',name:'Virada histórica',description:'Estar em último ao passar pela metade da pista e vencer.',secret:true},
 {id:'late-pass',name:'Último segundo',description:'Ultrapassar o líder nos últimos 100 metros e vencer.',secret:true},
 {id:'record',name:'Dono do cronômetro',description:'Melhorar um recorde pessoal já existente de uma pista e condição.'},
 {id:'streak',name:'Trinca de respeito',description:'Vencer três corridas consecutivas.'},
 {id:'rain-win',name:'Rei da chuva',description:'Vencer uma corrida na chuva.'},
 {id:'night-win',name:'Coruja do asfalto',description:'Vencer uma corrida à noite.'},
 {id:'all-weather',name:'Em qualquer condição',description:'Vencer na mesma pista de dia, ao entardecer, à noite e na chuva.'},
 {id:'all-tracks',name:'Passaporte carimbado',description:'Terminar uma corrida em cada uma das cinco pistas.'},
 {id:'knee-curve',name:'Joelho de aço',description:'Completar uma curva usando o joelho apoiado, sem cair ou sair da pista.'},
 {id:'three-jumps',name:'Sem tocar o chão',description:'Saltar sobre três carros diferentes na mesma corrida.',secret:true},
 {id:'bicycle-finish',name:'Na força da perna',description:'Terminar uma corrida usando a Magrela.',secret:true},
 {id:'perfect-stage',name:'Etapa perfeita',description:'Vencer as quatro corridas de uma etapa do campeonato.',secret:true},
 {id:'champion',name:'Lenda do Asfalto Bruto',description:'Concluir o campeonato em primeiro na classificação da última etapa.',secret:true},
 {id:'garage',name:'Garagem dos sonhos',description:'Possuir todas as sete motos convencionais.'},
] as const;
export type AchievementId=typeof ACHIEVEMENTS[number]['id'];
export interface AchievementProgress {unlocked:AchievementId[];winStreak:number;finishedTracks:string[];conditionWins:string[];}
export type AchievementMode='solo'|'multi'|'championship';
const routes=TRACKS.flatMap(t=>CONDITIONS.map(c=>recordKey(t.id,c.id)));
const strings=(value:unknown,allowed:readonly string[])=>Array.isArray(value)?allowed.filter(id=>value.includes(id)):[];
export function normalizeAchievements(value:unknown):AchievementProgress {
 const v=value as Partial<AchievementProgress>|null;
 return {unlocked:strings(v?.unlocked,ACHIEVEMENTS.map(a=>a.id)) as AchievementId[],winStreak:Number.isInteger(v?.winStreak)?Math.max(0,Math.min(3,v!.winStreak!)):0,finishedTracks:strings(v?.finishedTracks,TRACKS.map(t=>t.id)),conditionWins:strings(v?.conditionWins,routes)};
}
function grant(save:SaveData,ids:AchievementId[]){
 const a=save.achievements ??=normalizeAchievements(null),added=ids.filter((id,i)=>ids.indexOf(id)===i&&!a.unlocked.includes(id));
 a.unlocked=ACHIEVEMENTS.filter(item=>a.unlocked.includes(item.id)||added.includes(item.id)).map(item=>item.id);return added;
}
// Reconstruct only facts present in the trusted save. No invented crash/jump
// history or win sequence; accounts never import this data from a browser.
export function reconcileAchievements(save:SaveData){
 const a=save.achievements ??=normalizeAchievements(null),ids:AchievementId[]=[];
 for(const t of TRACKS)for(const c of CONDITIONS){const key=recordKey(t.id,c.id),r=save.records[key];if(!r)continue;
  if(!a.finishedTracks.includes(t.id))a.finishedTracks.push(t.id);
  if(r.place===1 && !a.conditionWins.includes(key))a.conditionWins.push(key);
 }
 if(save.owned.includes(BICYCLE_ID))ids.push('on-foot');
 if(MOTORBIKES.every(b=>save.owned.includes(b.id)))ids.push('garage');
 if(a.winStreak>=3)ids.push('streak');
 if(a.finishedTracks.length===TRACKS.length)ids.push('all-tracks');
 if(TRACKS.some(t=>CONDITIONS.every(c=>a.conditionWins.includes(recordKey(t.id,c.id)))))ids.push('all-weather');
 if(TRACKS.some(t=>a.conditionWins.includes(recordKey(t.id,'rain'))))ids.push('rain-win');
 if(TRACKS.some(t=>a.conditionWins.includes(recordKey(t.id,'night'))))ids.push('night-win');
 const champ=save.championship,heats=[...(champ?.history.flatMap(s=>s.heats) ?? []),...(champ?.heats ?? [])];
 const won=(h:typeof heats[number])=>h.reason==='finish'&&h.finishes.some(f=>f.id==='player'&&f.place===1);
 if(heats.some(won))ids.push('champ-win');
 if(champ?.history.some(s=>s.heats.length===4&&s.heats.every(won)))ids.push('perfect-stage');
 if(champ?.status==='complete'&&champ.history.some(s=>s.stage===TRACKS.length-1&&s.place===1))ids.push('champion');
 a.finishedTracks=TRACKS.map(t=>t.id).filter(id=>a.finishedTracks.includes(id));
 a.conditionWins=routes.filter(id=>a.conditionWins.includes(id));
 return grant(save,ids);
}
// Call once when a result is settled, under the same account transaction and
// receipt as its reward. Non-finishing results still keep combat/stunt feats.
export function awardRaceAchievements(save:SaveData,state:RaceState,id:string,mode:AchievementMode){
 const r=state.riders.find(r=>r.id===id),result=state.multiplayer?.results[id] ?? state.result;
 if(!r||!result)return [];
 const before=new Set(save.achievements?.unlocked ?? []),a=save.achievements ??=normalizeAchievements(null),f=r.feats,ids:AchievementId[]=[];
 const targets=state.riders.filter(other=>other.id!==id&&other.profile!=='police');
 if(targets.length && targets.every(other=>f?.knocked.includes(other.id)))ids.push('all-rivals');
 if(f?.policeDown)ids.push('police');
 if(f?.carJumps.length)ids.push('car-jump');
 if((f?.carJumps.length ?? 0)>=3)ids.push('three-jumps');
 if(f?.terraJump)ids.push('terra-jump');
 if(f?.kneeCurve)ids.push('knee-curve');
 const finish=result.reason==='finish',win=finish&&result.place===1;
 a.winStreak=win?Math.min(3,a.winStreak+1):0;
 if(finish){
  if(result.onFoot)ids.push('on-foot');
  if(f?.clean)ids.push('pristine');
  if(r.integrity<10)ids.push('fragile');
  if(r.bikeId===BICYCLE_ID)ids.push('bicycle-finish');
  const key=recordKey(state.trackId,state.condition),old=save.records[key];
  if(mode!=='multi'&&old&&result.time<old.time)ids.push('record');
  if(!a.finishedTracks.includes(state.trackId))a.finishedTracks.push(state.trackId);
  if(win){
   ids.push(mode==='multi'?'online-win':mode==='championship'?'champ-win':'solo-win');
   if(!a.conditionWins.includes(key))a.conditionWins.push(key);
   if(result.falls>=3)ids.push('comeback-falls');
   if(f?.lastAtHalf)ids.push('last-to-first');
   if(f?.latePass)ids.push('late-pass');
  }
 }
 grant(save,ids);reconcileAchievements(save);
 return a.unlocked.filter(id=>!before.has(id));
}
export function achievementProgress(save:SaveData,id:AchievementId){
 const a=save.achievements;
 if(id==='all-tracks')return `${a?.finishedTracks.length ?? 0} / ${TRACKS.length} pistas`;
 if(id==='all-weather')return `${Math.max(0,...TRACKS.map(t=>CONDITIONS.filter(c=>a?.conditionWins.includes(recordKey(t.id,c.id))).length))} / 4 condições`;
 if(id==='streak')return `${a?.winStreak ?? 0} / 3 vitórias`;
 if(id==='garage')return `${MOTORBIKES.filter(b=>save.owned.includes(b.id)).length} / ${MOTORBIKES.length} motos`;
 return '';
}
// Server-only caller supplies rows from its permanent results table, which
// contains completed races. This is never an import from a client payload.
export function importRecordedAchievements(save:SaveData,rows:{mode:string;track:string;condition:string;place:number}[]){
 const a=save.achievements ??=normalizeAchievements(null),ids:AchievementId[]=[];
 for(const row of rows){
  if(!['solo','multi'].includes(row.mode)||!TRACKS.some(t=>t.id===row.track)||!CONDITIONS.some(c=>c.id===row.condition))continue;
  if(!a.finishedTracks.includes(row.track))a.finishedTracks.push(row.track);
  if(row.place===1){ids.push(row.mode==='multi'?'online-win':'solo-win');const key=recordKey(row.track,row.condition);if(!a.conditionWins.includes(key))a.conditionWins.push(key);}
 }
 grant(save,ids);reconcileAchievements(save);
}
