(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hypot = Math.hypot;
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const MAP = [
    '####################',
    '#....#.............#',
    '#....#..C..........#',
    '#.......###........#',
    '#...#..............#',
    '#...#.....#........#',
    '#.........#..C.....#',
    '#.####....#........#',
    '#.................##',
    '#..C.....##........#',
    '#........##........#',
    '#.....#............#',
    '#.....#.....####...#',
    '#...........#......#',
    '#..####.....#..C...#',
    '#...........#......#',
    '#...........#......#',
    '#....C.............#',
    '#.............A....#',
    '####################'
  ];
  const MW = MAP[0].length, MH = MAP.length;
  const spawnPoints = [[17.5,2.5],[2.5,2.5],[17.5,17.5],[2.5,16.5],[11.5,2.5],[16.5,10.5],[7.5,17.5]];
  const patrols = [[[2.5,2.5],[7.5,3.5],[3.5,6.5]],[[17.5,2.5],[12.5,4.5],[17.5,7.5]],[[17.5,17.5],[13.5,16.5],[16.5,11.5]],[[2.5,17.5],[8.5,16.5],[3.5,12.5]]];

  const weapons = [
    { name:'VX-9 RAPTOR', kind:'auto', magSize:30, mag:30, reserve:150, rate:.085, reload:1.55, spread:.014, adsSpread:.004, damage:17, recoil:[.010,.013,.015,.017,.019,.022,.020,.024,.026,.021,.028,.024] },
    { name:'ARC-12 VOLT', kind:'charge', magSize:5, mag:5, reserve:25, rate:.7, reload:2.15, spread:0, adsSpread:0, damage:60 },
    { name:'KSG BREACH', kind:'scatter', magSize:8, mag:8, reserve:48, rate:.72, reload:2.0, spread:.105, adsSpread:.065, damage:15 }
  ];
  const fixedPellets = [[0,0],[-.55,-.15],[.55,.15],[-.22,.55],[.22,-.55],[-.72,.5],[.72,-.5],[-.05,.84],[.05,-.84]];
  const recoilSeed = [0.2,-0.35,0.55,-0.15,0.72,-0.62,0.38,-0.8,0.1,0.66,-0.43,0.27];

  let mode = 'menu', last = performance.now(), accumulator = 0, gameTime = 0, fps = 60, frames = 0, fpsClock = 0;
  let W = 960, H = 540, depth = new Float32Array(W), debug = false, paused = false, audio = null;
  let wave = 1, waveDelay = 0, kills = 0, shots = 0, hits = 0, objectsDrawn = 0, culled = 0, humTick = 0;
  let drones = [], projectiles = [], particles = [], decals = [], sounds = [], ammoBoxes = [], contacts = [], lastShotRay = null;
  let weaponIndex = 0, weaponCooldown = 0, reloadTimer = 0, reloadPhase = '', charge = 0, charging = false, muzzle = 0, shake = 0, hitFlash = 0, damageFlash = 0, damageAngle = 0;
  const keys = new Set(), mouse = { fire:false, ads:false, dx:0, dy:0 };
  const player = { x:9.5,z:17.2,y:0,yaw:-Math.PI/2,pitch:0,vx:0,vz:0,vy:0,r:.28,eye:1.58,health:100,lastDamage:-99,step:0, grounded:true, swayX:0,swayY:0,recoil:0,recoilShot:0, fov:Math.PI/3 };

  function isWall(x,z){ const ix=Math.floor(x), iz=Math.floor(z); return ix<0||iz<0||ix>=MW||iz>=MH||MAP[iz][ix]==='#'; }
  function isCover(x,z){ const ix=Math.floor(x), iz=Math.floor(z); return ix>=0&&iz>=0&&ix<MW&&iz<MH&&MAP[iz][ix]==='C'; }
  function blocked(x,z){ return isWall(x,z)||isCover(x,z); }
  function floorHeight(x,z){
    // A shallow stair and two ramps exercise step/slope handling without changing the map topology.
    if(x>13&&x<16&&z>17&&z<19) return Math.floor((x-13)*4)*.08;
    if(x>7&&x<10&&z>4&&z<6) return (x-7)*.18;
    if(x>2&&x<3.3&&z>8&&z<9.5) return (x-2)*1.1;
    return 0;
  }
  function floorSlope(x,z){ if(x>2&&x<3.3&&z>8&&z<9.5)return 1.1;return x>7&&x<10&&z>4&&z<6 ? .18 : 0; }
  function lineClear(ax,az,bx,bz){
    const d=hypot(bx-ax,bz-az), n=Math.ceil(d/.12);
    for(let i=1;i<n;i++){const t=i/n;if(blocked(lerp(ax,bx,t),lerp(az,bz,t)))return false;} return true;
  }

  function resize(){
    const dpr=Math.min(devicePixelRatio||1,1.5), cssW=innerWidth, cssH=innerHeight;
    W=Math.max(480,Math.floor(cssW*dpr)); H=Math.max(270,Math.floor(cssH*dpr));
    canvas.width=W; canvas.height=H; depth=new Float32Array(W);
  }
  addEventListener('resize',resize); resize();

  function initAudio(){
    if(audio) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
    const ac=new AC(), master=ac.createGain(); master.gain.value=.28; master.connect(ac.destination); audio={ac,master};
  }
  function tone(type,freq,duration,volume=.15,endFreq=freq,pan=0){
    if(!audio)return; const {ac,master}=audio, now=ac.currentTime, osc=ac.createOscillator(), gain=ac.createGain(), p=ac.createStereoPanner();
    osc.type=type; osc.frequency.setValueAtTime(freq,now); osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),now+duration);
    gain.gain.setValueAtTime(volume,now); gain.gain.exponentialRampToValueAtTime(.001,now+duration); p.pan.value=clamp(pan,-1,1);
    osc.connect(gain); gain.connect(p); p.connect(master); osc.start(); osc.stop(now+duration);
  }
  function noise(duration=.08,volume=.16,pan=0){
    if(!audio)return; const {ac,master}=audio, n=Math.ceil(ac.sampleRate*duration), buf=ac.createBuffer(1,n,ac.sampleRate), a=buf.getChannelData(0);
    for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n); const src=ac.createBufferSource(),g=ac.createGain(),p=ac.createStereoPanner();src.buffer=buf;g.gain.value=volume;p.pan.value=pan;src.connect(g);g.connect(p);p.connect(master);src.start();
  }
  function sound(kind,pan=0){
    if(kind==='rifle'){noise(.045,.18,pan);tone('square',115,.07,.12,55,pan)}
    if(kind==='charge'){tone('sawtooth',180,.22,.18,70,pan);noise(.12,.18,pan)}
    if(kind==='shotgun'){noise(.13,.28,pan);tone('sine',82,.18,.2,35,pan)}
    if(kind==='impact'){noise(.04,.08,pan);tone('triangle',420,.045,.05,160,pan)}
    if(kind==='explode'){noise(.32,.25,pan);tone('sine',75,.4,.25,28,pan)}
    if(kind==='step')tone('sine',90,.045,.035,55,pan);
    if(kind==='reload'){tone('square',290,.035,.035,210);setTimeout(()=>tone('square',440,.05,.035,260),140)}
    if(kind==='hurt')tone('sawtooth',95,.15,.12,48);
  }

  function resetGame(){
    Object.assign(player,{x:9.5,z:17.2,y:0,yaw:-Math.PI/2,pitch:0,vx:0,vz:0,vy:0,health:100,lastDamage:-99,step:0,grounded:true,recoil:0,recoilShot:0,fov:Math.PI/3});
    weapons.forEach((w,i)=>{w.mag=w.magSize;w.reserve=[150,25,48][i]});
    weaponIndex=0;weaponCooldown=reloadTimer=charge=muzzle=shake=hitFlash=damageFlash=0;charging=false;reloadPhase='';
    wave=1;waveDelay=0;kills=shots=hits=0;gameTime=0;drones=[];projectiles=[];particles=[];decals=[];sounds=[];ammoBoxes=[];contacts=[];spawnWave();updateHUD();
  }

  function startGame(){
    initAudio(); if(audio?.ac.state==='suspended')audio.ac.resume(); resetGame(); mode='play';paused=false;
    $('menu').hidden=true;$('summary').hidden=true;$('hud').hidden=false;$('pause').hidden=true;
  }
  $('start-btn').addEventListener('click',startGame);$('restart-btn').addEventListener('click',startGame);
  function requestLock(){try{const pending=canvas.requestPointerLock?.();pending?.catch?.(()=>{})}catch(_err){/* pointer lock is optional in automated browsers */}}
  canvas.addEventListener('click',()=>{if(mode==='play'&&document.pointerLockElement!==canvas)requestLock()});
  document.addEventListener('pointerlockchange',()=>{if(mode==='play'){paused=document.pointerLockElement!==canvas;$('pause').hidden=!paused;mouse.fire=false}});
  $('pause').addEventListener('click',requestLock);
  document.addEventListener('mousemove',(e)=>{if(mode==='play'&&!paused&&document.pointerLockElement===canvas){mouse.dx+=e.movementX||0;mouse.dy+=e.movementY||0}});
  document.addEventListener('mousedown',(e)=>{if(e.button===0)mouse.fire=true;if(e.button===2)mouse.ads=true});
  document.addEventListener('mouseup',(e)=>{if(e.button===0)mouse.fire=false;if(e.button===2)mouse.ads=false});
  document.addEventListener('contextmenu',(e)=>e.preventDefault());
  document.addEventListener('keydown',(e)=>{
    keys.add(e.code);if(e.code==='F1'){e.preventDefault();debug=!debug;$('debug').style.display='none'}
    if(e.code==='KeyR')beginReload(); if(/^Digit[123]$/.test(e.code))switchWeapon(+e.code.slice(-1)-1);
    if(e.code==='KeyF')toggleFullscreen();
  });
  document.addEventListener('keyup',(e)=>keys.delete(e.code));
  function toggleFullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()}

  function spawnWave(){
    const count=2+wave*2;
    for(let i=0;i<count;i++){
      const s=spawnPoints[(i+wave)%spawnPoints.length], route=patrols[i%patrols.length];
      drones.push({id:`D${wave}-${i+1}`,x:s[0]+(i%2)*.14,z:s[1]+((i+1)%2)*.14,yaw:0,r:.3,hp:70+wave*8,state:'PATRULHA',stateTime:0,patrol:route,patrolI:i%route.length,path:[],pathI:0,lastKnown:null,lastSeen:-99,suspicion:null,reaction:.45+Math.random()*.35,shotCd:.8+Math.random(),contact:0,role:i<2?'frente':'flanco',cover:null,hum:Math.random()*TAU});
    }
    $('wave').textContent=`ONDA ${String(wave).padStart(2,'0')}`;
  }

  function addSound(x,z,r,type){sounds.push({x,z,r,type,t:.7});}
  function switchWeapon(i){if(i===weaponIndex||i<0||i>2)return;weaponIndex=i;reloadTimer=0;charging=false;charge=0;player.recoilShot=0;tone('square',250,.04,.035,380);updateHUD()}
  function beginReload(){const w=weapons[weaponIndex];if(reloadTimer||w.mag>=w.magSize||w.reserve<=0)return;reloadTimer=w.reload;reloadPhase='ejetando';charging=false;sound('reload')}

  function resolvePlayerMove(dx,dz){
    const dist=hypot(dx,dz), slices=Math.max(1,Math.ceil(dist/(player.r*.45)));dx/=slices;dz/=slices;contacts=[];
    for(let s=0;s<slices;s++){
      let nx=player.x+dx,nz=player.z+dz;
      for(let iter=0;iter<5;iter++){
        let best=null;
        for(let iz=Math.floor(nz-player.r)-1;iz<=Math.floor(nz+player.r)+1;iz++)for(let ix=Math.floor(nx-player.r)-1;ix<=Math.floor(nx+player.r)+1;ix++){
          if(ix<0||iz<0||ix>=MW||iz>=MH||(MAP[iz][ix]!=='#'&&MAP[iz][ix]!=='C'))continue;
          const qx=clamp(nx,ix,ix+1),qz=clamp(nz,iz,iz+1),vx=nx-qx,vz=nz-qz,d=hypot(vx,vz);
          if(d<player.r){
            let ax=vx,az=vz;if(d<1e-6){const dl=Math.abs(nx-ix),dr=Math.abs(ix+1-nx),dt=Math.abs(nz-iz),db=Math.abs(iz+1-nz),m=Math.min(dl,dr,dt,db);ax=m===dl?-1:m===dr?1:0;az=m===dt?-1:m===db?1:0;}
            const l=hypot(ax,az)||1,pen=player.r-d+.0005,c={nx:ax/l,nz:az/l,pen};if(!best||pen>best.pen)best=c;
          }
        }
        if(!best)break;nx+=best.nx*best.pen;nz+=best.nz*best.pen;contacts.push({x:nx,z:nz,nx:best.nx,nz:best.nz});
      }
      player.x=nx;player.z=nz;
    }
  }

  function updatePlayer(dt){
    player.yaw+=mouse.dx*.0022;player.pitch=clamp(player.pitch-mouse.dy*.0017,-.58,.58);
    player.swayX=lerp(player.swayX,clamp(mouse.dx*.7,-16,16),1-Math.exp(-dt*8));player.swayY=lerp(player.swayY,clamp(mouse.dy*.55,-12,12),1-Math.exp(-dt*8));mouse.dx=mouse.dy=0;
    const f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0), r=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0), sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const len=hypot(f,r)||1,speed=(sprint?4.9:3.35), targetX=(Math.cos(player.yaw)*f+Math.cos(player.yaw+Math.PI/2)*r)/len*speed,targetZ=(Math.sin(player.yaw)*f+Math.sin(player.yaw+Math.PI/2)*r)/len*speed;
    const accel=1-Math.exp(-dt*14);player.vx=lerp(player.vx,targetX,accel);player.vz=lerp(player.vz,targetZ,accel);
    resolvePlayerMove(player.vx*dt,player.vz*dt);
    const fh=floorHeight(player.x,player.z), diff=fh-player.y;
    if(diff<=.42)player.y=lerp(player.y,fh,1-Math.exp(-dt*18));
    else { player.vx*=.25;player.vz*=.25; }
    if(Math.atan(Math.abs(floorSlope(player.x,player.z)))>.72){player.vx-=Math.sign(floorSlope(player.x,player.z))*2.2*dt;}
    if(hypot(player.vx,player.vz)>1.2){player.step+=dt*(sprint?2.8:2);if(player.step>1){player.step=0;sound('step');addSound(player.x,player.z,sprint?5.5:3.1,'passo')}}
    const targetFov=mouse.ads?Math.PI/4.6:Math.PI/3;player.fov=lerp(player.fov,targetFov,1-Math.exp(-dt*9));
    player.recoil=lerp(player.recoil,0,1-Math.exp(-dt*7));if(!mouse.fire)player.recoilShot=Math.max(0,player.recoilShot-dt*8);
    if(gameTime-player.lastDamage>5&&player.health<100)player.health=Math.min(100,player.health+dt*7);
  }

  function rayTriangle(orig,dir,a,b,c){
    const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const p=[dir[1]*e2[2]-dir[2]*e2[1],dir[2]*e2[0]-dir[0]*e2[2],dir[0]*e2[1]-dir[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-7)return null;
    const inv=1/det,t=[orig[0]-a[0],orig[1]-a[1],orig[2]-a[2]],u=(t[0]*p[0]+t[1]*p[1]+t[2]*p[2])*inv;if(u<0||u>1)return null;
    const q=[t[1]*e1[2]-t[2]*e1[1],t[2]*e1[0]-t[0]*e1[2],t[0]*e1[1]-t[1]*e1[0]],v=(dir[0]*q[0]+dir[1]*q[1]+dir[2]*q[2])*inv;if(v<0||u+v>1)return null;
    const d=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;return d>.0001?d:null;
  }
  function boxTriangles(x,z,r,y0=0,y1=1.7){
    const p=[[x-r,y0,z-r],[x+r,y0,z-r],[x+r,y1,z-r],[x-r,y1,z-r],[x-r,y0,z+r],[x+r,y0,z+r],[x+r,y1,z+r],[x-r,y1,z+r]],f=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]],out=[];
    for(const q of f){out.push([p[q[0]],p[q[1]],p[q[2]]],[p[q[0]],p[q[2]],p[q[3]]]);}return out;
  }
  function levelHit(orig,dir,max=50){
    let best=max,normal=[0,0,0],kind='none';
    const ox=orig[0],oz=orig[2];
    for(let iz=0;iz<MH;iz++)for(let ix=0;ix<MW;ix++)if(MAP[iz][ix]==='#'||MAP[iz][ix]==='C'){
      const h=MAP[iz][ix]==='C'?1.25:2.6;
      if(hypot(ix+.5-ox,iz+.5-oz)>best+2)continue;
      const faces=[
        [[ix,0,iz],[ix+1,0,iz],[ix+1,h,iz],[ix,h,iz],[0,0,-1]],
        [[ix+1,0,iz+1],[ix,0,iz+1],[ix,h,iz+1],[ix+1,h,iz+1],[0,0,1]],
        [[ix,0,iz+1],[ix,0,iz],[ix,h,iz],[ix,h,iz+1],[-1,0,0]],
        [[ix+1,0,iz],[ix+1,0,iz+1],[ix+1,h,iz+1],[ix+1,h,iz],[1,0,0]]
      ];
      for(const [a,b,c,q,n] of faces){const d1=rayTriangle(orig,dir,a,b,c),d2=rayTriangle(orig,dir,a,c,q),d=d1||d2;if(d&&d<best){best=d;normal=n;kind=MAP[iz][ix]==='C'?'cover':'wall'}}
    }
    return best<max?{d:best,normal,kind,point:[orig[0]+dir[0]*best,orig[1]+dir[1]*best,orig[2]+dir[2]*best]}:null;
  }

  function aimDirection(yawOff=0,pitchOff=0){const yaw=player.yaw+yawOff,pitch=player.pitch+player.recoil+pitchOff,cp=Math.cos(pitch);return [Math.cos(yaw)*cp,Math.sin(pitch),Math.sin(yaw)*cp]}
  function fireHitscan(yawOff=0,pitchOff=0,damage=17){
    const orig=[player.x,player.y+player.eye,player.z],dir=aimDirection(yawOff,pitchOff);let best=levelHit(orig,dir,60),target=null,bestD=best?.d||60;
    for(const d of drones){if(d.hp<=0)continue;for(const tri of boxTriangles(d.x,d.z,.31,0,1.25)){const t=rayTriangle(orig,dir,...tri);if(t&&t<bestD){bestD=t;target=d;best={d:t,point:[orig[0]+dir[0]*t,orig[1]+dir[1]*t,orig[2]+dir[2]*t],normal:[-dir[0],0,-dir[2]],kind:'drone'}}}}
    lastShotRay={a:orig,b:[orig[0]+dir[0]*bestD,orig[1]+dir[1]*bestD,orig[2]+dir[2]*bestD],hit:best?.point||null,t:.6};
    for(let i=1;i<=5;i++){const t=bestD*i/6;particles.push({x:orig[0]+dir[0]*t,y:orig[1]+dir[1]*t,z:orig[2]+dir[2]*t,vx:0,vz:0,vy:0,life:.055,color:'#bffcff',size:1.5})}
    if(target){damageDrone(target,damage);hits++;hitFlash=.13;spawnImpact(best.point[0],best.point[2],'hit')} else if(best){spawnImpact(best.point[0],best.point[2],'wall',best.normal);addDecal(best.point,best.normal)}
    return !!target;
  }
  function damageDrone(d,amount){d.hp-=amount;d.state='COMBATE';d.lastKnown={x:player.x,z:player.z};d.lastSeen=gameTime;shareKnowledge(d);if(d.hp<=0){kills++;spawnExplosion(d.x,d.z,.75,false);tone('sine',520,.16,.08,110)}}
  function addDecal(p,n){decals.push({x:p[0]-n[0]*.01,y:p[1],z:p[2]-n[2]*.01,nx:n[0],nz:n[2],life:25});if(decals.length>64)decals.shift()}
  function spawnImpact(x,z,type='wall'){for(let i=0;i<8;i++)particles.push({x,z,y:.7,vx:(Math.random()-.5)*2.4,vz:(Math.random()-.5)*2.4,vy:Math.random()*1.8+.4,life:.25+Math.random()*.25,color:type==='hit'?'#ff566c':'#ffd66b',size:2+Math.random()*2});for(let i=0;i<2;i++)particles.push({x,z,y:.55,vx:(Math.random()-.5)*.18,vz:(Math.random()-.5)*.18,vy:.18+Math.random()*.18,life:.75,color:'#6f7c80',size:5+Math.random()*3});sound('impact')}
  function spawnExplosion(x,z,r=2.7,harm=true){for(let i=0;i<36;i++){const a=Math.random()*TAU,s=Math.random()*4;particles.push({x,z,y:.45,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:Math.random()*3,life:.4+Math.random()*.55,color:i%3?'#ff9f43':'#d9faff',size:3+Math.random()*5})}sound('explode');shake=Math.max(shake,.28);
    if(harm){for(const d of drones){const dist=hypot(d.x-x,d.z-z);if(dist<r&&lineClear(x,z,d.x,d.z))damageDrone(d,Math.max(0,85*(1-dist/r)))}const pd=hypot(player.x-x,player.z-z);if(pd<r)hurtPlayer(Math.max(0,40*(1-pd/r)),Math.atan2(z-player.z,x-player.x));}
  }

  function tryFire(dt){
    const w=weapons[weaponIndex];weaponCooldown=Math.max(0,weaponCooldown-dt);
    if(reloadTimer>0){reloadTimer-=dt;reloadPhase=reloadTimer>w.reload*.55?'ejetando':'inserindo';if(reloadTimer<=0){const n=Math.min(w.magSize-w.mag,w.reserve);w.mag+=n;w.reserve-=n;reloadPhase='';updateHUD()}return;}
    if(w.kind==='charge'){
      if(mouse.fire&&w.mag>0){charging=true;charge=Math.min(1.35,charge+dt);$('charge').style.opacity=1;$('charge').firstElementChild.style.width=`${Math.min(1,charge/1.15)*100}%`;toneChargeThrottle(dt)}
      if(!mouse.fire&&charging){if(charge>.18&&weaponCooldown<=0){w.mag--;shots++;weaponCooldown=w.rate;spawnProjectile(charge);muzzle=.11;sound('charge');addSound(player.x,player.z,13,'disparo')}charge=0;charging=false;$('charge').style.opacity=0;updateHUD()}return;
    }
    if(!mouse.fire||weaponCooldown>0)return;if(w.mag<=0){beginReload();return;}w.mag--;shots++;weaponCooldown=w.rate;muzzle=.09;shake=Math.max(shake,w.kind==='scatter'?.18:.06);addSound(player.x,player.z,w.kind==='scatter'?13:9,'disparo');
    if(w.kind==='auto'){
      const i=Math.floor(player.recoilShot)%w.recoil.length,spread=mouse.ads?w.adsSpread:w.spread,jitter=(Math.sin((shots+1)*91.73)*.5)*spread;
      player.recoil=Math.min(.11,player.recoil+w.recoil[i]);player.recoilShot++;fireHitscan(recoilSeed[i]*spread+jitter,jitter*.42,w.damage);sound('rifle');
    }else{
      const s=mouse.ads?w.adsSpread:w.spread;shots+=fixedPellets.length-1;for(const p of fixedPellets)fireHitscan(p[0]*s,p[1]*s,w.damage);sound('shotgun');
    }
    if(w.mag===0)setTimeout(()=>{if(mode==='play')beginReload()},120);updateHUD();
  }
  let chargeTone=0;function toneChargeThrottle(dt){chargeTone-=dt;if(chargeTone<=0){tone('sine',160+charge*260,.06,.018,220+charge*300);chargeTone=.12}}
  function spawnProjectile(c){const dir=aimDirection(),speed=8+Math.min(c,1.15)*12;projectiles.push({x:player.x,y:player.y+player.eye,z:player.z,vx:dir[0]*speed,vy:dir[1]*speed+1.2,vz:dir[2]*speed,life:4,radius:2.6+Math.min(c,1.15)*.8})}

  function updateProjectiles(dt){
    for(const p of projectiles){const ox=p.x,oz=p.z;p.vy-=6.8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.life-=dt;particles.push({x:p.x,y:p.y,z:p.z,vx:0,vz:0,vy:.1,life:.18,color:'#69f6ff',size:3});
      let boom=p.y<floorHeight(p.x,p.z)||blocked(p.x,p.z);for(const d of drones)if(d.hp>0&&hypot(d.x-p.x,d.z-p.z)<d.r+.15&&p.y<1.4)boom=true;
      if(boom){p.life=0;spawnExplosion(p.x,p.z,p.radius,true)}else if(hypot(p.x-ox,p.z-oz)>0&&blocked((p.x+ox)/2,(p.z+oz)/2)){p.life=0;spawnExplosion(p.x,p.z,p.radius,true)}
    }projectiles=projectiles.filter(p=>p.life>0);
  }

  // Walkable-cell graph used by A*. Long segments are then collapsed when line-of-sight is clear.
  const navNodes=[],navAt=new Map();
  for(let z=1;z<MH-1;z++)for(let x=1;x<MW-1;x++)if(!blocked(x+.5,z+.5)){const n={x:x+.5,z:z+.5,ix:x,iz:z,edges:[]};navAt.set(`${x},${z}`,n);navNodes.push(n)}
  for(const n of navNodes)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=navAt.get(`${n.ix+dx},${n.iz+dz}`);if(q)n.edges.push(q)}
  function nearestNode(x,z){let best=null,bd=Infinity;for(const n of navNodes){const d=(n.x-x)**2+(n.z-z)**2;if(d<bd){bd=d;best=n}}return best}
  function findPath(ax,az,bx,bz){
    const start=nearestNode(ax,az),goal=nearestNode(bx,bz);if(!start||!goal)return[];const open=[start],came=new Map(),g=new Map([[start,0]]),f=new Map([[start,hypot(goal.x-start.x,goal.z-start.z)]]);
    while(open.length){open.sort((a,b)=>(f.get(a)||Infinity)-(f.get(b)||Infinity));const cur=open.shift();if(cur===goal)break;for(const n of cur.edges){const ng=(g.get(cur)||0)+1;if(ng<(g.get(n)??Infinity)){came.set(n,cur);g.set(n,ng);f.set(n,ng+hypot(goal.x-n.x,goal.z-n.z));if(!open.includes(n))open.push(n)}}}
    const raw=[];let c=goal;raw.unshift({x:c.x,z:c.z});while(c!==start&&came.has(c)){c=came.get(c);raw.unshift({x:c.x,z:c.z})}raw.push({x:bx,z:bz});
    const smooth=[];let i=0;while(i<raw.length){smooth.push(raw[i]);let j=raw.length-1;while(j>i+1&&!lineClear(raw[i].x,raw[i].z,raw[j].x,raw[j].z))j--;i=Math.max(i+1,j)}return smooth;
  }
  function setDestination(d,x,z){d.path=findPath(d.x,d.z,x,z);d.pathI=0}
  function droneSeesPlayer(d){const dx=player.x-d.x,dz=player.z-d.z,dist=hypot(dx,dz);if(dist>9.5)return false;const a=Math.abs(angleDiff(Math.atan2(dz,dx),d.yaw));return a<Math.PI*.31&&lineClear(d.x,d.z,player.x,player.z)}
  function heardSound(d){let best=null;for(const s of sounds){const dist=hypot(s.x-d.x,s.z-d.z);if(dist<s.r&&(!best||dist<best.dist))best={...s,dist}}return best}
  function shareKnowledge(source){for(const d of drones)if(d!==source&&d.hp>0&&hypot(d.x-source.x,d.z-source.z)<6.5){d.lastKnown={...source.lastKnown};if(d.state==='PATRULHA'||d.state==='SUSPEITA'){d.state='BUSCA';d.stateTime=0;setDestination(d,d.lastKnown.x,d.lastKnown.z)}}}
  function chooseCover(d){let best=null,score=Infinity;for(let z=1;z<MH-1;z++)for(let x=1;x<MW-1;x++)if(MAP[z][x]==='C'){for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const tx=x+.5+dx*.95,tz=z+.5+dz*.95;if(blocked(tx,tz))continue;const hidden=!lineClear(tx,tz,player.x,player.z),cost=hypot(tx-d.x,tz-d.z)+(hidden?-6:5);if(cost<score){score=cost;best={x:tx,z:tz}}}}return best}
  function moveDrone(d,dt,speed=1.6){
    const t=d.path[d.pathI];if(!t)return;const dx=t.x-d.x,dz=t.z-d.z,dist=hypot(dx,dz);if(dist<.18){d.pathI++;return}const nx=dx/dist,nz=dz/dist;d.yaw=Math.atan2(nz,nx);let px=d.x+nx*speed*dt,pz=d.z+nz*speed*dt;if(!blocked(px,pz)){d.x=px;d.z=pz}else d.pathI++;
  }
  function droneShoot(d,dt){
    d.shotCd-=dt;if(d.contact<d.reaction||d.shotCd>0)return;d.shotCd=.45+Math.random()*.55;const dist=hypot(player.x-d.x,player.z-d.z),err=Math.max(.025,.19-d.contact*.035),aim=Math.atan2(player.z-d.z,player.x-d.x)+(Math.random()-.5)*err;const clear=lineClear(d.x,d.z,player.x,player.z);
    addSound(d.x,d.z,7,'tiro drone');tone('square',160,.07,.05,85,clamp(angleDiff(aim,player.yaw),-1,1));for(let i=0;i<4;i++)particles.push({x:d.x,z:d.z,y:.7,vx:Math.cos(aim)*(3+i),vz:Math.sin(aim)*(3+i),vy:0,life:.12,color:'#ff4e64',size:2});
    if(clear&&Math.abs(angleDiff(aim,Math.atan2(player.z-d.z,player.x-d.x)))<.075+1/dist)hurtPlayer(5+wave*.7,Math.atan2(d.z-player.z,d.x-player.x));
  }
  function hurtPlayer(amount,from){if(mode!=='play')return;player.health=Math.max(0,player.health-amount);player.lastDamage=gameTime;damageFlash=.32;damageAngle=angleDiff(from,player.yaw);shake=Math.max(shake,.16);sound('hurt');updateHUD();if(player.health<=0)gameOver()}

  function updateDrones(dt){
    const alive=drones.filter(d=>d.hp>0);let frontCount=0;humTick-=dt;if(humTick<=0&&alive.length){const near=alive.reduce((a,b)=>hypot(a.x-player.x,a.z-player.z)<hypot(b.x-player.x,b.z-player.z)?a:b);const pan=clamp(Math.sin(angleDiff(Math.atan2(near.z-player.z,near.x-player.x),player.yaw)), -1,1);tone('sawtooth',72,.18,.012,58,pan);humTick=.65;}
    for(const d of alive){d.stateTime+=dt;d.hum+=dt;const sees=droneSeesPlayer(d),heard=heardSound(d);
      if(sees){d.lastKnown={x:player.x,z:player.z};d.lastSeen=gameTime;d.contact+=dt;d.state='COMBATE';d.stateTime=0;if(d.role==='frente'&&frontCount++>=2)d.role='flanco';shareKnowledge(d)}else d.contact=Math.max(0,d.contact-dt*.45);
      if(d.hp<28&&d.state!=='RECUO'){d.state='RECUO';d.cover=chooseCover(d);if(d.cover)setDestination(d,d.cover.x,d.cover.z)}
      if(!sees&&heard&&d.state==='PATRULHA'){d.state='SUSPEITA';d.suspicion={x:heard.x,z:heard.z};d.stateTime=0;setDestination(d,heard.x,heard.z)}
      if(d.state==='PATRULHA'){const t=d.patrol[d.patrolI];if(!d.path.length||d.pathI>=d.path.length){setDestination(d,t[0],t[1]);d.patrolI=(d.patrolI+1)%d.patrol.length}moveDrone(d,dt,1.1)}
      else if(d.state==='SUSPEITA'){moveDrone(d,dt,1.35);if(d.pathI>=d.path.length&&d.stateTime>2.5){d.state='BUSCA';d.lastKnown=d.suspicion;d.stateTime=0}}
      else if(d.state==='COMBATE'){
        if(sees){const pd=hypot(player.x-d.x,player.z-d.z);if(d.role==='flanco'&&(!d.path.length||d.pathI>=d.path.length)){const side=(d.id.charCodeAt(d.id.length-1)%2?1:-1),a=Math.atan2(d.z-player.z,d.x-player.x)+side*1.05;setDestination(d,player.x+Math.cos(a)*4,player.z+Math.sin(a)*4)}if(pd<3.2){d.path=[{x:d.x+(d.x-player.x)/pd,z:d.z+(d.z-player.z)/pd}];d.pathI=0}moveDrone(d,dt,d.role==='flanco'?1.85:1.25);droneShoot(d,dt)}
        else if(gameTime-d.lastSeen>.45){d.state='BUSCA';d.stateTime=0;if(d.lastKnown)setDestination(d,d.lastKnown.x,d.lastKnown.z)}
      }else if(d.state==='BUSCA'){moveDrone(d,dt,1.45);if(d.pathI>=d.path.length){d.yaw+=dt*1.6;if(d.stateTime>6){d.state='PATRULHA';d.stateTime=0;d.lastKnown=null;d.path=[]}}}
      else if(d.state==='RECUO'){moveDrone(d,dt,1.9);if(d.cover&&hypot(d.x-d.cover.x,d.z-d.cover.z)<.35&&sees)droneShoot(d,dt)}
    }
  }

  function updateEffects(dt){
    for(const p of particles){p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=3.8*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);
    for(const d of decals)d.life-=dt;decals=decals.filter(d=>d.life>0);for(const s of sounds)s.t-=dt;sounds=sounds.filter(s=>s.t>0);if(lastShotRay)lastShotRay.t-=dt;
    muzzle=Math.max(0,muzzle-dt);shake=Math.max(0,shake-dt);hitFlash=Math.max(0,hitFlash-dt);damageFlash=Math.max(0,damageFlash-dt);
    if(drones.length&&drones.every(d=>d.hp<=0)){waveDelay+=dt;if(waveDelay>2.7){wave++;waveDelay=0;drones=[];if(wave%2===0)ammoBoxes.push({x:9.5,z:9.5});spawnWave()}}
    for(const a of ammoBoxes)if(hypot(a.x-player.x,a.z-player.z)<.65){weapons.forEach((w,i)=>w.reserve=Math.min([180,30,56][i],w.reserve+[45,8,16][i]));a.taken=true;tone('triangle',280,.18,.08,640);updateHUD()}ammoBoxes=ammoBoxes.filter(a=>!a.taken);
  }
  function update(dt){if(mode!=='play'||paused)return;gameTime+=dt;updatePlayer(dt);tryFire(dt);updateProjectiles(dt);updateDrones(dt);updateEffects(dt);updateHUD()}

  function castRay(angle,max=30){
    const dx=Math.cos(angle),dz=Math.sin(angle);let mx=Math.floor(player.x),mz=Math.floor(player.z),ddx=Math.abs(1/(dx||1e-9)),ddz=Math.abs(1/(dz||1e-9)),sx,sz,sideX,sideZ;
    if(dx<0){sx=-1;sideX=(player.x-mx)*ddx}else{sx=1;sideX=(mx+1-player.x)*ddx}if(dz<0){sz=-1;sideZ=(player.z-mz)*ddz}else{sz=1;sideZ=(mz+1-player.z)*ddz}
    let side=0,dist=0,cell='#';while(dist<max){if(sideX<sideZ){sideX+=ddx;mx+=sx;side=0;dist=sideX-ddx}else{sideZ+=ddz;mz+=sz;side=1;dist=sideZ-ddz}if(mx<0||mz<0||mx>=MW||mz>=MH)break;cell=MAP[mz][mx];if(cell==='#'||cell==='C')break}return{dist,side,mx,mz,cell,hitX:player.x+dx*dist,hitZ:player.z+dz*dist};
  }
  function project(x,y,z){
    const dx=x-player.x,dz=z-player.z,cy=Math.cos(player.yaw),sy=Math.sin(player.yaw),forward=dx*cy+dz*sy,side=-dx*sy+dz*cy;if(forward<=.05)return null;const focal=W/(2*Math.tan(player.fov/2)),horizon=H/2+Math.tan(player.pitch+player.recoil)*focal;return{x:W/2+side/forward*focal,y:horizon-(y-(player.y+player.eye))/forward*focal,scale:focal/forward,depth:forward};
  }
  function renderWorld(){
    const focal=W/(2*Math.tan(player.fov/2)),bob=Math.sin(player.step*TAU)*2*(hypot(player.vx,player.vz)>1),horizon=H/2+Math.tan(player.pitch+player.recoil)*focal+bob+(Math.random()-.5)*shake*18;
    const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#07131e');sky.addColorStop(1,'#17313c');ctx.fillStyle=sky;ctx.fillRect(0,0,W,horizon);
    const floor=ctx.createLinearGradient(0,horizon,0,H);floor.addColorStop(0,'#17252b');floor.addColorStop(1,'#05090c');ctx.fillStyle=floor;ctx.fillRect(0,horizon,W,H-horizon);
    ctx.strokeStyle='rgba(74,164,174,.09)';ctx.lineWidth=1;for(let i=1;i<12;i++){const y=horizon+(H-horizon)*(1-1/(1+i*.34));ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}for(let i=-12;i<=12;i++){ctx.beginPath();ctx.moveTo(W/2+i*45,horizon);ctx.lineTo(W/2+i*210,H);ctx.stroke()}
    objectsDrawn=0;culled=0;
    for(let x=0;x<W;x+=2){const cam=(2*x/W-1)*Math.tan(player.fov/2),angle=player.yaw+Math.atan(cam),ray=castRay(angle),dist=Math.max(.001,ray.dist*Math.cos(angle-player.yaw));depth[x]=depth[x+1]=dist;const wallH=(ray.cell==='C'?1.25:2.6)/dist*focal,base=horizon+(player.y+player.eye)/dist*focal,top=base-wallH;const fog=clamp(1-dist/24,.12,1),stripe=((ray.mx+ray.mz)&1)?1:.86,side=ray.side?.72:1;
      const rr=ray.cell==='C'?112:35,gg=ray.cell==='C'?94:116,bb=ray.cell==='C'?68:128;ctx.fillStyle=`rgb(${rr*fog*stripe*side},${gg*fog*stripe*side},${bb*fog*stripe*side})`;ctx.fillRect(x,top,2,wallH+1);
      if(dist<9){ctx.fillStyle=`rgba(105,246,255,${.055*fog})`;for(let yy=top+10;yy<base;yy+=24)ctx.fillRect(x,yy,2,1)}
    }
    const sprites=[];for(const d of drones)if(d.hp>0)sprites.push({type:'drone',o:d,x:d.x,y:.63,z:d.z});for(const p of projectiles)sprites.push({type:'projectile',o:p,x:p.x,y:p.y,z:p.z});for(const p of particles)sprites.push({type:'particle',o:p,x:p.x,y:p.y,z:p.z});for(const a of ammoBoxes)sprites.push({type:'ammo',o:a,x:a.x,y:.35,z:a.z});for(const d of decals)sprites.push({type:'decal',o:d,x:d.x,y:d.y,z:d.z});
    sprites.map(s=>({...s,p:project(s.x,s.y,s.z)})).filter(s=>s.p).sort((a,b)=>b.p.depth-a.p.depth).forEach(drawSprite);
    drawWeapon(bob);if(debug)drawDebugWorld();drawReticle();
    if(muzzle>0){const g=ctx.createRadialGradient(W*.54,H*.78,0,W*.54,H*.78,W*.16);g.addColorStop(0,`rgba(255,238,154,${muzzle*7})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
    if(damageFlash>0){ctx.fillStyle=`rgba(255,26,55,${damageFlash*.32})`;ctx.fillRect(0,0,W,H)}
  }
  function drawSprite(s){const {p,o,type}=s;if(p.x< -200||p.x>W+200){culled++;return}const ix=clamp(Math.floor(p.x),0,W-1);if(p.depth>depth[ix]+.35){culled++;return}objectsDrawn++;
    if(type==='drone'){
      const size=p.scale*.72,x=p.x,y=p.y;ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,size*.55,size*.58,size*.14,0,0,TAU);ctx.fill();
      const glow=ctx.createRadialGradient(0,-size*.08,0,0,-size*.08,size*.75);glow.addColorStop(0,o.state==='COMBATE'?'#ff5a68':'#7af6ff');glow.addColorStop(.18,'#243944');glow.addColorStop(1,'rgba(3,8,12,.1)');ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(0,0,size*.5,size*.32,0,0,TAU);ctx.fill();ctx.strokeStyle=o.state==='COMBATE'?'#ff6373':'#9effff';ctx.lineWidth=Math.max(1,size*.025);ctx.stroke();ctx.fillStyle='#061018';ctx.fillRect(-size*.3,-size*.12,size*.6,size*.13);ctx.fillStyle=o.state==='COMBATE'?'#ff334f':'#77fbff';ctx.fillRect(-size*.09,-size*.1,size*.18,size*.08);
      ctx.fillStyle='#111a20';ctx.fillRect(-size*.68,-size*.05,size*.25,size*.08);ctx.fillRect(size*.43,-size*.05,size*.25,size*.08);ctx.fillStyle='#ff4e64';ctx.fillRect(-size*.45,-size*.48,size*.9*Math.max(0,o.hp/(70+wave*8)),Math.max(2,size*.025));
      if(debug){ctx.font=`${clamp(size*.09,9,14)}px monospace`;ctx.textAlign='center';ctx.fillStyle='#eaffff';ctx.fillText(`${o.id} ${o.state}`,0,-size*.57)}ctx.restore();
    }else if(type==='particle'||type==='projectile'){ctx.fillStyle=o.color||'#73f6ff';const r=type==='projectile'?clamp(p.scale*.06,4,16):clamp(o.size*p.scale*.018,1,8);ctx.shadowBlur=r*2;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();ctx.shadowBlur=0}
    else if(type==='ammo'){const q=clamp(p.scale*.38,10,60);ctx.fillStyle='#253a35';ctx.fillRect(p.x-q/2,p.y-q/2,q,q*.65);ctx.strokeStyle='#78ffb0';ctx.strokeRect(p.x-q/2,p.y-q/2,q,q*.65);ctx.fillStyle='#78ffb0';ctx.font=`bold ${q*.27}px monospace`;ctx.textAlign='center';ctx.fillText('AMMO',p.x,p.y)}
    else if(type==='decal'){ctx.fillStyle=`rgba(5,7,8,${clamp(o.life,0,1)})`;const q=clamp(p.scale*.035,1,8);ctx.beginPath();ctx.arc(p.x,p.y,q,0,TAU);ctx.fill()}
  }
  function drawWeapon(bob){
    const w=weapons[weaponIndex],ads=mouse.ads?1:0,baseX=lerp(W*.70,W*.52,ads)+player.swayX*1.2,baseY=lerp(H*.88,H*.79,ads)+player.swayY+Math.abs(bob)*2+(reloadTimer?Math.sin((1-reloadTimer/w.reload)*Math.PI)*H*.2:0),scale=Math.min(W,H)/540;ctx.save();ctx.translate(baseX,baseY);ctx.rotate(player.swayX*.0015+(reloadTimer?-.5*Math.sin((1-reloadTimer/w.reload)*Math.PI):0));
    const color=['#243d49','#33424d','#3b342c'][weaponIndex];ctx.fillStyle='#0b1116';ctx.beginPath();ctx.moveTo(-110*scale,80*scale);ctx.lineTo(-42*scale,0);ctx.lineTo(100*scale,18*scale);ctx.lineTo(145*scale,100*scale);ctx.closePath();ctx.fill();ctx.fillStyle=color;ctx.fillRect(-48*scale,-12*scale,165*scale,48*scale);ctx.fillStyle='#65818b';ctx.fillRect(-20*scale,-20*scale,110*scale,12*scale);ctx.fillStyle=weaponIndex===1?'#69f6ff':weaponIndex===2?'#ffc857':'#ff586a';ctx.fillRect(55*scale,-17*scale,38*scale,5*scale);ctx.fillStyle='#10171b';ctx.fillRect(2*scale,34*scale,39*scale,60*scale);ctx.fillStyle='#10191f';ctx.fillRect(116*scale,-5*scale,82*scale,25*scale);
    if(muzzle>0){ctx.fillStyle='#fff2a3';ctx.beginPath();ctx.moveTo(198*scale,7*scale);ctx.lineTo(235*scale,-8*scale);ctx.lineTo(220*scale,8*scale);ctx.lineTo(242*scale,23*scale);ctx.lineTo(198*scale,18*scale);ctx.fill()}ctx.restore();
  }

  function drawReticle(){
    const w=weapons[weaponIndex],gap=7+clamp((w.spread||.015)*420+(hypot(player.vx,player.vz)>3?5:0),0,13);
    ctx.save();ctx.translate(W/2,H/2);ctx.strokeStyle='rgba(226,255,255,.94)';ctx.fillStyle='#69f6ff';ctx.lineWidth=1.4;ctx.shadowBlur=6;ctx.shadowColor='#bffcff';ctx.beginPath();ctx.moveTo(-gap-8,0);ctx.lineTo(-gap,0);ctx.moveTo(gap,0);ctx.lineTo(gap+8,0);ctx.moveTo(0,-gap-8);ctx.lineTo(0,-gap);ctx.moveTo(0,gap);ctx.lineTo(0,gap+8);ctx.stroke();ctx.fillRect(-1,-1,2,2);
    if(hitFlash>0){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-12,-12);ctx.lineTo(-5,-5);ctx.moveTo(12,-12);ctx.lineTo(5,-5);ctx.moveTo(-12,12);ctx.lineTo(-5,5);ctx.moveTo(12,12);ctx.lineTo(5,5);ctx.stroke()}ctx.restore();
  }

  function drawDebugWorld(){
    ctx.save();ctx.lineWidth=1;ctx.globalAlpha=.75;
    // Nav graph and current A* paths are projected onto the floor.
    ctx.strokeStyle='#43a8b5';for(const n of navNodes){const a=project(n.x,.03,n.z);if(!a||a.depth>11)continue;for(const e of n.edges.slice(0,2)){const b=project(e.x,.03,e.z);if(b){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}}
    for(const d of drones)if(d.hp>0){ctx.strokeStyle=d.state==='COMBATE'?'#ff4e64':'#ffd65a';let prev=project(d.x,.07,d.z);for(let i=d.pathI;i<d.path.length;i++){const p=project(d.path[i].x,.07,d.path[i].z);if(prev&&p){ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(p.x,p.y);ctx.stroke()}prev=p}if(d.lastKnown){const p=project(d.lastKnown.x,.04,d.lastKnown.z);if(p){ctx.strokeStyle='#ff75d8';ctx.beginPath();ctx.arc(p.x,p.y,8,0,TAU);ctx.moveTo(p.x-11,p.y);ctx.lineTo(p.x+11,p.y);ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x,p.y+11);ctx.stroke()}}}
    if(lastShotRay?.t>0){const a=project(...lastShotRay.a),b=project(...lastShotRay.b);if(a&&b){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#ffdb55';ctx.fillRect(b.x-3,b.y-3,6,6)}}
    // Contact planes and capsule footprint.
    const pp=project(player.x,player.y+.03,player.z);if(pp){ctx.strokeStyle='#67ff9b';ctx.beginPath();ctx.ellipse(pp.x,pp.y,player.r*pp.scale,player.r*pp.scale*.22,0,0,TAU);ctx.stroke()}for(const c of contacts){const a=project(c.x,.05,c.z),b=project(c.x+c.nx*.5,.05,c.z+c.nz*.5);if(a&&b){ctx.strokeStyle='#ff8b57';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}
    ctx.restore();drawMinimap();drawDiagnosticPanel();
  }
  function drawDiagnosticPanel(){
    const lines=['DIAGNÓSTICO F1',`FPS ${fps.toFixed(0)}  |  FÍSICA 60/s`,`DRAW ${objectsDrawn}  |  CULL ${culled}`,`POS ${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${player.z.toFixed(2)}`,`CONTATOS ${contacts.length}  |  FOV ${(player.fov*180/Math.PI).toFixed(1)}°`,`NAV ${navNodes.length} NÓS  |  RAY ${lastShotRay?.t>0?'ATIVO':'—'}`,...drones.filter(d=>d.hp>0).map(d=>`${d.id} ${d.state.padEnd(8)} HP ${Math.ceil(d.hp)} ${d.role}`)];
    ctx.save();ctx.font='11px monospace';const pw=Math.min(330,W*.32),ph=22+lines.length*15;ctx.fillStyle='rgba(0,7,11,.82)';ctx.fillRect(16,88,pw,ph);ctx.strokeStyle='rgba(105,246,255,.45)';ctx.strokeRect(16.5,88.5,pw-1,ph-1);lines.forEach((line,i)=>{ctx.fillStyle=i?'#aefaff':'#ffc857';ctx.fillText(line,27,108+i*15)});ctx.restore();
  }
  function drawMinimap(){
    const s=Math.min(W,H)*.016,ox=W-MW*s-18,oy=90;ctx.save();ctx.globalAlpha=.86;ctx.fillStyle='rgba(0,8,12,.86)';ctx.fillRect(ox-8,oy-8,MW*s+16,MH*s+16);
    for(let z=0;z<MH;z++)for(let x=0;x<MW;x++){if(MAP[z][x]==='#'){ctx.fillStyle='#2b6470';ctx.fillRect(ox+x*s,oy+z*s,s,s)}else if(MAP[z][x]==='C'){ctx.fillStyle='#8a704e';ctx.fillRect(ox+x*s,oy+z*s,s,s)}}
    for(const d of drones)if(d.hp>0){const sees=droneSeesPlayer(d);ctx.fillStyle=sees?'rgba(255,62,83,.18)':'rgba(255,211,82,.1)';ctx.beginPath();ctx.moveTo(ox+d.x*s,oy+d.z*s);ctx.arc(ox+d.x*s,oy+d.z*s,9.5*s,d.yaw-.31*Math.PI,d.yaw+.31*Math.PI);ctx.closePath();ctx.fill();ctx.fillStyle=sees?'#ff4e64':'#ffd35a';ctx.fillRect(ox+d.x*s-2,oy+d.z*s-2,4,4);if(d.lastKnown){ctx.strokeStyle='#ff70d5';ctx.strokeRect(ox+d.lastKnown.x*s-3,oy+d.lastKnown.z*s-3,6,6)}}
    ctx.fillStyle='#67f6ff';ctx.beginPath();ctx.arc(ox+player.x*s,oy+player.z*s,3,0,TAU);ctx.fill();ctx.strokeStyle='#67f6ff';ctx.beginPath();ctx.moveTo(ox+player.x*s,oy+player.z*s);ctx.lineTo(ox+(player.x+Math.cos(player.yaw))*s,oy+(player.z+Math.sin(player.yaw))*s);ctx.stroke();ctx.restore();
  }
  function renderMenu(){
    ctx.fillStyle='#05090e';ctx.fillRect(0,0,W,H);const t=performance.now()*.00008;for(let i=0;i<70;i++){const x=(Math.sin(i*928.3+t)*.5+.5)*W,y=(Math.sin(i*182.4)*.5+.5)*H;ctx.fillStyle=`rgba(105,246,255,${.04+(i%5)*.012})`;ctx.fillRect(x,y,1,1)}ctx.strokeStyle='rgba(105,246,255,.06)';for(let x=-H;x<W;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+H,H);ctx.stroke()}const g=ctx.createRadialGradient(W*.78,H*.42,0,W*.78,H*.42,H*.55);g.addColorStop(0,'rgba(42,114,128,.3)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  function render(){if(mode==='menu'){renderMenu();return}renderWorld();const gap=clamp((weapons[weaponIndex].spread||.015)*420+(hypot(player.vx,player.vz)>3?5:0),0,13);$('crosshair').style.setProperty('--gap',`${gap}px`);$('hitmarker').classList.toggle('on',hitFlash>0);$('damage-arrow').classList.toggle('on',damageFlash>0);$('damage-arrow').style.transform=`rotate(${damageAngle+Math.PI/2}rad)`;if(debug)updateDebugText();}

  function updateHUD(){const w=weapons[weaponIndex];$('health').textContent=Math.ceil(player.health);$('healthbar').style.transform=`scaleX(${player.health/100})`;$('wave').textContent=`ONDA ${String(wave).padStart(2,'0')}`;$('remaining').textContent=drones.filter(d=>d.hp>0).length;$('weapon-name').textContent=w.name;$('mag').textContent=String(w.mag).padStart(2,'0');$('reserve').textContent=String(w.reserve).padStart(3,'0');$('statehint').textContent=reloadTimer?`RECARGA // ${reloadPhase.toUpperCase()}`:waveDelay?`SETOR LIMPO // PRÓXIMA ONDA`:mouse.ads?'MIRA ESTABILIZADA':'SETOR EM VARREDURA'}
  function updateDebugText(){$('debug').textContent=`DIAGNÓSTICO F1\nFPS ${fps.toFixed(0)}  |  FÍSICA 60/s\nDRAW ${objectsDrawn}  |  CULL ${culled}\nPOS ${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${player.z.toFixed(2)}\nCONTATOS ${contacts.length}  |  FOV ${(player.fov*180/Math.PI).toFixed(1)}°\nRAY ${lastShotRay?.t>0?'ATIVO':'—'}\nNAV ${navNodes.length} NÓS\n${drones.filter(d=>d.hp>0).map(d=>`${d.id} ${d.state.padEnd(8)} HP ${Math.ceil(d.hp)} ${d.role}`).join('\n')}`}
  function gameOver(){mode='over';document.exitPointerLock?.();$('hud').hidden=true;$('summary').hidden=false;$('sum-time').textContent=`${String(Math.floor(gameTime/60)).padStart(2,'0')}:${String(Math.floor(gameTime%60)).padStart(2,'0')}`;$('sum-accuracy').textContent=`${shots?Math.round(hits/shots*100):0}%`;$('sum-hits').textContent=hits;$('sum-wave').textContent=wave}

  function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;accumulator+=dt;fpsClock+=dt;frames++;if(fpsClock>=.5){fps=frames/fpsClock;frames=0;fpsClock=0}while(accumulator>=1/60){update(1/60);accumulator-=1/60}render();requestAnimationFrame(loop)}requestAnimationFrame(loop);
  window.advanceTime=(ms)=>{const n=Math.max(1,Math.round(ms/(1000/60)));for(let i=0;i<n;i++)update(1/60);render()};
  window.render_game_to_text=()=>JSON.stringify({coordinate_system:'origin top-left of 20x20 map; +x east, +z south; angles radians',mode,paused,wave,time:+gameTime.toFixed(1),player:{x:+player.x.toFixed(2),y:+player.y.toFixed(2),z:+player.z.toFixed(2),yaw:+player.yaw.toFixed(2),pitch:+player.pitch.toFixed(2),health:+player.health.toFixed(1),velocity:[+player.vx.toFixed(2),+player.vz.toFixed(2)],contacts:contacts.length,ads:mouse.ads},weapon:{name:weapons[weaponIndex].name,mag:weapons[weaponIndex].mag,reserve:weapons[weaponIndex].reserve,reloading:reloadPhase,charge:+charge.toFixed(2)},drones:drones.filter(d=>d.hp>0).map(d=>({id:d.id,x:+d.x.toFixed(2),z:+d.z.toFixed(2),hp:Math.ceil(d.hp),state:d.state,role:d.role,lastKnown:d.lastKnown&&{x:+d.lastKnown.x.toFixed(1),z:+d.lastKnown.z.toFixed(1)},seesPlayer:droneSeesPlayer(d),pathNodes:Math.max(0,d.path.length-d.pathI)})),projectiles:projectiles.map(p=>({x:+p.x.toFixed(1),y:+p.y.toFixed(1),z:+p.z.toFixed(1)})),ammoBoxes,shots,hits,debug});
})();
