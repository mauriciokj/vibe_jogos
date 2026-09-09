import { roadHalf, roadLanes, lateralLimit, surfaceGrip, surfaceBraking, surfaceDrag, trafficShape, trafficAvoidance } from './road-profile';
import { ruralTraffic, ruralObstacles, ruralEvent, ruralSlope } from './rural';
import { HELMETS, HELMET_COLORS, equippedHelmet, getHelmet, getHelmetColor } from './helmets';
import { contactGuardRail, guardRailPosition } from './guardrails';
import { portObstacles, portTraffic, portPassengerEvent } from './port';
import { equippedWeapon, getWeapon } from './weapons';
import { advanceStunt, cancelStunt, clearsCar, stunting, WHEELIE_DURATION, WHEELIE_MIN_SPEED, WHEELIE_USES, wheeliesLeft } from './stunts';
import { advanceScenicEvent, coastalEvent, raceCondition } from './conditions';
import { BIKES, clamp, cornerForces, cornerPace, curveAt, getBike, getTrack } from './content';
import { cornerHandling, equippedKneePad, getKneePad, kneeContact, KNEE_DURATION, WET_KNEE_LIMIT, NITRO_DURATION, NITRO_MULTIPLIER, nitroCount } from './equipment';
import { supportsKneeDown } from './bikes';
import { advanceBanter, sayTaunt } from './banter';
import { EMPTY_COMMAND, type AttackKind, type Command, type RaceResult, type RaceState, type RaceCondition, type Rider, type RiderAction, type SaveData } from './types';

export const STEP = 1 / 60;
export const ROAD_HALF = 7;
export const FALL_ARREST_RADIUS = 30;
export const ATTACKS = {
  punch: { windup: .13, duration: .34, cooldown: .46, reach: 2.3, longitudinal: 4.8, damage: 16, push: .35 },
  kick: { windup: .25, duration: .52, cooldown: .8, reach: 2.6, longitudinal: 4.6, damage: 22, push: 1.1 },
  weapon: { windup: .21, duration: .48, cooldown: .72, reach: 3.6, longitudinal: 5.7, damage: 30, push: .55 },
};

export function attackSpec(rider: Rider, kind: AttackKind) {
  return kind==='weapon' ? getWeapon(rider.weaponId) ?? ATTACKS.weapon : ATTACKS[kind];
}

export function random(state: RaceState) {
  let n = state.rng;
  n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
  state.rng = n >>> 0;
  return state.rng / 4294967296;
}

function makeRider(id: string, name: string, profile: Rider['profile'], color: string, x: number, z: number): Rider {
  return { id, name, profile, color, bikeId: 'ferro', x, z, speed: 0, lean: 0, health: 100, integrity: 100, maxSpeed: 55, acceleration: 10, handling: 1, armor: 1, weapon: false, wheeliesLeft: WHEELIE_USES, attack: null, cooldown: 0, crash: 0, immune: 0, targetX: x, decisionAt: 0, finishedAt: null, hits: 0, falls: 0 };
}

export function stockBike(id?: string) {
  const bike = getBike(id);
  return { bikeId: bike.id, maxSpeed: bike.speed, acceleration: bike.acceleration, handling: bike.handling, armor: bike.armor };
}

// A few cornering specialists use ordinary shop equipment. Choppers, brawlers
// and police keep their original approach; there is no hidden grip bonus.
function rivalKneePad(bikeId: string | undefined, profile: Rider['profile'], level: number) {
  if(!supportsKneeDown(bikeId) || (profile!=='fast' && profile!=='careful'))return undefined;
  return profile==='fast' && level>=2 ? 'purple' : level>=1 ? 'blue' : 'green';
}

