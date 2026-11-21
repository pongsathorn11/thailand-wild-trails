import { describe, expect, it } from 'vitest';
import { applyVisits, campCard, cleanCampCard, cleanCampCode, guestbook, GUESTBOOK_MAX, isSticker, STICKERS, thirstyPlots } from './visit';
import { migrateProfile } from './profile';
import { plotAction } from './camp';
import { CAMP } from '../data/camp';

const fresh = () => migrateProfile(null);

describe('camp codes', () => {
  it('accepts 6 letters/digits without look-alikes, any case, spaces or dashes', () => {
    expect(cleanCampCode(' ab2-cd3 ')).toBe('AB2CD3');
    expect(cleanCampCode('ABCDE')).toBeNull();
    expect(cleanCampCode('ABCDE0')).toBeNull(); // 0 is not used
    expect(cleanCampCode(123456)).toBeNull();
  });
});

describe('camp card', () => {
  it('carries name, look, level, furniture and garden, and survives cleaning unchanged', () => {
    const p = fresh();
    p.name = 'Nok';
    (p as any).camp.placed.push({ itemId: 'lantern', x: 5, y: 6 });
    plotAction(p, (p as any).camp.plots[0], 'kaprao');
    const card = campCard(p);
    expect(card).toMatchObject({ name: 'Nok', level: 1, title: 'newbie', placed: [{ itemId: 'lantern', x: 5, y: 6 }] });
    expect(card.plots[0]).toEqual({ cropId: 'kaprao', grown: 0, watered: false });
    expect(cleanCampCard(JSON.parse(JSON.stringify(card)))).toEqual(card);
  });
  it('drops anything another player could inject', () => {
    const c = cleanCampCard({
      name: '<script>x</script>', title: 'Robert); DROP', level: -5, body: 'robot', looks: { hair: 999, skin: 1 },
      placed: [{ itemId: 'lantern', x: 999, y: 3 }, { itemId: 'gold_bar', x: 3, y: 3 }, { itemId: 'hammock', x: 4, y: 4 }, 'junk'],
      plots: [{ cropId: 'kaprao', grown: 99, watered: 'yes' }, { cropId: 'ufo', grown: 1, watered: true }],
    })!;
    expect(c.name).not.toMatch(/[<>]/);
    expect(c.title).toBe('newbie');
    expect(c.level).toBe(1);
    expect(c.body).toBe('male');
    expect(c.looks.hair).toBe(0);
    expect(c.looks.skin).toBe(1);
    expect(c.placed).toEqual([{ itemId: 'hammock', x: 4, y: 4 }]);
    expect(c.plots).toHaveLength(CAMP.plots.length);
    expect(c.plots[0]).toEqual({ cropId: 'kaprao', grown: 0, watered: false });
    expect(c.plots[1]).toEqual({ cropId: null, grown: 0, watered: false });
    expect(cleanCampCard(null)).toBeNull();
    expect(cleanCampCard([1, 2])).toBeNull();
  });
  it('knows which plots need water', () => {
    expect(thirstyPlots([{ cropId: 'kaprao', grown: 0, watered: false }, { cropId: 'kaprao', grown: 0, watered: true }, { cropId: null, grown: 0, watered: false }, { cropId: 'kaprao', grown: 2, watered: false }])).toEqual([0]);
  });
});

describe('visits', () => {
  it('a friend waters thirsty plots and signs the guestbook, newest first', () => {
    const p = fresh(), plots = (p as any).camp.plots;
    plotAction(p, plots[0], 'kaprao'); plotAction(p, plots[1], 'kaprao');
    plots[1].watered = true;
    const r = applyVisits(p, [
      { name: 'Ann', sticker: 'garden', watered: true, at: '2026-11-21T10:00:00Z' },
      { name: 'Bo', sticker: 'wow', watered: false, at: '2026-11-21T11:00:00Z' },
    ]);
    expect(r.watered).toBe(1);
    expect(plots[0].watered).toBe(true);
    expect(guestbook(p).map((e) => e.name)).toEqual(['Bo', 'Ann']);
  });
  it('ignores unknown stickers and keeps the guestbook short', () => {
    const p = fresh();
    applyVisits(p, [{ name: 'X', sticker: 'spam' as never, watered: true, at: 'z' }]);
    expect(guestbook(p)).toEqual([]);
    applyVisits(p, Array.from({ length: 40 }, (_, i) => ({ name: 'F' + i, sticker: STICKERS[i % STICKERS.length], watered: false, at: String(1000 + i) })));
    expect(guestbook(p)).toHaveLength(GUESTBOOK_MAX);
    expect(guestbook(p)[0].name).toBe('F39');
    expect(isSticker('thanks')).toBe(true);
  });
});
