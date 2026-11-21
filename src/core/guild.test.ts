import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BANNED_WORDS, checkGuildName, cleanGuildCode, EMBLEMS, isEmblem, memberPoints, nameKey } from './guild';

describe('club names', () => {
  it('accepts Thai and English names and tidies spaces', () => {
    expect(checkGuildName('  ชมรม   นกเงือก ')).toEqual({ name: 'ชมรม นกเงือก' });
    expect(checkGuildName("Doi Hikers' Club")).toEqual({ name: "Doi Hikers' Club" });
    expect(checkGuildName('ทีม-ภูกระดึง_2')).toEqual({ name: 'ทีม-ภูกระดึง_2' });
  });
  it('refuses short, long, odd characters and rude words (even split up)', () => {
    expect(checkGuildName('ab')).toEqual({ problem: 'short' });
    expect(checkGuildName('a'.repeat(21))).toEqual({ problem: 'long' });
    expect(checkGuildName('<b>club</b>')).toEqual({ problem: 'chars' });
    expect(checkGuildName('club 🔥🔥')).toEqual({ problem: 'chars' });
    expect(checkGuildName('F u-c.k club')).toEqual({ problem: 'banned' });
    expect(checkGuildName('ชมรมเหี้ย')).toEqual({ problem: 'banned' });
    expect(checkGuildName(42)).toEqual({ problem: 'short' });
  });
  it('compares names ignoring case, spaces and punctuation', () => {
    expect(nameKey('Doi  Hikers')).toBe(nameKey('doi-hikers'));
  });
  it('uses the same banned words and emblems as the database', () => {
    const sql = readFileSync('supabase/migrations/0005_guilds.sql', 'utf8');
    for (const w of BANNED_WORDS) expect(sql).toContain(`'${w}'`);
    for (const e of EMBLEMS) expect(sql).toContain(`'${e}'`);
  });
});

describe('codes and emblems', () => {
  it('cleans club codes', () => {
    expect(cleanGuildCode('ab2-cd3')).toBe('AB2CD3');
    expect(cleanGuildCode('AB2CD')).toBeNull();
    expect(isEmblem('🐘')).toBe(true);
    expect(isEmblem('💩')).toBe(false);
  });
});

describe('weekly points', () => {
  it('10 per hike, at most 3 counted per day', () => {
    expect(memberPoints([])).toBe(0);
    expect(memberPoints(['2026-11-16', '2026-11-16'])).toBe(20);
    expect(memberPoints(Array(7).fill('2026-11-17').concat(['2026-11-18']))).toBe(40);
  });
});
