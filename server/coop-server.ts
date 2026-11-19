/**
 * THAILAND WILD TRAILS co-op game server.
 *
 *   npm run coop            # ws://localhost:2567, reads .env
 *
 * Server authority: every hiker is moved here with the game's own moveHiker() (src/core), from
 * inputs only. Clients cannot teleport, walk through rocks or water, run faster than the game allows,
 * or send more movement than real time permits. Players are signed in with their Supabase session;
 * set COOP_ALLOW_GUESTS=1 to allow joining without one (local testing).
 *
 * Env: COOP_PORT (2567), COOP_ALLOW_GUESTS, COOP_ORIGINS (comma list; empty = any),
 *      VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (to check sign-in tokens).
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  COOP_MAX_PLAYERS, COOP_SNAPSHOT_HZ, COOP_STEP, coopHiker, parseClientMsg, roomKey, snapOf, stepBudget, stepHiker,
  type CoopInput, type CoopLook, type ServerMsg,
} from '../src/core/coop';
import type { Hiker } from '../src/core/hiker';
import { buildWorld, type WorldMap } from '../src/core/world';
import { trailById, type WeatherId } from '../src/data/trails';

const PORT = Number(process.env.COOP_PORT || process.env.PORT || 2567);
const ALLOW_GUESTS = process.env.COOP_ALLOW_GUESTS === '1';
const ORIGINS = (process.env.COOP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SB_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const MAX_MSGS_PER_SEC = 60, MAX_QUEUE = 20, JOIN_TIMEOUT_MS = 10_000;

interface Player {
  id: string; ws: WebSocket; name: string; look: CoopLook; userId: string | null;
  hiker: Hiker; queue: { seq: number; inp: CoopInput }[]; ack: number; budget: number; lastAt: number;
  msgs: number; msgWindow: number;
}
interface Room { key: string; trailId: string; world: WorldMap; weather: WeatherId; startedAt: number; players: Map<string, Player> }

const rooms = new Map<string, Room>();
const worlds = new Map<string, WorldMap>();
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

function worldFor(trailId: string): WorldMap {
  let w = worlds.get(trailId);
  if (!w) { w = buildWorld(trailById(trailId)!); worlds.set(trailId, w); }
  return w;
}

function pickWeather(trailId: string): WeatherId {
  const ch = trailById(trailId)!.weatherChances ?? { clear: 0.6, fog: 0.25, drizzle: 0.15 };
  let r = Math.random();
  for (const [w, p] of Object.entries(ch) as [WeatherId, number][]) { if ((r -= p) <= 0) return w; }
  return 'clear';
}

const send = (ws: WebSocket, m: ServerMsg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); };
const broadcast = (room: Room, m: ServerMsg, except?: string) => { for (const p of room.players.values()) if (p.id !== except) send(p.ws, m); };

/** Checks a Supabase access token by asking Supabase who it belongs to. */
const tokenCache = new Map<string, { uid: string | null; until: number }>();
async function userFromToken(token: string | null): Promise<string | null> {
  if (!token || !SB_URL || !SB_KEY) return null;
  const hit = tokenCache.get(token);
  if (hit && hit.until > Date.now()) return hit.uid;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
    const uid = r.ok ? ((await r.json()) as { id?: string }).id ?? null : null;
    tokenCache.set(token, { uid, until: Date.now() + 5 * 60_000 });
    if (tokenCache.size > 5000) tokenCache.clear();
    return uid;
  } catch { return null; }
}

function leave(room: Room, p: Player): void {
  if (!room.players.delete(p.id)) return;
  broadcast(room, { t: 'left', id: p.id });
  log(`leave ${room.key} ${p.name} (${room.players.size} left)`);
  if (!room.players.size) rooms.delete(room.key);
}

const http = createServer((_req, res) => {
  // health check for hosting platforms
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`thailand-wild-trails co-op · rooms ${rooms.size}\n`);
});

const wss = new WebSocketServer({
  server: http, maxPayload: 8 * 1024,
  verifyClient: (info: { origin: string }) => !ORIGINS.length || ORIGINS.includes(info.origin),
});

