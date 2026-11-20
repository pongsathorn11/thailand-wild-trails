/**
 * Social Hub and parties: the rules both the browser and the game server use. No network code here.
 *
 * - The hub is a small plaza. Clients report their own position (10 times a second); the server only
 *   accepts moves a hiker could really make (not into trees or stalls, not faster than running).
 * - A party is up to 4 hikers. The leader picks the trail, everyone marks ready, the leader sets off and
 *   the server sends every member to the same co-op room (room code = party code).
 */
import { CONFIG } from './config';
import { COOP_MAX_PLAYERS, cleanLook, cleanName, cleanRoomCode, newRoomCode, EMOTES, type CoopLook, type Emote } from './coop';
import { HUB } from '../data/hub';
import { TRAILS } from '../data/trails';
import type { Dir } from './hiker';

export const HUB_CAPACITY = 24;        // hikers per plaza; more open another plaza
export const HUB_SNAPSHOT_HZ = 10;
export const HUB_SEND_MS = 100;        // how often a client reports its position
export const PARTY_MAX = COOP_MAX_PLAYERS;
const TS = CONFIG.TILE;

// ---------- the plaza map ----------
/** 1 = blocked tile. Tree border (with a gap back to camp), stalls, the party board, benches and the fire. */
export function hubSolid(): Uint8Array {
  const W = HUB.W, H = HUB.H, s = new Uint8Array(W * H), [g0, g1] = HUB.exitGap;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x === 0 || x === W - 1 || y === 0 || (y === H - 1 && !(x >= g0 && x <= g1))) s[y * W + x] = 1;
  }
  for (const sp of HUB.spots) {
    if (sp.type === 'gate' || sp.type === 'home') continue; // signposts: walk past them
    s[sp.y * W + sp.x] = 1;
    if (sp.type === 'info' || sp.type === 'cafe') s[sp.y * W + sp.x + 1] = 1; // two tiles wide
  }
  for (const [x, y] of HUB.benches) s[y * W + x] = 1;
  return s;
}

export function hubTileSolid(solid: Uint8Array, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= HUB.W || ty >= HUB.H) return true;
  return solid[ty * HUB.W + tx] === 1;
}

/** Same foot box as the camp: a hiker stands where all four corners are free. */
export function hubCanStand(solid: Uint8Array, px: number, py: number): boolean {
  return [[px - 4, py - 3], [px + 4, py - 3], [px - 4, py + 1], [px + 4, py + 1]]
    .every(([x, y]) => !hubTileSolid(solid, Math.floor(x / TS), Math.floor(y / TS)));
}

/** Where a newcomer appears: the camp path, nudged sideways so a crowd does not stack. */
export function hubSpawn(n: number): { x: number; y: number } {
  const [sx, sy] = HUB.start;
  return { x: sx * TS + 8 + ((n % 3) - 1) * 6, y: sy * TS + 10 };
}

/** Furthest a hiker may move between two reports (running speed, plus slack for network jitter). */
export const hubMaxMove = (dtSec: number): number => CONFIG.RUN_SPEED * Math.min(Math.max(dtSec, 0.15), 1) * 1.3 + 4;

/** Server check for one reported move. */
export function legalHubMove(solid: Uint8Array, from: { x: number; y: number }, to: { x: number; y: number }, dtSec: number): boolean {
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return false;
  if (Math.hypot(to.x - from.x, to.y - from.y) > hubMaxMove(dtSec)) return false;
  return hubCanStand(solid, to.x, to.y);
}

// ---------- parties ----------
export interface Party { code: string; leader: string; members: string[]; ready: string[]; trail: string }
export interface PartyBook { parties: Map<string, Party>; of: Map<string, string> }
export const newPartyBook = (): PartyBook => ({ parties: new Map(), of: new Map() });
export const partyOf = (b: PartyBook, pid: string): Party | null => { const c = b.of.get(pid); return (c && b.parties.get(c)) || null; };
const validTrail = (id: string): boolean => TRAILS.some((t) => t.id === id);

export type PartyResult = 'ok' | 'full' | 'none' | 'already' | 'notLeader' | 'notReady' | 'trail';

export function createParty(b: PartyBook, pid: string, trail: string, rng: () => number = Math.random): { r: PartyResult; party?: Party } {
  if (b.of.has(pid)) return { r: 'already' };
  if (!validTrail(trail)) return { r: 'trail' };
  let code = newRoomCode(rng);
  for (let i = 0; b.parties.has(code) && i < 50; i++) code = newRoomCode(rng);
  if (b.parties.has(code)) return { r: 'full' };
  const party: Party = { code, leader: pid, members: [pid], ready: [pid], trail };
  b.parties.set(code, party); b.of.set(pid, code);
  return { r: 'ok', party };
}

export function joinParty(b: PartyBook, pid: string, code: string): PartyResult {
  if (b.of.has(pid)) return 'already';
  const party = b.parties.get(code);
  if (!party) return 'none';
  if (party.members.length >= PARTY_MAX) return 'full';
  party.members.push(pid); b.of.set(pid, code);
  return 'ok';
}

/** Leaving passes the lead to the next member; an empty party is closed. Returns the party it left (if any). */
export function leaveParty(b: PartyBook, pid: string): Party | null {
  const party = partyOf(b, pid);
  if (!party) return null;
  b.of.delete(pid);
  party.members = party.members.filter((m) => m !== pid);
  party.ready = party.ready.filter((m) => m !== pid);
  if (!party.members.length) { b.parties.delete(party.code); return party; }
  if (party.leader === pid) { party.leader = party.members[0]; if (!party.ready.includes(party.leader)) party.ready.push(party.leader); }
  return party;
}

