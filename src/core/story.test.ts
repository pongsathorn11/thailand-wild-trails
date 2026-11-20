import { describe, expect, it } from 'vitest';
import {
  activeEvent, dayInSeason, ensureStory, eventPhotoMult, eventState, eventWeatherChances, goalMatches, nextEvent, notifyStory, npcView, storyComplete, talkTo, yearOf, YEAR_DAYS,
} from './story';
import { migrateProfile } from './profile';
import { campLayout } from '../gfx/campArt';
import { CAMP } from '../data/camp';
import { EVENTS_DEF, NPCS } from '../data/story';
import { TRAILS, trailById } from '../data/trails';
import { STORY_TEXT } from '../i18n/story';
import { hikeExp } from './rewards';
import { PHOTO_EXP } from '../data/photos';

const prof = (o: Record<string, unknown> = {}) => migrateProfile({ schemaVersion: 1, day: 1, ...o });
// a camp day with no event running (cool season day 1)
const QUIET = 1;

describe('NPC stories', () => {
  it('tells the chapter first, then counts progress, then pays on the next talk', () => {
    const p = prof({ day: QUIET });
    expect(npcView(p, 'kham').status).toBe('new');
    notifyStory(p, 'collectLitter', {}, 3);
    expect(npcView(p, 'kham').progress).toBe(0); // not accepted yet
    expect(talkTo(p, 'kham')).toMatchObject({ kind: 'intro', lines: 'story_kham1_intro' });
    expect(talkTo(p, 'kham')).toMatchObject({ kind: 'waiting' });
    expect(notifyStory(p, 'collectLitter', {}, 4)).toEqual([]);
    expect(notifyStory(p, 'collectLitter', {}, 1)).toEqual([{ kind: 'npcReady', npc: 'kham' }]);
    expect(npcView(p, 'kham')).toMatchObject({ status: 'ready', progress: 5, need: 5 });
    const exp0 = p.exp, coins0 = p.coins;
    const r = talkTo(p, 'kham');
    expect(r).toMatchObject({ kind: 'reward', lines: 'story_kham1_done', exp: 40, coins: 20, finished: false });
    expect(p.exp - exp0).toBe(40); expect(p.coins - coins0).toBe(20);
    expect(npcView(p, 'kham')).toMatchObject({ status: 'new', chapter: 1, hearts: 1 });
  });

  it('narrow goals only count the right trail, photo subject or nothing else', () => {
    const p = prof({ day: QUIET }), s = ensureStory(p);
    s.npcs.kham = { ch: 1, accepted: true, progress: 0 }; // walk Kew Mae Pan
    notifyStory(p, 'completeTrail', { trail: 'erawan-waterfall' });
    expect(npcView(p, 'kham').progress).toBe(0);
    notifyStory(p, 'completeTrail', { trail: 'doi-inthanon-kew-mae-pan' });
    expect(npcView(p, 'kham').status).toBe('ready');
    s.npcs.fah = { ch: 1, accepted: true, progress: 0 }; // sea of mist photo
    notifyStory(p, 'takePhoto', { subject: 'moss' });
    notifyStory(p, 'takePhoto', {});
    expect(npcView(p, 'fah').progress).toBe(0);
    notifyStory(p, 'takePhoto', { subject: 'seaOfMist' });
    expect(npcView(p, 'fah').status).toBe('ready');
    expect(goalMatches({ kind: 'harvest', count: 1, crop: 'chili' }, 'harvest', { crop: 'kaprao' })).toBe(false);
  });

  it('locks later chapters behind a level and finishes the story with a title', () => {
    const p = prof({ day: QUIET, exp: 0 }), s = ensureStory(p);
    s.npcs.daeng = { ch: 2, accepted: false, progress: 0 };
    expect(talkTo(p, 'daeng')).toMatchObject({ kind: 'locked', level: 3 });
    p.exp = 100_000;
    talkTo(p, 'daeng');
    notifyStory(p, 'cook', {}, 4);
    expect(talkTo(p, 'daeng')).toMatchObject({ kind: 'reward', finished: true });
    expect(storyComplete(p, 'daeng')).toBe(true);
    expect(talkTo(p, 'daeng')).toMatchObject({ kind: 'done' });
  });

  it('gives item rewards into camp storage', () => {
    const p = prof({ day: QUIET }), before = p.storage.seed_kaprao || 0;
    talkTo(p, 'daeng'); notifyStory(p, 'cook', {}, 2); talkTo(p, 'daeng');
    expect(p.storage.seed_kaprao).toBe(before + 2);
  });

  it('repairs a damaged story save', () => {
    const p = prof({ story: { npcs: { kham: { ch: 99, progress: 'x' }, fah: null } } });
    const s = ensureStory(p);
    expect(s.npcs.kham.ch).toBe(3);
    expect(s.npcs.fah).toEqual({ ch: 0, accepted: false, progress: 0 });
    expect(s.events).toEqual({}); expect(s.stamps).toEqual({});
  });

  it('stands NPCs on free camp tiles, off paths, plots and fixed objects', () => {
    const { solid, path } = campLayout(), W = CAMP.W;
    for (const n of NPCS) {
      expect(solid[n.y * W + n.x], n.id).toBe(0);
      expect(path[n.y * W + n.x], n.id).toBe(0);
      expect(CAMP.plots.some(([x, y]) => x === n.x && y === n.y), n.id).toBe(false);
      expect(CAMP.fixed.some((f) => f.x === n.x && f.y === n.y), n.id).toBe(false);
    }
  });
});

