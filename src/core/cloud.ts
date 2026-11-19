/**
 * Cloud save and leaderboard rules (no network here, so they can be tested).
 * The network side lives in src/net/supabase.ts.
 */
import { migrateProfile, type Profile } from './profile';
import { TRAILS } from '../data/trails';

/** Bounds the database also enforces (see supabase/migrations). */
export const SCORE_MIN_SEC = 30;
export const SCORE_MAX_SEC = 6 * 60 * 60;
export const DISPLAY_NAME_MAX = 20;
export const SAVE_MAX_BYTES = 200_000;

type P = Profile & { stats?: { trailsCompleted?: number }; savedAt?: number; passport?: Record<string, { trails?: Record<string, { bestTimeSec?: number | null }> }> };

/** How far a save has got, compared field by field (exp, then trails done, then day). */
export function progressKey(p: P): [number, number, number] {
  return [p.exp || 0, p.stats?.trailsCompleted || 0, p.day || 1];
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Which save to keep when this device and the cloud disagree.
 * Never throw progress away: the save that got further wins; with equal progress, the newer one wins.
 */
export function pickSave(local: P, remote: P | null): 'local' | 'remote' | 'same' {
  if (!remote) return 'local';
  const c = cmp(progressKey(local), progressKey(remote));
  if (c !== 0) return c > 0 ? 'local' : 'remote';
  const lt = local.savedAt || 0, rt = remote.savedAt || 0;
  if (lt === rt) return 'same';
  return lt > rt ? 'local' : 'remote';
}

/** A save from the cloud is untrusted input: parse it through the same migration as a local one. */
export function readRemoteSave(data: unknown): Profile | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  try { return migrateProfile(JSON.parse(JSON.stringify(data))); } catch { return null; }
}

export function saveFitsCloud(p: Profile): boolean {
  return new TextEncoder().encode(JSON.stringify(p)).length < SAVE_MAX_BYTES;
}

export const validScore = (trailId: string, sec: unknown): sec is number =>
  TRAILS.some((t) => t.id === trailId) && typeof sec === 'number' && Number.isInteger(sec) && sec >= SCORE_MIN_SEC && sec <= SCORE_MAX_SEC;

/** Best time per trail from the passport, only the ones the leaderboard would accept. */
export function bestTimes(p: P): { trailId: string; sec: number }[] {
  const out: { trailId: string; sec: number }[] = [];
  for (const tr of TRAILS) {
    const sec = p.passport?.[tr.parkId]?.trails?.[tr.id]?.bestTimeSec;
    const s = typeof sec === 'number' ? Math.round(sec) : null;
    if (s !== null && validScore(tr.id, s)) out.push({ trailId: tr.id, sec: s });
  }
  return out;
}

/** Name shown on the leaderboard: the hiker's name, cleaned, or a fallback. */
export function displayName(p: Profile, fallback: string): string {
  const flat = String(p.name ?? '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
  return Array.from(flat || fallback).slice(0, DISPLAY_NAME_MAX).join('');
}

/** Only re-send times that improved since the last upload. */
export function scoresToSend(best: { trailId: string; sec: number }[], sent: Record<string, number>): { trailId: string; sec: number }[] {
  return best.filter((b) => sent[b.trailId] === undefined || b.sec < sent[b.trailId]);
}

export const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
