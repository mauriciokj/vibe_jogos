import { ACHIEVEMENTS, achievementProgress, type AchievementId } from './game/achievements';
import type { SaveData } from './game/types';
export const medalIcon='<svg class="achievement-medal" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m15 5 17 21L49 5M9 5h12l11 15L43 5h12L39 29M25 29 9 5"/><circle cx="32" cy="42" r="17"/><path d="m32 31 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"/></svg>';
export type AchievementFilter='all'|'earned'|'pending';
export function achievementsMarkup(save:SaveData,filter:AchievementFilter='all'){
 const owned=save.achievements?.unlocked ?? [],count=owned.length;
 return `<div class="dialog-header"><div><div class="eyebrow">HISTÓRIAS QUE FICAM</div><h2 id="achievements-title">Conquistas</h2></div><button class="close-btn" data-close="achievements-modal" aria-label="Fechar conquistas">×</button></div><div class="dialog-body"><div class="achievement-summary">${medalIcon}<div><strong>${count} <span>/ ${ACHIEVEMENTS.length}</span></strong><p>SEU LEGADO NA ESTRADA</p></div><progress max="${ACHIEVEMENTS.length}" value="${count}" aria-label="${count} de ${ACHIEVEMENTS.length} conquistas"></progress></div><nav class="achievement-filters" aria-label="Filtrar conquistas">${([['all','Todas'],['earned','Conquistadas'],['pending','Pendentes']] as const).map(([id,name])=>`<button class="secondary" data-achievement-filter="${id}" aria-pressed="${filter===id}">${name}</button>`).join('')}</nav><div class="achievement-grid">${ACHIEVEMENTS.map((a,index)=>{
  const earned=owned.includes(a.id),secret='secret' in a&&a.secret&&!earned;
  if(filter==='earned'&&!earned || filter==='pending'&&earned)return '';
  return `<article class="achievement-card ${earned?'earned':secret?'secret':''}" data-achievement="${index}"><span class="achievement-stamp" aria-hidden="true">${earned?'✓':secret?'?':'◇'}</span><div><small>${earned?'CONQUISTADA':secret?'SECRETA':'PENDENTE'}</small><h3>${secret?'???':a.name}</h3><p>${secret?'Um segredo da estrada. Descubra jogando.':a.description}</p>${!secret&&!earned&&achievementProgress(save,a.id)?`<b class="achievement-detail">${achievementProgress(save,a.id)}</b>`:''}${a.id==='on-foot'&&earned?'<b class="achievement-detail">MAGRELA DESBLOQUEADA</b>':''}</div></article>`;
 }).join('') || '<p class="achievement-empty">Nenhuma conquista nesta seleção.</p>'}</div><p class="achievement-note">Feitos de corrida são registrados ao terminar ou abandonar a prova. Conectado à conta, suas conquistas acompanham você entre aparelhos. Como convidado, ficam neste navegador.</p></div>`;
}
export function achievementRewardMarkup(ids:AchievementId[]=[]){
 const earned=ACHIEVEMENTS.filter(a=>ids.includes(a.id)&&a.id!=='on-foot');
 return earned.length?`<div class="achievement-rewards" role="status">${medalIcon}<div><strong>${earned.length===1?'CONQUISTA DESBLOQUEADA':'NOVAS CONQUISTAS'}</strong><p>${earned.map(a=>a.name).join(' · ')}</p><button class="text-button" id="view-achievements">VER CONQUISTAS ↗</button></div></div>`:'';
}
