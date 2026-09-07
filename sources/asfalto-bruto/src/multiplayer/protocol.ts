import type { Command, RaceState } from '../game/types';

export const NET_VERSION = 1;
export const MAX_PLAYERS = 8;
export const ROOM_WAIT_MS = 60_000;
export const READY_WAIT_MS = 5_000;
export const RECONNECT_MS = 15_000;
export interface MemberView { id: string; name: string; ready: boolean; connected: boolean; }
export interface RoomView {
  code: string; trackId: string; phase: 'lobby' | 'racing' | 'finished'; locked: boolean;
  deadline: number | null; serverNow: number; revision: number; members: MemberView[];
  race: RaceState | null; ack: Record<string, number>;
}
export type ClientMessage =
  | { type: 'create'; version: number; name: string; trackId: string }
  | { type: 'join'; version: number; name: string; code: string }
  | { type: 'resume'; version: number; code: string; token: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'input'; seq: number; command: Command }
  | { type: 'ping'; sentAt: number }
  | { type: 'leave' };
export type ServerMessage =
  | { type: 'welcome'; id: string; token: string; room: RoomView }
  | { type: 'state'; room: RoomView }
  | { type: 'error'; message: string; fatal?: boolean }
  | { type: 'pong'; sentAt: number; serverNow: number }
  | { type: 'left' };

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu,'').trim().slice(0,18) || 'Piloto' : 'Piloto';
}
export function cleanCommand(value: unknown): Command | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Command;
  if (![c.throttle,c.brake,c.steer].every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  if (c.attack !== null && !['punch','kick','weapon'].includes(c.attack)) return null;
  return { throttle: Math.max(0,Math.min(1,c.throttle)), brake: Math.max(0,Math.min(1,c.brake)), steer: Math.max(-1,Math.min(1,c.steer)), attack: c.attack };
}
