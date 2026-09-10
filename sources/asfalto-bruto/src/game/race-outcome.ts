import type { RaceResult } from './types';

export interface OutcomeDetail { arrestCause?:RaceResult['arrestCause']; exploded?:boolean; }
/** Shared wording for free races, championship results and online races. */
export function raceOutcome(reason:string,detail:OutcomeDetail={}){
 if(reason==='caught')return {label:'PRESO PELA POLÍCIA',description:detail.arrestCause==='fall'?'Você caiu a até 30 metros de um policial e foi preso.':detail.arrestCause==='stopped'?'Você ficou devagar perto de um policial por 3 segundos e foi preso.':'Você foi preso pela polícia durante a corrida.'};
 if(reason==='wrecked')return detail.exploded?{label:'A MOTO EXPLODIU',description:'A moto estava com 0% de integridade e explodiu quando você tentou levantá-la.'}:{label:'MOTO SEM INTEGRIDADE',description:'A integridade da moto chegou a 0%. A corrida terminou porque ela não podia continuar.'};
 if(reason==='left')return {label:'CORRIDA ABANDONADA',description:'Você saiu da corrida antes de cruzar a linha de chegada.'};
 if(reason==='timeout')return {label:'TEMPO ESGOTADO',description:'O tempo máximo da corrida terminou antes de você cruzar a chegada.'};
 return {label:'CORRIDA ENCERRADA',description:'Você não concluiu esta corrida.'};
}
