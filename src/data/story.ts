/**
 * NPC stories and seasonal events, as data. Text lives in src/i18n/story.ts.
 *
 * The NPCs are fictional camp residents. Real-place facts in their lines only repeat what is
 * already sourced in docs/knowledge/04-parks-data.md (and the trails' realData); everything
 * else is game fiction. Rewards are EXP, coins, seeds, titles and stamps: nothing that buys power.
 */
import type { QuestKind } from './camp';
import type { Look } from './looks';
import type { Season, WeatherId } from './trails';

/** What a chapter or event asks for. `trail` / `subject` / `crop` narrow the goal; `distinct` counts different subjects only. */
export interface StoryGoal { kind: QuestKind; count: number; trail?: string; subjects?: string[]; crop?: string }

export interface Chapter {
  id: string;
  goal: StoryGoal;
  minLevel?: number;
  exp: number;
  coins: number;
  items?: Record<string, number>;
}

export type NpcId = 'kham' | 'daeng' | 'fah';
export interface NpcDef { id: NpcId; x: number; y: number; face: 'down' | 'left' | 'right'; look: Look; icon: string; chapters: Chapter[]; titleId: string }

export const NPCS: NpcDef[] = [
  {
    // retired park ranger: Leave No Trace, staying on the trail, respecting the mountain
    id: 'kham', x: 6, y: 12, face: 'right', icon: '🧢', titleId: 'rangerFriend',
    look: { hairStyle: 'short', hair: '#d8d8e0', skin: '#c48a5e', face: 'calm', shirt: '#6b7a3a', shirtDark: '#525e2a', pants: '#5a4a3a', packColor: '#7a5a3a', pack: false, acc: 'cap', hat: 'cap', hatColor: '#4f6b3a' },
    chapters: [
      { id: 'kham1', goal: { kind: 'collectLitter', count: 5 }, exp: 40, coins: 20 },
      { id: 'kham2', goal: { kind: 'completeTrail', count: 1, trail: 'doi-inthanon-kew-mae-pan' }, exp: 60, coins: 30 },
      { id: 'kham3', goal: { kind: 'completeTrail', count: 1, trail: 'phu-kradueng-summit' }, minLevel: 3, exp: 100, coins: 50 },
    ],
  },
  {
    // runs a sticky-rice stall on the trails: cooking, the garden, sharing food
    id: 'daeng', x: 9, y: 8, face: 'left', icon: '🍙', titleId: 'campCook',
    look: { body: 'female', hairStyle: 'bun', hair: '#2b1d14', skin: '#e8bc94', face: 'smile', shirt: '#b8404e', shirtDark: '#8e2e3a', pants: '#2e2f3a', packColor: '#a8483a', pack: false, acc: 'none', hat: 'none', hatColor: '#d8b878' },
    chapters: [
      { id: 'daeng1', goal: { kind: 'cook', count: 2 }, exp: 40, coins: 20, items: { seed_kaprao: 2 } },
      { id: 'daeng2', goal: { kind: 'harvest', count: 3 }, exp: 60, coins: 30, items: { seed_strawberry: 2 } },
      { id: 'daeng3', goal: { kind: 'cook', count: 4 }, minLevel: 3, exp: 100, coins: 50 },
    ],
  },
  {
    // young nature photographer: light, patience, not disturbing wildlife
    id: 'fah', x: 17, y: 8, face: 'left', icon: '📷', titleId: 'lightChaser',
    look: { body: 'female', hairStyle: 'ponytail', hair: '#5a3a22', skin: '#f6d7b8', face: 'round', shirt: '#3b7dd8', shirtDark: '#2a5ea8', pants: '#4a4f5e', packColor: '#c0582a', pack: false, acc: 'glasses', hat: 'none', hatColor: '#d8b878' },
    chapters: [
      { id: 'fah1', goal: { kind: 'takePhoto', count: 3 }, exp: 40, coins: 20 },
      { id: 'fah2', goal: { kind: 'takePhoto', count: 1, subjects: ['seaOfMist', 'tonKloiMist'] }, exp: 70, coins: 30 },
      { id: 'fah3', goal: { kind: 'takePhoto', count: 1, subjects: ['hornbill', 'sunbird'] }, minLevel: 3, exp: 100, coins: 50 },
    ],
  },
];

export interface EventDef {
  id: 'mistFestival' | 'hikeFestival' | 'plantingSeason';
  icon: string;
  season: Season;
  /** days of the season it runs (1–7) */
  from: number; to: number;
  goals: StoryGoal[];
  /** more of a weather on these regions' trails while it runs */
  weather?: { id: WeatherId; mult: number; regions?: string[] };
  /** photo EXP multiplier for these subjects while it runs */
  photo?: { subjects: string[]; mult: number };
  exp: number; coins: number;
}

export const EVENTS_DEF: EventDef[] = [
  {
    id: 'mistFestival', icon: '☁️', season: 'cool', from: 2, to: 6,
    goals: [{ kind: 'takePhoto', count: 3 }, { kind: 'completeTrail', count: 1 }],
    weather: { id: 'fog', mult: 2, regions: ['north', 'northeast'] },
    photo: { subjects: ['seaOfMist', 'tonKloiMist', 'view'], mult: 2 },
    exp: 80, coins: 40,
  },
  {
    id: 'hikeFestival', icon: '🥾', season: 'hot', from: 2, to: 6,
    goals: [{ kind: 'completeTrail', count: 2 }, { kind: 'collectLitter', count: 6 }],
    exp: 100, coins: 50,
  },
  {
    id: 'plantingSeason', icon: '🌱', season: 'rain', from: 1, to: 5,
    goals: [{ kind: 'plant', count: 4 }, { kind: 'harvest', count: 2 }],
    photo: { subjects: ['erawan1', 'erawan2', 'erawan3', 'erawan4', 'erawan5', 'erawan6', 'erawan7', 'bangHuaRaet', 'wingHin', 'tonKloi'], mult: 1.5 },
    exp: 80, coins: 40,
  },
];
