import { describe, expect, it } from 'vitest';
import { pickEvent, spotAhead } from './events';
import { rareOk, seasonOf } from './season';
import { applyFinish, hikeExp } from './rewards';
import { migrateProfile } from './profile';
import { TRAILS } from '../data/trails';
import { PHOTO_EXP } from '../data/photos';
import { buildWorld } from './world';
import th from '../i18n/th.json';

const ctx = { weather: 'clear' as const, zone: 'forest', hasPhoto: () => false, active: [] as string[] };

describe('trail events', () => {
  it('never picks cold wind away from the ridge or plateau', () => {
    for (let i = 0; i < 200; i++) expect(pickEvent(ctx, i / 200)?.id).not.toBe('coldWind');
  });
  it('can pick cold wind on the ridge', () => {
    const ids = new Set(Array.from({ length: 200 }, (_, i) => pickEvent({ ...ctx, zone: 'ridge' }, i / 200)?.id));
    expect(ids.has('coldWind')).toBe(true);
  });
  it('does not repeat an event that is still active', () => {
    const all = ['slippery', 'coldWind', 'fogRoll', 'wildlife', 'lostItem'];
    expect(pickEvent({ ...ctx, active: all }, 0.5)).toBeNull();
  });
  it('spawns ahead on the path, 4–8 tiles away', () => {
    const m = buildWorld(TRAILS[0]);
    const [sx, sy] = m.trail.start, px = sx * 16 + 8, py = sy * 16 + 10;
    const spot = spotAhead(m.pathTiles, px, py, 0.5)!;
    const d = Math.hypot(spot[0] - px, spot[1] - py);
    expect(d).toBeGreaterThan(60); expect(d).toBeLessThan(140);
  });
});

describe('seasons and rare shots', () => {
  it('cycles cool → hot → rain every 7 days', () => {
    expect([1, 7, 8, 15, 22].map(seasonOf)).toEqual(['cool', 'cool', 'hot', 'rain', 'cool']);
  });
  it('sea of mist needs fog before 09:00', () => {
    const r = { subject: 'seaOfMist', weather: 'fog' as const, hourTo: 9 };
    expect(rareOk(r, 'fog', 7)).toBe(true);
    expect(rareOk(r, 'fog', 9.5)).toBe(false);
    expect(rareOk(r, 'clear', 7)).toBe(false);
  });
});

describe('finishing a trail', () => {
  it('pays 50 EXP + 10 per litter + photo EXP', () => {
    expect(hikeExp({ timeSec: 100, km: 3, photos: ['view', 'rhodo'], litter: 2, secretFound: false })).toBe(50 + 20 + 30);
  });
  it('stamps the passport, keeps the best time and adds new photos once', () => {
    const p = migrateProfile(null), tr = TRAILS[0];
    applyFinish(p, tr, { timeSec: 300, km: 3, photos: ['view'], litter: 1, secretFound: false }, '2026-11-19');
    applyFinish(p, tr, { timeSec: 200, km: 3, photos: ['view'], litter: 0, secretFound: false }, '2026-11-20');
    const pp = (p as any).passport[tr.parkId];
    expect(pp.firstDate).toBe('2026-11-19');
    expect(pp.trails[tr.id]).toEqual({ completions: 2, bestTimeSec: 200 });
    expect((p as any).album).toHaveLength(1);
    expect((p as any).stats.trailsCompleted).toBe(2);
  });
  it('every photo subject on every trail has EXP and a Thai name', () => {
    for (const tr of TRAILS) for (const poi of tr.pois) for (const s of [poi.subject, poi.photo, poi.rare?.subject]) {
      if (!s) continue;
      expect(PHOTO_EXP[s], s).toBeGreaterThan(0);
      expect(th, s).toHaveProperty(['ph_' + s]);
    }
  });
});
