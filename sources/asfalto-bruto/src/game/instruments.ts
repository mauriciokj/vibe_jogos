import { trafficDirection } from './hazards';
import { roadHalf, trafficShape } from './road-profile';
import { tractorSprite } from './rural-art';
import { jumpHeight, stunting } from './stunts';
import { conditionTrack } from './conditions';
import { clamp, curveAt, elevationAt, getBike, getTrack } from './content';
import { MAP_RANGE, MIRROR_RANGE, raceAwareness } from './awareness';
import { bikeFrontSprite, truckSprite } from './sprites';
import { getKneePad, kneeSupport } from './equipment';
import type { RaceState } from './types';

// Small, independent views: they do not rebuild the full scene or change the
// chase camera. Resolution is bounded, including on high-DPI mobile displays.
export class RaceInstruments {
  private route = { id: '', points: [] as {x:number;y:number}[] };
  constructor(private mirror: HTMLCanvasElement, private map: HTMLCanvasElement) {}
  private surface(canvas: HTMLCanvasElement) {
    const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    if (!w || !h) return null;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { c: canvas.getContext('2d')!, w, h };
  }
  draw(state: RaceState, localId: string) {
    this.drawMirror(state,localId); this.drawMap(state,localId);
  }
  private drawMap(state: RaceState, localId: string) {
    const surface = this.surface(this.map); if (!surface) return;
    const {c,w,h} = surface, track = getTrack(state.trackId), awareness = raceAwareness(state,localId);
    const me = state.riders.find(r=>r.id===localId) ?? state.riders[0];
    if (this.route.id !== state.trackId) {
      let heading = 0, x = 0, y = 0;
      const points = [{x,y}];
      for (let z = 20; z <= track.distance; z += 20) {
        heading += curveAt(z,track.id) * .0008 * 20;
        x += Math.sin(heading) * 20; y += Math.cos(heading) * 20;
        points.push({x,y});
      }
      const minX = Math.min(...points.map(p=>p.x)), maxX = Math.max(...points.map(p=>p.x));
      const minY = Math.min(...points.map(p=>p.y)), maxY = Math.max(...points.map(p=>p.y));
      this.route = {id:state.trackId,points:points.map(p=>({x:(p.x-minX)/Math.max(1,maxX-minX),y:(p.y-minY)/Math.max(1,maxY-minY)}))};
    }
    c.clearRect(0,0,w,h); c.fillStyle = '#13272ded'; c.fillRect(0,0,w,h);
    c.textAlign = 'center'; c.font = 'bold 9px monospace'; c.fillStyle = '#b4c8bc'; c.fillText('MAPA · ±300 M',w/2,15);
    const compact=h<160, short=h<120, mapTop=compact?24:30, mapBottom=h-(short?24:compact?37:60);
    const first=clamp(Math.floor((me.z-MAP_RANGE)/20),0,this.route.points.length-1),last=clamp(Math.ceil((me.z+MAP_RANGE)/20),first,this.route.points.length-1);
    const section=this.route.points.slice(first,last+1),xs=section.map(p=>p.x),minX=Math.min(...xs),maxX=Math.max(...xs);
    const screen = (x:number,z:number) => ({x:clamp(18+(x-minX)/Math.max(.00001,maxX-minX)*(w-36),18,w-18),y:mapTop+clamp((me.z+MAP_RANGE-z)/(MAP_RANGE*2),0,1)*(mapBottom-mapTop)});
    const marker = (x:number,z:number) => {
      const n=clamp(z/track.distance,0,1)*(this.route.points.length-1),i=Math.floor(n),a=this.route.points[i],b=this.route.points[Math.min(i+1,this.route.points.length-1)];
      const q=screen(a.x+(b.x-a.x)*(n-i),z);
      q.x+=clamp(x,-roadHalf(state.trackId),roadHalf(state.trackId))*.85;
      return q;
    };
    c.beginPath(); section.forEach((p,i)=>{const q=screen(p.x,(first+i)*20); if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});
    c.strokeStyle = '#5d7475'; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke();
    c.strokeStyle = '#273f44'; c.lineWidth = 2; c.stroke();
    if(track.distance-me.z<=300){const end=screen(this.route.points.at(-1)!.x,track.distance);c.fillStyle='#edf1d7';c.fillRect(end.x-4,end.y-6,8,4);}
    // Nearby riders share progress; small lane offsets keep their markers visible.
    for (const r of awareness.racers.sort((a,b)=>Number(a.local)-Number(b.local))) {
      const rider=state.riders.find(p=>p.id===r.id)!, q=marker(rider.x,rider.z);
      c.globalAlpha=r.out ? .4 : 1; c.fillStyle=r.local?'#deff70':r.color;
      c.beginPath();c.arc(q.x,q.y,r.local?4.5:3,0,Math.PI*2);c.fill();
      if(r.local){c.strokeStyle='#fff';c.lineWidth=1.5;c.stroke();}
    }
    c.globalAlpha=1;
    // A small alternating light bar stays distinct from the round rider dots.
    for(const officer of awareness.police){
      const q=marker(officer.x,officer.z),red=Math.floor(state.time*4)%2===0;
      c.fillStyle='#10252c';c.fillRect(q.x-8,q.y-5,16,10);
      c.strokeStyle='#eef4ec';c.lineWidth=1;c.strokeRect(q.x-8,q.y-5,16,10);
      c.fillStyle=red?'#ff5263':'#702a3a';c.fillRect(q.x-6,q.y-3,6,6);
      c.fillStyle=red?'#25457c':'#58a6ff';c.fillRect(q.x,q.y-3,6,6);
    }
    c.font=`${w<120?8:10}px monospace`; c.textAlign='left';
    if(!compact){c.fillStyle='#deff70';c.fillText(`● VOCÊ · ${(me.z/1000).toFixed(1)}KM`,9,h-42);}
    for (const [i,r] of [awareness.ahead,awareness.behind].entries()) {
      c.fillStyle=r?.color ?? '#9eb3a9';
      const gap=r?`${r.gap>=0?'+':'−'}${Math.abs(r.gap)}m`:'—';
      if(short){
        const x=i?w/2+3:9;
        c.beginPath();c.moveTo(x+3,h-(i?8:15));c.lineTo(x,h-(i?14:9));c.lineTo(x+6,h-(i?14:9));c.closePath();c.fill();
        c.font='8px monospace';c.fillText(gap,x+9,h-9);
      }
      else c.fillText(`${i?'ATRÁS':'FRENTE'} ${gap}`,9,h-25+i*14);
    }
  }
  private drawMirror(state: RaceState, localId: string) {
    const surface = this.surface(this.mirror); if (!surface) return;
    const {c,w,h}=surface, me=state.riders.find(r=>r.id===localId) ?? state.riders[0], track=conditionTrack(getTrack(state.trackId),state.condition);
    c.fillStyle=track.sky[1];c.fillRect(0,0,w,h);c.fillStyle=track.land[1];c.fillRect(0,h*.35,w,h);
    const points:{distance:number;x:number;y:number;scale:number;clip:number}[]=[];
    let dx=0,wx=0,clip=h;
    const project=(distance:number,x:number) => {
      const n=clamp(distance/4-1,0,points.length-1), a=points[Math.floor(n)], b=points[Math.min(Math.floor(n)+1,points.length-1)], t=n-Math.floor(n);
      const p={...a,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,scale:a.scale+(b.scale-a.scale)*t};
      // Reflection keeps a rider on the player's left on the mirror's left.
      return {...p,x:p.x+x*p.scale};
    };
    for(let distance=4;distance<=MIRROR_RANGE;distance+=4){
      dx-=curveAt(me.z-distance,state.trackId)*.0008*4;wx+=dx*4;
      const scale=w*.9/(distance+12);
      const y=h*.36+scale*(3.8+elevationAt(me.z,track.id)-elevationAt(me.z-distance,track.id));
      points.push({distance,x:w/2+(wx-me.x)*scale,y,scale,clip});clip=Math.min(clip,y);
    }
    for(let i=points.length-1;i>0;i--){
      const a=points[i],b=points[i-1];if(a.y>b.y)continue;
      const poly=(left:number,right:number,color:string)=>{c.fillStyle=color;c.beginPath();c.moveTo(a.x+left*a.scale,a.y);c.lineTo(a.x+right*a.scale,a.y);c.lineTo(b.x+right*b.scale,b.y);c.lineTo(b.x+left*b.scale,b.y);c.closePath();c.fill();};
      const half=roadHalf(state.trackId);poly(-half-.6,half+.6,track.theme==='rural'?'#a18a52':'#e1cfad');poly(-half,half,track.road[Math.floor((me.z-a.distance)/8)%2===0?0:1]);
      if(track.theme!=='rural' && Math.floor((me.z-a.distance)/6)%2===0)poly(-.08,.08,'#e9c177');
    }
    const entities=[...state.riders.filter(r=>r.id!==me.id&&!r.out).map(r=>({r,car:null,z:r.z,x:r.x})),...state.traffic.map(car=>({r:null,car,z:car.z,x:car.x}))]
      .filter(e=>me.z-e.z>0&&me.z-e.z<=MIRROR_RANGE).sort((a,b)=>a.z-b.z);
    for(const e of entities){
      const p=project(me.z-e.z,e.x);if(p.y>p.clip+12)continue;
      const size=Math.min(h*.68,p.scale*(e.car?3.3:3.5));
      c.save();c.beginPath();c.rect(0,0,w,Math.min(h,p.clip+12));c.clip();c.translate(p.x,p.y);
      if(e.car?.kind==='tractor'){
        const shape=trafficShape(state.trackId,'tractor'),width=Math.min(h*.68,p.scale*shape.width);c.drawImage(tractorSprite(e.car.color,trafficDirection(e.car)>=0,Math.floor(e.car.z*.8)%2),-width/2,-width*1.08,width,width*1.08);
      }else if(e.car?.kind==='truck'){
        const width=Math.min(h*.68,p.scale*4.5);c.drawImage(truckSprite(e.car.color,trafficDirection(e.car)>=0),-width/2,-width*1.25,width,width*1.25);
      }else if(e.car){
        c.fillStyle=e.car.color;c.fillRect(-size*.5,-size*.65,size,size*.55);
        c.fillStyle='#293e48';c.fillRect(-size*.32,-size*.6,size*.64,size*.22);
        c.fillStyle=trafficDirection(e.car)>=0?'#fff0b8':'#f78061';c.fillRect(-size*.4,-size*.28,size*.2,size*.1);c.fillRect(size*.2,-size*.28,size*.2,size*.1);
      }else if(e.r){
        const r=e.r; c.translate(0,-jumpHeight(r)*p.scale); const support=kneeSupport(r,curveAt(r.z,state.trackId),state.trackId);c.rotate(r.crash?1.2:-(r.lean*(1-support)+support*(r.kneeSide ?? 0)*.59));
        const width=size*88/128;
        c.drawImage(bikeFrontSprite(r.color,getBike(r.bikeId).style,r.attack?.kind ?? 'ride',r.attack?.side ?? 1,r.profile==='police',Math.floor(state.time*8)%3,getKneePad(r.kneePadId)?.color,support>.35?-(r.kneeSide ?? 0):0,r.weaponId,stunting(r),r.helmetId,r.helmetColorId),-width/2,-size,width,size);
      }
      c.restore();
    }
    c.fillStyle='#10252ccf';c.fillRect(0,0,w,15);c.fillRect(0,h-17,w,17);
    c.textAlign='center';c.font=`bold ${w<200?8:9}px monospace`;c.fillStyle='#d9e5ce';c.fillText('RETROVISOR · 200 M',w/2,11);
    const rear=raceAwareness(state,localId).rear.at(-1);
    c.fillStyle=rear?.closing?'#deff70':'#e5eada';
    c.fillText(rear?`${rear.name.slice(0,w<200?11:18)} · ${Math.round(rear.distance)} M${rear.closing?' ↑':''}`:entities.some(e=>e.car)?'TRÂNSITO ATRÁS':'PISTA LIVRE ATRÁS',w/2,h-5);
  }
}
