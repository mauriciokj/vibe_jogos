import { HELMETS, HELMET_COLORS, equippedHelmet, getHelmetColor, ownsHelmet } from './game/helmets';
import { helmetPortrait } from './game/helmet-art';
import { money } from './game/content';
import type { SaveData } from './game/types';

export function helmetShop(save: SaveData) {
  const selected=equippedHelmet(save),color=getHelmetColor(save.helmetColorId);
  return `<section class="equipment-shop helmet-shop"><div class="shop-intro"><div class="eyebrow">SEU ESTILO NA ESTRADA</div><h3>Um capacete com a sua cara.</h3><p>Personalização visual para todas as motos, no individual e no multiplayer. Compre o modelo uma vez e escolha a cor de graça. Seus capacetes ficam na garagem após quedas ou prisões.</p></div><div class="shop-equipped">CAPACETE EM USO<span>${selected.name} · ${color.name}</span></div><fieldset class="helmet-palette"><legend>COR · ${color.name.toUpperCase()} <span>TROCA GRATUITA</span></legend><div>${HELMET_COLORS.map(c=>`<button type="button" class="helmet-swatch" data-helmet-color="${c.id}" aria-label="Cor ${c.name}" aria-pressed="${c.id===color.id}" title="${c.name}" style="--helmet-color:${c.color}"><i aria-hidden="true">${c.id===color.id?'✓':''}</i><span>${c.name}</span></button>`).join('')}</div></fieldset><div class="helmet-grid">${HELMETS.map(h=>{
    const owned=ownsHelmet(save,h.id),active=h.id===selected.id;
    return `<article class="helmet-card ${active?'equipped':''}"><img src="${helmetPortrait(h.id,color.id).toDataURL()}" width="288" height="144" alt="Capacete ${h.name} ${color.name.toLowerCase()}, de frente e de costas"/><div class="helmet-views" aria-hidden="true"><span>FRENTE</span><span>COSTAS</span></div><small>${h.price===0?'INCLUÍDO COM O PILOTO':owned?'NA SUA GARAGEM':'COMPRA PERMANENTE'}</small><h4>${h.name}</h4><p>${h.description}</p><button class="secondary" data-helmet="${h.id}" ${active||(!owned&&save.cash<h.price)?'disabled':''}>${active?'✓ EQUIPADO':owned?'EQUIPAR':`COMPRAR · ${money(h.price)}`}</button></article>`;
  }).join('')}</div><p class="shop-note">A cor vale para o modelo equipado e para as prévias acima. Capacetes não alteram os atributos da moto ou a resistência do piloto.</p></section>`;
}
