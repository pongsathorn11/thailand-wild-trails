/**
 * Long-term progress (same rules as the prototype): skill tree, achievements with tiers,
 * ranks from achievement points, medals, and titles shown above the hiker's head.
 */
import type { Profile } from './profile';
import { levelInfo, trailDone } from './camp';
import { TRAILS, type Region } from '../data/trails';
import { storyComplete } from './story';

type Any = Record<string, any>;
const A = (p: Profile) => p as Any;

// ---------- skills ----------
export const SKILLS = [
  { id: 'hiking', icon: '🥾', max: 3, per: 0.1 },       // stamina drain −10%/rank
  { id: 'survival', icon: '🧭', max: 3, per: 0.1 },     // hunger & thirst −10%/rank
  { id: 'camping', icon: '⛺', max: 3, per: 0.25 },     // rest regen +25%/rank
  { id: 'cooking', icon: '🍳', max: 3, per: 0.15 },     // cooked food +15%/rank
  { id: 'gardening', icon: '🌱', max: 3, per: 1 },      // harvest +1/rank
  { id: 'exploration', icon: '🔭', max: 3, per: 1 },    // map reveal +1 tile/rank, secrets seen from farther
  { id: 'photography', icon: '📷', max: 3, per: 0.2 },  // photo EXP +20%/rank
  { id: 'social', icon: '🤝', max: 3, per: 0.1, locked: true }, // multiplayer (M8)
] as const;
export type SkillId = (typeof SKILLS)[number]['id'];

export const skillRank = (p: Profile, id: SkillId): number => A(p).skills?.[id] || 0;
export const skillBonus = (p: Profile, id: SkillId): number => skillRank(p, id) * SKILLS.find((s) => s.id === id)!.per;
export const skillValue = (id: SkillId, rank: number): number => { const s = SKILLS.find((x) => x.id === id)!; return s.per < 1 ? Math.round(s.per * rank * 100) : s.per * rank; };
export const skillPoints = (p: Profile): number => Math.max(0, levelInfo(p.exp).level - 1 - Object.values(A(p).skills ?? {}).reduce((a: number, b: any) => a + b, 0));
export function upgradeSkill(p: Profile, id: SkillId): 'ok' | 'locked' | 'max' | 'points' {
  const s = SKILLS.find((x) => x.id === id)!;
  if ('locked' in s && s.locked) return 'locked';
  if (skillRank(p, id) >= s.max) return 'max';
  if (skillPoints(p) <= 0) return 'points';
  (A(p).skills ??= {})[id] = skillRank(p, id) + 1;
  return 'ok';
}