export function createRace(trackId = 'costa', save?: SaveData, seed = 88117, condition: RaceCondition = 'sunset'): RaceState {
  const bike = getBike(save?.bikeId);
  const up = save?.upgrades[bike.id] ?? { engine: 0, armor: 0, handling: 0 };
  const player = makeRider('player', 'VOCÊ', 'player', bike.color, 1.7, 0);
  player.helmetId=equippedHelmet(save).id;player.helmetColorId=getHelmetColor(save?.helmetColorId).id;
  const weapon=equippedWeapon(save);if(weapon)player.weaponId=weapon.id;
  const pad=equippedKneePad(save);if(pad)player.kneePadId=pad.id;
  const nitro=nitroCount(bike.id,save?.nitro?.[bike.id]);if(nitro)player.nitro=nitro;
  Object.assign(player, { bikeId: bike.id, maxSpeed: bike.speed + up.engine * 2.5, acceleration: bike.acceleration + up.engine * .7, handling: bike.handling + up.handling * .1, armor: bike.armor + up.armor * .15, integrity: save?.condition[bike.id] ?? 100, weapon: true });
  const names = ['NINA', 'COBRA', 'DANTE', 'LUNA', 'ROCHA', 'FAÍSCA', 'ZECA'];
  const colors = ['#d87bfa', '#f28451', '#6cdace', '#ebbc5c', '#a4bde2', '#ef6f8a', '#e7e6dc'];
  const profiles: Rider['profile'][] = ['aggressive', 'fast', 'careful', 'aggressive', 'careful', 'fast', 'aggressive'];
  const riders = [player, ...names.map((name, i) => {
    const r = makeRider(`rival-${i}`, name, profiles[i], colors[i], i % 2 ? -1.5 : 3.8, 7 + i * 9);
    r.helmetId=HELMETS[i%HELMETS.length].id;r.helmetColorId=HELMET_COLORS[(i+2)%HELMET_COLORS.length].id;
    Object.assign(r,stockBike(BIKES[(i+1)%BIKES.length].id));
    r.maxSpeed *= .95 + getTrack(trackId).level * .02;
    const pad=rivalKneePad(r.bikeId,r.profile,getTrack(trackId).level);if(pad)r.kneePadId=pad;
    r.weapon = i === 1 || i === 3 || i === 6;
    return r;
  })];
  const state: RaceState = { version: 1, condition: raceCondition(condition), scenicEvent: coastalEvent(trackId, seed), tick: 0, rng: seed || 1, trackId, mode: 'countdown', countdown: 3.5, time: 0, riders, traffic: [], obstacles: [], events: [], collisions: {}, heat: 0, capture: 0, policeActive: false, result: null };
  const length = getTrack(trackId).distance;
  for (let z = 400, i = 0; z < length + 1800; z += 230 + random(state) * 160, i++) {
    const oncoming = i % 3 === 1;
    state.traffic.push({ id: `traffic-${i}`, x: (oncoming ? -1 : 1) * (i % 2 ? 1.75 : 5.25), z, speed: oncoming ? -18 - random(state) * 6 : 19 + random(state) * 9, color: ['#cdbc9b', '#a8b7c0', '#de785f', '#dcd7bb', '#679d9d'][i % 5], kind: i % 4 === 2 ? 'van' : 'car' });
  }
  for (let z = 1150, i = 0; z < length - 180; z += 630 - getTrack(trackId).level * 70, i++) {
    state.obstacles.push({ id: `obstacle-${i}`, x: i % 3 === 0 ? 4.8 : i % 3 === 1 ? -3.2 : 6.2, z, kind: i % 3 === 1 ? 'barrier' : 'oil' });
  }
  if(trackId==='porto'){state.traffic=portTraffic(()=>random(state));state.obstacles=portObstacles();state.scenicEvent=portPassengerEvent(seed,state.traffic);}
  if(trackId==='terra') {
    state.traffic=ruralTraffic(()=>random(state));state.obstacles=ruralObstacles(state.condition!);state.scenicEvent=ruralEvent(seed,state.condition!);
    riders.forEach((r,i)=>{r.x=i%2?-2.1:2.1;r.targetX=r.x;r.z=-Math.floor(i/2)*10;});
  }
  return state;
}

export function ranking(state: RaceState): Rider[] {
  return state.riders.filter(r => r.profile !== 'police').slice().sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    if (!!a.out !== !!b.out) return a.out ? 1 : -1;
    return b.z - a.z || a.id.localeCompare(b.id);
  });
}
export function nearestTarget(state: RaceState, rider: Rider, kind: AttackKind = 'weapon') {
  if((rider.jumpTime ?? 0)>0)return undefined;
  const info = attackSpec(rider,kind);
  return state.riders.filter(r => r.id !== rider.id && !(r.jumpTime!>0) && !r.out && !r.crash && !r.immune && r.finishedAt === null && Math.abs(r.z - rider.z) < info.longitudinal && Math.abs(r.x - rider.x) < info.reach)
    .sort((a, b) => Math.abs(a.z - rider.z) + Math.abs(a.x - rider.x) - Math.abs(b.z - rider.z) - Math.abs(b.x - rider.x))[0];
}

