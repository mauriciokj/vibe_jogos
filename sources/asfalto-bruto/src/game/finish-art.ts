import type { RaceCondition } from './types';

const cache=new Map<string,HTMLCanvasElement>();
const shirts=['#f2bb59','#62bccb','#d982a9','#a8cf68','#eee4c6','#b7a0e8'];
export function finishOfficer(striking:boolean,frame:number,side:number){
 const key=`officer/${striking}/${frame%4}/${side}`;if(cache.has(key))return cache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=60;canvas.height=84;const c=canvas.getContext('2d')!;
 if(side<0){c.translate(60,0);c.scale(-1,1);}
 const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 const limb=(p:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.lineJoin='miter';c.beginPath();for(let i=0;i<p.length;i+=2)i?c.lineTo(p[i],p[i+1]):c.moveTo(p[i],p[i+1]);c.stroke();};
 const stride=striking?0:[-5,0,5,0][frame%4],bob=striking?0:frame%2;c.translate(0,bob);
 limb([25,52,22-stride,65,19-stride,78],'#263846',8);limb([32,52,35+stride,65,38+stride,78],'#405566',8);
 rect(13-stride,76,13,6,'#15222c');rect(33+stride,76,13,6,'#15222c');
 rect(19,27,22,29,'#233d52');rect(21,29,17,18,'#b7c6ba');rect(27,31,6,8,'#e8c458');rect(19,51,22,5,'#142632');rect(28,51,6,4,'#c8c9b0');
 limb([21,32,13,42,18,48],'#2d4759',7);rect(16,46,6,6,'#d9ad86');
 const arm=striking?[[39,31,44,20,39,10],[39,31,49,23,54,32],[39,31,48,36,54,38],[39,31,47,29,49,20]][frame%4]:[39,31,45,42,43,49];
 limb(arm,'#38576b',7);const hx=arm[4],hy=arm[5];rect(hx-3,hy-3,6,6,'#dfb78c');
 const tip=striking?[[30,1],[59,13],[59,39],[49,3]][frame%4]:[46,66];limb([hx,hy,tip[0],tip[1]],'#131e28',4);rect(hx-2,hy-2,5,4,'#e0b38c');
 rect(23,9,15,17,'#cda17e');rect(20,5,20,12,'#d7e1d4');rect(20,13,23,6,'#182f41');rect(37,19,4,5,'#deb88d');rect(23,6,3,7,'#f1f1df');rect(25,23,11,3,'#263b4a');
 cache.set(key,canvas);return canvas;
}
export function finishFan(index: number, cheering: boolean, frame: number, condition: RaceCondition) {
  const key=`${index%6}/${cheering}/${frame%3}/${condition==='rain'}`;
  if(cache.has(key))return cache.get(key)!;
  const canvas=document.createElement('canvas');canvas.width=36;canvas.height=56;
  const c=canvas.getContext('2d')!,shirt=shirts[index%6],skin=index%3===0?'#8d5b44':index%3===1?'#cf9970':'#edbd91';
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const limb=(points:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.lineJoin='miter';c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.stroke();};
  const bob=cheering && frame===1?-2:0;c.translate(0,bob);
  rect(12,36,6,16,'#26394b');rect(20,36,6,16,'#32485a');rect(10,51,9,4,'#14252e');rect(21,51,8,4,'#14252e');
  rect(11,22,16,17,shirt);rect(12,25,3,12,'#ffffff26');rect(17,18,6,6,skin);
  for(const side of [-1,1]){
    const x=19+side*7,handX=19+side*(cheering?14:10),handY=cheering?5+frame*3:36;
    limb([x,25,19+side*12,cheering?18:29,handX,handY],shirt,5);rect(handX-2,handY-2,5,5,skin);
  }
  rect(12,9,14,11,skin);rect(11,7,16,5,index%2?'#2b2b32':'#584032');rect(12,11,3,6,'#694c3a');rect(22,12,2,2,'#24333a');
  if(condition==='rain'){
    limb([29,35,29,10],'#b5c4c1',1.5);c.fillStyle=shirt;c.beginPath();c.moveTo(16,12);c.quadraticCurveTo(27,-1,36,12);c.closePath();c.fill();rect(24,6,2,6,'#f3ebd44d');
  } else if(cheering && index%3===0){
    const y=5+frame*3;rect(3,y-3,1,16,'#c7d2bd');rect(4,y-3,10,7,'#e9edcf');rect(4,y-3,4,3,'#25333a');rect(9,y,5,4,'#25333a');
  }
  cache.set(key,canvas);return canvas;
}

export function finishBanner() {
  const key='banner';if(cache.has(key))return cache.get(key)!;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=56;const c=canvas.getContext('2d')!;
  c.fillStyle='#172b32';c.fillRect(0,0,384,56);c.fillStyle='#deff70';c.fillRect(0,0,384,3);c.fillRect(0,53,384,3);
  for(const side of [0,328])for(let x=0;x<7;x++)for(let y=0;y<7;y++){c.fillStyle=(x+y)%2?'#23343a':'#ecebd5';c.fillRect(side+x*8,y*8,8,8);}
  c.font='800 36px "Barlow Condensed",Impact,sans-serif';c.textAlign='center';c.fillStyle='#f3f0dc';c.fillText('CHEGADA',192,40);
  cache.set(key,canvas);return canvas;
}
