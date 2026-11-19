import { describe, expect, it } from 'vitest';
import th from '../i18n/th.json';
import en from '../i18n/en.json';
import { TRAILS } from './trails';

/** Every text key a trail refers to must exist in both languages. */
describe('trail text keys', () => {
  const keys = new Set<string>();
  for (const tr of TRAILS) {
    [tr.parkKey, tr.trailKey, tr.diffKey, tr.realInfoKey, tr.signKey, tr.objKeys.goal, ...tr.stampKeys].forEach((k) => keys.add(k));
    if (tr.objKeys.checkpoint) keys.add(tr.objKeys.checkpoint);
    for (const p of tr.pois) {
      if (p.nameKey) keys.add(p.nameKey);
      if (p.linesKey) keys.add(p.linesKey);
      if (p.subject) keys.add('ph_' + p.subject);
      if (p.photo) keys.add('ph_' + p.photo);
      if (p.rare) keys.add('ph_' + p.rare.subject);
    }
    for (const z of Object.keys(tr.gen.zones)) keys.add('zone_' + z);
  }
  it.each([...keys])('%s', (k) => {
    expect(th).toHaveProperty([k]);
    expect(en).toHaveProperty([k]);
  });
});
