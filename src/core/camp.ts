/**
 * Camp rules: level, daily quests, garden, cooking, shop, decorating, trail unlocks.
 * Everything mutates the profile and returns what happened, so scenes only show results.
 */
import { CAMP, CATALOG, CROPS, FURNITURE, QUEST_POOL, RECIPES, type QuestKind } from '../data/camp';
import { TRAILS, type TrailDef } from '../data/trails';
import type { Profile } from './profile';
import { seasonOf } from './season';

export interface Plot { x: number; y: number; cropId: string | null; grown: number; watered: boolean }
export interface CampState { placed: { itemId: string; x: number; y: number }[]; plots: Plot[] }
export interface QuestProgress { id: string; progress: number; done: boolean }

type P = Profile & { camp: CampState; quests: { day: number; list: QuestProgress[] }; passport?: Record<string, any> };
const asP = (p: Profile) => p as P;

export const newCamp = (): CampState => ({ placed: [], plots: CAMP.plots.map(([x, y]) => ({ x, y, cropId: null, grown: 0, watered: false })) });
export const storeQty = (p: Profile, id: string): number => p.storage[id] || 0;
export function addStore(p: Profile, id: string, n: number): void {
  p.storage[id] = Math.max(0, (p.storage[id] || 0) + n);
  if (!p.storage[id]) delete p.storage[id];
}

// ---------- level ----------
export const expNeed = (l: number): number => Math.round(100 * Math.pow(l, 1.5));
export function levelInfo(exp: number): { level: number; into: number; need: number } {
  let l = 1, rest = exp;
  while (rest >= expNeed(l)) { rest -= expNeed(l); l++; }
  return { level: l, into: rest, need: expNeed(l) };
}
/** Adds EXP; returns the new level if it went up. */
export function gainExp(p: Profile, n: number): number | null {
  const before = levelInfo(p.exp).level;
  p.exp += n;
  const after = levelInfo(p.exp).level;
  return after > before ? after : null;
}

// ---------- daily quests ----------
export function ensureQuests(p: Profile, rnd: () => number = Math.random): void {
  const pr = asP(p);
  if (pr.quests && pr.quests.day === p.day && pr.quests.list.length) return;
  const pool = QUEST_POOL.map((q) => ({ q, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, 3).map((o) => o.q);
  pr.quests = { day: p.day, list: pool.map((q) => ({ id: q.id, progress: 0, done: false })) };
}
export interface QuestDone { id: string; exp: number; coins: number; levelUp: number | null }
export function notifyQuest(p: Profile, kind: QuestKind, n = 1): QuestDone[] {
  const out: QuestDone[] = [];
  for (const q of asP(p).quests?.list ?? []) {
    const d = QUEST_POOL.find((x) => x.id === q.id);
    if (!d || q.done || d.kind !== kind) continue;
    q.progress = Math.min(d.count, q.progress + n);
    if (q.progress >= d.count) {
      q.done = true; p.coins += d.coins;
      out.push({ id: d.id, exp: d.exp, coins: d.coins, levelUp: gainExp(p, d.exp) });
    }
  }
  return out;
}

// ---------- garden ----------
export type PlotResult =
  | { msg: 'msg_noSeed' } | { msg: 'msg_season'; crop: string } | { msg: 'msg_planted'; crop: string }
  | { msg: 'msg_watered' } | { msg: 'msg_growing'; days: number } | { msg: 'msg_harvest'; crop: string; n: number };

export const seedsOwned = (p: Profile): string[] => Object.keys(CROPS).filter((k) => storeQty(p, CROPS[k].seed) > 0);
export function plotAction(p: Profile, plot: Plot, cropChoice: string | null, gardeningBonus = 0): PlotResult {
  if (!plot.cropId) {
    if (!cropChoice) return { msg: 'msg_noSeed' };
    const crop = CROPS[cropChoice];
    if (!crop.seasons.includes(seasonOf(p.day))) return { msg: 'msg_season', crop: crop.produce };
    addStore(p, crop.seed, -1);
    Object.assign(plot, { cropId: cropChoice, grown: 0, watered: false });
    return { msg: 'msg_planted', crop: crop.produce };
  }
  const crop = CROPS[plot.cropId];
  if (plot.grown >= crop.days) {
    const n = crop.yield + gardeningBonus;
    addStore(p, crop.produce, n);
    Object.assign(plot, { cropId: null, grown: 0, watered: false });
    (p as any).stats ??= {}; (p as any).stats.harvests = ((p as any).stats.harvests || 0) + 1;
    return { msg: 'msg_harvest', crop: crop.produce, n };
  }
  if (!plot.watered) { plot.watered = true; return { msg: 'msg_watered' }; }
  return { msg: 'msg_growing', days: crop.days - plot.grown };
}
/** Growth stage for drawing: 0 seed, 1 sprout, 2 plant, 3 ripe. */
export function plotStage(plot: Plot): number {
  if (!plot.cropId) return -1;
  const d = CROPS[plot.cropId].days;
  return plot.grown >= d ? 3 : plot.grown === 0 ? 0 : plot.grown < d / 2 ? 1 : 2;
}

/** Sleeping in the tent: watered crops grow a day, the day advances, new quests. */
export function sleep(p: Profile): { newSeason: boolean } {
  const pr = asP(p), before = seasonOf(p.day);
  for (const pl of pr.camp.plots) if (pl.cropId && pl.watered) pl.grown++;
  for (const pl of pr.camp.plots) pl.watered = false;
  p.day++;
  ensureQuests(p);
  return { newSeason: seasonOf(p.day) !== before };
}

// ---------- cooking and shop ----------
export const canCook = (p: Profile, recipeId: string): boolean => Object.entries(RECIPES.find((r) => r.id === recipeId)!.needs).every(([k, n]) => storeQty(p, k) >= n);
export function cook(p: Profile, recipeId: string): boolean {
  if (!canCook(p, recipeId)) return false;
  for (const [k, n] of Object.entries(RECIPES.find((r) => r.id === recipeId)!.needs)) addStore(p, k, -n);
  addStore(p, recipeId, 1);
  (p as any).stats ??= {}; (p as any).stats.cooked = ((p as any).stats.cooked || 0) + 1;
  return true;
}
export type BuyResult = 'ok' | 'locked' | 'coins';
export function buy(p: Profile, itemId: string): BuyResult {
  const e = CATALOG.find((c) => c.id === itemId)!;
  if (levelInfo(p.exp).level < e.level) return 'locked';
  if (p.coins < e.price) return 'coins';
  p.coins -= e.price; addStore(p, itemId, 1);
  return 'ok';
}

// ---------- decorating ----------
export const ownedFurniture = (p: Profile): string[] => FURNITURE.filter((id) => storeQty(p, id) > 0);
export const placedAt = (p: Profile, x: number, y: number) => asP(p).camp.placed.find((o) => o.x === x && o.y === y);
export const plotAt = (p: Profile, x: number, y: number) => asP(p).camp.plots.find((o) => o.x === x && o.y === y);

// ---------- trails ----------
export const trailDone = (p: Profile, id: string): boolean => Object.values(asP(p).passport ?? {}).some((pp: any) => pp.trails && pp.trails[id]);
export const trailUnlocked = (p: Profile, tr: TrailDef): boolean => !tr.unlock || (levelInfo(p.exp).level >= tr.unlock.level && trailDone(p, tr.unlock.trail));
export const lockedTrails = (p: Profile): string[] => TRAILS.filter((t) => !trailUnlocked(p, t)).map((t) => t.id);
