import { dangerClearance } from '../src/game/hazards';
import { roadHalf, surfaceGrip, trafficShape } from '../src/game/road-profile';
import { clamp, cornerForces, cornerPace, curveAt } from '../src/game/content';
import type { Command, RaceState } from '../src/game/types';

// Read-only test driver. It only emits the same bounded controls a human can use.
export function safeDrivingTarget(s: RaceState) {
  const p = s.riders[0];
  const hazards = [...s.traffic, ...s.obstacles].filter(t => t.z - p.z > -8 && t.z - p.z < ('width' in t && (t.width ?? 0)>4?220:115));
  const riders = s.riders.filter(r => r.id !== p.id && !r.crash && Math.abs(r.z - p.z) < 20);
  const lanes = s.trackId==='terra'?[2.1,-2.1]:[1.4, -1.4, 5.1, -5.1];
  const cost = (x: number) => Math.abs(x - p.x) * .8 + (x < 0 ? .4 : 0)
    + hazards.reduce((sum, t) => sum + (Math.abs(x - t.x) < dangerClearance(s.trackId,t) ? 100 - Math.max(0, t.z - p.z) * .2 : 0), 0)
    + riders.reduce((sum, r) => sum + (Math.abs(x - r.x) < (r.profile === 'police' ? 4 : 2.5) ? (r.profile === 'police' ? 30 : 13) : 0), 0);
  return lanes.sort((a, b) => cost(a) - cost(b))[0];
}
export function safeDrivingCommand(s: RaceState): Command {
  const p=s.riders[0],target=safeDrivingTarget(s);
  const pace=cornerPace(p.z,s.trackId,p.handling,s.condition), forces=cornerForces(p.speed,p.handling*surfaceGrip(s.trackId,s.condition),curveAt(p.z,s.trackId),Math.abs(p.x)>roadHalf(s.trackId));
  return { throttle: p.speed>pace-.5?0:1, brake: clamp((p.speed-pace)*.3,0,1), steer: clamp((target-p.x)*.9+forces.drift/forces.lateral,-1,1), attack:null };
}
