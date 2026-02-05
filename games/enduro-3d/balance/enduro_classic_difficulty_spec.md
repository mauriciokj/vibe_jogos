# Enduro Classic Difficulty Spec (Source of Truth)

Version: v0.7.6
Status: Draft (documented from user reference)

## 1) Day Cycle (single in-game day)
No pause between cycle transitions.
`carsLeft` resets only at end of full day cycle.

Cycle order:
1. DAY
2. SNOW
3. DAY (again)
4. DUSK (entardecer)
5. NIGHT
6. NIGHT_FOG
7. PRE_DAWN (still dark, but map/background colors become visible)

Notes:
- NIGHT_FOG remains night lighting conditions plus fog.
- PRE_DAWN is still dark, but with enough ambient/background tint to reveal color silhouettes.

## 2) Overtake Goal Per Day
- Day 1: 200 cars
- Day 2: 300 cars
- Day 3: 300 cars
- Day 4: 300 cars (not explicitly changed; inherited)
- Day 5: 300 cars (same count, but timing windows shorter)
- Day 6: 350 cars
- Day 7: 350 cars
- Day 8: 350 cars
- Day 9: 400 cars
- Day 10: 500 cars

## 3) Difficulty Modifiers by Day
- Day 3: increase traffic density (more cars on track).
- Day 5: shorten duration of each cycle segment.
- Day 7: increase traffic density again (harder overtakes with same 350 target).
- Day 8: increase player base speed (harder control/overtake management).

## 4) Early Completion Behavior
If player reaches day target before cycle ends:
- Keep cycle running until full day cycle finishes.
- Replace numeric counter with celebratory flags/banners.
- Start next day only when cycle completes.

## 5) Tracking Fields (for balancing/telemetry)
Recommended runtime fields to expose later:
- `dayNumber`
- `cyclePhase` (DAY/SNOW/DUSK/NIGHT/NIGHT_FOG/PRE_DAWN)
- `phaseTimeRemaining`
- `dayTimeRemaining`
- `targetCars`
- `carsOvertaken`
- `carsLeft`
- `trafficDensityScalar`
- `playerBaseSpeedScalar`
- `completedEarly` (boolean)

## 6) Implementation Notes (next step)
When implementing this spec in code:
- Move phase logic to a full-day scheduler with segment durations.
- Reset `carsLeft` only when full cycle wraps.
- Add DUSK and PRE_DAWN visuals as distinct phase profiles.
- Add flag UI state for early completion.

## 7) Live Tuning Decisions (our dynamic)
- v0.7.1: increased duration of every cycle segment globally to avoid running out of time by large margins.
- v0.7.1: kept Day 5+ compression, but softened it (from heavy compression to lighter compression) so all future days still inherit longer cycles.
- v0.7.2: increased all cycle segment durations again (small global bump) to give additional overtake margin.
- v0.7.3: increased total cycle duration by ~30 seconds (global redistribution across all segments).
- v0.7.4: set first cycle phase (initial DAY segment) to 120 seconds for beginner-friendly onboarding.
- v0.7.5: corrected interpretation — total full day cycle is now 120 seconds (not only first segment), redistributed across all segments.
- v0.7.6: repo reorganized into monorepo (no balance changes).
