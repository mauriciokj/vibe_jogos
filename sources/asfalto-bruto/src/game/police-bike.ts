import { POLICE_BIKE_ID } from './bikes';
import type { RaceState, Rider } from './types';

// First arrival wins. An officer already mounting, or in pickup range in the
// same tick, keeps the bike. Multiplayer never allows this vehicle transfer.
export function stealablePoliceBike(s:RaceState,r:Rider,radius:number):Rider|undefined {
 if(s.multiplayer || s.mode!=='racing' || r.profile!=='player' || r.out || r.finishedAt!==null || r.stolenPoliceBike || r.recovery?.phase!=='walking')return;
 const own=Math.hypot(r.x-r.recovery.bikeX,r.z-r.recovery.bikeZ);
 return s.riders.filter(c=>{
  const f=c.recovery;if(c.profile!=='police'||c.out||c.integrity<=0||!f||f.bikeTaken||f.phase==='mounting'||f.phase==='exploding'||Math.hypot(f.bikeVX,f.bikeVZ)>=.2)return false;
  const distance=Math.hypot(r.x-f.bikeX,r.z-f.bikeZ);
  return distance<=radius && distance<own && !(f.phase==='walking'&&Math.hypot(c.x-f.bikeX,c.z-f.bikeZ)<=radius);
 }).sort((a,b)=>Math.hypot(r.x-a.recovery!.bikeX,r.z-a.recovery!.bikeZ)-Math.hypot(r.x-b.recovery!.bikeX,r.z-b.recovery!.bikeZ)||a.id.localeCompare(b.id))[0];
}

export function takePoliceBike(r:Rider,officer:Rider){
 const own=r.recovery!,bike=officer.recovery!;
 r.stolenPoliceBike={officerId:officer.id,originalBike:{bikeId:r.bikeId ?? 'ferro',color:r.color,integrity:r.integrity,nitro:r.nitro ?? 0,bikeX:own.bikeX,bikeZ:own.bikeZ,bikeVX:own.bikeVX,bikeVZ:own.bikeVZ}};
 // Transfer the actual motorcycle and its damage, never the officer's health,
 // weapons, equipment or powers. The player's original consumables stay on it.
 r.bikeId=POLICE_BIKE_ID;r.maxSpeed=officer.maxSpeed;r.acceleration=officer.acceleration;r.handling=officer.handling;r.armor=officer.armor;r.integrity=officer.integrity;
 r.nitro=0;r.nitroTime=0;r.pedalTime=0;r.pedalCooldown=0;
 own.bikeX=bike.bikeX;own.bikeZ=bike.bikeZ;own.bikeVX=0;own.bikeVZ=0;
 bike.bikeTaken=true;
}

// The garage/stage still owns the original bike until a mounted finish unlocks
// the stolen one. Never write stolen-bike wear or nitro over the entered bike.
export function enteredBike(r:Rider){
 return r.stolenPoliceBike?.originalBike ?? {bikeId:r.bikeId ?? 'ferro',integrity:r.integrity,nitro:r.nitro ?? 0};
}
