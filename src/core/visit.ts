/**
 * Visiting a friend's camp: the rules both sides use. No network code here.
 *
 * - Each signed-in player publishes a small "camp card" (name, look, title, level, furniture, garden).
 *   Friends open it with the 6-character camp code, also when the owner is offline.
 * - A visitor leaves one sticker in the guestbook per real day and may water the garden.
 *   The owner's game picks the visits up next time they are in camp.
 * - A card is untrusted data from another player: cleanCampCard() keeps only what the game can draw.
 */
import { CAMP, CROPS, FURNITURE } from '../data/camp';
import { LOOK_OPTIONS, type Body, type LookIndices, type LookRow } from '../data/looks';
import { cleanName } from './coop';
import { levelInfo, type CampState, type Plot } from './camp';
import type { Profile } from './profile';

export const CAMP_CODE_LEN = 6;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I (same as room codes)
export const GUESTBOOK_MAX = 30;

/** Guestbook stickers: fixed phrases (no free text, so nothing to moderate). */
export const STICKERS = ['nice_camp', 'hike_together', 'thanks', 'cozy', 'garden', 'wow', 'see_you', 'coffee'] as const;
export type Sticker = (typeof STICKERS)[number];
export const STICKER_ICON: Record<Sticker, string> = {
  nice_camp: '🏕️', hike_together: '🥾', thanks: '🙏', cozy: '🔥', garden: '🌱', wow: '✨', see_you: '👋', coffee: '☕',
};

export interface CampCard {
  name: string; title: string; level: number; body: Body; looks: LookIndices;
  placed: { itemId: string; x: number; y: number }[];
  plots: { cropId: string | null; grown: number; watered: boolean }[];
}
export interface Visit { name: string; sticker: Sticker; watered: boolean; at: string }
export interface GuestbookEntry { name: string; sticker: Sticker; watered: boolean; at: string }

const LOOK_ROWS: LookRow[] = ['hairStyle', 'hair', 'skin', 'face', 'outfit', 'acc'];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number, d: number): number => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };

export function cleanCampCode(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const c = s.trim().toUpperCase().replace(/[\s-]/g, '');
  return c.length === CAMP_CODE_LEN && [...c].every((ch) => CODE_ALPHABET.includes(ch)) ? c : null;
}

/** The card this player shows to visitors (built from their save). */
export function campCard(p: Profile): CampCard {
  const camp = (p as Profile & { camp?: CampState }).camp;
  return {
    name: cleanName(p.name, 'Hiker'),
    title: String((p as Profile & { title?: string }).title ?? 'newbie'),
    level: levelInfo(p.exp ?? 0).level,
    body: p.body, looks: { ...p.looks[p.body] },
    placed: (camp?.placed ?? []).map(({ itemId, x, y }) => ({ itemId, x, y })),
    plots: (camp?.plots ?? []).map(({ cropId, grown, watered }) => ({ cropId, grown, watered })),
  };
}

/** Keeps only what can be drawn safely: known furniture inside the camp, known crops, valid looks. */
export function cleanCampCard(v: unknown): CampCard | null {
  if (!isObj(v)) return null;
  const body: Body = v.body === 'female' ? 'female' : 'male';
  const src = isObj(v.looks) ? v.looks : {}, looks = {} as LookIndices;
  for (const k of LOOK_ROWS) looks[k] = int(src[k], 0, LOOK_OPTIONS[k].length - 1, 0);
  const placed = (Array.isArray(v.placed) ? v.placed : []).slice(0, 60).filter(isObj)
    .map((o) => ({ itemId: String(o.itemId), x: int(o.x, 1, CAMP.W - 2, -1), y: int(o.y, 1, CAMP.H - 2, -1) }))
    .filter((o) => FURNITURE.includes(o.itemId) && o.x >= 0 && o.y >= 0);
  const rawPlots = Array.isArray(v.plots) ? v.plots : [];
  const plots = CAMP.plots.map((_, i) => {
    const o = isObj(rawPlots[i]) ? rawPlots[i] as Record<string, unknown> : {};
    const cropId = typeof o.cropId === 'string' && CROPS[o.cropId] ? o.cropId : null;
    return { cropId, grown: cropId ? int(o.grown, 0, CROPS[cropId].days, 0) : 0, watered: cropId ? o.watered === true : false };
  });
  const title = typeof v.title === 'string' && /^[a-z0-9_]{1,24}$/.test(v.title) ? v.title : 'newbie';
  return { name: cleanName(v.name, 'Hiker'), title, level: int(v.level, 1, 999, 1), body, looks, placed, plots };
}

/** Plots a visitor's watering would help: planted, still growing, not watered yet. */
export const thirstyPlots = (plots: CampCard['plots']): number[] =>
  plots.map((pl, i) => (pl.cropId && !pl.watered && pl.grown < CROPS[pl.cropId].days ? i : -1)).filter((i) => i >= 0);

export const isSticker = (s: unknown): s is Sticker => (STICKERS as readonly string[]).includes(s as string);

/**
 * The owner picks up visits: friends' watering waters thirsty plots, every visit goes in the guestbook (newest first).
 * Returns how many plots got watered.
 */
export function applyVisits(p: Profile, visits: Visit[]): { watered: number } {
  const pp = p as Profile & { camp?: CampState; guestbook?: GuestbookEntry[] };
  let watered = 0;
  const book = Array.isArray(pp.guestbook) ? pp.guestbook : [];
  for (const v of [...visits].sort((a, b) => a.at.localeCompare(b.at))) {
    if (!isSticker(v.sticker)) continue;
    if (v.watered && pp.camp) for (const pl of pp.camp.plots as Plot[]) {
      if (pl.cropId && !pl.watered && pl.grown < CROPS[pl.cropId].days) { pl.watered = true; watered++; }
    }
    book.unshift({ name: cleanName(v.name, 'Hiker'), sticker: v.sticker, watered: !!v.watered, at: String(v.at) });
  }
  pp.guestbook = book.slice(0, GUESTBOOK_MAX);
  return { watered };
}

export const guestbook = (p: Profile): GuestbookEntry[] => ((p as Profile & { guestbook?: GuestbookEntry[] }).guestbook ?? []);
