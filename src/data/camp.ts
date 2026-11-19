/** Camp content (same values as the prototype). */
import type { Season } from './trails';

export const CAMP = {
  W: 20, H: 15, start: [3, 12] as [number, number],
  fixed: [
    { id: 'tent', type: 'tent', x: 4, y: 4 },
    { id: 'fire', type: 'campfire', x: 7, y: 8 },
    { id: 'board', type: 'board', x: 13, y: 3 },
    { id: 'mailbox', type: 'mailbox', x: 16, y: 3 },
    { id: 'trail', type: 'trailSign', x: 4, y: 13 },
  ] as { id: string; type: 'tent' | 'campfire' | 'board' | 'mailbox' | 'trailSign'; x: number; y: number }[],
  plots: [[13, 8], [14, 8], [15, 8], [13, 9], [14, 9], [15, 9]] as [number, number][],
  paths: [[2, 10, 3, 14], [2, 10, 11, 10], [10, 5, 11, 10], [10, 5, 17, 5], [4, 5, 10, 6]] as [number, number, number, number][],
};

export interface CropDef { seed: string; produce: string; days: number; yield: number; seasons: Season[]; leaf: string; fruit: string }
export const CROPS: Record<string, CropDef> = {
  kaprao: { seed: 'seed_kaprao', produce: 'kaprao', days: 2, yield: 2, seasons: ['cool', 'hot', 'rain'], leaf: '#3f8a3a', fruit: '#2f6b2f' },
  chili: { seed: 'seed_chili', produce: 'chili', days: 3, yield: 3, seasons: ['hot', 'rain'], leaf: '#4a9036', fruit: '#d8343f' },
  strawberry: { seed: 'seed_strawberry', produce: 'strawberry', days: 4, yield: 3, seasons: ['cool'], leaf: '#3c8044', fruit: '#e8414f' },
};

export const RECIPES = [
  { id: 'kaprao_rice', needs: { kaprao: 2 } as Record<string, number> },
  { id: 'strawberry_juice', needs: { strawberry: 2 } as Record<string, number> },
  { id: 'chili_dip', needs: { chili: 2 } as Record<string, number> },
];

/** Mail-order catalog: seeds and decorations only (no Pay-to-Win). */
export const CATALOG = [
  { id: 'seed_kaprao', price: 5, level: 1 },
  { id: 'seed_chili', price: 8, level: 1 },
  { id: 'seed_strawberry', price: 12, level: 2 },
  { id: 'flower_pot', price: 15, level: 1 },
  { id: 'wood_bench', price: 30, level: 1 },
  { id: 'lantern', price: 25, level: 2 },
  { id: 'rock_garden', price: 40, level: 2 },
  { id: 'hammock', price: 60, level: 3 },
];
export const FURNITURE = ['wood_bench', 'flower_pot', 'lantern', 'hammock', 'rock_garden'];

export type QuestKind = 'completeTrail' | 'takePhoto' | 'collectLitter' | 'harvest' | 'cook' | 'plant' | 'placeFurniture';
export const QUEST_POOL: { id: string; kind: QuestKind; count: number; exp: number; coins: number }[] = [
  { id: 'hike', kind: 'completeTrail', count: 1, exp: 40, coins: 20 },
  { id: 'photo3', kind: 'takePhoto', count: 3, exp: 25, coins: 10 },
  { id: 'litter3', kind: 'collectLitter', count: 3, exp: 25, coins: 15 },
  { id: 'harvest2', kind: 'harvest', count: 2, exp: 20, coins: 10 },
  { id: 'cook1', kind: 'cook', count: 1, exp: 20, coins: 10 },
  { id: 'plant3', kind: 'plant', count: 3, exp: 15, coins: 8 },
  { id: 'decorate', kind: 'placeFurniture', count: 1, exp: 15, coins: 5 },
];
