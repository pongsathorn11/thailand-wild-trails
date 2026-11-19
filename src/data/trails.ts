/**
 * Trail definitions. `realData` holds real-world facts (sources in docs/knowledge/04-parks-data.md);
 * everything else is game layout: condensed, partly fictional, and marked as such in that file.
 * `gen` describes how the 64×48 tile map is generated, so a new trail needs data only.
 */
import { T, type TileId } from './terrain';

export type Region = 'north' | 'northeast' | 'central' | 'east' | 'west' | 'south';
export type Season = 'cool' | 'hot' | 'rain';
export type WeatherId = 'clear' | 'fog' | 'drizzle';

export interface ZoneDef { base: [TileId, TileId]; baseP: number; tree: 'broad' | 'pine'; density: number }
export interface RareShot { subject: string; weather?: WeatherId; hourFrom?: number; hourTo?: number }
export interface Poi {
  id: string;
  type: 'sign' | 'npc' | 'bench' | 'viewpoint' | 'photo' | 'secret' | 'item' | 'goal' | 'stall' | 'waterfall';
  x: number; y: number;
  subject?: string; prop?: string; item?: string; nameKey?: string; linesKey?: string; n?: number;
  seasons?: Season[]; seasonMsg?: string; photo?: string; rare?: RareShot;
}
export interface Decor { type: 'falls' | 'karst'; x: number; y: number }
export interface TrailDef {
  id: string; parkId: string; parkKey: string; trailKey: string;
  region: Region; difficulty: number; diffKey: string; realInfoKey: string;
  realData: { distanceKm: number; elevationM: number | null; verified: boolean; source: string; tiers?: number };
  unlock: { level: number; trail: string } | null;
  startHour: number; climateC: number; swim?: boolean; ambient?: 'gibbon';
  weatherChances?: Record<WeatherId, number>;
  checkpointId: string | null; goalId: string;
  objKeys: { checkpoint: string | null; goal: string };
  stampKeys: [string, string]; signKey: string;
  waypoints: [number, number][]; steepSegments: [number, number][];
  extraPaths?: { pts: [number, number][]; steep?: boolean }[];
  start: [number, number];
  gen: {
    seed: number; waterBase?: string;
    zoneAt: (x: number, y: number) => string;
    water: (x: number, y: number) => boolean;
    rock: (x: number, y: number) => boolean;
    zones: Record<string, ZoneDef>;
  };
  decor?: Decor[];
  pois: Poi[];
  litterCount: number;
  bird: { kind?: 'hornbill'; subject?: string; home: [number, number]; fleeSpots: [number, number][] } | null;
}

const kmpStreamX = (y: number) => 27 + Math.round(1.6 * Math.sin(y * 0.22));
const erawanStreamX = (y: number) => 29 + Math.round(1.2 * Math.sin(y * 0.3));
export const ERAWAN_TIERS = [42, 36, 30, 24, 18, 12, 6];
const ksRiverY = (x: number) => 25 + Math.round(2 * Math.sin(x * 0.13));
const KS_KARSTS: [number, number][] = [[8, 4], [20, 3], [33, 5], [47, 3], [60, 9], [12, 43], [28, 44], [52, 42]];

