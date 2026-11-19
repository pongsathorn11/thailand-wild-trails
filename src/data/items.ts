/** Items (same values as the prototype). weightKg for a water bottle is when full; emptyKg when empty. */
export interface ItemDef {
  icon: string;
  weightKg?: number;
  emptyKg?: number;
  stack?: number;
  charges?: number;
  needSit?: boolean;
  passive?: boolean;
  effects?: { thirst?: number; hunger?: number; stamina?: number; warmth?: number };
  wearable?: { slot: 'body' | 'rain'; warmthC?: number; auto?: boolean };
  packMax?: number;
  packDefault?: number;
  category?: 'seed' | 'produce' | 'cooked' | 'furniture';
}

export const ITEMS: Record<string, ItemDef> = {
  water_bottle: { icon: '💧', weightKg: 0.6, emptyKg: 0.1, stack: 1, effects: { thirst: 35 }, packMax: 4, packDefault: 2 },
  sticky_rice: { icon: '🍙', weightKg: 0.3, stack: 4, effects: { hunger: 40 }, packMax: 4, packDefault: 2 },
  trail_mix: { icon: '🥜', weightKg: 0.2, stack: 4, effects: { hunger: 15, stamina: 30 }, packMax: 3, packDefault: 0 },
  jacket: { icon: '🧥', weightKg: 0.8, stack: 1, wearable: { slot: 'body', warmthC: 10 }, packMax: 1, packDefault: 1 },
  raincoat: { icon: '☔', weightKg: 0.5, stack: 1, wearable: { slot: 'rain', auto: true }, packMax: 1, packDefault: 0 },
  flashlight: { icon: '🔦', weightKg: 0.4, stack: 1, passive: true, packMax: 1, packDefault: 0 },
  coffee_kit: { icon: '☕', weightKg: 1.8, stack: 1, charges: 2, needSit: true, effects: { warmth: 45, stamina: 40 }, packMax: 1, packDefault: 0 },
  litter: { icon: '🗑️', weightKg: 0.15, stack: 10, packMax: 0 },
  // made at camp (M4); packed from camp storage
  kaprao_rice: { icon: '🍛', weightKg: 0.4, stack: 4, effects: { hunger: 60, stamina: 20 }, category: 'cooked' },
  strawberry_juice: { icon: '🧃', weightKg: 0.4, stack: 4, effects: { thirst: 30, stamina: 25 }, category: 'cooked' },
  chili_dip: { icon: '🥣', weightKg: 0.2, stack: 4, effects: { hunger: 25, warmth: 30 }, category: 'cooked' },
  seed_kaprao: { icon: '🌱', category: 'seed' },
  seed_chili: { icon: '🌱', category: 'seed' },
  seed_strawberry: { icon: '🌱', category: 'seed' },
  kaprao: { icon: '🌿', category: 'produce' },
  chili: { icon: '🌶️', category: 'produce' },
  strawberry: { icon: '🍓', category: 'produce' },
  wood_bench: { icon: '🪑', category: 'furniture' },
  flower_pot: { icon: '🪴', category: 'furniture' },
  lantern: { icon: '🏮', category: 'furniture' },
  hammock: { icon: '🏕️', category: 'furniture' },
  rock_garden: { icon: '🪨', category: 'furniture' },
};

export const PACK_ORDER = ['water_bottle', 'sticky_rice', 'trail_mix', 'jacket', 'raincoat', 'flashlight', 'coffee_kit'];
export const COOKED = ['kaprao_rice', 'strawberry_juice', 'chili_dip'];
export const defaultPack = (): Record<string, number> => Object.fromEntries(PACK_ORDER.map((id) => [id, ITEMS[id].packDefault ?? 0]));