// ---------- achievements, ranks ----------
export const TIERS = [
  { id: 'bronze', icon: '🥉', coins: 10, pts: 1 }, { id: 'silver', icon: '🥈', coins: 25, pts: 2 },
  { id: 'gold', icon: '🥇', coins: 50, pts: 3 }, { id: 'platinum', icon: '💎', coins: 100, pts: 5 },
];
const album = (p: Profile): { subjectId: string }[] => A(p).album ?? [];
const hasAlbum = (p: Profile, id: string) => album(p).some((a) => a.subjectId === id);
const stats = (p: Profile): Any => A(p).stats ?? {};
export const ACHIEVEMENTS: { id: string; icon: string; value: (p: Profile) => number; tiers: number[] }[] = [
  { id: 'trails', icon: '🥾', value: (p) => stats(p).trailsCompleted || 0, tiers: [1, 10, 25, 50] },
  { id: 'distance', icon: '📏', value: (p) => stats(p).totalDistanceKm || 0, tiers: [3, 30, 100, 300] },
  { id: 'parks', icon: '🛂', value: (p) => Object.values(A(p).passport ?? {}).filter((x: any) => x.stamped).length, tiers: [1, 2, 4] },
  { id: 'photos', icon: '📷', value: (p) => album(p).length, tiers: [3, 10, 18, 30] },
  { id: 'litter', icon: '🗑️', value: (p) => stats(p).litterCollected || 0, tiers: [5, 25, 75, 150] },
  { id: 'harvest', icon: '🌱', value: (p) => stats(p).harvests || 0, tiers: [1, 10, 30, 60] },
  { id: 'cook', icon: '🍳', value: (p) => stats(p).cooked || 0, tiers: [1, 10, 25, 50] },
  { id: 'decorate', icon: '🪴', value: (p) => A(p).camp?.placed?.length || 0, tiers: [1, 3, 6, 10] },
  { id: 'secrets', icon: '✨', value: (p) => album(p).filter((a) => ['secret', 'secretPkd', 'secretErawan', 'secretKhaosok', 'secretHaewNarok', 'secretChamao'].includes(a.subjectId)).length, tiers: [1, 2, 4] },
  { id: 'level', icon: '⭐', value: (p) => levelInfo(p.exp).level, tiers: [2, 5, 8, 12] },
];
export const RANKS: [string, number][] = [
  ['rookie', 0], ['beginner', 3], ['trailWalker', 8], ['natureExplorer', 15],
  ['mountainAdventurer', 24], ['professionalHiker', 34], ['masterExplorer', 46], ['legendaryRanger', 60],
];
export const achTier = (p: Profile, id: string): number => A(p).achievements?.[id]?.tier ?? -1;
export const achPoints = (p: Profile): number => ACHIEVEMENTS.reduce((s, a) => { let x = 0; for (let i = 0; i <= achTier(p, a.id); i++) x += TIERS[i].pts; return s + x; }, 0);
export const rankIndex = (p: Profile): number => { const pts = achPoints(p); let r = 0; RANKS.forEach(([, need], i) => { if (pts >= need) r = i; }); return r; };

// ---------- titles, medals ----------
export const ERAWAN_PHOTOS = ['erawan1', 'erawan2', 'erawan3', 'erawan4', 'erawan5', 'erawan6', 'erawan7'];
export const TITLES: { id: string; cond: (p: Profile) => boolean }[] = [
  { id: 'newbie', cond: () => true },
  { id: 'forestExplorer', cond: (p) => achTier(p, 'trails') >= 1 },
  { id: 'mountainConqueror', cond: (p) => trailDone(p, 'phu-kradueng-summit') },
  { id: 'waterfallHunter', cond: (p) => ERAWAN_PHOTOS.every((id) => hasAlbum(p, id)) },
  { id: 'guardian', cond: (p) => achTier(p, 'litter') >= 2 },
  { id: 'photographer', cond: (p) => achTier(p, 'photos') >= 2 },
  { id: 'proCamper', cond: (p) => achTier(p, 'decorate') >= 2 },
  { id: 'legend', cond: (p) => rankIndex(p) >= RANKS.length - 1 },
  // NPC stories (src/core/story.ts)
  { id: 'rangerFriend', cond: (p) => storyComplete(p, 'kham') },
  { id: 'campCook', cond: (p) => storyComplete(p, 'daeng') },
  { id: 'lightChaser', cond: (p) => storyComplete(p, 'fah') },
];
export const REGIONS: Region[] = ['north', 'northeast', 'west', 'central', 'east', 'south'];
const regionDone = (p: Profile, r: Region) => { const ts = TRAILS.filter((x) => x.region === r); return ts.length > 0 && ts.every((x) => trailDone(p, x.id)); };
export const MEDAL_COINS = 50;
export const MEDALS: { id: string; color: number; ring: number; icon: string; cond: (p: Profile) => boolean }[] = [
  { id: 'north', color: 0x3f8a4a, ring: 0xa8d88a, icon: '🏔️', cond: (p) => regionDone(p, 'north') },
  { id: 'northeast', color: 0xc0702c, ring: 0xf2c08a, icon: '🪨', cond: (p) => regionDone(p, 'northeast') },
  { id: 'west', color: 0x2a7db0, ring: 0x9fd4f0, icon: '💧', cond: (p) => regionDone(p, 'west') },
  { id: 'central', color: 0x8e5ac8, ring: 0xd4b8f0, icon: '🌾', cond: (p) => regionDone(p, 'central') },
  { id: 'east', color: 0xd8a030, ring: 0xf8e0a0, icon: '🌴', cond: (p) => regionDone(p, 'east') },
  { id: 'south', color: 0x2a9a8a, ring: 0xa0e8d8, icon: '🌊', cond: (p) => regionDone(p, 'south') },
  { id: 'waterfallHunter', color: 0x3fb0a0, ring: 0xe8f6ff, icon: '💦', cond: (p) => ERAWAN_PHOTOS.every((id) => hasAlbum(p, id)) },
  { id: 'mountainConqueror', color: 0x6d6f74, ring: 0xd8d8d8, icon: '⛰️', cond: (p) => trailDone(p, 'doi-inthanon-kew-mae-pan') && trailDone(p, 'phu-kradueng-summit') },
  { id: 'forestGuardian', color: 0x2f6b2f, ring: 0x9bd35a, icon: '🌳', cond: (p) => (stats(p).litterCollected || 0) >= 50 },
  { id: 'wildlifePhotographer', color: 0x8a5028, ring: 0xe0b48c, icon: '🦌', cond: (p) => hasAlbum(p, 'sunbird') && hasAlbum(p, 'muntjac') },
  { id: 'masterCamper', color: 0xd9783a, ring: 0xffe0b0, icon: '⛺', cond: (p) => (A(p).camp?.placed?.length || 0) >= 5 && (stats(p).cooked || 0) >= 10 && (stats(p).harvests || 0) >= 10 },
  { id: 'legendaryExplorer', color: 0xb8932a, ring: 0xfff2a8, icon: '🏅', cond: (p) => TRAILS.every((x) => trailDone(p, x.id)) && rankIndex(p) >= 5 },
];

