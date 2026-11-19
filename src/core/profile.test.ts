import { describe, expect, it } from 'vitest';
import { migrateProfile } from './profile';

describe('save migration', () => {
  it('upgrades a v0.1 prototype save', () => {
    const p = migrateProfile({ totalExp: 120, completions: 2, album: ['view'], lang: 'en', look: { skin: 1, hair: 2, shirt: 0, hat: 2 } });
    expect(p.schemaVersion).toBe(1);
    expect(p.exp).toBe(120);
    expect((p as any).stats.trailsCompleted).toBe(2);
    expect(p.lang).toBe('en');
    expect(p.looks.male).toMatchObject({ skin: 1, hair: 2, outfit: 1, acc: 1 });
    expect('totalExp' in p).toBe(false);
  });

  it('keeps fields this port does not use yet', () => {
    const p = migrateProfile({ schemaVersion: 1, medals: { north: '2026-11-19' }, coins: 99 });
    expect((p as any).medals).toEqual({ north: '2026-11-19' });
    expect(p.coins).toBe(99);
  });

  it('starts a fresh profile with defaults', () => {
    const p = migrateProfile(null);
    expect(p.body).toBe('male');
    expect(p.looks.female.hairStyle).toBe(2);
  });
});
