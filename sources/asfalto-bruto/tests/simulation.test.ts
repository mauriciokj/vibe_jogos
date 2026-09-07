import { safeDrivingCommand } from './driving';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BIKES, getTrack } from '../src/game/content';
import { createRace, ranking, restoreSnapshot, snapshot, STEP, stepRace } from '../src/game/simulation';
import { buyBike, buyUpgrade, freshSave, repair, repairCost, settleRace } from '../src/game/save';
import { EMPTY_COMMAND, type Command, type RaceState } from '../src/game/types';

const accelerate: Command = { throttle: 1, brake: 0, steer: 0, attack: null };
function run(state: RaceState, frames: number, cmd = accelerate) { for (let i = 0; i < frames; i++) stepRace(state, { player: cmd }); }
function isolated() { const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = []; s.riders = [s.riders[0]]; return s; }

test('countdown freezes simulation; acceleration, braking, and steering are responsive', () => {
  const s = createRace(); run(s, 180); assert.equal(s.mode, 'countdown'); assert.equal(s.riders[0].z, 0);
  run(s, 40); assert.equal(s.mode, 'racing');
  run(s, 300); assert.ok(s.riders[0].speed > 30); const x = s.riders[0].x;
  run(s, 20, { ...accelerate, steer: -1 }); assert.ok(s.riders[0].x < x - .8);
  const speed = s.riders[0].speed; run(s, 60, { ...EMPTY_COMMAND, brake: 1 }); assert.ok(s.riders[0].speed < speed - 20);
});
test('shoulder slows the bike and world boundaries remain finite', () => {
  const s = isolated(), p = s.riders[0]; p.speed = 55; p.x = 8;
  run(s, 120); assert.ok(p.speed < p.maxSpeed * .65); run(s, 180, { ...accelerate, steer: 1 }); assert.ok(p.x <= 10.5); assert.ok(Number.isFinite(p.z));
});
test('a punch lands only after windup, hits once and steals an equipped weapon', () => {
  const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = []; s.riders = s.riders.slice(0, 2);
  const [p, target] = s.riders; p.x = 0; p.weapon = false; target.x = 1.8; target.z = 0; target.weapon = true;
  const cmd = { ...EMPTY_COMMAND, attack: 'punch' as const };
  const step = () => stepRace(s, { player: cmd, [target.id]: EMPTY_COMMAND });
  for (let i = 0; i < 5; i++) step(); assert.equal(target.health, 100); assert.equal(p.hits, 0);
  for (let i = 0; i < 6; i++) step(); assert.ok(target.health < 90); assert.equal(p.hits, 1); assert.equal(p.weapon, true); assert.equal(target.weapon, false);
  for (let i = 0; i < 12; i++) step(); assert.equal(p.hits, 1);
});
test('attacks respect longitudinal range, sides, equipped weapon, and cooldown', () => {
  const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = []; s.riders = s.riders.slice(0, 2);
  const [p, target] = s.riders; p.x = 0; target.x = 1; target.z = 9; p.weapon = false;
  stepRace(s, { player: { ...EMPTY_COMMAND, attack: 'weapon' }, [target.id]: EMPTY_COMMAND }); assert.equal(p.attack, null);
  for (let i = 0; i < 20; i++) stepRace(s, { player: { ...EMPTY_COMMAND, attack: 'kick' }, [target.id]: EMPTY_COMMAND });
  assert.equal(p.hits, 0); assert.equal(target.health, 100);
});
test('kick displaces target and depleted resistance triggers a recoverable fall', () => {
  const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = []; s.riders = s.riders.slice(0, 2);
  const [p, target] = s.riders; p.x = 0; target.x = 1.6; target.z = 0; target.health = 10;
  for (let i = 0; i < 20; i++) stepRace(s, { player: { ...EMPTY_COMMAND, attack: 'kick' }, [target.id]: EMPTY_COMMAND });
  assert.ok(target.x > 2.5); assert.ok(target.crash > 0); assert.equal(target.falls, 1);
  for (let i = 0; i < 200; i++) stepRace(s, { player: EMPTY_COMMAND, [target.id]: EMPTY_COMMAND });
  assert.equal(target.crash, 0); assert.ok(target.health > 90); assert.ok(target.integrity < 100);
});
test('a telegraphed rival attack gives the player time to steer out of reach', () => {
  const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = []; s.riders = s.riders.slice(0, 2);
  const [p, rival] = s.riders; p.x = 0; rival.x = 1.8; rival.z = 0; p.speed = 20; rival.speed = 20;
  stepRace(s, { player: EMPTY_COMMAND, [rival.id]: { ...EMPTY_COMMAND, attack: 'punch' } });
  assert.ok(rival.attack); assert.equal(p.health, 100);
  for (let i = 0; i < 27; i++) stepRace(s, { player: { ...EMPTY_COMMAND, steer: -1 }, [rival.id]: EMPTY_COMMAND });
  assert.equal(p.health, 100); assert.ok(rival.attack?.hit); assert.equal(rival.hits, 0);
});
test('opposing traffic collisions cannot tunnel between ticks and recover without repeated damage', () => {
  const s = isolated(), p = s.riders[0]; p.speed = 57; p.x = -3.8;
  s.traffic = [{ id: 'test-car', x: -3.8, z: 3.7, speed: -25, kind: 'car', color: '#fff' }];
  run(s, 3); assert.ok(p.crash > 0); const integrity = p.integrity; assert.ok(integrity < 70);
  run(s, 80); assert.equal(p.integrity, integrity); run(s, 130); assert.equal(p.crash, 0); assert.ok(p.speed > 0);
});
test('oil slows and damages the pilot; barriers force a fall', () => {
  const oil = isolated(); oil.riders[0].speed = 45; oil.obstacles.push({ id: 'oil', x: 1.7, z: 1, kind: 'oil' }); run(oil, 1);
  assert.ok(oil.riders[0].speed < 32); assert.ok(oil.riders[0].health < 80);
  const barrier = isolated(); barrier.riders[0].speed = 45; barrier.obstacles.push({ id: 'barrier', x: 1.7, z: 1, kind: 'barrier' }); run(barrier, 1); assert.ok(barrier.riders[0].crash > 0);
});
test('ranking uses distance and fractional crossing times, including same-tick finishes', () => {
  const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = [];
  const length = getTrack(s.trackId).distance;
  s.riders.forEach((r, i) => { r.z = length - 1 - i * 15; r.speed = 55; r.x = -5 + i * 1.4; });
  const p = s.riders[0]; p.z = length - .8; s.riders[1].z = length - .1;
  run(s, 1); assert.equal(s.mode, 'finished'); assert.equal(s.result?.place, 2); assert.ok(s.riders[1].finishedAt! < p.finishedAt!);
  assert.equal(ranking(s)[0].id, s.riders[1].id);
});
test('seed and snapshot restoration reproduce every state after subsequent commands', () => {
  const a = createRace('serra', undefined, 1299); run(a, 400); const b = restoreSnapshot(snapshot(a));
  const cmds = [accelerate, { ...accelerate, steer: .4 }, { ...accelerate, attack: 'weapon' as const }, { ...accelerate, steer: -.3 }];
  for (let i = 0; i < 1000; i++) { const cmd = cmds[Math.floor(i / 55) % cmds.length]; stepRace(a, { player: cmd }); stepRace(b, { player: cmd }); }
  assert.equal(snapshot(a), snapshot(b));
  assert.notEqual(snapshot(createRace('costa', undefined, 1)), snapshot(createRace('costa', undefined, 2)));
});
test('frame accumulation produces identical simulation at 30, 60, and 144 FPS', () => {
  function simulate(fps: number) { const s = createRace(); let debt = 0; for (let frame = 0; frame < fps * 20; frame++) { debt += 1 / fps; while (debt + 1e-10 >= STEP) { stepRace(s, { player: accelerate }); debt -= STEP; } } return s; }
  assert.equal(snapshot(simulate(30)), snapshot(simulate(60))); assert.equal(snapshot(simulate(144)), snapshot(simulate(60)));
});
test('police spawn from heat and capture requires proximity and three slow seconds', () => {
  const s = isolated(); const p = s.riders[0]; p.z = 1500; s.heat = 60; run(s, 1, EMPTY_COMMAND); assert.equal(s.policeActive, true);
  const officer = s.riders.find(r => r.profile === 'police')!; officer.z = p.z; officer.x = p.x + 2; officer.speed = 0; officer.weapon = false;
  for (let i = 0; i < 181; i++) stepRace(s, { player: EMPTY_COMMAND, police: EMPTY_COMMAND });
  assert.equal(s.result?.reason, 'caught');
});
test('high speed avoids arrest and a destroyed bike ends the race', () => {
  const s = isolated(); s.riders[0].z = 1500; s.heat = 60; run(s, 1);
  s.riders[0].speed = 35; s.capture = 2.9; run(s, 20); assert.ok(s.capture < 2.9); assert.equal(s.mode, 'racing');
  s.riders[0].integrity = 0; run(s, 1); assert.equal(s.result?.reason, 'wrecked');
});
test('garage purchases, upgrades, repair costs and starter recovery preserve a playable economy', () => {
  const save = freshSave(); assert.equal(buyBike(save, 'veneno'), false); assert.equal(save.cash, 650);
  assert.equal(buyUpgrade(save, 'engine'), true); assert.equal(save.cash, 200); assert.equal(save.upgrades.ferro.engine, 1);
  save.condition.ferro = 90; assert.equal(repairCost(save), 40); assert.equal(repair(save), true); assert.equal(save.cash, 160);
  save.cash = 6000; assert.equal(buyBike(save, 'veneno'), true); assert.equal(save.cash, 3200); assert.equal(save.bikeId, 'veneno');
  const s = isolated(); s.riders[0].integrity = 0; run(s, 1); settleRace(save, s); assert.equal(save.races, 1); assert.ok(save.cash > 3200); assert.ok(save.condition.ferro >= 55);
  assert.ok(createRace('costa', save).riders[0].maxSpeed >= BIKES[1].speed);
});
test('all three full-length tracks can finish with ordinary bounded driving commands', () => {
  for (const id of ['costa', 'serra', 'deserto']) {
    const s = createRace(id); let frames = 0;
    while (s.mode !== 'finished' && frames++ < 60 * 360) {
      // Same input envelope as a human: throttle, brake, lateral steering, occasional attacks.
      const cmd = safeDrivingCommand(s); stepRace(s, { player: cmd });
    }
    assert.equal(s.result?.reason, 'finish', `${id}: ${JSON.stringify(s.result)} z=${s.riders[0].z}`);
    assert.ok(s.result!.time > 115 && s.result!.time < 360); assert.ok(s.result!.reward > 0);
    console.log(`${id}: ${s.result!.time.toFixed(1)} s, place ${s.result!.place}, falls ${s.result!.falls}, integrity ${s.riders[0].integrity.toFixed(0)}`);
  }
});

