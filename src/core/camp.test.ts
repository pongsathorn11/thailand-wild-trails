import { describe, expect, it } from 'vitest';
import { buy, cook, cycleTrail, ensureQuests, expNeed, gainExp, levelInfo, notifyQuest, plotAction, plotStage, sleep, storeQty, trailUnlocked } from './camp';
import { migrateProfile } from './profile';
import { applyFinish } from './rewards';
import { TRAILS } from '../data/trails';

const fresh = () => migrateProfile(null);

describe('level', () => {
  it('needs 100 × level^1.5 EXP per level', () => {
    expect([1, 2, 3].map(expNeed)).toEqual([100, 283, 520]);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100)).toEqual({ level: 2, into: 0, need: 283 });
  });
  it('reports a level-up', () => {
    const p = fresh();
    expect(gainExp(p, 50)).toBeNull();
    expect(gainExp(p, 60)).toBe(2);
  });
});

describe('garden', () => {
  it('plant → water → sleep ×2 → harvest holy basil', () => {
    const p = fresh(), plot = (p as any).camp.plots[0];
    expect(plotAction(p, plot, 'kaprao').msg).toBe('msg_planted');
    expect(storeQty(p, 'seed_kaprao')).toBe(3);
    expect(plotStage(plot)).toBe(0);
    for (let d = 0; d < 2; d++) { expect(plotAction(p, plot, null).msg).toBe('msg_watered'); sleep(p); }
    expect(plotStage(plot)).toBe(3);
    expect(plotAction(p, plot, null)).toEqual({ msg: 'msg_harvest', crop: 'kaprao', n: 2 });
    expect(storeQty(p, 'kaprao')).toBe(2);
  });
  it('unwatered crops do not grow', () => {
    const p = fresh(), plot = (p as any).camp.plots[0];
    plotAction(p, plot, 'kaprao'); sleep(p); sleep(p);
    expect(plot.grown).toBe(0);
  });
  it('chili cannot be planted in the cool season (day 1)', () => {
    const p = fresh(); p.storage.seed_chili = 1;
    expect(plotAction(p, (p as any).camp.plots[0], 'chili').msg).toBe('msg_season');
  });
});

describe('cooking and shop', () => {
  it('cooks basil fried rice from 2 holy basil', () => {
    const p = fresh();
    expect(cook(p, 'kaprao_rice')).toBe(false);
    p.storage.kaprao = 2;
    expect(cook(p, 'kaprao_rice')).toBe(true);
    expect(storeQty(p, 'kaprao_rice')).toBe(1); expect(storeQty(p, 'kaprao')).toBe(0);
  });
  it('the shop checks level and coins', () => {
    const p = fresh(); // 30 coins, level 1
    expect(buy(p, 'seed_strawberry')).toBe('locked');
    expect(buy(p, 'wood_bench')).toBe('ok'); expect(p.coins).toBe(0);
    expect(buy(p, 'seed_kaprao')).toBe('coins');
  });
});

describe('quests and unlocks', () => {
  it('gives 3 daily quests and pays out when done', () => {
    const p = fresh(); ensureQuests(p, () => 0.5);
    const list = (p as any).quests.list;
    expect(list).toHaveLength(3);
    (p as any).quests.list = [{ id: 'hike', progress: 0, done: false }];
    const done = notifyQuest(p, 'completeTrail');
    expect(done[0]).toMatchObject({ id: 'hike', exp: 40, coins: 20 });
    expect(p.coins).toBe(50);
  });
  it('cycles the packing screen through unlocked trails only', () => {
    const p = fresh();
    expect(cycleTrail(p, TRAILS[0].id, 1)).toBe(TRAILS[0].id); // only the first trail is open
    applyFinish(p, TRAILS[0], { timeSec: 100, km: 3, photos: ['view'], litter: 4, secretFound: false });
    const open = TRAILS.filter((tr) => trailUnlocked(p, tr)).map((tr) => tr.id);
    expect(open.length).toBeGreaterThan(1);
    expect(cycleTrail(p, open[0], 1)).toBe(open[1]);
    expect(cycleTrail(p, open[0], -1)).toBe(open[open.length - 1]);
    expect(open).toContain(cycleTrail(p, open[open.length - 1], 1));
  });
  it('Phu Kradueng unlocks at Lv.2 after Kew Mae Pan', () => {
    const p = fresh(), pkd = TRAILS[1];
    expect(trailUnlocked(p, pkd)).toBe(false);
    applyFinish(p, TRAILS[0], { timeSec: 100, km: 3, photos: ['view'], litter: 4, secretFound: false }); // 50 + 40 + 15 EXP
    expect(p.exp).toBeGreaterThanOrEqual(100);
    expect(trailUnlocked(p, pkd)).toBe(true);
  });
});
