/**
 * Social Hub on the game server: plazas of up to HUB_CAPACITY hikers and the parties formed in them.
 * Uses the shared rules in src/core/hub.ts; the WebSocket server (coop-server.ts) routes hub messages here.
 */
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  HUB_CAPACITY, HUB_SNAPSHOT_HZ, createParty, departParty, hubSolid, hubSpawn, joinParty, leaveParty, legalHubMove,
  newPartyBook, partyListings, partyOf, partyView, setPartyTrail, setReady,
  type HubClientMsg, type HubPlayer, type HubServerMsg, type Party,
} from '../src/core/hub';
import type { Dir } from '../src/core/hiker';

interface Member extends HubPlayer { ws: WebSocket; userId: string | null; dir: Dir; moving: boolean; lastAt: number }
interface Plaza { n: number; members: Map<string, Member> }

const SOLID = hubSolid();
const plazas: Plaza[] = [];
const book = newPartyBook();
/** Every hub member by id, across plazas (parties can span plazas only by code). */
const everyone = new Map<string, Member>();

const send = (ws: WebSocket, m: HubServerMsg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); };
const toPlaza = (pl: Plaza, m: HubServerMsg, except?: string) => { for (const p of pl.members.values()) if (p.id !== except) send(p.ws, m); };
const nameOf = (id: string) => everyone.get(id)?.name ?? '?';
const plazaOf = (id: string) => plazas.find((pl) => pl.members.has(id));

function pushParty(party: Party | null, ids: string[]): void {
  for (const id of ids) { const m = everyone.get(id); if (m) send(m.ws, { t: 'party', party: party ? partyView(party, nameOf) : null }); }
}
/** Everyone in the hub sees the same party board. */
function pushBoard(): void {
  const list = partyListings(book, nameOf);
  for (const m of everyone.values()) send(m.ws, { t: 'parties', list });
}

export const hubStats = () => ({ plazas: plazas.length, hikers: everyone.size, parties: book.parties.size });

export function hubJoin(ws: WebSocket, m: Extract<HubClientMsg, { t: 'hub_join' }>, userId: string | null): string {
  // the same account joining twice replaces the old connection
  if (userId) for (const o of everyone.values()) if (o.userId === userId) { o.ws.close(4003, 'replaced'); hubLeave(o.id); }
  let pl = plazas.find((q) => q.members.size < HUB_CAPACITY);
  if (!pl) { pl = { n: plazas.length + 1, members: new Map() }; plazas.push(pl); }
  const id = randomUUID().slice(0, 8), at = hubSpawn(pl.members.size);
  const me: Member = { id, ws, userId, name: m.name, title: m.title, look: m.look, camp: m.camp, x: at.x, y: at.y, dir: 'up', moving: false, lastAt: Date.now() };
  send(ws, { t: 'hub_welcome', id, x: at.x, y: at.y, players: [...pl.members.values()].map(({ id, name, title, look, x, y, camp }) => ({ id, name, title, look, x, y, camp })) });
  pl.members.set(id, me); everyone.set(id, me);
  toPlaza(pl, { t: 'hub_joined', p: { id, name: me.name, title: me.title, look: me.look, x: me.x, y: me.y, camp: me.camp } }, id);
  send(ws, { t: 'parties', list: partyListings(book, nameOf) });
  return id;
}

export function hubLeave(id: string): void {
  const pl = plazaOf(id);
  if (!pl) return;
  const left = leaveParty(book, id);
  pl.members.delete(id); everyone.delete(id);
  toPlaza(pl, { t: 'hub_left', id });
  if (left) { pushParty(left.members.length ? left : null, left.members); pushBoard(); }
  if (!pl.members.size) plazas.splice(plazas.indexOf(pl), 1);
}

export function hubMessage(id: string, m: HubClientMsg): void {
  const me = everyone.get(id), pl = plazaOf(id);
  if (!me || !pl) return;
  const err = (r: string) => send(me.ws, { t: 'party_err', r: r as never });
  switch (m.t) {
    case 'pos': {
      const now = Date.now();
      if (legalHubMove(SOLID, me, m, (now - me.lastAt) / 1000)) { me.x = m.x; me.y = m.y; me.dir = m.dir; me.moving = m.moving; }
      else send(me.ws, { t: 'hub_fix', x: me.x, y: me.y });
      me.lastAt = now;
      return;
    }
    case 'hub_emote': toPlaza(pl, { t: 'hub_emote', id, emote: m.emote }); return;
    case 'party_new': {
      const r = createParty(book, id, m.trail);
      if (r.r !== 'ok') return err(r.r);
      pushParty(r.party!, [id]); pushBoard(); return;
    }
    case 'party_join': {
      const r = joinParty(book, id, m.code);
      if (r !== 'ok') return err(r);
      const party = partyOf(book, id)!;
      pushParty(party, party.members); pushBoard(); return;
    }
    case 'party_leave': {
      const left = leaveParty(book, id);
      if (!left) return;
      pushParty(null, [id]);
      if (left.members.length) pushParty(left, left.members);
      pushBoard(); return;
    }
    case 'party_trail': {
      const r = setPartyTrail(book, id, m.trail);
      if (r !== 'ok') return err(r);
      const party = partyOf(book, id)!;
      pushParty(party, party.members); pushBoard(); return;
    }
    case 'party_ready': {
      const r = setReady(book, id, m.ready);
      if (r !== 'ok') return err(r);
      const party = partyOf(book, id)!;
      pushParty(party, party.members); return;
    }
    case 'party_go': {
      const r = departParty(book, id);
      if (r.r !== 'ok') return err(r.r);
      const { code, trail, members } = r.party!;
      for (const mid of members) { const mm = everyone.get(mid); if (mm) { send(mm.ws, { t: 'party', party: null }); send(mm.ws, { t: 'depart', trail, room: code }); } }
      pushBoard(); return;
    }
  }
}

// positions of everyone in each plaza
setInterval(() => {
  for (const pl of plazas) toPlaza(pl, { t: 'hub_snap', players: [...pl.members.values()].map((p) => ({ id: p.id, x: p.x, y: p.y, dir: p.dir, moving: p.moving })) });
}, 1000 / HUB_SNAPSHOT_HZ);
