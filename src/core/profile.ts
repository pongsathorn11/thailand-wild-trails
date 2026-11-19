/**
 * PlayerProfile (thailand-wild-trails/knowledge/data-schema.md, schemaVersion 1).
 * Uses the same localStorage key and migration as the prototype, so a prototype save loads here
 * when both run on the same origin. Fields this port does not use yet are kept untouched.
 */
import { BODY_PRESETS, type Body, type LookIndices, type LookRow } from '../data/looks';
import type { Lang } from '../i18n';
import { defaultPack } from '../data/items';
import { CAMP } from '../data/camp';

export interface Profile {
  schemaVersion: 1;
  lang: Lang;
  body: Body;
  name: string;
  looks: Record<Body, LookIndices>;
  exp: number;
  coins: number;
  day: number;
  lastTrail?: string;
  /** what the packing screen last chose */
  pack: Record<string, number>;
  /** camp storage: seeds, produce, cooked food, furniture */
  storage: Record<string, number>;
  [extra: string]: unknown;
}

const KEY = 'twt_save_v1';
const ROWS: LookRow[] = ['hairStyle', 'hair', 'skin', 'face', 'outfit', 'acc'];

export function migrateProfile(raw: Record<string, any> | null): Profile {
  const pr: Record<string, any> = raw ? { ...raw } : {};
  if (!pr.schemaVersion) {
    pr.exp = pr.totalExp || 0;
    pr.stats = { trailsCompleted: pr.completions || 0, totalDistanceKm: 0, litterCollected: 0, photosTaken: 0 };
    pr.album = (pr.album || []).map((a: unknown) => (typeof a === 'string' ? { subjectId: a, trailId: 'doi-inthanon-kew-mae-pan', date: null } : a));
    delete pr.totalExp; delete pr.completions;
    pr.schemaVersion = 1;
  }
  if (pr.look && !pr.looks) {
    const o = pr.look, shirtToOutfit = [1, 2, 4, 0, 2], hatToAcc = [0, 2, 1];
    pr.looks = {
      male: { hairStyle: 0, hair: Math.min(o.hair || 0, 5), skin: o.skin || 0, face: 0, outfit: shirtToOutfit[o.shirt] ?? 0, acc: hatToAcc[o.hat] ?? 0 },
      female: { ...BODY_PRESETS.female },
    };
    delete pr.look;
  }
  const defaults: Partial<Profile> = {
    lang: 'th', body: 'male', name: '', exp: 0, coins: 30, day: 1,
    looks: { male: { ...BODY_PRESETS.male }, female: { ...BODY_PRESETS.female } },
    pack: defaultPack(), storage: { seed_kaprao: 4, seed_strawberry: 2, flower_pot: 1 },
  };
  if (pr.camp === undefined) pr.camp = { placed: [], plots: CAMP.plots.map(([x, y]) => ({ x, y, cropId: null, grown: 0, watered: false })) };
  if (pr.quests === undefined) pr.quests = { day: 0, list: [] };
  for (const k in defaults) if (pr[k] === undefined) pr[k] = (defaults as any)[k];
  for (const b of ['male', 'female'] as Body[]) for (const k of ROWS) if (pr.looks[b][k] === undefined) pr.looks[b][k] = BODY_PRESETS[b][k];
  return pr as Profile;
}

export function loadProfile(): Profile {
  try { return migrateProfile(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return migrateProfile(null); }
}

/** Called after every local save (the cloud sync listens here). */
export const saveListeners: ((p: Profile) => void)[] = [];

export function saveProfile(p: Profile): void {
  p.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: play continues without saving */ }
  for (const fn of saveListeners) { try { fn(p); } catch { /* a listener must never break saving */ } }
}
