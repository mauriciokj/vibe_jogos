import { drawHelmet } from './helmet-art';
import type { Rider } from './types';
import type { ArrestPhase } from './arrest';
const cache=new Map<string,HTMLCanvasElement>();
export function arrestPerson(r:Rider,officer:boolean,phase:ArrestPhase,frame:number,side=1){
 const key=`${officer}/${r.color}/${r.helmetId}/${r.helmetColorId}/${phase}/${frame%4}/${side}`;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=88;canvas.height=128;const c=canvas.getContext('2d')!;
 const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 const line=(p:number[],color:string,w:number)=>{c.strokeStyle=color;c.lineWidth=w;c.lineJoin='round';c.beginPath();for(let i=0;i<p.length;i+=2)i?c.lineTo(p[i],p[i+1]):c.moveTo(p[i],p[i+1]);c.stroke();};
 const cuffs=phase==='cuffed',reaching=phase==='cuffing'||cuffs,walk=officer&&phase==='walking'?[-6,0,6,0][frame%4]:0;
 const uniform=officer?'#345367':r.color,skin='#d6ab87';
 line([35,77,33,98+walk,31,119+walk*.4],'#21313e',12);line([52,77,54,98-walk,57,119-walk*.4],'#3a4a54',12);
 rect(22,117+walk*.4,16,9,'#111e28');rect(51,117-walk*.4,18,9,'#152330');
 rect(27,32,35,48,uniform);rect(29,36,6,36,'#ffffff25');rect(27,74,35,8,'#172c36');
 if(officer){rect(29,40,31,8,'#e6edc4');rect(39,53,12,14,'#e0c377');}
 else {rect(39,36,12,28,'#dfe6c0');rect(43,38,4,22,'#293c43');}
 if(officer&&phase==='cuffing'){
  const hand=side<0?12:76,reach=phase==='cuffing'?(frame%2)*2:0;
  line([31,41,hand+side*7,58,hand,73+reach],uniform,9);line([58,41,hand+side*13,62,hand+side*5,76+reach],uniform,9);
  rect(hand-4,70+reach,8,8,skin);rect(hand+side*5-4,73+reach,8,7,skin);
 }else if(!officer&&reaching){
  line([29,40,23,65,39,76],uniform,10);line([59,40,65,65,49,76],uniform,10);
  rect(34,72,11,8,skin);rect(45,72,11,8,skin);
  if(cuffs){c.strokeStyle='#f2f5ed';c.lineWidth=2.5;for(const x of [40,50]){c.beginPath();c.ellipse(x,76,5,4,0,0,Math.PI*2);c.stroke();}line([43,77,47,77],'#a0c1ca',2);}
 }else {line([29,40,22,58-walk*.4,26,77-walk*.4],uniform,10);line([59,40,66,59+walk*.4,61,77+walk*.4],uniform,10);rect(22,73-walk*.4,8,9,skin);rect(57,73+walk*.4,8,9,skin);}
 if(officer){drawHelmet(c,'integral','white',true);rect(40,13,8,5,'#edc75f');}else drawHelmet(c,r.helmetId,r.helmetColorId,false);
 cache.set(key,canvas);return canvas;
}
