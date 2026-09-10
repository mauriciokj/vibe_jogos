import test from 'node:test';
import assert from 'node:assert/strict';
import {RacePresentation} from '../src/multiplayer/presentation';
import {NET_VERSION} from '../src/multiplayer/protocol';
import {createMultiplayerRace,crashRider,STEP,stepRace} from '../src/game/simulation';
import {advanceRecovery,recoveryCommand} from '../src/game/recovery';
import {EMPTY_COMMAND,type RaceState} from '../src/game/types';
import type {RoomView} from '../src/multiplayer/protocol';
import {makeRoom,makeMember,joinRoom,lobbyClock,pulseRoom,viewRoom} from '../server/room';
function setup(){const state=createMultiplayerRace('costa',[{id:'a',name:'Ana'},{id:'b',name:'Bia'}],19,false,'rain');state.mode='racing';state.time=12;state.traffic=[];state.obstacles=[];state.riders.forEach((r,i)=>{Object.assign(r,{z:600+i*5,x:1.5,speed:45,immune:0});crashRider(state,r,true,'spill');});const presentation=new RacePresentation('a');return {state,presentation};}
function room(state:RaceState,at=10000):RoomView{return {code:'ABCDEF',trackId:state.trackId,condition:state.condition,fillBots:false,phase:'racing',locked:true,deadline:null,serverNow:at,simulationAt:at,revision:state.tick,members:[],race:structuredClone(state),ack:{},attackAck:{}};}
test('protocol13 projects both sliding bodies continuously without changing snapshots or events',()=>{
 assert.equal(NET_VERSION,13);const {state,presentation}=setup(),received=room(state),raw=JSON.stringify(received);presentation.accept(received,0,10000);
 const start=presentation.view(0)!,next=presentation.view(100)!;for(let i=0;i<2;i++){assert.ok(next.riders[i].z>start.riders[i].z);assert.ok(next.riders[i].recovery!.bikeZ>start.riders[i].recovery!.bikeZ);}
 for(let t=0;t<400;t+=7)presentation.view(t);assert.equal(JSON.stringify(received),raw);
 const frozen=presentation.view(400)!,late=presentation.view(4000)!;assert.deepEqual(late.riders,frozen.riders);
});
test('walking predicts backward inputs locally and observed backward motion remotely, with smooth snapshot correction for both bodies',()=>{
 const {state,presentation}=setup();state.riders.forEach(r=>{for(let i=0;i<400;i++)advanceRecovery(state,r,EMPTY_COMMAND,STEP);r.recovery!.bikeZ=r.z-30;});
 presentation.control({...EMPTY_COMMAND,brake:1},0);presentation.accept(room(state),0,10000);const initial=state.riders[0].z;assert.ok(presentation.view(100)!.riders[0].z<initial);
 const before=presentation.view(100)!;state.time+=.1;state.tick+=6;state.riders.forEach(r=>{r.z-=.72;r.recovery!.cycle+=.9;});presentation.accept(room(state,10100),100,10100);const after=presentation.view(100)!;
 for(let i=0;i<2;i++){assert.ok(Math.abs(before.riders[i].z-after.riders[i].z)<1e-9);assert.equal(before.riders[i].recovery!.bikeZ,after.riders[i].recovery!.bikeZ);}
 assert.ok(presentation.view(200)!.riders[1].z<after.riders[1].z);
});
test('pickup, explosion, knockdowns and damage remain server-confirmed during prediction',()=>{
 for(const integrity of [0,80]){const {state,presentation}=setup(),r=state.riders[0];Object.assign(r.recovery!,{phase:'walking',bikeX:r.x,bikeZ:r.z,bikeVX:0,bikeVZ:0});r.integrity=integrity;const received=room(state),raw=JSON.stringify(received);presentation.accept(received,0,10000);presentation.control({...EMPTY_COMMAND,throttle:1},0);
 const predicted=presentation.view(300)!;assert.equal(predicted.riders[0].recovery!.phase,'walking');assert.equal(predicted.riders[0].integrity,integrity);assert.equal(predicted.riders[0].z,r.z);assert.equal(JSON.stringify(received),raw);assert.equal(presentation.canAttack('punch',300),false);
 stepRace(state,{a:EMPTY_COMMAND});presentation.accept(room(state,10017),17,10017);assert.equal(presentation.view(200)!.riders[0].recovery!.phase,integrity===0?'exploding':'mounting');}
});
test('stale movement packets stop pedestrians instead of making the braking fallback run backward',()=>{
 const r=makeRoom('ABCDEF','costa',makeMember('Ana',0),0);joinRoom(r,makeMember('Bia',0),0);lobbyClock(r,60000);r.race!.traffic=[];r.race!.obstacles=[];const p=r.race!.riders[0];Object.assign(p,{x:2,z:600,speed:45});crashRider(r.race!,p,true);for(let i=0;i<400;i++)advanceRecovery(r.race!,p,EMPTY_COMMAND,STEP);p.recovery!.bikeZ=p.z-30;const z=p.z;for(const m of r.members)m.lastSeen=60000;
 pulseRoom(r,{},60500);assert.equal(p.z,z);assert.equal(p.recovery!.phase,'walking');
});
test('eight humans share authoritative recovery, ramps and pickup without autonomous walking',()=>{
 const s=createMultiplayerRace('costa',Array.from({length:8},(_,i)=>({id:`p${i}`,name:`P${i}`})),73,false,'rain');s.mode='racing';s.traffic=[];s.obstacles=[];
 for(const [i,r] of s.riders.entries()){Object.assign(r,{x:1.5,z:500+i*150,speed:45});crashRider(s,r,true,i%2?'spill':'impact');}
 for(let i=0;i<400;i++)stepRace(s);const positions=s.riders.map(r=>r.z);for(let i=0;i<60;i++)stepRace(s);assert.deepEqual(s.riders.map(r=>r.z),positions);
 for(let i=0;i<1200 && s.riders.some(r=>r.recovery);i++)stepRace(s,Object.fromEntries(s.riders.map(r=>[r.id,recoveryCommand(r)])));
 assert.ok(s.riders.every(r=>!r.recovery));assert.equal(s.mode,'racing');
});
