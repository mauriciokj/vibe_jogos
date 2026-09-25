import { createRace, crashRider } from '../src/game/simulation';
import { getBike, POLICE_BIKE_ID } from '../src/game/bikes';
import type { RaceState } from '../src/game/types';

// Test-only recovery positions: both pilots have fallen, the player can reach
// the stationary patrol motorcycle first, and the original bike is farther away.
export function theftFixture(s:RaceState=createRace('costa',undefined,91,'day')){
 s.mode='racing';s.countdown=0;s.time=20;s.traffic=[];s.obstacles=[];s.policeActive=true;
 const p=s.riders[0],bike=getBike(POLICE_BIKE_ID);
 Object.assign(p,{x:0,z:500,speed:0,health:60,integrity:80,weaponId:'chain',kneePadId:'gold',nitro:1,immune:0});
 const cop={...structuredClone(createRace().riders[1]),id:'police',name:'POLÍCIA',profile:'police' as const,bikeId:bike.id,color:bike.color,maxSpeed:bike.speed,acceleration:bike.acceleration,handling:bike.handling,armor:bike.armor,x:0,z:510,speed:0,integrity:70,health:50};
 s.riders=s.riders.filter(r=>r.profile!=='police');s.riders.push(cop);
 crashRider(s,p,true);crashRider(s,cop,true);
 Object.assign(p,{x:0,z:500});Object.assign(p.recovery!,{phase:'walking',bikeX:0,bikeZ:520,bikeVX:0,bikeVZ:0,vx:0,vz:0});
 Object.assign(cop,{x:0,z:510});Object.assign(cop.recovery!,{phase:'walking',bikeX:0,bikeZ:502,bikeVX:0,bikeVZ:0,vx:0,vz:0});
 return {s,p,cop};
}
