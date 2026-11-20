import { describe, expect, it } from 'vitest';
import { achPoints, checkProgress, rankIndex, skillBonus, skillPoints, upgradeSkill } from './progress';
import { migrateProfile } from './profile';
import { applyFinish } from './rewards';
import { TRAILS } from '../data/trails';
import th from '../i18n/th.json';
import { EXTRA } from '../i18n/extra';
import { STORY_TEXT } from '../i18n/story';
import { TRAIL_TEXT } from '../i18n/trails';
import { ACHIEVEMENTS, MEDALS, SKILLS, TITLES, RANKS } from './progress';

const fresh = () => migrateProfile(null);

describe('skills', () => {
  it('earns one point per level gained and spends it', () => {
    const p = fresh(); p.exp = 400; // level 3
    expect(skillPoints(p)).toBe(2);
    expect(upgradeSkill(p, 'hiking')).toBe('ok');
    expect(upgradeSkill(p, 'hiking')).toBe('ok');
    expect(upgradeSkill(p, 'hiking')).toBe('points');
    expect(skillBonus(p, 'hiking')).toBeCloseTo(0.2, 5);
    expect(upgradeSkill(p, 'social')).toBe('locked');
  });
});

describe('achievements, ranks, medals, titles', () => {
  it('first trail gives bronze, the Northern medal and coins', () => {
    const p = fresh();
    applyFinish(p, TRAILS[0], { timeSec: 120, km: 3, photos: ['view', 'rhodo', 'moss'], litter: 5, secretFound: false });
    const coins = p.coins, ev = checkProgress(p);
    const kinds = ev.map((e) => e.kind + ':' + ('id' in e ? e.id : e.rank));
    expect(kinds).toContain('achievement:trails');
    expect(kinds).toContain('achievement:photos');
    expect(kinds).toContain('medal:north');
    expect(p.coins).toBeGreaterThan(coins);
    expect(checkProgress(p)).toEqual([]); // nothing twice
  });
  it('rank follows achievement points', () => {
    const p = fresh(); (p as any).achievements = { trails: { tier: 1 }, photos: { tier: 1 }, litter: { tier: 0 } };
    expect(achPoints(p)).toBe(3 + 3 + 1);
    expect(RANKS[rankIndex(p)][0]).toBe('beginner');
  });
  it('every skill, achievement, medal, title and rank has Thai text', () => {
    const keys = [...SKILLS.map((s) => 'skill_' + s.id), ...ACHIEVEMENTS.map((a) => 'ach_' + a.id), ...MEDALS.map((m) => 'medal_' + m.id),
      ...TITLES.map((t) => 'title_' + t.id), ...RANKS.map(([r]) => 'rank_' + r)];
    const all = { ...th, ...EXTRA.th, ...STORY_TEXT.th, ...TRAIL_TEXT.th }; // the same sources the game merges (src/i18n/index.ts)
    for (const k of keys) expect(all, k).toHaveProperty([k]);
  });
});
