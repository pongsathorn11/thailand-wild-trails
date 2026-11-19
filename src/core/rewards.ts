/** Trail completion: EXP, coins, stats, album and passport stamp (same formulas as the prototype). */
import { PHOTO_EXP } from '../data/photos';
import type { TrailDef } from '../data/trails';
import type { Profile } from './profile';

export interface HikeResult { timeSec: number; km: number; photos: string[]; litter: number; secretFound: boolean }
export interface Summary { exp: number; coins: number; time: string; km: string; photos: number; litter: number; secret: boolean; date: string }

/** photoBonus: the Photography skill (+20% photo EXP per rank). */
export const hikeExp = (r: HikeResult, photoBonus = 0): number => 50 + r.litter * 10 + r.photos.reduce((s, p) => s + Math.round((PHOTO_EXP[p] ?? 0) * (1 + photoBonus)), 0);
export const hikeCoins = (r: HikeResult): number => 20 + r.litter * 3 + r.photos.length * 2;

export function applyFinish(p: Profile, trail: TrailDef, r: HikeResult, today = new Date().toISOString().slice(0, 10), photoBonus = 0): Summary {
  const exp = hikeExp(r, photoBonus), coins = hikeCoins(r);
  const pr = p as Record<string, any>;
  pr.exp = (pr.exp || 0) + exp;
  pr.coins = (pr.coins || 0) + coins;
  const st = (pr.stats ??= { trailsCompleted: 0, totalDistanceKm: 0, litterCollected: 0, photosTaken: 0 });
  st.trailsCompleted += 1; st.totalDistanceKm += r.km; st.litterCollected += r.litter; st.photosTaken += r.photos.length;
  const album: { subjectId: string; trailId: string; date: string | null }[] = (pr.album ??= []);
  for (const ph of r.photos) if (!album.some((a) => a.subjectId === ph)) album.push({ subjectId: ph, trailId: trail.id, date: today });
  const passport = (pr.passport ??= {});
  const pp = (passport[trail.parkId] ??= { stamped: true, firstDate: today, trails: {} });
  if (!pp.firstDate) pp.firstDate = today;
  const tr = (pp.trails[trail.id] ??= { completions: 0, bestTimeSec: null });
  tr.completions++;
  if (tr.bestTimeSec === null || r.timeSec < tr.bestTimeSec) tr.bestTimeSec = r.timeSec;
  pr.lastTrail = trail.id;
  const s = Math.floor(r.timeSec);
  return { exp, coins, time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, km: r.km.toFixed(1), photos: r.photos.length, litter: r.litter, secret: r.secretFound, date: today };
}
