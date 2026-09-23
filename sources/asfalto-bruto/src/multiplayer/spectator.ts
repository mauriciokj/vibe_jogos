import type { Rider } from '../game/types';
import type { RoomView } from './protocol';

/** Only other connected humans who can still race are spectator targets. */
export function spectatorTargets(room: RoomView | null, localId: string): Rider[] {
  const race = room?.race, multiplayer = race?.multiplayer;
  const reason = multiplayer?.results[localId]?.reason;
  if (room?.phase !== 'racing' || !race || !multiplayer || (reason !== 'caught' && reason !== 'wrecked')) return [];
  return race.riders.filter(r => r.id !== localId && multiplayer.humanIds.includes(r.id)
    && room.members.some(m => m.id === r.id && m.connected)
    && !r.out && r.finishedAt === null && !multiplayer.results[r.id] && r.recovery?.phase !== 'exploding');
}

export function spectatorTarget(targets: readonly Rider[], currentId: string | null, cycle = false): string | null {
  if (!targets.length) return null;
  const index = targets.findIndex(r => r.id === currentId);
  return targets[index < 0 ? 0 : cycle ? (index + 1) % targets.length : index].id;
}
