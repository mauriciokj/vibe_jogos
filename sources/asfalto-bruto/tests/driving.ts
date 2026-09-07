import { clamp, curveAt } from '../src/game/content';
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
  return { throttle: 1, brake: 0, steer: clamp((target - p.x) * .9 + curveAt(p.z, s.trackId) * .2, -1, 1), attack: null };
}
