import { describe, expect, it } from 'vitest';
import { TRAILS } from '../data/trails';
import { buildWorld } from './world';
import { ambientC, newHiker, updateStats, type HikeEnv, type HikeWarning } from './hiker';

const world = buildWorld(TRAILS[0]);
const env = (over: Partial<HikeEnv> = {}): HikeEnv => ({ weather: 'clear', hour: 10, zone: 'forest', climateC: 0, overweight: false, wet: false, ...over });

describe('hiker stats', () => {
  it('walking on flat ground uses 1 stamina per second', () => {
    const h = newHiker(world); h.moving = true;
    updateStats(h, world, env(), 1, new Set());
    expect(h.stamina).toBeCloseTo(99, 5);
  });

  it('resting on a bench restores stamina faster than standing', () => {
    const a = newHiker(world), b = newHiker(world);
    a.stamina = b.stamina = 50; b.sitting = true;
    updateStats(a, world, env(), 1, new Set()); updateStats(b, world, env(), 1, new Set());
    expect(b.stamina).toBeGreaterThan(a.stamina);
  });

  it('a cold dawn without a jacket drains warmth and warns once', () => {
    const h = newHiker(world, false), warned = new Set<HikeWarning>();
    const all: HikeWarning[] = [];
    for (let i = 0; i < 300; i++) all.push(...updateStats(h, world, env({ hour: 5 }), 0.5, warned).warnings);
    expect(h.warmth).toBeLessThan(30);
    expect(all.filter((w) => w === 'cold')).toHaveLength(1);
  });

  it('rangers bring the hiker back after 10 s with no food and no water', () => {
    const h = newHiker(world); h.hunger = 0; h.thirst = 0;
    let rescued = null;
    for (let i = 0; i < 12 && !rescued; i++) rescued = updateStats(h, world, env(), 1, new Set()).rescued;
    expect(rescued).toBe('starve');
  });

  it('Erawan is warmer than Doi Inthanon at the same hour', () => {
    expect(ambientC(env({ climateC: 12 }))).toBeGreaterThan(ambientC(env()));
  });
});