function crashRider(state: RaceState, rider: Rider, force = false) {
  if (rider.crash || (rider.immune && !force)) return;
  rider.crash = 2.1 + rider.speed / 110;
  rider.speed *= .17;
  rider.integrity = Math.max(0, rider.integrity - 13 / rider.armor);
  rider.attack = null;
  rider.kneeTime=0;rider.wetKneeTicks=0;rider.nitroTime=0;rider.speech=undefined;cancelStunt(rider);
  rider.falls++;
  state.events.push({ type: 'crash', actor: rider.id, text: 'NO CHÃO! −TEMPO · −MOTO' });
}

export function performAction(state: RaceState, rider: Rider, action: RiderAction) {
  if(state.mode!=='racing' || rider.out || rider.crash || rider.finishedAt!==null)return;
  if(action==='wheelie') {
    if(stunting(rider) || wheeliesLeft(rider)<=0 || rider.speed<WHEELIE_MIN_SPEED || Math.abs(rider.x)>roadHalf(state.trackId) || rider.immune)return;
    rider.wheeliesLeft=wheeliesLeft(rider)-1;rider.wheelieTime=WHEELIE_DURATION;rider.kneeTime=0;rider.wetKneeTicks=0;
  } else if(action==='kneeLeft' || action==='kneeRight') {
    if(stunting(rider))return;
    if(!getKneePad(rider.kneePadId) || !supportsKneeDown(rider.bikeId) || rider.speed<20 || Math.abs(rider.x)>roadHalf(state.trackId))return;
    const side=action==='kneeLeft'?-1:1;
    if((rider.kneeTime ?? 0)>0 && rider.kneeSide===side)return;
    rider.kneeSide=side;rider.kneeTime=KNEE_DURATION;
  } else if(action==='nitro') {
    if(!(rider.nitro!>0) || (rider.nitroTime ?? 0)>0)return;
    rider.nitro!--;rider.nitroUsed=(rider.nitroUsed ?? 0)+1;rider.nitroTime=NITRO_DURATION;
    state.events.push({type:'nitro',actor:rider.id});
  } else if(action==='horn') {
    if((rider.hornCooldown ?? 0)>0)return;
    rider.hornCooldown=1;state.events.push({type:'horn',actor:rider.id});
  } else if(action==='taunt')sayTaunt(state,rider);
}

function impact(state: RaceState, rider: Rider, damage: number, push: number) {
  if (rider.immune || rider.crash) return;
  rider.health = Math.max(0, rider.health - damage);
  rider.x = clamp(rider.x + push, -lateralLimit(state.trackId), lateralLimit(state.trackId));
  contactGuardRail(state.trackId,rider);
  rider.speed *= .94;
  if (rider.health <= 0) crashRider(state, rider);
}

