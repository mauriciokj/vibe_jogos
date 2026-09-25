import { onlineBike } from '../src/game/bikes';
import { getHelmet, getHelmetColor } from '../src/game/helmets';
import { getWeapon } from '../src/game/weapons';
import { CONDITIONS, raceCondition } from '../src/game/conditions';
import { randomBytes } from 'node:crypto';
import { createMultiplayerRace, finishRider, STEP, stepRace } from '../src/game/simulation';
import { TRACKS, getBike } from '../src/game/content';
import { getKneePad, nitroCount } from '../src/game/equipment';
import { EMPTY_COMMAND, type Command } from '../src/game/types';
import { nextRaceRoute } from '../src/game/routes';
import type { RematchChoice } from '../src/multiplayer/protocol';
import { cleanName, MAX_PLAYERS, READY_WAIT_MS, RECONNECT_MS, ROOM_WAIT_MS, PUBLIC_ROOM_WAIT_MS, type PublicRoomView, type AttackInput, type ActionInput, type Loadout, type MemberView, type RoomView } from '../src/multiplayer/protocol';

export interface Member extends MemberView { token: string; epoch: string; lastSeen: number; accountId?: string; left?: boolean; }
export interface Room extends Omit<RoomView,'members'|'serverNow'|'simulationAt'> {
  members: Member[]; updatedAt: number; createdAt: number; finishedAt: number | null;
}
export interface StoredInput { seq: number; command: Command; at: number; attacks?: AttackInput[]; actions?: ActionInput[]; }
export type Inputs = Record<string, StoredInput>;
export const inputKey = (member: Member) => `${member.id}:${member.epoch}`;
export const secret = () => randomBytes(24).toString('base64url');
export function makeMember(name: unknown, now: number, bikeId?: unknown, loadout?: Loadout): Member {
  const bike=onlineBike(typeof bikeId==='string'?bikeId:undefined);
  return { id: `human-${randomBytes(8).toString('hex')}`, name: cleanName(name), bikeId: bike.id, helmetId:getHelmet(loadout?.helmetId).id, helmetColorId:getHelmetColor(loadout?.helmetColorId).id, weaponId:getWeapon(loadout?.weaponId)?.id, kneePadId:getKneePad(loadout?.kneePadId)?.id, nitro:nitroCount(bike.id,loadout?.nitro), ready: false, connected: true, token: secret(), epoch: secret(), lastSeen: now };
}
export function makeRoom(code: string, trackId: unknown, member: Member, now: number, fillBots = false, condition?: unknown, isPublic = false): Room {
  if (!TRACKS.some(t => t.id === trackId)) throw new Error('Estrada inválida.');
  if(condition!==undefined && !CONDITIONS.some(c=>c.id===condition))throw new Error('Condição inválida.');
  return { code, round:0, public: isPublic === true, condition: raceCondition(condition), trackId: trackId as string, fillBots: fillBots === true, phase: 'lobby', locked: false, deadline: now+(isPublic === true ? PUBLIC_ROOM_WAIT_MS : ROOM_WAIT_MS), revision: 0,
    members: [member], race: null, ack: {}, attackAck: {}, actionAck: {}, updatedAt: now, createdAt: now, finishedAt: null };
}
export function viewRoom(room: Room, now: number): RoomView {
  const waiting=continuationMembers(room,now);
  return { code: room.code, round:room.round ?? 0, hostId:hostId(room), manualStart:room.manualStart, continuationCount:waiting.length, reconnectingCount:waiting.filter(m=>!m.connected).length, previous:room.previous, public: room.public === true, condition: raceCondition(room.condition), trackId: room.trackId, fillBots: room.fillBots, phase: room.phase, locked: room.locked, deadline: room.deadline,
    revision: room.revision, serverNow: now, simulationAt: room.updatedAt, members: room.members.map(({id,entryId,continuation,name,bikeId,helmetId,helmetColorId,weaponId,kneePadId,nitro,ready,connected}) => ({id,entryId,continuation,name,bikeId,helmetId,helmetColorId,weaponId,kneePadId,nitro,ready,connected})), race: room.race, ack: room.ack, attackAck: room.attackAck, actionAck:room.actionAck };
}
export function hostId(room:Room){return room.members.find(m=>m.connected&&!m.left)?.id;}
function continuationMembers(room:Room,now:number){return room.members.filter(m=>!m.left&&(m.connected||now-m.lastSeen<=RECONNECT_MS));}
// Discovery exposes only joinable lobby metadata, never members or credentials.
export function publicRoomView(room: Room, now: number): PublicRoomView | null {
  if (room.public !== true || room.phase !== 'lobby' || room.locked || now-room.createdAt > 30*60_000) return null;
  const players=room.members.filter(m=>m.connected && now-m.lastSeen<=RECONNECT_MS).length;
  if (!players || players>=MAX_PLAYERS || (players>=2 && room.deadline!==null && room.deadline-now<=READY_WAIT_MS)) return null;
  return {code:room.code,trackId:room.trackId,condition:raceCondition(room.condition),fillBots:room.fillBots,players,maxPlayers:MAX_PLAYERS,deadline:room.deadline!==null && room.deadline>now ? room.deadline : null};
}
export function sortPublicRooms(rooms: PublicRoomView[]) {
  return rooms.sort((a,b)=>b.players-a.players || (a.deadline ?? Infinity)-(b.deadline ?? Infinity) || a.code.localeCompare(b.code)).slice(0,50);
}
export function lobbyClock(room: Room, now: number) {
  if (room.phase !== 'lobby') return;
  const present = room.members.filter(p => p.connected);
  if (present.length < 2) {
    if (room.locked) { room.locked = false; room.deadline = room.manualStart?null:now+(room.public ? PUBLIC_ROOM_WAIT_MS : ROOM_WAIT_MS); }
    if (room.deadline !== null && now >= room.deadline) room.deadline = null;
    return;
  }
  if(room.manualStart && !room.locked && !present.every(p=>p.ready)){room.deadline=null;return;}
  if (room.deadline === null) room.deadline = now+(room.manualStart?READY_WAIT_MS:room.public ? PUBLIC_ROOM_WAIT_MS : ROOM_WAIT_MS);
  if (!room.locked && present.every(p => p.ready)) room.deadline = Math.min(room.deadline,now+READY_WAIT_MS);
  if (room.deadline-now <= READY_WAIT_MS) room.locked = true;
  if (now < room.deadline) return;
  room.members = present;
  room.race = createMultiplayerRace(room.trackId,present,randomBytes(4).readUInt32LE(),room.fillBots,room.condition);
  room.race.mode = 'racing'; room.race.countdown = 0;
  room.phase = 'racing'; room.updatedAt = now; room.deadline = null;
}
export function joinRoom(room: Room, member: Member, now: number) {
  lobbyClock(room,now);
  if (room.phase !== 'lobby' || room.locked) throw new Error('A largada já foi fechada. Entre em outra sala.');
  room.members = room.members.filter(p => p.connected);
  if (room.members.length >= MAX_PLAYERS) throw new Error('Sala cheia: o limite é de 8 pessoas.');
  if(member.accountId && room.members.some(m=>m.accountId===member.accountId))throw new Error('Esta conta já está na sala.');
  room.members.push(member); lobbyClock(room,now);
}
export function setReady(room: Room, id: string, epoch: string, ready: boolean, now: number) {
  const member = room.members.find(p => p.id === id && p.epoch === epoch);
  if (!member?.connected || room.phase !== 'lobby' || room.locked) return;
  member.ready = ready; member.lastSeen = now; lobbyClock(room,now);
}
export function setContinuation(room:Room,id:string,epoch:string,round:number,choice:RematchChoice,now:number){
  const m=room.members.find(p=>p.id===id&&p.epoch===epoch&&!p.left);
  if(!m?.connected || room.phase!=='finished' || round!==(room.round ?? 0) || !room.race?.multiplayer?.results[id])throw Error('Aguarde todos terminarem a corrida.');
  if(!['next','again','lobby'].includes(choice))throw Error('Opção inválida.');
  if(choice==='next'&&!nextRaceRoute(room.trackId,room.condition))throw Error('Esta é a última corrida. Volte à sala para escolher uma pista.');
  m.continuation=choice;m.lastSeen=now;
}
export function continuationChoice(room:Room,now:number):RematchChoice|undefined {
  if(room.phase!=='finished')return;
  const members=continuationMembers(room,now);
  if(members.some(m=>m.connected&&m.continuation==='lobby'))return 'lobby';
  const first=members[0]?.continuation;
  if(members.length>=2 && first && members.every(m=>m.connected&&m.continuation===first))return first;
}
export function reopenRoom(room:Room,choice:RematchChoice,now:number,prepare?:(members:Member[],previous:Member[])=>void){
  if(room.phase!=='finished'||!room.race)throw Error('A corrida ainda está em andamento.');
  const next=choice==='next'?nextRaceRoute(room.trackId,room.condition):null;
  if(choice==='next'&&!next)throw Error('Esta é a última corrida.');
  const previous=continuationMembers(room,now);
  const members=previous.map(m=>({...m,entryId:`human-${randomBytes(8).toString('hex')}`,continuation:undefined,ready:choice!=='lobby',nitro:room.race!.riders.find(r=>r.id===m.id)?.nitro ?? m.nitro}));
  prepare?.(members,previous);
  room.previous={race:structuredClone(room.race),members:viewRoom(room,now).members};
  room.members=members;room.round=(room.round ?? 0)+1;room.createdAt=now;room.updatedAt=now;room.finishedAt=null;
  if(next){room.trackId=next.track.id;room.condition=next.condition.id;}
  room.phase='lobby';room.race=null;room.manualStart=true;room.locked=false;room.deadline=null;
  // Keep sequence acknowledgements monotonic across rounds. Old input packets
  // and old actions must never become fresh commands in the next race.
  lobbyClock(room,now);
}
export function configureRoom(room:Room,id:string,epoch:string,round:number,patch:{trackId?:string;condition?:unknown;bikeId?:string;loadout?:Loadout},now:number,equip?:(member:Member,previous:Member)=>void){
  lobbyClock(room,now);
  const m=room.members.find(p=>p.id===id&&p.epoch===epoch&&!p.left);
  if(!m?.connected || room.phase!=='lobby'||room.locked||round!==(room.round ?? 0))throw Error('A sala já fechou a largada.');
  const route=patch.trackId!==undefined||patch.condition!==undefined;
  if(route){
    if(hostId(room)!==id)throw Error('Somente o anfitrião pode trocar a pista.');
    if(!TRACKS.some(t=>t.id===patch.trackId)||!CONDITIONS.some(c=>c.id===patch.condition))throw Error('Pista ou condição inválida.');
  }
  if(patch.bikeId!==undefined){
    const selected=makeMember(m.name,now,patch.bikeId,patch.loadout);
    const replacement={...m,bikeId:selected.bikeId,helmetId:selected.helmetId,helmetColorId:selected.helmetColorId,weaponId:selected.weaponId,kneePadId:selected.kneePadId,nitro:selected.nitro,entryId:selected.id,ready:false};
    equip?.(replacement,m);Object.assign(m,replacement);
  }
  if(route){room.trackId=patch.trackId!;room.condition=raceCondition(patch.condition);room.members.forEach(p=>p.ready=false);}
  m.lastSeen=now;lobbyClock(room,now);
}
export function depart(room: Room, id: string, epoch: string, now: number, explicit = false) {
  const member = room.members.find(p => p.id === id && p.epoch === epoch);
  if (!member) return;
  member.connected = false; member.ready = false; member.lastSeen = now;
  if(explicit){member.left=true;member.continuation=undefined;}
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
    if (!m.left && input && input.at > m.lastSeen) { m.lastSeen = input.at; m.connected = true; }
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
    const onFoot=!!room.race.riders.find(r=>r.id===m.id)?.recovery;
    commands[m.id] = m.connected && latest && now-latest.at < 500 ? latest.command : onFoot ? EMPTY_COMMAND : { ...EMPTY_COMMAND, brake: 1 };
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
      const ability=latest.actions?.find(a=>a.seq>(room.actionAck?.[m.id] ?? 0));
      if(ability){
        (room.actionAck ??= {})[m.id]=ability.seq;
        tickCommands[m.id]={...tickCommands[m.id],action:ability.kind};
      }
      const action=latest.attacks?.find(a=>a.seq>(room.attackAck[m.id] ?? 0));
      if(!action)continue;
      if(rider.out || rider.crash || (rider.jumpTime ?? 0)>0 || rider.finishedAt!==null || (action.kind==='weapon' && !rider.weapon)) {room.attackAck[m.id]=action.seq;continue;}
      if(rider.attack || rider.cooldown>STEP)continue;
      tickCommands[m.id]={...tickCommands[m.id],attack:action.kind};
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