function fallArrestSetup(distance = 25) {
  const s = createRace(); s.mode = 'racing'; s.traffic = []; s.obstacles = [];
  s.riders = s.riders.slice(0, 2); const [p, cop] = s.riders;
  Object.assign(p, { x: 0, z: 1800, speed: 0 });
  Object.assign(cop, { id: 'police', profile: 'police', x: 0, z: p.z - distance, speed: 0, cooldown: 999 });
  s.policeActive = true; return s;
}
test('fall during a traffic collision near police immediately loses, even with residual speed', () => {
  const s = fallArrestSetup(); const p = s.riders[0]; p.speed = 64;
  s.traffic = [{ id: 'arrest-car', x: 0, z: 1803, speed: -20, kind: 'car', color: '#fff' }];
  stepRace(s, { player: accelerate, police: EMPTY_COMMAND });
  assert.ok(p.crash > 0); assert.ok(p.speed > 8);
  assert.equal(s.result?.reason, 'caught'); assert.equal(s.result?.arrestCause, 'fall'); assert.equal(s.mode, 'finished');
});
test('30m fall arrest boundary is inclusive and checked across the road', () => {
  const near = fallArrestSetup(30); near.riders[0].crash = 1; stepRace(near, { player: EMPTY_COMMAND, police: EMPTY_COMMAND }); assert.equal(near.result?.arrestCause, 'fall');
  const far = fallArrestSetup(30.1); far.riders[0].crash = 1; stepRace(far, { player: EMPTY_COMMAND, police: EMPTY_COMMAND }); assert.equal(far.mode, 'racing');
  const lanes = fallArrestSetup(25); lanes.riders[0].crash = 1; lanes.riders[0].x = 6; lanes.riders[1].x = -6;
  stepRace(lanes, { player: EMPTY_COMMAND, police: EMPTY_COMMAND }); assert.equal(lanes.result?.arrestCause, 'fall');
});
test('police arriving while the player is down arrest before recovery; fallen police cannot arrest', () => {
  const arrival = fallArrestSetup(30.5); arrival.riders[0].crash = 1; arrival.riders[1].speed = 55;
  stepRace(arrival, { player: EMPTY_COMMAND, police: accelerate }); assert.equal(arrival.result?.arrestCause, 'fall');
  const recovery = fallArrestSetup(); recovery.riders[0].crash = STEP / 2; recovery.riders[0].immune = 2;
  stepRace(recovery, { player: accelerate, police: EMPTY_COMMAND }); assert.equal(recovery.result?.reason, 'caught');
  const officerDown = fallArrestSetup(); officerDown.riders[0].crash = 1; officerDown.riders[1].crash = 2;
  stepRace(officerDown, { player: EMPTY_COMMAND, police: EMPTY_COMMAND }); assert.equal(officerDown.mode, 'racing');
});
test('fall far from police still allows recovery and riding near police does not immediately arrest', () => {
  const far = fallArrestSetup(300); far.riders[0].crash = .5;
  for (let i = 0; i < 40; i++) stepRace(far, { player: accelerate, police: EMPTY_COMMAND });
  assert.equal(far.mode, 'racing'); assert.equal(far.riders[0].crash, 0);
  const upright = fallArrestSetup(2); upright.riders[1].x = 3; upright.riders[0].speed = 25;
  stepRace(upright, { player: accelerate, police: EMPTY_COMMAND }); assert.equal(upright.mode, 'racing');
});
test('Ferro 500 gets to 100 km/h within three seconds and exceeds the old 205 km/h top speed', () => {
  const s = isolated(); run(s, 180); assert.ok(s.riders[0].speed * 3.6 > 100);
  run(s, 600); assert.ok(s.riders[0].speed * 3.6 > 220); assert.ok(s.riders[0].speed <= s.riders[0].maxSpeed);
});
