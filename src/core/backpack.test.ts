import { describe, expect, it } from 'vitest';
import { add, fromPack, hasEmptyBottle, overweight, packInc, packSlots, packWeight, refill, returnCooked, useSlot, weight } from './backpack';
import { newHiker } from './hiker';
import { buildWorld } from './world';
import { TRAILS } from '../data/trails';
import { defaultPack } from '../data/items';

const hiker = () => newHiker(buildWorld(TRAILS[0]));

describe('backpack', () => {
  it('default pack: 2 bottles, 2 sticky rice, jacket worn, 2.6 kg in 4 slots', () => {
    const bp = fromPack(defaultPack(), {});
    expect(bp.slots.map((s) => s.itemId)).toEqual(['water_bottle', 'water_bottle', 'sticky_rice', 'jacket']);
    expect(weight(bp)).toBeCloseTo(2.6, 5);
    expect(bp.wearing.body).toBe('jacket');
    expect(packSlots(defaultPack(), {})).toBe(4);
  });

  it('drinking empties a bottle, which still weighs 0.1 kg, until it is refilled', () => {
    const bp = fromPack({ water_bottle: 1 }, {}), h = hiker(); h.thirst = 50;
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_drink');
    expect(h.thirst).toBe(85);
    expect(weight(bp)).toBeCloseTo(0.1, 5);
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_empty');
    expect(hasEmptyBottle(bp)).toBe(true); refill(bp); expect(hasEmptyBottle(bp)).toBe(false);
  });

  it('coffee only brews while sitting, twice', () => {
    const bp = fromPack({ coffee_kit: 1 }, {}), h = hiker();
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_needSit');
    h.sitting = true;
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_coffee');
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_coffee');
    expect(bp.slots).toHaveLength(0);
  });

  it('jacket toggles on and off', () => {
    const bp = fromPack({ jacket: 1 }, {}), h = hiker();
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_unwear'); expect(bp.wearing.body).toBeNull();
    expect(useSlot(bp, 0, h)?.msg).toBe('msg_wear'); expect(bp.wearing.body).toBe('jacket');
  });

  it('stacks litter and stops at 12 slots', () => {
    const bp = fromPack({ water_bottle: 4, sticky_rice: 4, trail_mix: 3, jacket: 1, raincoat: 1, flashlight: 1, coffee_kit: 1 }, {});
    expect(bp.slots).toHaveLength(10);
    expect(add(bp, 'litter')).toBe(true); expect(add(bp, 'litter')).toBe(true);
    expect(bp.slots.find((s) => s.itemId === 'litter')?.qty).toBe(2);
    expect(add(bp, 'flashlight')).toBe(true);
    expect(add(bp, 'flashlight')).toBe(false); // 12 slots full
  });

  it('a full pack is over the 6 kg limit', () => {
    const pack = { water_bottle: 4, sticky_rice: 4, trail_mix: 3, jacket: 1, raincoat: 1, flashlight: 1, coffee_kit: 1 };
    expect(packWeight(pack, {})).toBeCloseTo(7.7, 5);
    expect(overweight(fromPack(pack, {}))).toBe(true);
  });

  it('packing respects item limits', () => {
    const pack: Record<string, number> = { water_bottle: 4 };
    expect(packInc(pack, 'water_bottle', {})).toBe(false);
    expect(packInc(pack, 'kaprao_rice', {})).toBe(false); // none cooked at camp
    expect(packInc(pack, 'kaprao_rice', { kaprao_rice: 1 })).toBe(true);
  });

  it('cooked food goes back to camp storage', () => {
    const st = { kaprao_rice: 2 }, bp = fromPack({ kaprao_rice: 2 }, st);
    returnCooked(bp, st);
    expect(st.kaprao_rice).toBe(4); // the scene removes packed food from storage when the hike starts
    expect(bp.slots).toHaveLength(0);
  });
});
