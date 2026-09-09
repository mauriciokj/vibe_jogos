import type { RaceCondition } from './types';

export type FarmProp = 'tree' | 'house' | 'barn' | 'windmill' | 'hay' | 'tractorSign';
const cache=new Map<string,HTMLCanvasElement>();
function canvas(w:number,h:number) {const image=document.createElement('canvas');image.width=w;image.height=h;return image;}

export function tractorSprite(color: string, front: boolean, frame=0) {
  const key=`tractor:${color}:${front}:${frame%2}`,cached=cache.get(key);if(cached)return cached;
  const image=canvas(112,120),c=image.getContext('2d')!;
  const box=(x:number,y:number,w:number,h:number,fill:string)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
  // Wide, deeply treaded rear tyres and a narrow nose identify farm machinery.
  for(const side of [-1,1]) {
    const x=side<0?5:79;
    box(x,57,28,57,'#252e29');box(x+3,53,22,64,'#303c32');
    for(let y=57;y<110;y+=9){box(x+2,y+(frame%2)*3,8,5,'#4b5140');box(x+18,y+3+(frame%2)*3,8,5,'#101e23');}
    box(x+9,78,10,25,'#81775a');box(x+12,85,5,11,'#c5b481');
    box(side<0?4:76,53,32,8,color);box(side<0?3:75,51,34,3,'#c1c89c');
  }
  box(32,84,48,19,'#414f3a');box(39,97,34,13,'#29362f');
  box(31,26,5,40,'#344635');box(77,26,5,40,'#344635');
  box(29,24,54,5,'#adbc8b');box(25,20,62,6,color);box(29,17,54,4,'#d0c89a');
  box(35,31,43,27,'#536b55');box(38,33,17,21,'#89a296');box(59,33,16,21,'#768e80');
  // A farmer with a straw hat sits above the bonnet in either view.
  box(45,43,23,24,'#b1a17a');box(49,36,15,13,'#a86e4c');box(45,34,24,5,'#d7bd73');box(50,30,13,6,'#b89856');
  if(front){
    box(34,64,44,28,color);box(38,60,36,6,'#a8b981');box(42,68,28,21,'#273f36');
    for(let x=45;x<70;x+=5)box(x,70,2,17,'#a1aa89');
    box(33,68,9,9,'#fff1bd');box(70,68,9,9,'#fff1bd');
    box(30,94,52,6,'#b0aa83');box(37,102,8,11,'#202f2c');box(69,102,8,11,'#202f2c');
    box(71,42,5,23,'#303c35');box(70,40,7,3,'#5c6650');
  }else{
    box(37,66,38,21,color);box(48,68,17,13,'#454f3c');box(27,57,9,6,'#db6450');box(77,57,9,6,'#db6450');
    c.fillStyle='#e39851';c.beginPath();c.moveTo(56,68);c.lineTo(45,86);c.lineTo(67,86);c.closePath();c.fill();
    box(52,95,8,17,'#c0b383');box(47,108,18,4,'#756d50');
  }
  cache.set(key,image);return image;
}

