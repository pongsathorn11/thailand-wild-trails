/**
 * Co-op client: joins a room on the game server, predicts the local hiker with the same
 * stepHiker() the server runs, and corrects to the server position when they disagree.
 * Other hikers are drawn where the server says, smoothed between snapshots.
 */
import { COOP_STEP, stepHiker, type CoopInput, type CoopLook, type PlayerSnap, type ServerMsg } from '../core/coop';
import type { Hiker } from '../core/hiker';
import type { WorldMap } from '../core/world';
import type { WeatherId } from '../data/trails';

export const COOP_URL = (import.meta.env.VITE_COOP_URL as string | undefined) || '';

/** The room the player chose in the Online panel; the next hike joins it. */
export const coopPlan: { room: string | null } = { room: null };

export interface Other { id: string; name: string; look: CoopLook; x: number; y: number; tx: number; ty: number; dir: PlayerSnap['dir']; frame: number; moving: boolean; sitting: boolean; seen: boolean }

/** Runs one step on the local hiker without touching its body stats (those stay client-side). */
function stepKeepStats(h: Hiker, world: WorldMap, inp: CoopInput, weather: WeatherId): void {
  const stamina = h.stamina, exhausted = h.exhausted;
  stepHiker(h, world, inp, weather);
  h.stamina = stamina; h.exhausted = exhausted;
}

export class CoopSession {
  id = '';
  weather: WeatherId = 'clear';
  others = new Map<string, Other>();
  status: 'connecting' | 'live' | 'closed' = 'connecting';
  corrections = 0;
  /** Called when someone joins or leaves (for toasts and sprites). */
  onPeople: (kind: 'joined' | 'left', o: Other) => void = () => {};
  private ws: WebSocket | null = null;
  private seq = 0;
  private acc = 0;
  private pending: { seq: number; inp: CoopInput; x: number; y: number }[] = [];
  private lastSnap: PlayerSnap | null = null;

  /** Connects and joins; resolves once the server has welcomed us. */
  static join(trail: string, room: string, token: string | null, name: string, look: CoopLook): Promise<CoopSession> {
    const s = new CoopSession();
    return new Promise((resolve, reject) => {
      if (!COOP_URL) { reject(new Error('no server')); return; }
      const ws = s.ws = new WebSocket(COOP_URL);
      const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', trail, room, token, name, look }));
      ws.onerror = () => { clearTimeout(timer); reject(new Error('connect')); };
      ws.onclose = () => { s.status = 'closed'; };
      ws.onmessage = (ev) => {
        let m: ServerMsg;
        try { m = JSON.parse(String(ev.data)) as ServerMsg; } catch { return; }
        if (m.t === 'error') { clearTimeout(timer); reject(new Error(m.code)); ws.close(); return; }
        if (m.t === 'welcome') {
          clearTimeout(timer);
          s.id = m.id; s.weather = m.weather; s.status = 'live';
          for (const p of m.players) s.others.set(p.id, s.blank(p.id, p.name, p.look));
          resolve(s);
          return;
        }
        s.handle(m);
      };
    });
  }

  private blank(id: string, name: string, look: CoopLook): Other {
    return { id, name, look, x: 0, y: 0, tx: 0, ty: 0, dir: 'down', frame: 0, moving: false, sitting: false, seen: false };
  }

  private handle(m: ServerMsg): void {
    if (m.t === 'joined') { const o = this.blank(m.id, m.name, m.look); this.others.set(m.id, o); this.onPeople('joined', o); }
    else if (m.t === 'left') { const o = this.others.get(m.id); if (o) { this.others.delete(m.id); this.onPeople('left', o); } }
    else if (m.t === 'snap') {
      for (const p of m.players) {
        if (p.id === this.id) { this.lastSnap = p; continue; }
        const o = this.others.get(p.id);
        if (!o) continue;
        if (!o.seen) { o.x = p.x; o.y = p.y; o.seen = true; }
        Object.assign(o, { tx: p.x, ty: p.y, dir: p.dir, frame: p.frame, moving: p.moving, sitting: p.sitting });
      }
    }
  }

  /**
   * Advances the local hiker in fixed 50 ms steps (same as the server), sends each step's input,
   * and corrects to the server position. `make` builds the input for one step.
   */
  update(dt: number, h: Hiker, world: WorldMap, make: () => CoopInput): { stepped: boolean } {
    let stepped = false;
    if (this.status === 'live') {
      this.acc = Math.min(this.acc + dt, COOP_STEP * 5);
      while (this.acc >= COOP_STEP) {
        this.acc -= COOP_STEP;
        const inp = make(), f = h.frame, seq = ++this.seq;
        stepKeepStats(h, world, inp, this.weather);
        if (h.frame !== f && h.frame % 2 === 1) stepped = true;
        this.pending.push({ seq, inp, x: h.x, y: h.y });
        this.ws!.send(JSON.stringify({ t: 'input', seq, inp }));
      }
      this.reconcile(h, world);
    }
    // smooth other hikers toward their latest server position
    const k = Math.min(1, dt * 12);
    for (const o of this.others.values()) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; }
    return { stepped };
  }

  private reconcile(h: Hiker, world: WorldMap): void {
    const s = this.lastSnap;
    if (!s) return;
    this.lastSnap = null;
    const at = this.pending.find((p) => p.seq === s.ack);
    this.pending = this.pending.filter((p) => p.seq > s.ack);
    if (this.pending.length > 200) this.pending.splice(0, this.pending.length - 200);
    // compare against where we were after the step the server has just confirmed
    // (no match: the server has not run any of our pending steps yet, or all are confirmed)
    if (!at && this.pending.length) return;
    const drift = at ? Math.hypot(at.x - s.x, at.y - s.y) : Math.hypot(h.x - s.x, h.y - s.y);
    if (drift <= 1.5) return;
    // the server disagrees: start from its position and replay the inputs it has not seen yet
    this.corrections++;
    h.x = s.x; h.y = s.y;
    for (const p of this.pending) { stepKeepStats(h, world, p.inp, this.weather); p.x = h.x; p.y = h.y; }
  }

  leave(): void { this.status = 'closed'; try { this.ws?.close(); } catch { /* already closed */ } }
}
