import type { RaceCondition } from './types';

const sprites = new Map<string, HTMLCanvasElement>();
// Small cached pixel-art poses. This scenery never enters the collision system.
export function mermaidSprite(condition: RaceCondition, frame: number) {
  const key=`${condition}:${frame}`, cached=sprites.get(key);if(cached)return cached;
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=88;
  const c=canvas.getContext('2d')!;
  const rect=(color:string,x:number,y:number,w:number,h:number)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const poly=(color:string,points:number[])=>{c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.closePath();c.fill();};
  const night=condition==='night',rain=condition==='rain',sunset=condition==='sunset';
  if(sunset){poly('#4d6570',[9,77,18,64,35,56,53,60,67,70,76,80]);poly('#819299',[18,65,35,56,53,60,40,66]);}
  if(rain){
    // Only a curved tail breaks the rough surface during a shower.
    poly('#216e78',[29,76,36,62,46,54,55,40,53,28,64,31,68,44,63,59,53,70,47,79]);
    poly('#6ad4c0',[53,30,38,27,31,13,46,17,59,25,67,13,82,9,79,25,65,33]);
    rect('#bcf2db',43,20,6,3);rect('#bcf2db',70,18,5,3);
  }else{
    poly(night?'#328f9a':'#238d8d',[41,52,55,51,62,62,72,65,82,57,85,63,80,74,65,77,51,68,40,66]);
    poly('#6fdac5',[77,65,85,55,93,54,89,64,94,70,82,72,75,70]);
    rect('#87dec6',54,58,7,3);rect('#64c4b5',61,64,8,3);rect('#b2ebcf',53,63,4,2);
    // Long hair, face, shoulders and a shell top form the silhouette.
    poly('#3b3440',[30,20,34,10,44,6,53,10,57,22,54,44,42,48,27,42]);
    rect('#8d4b45',33,15,5,22);rect('#b66c50',36,11,9,4);
    rect('#e8b48c',39,17,12,14);rect('#f5cfa2',40,17,8,10);
    rect('#202e3c',48,21,2,2);rect('#bc7264',47,27,3,2);
    rect('#dfa784',42,30,6,5);
    poly('#e8b48c',[37,33,49,32,54,36,55,49,49,56,39,53,35,40]);
    rect('#bc83a1',37,37,8,6);rect('#c798ba',46,37,8,6);
    rect('#dfa784',32,35,5,18);rect('#f0c29a',30,50,10,4);
    const wave=frame%2*3;
    poly('#edbd98',[52,35,57,35,61,28-wave,66,27-wave,63,35,58,43,53,42]);
    rect('#f2cba0',62,24-wave,4,5);rect('#873e40',30,27,5,18);
  }
  c.strokeStyle=night?'#8eebdb':rain?'#d7eeee':'#c7ede3';c.lineWidth=2;
  for(let i=0;i<3;i++){c.beginPath();c.ellipse(48,79+i*3,25+i*8+frame,2,0,.05,Math.PI*.94);c.stroke();}
  sprites.set(key,canvas);return canvas;
}
