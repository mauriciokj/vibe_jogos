import { clamp, getTrack } from './content';
import type { RaceState } from './types';

export const MIRROR_RANGE = 200;
export function raceAwareness(state: RaceState, localId: string) {
  const me = state.riders.find(r => r.id === localId) ?? state.riders[0];
  const length = getTrack(state.trackId).distance;
  const racers = state.riders.filter(r => r.profile !== 'police').map(r => ({
    id: r.id, name: r.name, color: r.color, local: r.id === me.id,
    bot: r.profile !== 'player', progress: clamp(r.z / length, 0, 1),
    gap: Math.round(r.z - me.z), out: r.out ?? null, finished: r.finishedAt !== null,
  }));
  const competing = racers.filter(r => !r.local && !r.out);
  const ahead = competing.filter(r => r.gap >= 0).sort((a,b) => a.gap-b.gap)[0] ?? null;
  const behind = competing.filter(r => r.gap < 0).sort((a,b) => b.gap-a.gap)[0] ?? null;
  const rear = state.riders.filter(r => r.id !== me.id && !r.out && me.z-r.z > 0 && me.z-r.z <= MIRROR_RANGE)
    .sort((a,b) => a.z-b.z).map(r => ({id:r.id, name:r.name, distance: +(me.z-r.z).toFixed(1), closing: r.speed > me.speed + 1, police:r.profile === 'police'}));
  return { racers, ahead, behind, rear, mirrorRange: MIRROR_RANGE };
}
