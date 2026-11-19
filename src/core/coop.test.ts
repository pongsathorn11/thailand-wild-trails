import { describe, expect, it } from 'vitest';
import {
  cleanInput, cleanLook, cleanRoomCode, coopHiker, MAX_STEP_PX, newRoomCode, parseClientMsg, roomKey, stepBudget, stepHiker, type CoopInput,
} from './coop';
import { buildWorld } from './world';
import { mulberry32 } from './rng';
import { TRAILS } from '../data/trails';

const world = buildWorld(TRAILS[0]);
const go = (o: Partial<CoopInput> = {}): CoopInput => ({ l: false, r: false, u: true, d: false, run: false, sit: false, slow: 1, ...o });

describe('co-op messages from clients are untrusted', () => {
  it('accepts a well-formed join and cleans it', () => {
    const m = parseClientMsg(JSON.stringify({ t: 'join', trail: TRAILS[1].id, room: ' abcd ', token: 'x', name: '  <b>ดอย</b> ', look: { body: 'female', looks: { hair: 2, acc: 99, skin: -1 } } }));
    expect(m).toEqual({ t: 'join', trail: TRAILS[1].id, room: 'ABCD', token: 'x', name: 'bดอย/b', look: { body: 'female', looks: { hairStyle: 0, hair: 2, skin: 0, face: 0, outfit: 0, acc: 0 } } });
  });

  it('drops junk, unknown trails, bad room codes and oversized messages', () => {
    for (const raw of ['not json', '[]', '{"t":"nope"}', JSON.stringify({ t: 'join', trail: 'fake', room: 'ABCD' }),
      JSON.stringify({ t: 'join', trail: TRAILS[0].id, room: 'AB0O' }), JSON.stringify({ t: 'input', seq: -1, inp: {} }),
      JSON.stringify({ t: 'input', seq: 1.5, inp: {} }), 'x'.repeat(5000), JSON.stringify({ t: 'chat', emote: 'dance' })])
      expect(parseClientMsg(raw)).toBeNull();
  });

  it('clamps input: only real booleans count, slow-down limited to 0.3–1', () => {
    expect(cleanInput({ l: 1, r: 'yes', u: true, slow: 5 })).toEqual({ l: false, r: false, u: true, d: false, run: false, sit: false, slow: 1 });
    expect(cleanInput({ slow: 0 }).slow).toBe(0.3);
    expect(cleanInput(null).slow).toBe(1);
  });

  it('room codes are 4 letters without look-alike characters', () => {
    const c = newRoomCode(mulberry32(1));
    expect(cleanRoomCode(c)).toBe(c);
    expect(cleanRoomCode('abc')).toBeNull();
    expect(cleanRoomCode(42)).toBeNull();
    expect(roomKey('t', 'ABCD')).toBe('t:ABCD');
    expect(cleanLook('x')).toEqual({ body: 'male', looks: { hairStyle: 0, hair: 0, skin: 0, face: 0, outfit: 0, acc: 0 } });
  });
});

describe('shared simulation', () => {
  it('client prediction and server give the same position for the same inputs', () => {
    const a = coopHiker(world), b = coopHiker(world), inputs = Array.from({ length: 80 }, (_, i) => go({ run: i % 3 === 0, r: i > 40, slow: i > 60 ? 0.7 : 1 }));
    for (const inp of inputs) { stepHiker(a, world, inp, 'drizzle'); }
    for (const inp of inputs) { stepHiker(b, world, inp, 'drizzle'); }
    expect([a.x, a.y]).toEqual([b.x, b.y]);
    expect(a.dist).toBeGreaterThan(0);
  });

  it('never moves faster than running speed allows, and slow-down only slows', () => {
    const fast = coopHiker(world), slow = coopHiker(world);
    for (let i = 0; i < 20; i++) {
      const x = fast.x, y = fast.y;
      stepHiker(fast, world, go({ run: true }), 'clear');
      expect(Math.hypot(fast.x - x, fast.y - y)).toBeLessThanOrEqual(MAX_STEP_PX);
      stepHiker(slow, world, go({ run: true, slow: 0.5 }), 'clear');
    }
    expect(slow.dist).toBeLessThan(fast.dist);
  });

  it('sitting stops movement until a direction is pressed', () => {
    const h = coopHiker(world);
    stepHiker(h, world, go({ u: false, sit: true }), 'clear');
    expect(h.sitting).toBe(true);
    stepHiker(h, world, go(), 'clear');
    expect(h.sitting).toBe(false);
  });

  it('limits steps to real time plus a small burst (speed-hack guard)', () => {
    expect(stepBudget(0, 0.05, 5)).toEqual({ run: 1, budget: 0 });
    expect(stepBudget(0, 0.025, 5).run).toBe(0);
    const big = stepBudget(0, 60, 100); // a minute of silence banks at most the burst
    expect(big.run).toBe(10);
    expect(stepBudget(3.5, 0, 2)).toEqual({ run: 2, budget: 1.5 });
  });
});