describe('seasonal events', () => {
  it('follow the 21-day calendar and repeat every year', () => {
    expect(YEAR_DAYS).toBe(21);
    expect(dayInSeason(9)).toBe(2);
    expect(activeEvent(1)).toBeNull();
    expect(activeEvent(2)).toMatchObject({ key: 'mistFestival@0', daysLeft: 5 });
    expect(activeEvent(6)?.daysLeft).toBe(1);
    expect(activeEvent(7)).toBeNull();
    expect(activeEvent(9)?.def.id).toBe('hikeFestival');
    expect(activeEvent(15)?.def.id).toBe('plantingSeason');
    expect(activeEvent(2 + 21)).toMatchObject({ key: 'mistFestival@1' });
    expect(yearOf(21)).toBe(0); expect(yearOf(22)).toBe(1);
    expect(nextEvent(1)).toMatchObject({ def: { id: 'mistFestival' }, inDays: 1 });
    expect(nextEvent(3)).toMatchObject({ def: { id: 'hikeFestival' }, inDays: 6 });
  });

  it('counts goals only while running, pays once, and adds a stamp', () => {
    const p = prof({ day: 9 }); // hike festival
    notifyStory(p, 'completeTrail', { trail: TRAILS[0].id }, 2);
    const coins0 = p.coins, exp0 = p.exp;
    const out = notifyStory(p, 'collectLitter', {}, 6);
    expect(out).toContainEqual(expect.objectContaining({ kind: 'eventDone', id: 'hikeFestival', exp: 100, coins: 50 }));
    expect(p.coins - coins0).toBe(50); expect(p.exp - exp0).toBe(100);
    expect(ensureStory(p).stamps.hikeFestival).toBe(1);
    expect(notifyStory(p, 'collectLitter', {}, 6).some((e) => e.kind === 'eventDone')).toBe(false); // once a year
    p.day = 9 + 21;                                                                                // next year's festival
    expect(eventState(p, activeEvent(p.day)!).done).toBe(false);
    p.day = QUIET;
    expect(notifyStory(p, 'collectLitter', {}, 99)).toEqual([]);
  });

  it('biases weather only on the listed regions and keeps odds summing to 1', () => {
    const base = { clear: 0.6, fog: 0.25, drizzle: 0.15 };
    const north = eventWeatherChances(trailById('doi-inthanon-kew-mae-pan')!, 3, base);
    expect(north.fog).toBeGreaterThan(base.fog);
    expect(north.clear + north.fog + north.drizzle).toBeCloseTo(1);
    expect(eventWeatherChances(trailById('khao-sok-ton-kloi')!, 3, base)).toEqual(base);
    expect(eventWeatherChances(trailById('doi-inthanon-kew-mae-pan')!, QUIET, base)).toEqual(base);
  });

  it('boosts photo EXP only for listed subjects during the event', () => {
    expect(eventPhotoMult(3, 'seaOfMist')).toBe(2);
    expect(eventPhotoMult(3, 'moss')).toBe(1);
    expect(eventPhotoMult(QUIET, 'seaOfMist')).toBe(1);
    const r = { timeSec: 600, km: 3, photos: ['seaOfMist', 'moss'], litter: 0, secretFound: false };
    const plain = hikeExp(r), festival = hikeExp(r, 0, (sub) => eventPhotoMult(3, sub));
    expect(festival - plain).toBe(PHOTO_EXP.seaOfMist); // only the mist photo doubles
  });
});

describe('story text', () => {
  it('has Thai and English lines for every chapter, NPC and event', () => {
    for (const lang of ['th', 'en'] as const) {
      const T = STORY_TEXT[lang];
      for (const n of NPCS) {
        for (const k of [`npc_${n.id}`, `npc_${n.id}_role`, `title_${n.titleId}`, `tcond_${n.titleId}`]) expect(typeof T[k], `${lang} ${k}`).toBe('string');
        for (const k of [`story_${n.id}_done`, `story_${n.id}_locked`]) expect(Array.isArray(T[k]), `${lang} ${k}`).toBe(true);
        for (const c of n.chapters) {
          expect(typeof T[`story_${c.id}_goal`], `${lang} ${c.id} goal`).toBe('string');
          for (const s of ['intro', 'wait', 'done']) expect((T[`story_${c.id}_${s}`] as string[])?.length, `${lang} ${c.id} ${s}`).toBeGreaterThan(0);
        }
      }
      for (const e of EVENTS_DEF) for (const k of [`event_${e.id}`, `event_${e.id}_desc`]) expect(typeof T[k], `${lang} ${k}`).toBe('string');
    }
  });
});