/** Only the leader picks the trail; a new trail asks everyone to confirm again. */
export function setPartyTrail(b: PartyBook, pid: string, trail: string): PartyResult {
  const party = partyOf(b, pid);
  if (!party) return 'none';
  if (party.leader !== pid) return 'notLeader';
  if (!validTrail(trail)) return 'trail';
  if (party.trail !== trail) { party.trail = trail; party.ready = [pid]; }
  return 'ok';
}

export function setReady(b: PartyBook, pid: string, ready: boolean): PartyResult {
  const party = partyOf(b, pid);
  if (!party) return 'none';
  if (party.leader === pid) return 'ok'; // the leader is always ready
  party.ready = party.ready.filter((m) => m !== pid);
  if (ready) party.ready.push(pid);
  return 'ok';
}

export const allReady = (p: Party): boolean => p.members.every((m) => p.ready.includes(m));

/** The leader sets off once everyone is ready. The party closes; its members go to co-op room `code` on `trail`. */
export function departParty(b: PartyBook, pid: string): { r: PartyResult; party?: Party } {
  const party = partyOf(b, pid);
  if (!party) return { r: 'none' };
  if (party.leader !== pid) return { r: 'notLeader' };
  if (!allReady(party)) return { r: 'notReady' };
  b.parties.delete(party.code);
  for (const m of party.members) b.of.delete(m);
  return { r: 'ok', party };
}

// ---------- protocol ----------
export interface HubPlayer { id: string; name: string; look: CoopLook; title: string; x: number; y: number }
export interface HubSnap { id: string; x: number; y: number; dir: Dir; moving: boolean }
export interface PartyView { code: string; leader: string; trail: string; members: { id: string; name: string; ready: boolean }[] }
export interface PartyListing { code: string; leaderName: string; trail: string; size: number }

export type HubClientMsg =
  | { t: 'hub_join'; token: string | null; name: string; title: string; look: CoopLook }
  | { t: 'pos'; x: number; y: number; dir: Dir; moving: boolean }
  | { t: 'hub_emote'; emote: Emote }
  | { t: 'party_new'; trail: string }
  | { t: 'party_join'; code: string }
  | { t: 'party_leave' }
  | { t: 'party_trail'; trail: string }
  | { t: 'party_ready'; ready: boolean }
  | { t: 'party_go' };

export type HubServerMsg =
  | { t: 'hub_welcome'; id: string; x: number; y: number; players: HubPlayer[] }
  | { t: 'hub_joined'; p: HubPlayer }
  | { t: 'hub_left'; id: string }
  | { t: 'hub_snap'; players: HubSnap[] }
  | { t: 'hub_fix'; x: number; y: number }
  | { t: 'hub_emote'; id: string; emote: Emote }
  | { t: 'party'; party: PartyView | null }
  | { t: 'parties'; list: PartyListing[] }
  | { t: 'party_err'; r: PartyResult }
  | { t: 'depart'; trail: string; room: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
const TITLE_RE = /^[a-z0-9_]{1,24}$/;

/** Parses one hub message from a client. Anything malformed becomes null and is dropped. */
export function parseHubMsg(raw: unknown): HubClientMsg | null {
  let m: unknown = raw;
  if (typeof raw === 'string') { if (raw.length > 4000) return null; try { m = JSON.parse(raw); } catch { return null; } }
  if (!isObj(m)) return null;
  switch (m.t) {
    case 'hub_join': {
      const token = typeof m.token === 'string' && m.token.length < 3000 ? m.token : null;
      const title = typeof m.title === 'string' && TITLE_RE.test(m.title) ? m.title : 'newbie';
      return { t: 'hub_join', token, name: cleanName(m.name), title, look: cleanLook(m.look) };
    }
    case 'pos': {
      const x = Number(m.x), y = Number(m.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { t: 'pos', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, dir: DIRS.includes(m.dir as Dir) ? (m.dir as Dir) : 'down', moving: m.moving === true };
    }
    case 'hub_emote': return (EMOTES as readonly string[]).includes(m.emote as string) ? { t: 'hub_emote', emote: m.emote as Emote } : null;
    case 'party_new': return typeof m.trail === 'string' && validTrail(m.trail) ? { t: 'party_new', trail: m.trail } : null;
    case 'party_join': { const code = cleanRoomCode(m.code); return code ? { t: 'party_join', code } : null; }
    case 'party_leave': return { t: 'party_leave' };
    case 'party_trail': return typeof m.trail === 'string' && validTrail(m.trail) ? { t: 'party_trail', trail: m.trail } : null;
    case 'party_ready': return { t: 'party_ready', ready: m.ready === true };
    case 'party_go': return { t: 'party_go' };
  }
  return null;
}

/** What one member sees of their party. */
export function partyView(p: Party, nameOf: (id: string) => string): PartyView {
  return { code: p.code, leader: p.leader, trail: p.trail, members: p.members.map((id) => ({ id, name: nameOf(id), ready: p.ready.includes(id) })) };
}

/** Open parties for the hub's party board (not full), newest first. */
export function partyListings(b: PartyBook, nameOf: (id: string) => string): PartyListing[] {
  return [...b.parties.values()].filter((p) => p.members.length < PARTY_MAX).reverse()
    .map((p) => ({ code: p.code, leaderName: nameOf(p.leader), trail: p.trail, size: p.members.length }));
}
