import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceCamera,type CameraPose} from '../src/game/race-camera';
import {createRace,crashRider} from '../src/game/simulation';
const pose=(z=590):CameraPose=>({x:1,y:5,z,horizon:.31,focal:.73});
function setup(){const state=createRace('costa');state.time=12;const rider=state.riders[0];Object.assign(rider,{z:600,x:1.5,speed:45});const camera=new RaceCamera();return {state,rider,camera};}
test('new countdown discards the fall redrawn while the next race awaited the server',()=>{
 const {state,rider,camera}=setup();crashRider(state,rider,true);camera.update(state,rider,pose(),pose(),pose());
 camera.reset();state.time+=1;camera.update(state,rider,pose(),pose(),pose());assert.equal(camera.mode,'fall');
 const next=createRace('costa'),start=pose(-12);assert.deepEqual(camera.update(next,next.riders[0],start,start,start),start);assert.equal(camera.mode,'riding');
});
test('crash keeps the exact previous riding view while rider and bike slide away; simulation is untouched',()=>{
 const {state,rider,camera}=setup(),normal=pose();camera.update(state,rider,normal,pose(100),pose(650));crashRider(state,rider,true);const origin={...rider.recovery!.origin};
 for(let i=0;i<100;i++){state.time+=1/60;rider.z+=.6;rider.recovery!.bikeZ+=.4;const snapshot=JSON.stringify(state);assert.deepEqual(camera.update(state,rider,pose(rider.z-12),pose(100),pose(650)),normal);assert.equal(JSON.stringify(state),snapshot);}
 assert.deepEqual(rider.recovery!.origin,origin);assert.equal(camera.mode,'fall');
});
test('restored recovery uses its impact origin and holds while standing still',()=>{
 const {state,rider,camera}=setup();crashRider(state,rider,true);rider.z=645;const origin=pose();assert.deepEqual(camera.update(state,rider,pose(633),origin,pose(625)),origin);
 rider.recovery!.phase='walking';rider.recovery!.cycle=0;state.time+=8;assert.deepEqual(camera.update(state,rider,pose(633),origin,pose(625)),origin);
});
test('walking eases from the held view, pause holds position, remount eases back and ends at normal riding',()=>{
 const {state,rider,camera}=setup(),normal=pose();camera.update(state,rider,normal,normal,normal);crashRider(state,rider,true);state.time+=1/60;camera.update(state,rider,normal,normal,normal);
 const walking={...pose(625),x:2,y:8,horizon:.4,focal:.9};rider.recovery!.phase='walking';rider.recovery!.cycle=.1;state.time+=1/60;
 const first=camera.update(state,rider,pose(633),normal,walking);assert.ok(first.z>normal.z && first.z<normal.z+2);assert.ok(first.focal>normal.focal&&first.focal<normal.focal+.02);
 assert.deepEqual(camera.update(state,rider,pose(633),normal,walking),first);
 for(let i=0;i<120;i++){state.time+=1/60;camera.update(state,rider,normal,normal,walking);}const last=camera.update(state,rider,normal,normal,walking);
 rider.recovery=undefined;state.time+=1/60;const riding=pose(613);assert.deepEqual(camera.update(state,rider,riding,normal,walking),last);
 state.time+=.6;const middle=camera.update(state,rider,riding,normal,walking);assert.ok(middle.z>riding.z && middle.z<last.z);state.time+=.7;assert.deepEqual(camera.update(state,rider,riding,normal,walking),riding);assert.equal(camera.mode,'riding');
});
test('another knockdown freezes the current walking composition; reset removes stale recovery camera',()=>{
 const {state,rider,camera}=setup();crashRider(state,rider,true);camera.update(state,rider,pose(),pose(),pose(620));rider.recovery!.phase='walking';rider.recovery!.cycle=1;state.time+=.5;const walk=camera.update(state,rider,pose(),pose(),pose(620));
 rider.recovery!.hits++;rider.recovery!.phase='sliding';rider.recovery!.origin={x:rider.x,z:rider.z,speed:0,lean:0};state.time+=1/60;assert.deepEqual(camera.update(state,rider,pose(),pose(100),pose(620)),walk);
 camera.reset();rider.recovery=undefined;assert.deepEqual(camera.update(state,rider,pose(40),pose(),pose()),pose(40));
});
