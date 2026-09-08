import type { RaceState, Rider } from './types';

export const TAUNTS = [
  'Ninguém me pega!', 'Eu sou o melhor!', 'Come poeira!', 'Ficou pra trás!',
  'Tá passeando?', 'Essa estrada é minha!', 'Quero ver acompanhar!',
  'Hoje eu levo essa!', 'Sai da frente!', 'Só vai ver minha placa!',
];
// Independent cosmetic hash: speech never consumes the physics RNG.
function pick(seed: string, count: number) {
  let hash=2166136261;for(const char of seed)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0)%count;
}
export function sayTaunt(state: RaceState, rider: Rider) {
  if(rider.crash || rider.out || rider.finishedAt!==null || (rider.tauntReadyAt ?? 0)>state.time)return;
  const seq=(rider.tauntSeq ?? 0)+1,old=rider.speech?.index;
  let index=pick(`${rider.id}/${state.tick}/${seq}`,TAUNTS.length);
  if(index===old)index=(index+1)%TAUNTS.length;
  rider.speech={index,until:state.time+3};rider.tauntReadyAt=state.time+5;rider.tauntSeq=seq;
}
export function advanceBanter(state: RaceState) {
  if(state.time<(state.nextTauntAt ?? 12))return;
  state.nextTauntAt=state.time+10+pick(`${state.tick}/${state.trackId}`,8);
  const humans=state.riders.filter(r=>r.profile==='player' && !r.out);
  const rivals=state.riders.filter(r=>r.profile!=='player' && r.profile!=='police' && !r.crash && !r.out && r.finishedAt===null && humans.some(h=>Math.abs(h.z-r.z)<100));
  if(rivals.length)sayTaunt(state,rivals[pick(String(state.tick),rivals.length)]);
}