export function botCommand(state: RaceState, rider: Rider): Command {
  if (rider.out || rider.crash || rider.finishedAt !== null) return EMPTY_COMMAND;
  const police = rider.profile === 'police';
  const player = police ? policeTarget(state, rider) : state.riders.filter(r => r.id !== rider.id && r.profile !== 'police' && !r.out && r.finishedAt === null)
    .sort((a,b) => Math.abs(a.z-rider.z)-Math.abs(b.z-rider.z))[0];
  if (!player) return { ...EMPTY_COMMAND, brake: 1 };
  if (state.time >= rider.decisionAt) {
    rider.decisionAt = state.time + .55 + random(state) * .7;
    rider.targetX = police ? player.x : (random(state) > .23 ? 1 : -1) * (1.4 + random(state) * 3.6);
    if (rider.profile === 'aggressive' && Math.abs(rider.z - player.z) < 24) rider.targetX = player.x + (rider.x < player.x ? -1.7 : 1.7);
  }
  const inside=state.trackId==='terra'?3:5.5;
  let target = state.trackId==='terra'?clamp(rider.targetX,-inside,inside):rider.targetX;
  let brake = 0;
  const dangers = [...state.traffic, ...state.obstacles].filter(t => t.z - rider.z > -7 && t.z - rider.z < 30 + rider.speed * 1.5);
  if (dangers.some(t => Math.min(Math.abs(t.x - rider.x), Math.abs(t.x - target)) < trafficAvoidance(state.trackId,t.kind))) {
    const candidates = roadLanes(state.trackId).slice();
    const cost = (lane: number) => Math.abs(lane - rider.x) * .35 + dangers.reduce((sum, t) => sum + (Math.abs(t.x - lane) < trafficAvoidance(state.trackId,t.kind) ? 30 - Math.max(0, t.z - rider.z) * .04 : 0), 0);
    target = candidates.sort((a, b) => cost(a) - cost(b))[0];
    rider.targetX = target;
    if (dangers.some(t => t.z - rider.z < rider.speed * .4 && Math.abs(t.x - rider.x) < trafficAvoidance(state.trackId,t.kind,true))) brake = .7;
  }
  for (const other of state.riders) {
    if (other.id === rider.id) continue;
    if (other.z - rider.z > 0 && other.z - rider.z < 14 && Math.abs(other.x - rider.x) < 1.05) {
      target = clamp(other.x + (rider.x < other.x ? -2 : 2), -inside, inside);
    }
  }
  let attack: AttackKind | null = null;
  const nearby = nearestTarget(state, rider, rider.weapon ? 'weapon' : 'punch');
  if (nearby && rider.cooldown === 0 && (rider.profile !== 'careful' || state.tick % 80 < 8)) attack = rider.weapon ? 'weapon' : rider.profile === 'aggressive' ? 'kick' : 'punch';
  const curve = curveAt(rider.z, state.trackId);
  // Dry bends allow the same four-second technique as the player. In rain the
  // AI takes the bend upright and plans braking without an inactive pad bonus.
  const kneeCapable=!police && raceCondition(state.condition)!=='rain' && supportsKneeDown(rider.bikeId) && !!getKneePad(rider.kneePadId);
  const forces = cornerForces(rider.speed, cornerHandling(rider,curve,state.trackId) * surfaceGrip(state.trackId,state.condition), curve, Math.abs(rider.x) > roadHalf(state.trackId));
  const steering = clamp((target - rider.x) * .9 + forces.drift / forces.lateral, -1, 1);
  const canLean=kneeCapable && steering*Math.sign(curve)>=-.2 && Math.abs(rider.x)<=roadHalf(state.trackId) && !stunting(rider);
  const action=canLean && !(rider.kneeTime!>0) && rider.speed>=24 && Math.abs(curve)>.5
    ? curve>0?'kneeRight':'kneeLeft' : undefined;
  const pace = cornerPace(rider.z, state.trackId, rider.handling, state.condition, canLean?rider.kneePadId:undefined) * (rider.profile === 'careful' ? .94 : rider.profile === 'fast' ? 1.03 : .98);
  brake = Math.max(brake, clamp((rider.speed - pace) * .3, 0, 1));
  if (police && rider.z > player.z + 7) brake = Math.max(brake, .42);
  return { throttle: rider.speed > pace - .6 || brake > .1 ? 0 : 1, brake, steer: steering, attack, ...(action?{action}: {}) };
}

export function policeTarget(state: RaceState, officer: Rider): Rider | undefined {
  return state.riders.filter(r => r.id !== officer.id && r.profile !== 'police' && !r.out && r.finishedAt === null)
    .sort((a,b) => Math.hypot(a.z-officer.z,a.x-officer.x)-Math.hypot(b.z-officer.z,b.x-officer.x) || a.id.localeCompare(b.id))[0];
}