wss.on('connection', (ws) => {
  let room: Room | null = null, me: Player | null = null, joining = false;
  const kick = setTimeout(() => { if (!me) ws.close(4000, 'join timeout'); }, JOIN_TIMEOUT_MS);
  (ws as WebSocket & { alive?: boolean }).alive = true;
  ws.on('pong', () => { (ws as WebSocket & { alive?: boolean }).alive = true; });

  ws.on('message', async (data) => {
    // flood guard
    const now = Date.now();
    if (me) {
      if (now - me.msgWindow > 1000) { me.msgWindow = now; me.msgs = 0; }
      if (++me.msgs > MAX_MSGS_PER_SEC) return;
    }
    const m = parseClientMsg(data.toString());
    if (!m) return;

    if (m.t === 'join') {
      if (me || joining) return;
      joining = true;
      const userId = await userFromToken(m.token);
      if (!userId && !ALLOW_GUESTS) { send(ws, { t: 'error', code: 'auth' }); ws.close(4001, 'auth'); return; }
      const key = roomKey(m.trail, m.room);
      let r = rooms.get(key);
      if (!r) { r = { key, trailId: m.trail, world: worldFor(m.trail), weather: pickWeather(m.trail), startedAt: Date.now(), players: new Map() }; rooms.set(key, r); }
      if (r.players.size >= COOP_MAX_PLAYERS) { send(ws, { t: 'error', code: 'full' }); ws.close(4002, 'full'); return; }
      // the same account joining twice replaces the old connection
      if (userId) for (const p of r.players.values()) if (p.userId === userId) { p.ws.close(4003, 'replaced'); leave(r, p); }
      const id = randomUUID().slice(0, 8);
      me = { id, ws, name: m.name, look: m.look, userId, hiker: coopHiker(r.world), queue: [], ack: -1, budget: 2, lastAt: now, msgs: 0, msgWindow: now };
      room = r;
      send(ws, { t: 'welcome', id, weather: r.weather, startedAt: r.startedAt, players: [...r.players.values()].map((p) => ({ id: p.id, name: p.name, look: p.look })) });
      r.players.set(id, me);
      broadcast(r, { t: 'joined', id, name: me.name, look: me.look }, id);
      clearTimeout(kick);
      log(`join ${key} ${me.name}${userId ? '' : ' (guest)'} (${r.players.size}/${COOP_MAX_PLAYERS})`);
      return;
    }
    if (!me || !room) return;
    if (m.t === 'input') {
      if (m.seq <= me.ack || me.queue.length >= MAX_QUEUE) return; // replays and floods are dropped
      if (me.queue.length && m.seq <= me.queue[me.queue.length - 1].seq) return;
      me.queue.push({ seq: m.seq, inp: m.inp });
    } else if (m.t === 'chat') broadcast(room, { t: 'emote', id: me.id, emote: m.emote });
  });

  ws.on('close', () => { clearTimeout(kick); if (room && me) leave(room, me); });
  ws.on('error', () => ws.close());
});

// simulation: run each player's queued inputs, limited by real time
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) for (const p of r.players.values()) {
    const b = stepBudget(p.budget, (now - p.lastAt) / 1000, p.queue.length);
    p.lastAt = now; p.budget = b.budget;
    for (const { seq, inp } of p.queue.splice(0, b.run)) { stepHiker(p.hiker, r.world, inp, r.weather); p.ack = seq; }
  }
}, COOP_STEP * 1000);

// snapshots
setInterval(() => {
  for (const r of rooms.values()) broadcast(r, { t: 'snap', players: [...r.players.values()].map((p) => snapOf(p.id, p.hiker, p.ack)) });
}, 1000 / COOP_SNAPSHOT_HZ);

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients as Set<WebSocket & { alive?: boolean }>) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 15_000);

http.listen(PORT, () => log(`co-op server on ws://localhost:${PORT}${ALLOW_GUESTS ? ' (guests allowed)' : ''}${SB_URL ? '' : ' (no Supabase: only guests can join)'}`));
