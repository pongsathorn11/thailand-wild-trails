import { describe, expect, it } from 'vitest';
import { cleanName, lookOf, lookVariant, NAME_MAX, setOption, stepOption, TITLE_ROWS } from './creator';
import { migrateProfile } from './profile';
import { LOOK_OPTIONS } from '../data/looks';

const fresh = () => migrateProfile({});

describe('character creator', () => {
  it('has body, six look rows and name, in that order', () => {
    expect(TITLE_ROWS).toEqual(['body', 'hairStyle', 'hair', 'skin', 'face', 'outfit', 'acc', 'name']);
  });

  it('steps options with wrap-around in both directions', () => {
    const p = fresh(); p.looks.male.hair = 0;
    stepOption(p, 'hair', -1);
    expect(p.looks.male.hair).toBe(LOOK_OPTIONS.hair.length - 1);
    stepOption(p, 'hair', 1);
    expect(p.looks.male.hair).toBe(0);
  });

  it('keeps separate looks per body and flips body with arrows', () => {
    const p = fresh(); p.looks.male.skin = 3;
    stepOption(p, 'body', 1);
    expect(p.body).toBe('female');
    stepOption(p, 'skin', 1);
    expect(p.looks.male.skin).toBe(3);
    expect(lookOf(p, 'male').skin).toBe(LOOK_OPTIONS.skin[3]);
  });

  it('ignores arrows on the name row and out-of-range option clicks', () => {
    const p = fresh(), before = JSON.stringify(p);
    stepOption(p, 'name', 1);
    setOption(p, 'acc', 99);
    setOption(p, 'acc', -1);
    expect(JSON.stringify(p)).toBe(before);
    setOption(p, 'acc', 2);
    expect(p.looks[p.body].acc).toBe(2);
  });

  it('builds a variant look without touching the profile', () => {
    const p = fresh(), v = lookVariant(p, 'male', 'acc', 4);
    expect(v.acc).toBe('sunglasses');
    expect(p.looks.male.acc).toBe(0);
  });

  it('cleans names: trims, collapses spaces, strips control chars, caps length by character', () => {
    expect(cleanName('  ต้น   ไม้ ')).toBe('ต้น ไม้');
    expect(cleanName('a\u0007b\nc')).toBe('ab c');
    expect(Array.from(cleanName('นักเดินป่าผู้ยิ่งใหญ่แห่งดอย')).length).toBe(NAME_MAX);
    expect(cleanName('🌲'.repeat(20))).toBe('🌲'.repeat(NAME_MAX));
  });
});