export function farmSprite(kind: FarmProp, condition: RaceCondition, variant=0) {
  const key=`farm:${kind}:${condition}:${variant%2}`,cached=cache.get(key);if(cached)return cached;
  const image=canvas(192,224),c=image.getContext('2d')!;
  const night=condition==='night',wet=condition==='rain';
  const leaf=night?['#354c40','#436047','#526c46']:wet?['#42674c','#557752','#78905a']:['#4e7740','#739047','#97a958'];
  const box=(x:number,y:number,w:number,h:number,fill:string)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
  const poly=(points:number[],color:string)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i+=2)i?c.lineTo(points[i],points[i+1]):c.moveTo(points[i],points[i+1]);c.closePath();c.fill();};
  if(kind==='tree') {
    box(89,116,14,108,night?'#473e35':'#70523a');box(92,144,5,75,'#aa80533b');
    poly([94,148,54,111,64,108,99,135,143,99,147,106,105,150],night?'#473e35':'#70523a');
    for(let i=0;i<11;i++) {
      const x=24+(i*41%119),y=35+(i*23%73),w=40+i%3*10;
      box(x,y,w,46,leaf[i%3]);box(x+7,y-7,w-14,58,leaf[i%3]);
    }
    box(59,54,20,4,leaf[2]);box(114,91,22,4,leaf[2]);
  }else if(kind==='house' || kind==='barn') {
    const barn=kind==='barn';
    box(22,115,145,103,barn?(night?'#503e35':'#9d6247'):(night?'#7b8071':'#e2d4ad'));
    poly([9,119,94,63,180,119],night?'#654734':wet?'#855946':'#ac6545');
    box(29,119,137,7,night?'#3c4236':'#835b40');
    for(let y=136;y<214;y+=13)box(25,y,138,2,barn?'#61493644':'#b9af8744');
    if(barn){
      box(55,135,80,83,'#655742');box(62,143,29,70,'#af9565');box(96,143,31,70,'#947b50');
      poly([63,147,67,143,125,209,120,214],'#d3b27d');poly([123,143,128,147,69,214,64,209],'#d3b27d');
      box(85,87,19,17,'#d9b474');
    }else{
      box(84,159,25,59,'#705942');
      for(const x of [39,124]){box(x,150,24,27,'#56756a');box(x+3,153,18,21,night?'#f7d088':'#b8cdba');box(x+10,150,3,27,'#607161');}
      box(13,193,13,28,'#68573d');box(158,192,13,30,'#68573d');
    }
    box(17,218,159,6,'#a99461');
  }else if(kind==='windmill') {
    poly([88,88,103,88,130,224,122,224,96,104,70,224,61,224],night?'#777f76':'#9c9b78');
    for(let y=145;y<220;y+=22)box(78-(y-145)/5,y,36+(y-145)/2.5,4,'#6e7961');
    const turn=variant%2*Math.PI/8;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+turn,b=a+.29;
      poly([96+Math.cos(a)*14,76+Math.sin(a)*14,96+Math.cos(a)*65,76+Math.sin(a)*65,96+Math.cos(b)*65,76+Math.sin(b)*65,96+Math.cos(b)*17,76+Math.sin(b)*17],night?'#9fa692':'#d4d2aa');
    }
    box(90,70,12,12,'#5d6a59');
  }else if(kind==='hay') {
    for(const [x,y] of [[15,164],[96,164],[55,115]]){
      box(x,y,70,53,night?'#80754a':'#cba964');box(x+5,y-5,60,63,night?'#8c8052':'#d6b875');
      for(let k=0;k<9;k++)box(x+8+k*6,y+4+(k%3)*4,2,40,night?'#6f6740':'#b28e50');
      box(x+16,y-4,4,62,'#857445');box(x+49,y-4,4,62,'#857445');
    }
  }else{
    box(92,108,7,116,'#796d51');poly([96,37,154,93,96,149,38,93],'#c2a266');poly([96,44,147,93,96,142,45,93],'#efd186');
    box(75,82,41,20,'#33463d');box(84,67,6,20,'#33463d');box(84,67,23,5,'#33463d');
    c.fillStyle='#33463d';for(const [x,y,r] of [[80,107,13],[116,109,8]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  }
  cache.set(key,image);return image;
}

export function folkloreSprite(kind:'saci'|'boitata', frame:number) {
  const key=`folklore:${kind}:${frame%3}`,cached=cache.get(key);if(cached)return cached;
  const image=canvas(144,112),c=image.getContext('2d')!;
  if(kind==='saci'){
    c.strokeStyle='#dfc38c80';c.lineWidth=3;
    for(let i=0;i<4;i++){c.beginPath();c.ellipse(73,94-i*9,27-i*4,4,0,0,Math.PI*1.7);c.stroke();}
    c.fillStyle='#72432e';c.fillRect(67,45,18,33);c.fillRect(72,76,7,23);
    c.fillRect(54,50,16,6);c.fillRect(82,49,14,6);c.fillRect(89,40,6,12);
    c.fillStyle='#ae4c38';c.fillRect(65,69,22,12);c.fillStyle='#8b5235';c.fillRect(66,28,21,19);
    c.fillStyle='#d65b43';c.beginPath();c.moveTo(63,28);c.lineTo(70,9);c.lineTo(92+frame%3*2,16);c.lineTo(83,28);c.fill();
    c.fillStyle='#fff0cf';c.fillRect(80,34,3,3);
  }else{
    const points=Array.from({length:23},(_,i)=>({x:10+i*5.3,y:69+Math.sin(i*.47+frame)*12}));
    for(const [width,color] of [[17,'#b94f26'],[10,'#f49d36'],[4,'#ffe99c']] as const){c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}
    for(let i=2;i<23;i+=3){const p=points[i];c.fillStyle='#fac15f';c.beginPath();c.moveTo(p.x-5,p.y-4);c.lineTo(p.x+frame*2,p.y-25-i%4);c.lineTo(p.x+5,p.y-3);c.fill();}
    c.fillStyle='#fff9d4';c.fillRect(120,points.at(-1)!.y-7,4,4);
  }
  cache.set(key,image);return image;
}
