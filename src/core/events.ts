/** Random trail events, every 40–70 s. Pure selection logic; the scene applies the effects. */
import type { WeatherId } from '../data/trails';
import { CONFIG } from './config';

export interface EventCtx { weather: WeatherId; zone: string; hasPhoto: (id: string) => boolean; active: string[] }
export interface EventDef {
  id: 'slippery' | 'coldWind' | 'fogRoll' | 'wildlife' | 'lostItem';
  weight: (c: EventCtx) => number;
  duration: number;
  speedMult?: number; tempC?: number; fog?: number;
  spawn?: { kind: 'animal'; subject: string } | { kind: 'item'; itemId: string };
}

export const EVENTS: EventDef[] = [
  { id: 'slippery', weight: (c) => (c.weather === 'drizzle' ? 4 : 1.5), duration: 20, speedMult: 0.8 },
  { id: 'coldWind', weight: (c) => (c.zone === 'ridge' || c.zone === 'plateau' ? 3 : 0), duration: 25, tempC: -6 },
  { id: 'fogRoll', weight: (c) => (c.weather === 'drizzle' ? 0 : 2), duration: 30, fog: 0.25 },
  { id: 'wildlife', weight: (c) => (c.hasPhoto('muntjac') ? 0 : 2.5), duration: 30, spawn: { kind: 'animal', subject: 'muntjac' } },
  { id: 'lostItem', weight: () => 2, duration: 0, spawn: { kind: 'item', itemId: 'trail_mix' } },
];
export const EVENT_GAP: [number, number] = [40, 70];

export function pickEvent(c: EventCtx, rnd: number): EventDef | null {
  const pool = EVENTS.filter((e) => !c.active.includes(e.id)).map((e) => ({ e, w: e.weight(c) })).filter((o) => o.w > 0);
  if (!pool.length) return null;
  let r = rnd * pool.reduce((s, o) => s + o.w, 0);
  for (const o of pool) { r -= o.w; if (r <= 0) return o.e; }
  return pool[pool.length - 1].e;
}

/** A path tile 4–8 tiles from the hiker, so a spawn appears up ahead. */
export function spotAhead(pathTiles: [number, number][], px: number, py: number, rnd: number): [number, number] | null {
  const TS = CONFIG.TILE;
  const c = pathTiles.filter(([x, y]) => { const d = Math.hypot(x * TS + 8 - px, y * TS + 8 - py); return d > 64 && d < 130; });
  if (!c.length) return null;
  const [x, y] = c[Math.floor(rnd * c.length)];
  return [x * TS + 8, y * TS + 10];
}
