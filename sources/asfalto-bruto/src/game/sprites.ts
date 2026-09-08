import type { Bike, BikeStyle } from './types';
// Original pixel artwork. Geometry is rasterized once, then scaled by the road renderer.
const cache = new Map<string, HTMLCanvasElement>();
export function bikeSprite(color: string, pose = 'ride', side = 1, police = false, frame = 0, style: BikeStyle = 'street', padColor = '', kneeSide = 0): HTMLCanvasElement {
  const key = `${color}/${pose}/${side}/${police}/${frame}/${style}/${padColor}/${kneeSide}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = 88; canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.translate(44, 0); c.scale(side, 1); c.translate(-44, 0);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
  const poly = (points: number[], fill: string) => { c.fillStyle = fill; c.beginPath(); points.forEach((v, i) => { if (i % 2 === 0) i === 0 ? c.moveTo(v, points[i + 1]) : c.lineTo(v, points[i + 1]); }); c.closePath(); c.fill(); };
  const dark = '#1d2430', shade = '#343b49', metal = '#b2b6b6';
  if (style === 'street') {
  poly([34,83,54,83,58,100,57,120,52,127,36,127,31,120,31,101], '#101922');
  rect(35, 92, 19, 30, '#293540'); rect(36, 99, 17, 23, '#151e26');
  rect(33, 102, 3, 19, '#7e8582'); rect(53, 102, 3, 19, '#3d4c53');
  rect(37, 101, 3, 21, '#49505a'); rect(49, 99, 3, 22, '#0c141d');
  for (let y = 101 + frame * 2; y < 125; y += 6) { rect(37, y, 5, 1, '#4b5559'); rect(45, y + 2, 6, 1, '#3a4750'); }
  poly([29,77,58,77,57,98,50,110,39,110,32,98], '#a2aaa3'); rect(38,95,14,14,'#38444b');
  poly([25, 70, 34, 62, 57, 62, 64, 77, 59, 106, 50, 103, 50, 84, 36, 84, 35, 106, 26, 102], shade);
  rect(19, 85, 9, 24, metal); rect(22, 108, 9, 5, '#566471'); rect(22, 84, 7, 8, '#eff1d9');
  rect(60, 84, 9, 23, metal); rect(59, 108, 9, 5, '#566471'); rect(61, 84, 6, 8, '#eff1d9');
  poly([21,67,30,54,58,54,67,67,62,89,26,89], color);
  poly([21,67,30,62,31,81,26,89], '#45564b');
  poly([58,61,67,67,62,89,57,79], '#7c8c62');
  poly([27,65,34,57,55,57,61,65,56,72,32,72], '#f0ebc7');
  rect(30,73,28,4,'#253039');
  rect(32, 74, 25, 9, dark); rect(30, 87, 30, 7, color);
  rect(35, 84, 21, 6, '#ff775c'); rect(39, 84, 12, 3, '#ffd2a0');
  rect(38, 93, 14, 8, '#e3dfbf'); rect(40, 95, 10, 3, '#5b6771');
  } else drawRearBody(c,color,style,frame);
  c.save();
  const low = style === 'cruiser' || style === 'chopper';
  if (low) { c.translate(-2,14); c.scale(1.045,.86); }
  else if (style === 'sport' || style === 'cafe') { c.translate(0,12); c.scale(1,.86); }
  // Rider boots and trousers wrap around the tank.
  if(kneeSide && pose!=='kick') {
    c.save();c.translate(44,0);c.scale(kneeSide*side,1);c.translate(-44,0);
    poly([28,53,42,51,40,70,31,82,25,86,20,81,26,64],dark);
    rect(21,78,10,10,'#677581');
    // Outside thigh opens toward the asphalt; the boot stays beside the engine.
    poly([48,52,61,54,72,76,84,102,84,110,74,115,66,100,51,77],dark);
    poly([57,78,68,86,79,100,73,108,58,95,51,87],'#465665');
    rect(51,84,12,9,'#75828a');rect(52,91,13,3,'#d0d8c7');
    poly([73,101,82,101,87,107,84,114,75,116,70,110],padColor || '#dfe5cb');
    rect(74,105,8,3,'#f7ffe6');rect(76,112,8,3,'#667b79');
    c.restore();
  } else {
  poly([27, 53, 40, 50, 40, 68, 31, 84, 25, 89, 19, 84, 23, 68], dark);
  if (pose === 'kick') {
    poly([49, 52, 60, 54, 61, 68, 75, 76, 82, 76, 86, 84, 74, 88, 50, 74], dark);
    rect(76, 80, 11, 8, '#566171'); rect(77, 80, 10, 3, '#c3c8c3');
  } else {
    poly([48, 51, 61, 53, 66, 68, 69, 84, 62, 89, 56, 83, 49, 68], dark);
    rect(61, 79, 8, 12, '#526071'); rect(62, 89, 9, 4, '#c3c8c3');
  }
  rect(18, 78, 9, 13, '#526071'); rect(18, 89, 9, 4, '#c3c8c3');
  if(padColor){rect(23,69,10,10,padColor);if(pose!=='kick')rect(58,69,10,10,padColor);}
  }
  // Handlebars and bent arms. Customs draw their raised arms below.
  if (!low) {
  rect(16, 43, 56, 4, '#29303c'); rect(12, 42, 8, 6, '#d4d8ca'); rect(68, 42, 8, 6, '#d4d8ca');
  poly([28, 26, 34, 34, 27, 45, 19, 49, 15, 43, 20, 32], dark);
  rect(14, 41, 8, 7, '#a59c91'); rect(20, 30, 6, 12, color);
  }
  if (pose === 'punch' || pose === 'weapon') {
    poly([55, 25, 62, 28, 68, 38, 78, 31, 83, 36, 73, 48, 63, 48, 55, 37], color);
    rect(76, 29, 10, 9, '#b99789'); rect(82, 27, 5, 7, dark);
    if (pose === 'weapon') { rect(79, 0, 5, 31, '#b3b0a0'); rect(79, 21, 5, 10, '#59504e'); rect(80, 0, 2, 20, '#e4d9b7'); }
  } else if (!low) {
    poly([55, 26, 65, 32, 72, 43, 68, 49, 61, 45, 53, 34], dark);
    rect(65, 41, 8, 7, '#a59c91'); rect(61, 30, 6, 12, color);
  }
  poly([28,27,37,22,51,22,61,27,62,37,57,51,53,61,34,61,28,48,26,35], '#26333d');
  poly([28,27,37,24,38,35,31,42,28,47,26,34], color);
  poly([52,24,61,27,62,36,56,43,52,36], color);
  poly([32,46,39,49,50,49,57,45,53,60,35,60], color);
  rect(34,29,21,3,'#778789'); rect(35,60,19,3,'#17262d');
  poly([29, 30, 34, 32, 34, 52, 39, 60, 32, 59, 27, 45], '#465252');
  poly([55, 28, 59, 30, 56, 53, 50, 60, 49, 57, 53, 44], '#718479');
  rect(35, 28, 2, 15, '#a5b29c'); rect(52,28,2,15,'#a5b29c');
  rect(40,35,10,3,'#e6e4cb'); rect(46,38,3,8,'#e6e4cb'); rect(44,41,3,6,'#e6e4cb');
  rect(38,53,14,2,'#f0e8c6'); rect(41,56,7,2,'#708577');
  // Helmet, visor, reflected stripe.
  poly([31,10,33,5,38,2,50,2,55,5,58,11,57,20,52,25,37,25,32,21], '#16252f');
  poly([33,10,36,5,51,5,55,9,55,15,33,15], '#8a9b9d');
  rect(32, 10, 25, 10, dark); rect(36, 6, 17, 5, '#e2e8d2');
  rect(34, 12, 22, 7, '#424e59'); rect(36, 13, 14, 3, '#728992');
  rect(36, 21, 16, 5, '#242c39'); rect(39, 4, 9, 3, '#fcf7de'); rect(36,7,4,3,'#d9e2d0');
  rect(35,17,19,3,'#b7c6bb'); rect(38,20,14,2,'#5d7981');
  rect(40,23,10,2,'#101c27');
  if (low) {
    // Leather vest, raised bars and outstretched arms distinguish the customs.
    poly([28,27,37,24,51,24,61,28,56,60,34,60], '#292929');
    rect(34,32,21,3,'#8c8476');rect(39,40,12,12,'#d2c7a6');rect(42,43,6,6,'#56382c');
    const barY = style === 'chopper' ? 14 : 30;
    for (const direction of [-1,1]) {
      if (direction === 1 && (pose === 'punch' || pose === 'weapon')) continue;
      c.strokeStyle = '#bdc8c9';c.lineWidth=3;c.beginPath();c.moveTo(44+direction*20,47);c.lineTo(44+direction*31,barY);c.lineTo(44+direction*35,barY);c.stroke();
      c.strokeStyle = '#33363d';c.lineWidth=7;c.beginPath();c.moveTo(44+direction*13,30);c.lineTo(44+direction*23,36);c.lineTo(44+direction*31,barY+2);c.stroke();
      rect(42+direction*31,barY,6,5,'#b99789');
    }
  }
  if (style === 'supermoto') { rect(30,8,29,4,color);rect(29,12,31,3,'#25323c');rect(33,5,23,3,'#e2ead6'); }
  if (style === 'cafe') { rect(34,6,21,8,'#d2bd93');rect(34,17,21,3,'#e2d8bf'); }
  c.restore();
  if (police) { rect(24, 71, 10, 7, '#539ff7'); rect(55, 71, 10, 7, '#ff5d5b'); rect(38, 33, 14, 5, '#e5e8eb'); }
  cache.set(key, canvas); return canvas;
}

function drawRearBody(c: CanvasRenderingContext2D, color: string, style: BikeStyle, frame: number) {
  const r=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const poly=(p:number[],col:string)=>{c.fillStyle=col;c.beginPath();for(let i=0;i<p.length;i+=2)i?c.lineTo(p[i],p[i+1]):c.moveTo(p[i],p[i+1]);c.closePath();c.fill();};
  const slim=style==='supermoto'||style==='cafe',custom=style==='cruiser'||style==='chopper';
  const tire=style==='muscle'||style==='chopper'?32:slim?16:24;
  r(44-tire/2,88,tire,36,'#101820');r(45-tire/2,99,3,24,'#626a6c');
  for(let y=101+frame*2;y<126;y+=6)r(47-tire/2,y,tire-8,2,'#313d44');
  r(44-tire/2-4,89,3,30,'#b7c5c2');r(45+tire/2,89,3,30,'#687b82');
  if(style==='supermoto') {
    poly([28,59,60,59,54,95,34,95], '#445259');r(33,76,5,28,'#e2e5c5');r(52,75,4,30,'#c6cda9');
    poly([30,54,58,54,54,80,47,98,40,98,34,80],color);
    r(36,62,16,14,'#202b33');r(38,82,12,4,'#ff735b');r(39,87,10,9,'#dedbc2');
    r(58,71,7,29,'#c6cecb');r(58,72,7,7,'#28343a');r(23,52,42,4,'#d8ded4');
  } else if(style==='sport') {
    poly([18,62,29,51,59,51,70,62,63,83,52,100,36,100,25,82],color);
    poly([18,62,29,65,27,82,23,84],'#35424d');poly([60,65,70,62,65,85,58,79],'#773c36');
    poly([30,58,58,58,53,78,35,78],'#172630');r(27,81,13,5,'#ff715b');r(48,81,13,5,'#ff715b');
    r(39,90,12,8,'#dfdfc6');r(24,83,7,21,'#c2c9c1');r(58,83,7,21,'#c2c9c1');
    r(24,82,7,7,'#313b48');r(58,82,7,7,'#313b48');
  } else if(custom) {
    r(17,78,8,37,'#c7d1ce');r(63,78,8,37,'#c7d1ce');r(18,79,3,31,'#eff1df');r(64,79,3,31,'#eff1df');
    poly([25,69,32,63,57,63,65,71,64,97,56,108,32,108,24,97],color);
    poly([29,72,59,72,60,90,54,96,33,96,27,90],'#252b2e');
    r(29,96,30,4,'#d9ded2');r(36,98,17,6,'#d16450');r(39,100,11,2,'#ffc592');r(37,106,15,9,'#e3d9ba');
    if(style==='cruiser') {
      r(6,74,20,32,'#262c32');r(62,74,20,32,'#262c32');r(7,75,18,9,color);r(63,75,18,9,color);
      r(7,86,18,2,'#b3aaa0');r(63,86,18,2,'#b3aaa0');r(14,86,3,6,'#c7c7b9');r(70,86,3,6,'#c7c7b9');
      r(26,65,36,8,'#61493d');
    } else {
      r(30,57,3,30,'#cbd3d0');r(56,57,3,30,'#cbd3d0');r(31,57,27,3,'#e5e7d6');r(35,65,18,18,'#513d36');
      r(15,103,8,12,'#6d7f87');r(65,103,8,12,'#6d7f87');
    }
  } else if(style==='muscle') {
    poly([17,65,25,55,63,55,71,65,66,96,58,105,30,105,22,96],color);
    r(26,63,36,20,'#293039');r(19,83,9,30,'#6b7a82');r(60,83,9,30,'#6b7a82');
    r(20,87,8,17,'#c7cfca');r(60,87,8,17,'#c7cfca');r(29,89,30,7,'#ba584b');r(33,90,22,3,'#ff8968');r(38,99,13,7,'#e2d8bb');
  } else {
    poly([28,62,35,56,54,56,61,63,57,93,50,101,37,101,30,91],color);
    r(28,71,32,7,'#8c6248');r(31,78,26,12,'#253137');r(36,90,18,6,'#db7a61');r(39,98,12,8,'#e5d4ab');
    for(const x of [25,60]){r(x,81,3,29,'#c3ccc9');for(let y=83;y<108;y+=4)r(x-1,y,5,2,'#63747b');}
    r(19,90,6,22,'#b8c3c2');r(63,90,6,22,'#b8c3c2');
  }
}

export function bikeFrontSprite(color: string, style: BikeStyle = 'street', pose = 'ride', side = 1, police = false, frame = 0, padColor = '', kneeSide = 0): HTMLCanvasElement {
  const key=`front/${color}/${style}/${pose}/${side}/${police}/${frame}/${padColor}/${kneeSide}`;
  if(cache.has(key))return cache.get(key)!;
  const canvas=document.createElement('canvas');canvas.width=88;canvas.height=128;const c=canvas.getContext('2d')!;
  const r=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const custom=style==='cruiser'||style==='chopper',slim=style==='supermoto'||style==='cafe';
  if(padColor){r(23,65,10,12,padColor);r(55,65,10,12,padColor);}
  if(kneeSide && pose!=='kick'){
    c.strokeStyle='#253842';c.lineWidth=12;c.beginPath();c.moveTo(44,52);c.lineTo(44+kneeSide*22,78);c.lineTo(44+kneeSide*35,109);c.lineTo(44+kneeSide*15,88);c.stroke();
    r(38+kneeSide*35,103,13,12,padColor || '#e5eed5');r(40+kneeSide*35,105,8,3,'#f5ffe9');
  }
  r(slim?38:35,91,slim?12:18,35,'#17222c');r(37,108+frame*3,14,2,'#4a585f');
  r(30,65,5,50,'#b9c6c3');r(54,65,5,50,'#b9c6c3');
  if(style==='cruiser'){r(8,77,19,26,'#31363d');r(61,77,19,26,'#31363d');r(8,77,19,5,color);r(61,77,19,5,color);}
  if(style==='sport'||style==='muscle'){r(22,48,44,45,color);r(30,40,28,21,'#344b59');r(27,70,12,6,'#fff2bb');r(49,70,12,6,'#fff2bb');}
  else{r(slim?32:26,58,slim?24:36,33,color);c.fillStyle='#e9e9d2';c.beginPath();c.arc(44,69,custom?11:8,0,Math.PI*2);c.fill();r(39,64,10,7,'#fff7c5');}
  r(28,26,32,33,'#26323d');r(29,27,7,29,custom?'#5b5048':color);r(53,27,7,29,custom?'#5b5048':color);
  c.strokeStyle='#bac7c5';c.lineWidth=4;c.beginPath();c.moveTo(14,custom?24:44);c.lineTo(30,47);c.lineTo(58,47);c.lineTo(74,custom?24:44);c.stroke();
  c.strokeStyle=custom?'#303039':color;c.lineWidth=8;c.beginPath();
  for(const direction of [-1,1]) {
    if(direction===side&&(pose==='punch'||pose==='weapon'))continue;
    c.moveTo(44+direction*13,32);c.lineTo(44+direction*28,custom?25:46);
  }
  c.stroke();
  c.fillStyle=style==='cafe'?'#d9c59b':'#d4decf';c.beginPath();c.arc(44,17,14,0,Math.PI*2);c.fill();r(32,13,24,10,'#253844');r(34,14,15,3,'#698c97');r(39,29,10,4,'#b89882');
  if(style==='supermoto')r(28,9,32,4,color);
  if(pose==='punch'||pose==='weapon'){c.strokeStyle=color;c.lineWidth=8;c.beginPath();c.moveTo(44,34);c.lineTo(44+side*36,36);c.stroke();if(pose==='weapon')r(side>0?78:5,3,4,36,'#d6cab2');}
  if(pose==='kick'){c.strokeStyle='#29353e';c.lineWidth=9;c.beginPath();c.moveTo(44,70);c.lineTo(44+side*36,85);c.stroke();}
  if(police){r(19,75,10,7,frame%2?'#70b0fa':'#f87d66');r(59,75,10,7,frame%2?'#f87d66':'#70b0fa');}
  cache.set(key,canvas);return canvas;
}

export function bikePortrait(bike: Bike): HTMLCanvasElement {
  const key=`portrait/${bike.id}`;if(cache.has(key))return cache.get(key)!;
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=174;const c=canvas.getContext('2d')!;
  const style=bike.style,custom=style==='cruiser'||style==='chopper',chopper=style==='chopper',sport=style==='sport',supermoto=style==='supermoto';
  const rear=65,front=chopper?275:custom?253:235,axle=132,radius=supermoto?30:style==='muscle'||custom?33:29;
  const r=(x:number,y:number,w:number,h:number,col:string)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const line=(pts:number[],color:string,width:number)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();for(let i=0;i<pts.length;i+=2)i?c.lineTo(pts[i],pts[i+1]):c.moveTo(pts[i],pts[i+1]);c.stroke();};
  const poly=(pts:number[],color:string)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<pts.length;i+=2)i?c.lineTo(pts[i],pts[i+1]):c.moveTo(pts[i],pts[i+1]);c.closePath();c.fill();};
  c.fillStyle='#0e1e2580';c.beginPath();c.ellipse(158,165,139,6,0,0,Math.PI*2);c.fill();
  for(const [x,rad] of [[rear,radius],[front,chopper?27:radius]]){
    c.fillStyle='#0e1822';c.beginPath();c.arc(x,axle,rad,0,Math.PI*2);c.fill();c.strokeStyle='#7d8c90';c.lineWidth=3;c.beginPath();c.arc(x,axle,rad-7,0,Math.PI*2);c.stroke();
    for(let n=0;n<(custom?10:6);n++){const angle=n*Math.PI*2/(custom?10:6);line([x,axle,x+Math.cos(angle)*(rad-10),axle+Math.sin(angle)*(rad-10)],custom?'#b9c5c5':'#617680',custom?1:3);}
    c.fillStyle='#b9c6be';c.beginPath();c.arc(x,axle,5,0,Math.PI*2);c.fill();
  }
  const seatY=supermoto?66:custom?92:78,headX=chopper?186:201,headY=chopper?73:supermoto?57:72;
  line([rear,axle,112,seatY+8,174,axle,rear,axle],custom?'#b9c6c1':'#556973',7);
  line([112,seatY+8,headX,headY,174,axle],custom?'#bec8c5':'#344853',6);
  line([headX,headY,front,axle],custom?'#dce1cf':'#c5d0cb',7);line([headX+7,headY+1,front+4,axle],custom?'#869a9c':'#7f999c',3);
  r(122,99,41,35,'#303b42');r(128,128,29,10,'#687c83');
  if(custom||style==='muscle'){
    poly([117,103,132,94,148,118,137,128],'#a3b3b5');poly([148,118,160,93,176,102,161,129],'#a3b3b5');
    for(let i=0;i<5;i++){line([120+i*3,103+i*4,130+i*3,99+i*4],'#43585f',2);line([158-i*2,98+i*5,170-i*2,103+i*5],'#43585f',2);}
    line([154,116,179,134,93,139], '#d4d8c7',7);line([155,122,179,145,93,148],'#8d9e9e',5);
  }else{for(let i=0;i<5;i++)r(123,102+i*5,37,2,'#99acac');line([159,116,180,143,87,145],'#c1cbc1',6);}
  line([rear+18,axle-9,103,seatY+9],'#c6cec3',4);for(let y=seatY+12;y<125;y+=6)r(91+(125-y)*.35,y,11,2,'#687c7f');
  if(sport){
    poly([106,77,159,58,195,69,219,108,187,142,151,134,176,95,122,91],bike.color);
    poly([192,70,210,71,220,103,208,114,190,91],'#f6dfb5');poly([160,116,191,116,182,136,151,133],'#4a4741');
    poly([186,65,194,43,211,46,222,67],'#597b87');line([196,69,210,72],'#13242f',4);
    poly([43,76,99,67,128,81,87,89],bike.color);r(89,72,34,7,'#23313a');
  }else{
    poly([custom?128:122,seatY-4,144,seatY-20,175,seatY-17,191,seatY+2,162,seatY+15,131,seatY+10],bike.color);
    line([140,seatY-10,172,seatY-9],'#f5e5c080',3);
    if(style==='cafe'){poly([49,75,73,61,101,65,114,81],bike.color);r(81,73,49,10,'#996b4a');}
    else{poly([42,seatY-3,96,seatY-11,133,seatY-1,119,seatY+8,48,seatY+8],supermoto?bike.color:'#28333b');r(83,seatY-5,43,7,custom?'#865c43':'#23343c');}
    if(supermoto){poly([179,84,238,74,262,79,246,86],bike.color);poly([62,75,123,75,118,90,77,90],bike.color);r(109,66,22,5,'#1e323c');}
    else {c.strokeStyle=bike.color;c.lineWidth=7;c.beginPath();c.arc(front,axle,radius+4,Math.PI*1.15,Math.PI*1.83);c.stroke();}
    const barY=chopper?34:custom?59:style==='cafe'?77:58;
    line([headX,headY,headX-3,barY,headX+15,barY],custom?'#cbd2c5':'#7e9398',4);line([headX+9,barY,headX+23,barY],'#1b2933',5);
    c.fillStyle='#dedccc';c.beginPath();c.arc(headX+14,headY+8,custom?10:7,0,Math.PI*2);c.fill();r(headX+17,headY+3,5,10,'#f6eabd');
  }
  if(style==='cruiser'){r(40,88,42,34,'#303537');r(41,89,39,9,bike.color);r(42,103,38,2,'#c1b39c');r(58,101,6,11,'#b8baa8');line([41,85,45,62,72,62,77,87],'#b6c6c2',4);r(48,64,22,18,'#483c35');}
  if(chopper){line([51,95,60,58,81,59,91,90],'#d1d7c9',4);r(64,66,16,22,'#63483d');}
  if(style==='muscle'){poly([45,76,91,67,126,81,94,93,39,91],bike.color);r(78,72,51,8,'#293039');r(190,61,18,19,'#546f7b');}
  r(34,seatY+5,12,5,'#e77960');line([126,134,143,134],'#e0e2ce',4);
  cache.set(key,canvas);return canvas;
}

export function carSprite(color: string, front: boolean, van = false): HTMLCanvasElement {
  const key = `car/${color}/${front}/${van}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 94;
  const c = canvas.getContext('2d')!;
  const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  r(12, 67, 14, 25, '#1e2730'); r(74, 67, 14, 25, '#1e2730');
  c.fillStyle = color; c.beginPath(); c.moveTo(23, van ? 6 : 23); c.lineTo(77, van ? 6 : 23); c.lineTo(87, 51); c.lineTo(95, 55); c.lineTo(95, 81); c.lineTo(5, 81); c.lineTo(5, 55); c.lineTo(13, 51); c.closePath(); c.fill();
  r(26, van ? 13 : 27, 48, van ? 29 : 20, '#2b434d'); r(29, van ? 16 : 30, 24, 3, '#90acb0');
  r(8, 57, 84, 4, '#ffffff35'); r(8, 72, 84, 8, '#3c4750'); r(4, 51, 8, 9, '#344a51'); r(88, 51, 8, 9, '#344a51');
  r(11, 63, 17, 7, front ? '#fff4c0' : '#e66656'); r(72, 63, 17, 7, front ? '#fff4c0' : '#e66656');
  r(41, 75, 18, 6, '#ddd9c1'); r(37, 62, 26, 8, '#52616a');
  cache.set(key, canvas); return canvas;
}
