import { randomBytes } from 'node:crypto';
import { createMultiplayerRace, finishRider, STEP, stepRace } from '../src/game/simulation';
import { TRACKS } from '../src/game/content';
import { EMPTY_COMMAND, type Command } from '../src/game/types';
import { cleanName, MAX_PLAYERS, READY_WAIT_MS, RECONNECT_MS, ROOM_WAIT_MS, type AttackInput, type MemberView, type RoomView } from '../src/multiplayer/protocol';

export interface Member extends MemberView { token: string; epoch: string; lastSeen: number; }
export interface Room extends Omit<RoomView,'members'|'serverNow'|'simulationAt'> {
  members: Member[]; updatedAt: number; createdAt: number; finishedAt: number | null;
}
export interface StoredInput { seq: number; command: Command; at: number; attacks?: AttackInput[]; }
export type Inputs = Record<string, StoredInput>;
export const inputKey = (member: Member) => `${member.id}:${member.epoch}`;
export const secret = () => randomBytes(24).toString('base64url');
export function makeMember(name: unknown, now: number): Member {
  return { id: `human-${randomBytes(8).toString('hex')}`, name: cleanName(name), ready: false, connected: true, token: secret(), epoch: secret(), lastSeen: now };
}
export function makeRoom(code: string, trackId: unknown, member: Member, now: number, fillBots = false): Room {
  if (!TRACKS.some(t => t.id === trackId)) throw new Error('Estrada inválida.');
  return { code, trackId: trackId as string, fillBots: fillBots === true, phase: 'lobby', locked: false, deadline: now+ROOM_WAIT_MS, revision: 0,
    members: [member], race: null, ack: {}, attackAck: {}, updatedAt: now, createdAt: now, finishedAt: null };
}
export function viewRoom(room: Room, now: number): RoomView {
  return { code: room.code, trackId: room.trackId, fillBots: room.fillBots, phase: room.phase, locked: room.locked, deadline: room.deadline,
    revision: room.revision, serverNow: now, simulationAt: room.updatedAt, members: room.members.map(({id,name,ready,connected}) => ({id,name,ready,connected})), race: room.race, ack: room.ack, attackAck: room.attackAck };
}
export function lobbyClock(room: Room, now: number) {
  if (room.phase !== 'lobby') return;
  const present = room.members.filter(p => p.connected);
  if (present.length < 2) {
    if (room.locked) { room.locked = false; room.deadline = now+ROOM_WAIT_MS; }
    if (room.deadline !== null && now >= room.deadline) room.deadline = null;
    return;
  }
  if (room.deadline === null) room.deadline = now+ROOM_WAIT_MS;
  if (!room.locked && present.every(p => p.ready)) room.deadline = Math.min(room.deadline,now+READY_WAIT_MS);
  if (room.deadline-now <= READY_WAIT_MS) room.locked = true;
  if (now < room.deadline) return;
  room.members = present;
  room.race = createMultiplayerRace(room.trackId,present,randomBytes(4).readUInt32LE(),room.fillBots);
  room.race.mode = 'racing'; room.race.countdown = 0;
  room.phase = 'racing'; room.updatedAt = now; room.deadline = null;
}
export function joinRoom(room: Room, member: Member, now: number) {
  lobbyClock(room,now);
  if (room.phase !== 'lobby' || room.locked) throw new Error('A largada já foi fechada. Entre em outra sala.');
  room.members = room.members.filter(p => p.connected);
  if (room.members.length >= MAX_PLAYERS) throw new Error('Sala cheia: o limite é de 8 pessoas.');
  room.members.push(member); lobbyClock(room,now);
}
export function setReady(room: Room, id: string, epoch: string, ready: boolean, now: number) {
  const member = room.members.find(p => p.id === id && p.epoch === epoch);
  if (!member?.connected || room.phase !== 'lobby' || room.locked) return;
  member.ready = ready; member.lastSeen = now; lobbyClock(room,now);
}
export function depart(room: Room, id: string, epoch: string, now: number, explicit = false) {
  const member = room.members.find(p => p.id === id && p.epoch === epoch);
  if (!member) return;
  member.connected = false; member.ready = false; member.lastSeen = now;
  if (explicit && room.race) {
    const rider = room.race.riders.find(r => r.id === id);
    if (rider && !room.race.multiplayer!.results[id]) finishRider(room.race,rider,'left');
  }
  if (explicit && room.phase === 'lobby') room.members = room.members.filter(p => p !== member);
  lobbyClock(room,now);
}
export function pulseRoom(room: Room, inputs: Inputs, now: number) {
  for (const m of room.members) {
    const input = inputs[inputKey(m)];
    if (input && input.at > m.lastSeen) { m.lastSeen = input.at; m.connected = true; }
    if (now-m.lastSeen > RECONNECT_MS) { m.connected = false; m.ready = false; }
  }
  if (room.phase === 'lobby') { lobbyClock(room,now); return; }
  if (!room.race || room.phase === 'finished') return;
  for (const m of room.members) {
    if (!m.connected && now-m.lastSeen > RECONNECT_MS) {
      const r = room.race.riders.find(r => r.id === m.id);
      if (r) finishRider(room.race,r,'left');
    }
  }
  // Wall time controls the number of simulation steps. Client sequence numbers
  // acknowledge input only; they cannot speed up a rider or advance the clock.
  const steps = Math.min(120,Math.max(0,Math.floor((now-room.updatedAt)/(STEP*1000))));
  const commands: Record<string,Command> = {};
  for (const m of room.members) {
    const latest = inputs[inputKey(m)];
    commands[m.id] = m.connected && latest && now-latest.at < 500 ? latest.command : { ...EMPTY_COMMAND, brake: 1 };
    if (latest && steps > 0) room.ack[m.id] = latest.seq;
  }
  // Keep short taps until a simulation step can execute them. Input packets can
  // be coalesced by the transport/store without dropping or repeating a swing.
  const events = room.race.events.filter(e=>e.tick!==undefined && e.tick>room.race!.tick-60);
  for (let i=0;i<steps;i++) {
    const tickCommands={...commands};const started:{id:string;seq:number}[]=[];
    for(const m of room.members) {
      const latest=inputs[inputKey(m)],rider=room.race.riders.find(r=>r.id===m.id);
      if(!latest || !m.connected || now-latest.at>=500 || !rider)continue;
      const action=latest.attacks?.find(a=>a.seq>(room.attackAck[m.id] ?? 0));
      if(!action)continue;
      if(rider.out || rider.crash || rider.finishedAt!==null || (action.kind==='weapon' && !rider.weapon)) {room.attackAck[m.id]=action.seq;continue;}
      if(rider.attack || rider.cooldown>STEP)continue;
      tickCommands[m.id]={...commands[m.id],attack:action.kind};
      room.attackAck[m.id]=action.seq;started.push({id:m.id,seq:action.seq});
    }
    stepRace(room.race,tickCommands);
    for(const a of started){const rider=room.race.riders.find(r=>r.id===a.id);if(rider?.attack)rider.attack.id=a.seq;}
    events.push(...room.race.events.map(e=>({...e,tick:room.race!.tick})));
  }
  room.race.events = events.filter(e=>(e.tick ?? 0)>room.race!.tick-60).slice(-128);
  room.updatedAt += steps*STEP*1000;
  // After a long service interruption resume from the saved position, without
  // fast-forwarding riders through several seconds of unseen collisions.
  if (now-room.updatedAt > 2000) room.updatedAt = now;
  if (room.race.mode === 'finished') { room.phase = 'finished'; room.finishedAt = now; }
}
