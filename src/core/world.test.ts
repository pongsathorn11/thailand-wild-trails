import { describe, expect, it } from 'vitest';
import { TRAILS } from '../data/trails';
import { buildWorld, canStand, reachable } from './world';
import { CONFIG } from './config';

describe.each(TRAILS.map((t) => [t.id, t] as const))('trail %s', (_id, trail) => {
  const m = buildWorld(trail);

  it('is the same map every time (seeded)', () => {
    expect(buildWorld(trail).tiles).toEqual(m.tiles);
  });

  it('lets the hiker stand at the start', () => {
    expect(canStand(m, trail.start[0] * CONFIG.TILE + 8, trail.start[1] * CONFIG.TILE + 10)).toBe(true);
  });

  it('can reach every point of interest on foot', () => {
    const seen = reachable(m);
    const stuck = trail.pois.filter((p) => !seen[p.y * m.w + p.x]).map((p) => p.id);
    expect(stuck).toEqual([]);
  });

  it('has a main trail length to scale distances by', () => {
    expect(m.pathLenPx).toBeGreaterThan(500);
  });
});
