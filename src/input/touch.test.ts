import { describe, expect, it } from 'vitest';
import { hitButton, layoutButtons, stickDirs, touch, touchClaims, type TouchView } from './touch';

const view = (o: Partial<TouchView>): TouchView => ({ screen: 'hike', menu: false, build: false, sound: true, music: true, ...o });
const ids = (v: Partial<TouchView>) => layoutButtons(view(v), 400, 800).map((b) => b.id);

describe('touch controls', () => {
  it('shows the right buttons for each screen', () => {
    expect(ids({ screen: 'title' })).toEqual(['snd', 'mus']);
    expect(ids({ screen: 'hike' })).toEqual(['snd', 'mus', 'act', 'run']);
    expect(ids({ screen: 'camp' })).toEqual(expect.arrayContaining(['act', 'run', 'seed', 'build', 'skills', 'journal', 'home']));
    expect(ids({ screen: 'camp', build: true })).toEqual(expect.arrayContaining(['place', 'pick', 'next', 'bexit']));
    expect(ids({ screen: 'camp', menu: true })).toEqual(['snd', 'mus', 'up', 'down', 'left', 'right', 'ok', 'back']);
    expect(ids({ screen: 'pack' })).toContain('ok');
  });

  it('keeps every button on screen on a small phone', () => {
    for (const v of [view({ screen: 'camp' }), view({ screen: 'camp', build: true }), view({ screen: 'pack' })])
      for (const b of layoutButtons(v, 320, 568)) {
        expect(b.x - b.r).toBeGreaterThanOrEqual(0); expect(b.x + b.r).toBeLessThanOrEqual(320);
        expect(b.y - b.r).toBeGreaterThanOrEqual(0); expect(b.y + b.r).toBeLessThanOrEqual(568);
      }
  });

  it('sends keyboard codes and shows mute state', () => {
    const B = layoutButtons(view({ sound: false, music: false }), 400, 800);
    expect(B.find((b) => b.id === 'snd')!.label).toBe('🔇');
    expect(B.find((b) => b.id === 'act')!.code).toBe('KeyE');
    expect(B.find((b) => b.id === 'run')!.hold).toBe('run');
    const act = B.find((b) => b.id === 'act')!;
    expect(hitButton(B, act.x + act.r + 4, act.y)?.id).toBe('act');
    expect(hitButton(B, 10, 10)).toBeUndefined();
  });

  it('maps the stick to directions with a dead zone, diagonals and push-to-run', () => {
    expect(stickDirs(5, 5)).toEqual({ left: false, right: false, up: false, down: false, run: false });
    expect(stickDirs(40, 0)).toMatchObject({ right: true, up: false, run: false });
    expect(stickDirs(-30, -30)).toMatchObject({ left: true, up: true });
    expect(stickDirs(0, 90)).toMatchObject({ down: true, run: true });
  });

  it('claims pointers only when touch mode is on', () => {
    touch.buttons = layoutButtons(view({}), 400, 800); touch.stickZone = (x) => x < 200;
    touch.enabled = false;
    expect(touchClaims({ x: 50, y: 400, id: 1 })).toBe(false);
    touch.enabled = true;
    expect(touchClaims({ x: 50, y: 400, id: 1 })).toBe(true);
    expect(touchClaims({ x: 300, y: 100, id: 2 })).toBe(false);
    touch.owned.add(2);
    expect(touchClaims({ x: 300, y: 100, id: 2 })).toBe(true);
    touch.enabled = false; touch.owned.clear();
  });
});