function applyCommand(state: RaceState, rider: Rider, command: Command) {
  contactGuardRail(state.trackId,rider);
  if (rider.out) { rider.speed = 0; rider.attack = null; return; }
  rider.cooldown = Math.max(0, rider.cooldown - STEP);
  rider.immune = Math.max(0, rider.immune - STEP);
  if(rider.hornCooldown)rider.hornCooldown=Math.max(0,rider.hornCooldown-STEP);
  if(rider.kneeTime)rider.kneeTime=Math.max(0,rider.kneeTime-STEP);
  if(rider.nitroTime)rider.nitroTime=Math.max(0,rider.nitroTime-STEP);
  advanceStunt(state,rider,command,STEP);
  if(command.action)performAction(state,rider,command.action);
  if (rider.finishedAt !== null) { rider.speed = Math.max(0, rider.speed - STEP * 12); return; }
  if (rider.crash > 0) {
    rider.crash = Math.max(0, rider.crash - STEP);
    rider.speed *= .975;
    rider.z += rider.speed * STEP;
    if (rider.crash === 0) {
      rider.health = 100;
      rider.immune = 2.4;
      rider.x = clamp(rider.x, -roadHalf(state.trackId)+1.6, roadHalf(state.trackId)-1.6);
      rider.speed = 12;
    }
    return;
  }
  const onShoulder = Math.abs(rider.x) > roadHalf(state.trackId);
  if(rider.kneeTime && (onShoulder || rider.speed<20 || command.steer*(rider.kneeSide ?? 0)<-.2))rider.kneeTime=0;
  const curve = curveAt(rider.z, state.trackId);
  // Integer simulation ticks make exactly three seconds safe. New taps do not
  // reset continuous contact; lifting the knee does. Prediction keeps the timer,
  // while only stepRace confirms the fall and damage.
  rider.wetKneeTicks=raceCondition(state.condition)==='rain' && kneeContact(rider,curve,state.trackId) ? (rider.wetKneeTicks ?? 0)+1 : 0;
  const boost=(rider.nitroTime ?? 0)>0 ? NITRO_MULTIPLIER : 1;
  const topSpeed=rider.maxSpeed*boost;
  const shoulderLimit = Math.abs(curve) > .8 ? .38 : .56;
  const max = topSpeed * (onShoulder ? shoulderLimit : 1) * (.92 + rider.integrity / 1250);
  const acceleration = command.throttle * rider.acceleration * boost * (onShoulder ? .55 : 1) * (1 - .35 * rider.speed / topSpeed);
  rider.speed = clamp(rider.speed + (acceleration - command.brake * 29 * surfaceBraking(state.trackId,state.condition) - (command.throttle ? 1.2 : 3.6) - surfaceDrag(state.trackId,state.condition) - (state.trackId==='terra'?9.8*ruralSlope(rider.z):0)) * STEP, 0, Math.max(rider.speed,topSpeed));
  if (rider.speed > max) rider.speed = Math.max(max, rider.speed - STEP * (onShoulder ? 34 : 4));
  const steering = clamp(command.steer, -1, 1);
  const forces = cornerForces(rider.speed, cornerHandling(rider,curve,state.trackId) * surfaceGrip(state.trackId,state.condition), curve, onShoulder);
  rider.x = clamp(rider.x + (steering * forces.lateral - forces.drift) * STEP, -lateralLimit(state.trackId), lateralLimit(state.trackId));
  contactGuardRail(state.trackId,rider,STEP);
  rider.lean += (steering * .32 - rider.lean) * .12;
  rider.z += rider.speed * STEP;
  if(state.trackId==='terra')contactGuardRail(state.trackId,rider);
  rider.health = Math.min(100, rider.health + STEP * 1.15);
  if (Math.abs(rider.x) > lateralLimit(state.trackId)-.7 && rider.speed > 26 && !rider.immune) {
    rider.integrity -= STEP * 2.2;
  }
  if (command.attack && !(rider.jumpTime!>0) && !rider.attack && rider.cooldown === 0 && (command.attack !== 'weapon' || rider.weapon)) {
    const target = nearestTarget(state, rider, command.attack);
    rider.attack = { kind: command.attack, age: 0, side: target ? Math.sign(target.x - rider.x) || 1 : Math.sign(steering) || 1, hit: false };
    rider.cooldown = attackSpec(rider,command.attack).cooldown + (rider.profile === 'player' ? 0 : .35);
    state.events.push({ type: 'attack', actor: rider.id });
  }
}

