import { obstacleShape } from './hazards';
import type { Obstacle } from './types';

const cache=new Map<string,HTMLCanvasElement>();
function sprite(kind:Obstacle['kind'],frame=0){
  const key=`${kind}:${frame}`;if(cache.has(key))return cache.get(key)!;
  const canvas=document.createElement('canvas');canvas.width=kind==='fallenTree'?252:72;canvas.height=kind==='fallenTree'?54:64;
  const c=canvas.getContext('2d')!;
  const poly=(points:number[],color:string)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.closePath();c.fill();};
  const line=(points:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.stroke();};
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  if(kind==='fallenTree'){
    line([14,39,60,30,107,39,165,28,232,39],'#302e23',18);
    line([18,33,62,26,109,34,164,23,233,34],'#83553a',15);
    line([27,28,67,23,111,30,163,20,226,29],'#b28151',4);
    line([52,29,47,15,26,9],'#59432b',6);line([105,33,111,13,137,6],'#665034',7);
    line([171,26,191,12,216,13],'#53432b',6);line([193,33,211,45,232,45],'#56412c',5);
    for(let i=0;i<16;i++)line([31+i*12,31+Math.sin(i*1.2)*5,37+i*12,37+Math.sin(i*1.2)*5],'#4d3d2c',2);
    for(const [x,y] of [[18,8],[32,12],[122,8],[141,6],[204,10],[222,14],[239,42]]){
      poly([x-10,y,x-6,y-5,x+5,y-4,x+11,y+3,x+3,y+8,x-8,y+5],'#3b6641');
      c.fillStyle='#78925b';c.fillRect(x-5,y-2,9,3);
    }
    oval(238,34,10,11,'#d1ae73');oval(238,34,7,8,'#a77b4a');oval(238,34,4,5,'#dcbf87');line([238,30,240,37],'#775432',1);
  }else if(kind==='tumbleweed'){
    for(let i=0;i<18;i++){
      const a=i*2.4,rx=18+i%5,ry=17+i%7,x=36+Math.sin(i*8)*4,y=31+Math.cos(i*7)*4;
      c.strokeStyle=i%3?'#b69250':'#765a35';c.lineWidth=i%4?1.5:2.5;c.beginPath();c.ellipse(x,y,rx,ry,a,0,Math.PI*1.83);c.stroke();
      line([36+Math.cos(a)*26,31+Math.sin(a)*26,36+Math.sin(a)*7,31+Math.cos(a)*9,36-Math.cos(a)*24,31-Math.sin(a)*22],i%2?'#d1b06a':'#8f703e',1);
    }
  }else if(kind==='armadillo'){
    line([18,42,4,40,1,37],'#84745d',5);
    for(const [x,y] of [[23,48],[39,49]]){c.fillStyle='#504b40';c.fillRect(x+(frame?3:0),y,5,10);c.fillStyle='#c2b69a';c.fillRect(x+(frame?3:0),y+8,8,2);}
    oval(31,38,23,15,'#5b5e51');oval(31,34,21,13,'#a4a28a');
    for(let i=0;i<7;i++){const x=15+i*5;line([x,26+Math.abs(i-3)*1.5,x-2,34,x,43],'#696e5c',2);c.fillStyle='#c5bca0';c.fillRect(x,29+Math.abs(i-3),2,2);}
    poly([47,34,56,31,69,43,63,46,49,44],'#9b9981');poly([52,33,51,23,56,26,57,33],'#b5aa8e');
    c.fillStyle='#252b27';c.fillRect(57,36,3,3);c.fillRect(67,42,3,3);c.fillStyle='#d4c6a6';c.fillRect(55,45,7,2);
  }else if(kind==='dirtRamp'){
    poly([1,57,9,43,19,37,28,19,43,17,56,33,64,41,71,57],'#795134');
    poly([9,43,28,19,43,17,50,30,29,35,18,49],'#b58249');
    poly([18,49,29,35,50,30,64,41,71,57,1,57],'#9c6a3d');
    for(let i=0;i<20;i++){c.fillStyle=i%2?'#cd9a58':'#6e5135';c.fillRect(8+(i*19)%55,37+(i*13)%20,3+i%3,2);}
    line([22,48,34,31,39,24],'#d3a366',2);
  }else{
    poly([1,57,9,34,60,32,71,57],'#4d3c2c');
    line([8,46,63,44],'#7c5735',18);line([10,37,60,35],'#b08850',4);
    for(let i=0;i<8;i++)line([12+i*6,41,15+i*6,50],'#4c3c2a',2);
    oval(63,44,7,10,'#d4b780');oval(63,44,4,7,'#917046');oval(63,44,2,4,'#d4b780');
    poly([22,35,29,20,38,22,36,34],'#6d5033');line([28,24,30,32],'#b28e55',3);
  }
  cache.set(key,canvas);return canvas;
}
export function drawTrackHazard(c:CanvasRenderingContext2D,o:Obstacle,x:number,y:number,scale:number,time:number,reducedMotion=false){
  if(!['fallenTree','tumbleweed','armadillo','dirtRamp','woodRamp'].includes(o.kind))return false;
  const width=obstacleShape(o).width*scale;
  const height=scale*(o.kind==='fallenTree'?2.25:o.kind==='armadillo'?1.3:o.kind==='tumbleweed'?1.8:1.4);
  c.save();c.fillStyle='#252f285c';c.beginPath();c.ellipse(x,y,width*.5,scale*.23,0,0,Math.PI*2);c.fill();
  c.translate(x,y-height/2);
  if(o.kind==='tumbleweed'&&!reducedMotion){c.translate(0,-Math.abs(Math.sin(time*7))*scale*.22);c.rotate(time*(o.motion?.from===14?-3:3));}
  if(o.kind==='armadillo'&&o.motion && o.motion.to<o.motion.from)c.scale(-1,1);
  c.drawImage(sprite(o.kind,reducedMotion?0:o.kind==='armadillo'?Math.floor(time*9)%2:0),-width/2,-height/2,width,height);c.restore();return true;
}