export const PARKS: { id: string; nameKey: string; region: Region; open: boolean }[] = [
  { id: 'doi-inthanon', nameKey: 'park_inthanon', region: 'north', open: true },
  { id: 'phu-kradueng', nameKey: 'park_phukradueng', region: 'northeast', open: true },
  { id: 'erawan', nameKey: 'park_erawan', region: 'west', open: true },
  { id: 'khao-laem', nameKey: 'park_khaolaem', region: 'west', open: false },
  { id: 'khao-sok', nameKey: 'park_khaosok', region: 'south', open: true },
  { id: 'khao-yai', nameKey: 'park_khaoyai', region: 'central', open: true },
  { id: 'khao-chamao', nameKey: 'park_khaochamao', region: 'east', open: true },
];

export type ProgressEvent =
  | { kind: 'achievement'; id: string; tier: number; coins: number }
  | { kind: 'rank'; rank: string }
  | { kind: 'medal'; id: string; coins: number }
  | { kind: 'title'; id: string };

/** Awards everything newly earned (coins included) and reports it. Safe to call often. */
export function checkProgress(p: Profile, today = new Date().toISOString().slice(0, 10)): ProgressEvent[] {
  const pr = A(p), out: ProgressEvent[] = [];
  pr.achievements ??= {}; pr.medals ??= {}; pr.titlesSeen ??= ['newbie']; pr.rankIdx ??= 0;
  for (const a of ACHIEVEMENTS) {
    const v = a.value(p);
    let cur = achTier(p, a.id);
    while (cur + 1 < a.tiers.length && v >= a.tiers[cur + 1]) {
      cur++; pr.achievements[a.id] = { tier: cur, date: today }; p.coins += TIERS[cur].coins;
      out.push({ kind: 'achievement', id: a.id, tier: cur, coins: TIERS[cur].coins });
    }
  }
  const r = rankIndex(p);
  if (r > pr.rankIdx) { pr.rankIdx = r; out.push({ kind: 'rank', rank: RANKS[r][0] }); }
  for (const m of MEDALS) if (!pr.medals[m.id] && m.cond(p)) { pr.medals[m.id] = today; p.coins += MEDAL_COINS; out.push({ kind: 'medal', id: m.id, coins: MEDAL_COINS }); }
  for (const ti of TITLES) if (ti.cond(p) && !pr.titlesSeen.includes(ti.id)) { pr.titlesSeen.push(ti.id); out.push({ kind: 'title', id: ti.id }); }
  return out;
}