function resolveAttacks(state: RaceState) {
  for (const rider of state.riders) {
    const attack = rider.attack;
    if (!attack) continue;
    const spec = attackSpec(rider,attack.kind);
    const telegraph = rider.profile === 'player' ? 0 : .25;
    attack.age += STEP;
    if (attack.age >= spec.windup + telegraph && !attack.hit) {
      attack.hit = true;
      const target = nearestTarget(state, rider, attack.kind);
      if (target && (Math.sign(target.x - rider.x) === attack.side || Math.abs(target.x - rider.x) < .4)) {
        impact(state, target, spec.damage, attack.side * spec.push);
        rider.hits++;
        const action = attack.kind === 'kick' ? 'CHUTE' : attack.kind === 'weapon' ? getWeapon(rider.weaponId)?.action ?? 'BASTONADA' : 'SOCO';
        state.events.push({ type: 'hit', actor: rider.id, target: target.id, text: target.id === 'player' ? `VOCÊ LEVOU ${action} · ${rider.name}` : `${target.name} · ${action}!` });
        if (rider.profile === 'player') state.heat = clamp(state.heat + 12, 0, 100);
        if (attack.kind === 'punch' && target.weapon && !getWeapon(target.weaponId)) {
          target.weapon = false;
          rider.weapon = true;
          state.events.push({ type: 'steal', actor: rider.id, text: 'BASTÃO TOMADO!' });
        }
      }
    }
    if (attack.age >= spec.duration + telegraph) rider.attack = null;
  }
}

function mayCollide(state: RaceState, a: string, b: string, cooldown = 1.4) {
  const key = [a, b].sort().join(':');
  if ((state.collisions[key] ?? -99) + cooldown > state.time) return false;
  state.collisions[key] = state.time;
  return true;
}
function resolveCollisions(state: RaceState, oldZ: Map<string, number>) {
  for (const r of state.riders) {
    if (r.out || r.crash || r.immune || r.finishedAt !== null) continue;
    for (const t of state.traffic) {
      if(clearsCar(r,t))continue;
      const relBefore = t.z - t.speed * STEP - (oldZ.get(r.id) ?? r.z);
      const relNow = t.z - r.z;
      if ((Math.abs(relNow) < trafficShape(state.trackId,t.kind).length || relBefore * relNow < 0) && Math.abs(t.x - r.x) < trafficShape(state.trackId,t.kind).contact && mayCollide(state, r.id, t.id)) {
        r.integrity = Math.max(0, r.integrity - (t.speed < 0 ? 22 : 14) / r.armor);
        crashRider(state, r);
      }
    }
    for (const o of state.obstacles) {
      if (Math.abs(o.z - r.z) < 2 && Math.abs(o.x - r.x) < (o.kind==='cone'?.55:1) && mayCollide(state, r.id, o.id, 3)) {
        if(o.kind==='cone'){r.speed*=.9;r.health=Math.max(1,r.health-4);state.events.push({type:'hit',actor:o.id,text:'CONE · PERDEU VELOCIDADE'});}
        else if(o.kind==='gravel' || o.kind==='mud'){r.speed*=o.kind==='mud'?.78:.85;state.events.push({type:'hit',actor:o.id,text:o.kind==='mud'?'LAMA · PERDEU TRAÇÃO':'CASCALHO · PERDEU TRAÇÃO'});}
        else if (o.kind === 'oil') { impact(state, r, 23, r.x < 0 ? -.8 : .8); r.speed *= .64; state.events.push({ type: 'hit', actor: o.id, text: 'ÓLEO · SEM ADERÊNCIA' }); }
        else { r.integrity -= 15 / r.armor; crashRider(state, r); }
      }
    }
    for (const other of state.riders) {
      if (other.id <= r.id || other.out || other.crash || other.immune || other.finishedAt !== null) continue;
      if (Math.abs(other.z - r.z) < 2.1 && Math.abs(other.x - r.x) < .8 && mayCollide(state, r.id, other.id)) {
        const side = Math.sign(r.x - other.x) || 1;
        impact(state, r, 7, side * .35);
        impact(state, other, 7, -side * .35);
        state.events.push({ type: 'hit', actor: r.id, text: 'CONTATO!' });
      }
    }
  }
}

