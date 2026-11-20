import { describe, expect, it } from 'vitest';
import { exploredPct, statusWarning, type WarnInput } from './hudInfo';
import { buildWorld, isSolidTile } from './world';
import { TRAILS } from '../data/trails';

describe('explored percent', () => {
  const m = buildWorld(TRAILS[0]);
  it('is 0 with nothing revealed and 100 with everything revealed', () => {
    expect(exploredPct(m, new Uint8Array(m.w * m.h))).toBe(0);
    expect(exploredPct(m, new Uint8Array(m.w * m.h).fill(1))).toBe(100);
  });
  it('counts walkable tiles only', () => {
    const r = new Uint8Array(m.w * m.h);
    for (let i = 0; i < r.length; i++) if (isSolidTile(m, i % m.w, Math.floor(i / m.w))) r[i] = 1;
    expect(exploredPct(m, r)).toBe(0); // revealing rock, water and trees adds nothing
  });
});

describe('status warning', () => {
  const ok: WarnInput = { stamina: 80, hunger: 80, thirst: 80, warmth: 80, exhausted: false, jacketOff: false, overweight: false };
  it('is quiet when all is well', () => expect(statusWarning(ok)).toBeNull());
  it('suggests the jacket only when one is in the pack', () => {
    expect(statusWarning({ ...ok, warmth: 20, jacketOff: true })).toBe('ui_warn_cold_jacket');
    expect(statusWarning({ ...ok, warmth: 20 })).toBe('ui_warn_cold');
  });
  it('shows the most urgent problem first', () => {
    expect(statusWarning({ ...ok, exhausted: true, warmth: 10, thirst: 5 })).toBe('ui_warn_tired');
    expect(statusWarning({ ...ok, thirst: 10, hunger: 10, overweight: true })).toBe('ui_warn_thirst');
    expect(statusWarning({ ...ok, hunger: 10, overweight: true })).toBe('ui_warn_hunger');
    expect(statusWarning({ ...ok, overweight: true })).toBe('ui_warn_heavy');
  });
});
