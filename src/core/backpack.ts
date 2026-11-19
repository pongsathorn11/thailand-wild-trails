/**
 * Backpack: 12 slots, 6 kg comfort limit. Pure rules; the scene shows the messages it returns.
 * `storage` is camp storage (cooked food comes from there and goes back after the hike).
 */
import { CONFIG } from './config';
import { clamp } from './rng';
import { COOKED, ITEMS, PACK_ORDER } from '../data/items';
import type { Hiker } from './hiker';

export interface Slot { itemId: string; qty: number; full?: boolean; charges?: number }
export interface Backpack { slots: Slot[]; wearing: { body: string | null; rain: string | null } }
export type Storage = Record<string, number>;

export const storeQty = (st: Storage, id: string): number => st[id] || 0;
/** Items offered on the packing screen: basics always, cooked food only if camp has some. */
export const packIds = (st: Storage): string[] => PACK_ORDER.concat(COOKED.filter((id) => storeQty(st, id) > 0));
export const packMax = (id: string, st: Storage): number => (COOKED.includes(id) ? storeQty(st, id) : ITEMS[id].packMax ?? 0);

export function fromPack(pack: Record<string, number>, st: Storage): Backpack {
  const slots: Slot[] = [];
  for (const id of packIds(st)) {
    const n = Math.min(pack[id] || 0, packMax(id, st)), def = ITEMS[id];
    if (!n) continue;
    if (def.stack === 1) for (let i = 0; i < n; i++) slots.push({ itemId: id, qty: 1, full: id === 'water_bottle' ? true : undefined, charges: def.charges });
    else slots.push({ itemId: id, qty: n });
  }
  const bp: Backpack = { slots, wearing: { body: null, rain: null } };
  if (has(bp, 'jacket')) bp.wearing.body = 'jacket';
  return bp;
}

export const slotWeight = (s: Slot): number => { const d = ITEMS[s.itemId]; return (s.itemId === 'water_bottle' && !s.full ? d.emptyKg! : d.weightKg ?? 0) * s.qty; };
export const weight = (bp: Backpack): number => bp.slots.reduce((w, s) => w + slotWeight(s), 0);
export const overweight = (bp: Backpack): boolean => weight(bp) > CONFIG.MAX_WEIGHT_KG;
export const has = (bp: Backpack, id: string): boolean => bp.slots.some((s) => s.itemId === id);
export const hasEmptyBottle = (bp: Backpack): boolean => bp.slots.some((s) => s.itemId === 'water_bottle' && !s.full);
export const refill = (bp: Backpack): void => { for (const s of bp.slots) if (s.itemId === 'water_bottle') s.full = true; };

export const packWeight = (pack: Record<string, number>, st: Storage): number =>
  packIds(st).reduce((w, id) => w + (ITEMS[id].weightKg ?? 0) * Math.min(pack[id] || 0, packMax(id, st)), 0);
export const packSlots = (pack: Record<string, number>, st: Storage): number =>
  packIds(st).reduce((n, id) => { const q = Math.min(pack[id] || 0, packMax(id, st)); return n + (!q ? 0 : ITEMS[id].stack === 1 ? q : 1); }, 0);

/** One more of `id` on the packing screen, if it fits the item limit and the 12 slots. */
export function packInc(pack: Record<string, number>, id: string, st: Storage): boolean {
  const cur = pack[id] || 0, next = Math.min(packMax(id, st), cur + 1);
  const extraSlot = ITEMS[id].stack === 1 || !cur;
  if (next > cur && (!extraSlot || packSlots(pack, st) < CONFIG.MAX_SLOTS)) { pack[id] = next; return true; }
  return false;
}

export function add(bp: Backpack, id: string, qty = 1): boolean {
  const def = ITEMS[id];
  if ((def.stack ?? 1) > 1) {
    const s = bp.slots.find((x) => x.itemId === id && x.qty < def.stack!);
    if (s) { s.qty = Math.min(def.stack!, s.qty + qty); return true; }
  }
  if (bp.slots.length >= CONFIG.MAX_SLOTS) return false;
  bp.slots.push({ itemId: id, qty: (def.stack ?? 1) > 1 ? qty : 1, full: id === 'water_bottle' ? true : undefined, charges: def.charges });
  return true;
}

export interface UseResult { msg: string; vars?: Record<string, string>; sound?: 'drink' | 'eat' | 'error' | 'blip' }

/** Uses the item in slot `i` (wear/remove, drink, eat, brew coffee). Returns the message to show, or null. */
export function useSlot(bp: Backpack, i: number, h: Hiker, cookingBonus = 0): UseResult | null {
  const s = bp.slots[i];
  if (!s) return null;
  const def = ITEMS[s.itemId], name = 'item_' + s.itemId;
  if (def.wearable) {
    const slot = def.wearable.slot;
    if (bp.wearing[slot] === s.itemId) { bp.wearing[slot] = null; return { msg: 'msg_unwear', vars: { s: name }, sound: 'blip' }; }
    bp.wearing[slot] = s.itemId; return { msg: 'msg_wear', vars: { s: name }, sound: 'blip' };
  }
  if (def.passive || !def.effects) return null;
  let res: UseResult;
  if (s.itemId === 'water_bottle') {
    if (!s.full) return { msg: 'msg_empty', sound: 'error' };
    s.full = false; res = { msg: 'msg_drink', sound: 'drink' };
  } else if (def.needSit) {
    if (!h.sitting) return { msg: 'msg_needSit', sound: 'error' };
    s.charges = (s.charges ?? 1) - 1; if (s.charges <= 0) bp.slots.splice(i, 1);
    res = { msg: 'msg_coffee', sound: 'drink' };
  } else {
    s.qty--; if (s.qty <= 0) bp.slots.splice(i, 1);
    res = s.itemId === 'sticky_rice' ? { msg: 'msg_eat', sound: 'eat' } : { msg: 'msg_used', vars: { s: name }, sound: def.effects.thirst && !def.effects.hunger ? 'drink' : 'eat' };
  }
  const e = def.effects, k = COOKED.includes(s.itemId) ? 1 + cookingBonus : 1;
  if (e.thirst) h.thirst = clamp(h.thirst + e.thirst * k, 0, 100);
  if (e.hunger) h.hunger = clamp(h.hunger + e.hunger * k, 0, 100);
  if (e.stamina) h.stamina = clamp(h.stamina + e.stamina * k, 0, h.thirst <= 0 ? 50 : 100);
  if (e.warmth) h.warmth = clamp(h.warmth + e.warmth * k, 0, 100);
  return res;
}

/** Cooked food not eaten on the hike goes back to camp storage. */
export function returnCooked(bp: Backpack, st: Storage): void {
  for (const s of bp.slots) if (COOKED.includes(s.itemId)) st[s.itemId] = (st[s.itemId] || 0) + s.qty;
  bp.slots = bp.slots.filter((s) => !COOKED.includes(s.itemId));
}
