/**
 * NPC storylines and seasonal events (rules only; content in data/story.ts, text in i18n/story.ts).
 *
 * Stories: talk to an NPC to hear a chapter and accept its goal; progress counts only after that;
 * when the goal is met, come back and talk again for the reward, +1 friendship and the next chapter.
 * Events: run on the in-game calendar (21-day year, 3 seasons × 7 days), so they also work offline.
 * Each event's goals count only while it runs; finishing all of them pays once per year and adds a stamp.
 */
import { gainExp, levelInfo } from './camp';
import type { Profile } from './profile';
import { SEASONS, SEASON_DAYS, seasonOf } from './season';
import { EVENTS_DEF, NPCS, type EventDef, type NpcDef, type NpcId, type StoryGoal } from '../data/story';
import type { QuestKind } from '../data/camp';
import type { TrailDef, WeatherId } from '../data/trails';

export const YEAR_DAYS = SEASON_DAYS * SEASONS.length;

interface NpcState { ch: number; accepted: boolean; progress: number }
interface EventState { progress: number[]; done: boolean }
export interface StoryState { npcs: Record<string, NpcState>; events: Record<string, EventState>; stamps: Record<string, number> }

type P = Profile & { story?: StoryState };

export function ensureStory(p: Profile): StoryState {
  const q = p as P;
  if (!q.story || typeof q.story !== 'object') q.story = { npcs: {}, events: {}, stamps: {} };
  const s = q.story;
  s.npcs ??= {}; s.events ??= {}; s.stamps ??= {};
  for (const n of NPCS) {
    const v = s.npcs[n.id];
    if (!v || typeof v.ch !== 'number') s.npcs[n.id] = { ch: 0, accepted: false, progress: 0 };
    else s.npcs[n.id] = { ch: Math.max(0, Math.min(n.chapters.length, Math.floor(v.ch))), accepted: !!v.accepted, progress: Math.max(0, Number(v.progress) || 0) };
  }
  return s;
}

/** Details of what just happened, used to match narrower goals. */
export interface Detail { trail?: string; subject?: string; crop?: string }

export function goalMatches(g: StoryGoal, kind: QuestKind, d: Detail = {}): boolean {
  if (g.kind !== kind) return false;
  if (g.trail && g.trail !== d.trail) return false;
  if (g.subjects && !(d.subject && g.subjects.includes(d.subject))) return false;
  if (g.crop && g.crop !== d.crop) return false;
  return true;
}

// ---------- NPC stories ----------
export type NpcStatus = 'new' | 'active' | 'ready' | 'locked' | 'done';
export interface NpcView { npc: NpcDef; status: NpcStatus; chapter: number; progress: number; need: number; hearts: number }

export function npcView(p: Profile, id: NpcId): NpcView {
  const npc = NPCS.find((n) => n.id === id)!, st = ensureStory(p).npcs[id], ch = npc.chapters[st.ch];
  if (!ch) return { npc, status: 'done', chapter: st.ch, progress: 0, need: 0, hearts: npc.chapters.length };
  const need = ch.goal.count, progress = Math.min(st.progress, need);
  let status: NpcStatus = 'new';
  if (ch.minLevel && levelInfo(p.exp).level < ch.minLevel) status = 'locked';
  else if (st.accepted) status = progress >= need ? 'ready' : 'active';
  return { npc, status, chapter: st.ch, progress, need, hearts: st.ch };
}

export type TalkResult =
  | { kind: 'intro'; lines: string; chapterId: string }          // chapter told and accepted
  | { kind: 'waiting'; lines: string; chapterId: string }
  | { kind: 'reward'; lines: string; chapterId: string; exp: number; coins: number; items: Record<string, number>; levelUp: number | null; finished: boolean }
  | { kind: 'locked'; lines: string; level: number }
  | { kind: 'done'; lines: string };

/** Talking to an NPC. Returns which dialogue to show (an i18n key) and applies rewards. */
export function talkTo(p: Profile, id: NpcId): TalkResult {
  const v = npcView(p, id), st = ensureStory(p).npcs[id], ch = v.npc.chapters[v.chapter];
  if (v.status === 'done') return { kind: 'done', lines: `story_${id}_done` };
  if (v.status === 'locked') return { kind: 'locked', lines: `story_${id}_locked`, level: ch.minLevel! };
  if (v.status === 'new') { st.accepted = true; st.progress = 0; return { kind: 'intro', lines: `story_${ch.id}_intro`, chapterId: ch.id }; }
  if (v.status === 'active') return { kind: 'waiting', lines: `story_${ch.id}_wait`, chapterId: ch.id };
  // ready: pay out and move on
  const levelUp = gainExp(p, ch.exp);
  p.coins += ch.coins;
  const items = { ...(ch.items ?? {}) };
  for (const [k, n] of Object.entries(items)) p.storage[k] = (p.storage[k] || 0) + n;
  st.ch++; st.accepted = false; st.progress = 0;
  return { kind: 'reward', lines: `story_${ch.id}_done`, chapterId: ch.id, exp: ch.exp, coins: ch.coins, items, levelUp, finished: st.ch >= v.npc.chapters.length };
}