export const TRAILS: TrailDef[] = [
  {
    id: 'doi-inthanon-kew-mae-pan', parkId: 'doi-inthanon', parkKey: 'park_inthanon', trailKey: 'trail_kmp',
    region: 'north', difficulty: 1, diffKey: 'diff_1', realInfoKey: 'real_info',
    realData: { distanceKm: 3, elevationM: 2200, verified: false, source: '04-parks-data.md' },
    unlock: null, startHour: 6, climateC: 0,
    checkpointId: 'view', goalId: 'goal', objKeys: { checkpoint: 'obj_view', goal: 'obj_goal' },
    stampKeys: ['stamp_top', 'stamp_bottom'], signKey: 'sign_start',
    waypoints: [[8, 42], [9, 36], [13, 30], [18, 24], [23, 19], [27, 17], [31, 15], [36, 11], [42, 8], [48, 7],
      [54, 10], [56, 16], [53, 21], [48, 26], [44, 31], [38, 36], [30, 40], [22, 42], [15, 43], [10, 43]],
    steepSegments: [[5, 9]],
    start: [8, 43],
    gen: {
      seed: 20261118,
      zoneAt: (x) => (x < 30 ? 'forest' : 'ridge'),
      water: (x, y) => x === kmpStreamX(y) || x === kmpStreamX(y) + 1,
      rock: (x, y) => (x >= 32 && y <= 2) || (x >= 30 && y <= 1),
      zones: {
        forest: { base: [T.MOSS, T.GRASS], baseP: 0.8, tree: 'broad', density: 0.3 },
        ridge: { base: [T.TALL, T.GRASS], baseP: 0.75, tree: 'pine', density: 0.05 },
      },
    },
    pois: [
      { id: 'start', type: 'sign', x: 6, y: 42 },
      { id: 'guide', type: 'npc', x: 11, y: 42 },
      { id: 'rest1', type: 'bench', x: 20, y: 23 },
      { id: 'rest2', type: 'bench', x: 46, y: 29 },
      { id: 'view', type: 'viewpoint', x: 48, y: 6, subject: 'view', rare: { subject: 'seaOfMist', weather: 'fog', hourTo: 9 } },
      { id: 'rhodo', type: 'photo', x: 55, y: 20, subject: 'rhodo', prop: 'rhodo' },
      { id: 'moss', type: 'photo', x: 15, y: 27, subject: 'moss', prop: 'moss' },
      { id: 'secret', type: 'secret', x: 33, y: 5, subject: 'secret' },
      { id: 'flashlight', type: 'item', x: 24, y: 21, item: 'flashlight' },
      { id: 'goal', type: 'goal', x: 13, y: 42 },
    ],
    litterCount: 5,
    bird: { home: [36, 24], fleeSpots: [[36, 24], [41, 35], [20, 35], [50, 15], [33, 30]] },
  },
  {
    id: 'phu-kradueng-summit', parkId: 'phu-kradueng', parkKey: 'park_phukradueng', trailKey: 'trail_pkd',
    region: 'northeast', difficulty: 3, diffKey: 'diff_3', realInfoKey: 'real_info_pkd',
    realData: { distanceKm: 5.5, elevationM: null, verified: false, source: '04-parks-data.md' },
    unlock: { level: 2, trail: 'doi-inthanon-kew-mae-pan' }, startHour: 7, climateC: 4,
    checkpointId: null, goalId: 'lomsak', objKeys: { checkpoint: null, goal: 'obj_goal_pkd' },
    stampKeys: ['stamp_top_pkd', 'stamp_bottom_pkd'], signKey: 'sign_pkd',
    waypoints: [[8, 45], [14, 42], [9, 38], [15, 34], [10, 30], [16, 26], [12, 22], [20, 20], [24, 17], [32, 14], [40, 12], [48, 9], [55, 6]],
    steepSegments: [[0, 6]],
    start: [7, 45],
    gen: {
      seed: 20261119,
      zoneAt: (_x, y) => (y >= 25 ? 'climb' : 'plateau'),
      water: (x, y) => ((x - 27) / 3.2) ** 2 + ((y - 20) / 2.2) ** 2 <= 1,
      rock: (x, y) => (y <= 2 && x >= 40) || x >= 62 || ((y === 23 || y === 24) && !(x >= 10 && x <= 17)),
      zones: {
        climb: { base: [T.MOSS, T.GRASS], baseP: 0.6, tree: 'broad', density: 0.32 },
        plateau: { base: [T.TALL, T.GRASS], baseP: 0.6, tree: 'pine', density: 0.09 },
      },
    },
    pois: [
      { id: 'start', type: 'sign', x: 5, y: 45 },
      { id: 'stall1', type: 'stall', x: 10, y: 46, nameKey: 'stall_sam1' },
      { id: 'stall2', type: 'stall', x: 7, y: 37, nameKey: 'stall_sam2' },
      { id: 'rest1', type: 'bench', x: 17, y: 33 },
      { id: 'stall3', type: 'stall', x: 18, y: 27, nameKey: 'stall_sam3' },
      { id: 'langpae', type: 'viewpoint', x: 11, y: 21, subject: 'langpae' },
      { id: 'rest2', type: 'bench', x: 24, y: 16 },
      { id: 'pine', type: 'photo', x: 36, y: 15, subject: 'pine', prop: 'bigPine' },
      { id: 'maple', type: 'photo', x: 44, y: 12, subject: 'maple', prop: 'maple', seasons: ['cool'] },
      { id: 'secret', type: 'secret', x: 30, y: 6, subject: 'secretPkd' },
      { id: 'mix', type: 'item', x: 20, y: 36, item: 'trail_mix' },
      { id: 'lomsak', type: 'goal', x: 55, y: 5, photo: 'lomsak', rare: { subject: 'sunsetLomsak', hourFrom: 17, hourTo: 18.8 } },
    ],
    litterCount: 6,
    bird: null,
  },
  {
    id: 'erawan-waterfall', parkId: 'erawan', parkKey: 'park_erawan', trailKey: 'trail_erawan',
    region: 'west', difficulty: 2, diffKey: 'diff_2', realInfoKey: 'real_info_erawan',
    realData: { distanceKm: 1.5, elevationM: null, tiers: 7, verified: false, source: '04-parks-data.md' },
    unlock: { level: 2, trail: 'doi-inthanon-kew-mae-pan' }, startHour: 8, climateC: 12, swim: true,
    checkpointId: null, goalId: 'tier7', objKeys: { checkpoint: null, goal: 'obj_goal_erawan' },
    stampKeys: ['stamp_top_erawan', 'stamp_bottom_erawan'], signKey: 'sign_erawan',
    waypoints: [[37, 46], [36, 42], [37, 36], [35, 30], [36, 24], [35, 18], [35, 12], [35, 7]],
    steepSegments: [[3, 7]],
    start: [37, 46],
    gen: {
      seed: 20261120, waterBase: '#3fb0a0',
      zoneAt: (_x, y) => (y >= 27 ? 'lower' : 'upper'),
      water: (x, y) => {
        const sx = erawanStreamX(y);
        if (x === sx || x === sx + 1) return true;
        return ERAWAN_TIERS.some((ty) => ((x - sx - 0.5) / 3) ** 2 + ((y - ty) / 1.6) ** 2 <= 1);
      },
      rock: (x, y) => ERAWAN_TIERS.some((ty) => y === ty - 2 && Math.abs(x - erawanStreamX(y) - 0.5) <= 3.5 && x !== erawanStreamX(y) && x !== erawanStreamX(y) + 1),
      zones: {
        lower: { base: [T.MOSS, T.GRASS], baseP: 0.6, tree: 'broad', density: 0.3 },
        upper: { base: [T.MOSS, T.GRASS], baseP: 0.8, tree: 'broad', density: 0.34 },
      },
    },
    decor: ERAWAN_TIERS.map((ty) => ({ type: 'falls' as const, x: erawanStreamX(ty - 2), y: ty - 1 })),
    pois: [
      { id: 'start', type: 'sign', x: 39, y: 46 },
      ...ERAWAN_TIERS.slice(0, 6).map((ty, i): Poi => ({ id: 'tier' + (i + 1), type: 'waterfall', x: 34, y: ty, subject: 'erawan' + (i + 1), n: i + 1 })),
      { id: 'rest1', type: 'bench', x: 38, y: 33 },
      { id: 'rest2', type: 'bench', x: 37, y: 15 },
      { id: 'stall1', type: 'stall', x: 40, y: 44, nameKey: 'stall_erawan' },
      { id: 'secret', type: 'secret', x: 45, y: 21, subject: 'secretErawan' },
      { id: 'tier7', type: 'goal', x: 35, y: 6, photo: 'erawan7', rare: { subject: 'erawanRainbow', weather: 'clear', hourFrom: 10, hourTo: 14 } },
    ],
    litterCount: 6,
    bird: null,
  },
  {
    id: 'khao-sok-ton-kloi', parkId: 'khao-sok', parkKey: 'park_khaosok', trailKey: 'trail_khaosok',
    region: 'south', difficulty: 3, diffKey: 'diff_3', realInfoKey: 'real_info_khaosok',
    realData: { distanceKm: 9, elevationM: null, verified: false, source: '04-parks-data.md' },
    unlock: { level: 3, trail: 'erawan-waterfall' }, startHour: 7, climateC: 10, swim: true,
    weatherChances: { clear: 0.35, fog: 0.15, drizzle: 0.5 }, ambient: 'gibbon',
    checkpointId: null, goalId: 'tonkloi', objKeys: { checkpoint: null, goal: 'obj_goal_khaosok' },
    stampKeys: ['stamp_top_khaosok', 'stamp_bottom_khaosok'], signKey: 'sign_khaosok',
    waypoints: [[4, 19], [10, 18], [16, 18], [22, 19], [28, 18], [34, 18], [40, 17], [46, 17], [52, 18], [55, 19]],
    steepSegments: [[6, 9]],
    extraPaths: [{ pts: [[34, 19], [35, 24], [35, 30], [38, 35], [41, 38]], steep: true }],
    start: [4, 19],
    gen: {
      seed: 20261121, waterBase: '#3a8a88',
      zoneAt: (x) => (x >= 40 ? 'karst' : 'rainforest'),
      water: (x, y) => {
        const ry = ksRiverY(x);
        if (y >= ry && y <= ry + 2 && x < 56) return true;
        return ((x - 58.5) / 3.5) ** 2 + ((y - 25) / 2.5) ** 2 <= 1;
      },
      rock: (x, y) => y <= 1 || y >= 46 || (x >= 57 && y >= 18 && y <= 21) || KS_KARSTS.some(([kx, ky]) => Math.hypot(x - kx, (y - ky) * 0.8) < 2.6),
      zones: {
        rainforest: { base: [T.MOSS, T.GRASS], baseP: 0.85, tree: 'broad', density: 0.38 },
        karst: { base: [T.MOSS, T.GRASS], baseP: 0.7, tree: 'broad', density: 0.3 },
      },
    },
    decor: [
      { type: 'falls', x: 11, y: ksRiverY(11) - 1 }, { type: 'falls', x: 29, y: ksRiverY(29) - 1 }, { type: 'falls', x: 57, y: 22 },
      ...KS_KARSTS.map(([x, y]) => ({ type: 'karst' as const, x, y })),
    ],
    pois: [
      { id: 'start', type: 'sign', x: 6, y: 17 },
      { id: 'stall1', type: 'stall', x: 3, y: 16, nameKey: 'stall_khaosok' },
      { id: 'falls1', type: 'waterfall', x: 12, y: 21, subject: 'bangHuaRaet', n: 1 },
      { id: 'rest1', type: 'bench', x: 20, y: 16 },
      { id: 'falls2', type: 'waterfall', x: 30, y: 21, subject: 'wingHin', n: 2 },
      { id: 'guide', type: 'npc', x: 33, y: 21, linesKey: 'guide_khaosok' },
      { id: 'karst', type: 'viewpoint', x: 44, y: 15, subject: 'karstView' },
      { id: 'rafflesia', type: 'photo', x: 42, y: 38, subject: 'rafflesia', prop: 'rafflesia', seasons: ['cool', 'hot'], seasonMsg: 'msg_rafflesiaSeason' },
      { id: 'secret', type: 'secret', x: 24, y: 34, subject: 'secretKhaosok' },
      { id: 'rest2', type: 'bench', x: 48, y: 15 },
      { id: 'tonkloi', type: 'goal', x: 55, y: 20, photo: 'tonKloi', rare: { subject: 'tonKloiMist', weather: 'fog', hourTo: 10 } },
    ],
    litterCount: 6,
    bird: { kind: 'hornbill', subject: 'hornbill', home: [26, 12], fleeSpots: [[26, 12], [40, 10], [14, 12], [50, 12], [36, 9]] },
  },
];

export const trailById = (id: string): TrailDef | undefined => TRAILS.find((t) => t.id === id);
