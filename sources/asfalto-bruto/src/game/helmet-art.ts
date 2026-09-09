import { getHelmet, getHelmetColor } from './helmets';

// Shared pixel geometry for the rider, rear-view mirror and garage previews.
// Coordinates fit the existing 88×128 rider sprite, centred at (44, 16).
export function drawHelmet(c: CanvasRenderingContext2D,id?: string,colorId?: string,front=false) {
  const model=getHelmet(id).id,color=getHelmetColor(colorId).color;
  const r=(x:number,y:number,w:number,h:number,fill:string)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
  const poly=(p:number[],fill:string)=>{c.fillStyle=fill;c.beginPath();for(let i=0;i<p.length;i+=2)i?c.lineTo(p[i],p[i+1]):c.moveTo(p[i],p[i+1]);c.closePath();c.fill();};
  const edge='#15232e',visor='#203746',light='#eef5de';
  if(model==='retro') {
    poly([30,18,30,11,33,6,38,3,50,3,55,6,58,12,58,19,53,25,35,25],edge);
    poly([32,16,32,11,36,6,51,6,55,10,56,17,51,23,36,23],color);
    r(38,5,10,2,light);r(33,9,3,6,'#ffffff48');
    if(front){r(34,17,20,10,'#bc9680');r(31,12,26,10,'#715646');r(33,13,10,7,visor);r(45,13,10,7,visor);r(35,14,6,2,'#94bdc4');r(47,14,5,2,'#94bdc4');r(43,23,3,2,'#72584a');}
    else {r(31,15,26,4,'#6b5142');r(41,15,6,4,'#d1bea0');r(37,21,14,4,'#b3977f');}
    r(34,23,3,5,edge);r(51,23,3,5,edge);
  } else if(model==='cross') {
    poly([30,10,33,5,38,2,51,2,56,6,59,14,56,24,50,29,37,29,31,23],edge);
    poly([32,10,36,5,51,5,56,10,55,22,50,26,38,26,34,22],color);
    r(39,4,10,3,light);r(33,10,3,11,'#ffffff38');
    poly([27,9,32,6,57,6,62,9,61,12,27,12],edge);
    poly([28,8,33,6,56,6,60,9,29,9],color);r(30,7,7,1,light);
    if(front){r(32,13,25,10,edge);r(34,14,21,7,'#172c36');r(36,15,14,2,'#76b5c4');poly([34,23,42,21,47,21,55,23,50,29,38,29],color);r(39,24,11,3,edge);}
    else {r(32,15,25,4,edge);r(37,13,14,3,'#d9e5d3');r(39,21,10,3,'#253b44');r(38,26,12,2,'#9daeb0');}
  } else if(model==='racing') {
    poly([29,13,32,7,38,3,51,3,57,8,60,15,56,25,50,29,36,27,30,21],edge);
    poly([32,12,35,8,40,5,51,6,56,11,57,17,53,24,49,26,37,24,33,19],color);
    poly([39,5,44,5,38,24,34,21],light);poly([47,6,50,6,45,25,42,25],'#263946');
    if(front){poly([31,13,56,11,57,19,53,22,33,20],visor);r(35,14,17,2,'#8ec2d0');r(39,25,12,2,edge);r(53,22,3,3,edge);}
    else {poly([29,18,36,19,54,18,59,15,59,20,53,23,34,23,29,21],edge);r(31,18,24,2,'#e7e9d4');r(39,25,12,2,edge);r(51,9,4,3,edge);}
  } else {
    poly([31,10,33,5,38,2,50,2,55,5,58,11,57,20,52,26,37,26,32,21],edge);
    poly([33,10,36,5,51,5,55,9,55,20,50,23,38,23,34,20],color);
    r(38,4,12,3,light);r(34,8,3,8,'#ffffff48');
    if(front){r(32,11,25,10,visor);r(35,12,18,3,'#7ba4b2');r(38,23,14,3,edge);}
    else {r(42,7,5,15,'#f5f2d8');r(35,15,4,3,'#263a46');r(50,15,4,3,'#263a46');r(36,21,17,3,'#9aadb0');}
    r(39,25,11,2,edge);
  }
}

const portraits=new Map<string,HTMLCanvasElement>();
export function helmetPortrait(id?: string,colorId?: string) {
  const model=getHelmet(id).id,color=getHelmetColor(colorId).id,key=`${model}/${color}`;
  if(portraits.has(key))return portraits.get(key)!;
  const canvas=document.createElement('canvas');canvas.width=288;canvas.height=144;const c=canvas.getContext('2d')!;
  c.imageSmoothingEnabled=false;
  for(const [x,front] of [[5,true],[149,false]] as const){
    c.fillStyle='#07182045';c.beginPath();c.ellipse(x+60,127,43,6,0,0,Math.PI*2);c.fill();
    c.save();c.translate(x-112,10);c.scale(4,4);drawHelmet(c,model,color,front);c.restore();
  }
  portraits.set(key,canvas);return canvas;
}
