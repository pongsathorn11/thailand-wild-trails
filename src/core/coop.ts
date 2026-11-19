/**
 * Co-op hiking protocol and the rules both sides share. No network code here, so it is testable
 * and runs in the browser and in the Node game server (server/coop-server.ts).
 *
 * Server authority: the server moves every hiker with the same moveHiker() the game uses.
 * Clients send inputs only (one per 50 ms step); they may make themselves slower (backpack weight,
 * exhaustion, slippery path) but never faster, and cannot send more steps than real time allows.
 */
import { CONFIG } from './config';
import { moveHiker, newHiker, type Dir, type Hiker, type HikeEnv } from './hiker';
import type { WorldMap } from './world';
import { TRAILS, type WeatherId } from '../data/trails';
import { LOOK_OPTIONS, type Body, type LookIndices, type LookRow } from '../data/looks';

export const COOP_STEP = 0.05;        // seconds per input step (20 Hz)
export const COOP_SNAPSHOT_HZ = 15;
export const COOP_MAX_PLAYERS = 4;
export const COOP_BURST = 10;         // extra steps a client may bank (network jitter)
export const ROOM_CODE_LEN = 4;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const LOOK_ROWS: LookRow[] = ['hairStyle', 'hair', 'skin', 'face', 'outfit', 'acc'];

export interface CoopInput { l: boolean; r: boolean; u: boolean; d: boolean; run: boolean; sit: boolean; /** 0.3–1, own slow-downs */ slow: number }
export interface CoopLook { body: Body; looks: LookIndices }

export type ClientMsg =
  | { t: 'join'; trail: string; room: string; token: string | null; name: string; look: CoopLook }
  | { t: 'input'; seq: number; inp: CoopInput }
  | { t: 'chat'; emote: Emote };

export const EMOTES = ['wave', 'photo', 'rest', 'go'] as const;
export type Emote = (typeof EMOTES)[number];

export interface PlayerSnap { id: string; x: number; y: number; dir: Dir; frame: number; moving: boolean; sitting: boolean; ack: number }
export type ServerMsg =
  | { t: 'welcome'; id: string; weather: WeatherId; startedAt: number; players: { id: string; name: string; look: CoopLook }[] }
  | { t: 'joined'; id: string; name: string; look: CoopLook }
  | { t: 'left'; id: string }
  | { t: 'snap'; players: PlayerSnap[] }
  | { t: 'emote'; id: string; emote: Emote }
  | { t: 'error'; code: 'full' | 'auth' | 'bad' | 'trail' | 'room' };

// ---------- untrusted input ----------
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown): boolean => v === true;

export function cleanRoomCode(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const c = s.trim().toUpperCase();
  return c.length === ROOM_CODE_LEN && [...c].every((ch) => ROOM_ALPHABET.includes(ch)) ? c : null;
}

export function newRoomCode(rng: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) s += ROOM_ALPHABET[Math.floor(rng() * ROOM_ALPHABET.length)];
  return s;
}

export function cleanName(v: unknown, fallback = 'Hiker'): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').trim() : '';
  return Array.from(s || fallback).slice(0, 20).join('');
}

export function cleanLook(v: unknown): CoopLook {
  const o = isObj(v) ? v : {}, body: Body = o.body === 'female' ? 'female' : 'male';
  const src = isObj(o.looks) ? o.looks : {}, looks = {} as LookIndices;
  for (const k of LOOK_ROWS) {
    const n = Number(src[k]);
    looks[k] = Number.isInteger(n) && n >= 0 && n < LOOK_OPTIONS[k].length ? n : 0;
  }
  return { body, looks };
}

export function cleanInput(v: unknown): CoopInput {
  const o = isObj(v) ? v : {}, slow = Number(o.slow);
  return { l: bool(o.l), r: bool(o.r), u: bool(o.u), d: bool(o.d), run: bool(o.run), sit: bool(o.sit), slow: Number.isFinite(slow) ? Math.min(1, Math.max(0.3, slow)) : 1 };
}

/** Parses one message from a client. Anything malformed becomes null and is dropped. */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  let m: unknown = raw;
  if (typeof raw === 'string') { if (raw.length > 4000) return null; try { m = JSON.parse(raw); } catch { return null; } }
  if (!isObj(m)) return null;
  if (m.t === 'join') {
    const room = cleanRoomCode(m.room);
    if (!room || typeof m.trail !== 'string' || !TRAILS.some((t) => t.id === m.trail)) return null;
    const token = typeof m.token === 'string' && m.token.length < 3000 ? m.token : null;
    return { t: 'join', trail: m.trail, room, token, name: cleanName(m.name), look: cleanLook(m.look) };
  }
  if (m.t === 'input') {
    const seq = Number(m.seq);
    if (!Number.isSafeInteger(seq) || seq < 0) return null;
    return { t: 'input', seq, inp: cleanInput(m.inp) };
  }
  if (m.t === 'chat' && (EMOTES as readonly string[]).includes(m.emote as string)) return { t: 'chat', emote: m.emote as Emote };
  return null;
}

// ---------- shared simulation ----------
/** The movement environment both sides use for one step. Only the room's weather and the player's own slow-down matter. */
export const coopEnv = (weather: WeatherId, slow: number): HikeEnv => ({
  weather, hour: 12, zone: '', climateC: 0, overweight: false, wet: false, speedMult: Math.min(1, Math.max(0.3, slow)),
});

/** One authoritative 50 ms step. The server never drains stamina, so running is the client's honest choice (already folded into `run`). */
export function stepHiker(h: Hiker, world: WorldMap, inp: CoopInput, weather: WeatherId): void {
  h.stamina = 100; h.exhausted = false;
  if (inp.sit && !(inp.l || inp.r || inp.u || inp.d)) { h.sitting = true; h.moving = false; return; }
  moveHiker(h, world, { left: inp.l, right: inp.r, up: inp.u, down: inp.d, run: inp.run }, coopEnv(weather, inp.slow), COOP_STEP);
}

export const coopHiker = (world: WorldMap): Hiker => newHiker(world, false);

export function snapOf(id: string, h: Hiker, ack: number): PlayerSnap {
  return { id, x: Math.round(h.x * 10) / 10, y: Math.round(h.y * 10) / 10, dir: h.dir, frame: h.frame, moving: h.moving, sitting: h.sitting, ack };
}

/**
 * Speed-hack guard: a client earns one step per 50 ms of real time (plus a small burst bank).
 * Returns how many queued steps may run now and the remaining budget.
 */
export function stepBudget(budget: number, elapsedSec: number, queued: number): { run: number; budget: number } {
  const b = Math.min(COOP_BURST, budget + elapsedSec / COOP_STEP);
  const run = Math.min(queued, Math.floor(b));
  return { run, budget: b - run };
}

/** Max distance a hiker can legally move in one step (for sanity checks and tests). */
export const MAX_STEP_PX = CONFIG.RUN_SPEED * 1.6 * COOP_STEP;

export const roomKey = (trail: string, code: string): string => `${trail}:${code}`;
