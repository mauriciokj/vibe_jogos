// Original cached scenery sprites. Visual hashing never consumes the race RNG.
export function visualHash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export type SceneryKind = 'palm' | 'pine' | 'cactus' | 'rock' | 'bush' | 'building';
const cache = new Map<string, HTMLCanvasElement>();
export function scenerySprite(kind: SceneryKind, variant: number) {
  const key = `${kind}:${variant % 3}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 224;
  const c = canvas.getContext('2d')!;
  const poly = (v: number[], color: string) => { c.fillStyle = color; c.beginPath(); for (let i = 0; i < v.length; i += 2) i ? c.lineTo(v[i], v[i + 1]) : c.moveTo(v[i], v[i + 1]); c.closePath(); c.fill(); };
  const rect = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const stroke = (v: number[], color: string, width: number) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); for (let i = 0; i < v.length; i += 2) i ? c.lineTo(v[i], v[i + 1]) : c.moveTo(v[i], v[i + 1]); c.stroke(); };
  if (kind === 'palm') {
    const tilt = (variant % 3 - 1) * 12;
    poly([90,222,103,222,100,170,94+tilt*.5,120,86+tilt,68,80+tilt,66,84+tilt*.5,124,90,178], '#665346');
    poly([99,222,103,222,100,170,94+tilt*.5,120,86+tilt,68,84+tilt,70,90+tilt*.5,128,96,180], '#c1a178');
    for (let y = 91; y < 220; y += 10) {
      const x = 88 + tilt * (220-y)/165;
      stroke([x-2,y,x+7,y+3], '#3c48413d', 2);
    }
    const ox = 84 + tilt, oy = 69;
    for (let frond = 0; frond < 9; frond++) {
      const angle = frond / 9 * Math.PI * 2;
      const len = 57 + visualHash(frond + variant * 31) * 35;
      const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len * .48;
      const col = ['#294c45', '#37634d', '#487753'][frond % 3];
      const vertices: number[] = [ox, oy];
      for (let j = 1; j <= 6; j++) {
        const t = j / 6; vertices.push(ox + dx * t, oy + dy * t + t * t * 21);
      }
      stroke(vertices, col, 4);
      for (let j = 1; j <= 8; j++) {
        const t = j / 9, x = ox + dx * t, y = oy + dy * t + t*t*21;
        const leaf = Math.sin(t*Math.PI)*18+3;
        stroke([x, y, x - dx * .16 + (frond % 2 ? -1 : 1) * leaf*.4, y + leaf], col, 3.5);
        stroke([x, y, x + dx * .05 + leaf*.28, y - leaf*.5], '#5c8157', 2.5);
      }
    }
    c.fillStyle = '#3e4738'; for (const [x,y] of [[-3,4],[3,7],[7,1]]) { c.beginPath(); c.arc(ox+x,oy+y,5,0,Math.PI*2); c.fill(); }
  } else if (kind === 'pine') {
    rect(90,145,12,79,'#534f44'); rect(99,153,4,70,'#90795b');
    for (let tier = 0; tier < 7; tier++) {
      const top = 9 + tier*23, width = 17 + tier*9;
      poly([96,top,96-width,top+58,96-width*.5,top+53,96-width*.64,top+62,96+width,top+58], ['#2f5045','#355c49','#42694f'][tier%3]);
      poly([96,top,96,top+53,96+width,top+58,96+width*.55,top+38], '#52765c');
      for(let n=0;n<6;n++) { const x=96-width+visualHash(n+tier*7)*width*2; rect(x,top+36+visualHash(n*13+tier)*16,5,2,'#82917345'); }
    }
  } else if (kind === 'cactus') {
    poly([87,222,109,222,109,49,103,40,93,40,87,50], '#517456');
    poly([87,158,56,158,47,146,47,92,54,83,65,88,65,135,87,135], '#416549');
    poly([106,119,139,119,148,109,148,71,140,64,130,71,130,98,107,99], '#4c7252');
    rect(102,50,5,170,'#8eaa67'); rect(58,95,4,45,'#87a66a'); rect(140,76,4,32,'#88a065');
    for (let i=0;i<16;i++) { const y=61+i*9; rect(91,y,2,4,'#304d41'); rect(101,y+3,2,3,'#cad39a'); }
    poly([82,222,111,222,118,215,92,213], '#987556');
  } else if (kind === 'rock') {
    poly([20,222,29,179,68,146,111,148,149,183,173,219], '#8a8171');
    poly([29,179,68,146,111,148,91,183,57,195], '#b5aa8f');
    poly([91,183,111,148,149,183,173,219,104,219], '#6c6d62');
    stroke([65,158,56,184,69,190,59,210], '#5f665956', 3);
    stroke([114,177,132,191,119,210], '#3c53483a', 3);
  } else if (kind === 'bush') {
    for (let i=0;i<35;i++) {
      const x=24+visualHash(i*17+variant)*145, y=181+visualHash(i*29)*32;
      c.fillStyle=['#345e43','#4d7149','#698450'][i%3]; c.beginPath(); c.ellipse(x,y,12+visualHash(i)*8,10,0,0,Math.PI*2); c.fill();
      rect(x-4,y-3,5,2,'#a0a36770');
    }
  } else {
    poly([14,222,14,113,132,113,173,141,173,222], '#d5c2a0');
    poly([132,113,173,141,173,222,132,222], '#ac977f');
    poly([5,116,29,88,137,88,184,139,130,119], '#8e5c4e');
    stroke([17,110,132,110,172,134], '#e7ad76', 4);
    rect(30,142,32,37,'#304c51'); rect(77,143,34,36,'#304c51');
    rect(33,145,24,4,'#9ebbbc'); rect(81,146,25,4,'#9ebbbc');
    rect(77,189,29,33,'#505d57'); rect(82,194,18,12,'#98ac9e');
    rect(22,131,103,5,'#f0dbac'); rect(39,93,69,14,'#304c51');
    c.font='bold 9px monospace'; c.fillStyle='#e9dfb6'; c.fillText('POSTO  /  24H',41,104);
    rect(151,180,15,42,'#be654b'); rect(153,183,11,15,'#d3d9bd');
  }
  cache.set(key,canvas); return canvas;
}
