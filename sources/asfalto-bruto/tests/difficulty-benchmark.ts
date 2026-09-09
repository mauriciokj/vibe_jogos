import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import { TRACKS, clamp, cornerForces, cornerPace, curveAt } from '../src/game/content';
import { cornerHandling } from '../src/game/equipment';
import { surfaceGrip } from '../src/game/road-profile';
import { freshSave } from '../src/game/save';
import { safeDrivingCommand, safeDrivingTarget } from './driving';
import type { RaceState } from '../src/game/types';

const {createRace,stepRace}=await import(pathToFileURL(path.resolve(process.env.BALANCE_SOURCE_ROOT||'.','src/game/simulation.ts')).href) as typeof import('../src/game/simulation');

// Same bounded player controls before/after balancing. No altered health,
// positioning, immunity, AI or traffic: these are complete campaign races.
function drive(s:RaceState){
  const p=s.riders[0],command=safeDrivingCommand(s),curve=curveAt(p.z,s.trackId);
  if(!p.kneePadId || s.condition==='rain')return command;
  const supported=cornerForces(p.speed,cornerHandling(p,curve,s.trackId)*surfaceGrip(s.trackId,s.condition),curve);
  command.steer=clamp((safeDrivingTarget(s)-p.x)*.9+supported.drift/supported.lateral,-1,1);
  const canLean=command.steer*Math.sign(curve)>=-.2;
  const pace=cornerPace(p.z,s.trackId,p.handling,s.condition,canLean && (p.kneeTime!>0 || Math.abs(curve)>.5)?p.kneePadId:undefined);
  command.throttle=p.speed>pace-.5?0:1;command.brake=clamp((p.speed-pace)*.3,0,1);
  if(canLean && Math.abs(curve)>.5 && !(p.kneeTime!>0))command.action=curve>0?'kneeRight':'kneeLeft';
  return command;
}
const runs:{track:string;pad:string;seed:number;reason?:string;place?:number;time:number;falls:number;opponents:{id:string;bike?:string;time:number|null;progress:number;falls:number;out:string|null}[]}[]=[];
for(const track of TRACKS)for(const pad of ['none','gold'])for(const seed of [42,88117,32001]){
  const save=freshSave();if(pad!=='none'){save.ownedKneePads=[pad];save.kneePadId=pad;}
  const s=createRace(track.id,save,seed,'day');let frame=0;
  while(s.mode!=='finished' && frame++<60*400)stepRace(s,{player:drive(s)});
  const p=s.riders[0];runs.push({track:track.id,pad,seed,reason:s.result?.reason,place:s.result?.place,time:Math.round(s.time*10)/10,falls:p.falls,
    opponents:s.riders.filter(r=>r.profile!=='player'&&r.profile!=='police').map(r=>({id:r.id,bike:r.bikeId,time:r.finishedAt,progress:Math.round(r.z),falls:r.falls,out:r.out??null}))});
}
const summaries=['none','gold'].map(pad=>{const rows=runs.filter(r=>r.pad===pad);return {pad,races:rows.length,finishes:rows.filter(r=>r.reason==='finish').length,wins:rows.filter(r=>r.reason==='finish'&&r.place===1).length,top5:rows.filter(r=>r.reason==='finish'&&r.place!<=5).length,meanPlace:rows.reduce((s,r)=>s+(r.place??8),0)/rows.length};});
const file=process.argv[2]||'output/difficulty/benchmark.json';await fs.mkdir('output/difficulty',{recursive:true});await fs.writeFile(file,JSON.stringify({summaries,runs},null,2));console.log(summaries);
