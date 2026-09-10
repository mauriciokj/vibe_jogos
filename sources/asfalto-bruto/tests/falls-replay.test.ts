import test from 'node:test';import assert from 'node:assert/strict';
import {createRace,stepRace,snapshot,restoreSnapshot} from '../src/game/simulation';import {freshSave} from '../src/game/save';import {safeDrivingCommand} from './driving';import {RANK_RULES} from '../src/account/protocol';import type {Command} from '../src/game/types';
test('new-rules replay reproduces a real rainy knee fall, walking pickup and the rest of the race exactly',()=>{
 const save={...freshSave(),ownedKneePads:['gold'],kneePadId:'gold'},original=createRace('costa',save,71999,'rain'),commands:Command[]=[];let knee=false,walked=false,mounted=false,atFall='';
 while(original.mode!=='finished'&&original.tick<40000){const p=original.riders[0];let command=safeDrivingCommand(original);
  if(!knee&&p.z>=735&&p.z<780&&p.speed>28&&!p.recovery){command={...command,action:'kneeRight',steer:1};knee=true;}
  else if(knee&&p.kneeTime!>0&&!p.recovery)command={...command,steer:1};
  if(p.recovery?.phase==='walking')walked=true;if(walked&&!p.recovery)mounted=true;
  commands.push(command);stepRace(original,{player:command});if(!atFall&&p.recovery)atFall=snapshot(original);
 }
 assert.equal(RANK_RULES,3);assert.ok(knee&&walked&&mounted);assert.ok(original.riders[0].falls>0);assert.equal(original.mode,'finished');
 const replay=createRace('costa',save,71999,'rain');for(const command of commands)stepRace(replay,{player:command});assert.equal(snapshot(replay),snapshot(original));
 const resume=restoreSnapshot(atFall);for(const command of commands.slice(resume.tick))stepRace(resume,{player:command});assert.equal(snapshot(resume),snapshot(original));
});