export function createMultiplayerRace(trackId: string, players: { id: string; name: string; helmetId?: string; helmetColorId?: string; bikeId?: string; kneePadId?: string; nitro?: number; weaponId?: string }[], seed = 88117, fillBots = false, condition: RaceCondition = 'sunset'): RaceState {
  if (players.length < 2 || players.length > 8 || new Set(players.map(p => p.id)).size !== players.length) throw new Error('A corrida precisa de 2 a 8 pilotos distintos.');
  const state = createRace(trackId, undefined, seed, condition);
  const colors = ['#dcff74', '#d87bfa', '#6cdace', '#f28451', '#ebbc5c', '#a4bde2', '#ef6f8a', '#e7e6dc'];
  const base = state.riders[0];
  const bots = state.riders.slice(1);
  const grid=trackId==='terra'?[2.1,-2.1]:[-5.1,-1.7,1.7,5.1];
  state.riders = players.map((p,i) => ({ ...base, ...stockBike(p.bikeId), helmetId:getHelmet(p.helmetId).id, helmetColorId:getHelmetColor(p.helmetColorId).id, weaponId:getWeapon(p.weaponId)?.id, kneePadId:getKneePad(p.kneePadId)?.id, nitro:nitroCount(p.bikeId,p.nitro), id: p.id, name: p.name, color: colors[i], x: grid[i%grid.length], z: -(Math.floor(i/grid.length)*(trackId==='terra'?10:8)), profile: 'player' }));
  if (fillBots) for (let i = players.length; i < 8; i++) {
    const bot = bots[i - players.length];
    const bike=BIKES[i%BIKES.length],pad=rivalKneePad(bike.id,bot.profile,getTrack(trackId).level);
    state.riders.push({ ...base, ...stockBike(bike.id), ...(pad?{kneePadId:pad}:{}), helmetId:bot.helmetId, helmetColorId:bot.helmetColorId, id: `cpu-${i}`, name: `${bot.name} CPU`, profile: bot.profile, color: colors[i], x: grid[i%grid.length], targetX: grid[i%grid.length], z: -(Math.floor(i/grid.length)*(trackId==='terra'?10:8)) });
  }
  state.multiplayer = { humanIds: players.map(p => p.id), results: {} };
  return state;
}

export function finishRider(state: RaceState, rider: Rider, reason: RaceResult['reason'], arrestCause?: 'fall' | 'stopped') {
  if (state.multiplayer?.results[rider.id] || rider.out) return;
  cancelStunt(rider);rider.kneeTime=0;rider.wetKneeTicks=0;
  if (reason !== 'finish') { rider.out = reason; rider.attack = null; }
  const place = ranking(state).findIndex(r => r.id === rider.id) + 1;
  const result: RaceResult = { reason, ...(reason === 'caught' ? { arrestCause: arrestCause ?? 'stopped' } : {}), place,
    time: rider.finishedAt ?? state.time, reward: state.multiplayer ? 0 : reason === 'finish' ? Math.round(getTrack(state.trackId).prize * ([1,.8,.64,.5,.4,.32,.25,.2][place-1] ?? .2)) : 120,
    hits: rider.hits, falls: rider.falls };
  if (state.multiplayer) {
    state.multiplayer.results[rider.id] = result;
    if (state.mode !== 'finished' && state.multiplayer.humanIds.every(id => state.multiplayer!.results[id])) {
      state.mode = 'finished';
      for (const bot of state.riders) if (bot.profile !== 'player' && bot.profile !== 'police' && !state.multiplayer.results[bot.id]) {
        finishRider(state,bot,bot.finishedAt !== null ? 'finish' : 'timeout');
      }
    }
  } else if (rider.id === 'player') { state.result = result; state.mode = 'finished'; }
  state.events.push({ type: 'finish', actor: rider.id });
}

function arrestFallenRiders(state: RaceState): boolean {
  for (const p of state.riders) {
    if (p.profile === 'police' || p.out || p.finishedAt !== null || p.crash <= 0) continue;
    const near = state.riders.some(r => r.profile === 'police' && !r.out && r.crash <= 0 && r.integrity > 0 && Math.hypot(r.z-p.z,r.x-p.x) <= FALL_ARREST_RADIUS);
    if (near) { p.capture = 3; if (p.id === 'player') state.capture = 3; finishRider(state,p,'caught','fall'); }
  }
  return state.mode === 'finished';
}

// Client prediction reuses movement only. Hits, damage, arrests and results are
// always confirmed by the authoritative simulation, never by the browser.
export function predictMovement(state: RaceState, rider: Rider, command: Command) {
  applyCommand(state, rider, { ...command, attack: null, action: undefined });
}

