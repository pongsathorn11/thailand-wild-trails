import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRAILS } from './trails';
import { PARKS, REGIONS } from '../core/progress';
import { TRAIL_KEY_SHIFT } from '../core/music';

describe('trail list', () => {
  it('matches the trail ids the database accepts (newest public.trail_ids())', () => {
    const dir = join(__dirname, '../../supabase/migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const sql = files.map((f) => readFileSync(join(dir, f), 'utf8')).filter((s) => s.includes('function public.trail_ids()')).pop()!;
    const list = sql.slice(sql.indexOf('array['), sql.indexOf(']::text[]'));
    const ids = [...list.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(ids.sort()).toEqual(TRAILS.map((t) => t.id).sort());
  });

  it('has a park entry for every trail and covers every region', () => {
    for (const t of TRAILS) expect(PARKS.some((p) => p.id === t.parkId && p.open), t.id).toBe(true);
    for (const r of REGIONS) expect(TRAILS.some((t) => t.region === r), r).toBe(true);
  });

  it('gives every trail its own music key and an unlock path from the first trail', () => {
    expect(TRAIL_KEY_SHIFT.length).toBeGreaterThanOrEqual(TRAILS.length);
    for (const t of TRAILS) if (t.unlock) expect(TRAILS.some((x) => x.id === t.unlock!.trail), t.id).toBe(true);
  });
});
