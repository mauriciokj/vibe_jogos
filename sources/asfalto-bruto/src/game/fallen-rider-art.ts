import { getHelmet, getHelmetColor } from './helmets';
import type { Rider } from './types';

type V={x:number;y:number;z:number};
type Face={points:V[];color:string};
type Project=(x:number,z:number,height:number)=>{x:number;y:number}|null;
const v=(x:number,y:number,z:number):V=>({x,y,z});
const sub=(a:V,b:V)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const cross=(a:V,b:V)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const unit=(a:V)=>{const n=Math.hypot(a.x,a.y,a.z)||1;return v(a.x/n,a.y/n,a.z/n);};
function shade(hex:string,light:number){
 const rgb=hex.replace('#','');if(rgb.length!==6)return hex;
 return '#'+[0,2,4].map(i=>Math.round(Math.max(0,Math.min(255,parseInt(rgb.slice(i,i+2),16)*light))).toString(16).padStart(2,'0')).join('');
}
/** Small shaded 3D mesh. The fallen body has thickness; it is never a flattened upright sprite. */
export function drawFallenRider(c:CanvasRenderingContext2D,r:Rider,rise:number,project:Project){
 const faces:Face[]=[],down=1-rise,side=(r.recovery?.origin?.lean ?? 0)<0?-1:1;
 const roll=side*down*Math.PI/2,yaw=down*.42,cs=Math.cos(roll),sn=Math.sin(roll),cy=Math.cos(yaw),sy=Math.sin(yaw);
 const transform=(p:V):V=>{
  const x=p.x*cs+(p.y-1.45)*sn,y=-(p.x*sn)+(p.y-1.45)*cs+.4+1.05*rise;
  return v(r.x+x*cy+p.z*sy,Math.max(.025,y),r.z-x*sy+p.z*cy);
 };
 const add=(points:V[],color:string)=>faces.push({points:points.map(transform),color});
 const box=(p:V,s:V,color:string)=>{
  const pts=[v(p.x-s.x,p.y-s.y,p.z-s.z),v(p.x+s.x,p.y-s.y,p.z-s.z),v(p.x+s.x,p.y+s.y,p.z-s.z),v(p.x-s.x,p.y+s.y,p.z-s.z),v(p.x-s.x,p.y-s.y,p.z+s.z),v(p.x+s.x,p.y-s.y,p.z+s.z),v(p.x+s.x,p.y+s.y,p.z+s.z),v(p.x-s.x,p.y+s.y,p.z+s.z)];
  for(const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])add(ids.map(i=>pts[i]),color);
 };
 const limb=(a:V,b:V,radius:number,color:string)=>{
  const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis.z)>.8?v(0,1,0):v(0,0,1))),w=cross(axis,u);
  const ring=(center:V)=>Array.from({length:6},(_,i)=>{const angle=i*Math.PI/3,cs=Math.cos(angle)*radius,sn=Math.sin(angle)*radius;return v(center.x+u.x*cs+w.x*sn,center.y+u.y*cs+w.y*sn,center.z+u.z*cs+w.z*sn);});
  const ar=ring(a),br=ring(b);add([...ar].reverse(),color);add(br,color);
  for(let i=0;i<6;i++)add([ar[i],ar[(i+1)%6],br[(i+1)%6],br[i]],color);
 };
 // Bent knees, boots and forearms remain separate volumes, including the upper leg.
 for(const side of [-1,1]){
  const hip=v(side*.19,1.43,0),knee=v(side*.22,.79,down*(side<0?.34:-.12)),ankle=v(side*.22,.15,down*(side<0?.50:.04));
  limb(hip,knee,.18,'#3f505e');limb(knee,ankle,.145,'#33434f');box(knee,v(.16,.15,.15),'#71808b');
  box(v(ankle.x,ankle.y,ankle.z-.10),v(.16,.15,.27),'#1f2e38');box(v(ankle.x,.035,ankle.z-.10),v(.17,.035,.28),'#879491');
 }
 box(v(0,1.93,0),v(.36,.47,.24),r.color);box(v(0,1.45,0),v(.30,.12,.23),'#243640');
 for(const front of [-1,1]){
  box(v(0,1.99,front*.246),v(.215,.35,.018),'#263b47');
  box(v(0,2.23,front*.272),v(.26,.038,.015),'#dbe5d5');
 }
 for(const side of [-1,1]){
  const near=side*sn>0,shoulder=v(side*(.4-(near?.14*down:0)),2.27,0),elbow=v(side*(near?.23:.47),1.94,-down*.21),wrist=v(side*.20,1.71,-down*.43);
  limb(shoulder,elbow,.13,r.color);limb(elbow,wrist,.11,r.color);box(wrist,v(.10,.11,.10),'#d4ab84');
 }
 limb(v(0,2.33,0),v(0,2.6,0),.12,'#263b47');
 const helmet=getHelmet(r.helmetId),color=getHelmetColor(r.helmetColorId).color,center=v(0,2.79,0);
 // Faceted ellipsoid gives the helmet a rounded silhouette and visible light/shade.
 const rings=Array.from({length:5},(_,j)=>Array.from({length:8},(_,i)=>{
  const lat=-Math.PI/2+j*Math.PI/4,az=i*Math.PI/4;return v(center.x+Math.cos(lat)*Math.cos(az)*.34,center.y+Math.sin(lat)*.36,center.z+Math.cos(lat)*Math.sin(az)*.35);
 }));
 for(let j=0;j<4;j++)for(let i=0;i<8;i++)add([rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]],color);
 box(v(0,2.80,-.30),v(.255,.09,.055),'#1b303d');box(v(-.045,2.835,-.362),v(.17,.024,.009),'#94c4ca');
 if(helmet.id==='cross')box(v(0,2.97,-.22),v(.34,.035,.28),color);
 if(helmet.id==='retro')box(v(0,2.66,-.30),v(.18,.06,.045),'#bb9980');
 if(helmet.id==='racing')box(v(0,2.80,.31),v(.24,.055,.12),'#253743');
 const ground=(x:number,z:number)=>project(x,z,0);
 const length=.52+down*1.12,width=.25+down*.17,shadow=[];
 for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=Math.cos(angle)*length,z=Math.sin(angle)*width;shadow.push(ground(r.x+x*cy+z*sy,r.z-x*sy+z*cy));}
 c.save();c.fillStyle='#12232b62';c.beginPath();shadow.forEach((p,i)=>{if(p)i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.fill();
 const light=unit(v(-.45,.9,-.5));
 const depth=(f:Face)=>f.points.reduce((sum,p)=>sum+p.z-p.y*.45,0)/f.points.length;
 faces.sort((a,b)=>depth(b)-depth(a));
 for(const face of faces){
  const pts=face.points.map(p=>project(p.x,p.z,p.y));if(pts.some(p=>!p))continue;
  const n=unit(cross(sub(face.points[1],face.points[0]),sub(face.points[2],face.points[0])));
  const brightness=.62+Math.max(0,n.x*light.x+n.y*light.y+n.z*light.z)*.55;
  c.fillStyle=shade(face.color,brightness);c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p!.x,p!.y):c.moveTo(p!.x,p!.y));c.closePath();c.fill();
 }
 c.restore();
}
