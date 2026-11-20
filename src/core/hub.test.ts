import { describe, expect, it } from 'vitest';
import {
  allReady, createParty, departParty, hubCanStand, hubMaxMove, hubSolid, hubSpawn, joinParty, leaveParty, legalHubMove,
  newPartyBook, parseHubMsg, partyListings, partyOf, partyView, PARTY_MAX, setPartyTrail, setReady,
} from './hub';
import { HUB } from '../data/hub';
import { TRAILS } from '../data/trails';
import { CONFIG } from './config';

const T0 = TRAILS[0].id, T1 = TRAILS[1].id;
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('hub map', () => {
  const solid = hubSolid();
  it('the spawn point and every spot approach are standable', () => {
    for (let n = 0; n < 6; n++) { const s = hubSpawn(n); expect(hubCanStand(solid, s.x, s.y)).toBe(true); }
  });
  it('the border is closed except the path back to camp', () => {
    const [g0] = HUB.exitGap;
    expect(solid[(HUB.H - 1) * HUB.W + g0]).toBe(0);
    expect(solid[(HUB.H - 1) * HUB.W + 10]).toBe(1);
    expect(solid[0]).toBe(1);
  });
  it('stalls and the board block, signposts do not', () => {
    const at = (type: string) => HUB.spots.find((s) => s.type === type)!;
    expect(solid[at('partyBoard').y * HUB.W + at('partyBoard').x]).toBe(1);
    expect(solid[at('cafe').y * HUB.W + at('cafe').x + 1]).toBe(1);
    expect(solid[at('gate').y * HUB.W + at('gate').x]).toBe(0);
  });
  it('accepts a normal step and refuses teleports and walls', () => {
    const from = hubSpawn(1);
    expect(legalHubMove(solid, from, { x: from.x + CONFIG.WALK_SPEED * 0.1, y: from.y }, 0.1)).toBe(true);
    expect(legalHubMove(solid, from, { x: from.x + 200, y: from.y }, 0.1)).toBe(false);
    expect(legalHubMove(solid, from, { x: from.x, y: from.y + 200 }, 5)).toBe(false); // more than a second's worth is capped
    expect(legalHubMove(solid, { x: 30, y: 30 }, { x: 4, y: 30 }, 1)).toBe(false); // into the tree border
    expect(legalHubMove(solid, from, { x: NaN, y: 0 }, 0.1)).toBe(false);
    expect(hubMaxMove(0.1)).toBeGreaterThan(CONFIG.RUN_SPEED * 0.1);
  });
});

describe('parties', () => {
  it('create, join, ready up and set off together', () => {
    const b = newPartyBook();
    const { r, party } = createParty(b, 'a', T0, seq([0.1, 0.2, 0.3, 0.4]));
    expect(r).toBe('ok');
    expect(party!.code).toHaveLength(4);
    expect(joinParty(b, 'b', party!.code)).toBe('ok');
    expect(allReady(party!)).toBe(false);
    expect(departParty(b, 'a').r).toBe('notReady');
    expect(departParty(b, 'b').r).toBe('notLeader');
    setReady(b, 'b', true);
    const go = departParty(b, 'a');
    expect(go.r).toBe('ok');
    expect(go.party!.members).toEqual(['a', 'b']);
    expect(partyOf(b, 'a')).toBeNull();
    expect(b.parties.size).toBe(0);
  });
  it('refuses a fifth hiker, unknown codes and joining twice', () => {
    const b = newPartyBook(), { party } = createParty(b, 'a', T0);
    for (let i = 1; i < PARTY_MAX; i++) expect(joinParty(b, 'p' + i, party!.code)).toBe('ok');
    expect(joinParty(b, 'late', party!.code)).toBe('full');
    expect(joinParty(b, 'late', 'ZZZZ')).toBe('none');
    expect(joinParty(b, 'p1', party!.code)).toBe('already');
    expect(createParty(b, 'a', T0).r).toBe('already');
    expect(createParty(b, 'x', 'nope').r).toBe('trail');
  });
  it('codes never collide', () => {
    const b = newPartyBook(), rng = seq([0]);
    const c1 = createParty(b, 'a', T0, rng).party!.code, c2 = createParty(b, 'b', T0, seq([0, 0, 0, 0, 0.5])).party!.code;
    expect(c1).not.toBe(c2);
  });
  it('only the leader changes the trail, and that resets ready', () => {
    const b = newPartyBook(), { party } = createParty(b, 'a', T0);
    joinParty(b, 'b', party!.code); setReady(b, 'b', true);
    expect(setPartyTrail(b, 'b', T1)).toBe('notLeader');
    expect(setPartyTrail(b, 'a', T1)).toBe('ok');
    expect(party!.trail).toBe(T1);
    expect(party!.ready).toEqual(['a']);
  });
  it('the lead passes on when the leader leaves; the last one out closes the party', () => {
    const b = newPartyBook(), { party } = createParty(b, 'a', T0);
    joinParty(b, 'b', party!.code);
    leaveParty(b, 'a');
    expect(party!.leader).toBe('b');
    expect(party!.ready).toContain('b');
    leaveParty(b, 'b');
    expect(b.parties.size).toBe(0);
    expect(leaveParty(b, 'b')).toBeNull();
  });
  it('views and board listings show names, not more than needed', () => {
    const b = newPartyBook(), { party } = createParty(b, 'a', T0), names: Record<string, string> = { a: 'Ann', b: 'Bo' };
    joinParty(b, 'b', party!.code);
    const v = partyView(party!, (id) => names[id]);
    expect(v.members).toEqual([{ id: 'a', name: 'Ann', ready: true }, { id: 'b', name: 'Bo', ready: false }]);
    expect(partyListings(b, (id) => names[id])).toEqual([{ code: party!.code, leaderName: 'Ann', trail: T0, size: 2 }]);
    for (let i = 2; i < PARTY_MAX; i++) joinParty(b, 'x' + i, party!.code);
    expect(partyListings(b, () => '')).toEqual([]); // full parties leave the board
  });
});

describe('hub messages', () => {
  it('cleans joins, positions and party commands', () => {
    const j = parseHubMsg(JSON.stringify({ t: 'hub_join', name: '  <b>Nok</b> ', title: 'DROP TABLE', look: { body: 'x' } }));
    expect(j).toMatchObject({ t: 'hub_join', name: 'bNok/b', title: 'newbie', token: null });
    expect(parseHubMsg({ t: 'pos', x: 10.1234, y: 20, dir: 'sideways', moving: 1 })).toEqual({ t: 'pos', x: 10.1, y: 20, dir: 'down', moving: false });
    expect(parseHubMsg({ t: 'pos', x: 'a', y: 1 })).toBeNull();
    expect(parseHubMsg({ t: 'party_join', code: 'ab2c' })).toEqual({ t: 'party_join', code: 'AB2C' });
    expect(parseHubMsg({ t: 'party_join', code: 'O0O0' })).toBeNull();
    expect(parseHubMsg({ t: 'party_new', trail: 'moon' })).toBeNull();
    expect(parseHubMsg({ t: 'party_trail', trail: T1 })).toEqual({ t: 'party_trail', trail: T1 });
    expect(parseHubMsg({ t: 'hub_emote', emote: 'dance' })).toBeNull();
    expect(parseHubMsg('{bad json')).toBeNull();
    expect(parseHubMsg({ t: 'teleport' })).toBeNull();
  });
});
