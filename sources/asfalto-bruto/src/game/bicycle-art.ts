import { drawHelmet } from './helmet-art';
import { drawHeldWeapon } from './weapon-art';

// Original canvas art: thin tyres, exposed frame, spokes and moving cranks.
// Uses the same 88×128 perspective and helmet system as the motorcycles.
export function bicycleSprite(color:string,pose:string,side:number,frame:number,front:boolean,helmetId:string,helmetColor:string,weaponId:string){
  const canvas=document.createElement('canvas');canvas.width=88;canvas.height=128;
  const c=canvas.getContext('2d')!,phase=frame*Math.PI/4;
  const rect=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
  const line=(pts:number[],col:string,width:number)=>{c.strokeStyle=col;c.lineWidth=width;c.lineJoin='round';c.beginPath();for(let i=0;i<pts.length;i+=2)i?c.lineTo(pts[i],pts[i+1]):c.moveTo(pts[i],pts[i+1]);c.stroke();};
  for(const [y,ry,rx] of [[63,19,4],[108,18,5]]){
    c.strokeStyle='#14252e';c.lineWidth=4;c.beginPath();c.ellipse(44,y,rx,ry,0,0,Math.PI*2);c.stroke();
    c.strokeStyle='#c2cec8';c.lineWidth=1;c.beginPath();c.ellipse(44,y,rx-1,ry-3,0,0,Math.PI*2);c.stroke();
    for(let n=0;n<6;n++){const a=phase+n*Math.PI/3;line([44,y,44+Math.cos(a)*(rx-1),y+Math.sin(a)*(ry-3)],'#849b9e',1);}
  }
  line([43,63,36,87,44,108,52,87,44,63],color,3);
  line([36,87,52,87,44,75,44,108],color,3);
  line([44,61,44,42,22,43,17,47],'#b8c9c4',3);line([44,42,66,43,71,47],'#b8c9c4',3);
  rect(14,45,10,4,'#192a34');rect(64,45,10,4,'#192a34');
  line([44,88,44,65],'#c0ceca',3);rect(33,62,22,5,'#172933');rect(37,62,14,2,'#9f8064');
  rect(40,109,8,4,'#f68056');
  if(pose==='parked')return canvas;
  // Opposite legs travel fore/aft, foreshortened through height and overlap.
  for(const sign of [-1,1]){
    const swing=Math.sin(phase+(sign<0?Math.PI:0)),x=44+sign*13,footY=96+swing*12,kneeY=74+swing*7;
    if(pose==='kick'&&sign===side){line([44+sign*8,58,44+sign*24,71,44+sign*37,85],'#304650',8);rect(sign>0?74:4,82,11,5,'#b2c3bd');continue;}
    line([44+sign*8,57,x,kneeY,x-2*sign,footY],'#223743',9);
    line([44+sign*8,60,x,kneeY],'#526774',3);
    line([44,93,44+sign*15,footY+2],'#a6bab9',2);
    rect(x-7,footY,12,5,'#d5dcc8');rect(x-6,footY+4,13,3,'#20353c');
  }
  const bob=Math.abs(Math.sin(phase))*1.5;c.save();c.translate(0,-bob);
  line([32,27,56,27,56,50,51,61,37,61,30,46,32,27],'#233844',7);
  rect(31,27,6,23,color);rect(51,27,6,23,color);rect(36,49,17,11,color);
  rect(front?42:37,32,front?3:15,3,'#dbe8d1');if(!front){rect(39,38,10,9,'#e5edce');rect(42,40,4,6,'#354e55');}
  for(const sign of [-1,1]){
    if(pose==='celebrate'){line([44+sign*11,30,44+sign*23,23,44+sign*26,9+(frame%2)*3],color,7);rect(41+sign*26,7+(frame%2)*3,6,6,'#ddba92');}
    else if(sign===side&&(pose==='punch'||pose==='weapon')){line([44+sign*12,30,44+sign*25,37,44+sign*37,30],color,7);rect(41+sign*37,28,7,6,'#ddba92');if(pose==='weapon')drawHeldWeapon(c,44+sign*37,28,weaponId);}
    else{line([44+sign*12,30,44+sign*21,37,44+sign*24,46],color,7);rect(41+sign*24,43,7,6,'#ddba92');}
  }
  drawHelmet(c,helmetId,helmetColor,front);c.restore();return canvas;
}

export function bicyclePortrait(color:string){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=174;const c=canvas.getContext('2d')!;
  const line=(pts:number[],col:string,width:number)=>{c.strokeStyle=col;c.lineWidth=width;c.lineJoin='round';c.beginPath();for(let i=0;i<pts.length;i+=2)i?c.lineTo(pts[i],pts[i+1]):c.moveTo(pts[i],pts[i+1]);c.stroke();};
  c.fillStyle='#0e1e2580';c.beginPath();c.ellipse(160,165,136,5,0,0,Math.PI*2);c.fill();
  for(const x of [62,254]){
    c.strokeStyle='#12262f';c.lineWidth=7;c.beginPath();c.arc(x,123,37,0,Math.PI*2);c.stroke();
    c.strokeStyle='#b1c6c5';c.lineWidth=2;c.beginPath();c.arc(x,123,32,0,Math.PI*2);c.stroke();
    for(let i=0;i<16;i++){const a=i*Math.PI/8;line([x,123,x+Math.cos(a)*32,123+Math.sin(a)*32],'#809b9e',1);}
  }
  line([62,123,114,62,146,127,62,123],color,5);
  line([114,62,218,60,146,127,114,62],color,6);
  line([218,60,254,123],color,5);line([222,59,257,122],'#afc7c6',2);
  line([114,62,109,48],'#b5c8c6',4);line([90,47,126,47],'#223940',8);line([92,44,122,44],'#9c7652',2);
  line([218,60,211,35,235,31,246,37,242,48],'#bed2cd',4);line([237,45,249,46],'#23393e',5);
  c.strokeStyle='#b8cac4';c.lineWidth=2;c.beginPath();c.arc(146,127,13,0,Math.PI*2);c.stroke();
  line([62,118,146,114,153,135,62,127,62,118],'#6d878e',2);
  line([133,114,158,142],'#d5decb',3);line([125,114,141,114],'#20393d',5);line([151,143,166,143],'#20393d',5);
  line([254,120,238,75],'#66888e',2);return canvas;
}
