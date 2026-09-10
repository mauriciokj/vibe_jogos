import { drawHelmet } from './helmet-art';
import type { Rider } from './types';
const cache=new Map<string,HTMLCanvasElement>();
export function pedestrianSprite(r:Rider,frame:number,front:boolean){
 const pose=frame<0?-1:frame%8,key=`${r.color}/${r.helmetId}/${r.helmetColorId}/${pose}/${front}`;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=88;canvas.height=128;const c=canvas.getContext('2d')!;
 const rect=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const line=(p:number[],col:string,w:number)=>{c.strokeStyle=col;c.lineWidth=w;c.lineJoin='miter';c.beginPath();for(let i=0;i<p.length;i+=2)i?c.lineTo(Math.round(p[i]),Math.round(p[i+1])):c.moveTo(Math.round(p[i]),Math.round(p[i+1]));c.stroke();};
 const phase=Math.max(0,pose)*Math.PI/4;
 const limbs=[0,1].map(side=>{
  const stride=pose<0?0:Math.sin(phase+side*Math.PI),depth=stride*(front?1:-1);
  return {side,stride,depth,lift:Math.max(0,stride),hip:side?51:36,shoulder:side?57:31};
 });
 // Fore/aft motion is foreshortened into height, size and overlap. Hip and
 // shoulder lanes stay fixed, so the limbs do not spread sideways like a star jump.
 for(const limb of [...limbs].sort((a,b)=>a.depth-b.depth)){
  const {hip,stride,depth,lift}=limb,kneeY=94-lift*9+depth*3,ankleY=116+depth*4-lift*22;
  line([hip,73,hip,kneeY,hip,ankleY],depth<0?'#263642':'#41515d',11);
  line([hip-2,78,hip-2,kneeY],depth<0?'#40515b':'#71818a',3);
  rect(hip-4,kneeY-3,8,6,'#263b48');
  const width=13+Math.max(0,depth)*3,height=6+Math.max(0,depth)*2;
  rect(hip-width/2,ankleY-2,width,height,'#192934');
  // Raised heels show their soles from behind; the front view shows the toe cap.
  if(!front && stride<-.25)rect(hip-width/2+2,ankleY-1,width-4,height-2,'#82908c');
  else rect(hip-width/2+1,ankleY-1,width-2,2,'#a0acaa');
 }
 const arm=(side:number)=>{
  const {stride,shoulder}=limbs[side],swing=-stride,depth=swing*(front?1:-1),lift=Math.max(0,swing);
  const elbowX=shoulder+(side?2:-2),handX=shoulder+(side?-1:1),elbowY=50+depth*4-lift*5,handY=62+depth*6-lift*20;
  line([shoulder,36,elbowX,elbowY,handX,handY],'#233540',10);
  line([shoulder,36,elbowX,elbowY,handX,handY],r.color,7);
  rect(handX-4,handY-2,8,7,'#d8b38a');rect(handX-4,handY-3,8,3,'#233540');
 };
 const nearArm=(side:number)=>-limbs[side].depth>0;
 for(let side=0;side<2;side++)if(!nearArm(side))arm(side);
 const bob=pose<0?0:Math.round(Math.abs(Math.sin(phase*2))*2);
 c.save();c.translate(0,-bob);
 rect(29,29,29,45,'#253742');rect(29,32,6,35,r.color);rect(53,32,6,35,r.color);rect(32,62,24,14,r.color);
 rect(30,75,28,5,'#1c2e38');
 if(front){rect(42,31,3,32,'#a4b4b5');rect(35,38,5,6,'#dce5c5');rect(47,38,5,6,'#dce5c5');}
 else {rect(36,34,15,3,'#b6c4bf');rect(38,44,13,13,'#dae7d0');rect(42,46,5,9,'#2b4550');}
 drawHelmet(c,r.helmetId,r.helmetColorId,front);c.restore();
 for(let side=0;side<2;side++)if(nearArm(side))arm(side);
 cache.set(key,canvas);if(cache.size>256)cache.delete(cache.keys().next().value!);return canvas;
}
