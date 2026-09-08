import { clamp, cornerForces, cornerPace, curveAt } from '../src/game/content';
import type { Command, RaceState } from '../src/game/types';

// Read-only test driver. It only emits the same bounded controls a human can use.
export function safeDrivingCommand(s: RaceState): Command {
  const p = s.riders[0];
  const hazards = [...s.traffic, ...s.obstacles].filter(t => t.z - p.z > -8 && t.z - p.z < 115);
  const riders = s.riders.filter(r => r.id !== p.id && !r.crash && Math.abs(r.z - p.z) < 20);
  const lanes = [1.4, -1.4, 5.1, -5.1];
  const cost = (x: number) => Math.abs(x - p.x) * .8 + (x < 0 ? .4 : 0)
    + hazards.reduce((sum, t) => sum + (Math.abs(x - t.x) < 2.65 ? 100 - Math.max(0, t.z - p.z) * .2 : 0), 0)
    + riders.reduce((sum, r) => sum + (Math.abs(x - r.x) < (r.profile === 'police' ? 4 : 2.5) ? (r.profile === 'police' ? 30 : 13) : 0), 0);
  const target = lanes.sort((a, b) => cost(a) - cost(b))[0];
  const pace=cornerPace(p.z,s.trackId,p.handling), forces=cornerForces(p.speed,p.handling,curveAt(p.z,s.trackId),Math.abs(p.x)>7);
  return { throttle: p.speed>pace-.5?0:1, brake: clamp((p.speed-pace)*.3,0,1), steer: clamp((target-p.x)*.9+forces.drift/forces.lateral,-1,1), attack:null };
}
