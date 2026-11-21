/**
 * Social Hub client: one WebSocket to the game server while the player is in the plaza.
 * Reports our own position (the server checks it), draws everyone else smoothed between snapshots,
 * and keeps the party and the party board in sync.
 */
import { HUB_SEND_MS, type HubClientMsg, type HubServerMsg, type PartyListing, type PartyResult, type PartyView } from '../core/hub';
import type { CoopLook, Emote } from '../core/coop';
import type { Dir } from '../core/hiker';
import { COOP_URL } from './coop';

export interface HubOther { id: string; name: string; title: string; look: CoopLook; camp: string | null; x: number; y: number; tx: number; ty: number; dir: Dir; moving: boolean; emote: Emote | null; emoteT: number; frame?: number }

export type HubEvent =
  | { kind: 'joined' | 'left'; o: HubOther }
  | { kind: 'fix'; x: number; y: number }
  | { kind: 'emote'; o: HubOther | null; emote: Emote }
  | { kind: 'party' | 'board' }
  | { kind: 'partyErr'; r: PartyResult }
  | { kind: 'depart'; trail: string; room: string }
  | { kind: 'closed' };

export class HubSession {
  id = '';
  others = new Map<string, HubOther>();
  party: PartyView | null = null;
  board: PartyListing[] = [];
  status: 'connecting' | 'live' | 'closed' = 'connecting';
  onEvent: (e: HubEvent) => void = () => {};
  private ws: WebSocket | null = null;
  private sentAt = 0;
  private last = '';

  /** Connects and enters the plaza; resolves with our spawn point once the server has welcomed us. */
  static join(token: string | null, name: string, title: string, look: CoopLook, camp: string | null): Promise<{ hub: HubSession; x: number; y: number }> {
    const s = new HubSession();
    return new Promise((resolve, reject) => {
      if (!COOP_URL) { reject(new Error('no server')); return; }
      const ws = s.ws = new WebSocket(COOP_URL);
      const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);
      ws.onopen = () => s.send({ t: 'hub_join', token, name, title, look, camp });
      ws.onerror = () => { clearTimeout(timer); reject(new Error('connect')); };
      ws.onclose = () => { const was = s.status; s.status = 'closed'; if (was === 'live') s.onEvent({ kind: 'closed' }); };
      ws.onmessage = (ev) => {
        let m: HubServerMsg | { t: 'error'; code: string };
        try { m = JSON.parse(String(ev.data)); } catch { return; }
        if (m.t === 'error') { clearTimeout(timer); reject(new Error(m.code)); ws.close(); return; }
        if (m.t === 'hub_welcome') {
          clearTimeout(timer);
          s.id = m.id; s.status = 'live';
          for (const p of m.players) s.others.set(p.id, s.blank(p));
          resolve({ hub: s, x: m.x, y: m.y });
          return;
        }
        s.handle(m);
      };
    });
  }

  private blank(p: { id: string; name: string; title: string; look: CoopLook; x: number; y: number; camp?: string | null }): HubOther {
    return { ...p, camp: p.camp ?? null, tx: p.x, ty: p.y, dir: 'down', moving: false, emote: null, emoteT: 0 };
  }

  private handle(m: HubServerMsg): void {
    switch (m.t) {
      case 'hub_joined': { const o = this.blank(m.p); this.others.set(o.id, o); this.onEvent({ kind: 'joined', o }); break; }
      case 'hub_left': { const o = this.others.get(m.id); if (o) { this.others.delete(m.id); this.onEvent({ kind: 'left', o }); } break; }
      case 'hub_snap':
        for (const p of m.players) { const o = this.others.get(p.id); if (o) Object.assign(o, { tx: p.x, ty: p.y, dir: p.dir, moving: p.moving }); }
        break;
      case 'hub_fix': this.onEvent({ kind: 'fix', x: m.x, y: m.y }); break;
      case 'hub_emote': {
        const o = this.others.get(m.id) ?? null;
        if (o) { o.emote = m.emote; o.emoteT = 3; }
        this.onEvent({ kind: 'emote', o, emote: m.emote });
        break;
      }
      case 'party': this.party = m.party; this.onEvent({ kind: 'party' }); break;
      case 'parties': this.board = m.list; this.onEvent({ kind: 'board' }); break;
      case 'party_err': this.onEvent({ kind: 'partyErr', r: m.r }); break;
      case 'depart': this.onEvent({ kind: 'depart', trail: m.trail, room: m.room }); break;
    }
  }

  send(m: HubClientMsg): void { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  /** Reports our position at most every HUB_SEND_MS, and only when something changed. */
  update(dt: number, me: { x: number; y: number; dir: Dir; moving: boolean }): void {
    const now = performance.now();
    if (this.status === 'live' && now - this.sentAt >= HUB_SEND_MS) {
      const key = `${me.x.toFixed(1)},${me.y.toFixed(1)},${me.dir},${me.moving}`;
      if (key !== this.last) { this.last = key; this.sentAt = now; this.send({ t: 'pos', x: me.x, y: me.y, dir: me.dir, moving: me.moving }); }
    }
    const k = Math.min(1, dt * 10);
    for (const o of this.others.values()) {
      o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
      if (o.emoteT > 0 && (o.emoteT -= dt) <= 0) o.emote = null;
    }
  }

  /** Forget the last report so a server correction is followed by a fresh one. */
  resync(): void { this.last = ''; }

  leave(): void { this.status = 'closed'; try { this.ws?.close(); } catch { /* already closed */ } }
}
