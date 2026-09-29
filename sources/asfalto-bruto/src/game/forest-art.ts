import type { RaceCondition } from './types';
import { decorHash } from './conditions';
import type { ForestAnimal } from './forest';

const cache=new Map<string,HTMLCanvasElement>();
const foliage=(condition:RaceCondition)=>condition==='night'?['#203d3d','#30534b','#517163']:condition==='rain'?['#254f40','#3e7051','#68926a']:condition==='day'?['#285942','#458052','#7ea65e']:['#325a3c','#658147','#acaa62'];
export function forestSprite(condition:RaceCondition,variant=0) {
  variant=((variant%4)+4)%4;
  const key=`tree:${condition}:${variant}`,cached=cache.get(key);if(cached)return cached;
  const image=document.createElement('canvas');image.width=256;image.height=320;
  const c=image.getContext('2d')!,leaf=foliage(condition),night=condition==='night';
  const line=(points:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.stroke();};
  line([128,318,119+variant*4,205,129,94],night?'#414741':'#6e6350',17);
  line([132,316,128,220,136,110],night?'#637363':'#b6aa75',4);
  line([126,215,77,150,43,130],night?'#3c4b40':'#645c43',9);
  line([126,178,173,130,201,86],night?'#3c4b40':'#645c43',8);
  for(let i=0;i<28;i++){
    const x=43+decorHash(i*53+variant*31)*170,y=31+decorHash(i*79+variant*101)*117;
    c.fillStyle=leaf[i%3];c.beginPath();c.ellipse(x,y,25+decorHash(i+variant)*16,19+i%3*5,0,0,Math.PI*2);c.fill();
    c.fillStyle=leaf[2];c.fillRect(x-13,y-8,14,3);
  }
  // Lianas and roots stay beyond the asphalt, without hiding the racing line.
  for(let i=0;i<3;i++)line([65+i*52,130,62+i*52,177,70+i*52,204],leaf[1],2);
  for(const side of [-1,1])line([127,288,127+side*20,310,127+side*43,318],night?'#435346':'#706847',6);
  for(let i=0;i<10;i++){
    const x=33+i*21,y=312-(i%3)*5;
    line([x,y,x-17,y-23,x-5,y-17,x,y-31,x+5,y-17,x+17,y-24],leaf[i%3],4);
  }
  cache.set(key,image);return image;
}
export type ForestProp='fern'|'bromeliad'|'rocks'|'log'|'mushrooms';
export function forestPropSprite(kind:ForestProp,condition:RaceCondition,variant:number) {
  variant=((variant%3)+3)%3;
  const key=`prop:${kind}:${condition}:${variant}`,cached=cache.get(key);if(cached)return cached;
  const image=document.createElement('canvas');image.width=192;image.height=144;
  const c=image.getContext('2d')!,leaf=foliage(condition),night=condition==='night';
  const stroke=(points:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.stroke();};
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  if(kind==='fern' || kind==='bromeliad'){
    for(let i=0;i<9;i++){
      const angle=-Math.PI*.95+i*Math.PI*.112,x=96+Math.cos(angle)*(65+variant*5),y=130+Math.sin(angle)*103;
      stroke([96,137,(96+x)/2,(137+y)/2-15,x,y],leaf[i%3],kind==='fern'?4:10);
      if(kind==='fern')for(let n=2;n<8;n++){const t=n/9,px=96+(x-96)*t,py=137+(y-137)*t-10*Math.sin(t*Math.PI);stroke([px-12*(1-t),py-8,px,py,px+12*(1-t),py-9],leaf[(i+1)%3],3);}
    }
    if(kind==='bromeliad'){
      stroke([96,135,96,41],leaf[2],5);
      for(let i=0;i<5;i++){oval(89+i%2*13,77-i*10,9,11,night?'#9d7473':i%2?'#ed9763':'#bd5253');}
    }
  }else if(kind==='log'){
    stroke([24,115,165,71],night?'#514a3a':'#796044',31);stroke([24,105,165,62],night?'#74674d':'#b7996b',8);
    oval(25,115,17,23,night?'#998567':'#d2b785');oval(25,115,10,16,night?'#6d604b':'#947149');oval(25,115,5,9,night?'#a39472':'#ceaa74');
    for(let i=0;i<7;i++)stroke([52+i*15,98-i*4,65+i*15,94-i*4],leaf[1],9);
    stroke([126,73,133,39,150,32],night?'#605841':'#94734e',9);
  }else if(kind==='rocks'){
    for(let i=0;i<4;i++){
      const x=30+i*38,y=130-i%2*22;
      c.fillStyle=night?'#52615b':'#879381';c.beginPath();c.moveTo(x-25,y);c.lineTo(x-21,y-35);c.lineTo(x+4,y-55);c.lineTo(x+27,y-31);c.lineTo(x+32,y);c.closePath();c.fill();
      stroke([x-18,y-32,x+1,y-46,x+20,y-28],night?'#798576':'#bec0a0',5);oval(x,y-33,22,8,leaf[1]);
    }
  }else{
    for(let i=0;i<8;i++){
      const x=25+i*20,y=128-i%3*15,h=25+i%2*19;
      stroke([x,y,x+2,y-h],night?'#9b9f83':'#ded5a9',5);oval(x,y-h,14,8,night?'#947d72':i%2?'#b16e51':'#dba571');
      oval(x-4,y-h-2,2,2,'#f0ddab');oval(x+7,y-h-1,2,2,'#f0ddab');
    }
  }
  cache.set(key,image);return image;
}
export function forestCanopySprite(condition:RaceCondition,variant:number) {
  variant=((variant%3)+3)%3;
  const key=`canopy:${condition}:${variant}`,cached=cache.get(key);if(cached)return cached;
  const image=document.createElement('canvas');image.width=512;image.height=192;
  const c=image.getContext('2d')!,leaf=foliage(condition);
  c.lineWidth=12;c.strokeStyle=condition==='night'?'#34473c':'#655e3e';c.beginPath();c.moveTo(0,166);c.bezierCurveTo(115,12,377,36,512,149);c.stroke();
  for(let i=0;i<60;i++){
    const x=20+decorHash(i*37+variant*19)*472,y=15+decorHash(i*61+variant)*100;
    c.fillStyle=leaf[i%3];c.beginPath();c.ellipse(x,y,30+i%4*8,14+i%3*9,-.3,0,Math.PI*2);c.fill();
    if(i%3===0){c.fillStyle=leaf[2];c.fillRect(x-5,y-5,13,2);}
  }
  c.lineWidth=2;c.strokeStyle=leaf[1];
  for(let i=0;i<9;i++){const x=24+i*58;c.beginPath();c.moveTo(x,89);c.bezierCurveTo(x-11,131,x+9,132,x-2,155+i%3*10);c.stroke();}
  cache.set(key,image);return image;
}
export function forestAnimalSprite(kind:ForestAnimal,condition:RaceCondition,frame:number) {
  frame=((frame%2)+2)%2;
  const key=`animal:${kind}:${condition}:${frame}`,cached=cache.get(key);if(cached)return cached;
  const image=document.createElement('canvas');image.width=224;image.height=176;
  const c=image.getContext('2d')!,night=condition==='night',leaf=foliage(condition);
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  const line=(points:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.stroke();};
  const brown=night?'#a2987b':'#b28250',light=night?'#d0c3a1':'#e1bb7a',dark='#393d35',look=frame*3;
  oval(112,167,81,6,'#132e3555');
  if(kind==='capybara'){
    for(const x of [64,91,137,162])line([x,127,x-2,160,x+9,162],brown,13);
    oval(108,113,69,36,brown);oval(157,94+look,39,31,brown);
    oval(174,103+look,27,19,light);oval(140,69+look,10,12,brown);oval(163,69+look,9,11,brown);
    oval(160,88+look,4,4,dark);oval(190,100+look,5,4,dark);
    line([59,100,83,91,117,93],light,4);line([176,118+look,192,115+look],dark,2);
  }else if(kind==='deer'){
    for(const [x,y] of [[68,122],[92,131],[139,128],[157,115]]){line([x,y,x-7,150,x-5,165],brown,7);line([x-6,165,x+1,165],dark,6);}
    oval(104,109,57,26,brown);oval(150,82+look,15,36,brown);oval(163,57+look,22,13,brown);
    oval(154,38+look,7,18,light);oval(174,39+look,6,16,brown);oval(181,60+look,5,4,dark);oval(165,52+look,3,3,dark);
    line([51,102,35,89],light,11);line([140,85,137,114],light,7);
    for(let i=0;i<9;i++)oval(66+i*9,102+i%2*13,2.5,2,light);
  }else if(kind==='anteater'){
    c.fillStyle=night?'#888c7d':'#8b8170';c.beginPath();c.moveTo(99,109);c.bezierCurveTo(55,66,15,92,11,152);c.bezierCurveTo(47,170,65,152,103,142);c.fill();
    for(const x of [86,106,148,163])line([x,124,x+5,158,x+16,162],brown,9);
    oval(117,114,46,29,night?'#b2b09a':'#b5a07b');
    line([134,95,118,129,86,139],dark,15);line([144,97,128,134,100,144],light,5);
    oval(163,106+look,24,15,brown);line([177,110+look,211,131+look],brown,12);oval(213,132+look,4,3,dark);oval(168,102+look,3,3,dark);oval(151,91+look,6,7,brown);
  }else{
    line([116,176,120,110,71,77],night?'#727668':'#8f7651',12);line([83,92,183,98],night?'#909780':'#b09c68',9);
    line([118,87,108,103,117,103,126,87,127,103,136,103],light,3);
    line([102,71,76,116+look],dark,13);oval(116,61,22,35,'#25393d');oval(131,34+look,22,22,'#25393d');oval(137,54+look,12,19,night?'#ddcb83':'#f1d977');
    c.fillStyle=night?'#d3ad70':'#f4b048';c.beginPath();c.moveTo(142,23+look);c.quadraticCurveTo(188,16+look,210,42+look);c.lineTo(145,46+look);c.closePath();c.fill();
    line([166,36+look,199,40+look],'#cf7542',4);oval(203,39+look,8,5,dark);oval(136,29+look,7,7,'#9dd5c6');oval(137,29+look,3,3,dark);
  }
  for(let i=0;i<4;i++)line([30+i*52,171,25+i*52,159,32+i*52,164,39+i*52,153],leaf[1],3);
  cache.set(key,image);return image;
}
export function forestSignSprite(kind:'merge'|'mud'|'hairpin') {
  const key=`sign:${kind}`,cached=cache.get(key);if(cached)return cached;
  const image=document.createElement('canvas');image.width=144;image.height=200;
  const c=image.getContext('2d')!;c.fillStyle='#8e967a';c.fillRect(67,70,10,130);
  c.fillStyle='#eac36e';c.beginPath();c.moveTo(72,3);c.lineTo(138,62);c.lineTo(72,124);c.lineTo(6,62);c.closePath();c.fill();
  c.strokeStyle='#334539';c.lineWidth=7;c.lineCap='round';c.lineJoin='round';c.beginPath();
  if(kind==='merge'){c.moveTo(55,95);c.lineTo(55,33);c.moveTo(87,95);c.lineTo(87,70);c.lineTo(62,48);c.moveTo(43,45);c.lineTo(55,32);c.lineTo(67,45);}
  else if(kind==='hairpin'){c.moveTo(90,95);c.lineTo(90,50);c.bezierCurveTo(90,21,47,21,47,52);c.lineTo(47,74);c.moveTo(34,61);c.lineTo(47,75);c.lineTo(60,61);}
  else{for(let i=0;i<3;i++){c.moveTo(42,43+i*19);c.bezierCurveTo(54,29+i*19,82,57+i*19,103,40+i*19);}}
  c.stroke();c.fillStyle='#dcd0a3';c.fillRect(4,132,136,29);c.fillStyle='#283e33';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(kind==='merge'?'FAIXA TERMINA':kind==='hairpin'?'CURVA FECHADA':'LAMA',72,152);
  cache.set(key,image);return image;
}
export function forestHorizon(c:CanvasRenderingContext2D,w:number,h:number,horizon:number,parallax:number,condition:RaceCondition) {
  const colors=foliage(condition);
  for(let layer=0;layer<3;layer++) {
    c.fillStyle=colors[2-layer];c.beginPath();c.moveTo(-40,horizon+45);
    for(let x=-40;x<w+60;x+=10){const p=x+parallax*(layer+1);c.lineTo(x,horizon-h*(.08+layer*.016)-(Math.sin(p*.013+layer)*.024+Math.abs(Math.sin(p*.07+layer))*.018)*h);}
    c.lineTo(w+60,horizon+45);c.closePath();c.fill();
  }
  if(condition==='rain'){
    const mist=c.createLinearGradient(0,horizon-h*.12,0,horizon+30);mist.addColorStop(0,'#c4dac600');mist.addColorStop(.65,'#b3cfc52d');mist.addColorStop(1,'#b3cfc500');
    c.fillStyle=mist;c.fillRect(0,horizon-h*.12,w,h*.12+30);
  }
}
export function monkeySprite(condition:RaceCondition,frame:number) {
  const key=`monkey:${condition}:${frame%3}`,cached=cache.get(key);if(cached)return cached;
  const image=document.createElement('canvas');image.width=160;image.height=120;
  const c=image.getContext('2d')!,night=condition==='night',wet=condition==='rain',dy=frame%3===1?-4:0;
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  c.strokeStyle=night?'#536353':'#81704a';c.lineWidth=7;c.beginPath();c.moveTo(3,100);c.lineTo(155,82);c.stroke();
  c.strokeStyle=night?'#6f7768':'#946b48';c.lineWidth=6;c.beginPath();c.moveTo(65,75+dy);c.bezierCurveTo(30,65,31,28,17,39);c.bezierCurveTo(5,52,28,61,24,45);c.stroke();
  oval(79,72+dy,18,24,night?'#7c7a67':'#987448');oval(90,47+dy,17,17,night?'#aaa58b':'#c6a774');
  oval(75,46+dy,6,8,'#876448');oval(105,47+dy,6,8,'#876448');oval(91,51+dy,12,10,night?'#c0bca6':'#ead0a2');
  oval(85,45+dy,2,3,'#192f2c');oval(97,45+dy,2,3,'#192f2c');oval(92,52+dy,3,2,'#493e30');
  c.strokeStyle=night?'#92957b':'#b18752';c.lineWidth=7;c.beginPath();c.moveTo(69,64+dy);c.lineTo(59,89);c.lineTo(50,92);c.moveTo(89,69+dy);c.lineTo(111,83);c.moveTo(72,89);c.lineTo(67,96);c.moveTo(90,89);c.lineTo(99,92);c.stroke();
  if(wet){c.strokeStyle='#91ab6b';c.lineWidth=3;c.beginPath();c.moveTo(112,83);c.lineTo(115,18);c.stroke();oval(104,17,41,11,'#4d8058');c.strokeStyle='#a0b87c';c.beginPath();c.moveTo(68,18);c.lineTo(144,15);c.stroke();}
  cache.set(key,image);return image;
}
