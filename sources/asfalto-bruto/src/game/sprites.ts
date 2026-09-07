// Original pixel artwork. Geometry is rasterized once, then scaled by the road renderer.
const cache = new Map<string, HTMLCanvasElement>();
export function bikeSprite(color: string, pose = 'ride', side = 1, police = false, frame = 0): HTMLCanvasElement {
  const key = `${color}/${pose}/${side}/${police}/${frame}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = 88; canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.translate(44, 0); c.scale(side, 1); c.translate(-44, 0);
  const rect = (x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
  const poly = (points: number[], fill: string) => { c.fillStyle = fill; c.beginPath(); points.forEach((v, i) => { if (i % 2 === 0) i === 0 ? c.moveTo(v, points[i + 1]) : c.lineTo(v, points[i + 1]); }); c.closePath(); c.fill(); };
  const dark = '#1d2430', shade = '#343b49', metal = '#b2b6b6';
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
  // Rider boots and trousers wrap around the tank.
  poly([27, 53, 40, 50, 40, 68, 31, 84, 25, 89, 19, 84, 23, 68], dark);
  if (pose === 'kick') {
    poly([49, 52, 60, 54, 61, 68, 75, 76, 82, 76, 86, 84, 74, 88, 50, 74], dark);
    rect(76, 80, 11, 8, '#566171'); rect(77, 80, 10, 3, '#c3c8c3');
  } else {
    poly([48, 51, 61, 53, 66, 68, 69, 84, 62, 89, 56, 83, 49, 68], dark);
    rect(61, 79, 8, 12, '#526071'); rect(62, 89, 9, 4, '#c3c8c3');
  }
  rect(18, 78, 9, 13, '#526071'); rect(18, 89, 9, 4, '#c3c8c3');
  // Handlebars and bent arms.
  rect(16, 43, 56, 4, '#29303c'); rect(12, 42, 8, 6, '#d4d8ca'); rect(68, 42, 8, 6, '#d4d8ca');
  poly([28, 26, 34, 34, 27, 45, 19, 49, 15, 43, 20, 32], dark);
  rect(14, 41, 8, 7, '#a59c91'); rect(20, 30, 6, 12, color);
  if (pose === 'punch' || pose === 'weapon') {
    poly([55, 25, 62, 28, 68, 38, 78, 31, 83, 36, 73, 48, 63, 48, 55, 37], color);
    rect(76, 29, 10, 9, '#b99789'); rect(82, 27, 5, 7, dark);
    if (pose === 'weapon') { rect(79, 0, 5, 31, '#b3b0a0'); rect(79, 21, 5, 10, '#59504e'); rect(80, 0, 2, 20, '#e4d9b7'); }
  } else {
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
  if (police) { rect(24, 71, 10, 7, '#539ff7'); rect(55, 71, 10, 7, '#ff5d5b'); rect(38, 33, 14, 5, '#e5e8eb'); }
  cache.set(key, canvas); return canvas;
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