export const storyComplete = (p: Profile, id: NpcId): boolean => npcView(p, id).status === 'done';

// ---------- seasonal events ----------
export const yearOf = (day: number): number => Math.floor((Math.max(1, day) - 1) / YEAR_DAYS);
export const dayInSeason = (day: number): number => ((Math.max(1, day) - 1) % SEASON_DAYS) + 1;

export interface ActiveEvent { def: EventDef; key: string; daysLeft: number }

/** The event running on this camp day, if any. */
export function activeEvent(day: number): ActiveEvent | null {
  const season = seasonOf(day), d = dayInSeason(day);
  const def = EVENTS_DEF.find((e) => e.season === season && d >= e.from && d <= e.to);
  return def ? { def, key: `${def.id}@${yearOf(day)}`, daysLeft: def.to - d + 1 } : null;
}

/** The next event to come (for "coming up" hints). */
export function nextEvent(day: number): { def: EventDef; inDays: number } | null {
  const now = activeEvent(day)?.key;
  for (let k = 1; k <= YEAR_DAYS; k++) { const a = activeEvent(day + k); if (a && a.key !== now) return { def: a.def, inDays: k }; }
  return null;
}

export function eventState(p: Profile, a: ActiveEvent): EventState {
  const s = ensureStory(p), e = s.events[a.key];
  if (!e || !Array.isArray(e.progress) || e.progress.length !== a.def.goals.length) s.events[a.key] = { progress: a.def.goals.map(() => 0), done: false };
  return s.events[a.key];
}

// ---------- one hook for both ----------
export type StoryEvent =
  | { kind: 'npcReady'; npc: NpcId }
  | { kind: 'eventGoal'; id: EventDef['id'] }
  | { kind: 'eventDone'; id: EventDef['id']; exp: number; coins: number; levelUp: number | null };

/** Call wherever a daily quest is notified (same kinds), with details when known. */
export function notifyStory(p: Profile, kind: QuestKind, d: Detail = {}, n = 1): StoryEvent[] {
  const out: StoryEvent[] = [], s = ensureStory(p);
  for (const npc of NPCS) {
    const st = s.npcs[npc.id], ch = npc.chapters[st.ch];
    if (!ch || !st.accepted || !goalMatches(ch.goal, kind, d)) continue;
    const was = st.progress;
    st.progress = Math.min(ch.goal.count, st.progress + n);
    if (was < ch.goal.count && st.progress >= ch.goal.count) out.push({ kind: 'npcReady', npc: npc.id });
  }
  const a = activeEvent(p.day || 1);
  if (a) {
    const e = eventState(p, a);
    if (!e.done) {
      let moved = false;
      a.def.goals.forEach((g, i) => {
        if (!goalMatches(g, kind, d) || e.progress[i] >= g.count) return;
        e.progress[i] = Math.min(g.count, e.progress[i] + n); moved = true;
        if (e.progress[i] >= g.count) out.push({ kind: 'eventGoal', id: a.def.id });
      });
      if (moved && a.def.goals.every((g, i) => e.progress[i] >= g.count)) {
        e.done = true;
        const levelUp = gainExp(p, a.def.exp);
        p.coins += a.def.coins;
        s.stamps[a.def.id] = (s.stamps[a.def.id] || 0) + 1;
        out.push({ kind: 'eventDone', id: a.def.id, exp: a.def.exp, coins: a.def.coins, levelUp });
      }
    }
  }
  return out;
}

// ---------- event effects ----------
/** Weather odds for a trail on this day, with the running event's bias applied (still sums to 1). */
export function eventWeatherChances(trail: TrailDef, day: number, base: Record<WeatherId, number>): Record<WeatherId, number> {
  const w = activeEvent(day)?.def.weather;
  if (!w || (w.regions && !w.regions.includes(trail.region))) return base;
  const raw = { ...base, [w.id]: base[w.id] * w.mult };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return { clear: raw.clear / sum, fog: raw.fog / sum, drizzle: raw.drizzle / sum };
}

/** Photo EXP multiplier for a subject on this day (1 when no event boosts it). */
export function eventPhotoMult(day: number, subject: string): number {
  const ph = activeEvent(day)?.def.photo;
  return ph && ph.subjects.includes(subject) ? ph.mult : 1;
}
