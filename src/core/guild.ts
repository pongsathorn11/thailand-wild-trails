/**
 * Hiking clubs (guilds): the rules the browser checks before asking the server. The database
 * (supabase/migrations/0005_guilds.sql) checks the same things again and is the authority.
 *
 * - A club has a name (3–20 characters, filtered), an emblem from a fixed list and up to GUILD_MAX members.
 * - Weekly club points come only from hikes the server timed itself (accepted runs): 10 points each,
 *   at most RUNS_PER_DAY counted per member per day (Thai time), only after the member joined.
 *   Nothing can be bought, so there is no Pay-to-Win.
 */
export const GUILD_MAX = 20;
export const GUILD_NAME_MIN = 3;
export const GUILD_NAME_MAX = 20;
export const POINTS_PER_RUN = 10;
export const RUNS_PER_DAY = 3;
export const EMBLEMS = ['🌲', '⛰️', '🦅', '🐘', '🌊', '🔥', '🌸', '🦌'] as const;
export type Emblem = (typeof EMBLEMS)[number];

/**
 * Words a club name may not contain (checked after lower-casing and removing spaces and punctuation).
 * The same list is in the migration; a test keeps them in sync.
 */
export const BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'porn', 'nazi', 'hitler', 'rape',
  'เหี้ย', 'สัส', 'ควย', 'เย็ด', 'มึง', 'ระยำ', 'ชาติหมา', 'แตด', 'สถุล', 'อีดอก', 'ส้นตีน',
];

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function cleanGuildCode(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const c = s.trim().toUpperCase().replace(/[\s-]/g, '');
  return c.length === 6 && [...c].every((ch) => CODE_ALPHABET.includes(ch)) ? c : null;
}

/** English letters, digits, Thai, spaces and a few joiners. Same rule as the database. */
const NAME_CHARS = /^[A-Za-z0-9฀-๿ ._'-]+$/;

/** Squashes a name to compare against banned words and other clubs' names (case, spaces, punctuation ignored). */
export const nameKey = (s: string): string => s.toLowerCase().replace(/[\s._'-]+/g, '');

export type NameProblem = 'short' | 'long' | 'chars' | 'banned';
/** Tidies a club name, or says what is wrong with it. */
export function checkGuildName(raw: unknown): { name: string } | { problem: NameProblem } {
  const name = (typeof raw === 'string' ? raw : '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const len = Array.from(name).length;
  if (len < GUILD_NAME_MIN) return { problem: 'short' };
  if (len > GUILD_NAME_MAX) return { problem: 'long' };
  if (!NAME_CHARS.test(name)) return { problem: 'chars' };
  const key = nameKey(name);
  if (BANNED_WORDS.some((w) => key.includes(w))) return { problem: 'banned' };
  return { name };
}

export const isEmblem = (s: unknown): s is Emblem => (EMBLEMS as readonly string[]).includes(s as string);

/** Points for one member from their accepted runs' finish days (YYYY-MM-DD, Thai time) this week. */
export function memberPoints(days: string[]): number {
  const per = new Map<string, number>();
  for (const d of days) per.set(d, (per.get(d) ?? 0) + 1);
  let n = 0;
  for (const c of per.values()) n += Math.min(c, RUNS_PER_DAY);
  return n * POINTS_PER_RUN;
}

/** What the database returns for the player's own club. */
export interface MyGuild {
  code: string; name: string; emblem: Emblem; open: boolean; isLeader: boolean; points: number; rank: number;
  members: { name: string; points: number; isMe: boolean; isLeader: boolean }[];
}
export interface GuildRow { rank: number; name: string; emblem: Emblem; members: number; points: number; isMine: boolean; code: string | null }