export function stepRace(state: RaceState, commands: Record<string, Command> = {}) {
  state.events = [];
  if (state.mode === 'finished') return;
  state.tick++;
  if (state.mode === 'countdown') {
    state.countdown -= STEP;
    if (state.countdown <= 0) { state.countdown = 0; state.mode = 'racing'; }
    return;
  }
  state.time += STEP;
  if (arrestFallenRiders(state)) return;
  const player = state.riders[0];
  const oldOrder = ranking(state).map(r => r.id);
  const oldZ = new Map(state.riders.map(r => [r.id,r.z]));
  for (const r of state.riders) {
    applyCommand(state,r,commands[r.id] ?? (r.profile === 'player' ? EMPTY_COMMAND : botCommand(state,r)));
    if(!r.out && !r.crash && r.finishedAt===null && (r.wetKneeTicks ?? 0)*STEP>WET_KNEE_LIMIT) {
      crashRider(state,r,true);
      state.events[state.events.length-1].text='JOELHO NO MOLHADO POR TEMPO DEMAIS · QUEDA!';
    }
  }
  const active = state.riders.filter(r => r.profile !== 'police' && !r.out && r.finishedAt === null);
  const back = Math.min(...active.map(r => r.z), player.z);
  for (const t of state.traffic) { t.z += t.speed*STEP; if (t.z < back-100) t.z += getTrack(state.trackId).distance+1800; }
  resolveAttacks(state); resolveCollisions(state,oldZ);
  if (arrestFallenRiders(state)) return;
  if (active.some(r => r.profile === 'player' && r.speed > 49)) state.heat = clamp(state.heat+STEP*.37,0,100);
  else state.heat = Math.max(0,state.heat-STEP*.15);
  const front = active.slice().sort((a,b) => b.z-a.z)[0];
  if (!state.policeActive && state.heat >= 48 && front && front.z > 1300) {
    const police = makeRider('police','POLÍCIA','police','#e7e9e5',guardRailPosition(state.trackId,state.trackId==='terra'?clamp(front.x+1.5,-3,3):front.x+1.5,front.z-100),front.z-100);
    police.bikeId = 'estradeira'; police.speed = 58; police.maxSpeed = 71+getTrack(state.trackId).level*2; police.acceleration = 12.5; police.weapon = true;
    state.riders.push(police); state.policeActive = true;
    state.events.push({ type: 'police', actor: 'police', text: 'POLÍCIA NA ESTRADA · CUIDADO!' });
  }
  const officers = state.riders.filter(r => r.profile === 'police' && !r.crash && r.integrity > 0);
  const length = getTrack(state.trackId).distance;
  // Record all crossings before assigning places, including ties within a tick.
  for (const r of state.riders) if (r.profile !== 'police' && !r.out && r.finishedAt === null && r.z >= length) {
    r.finishedAt = state.time-(r.z-length)/Math.max(.1,r.speed); r.z = length;
  }
  for (const r of state.riders) {
    if (r.profile === 'police' || r.out) continue;
    const previous = !state.multiplayer && r.id === 'player' ? state.capture : (r.capture ?? 0);
    r.capture = officers.some(c => Math.abs(c.z-r.z)<18 && Math.abs(c.x-r.x)<4 && r.speed<8) ? previous+STEP : Math.max(0,previous-STEP*2);
    if (r.id === 'player') state.capture = r.capture;
    if (r.finishedAt !== null) {
      if (state.multiplayer ? !state.multiplayer.results[r.id] : r.id === 'player') finishRider(state,r,'finish');
    } else if (r.integrity <= 0) finishRider(state,r,'wrecked');
    else if (r.capture >= 3) finishRider(state,r,'caught');
    else if (state.multiplayer && state.time >= 360) finishRider(state,r,'timeout');
  }
  advanceScenicEvent(state);
  advanceBanter(state);
  for (const [index,r] of ranking(state).entries()) if (index < oldOrder.indexOf(r.id)) state.events.push({ type: 'pass', actor: r.id });
  if (state.tick%600===0) for (const key of Object.keys(state.collisions)) if (state.time-state.collisions[key]>5) delete state.collisions[key];
}

export function snapshot(state: RaceState): string { return JSON.stringify(state); }
export function restoreSnapshot(raw: string): RaceState {
  const state = JSON.parse(raw) as RaceState;
  if (state.version !== 1 || !Array.isArray(state.riders) || !Number.isFinite(state.tick)) throw new Error('Snapshot incompatível.');
  return state;
}
