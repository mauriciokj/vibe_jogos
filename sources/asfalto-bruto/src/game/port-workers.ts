import { PORT_WORKS } from './port';

/** Decorative crew inside the closed half of the road. No collision bodies. */
export const PORT_CREW=PORT_WORKS.flatMap((work,index)=>[
 {id:`worker-${index}-0`,kind:'digging' as const,x:work.side*(work.queue?4.1:5.3),z:work.start+34,side:work.side},
 {id:`worker-${index}-1`,kind:'digging' as const,x:work.side*(work.queue?5.8:6.3),z:work.start+86,side:-work.side},
 ...(work.queue?[{id:`flagger-${index}`,kind:'stop' as const,x:work.side*4.25,z:work.side>0?work.start-18:work.end+18,side:work.side}]:[]),
]);
const cache=new Map<string,HTMLCanvasElement>();
export function portWorker(kind:'digging'|'stop',frame:number,side:number){
 const key=`${kind}/${frame%4}/${side}`;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=100;canvas.height=144;const c=canvas.getContext('2d')!;
 const rect=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
 const line=(p:number[],col:string,w:number)=>{c.strokeStyle=col;c.lineWidth=w;c.lineJoin='round';c.beginPath();for(let i=0;i<p.length;i+=2)i?c.lineTo(p[i],p[i+1]):c.moveTo(p[i],p[i+1]);c.stroke();};
 const digging=kind==='digging',bend=digging?[0,4,9,4][frame%4]:0,lean=digging?side*bend*.45:0;
 line([35,90,32,111,28,134],'#334657',12);line([52,90,55,111,62,134],'#27394a',12);rect(19,132,17,8,'#17232c');rect(55,132,18,8,'#17232c');
 rect(27+lean,48+bend,35,43-bend,'#ee9740');rect(29+lean,52+bend,5,30-bend,'#eff5b3');rect(53+lean,52+bend,5,30-bend,'#eff5b3');rect(27+lean,75,35,5,'#eef1b6');rect(27,88,35,5,'#1e3341');
 rect(35+lean,29+bend,20,20,'#c9986e');rect(33+lean,21+bend,25,18,'#ffc750');rect(29+lean,34+bend,33,5,'#e4ae35');rect(36+lean,24+bend,4,9,'#ffefab');
 if(digging){
  const tx=side>0?77:10,ty=80+bend*2;
  line([32+lean,55+bend,32+side*16,74+bend,tx,ty],'#d7b794',9);line([57+lean,54+bend,55+side*8,74+bend,tx,ty+10],'#e1bc93',9);
  line([tx,ty-13,tx-side*6,132],'#986c43',4);c.fillStyle='#9aafac';c.beginPath();c.moveTo(tx-side*6-6,123);c.lineTo(tx-side*6+7,123);c.lineTo(tx-side*6+5,138);c.lineTo(tx-side*6-5,141);c.closePath();c.fill();rect(20,140,55,4,'#736655');
 }else{
  line([30,54,21,70,24,87],'#e6b583',9);line([59,54,69,68,78,65],'#d9ad80',9);line([79,32,79,131],'#c6cfbc',3);
  c.fillStyle='#b7292e';c.strokeStyle='#fff1da';c.lineWidth=3;c.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,x=77+21*Math.cos(a),y=28+21*Math.sin(a);i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fill();c.stroke();
  c.font='900 12px Arial,sans-serif';c.textAlign='center';c.fillStyle='#fff7e7';c.fillText('PARE',77,32);
 }
 cache.set(key,canvas);return canvas;
}
