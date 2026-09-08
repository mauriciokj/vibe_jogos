import type { RaceCondition } from './types';
export type PortProp = 'crane'|'warehouse'|'containers'|'ship'|'lamp'|'works';
const cache=new Map<string,HTMLCanvasElement>();
export function portSprite(kind:PortProp,condition:RaceCondition,variant=0) {
  variant=((variant%3)+3)%3;
  const key=`${kind}/${condition}/${variant}`,cached=cache.get(key);if(cached)return cached;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=224;
  const c=canvas.getContext('2d')!,night=condition==='night';
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const line=(points:number[],color:string,width=3)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.stroke();};
  const poly=(points:number[],color:string)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.closePath();c.fill();};
  if(kind==='crane') {
    rect(45,214,112,10,'#364c53');line([55,217,76,70,101,70,139,217],'#b0764a',10);
    for(let y=95;y<207;y+=28)line([67-(y-95)*.1,y,109+(y-95)*.19,y+27,65-(y-95)*.1,y+27],'#66564c',4);
    line([18,69,230,34,230,50,18,85,18,69],'#d09a62',5);
    for(let x=24;x<225;x+=24)line([x,80-(x-18)*.16,x+12,67-(x-18)*.16,x+24,76-(x-18)*.16],'#926844',3);
    line([82,68,98,13,222,35,98,13,30,68],'#40565d',2);
    rect(58,63,39,28,'#b98453');rect(67,67,25,13,'#416a78');rect(48,83,60,7,'#344f58');
    line([220,51,220,130,214,137,220,141,225,134],'#354d56',2);
    rect(209,146,23,30,'#557b80');for(let x=211;x<232;x+=5)rect(x,148,2,26,'#82a29b');
  } else if(kind==='warehouse') {
    poly([8,101,90,51,249,101],'#586a6c');poly([8,101,90,51,150,101],'#95a098');
    rect(8,102,240,121,'#a3a79a');rect(145,102,103,121,'#7c8d88');
    for(let x=12;x<245;x+=12)rect(x,107,2,113,'#586d694d');
    rect(29,142,87,81,'#314e57');rect(34,147,77,73,'#536d70');for(let y=151;y<220;y+=9)rect(34,y,77,2,'#7d9087');
    rect(155,124,72,30,'#304953');for(let x=161;x<227;x+=17)rect(x,130,10,17,night?'#f7cd7e':'#accac0');
    rect(37,112,70,19,'#3f565c');rect(42,116,60,2,'#d9cc9d');rect(44,121,44,4,'#d9cc9d');
    rect(17,208,8,15,'#e1b15d');rect(124,208,8,15,'#e1b15d');
    rect(145,211,103,12,'#546f70');
  } else if(kind==='containers') {
    const colors=['#b2684f','#537e82','#b69b5c'];
    for(let row=0;row<2;row++)for(let col=0;col<2;col++) {
      const x=5+col*121+(row===0?5:0),y=106+row*58;
      rect(x,y,118,57,colors[(variant+row+col)%3]);rect(x,y,118,4,'#ddd1a05a');rect(x+113,y,5,57,'#253d5066');
      for(let n=8;n<112;n+=9){rect(x+n,y+6,2,47,'#e9d1a32b');rect(x+n+2,y+6,2,47,'#263d4533');}
      rect(x+9,y+12,22,8,'#dbd9bc');rect(x+13,y+15,14,2,'#5b777a');
    }
  } else if(kind==='ship') {
    poly([3,181,248,181,226,216,39,216],'#273f4e');poly([20,198,237,198,226,216,39,216],'#a3634c');
    for(let row=0;row<2;row++)for(let col=0;col<5;col++) {
      const x=44+col*32,y=143+row*19;rect(x,y,30,18,['#a96a4f','#587f86','#b19b6c'][(row+col)%3]);for(let k=4;k<30;k+=6)rect(x+k,y+2,1,14,'#d9d1b547');
    }
    rect(16,129,28,52,'#c3c6b2');rect(11,130,36,12,'#e1d7b7');rect(16,132,25,6,night?'#f0cb80':'#597e86');
    rect(26,107,5,22,'#425861');rect(28,157,10,24,'#ae6b4f');rect(28,157,10,5,'#2d4a59');
    rect(15,218,228,2,'#a0c4c255');rect(42,222,182,1,'#a0c4c266');
  } else if(kind==='lamp') {
    line([130,223,130,45,101,45],'#687e7f',5);rect(94,43,28,7,'#d0b97a');
  } else {
    rect(122,116,7,108,'#6a7977');poly([128,28,203,97,128,164,53,97],'#343f42');poly([128,37,193,97,128,156,63,97],'#edb458');
    c.fillStyle='#333e42';c.beginPath();c.arc(120,76,8,0,Math.PI*2);c.fill();
    line([119,88,139,108,115,117,105,137],'#333e42',9);line([120,92,103,109,148,122],'#333e42',7);poly([144,126,165,143,133,143],'#333e42');
  }
  if(night || condition==='rain') {
    c.globalCompositeOperation='source-atop';rect(0,0,256,224,night?'#112b4a80':'#37526635');c.globalCompositeOperation='source-over';
  }
  if(kind==='lamp' && (night || condition==='rain')) {
    const glow=c.createRadialGradient(107,50,0,107,50,44);glow.addColorStop(0,'#fff5bbbd');glow.addColorStop(.22,'#ffe8a649');glow.addColorStop(1,'#f9cf7e00');c.fillStyle=glow;c.fillRect(63,6,88,88);rect(96,46,23,5,'#fff1b0');
    poly([97,52,63,224,177,224,118,52],'#f7d4980b');
  }
  if(kind==='crane' && night)rect(95,10,6,5,'#ff9674');
  cache.set(key,canvas);return canvas;
}
export function portHorizon(c:CanvasRenderingContext2D,w:number,h:number,horizon:number,parallax:number,condition:RaceCondition) {
  const night=condition==='night';c.fillStyle=night?'#344e60':'#7b979b';c.fillRect(0,horizon-4,w,h*.22);
  for(let i=0;i<8;i++) {
    const x=i*w/6-parallax*.4,y=horizon-10-(i%3)*9;
    c.fillStyle=night?'#263e53':'#70848a';c.fillRect(x,y,90,60);
    c.strokeStyle=night?'#314d61':'#72868e';c.lineWidth=3;c.beginPath();c.moveTo(x+38,y);c.lineTo(x+38,y-65);c.lineTo(x+115,y-75);c.moveTo(x+102,y-73);c.lineTo(x+102,y-29);c.stroke();
    if(night){c.fillStyle='#d3ab737a';c.fillRect(x+12,y+8,30,2);c.fillStyle='#fa9c77';c.fillRect(x+36,y-67,3,3);}
  }
}
