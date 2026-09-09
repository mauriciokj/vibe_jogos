import type { SaveData } from './types';

export const HELMETS = [
  {id:'integral',name:'Integral',price:0,description:'Casco fechado, linhas clássicas e faixa central.'},
  {id:'retro',name:'Retrô',price:1500,description:'Casco arredondado e óculos com tira de couro.'},
  {id:'cross',name:'Cross',price:3000,description:'Pala larga, óculos escuros e queixeira alongada.'},
  {id:'racing',name:'Racing',price:5000,description:'Perfil angular, entradas de ar e spoiler traseiro.'},
] as const;
export const HELMET_COLORS = [
  {id:'white',name:'Branco',color:'#e4e9dc'},
  {id:'black',name:'Preto',color:'#424d5a'},
  {id:'red',name:'Vermelho',color:'#ed6557'},
  {id:'orange',name:'Laranja',color:'#f39c48'},
  {id:'yellow',name:'Amarelo',color:'#f1d955'},
  {id:'green',name:'Verde',color:'#96db69'},
  {id:'blue',name:'Azul',color:'#62a9ed'},
  {id:'purple',name:'Roxo',color:'#ba8fe4'},
] as const;
export function getHelmet(id?: unknown) {return HELMETS.find(h=>h.id===id) ?? HELMETS[0];}
export function getHelmetColor(id?: unknown) {return HELMET_COLORS.find(c=>c.id===id) ?? HELMET_COLORS[0];}
export function ownsHelmet(save: SaveData | undefined,id: string) {return id==='integral' || !!save?.ownedHelmets?.includes(id);}
export function equippedHelmet(save?: SaveData) {
  const helmet=getHelmet(save?.helmetId);return ownsHelmet(save,helmet.id)?helmet:HELMETS[0];
}
