import { describe, expect, it } from 'vitest';
import { bestTimes, displayName, pickSave, readRemoteSave, saveFitsCloud, scoresToSend, validScore, SCORE_MIN_SEC } from './cloud';
import { migrateProfile } from './profile';
import { TRAILS } from '../data/trails';

const prof = (o: Record<string, unknown> = {}) => migrateProfile({ schemaVersion: 1, ...o });

describe('cloud save', () => {
  it('keeps the save that got further, even if it is older', () => {
    const far = prof({ exp: 500, savedAt: 1 }), near = prof({ exp: 100, savedAt: 999 });
    expect(pickSave(far, near)).toBe('local');
    expect(pickSave(near, far)).toBe('remote');
  });

  it('breaks ties with trails done, day, then save time', () => {
    expect(pickSave(prof({ exp: 100, stats: { trailsCompleted: 2 } }), prof({ exp: 100, stats: { trailsCompleted: 1 } }))).toBe('local');
    expect(pickSave(prof({ exp: 100, day: 3 }), prof({ exp: 100, day: 5 }))).toBe('remote');
    expect(pickSave(prof({ savedAt: 10 }), prof({ savedAt: 20 }))).toBe('remote');
    expect(pickSave(prof({ savedAt: 10 }), prof({ savedAt: 10 }))).toBe('same');
    expect(pickSave(prof(), null)).toBe('local');
  });

  it('treats cloud data as untrusted and migrates it', () => {
    expect(readRemoteSave(null)).toBeNull();
    expect(readRemoteSave('hi')).toBeNull();
    expect(readRemoteSave([1, 2])).toBeNull();
    const p = readRemoteSave({ schemaVersion: 1, exp: 50, name: 'ดอย' })!;
    expect(p.exp).toBe(50);
    expect(p.looks.male).toBeDefined();
    expect(p.storage).toBeDefined();
  });

  it('refuses saves that are too big for the cloud', () => {
    expect(saveFitsCloud(prof())).toBe(true);
    expect(saveFitsCloud(prof({ junk: 'x'.repeat(250_000) }))).toBe(false);
  });
});

describe('leaderboard', () => {
  const tr = TRAILS[0];

  it('accepts only known trails and plausible whole-second times', () => {
    expect(validScore(tr.id, 300)).toBe(true);
    expect(validScore(tr.id, SCORE_MIN_SEC - 1)).toBe(false);
    expect(validScore(tr.id, 300.5)).toBe(false);
    expect(validScore(tr.id, 99999)).toBe(false);
    expect(validScore('made-up-trail', 300)).toBe(false);
    expect(validScore(tr.id, '300')).toBe(false);
  });

  it('reads best times from the passport and rounds them', () => {
    const p = prof({ passport: { [tr.parkId]: { stamped: true, trails: { [tr.id]: { completions: 2, bestTimeSec: 412.6 } } } } });
    expect(bestTimes(p)).toEqual([{ trailId: tr.id, sec: 413 }]);
    expect(bestTimes(prof())).toEqual([]);
  });

  it('only re-sends improved times', () => {
    const best = [{ trailId: 'a', sec: 300 }, { trailId: 'b', sec: 200 }, { trailId: 'c', sec: 100 }];
    expect(scoresToSend(best, { a: 300, b: 250 })).toEqual([{ trailId: 'b', sec: 200 }, { trailId: 'c', sec: 100 }]);
  });

  it('cleans display names and falls back when empty', () => {
    expect(displayName(prof({ name: '  <b>ดอย</b>  ' }), 'Hiker')).toBe('bดอย/b');
    expect(displayName(prof({ name: '' }), 'นักเดินทาง')).toBe('นักเดินทาง');
    expect(Array.from(displayName(prof({ name: 'ก'.repeat(40) }), 'x')).length).toBe(20);
  });
});
