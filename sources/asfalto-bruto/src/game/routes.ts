import { TRACKS } from './content';
import { CONDITIONS, raceCondition } from './conditions';

// Menu entries combine a base track and condition without changing save or room IDs.
export const RACE_ROUTES = TRACKS.flatMap(track => CONDITIONS.map(condition => ({
  id: `${track.id}:${condition.id}`,
  name: `${track.name} · ${condition.name}`,
  track,
  condition,
})));
export function raceRoute(trackId: string, condition: unknown) {
  return RACE_ROUTES.find(r=>r.track.id===trackId && r.condition.id===raceCondition(condition)) ?? RACE_ROUTES[1];
}
export function routeFromId(id: string) {
  return RACE_ROUTES.find(r=>r.id===id) ?? RACE_ROUTES[1];
}
export function nextRaceRoute(trackId: string, condition: unknown) {
  return RACE_ROUTES[RACE_ROUTES.indexOf(raceRoute(trackId,condition))+1] ?? null;
}
