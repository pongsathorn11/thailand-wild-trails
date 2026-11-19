/**
 * Character creator rules: which rows exist, how ←→ cycles options, and name cleanup.
 * Body type only changes the look; both bodies have the same stats (from the brief).
 */
import { LOOK_OPTIONS, resolveLook, type Body, type Look, type LookRow } from '../data/looks';
import type { Profile } from './profile';

export const LOOK_ROWS: LookRow[] = ['hairStyle', 'hair', 'skin', 'face', 'outfit', 'acc'];
export type TitleRow = 'body' | LookRow | 'name';
export const TITLE_ROWS: TitleRow[] = ['body', ...LOOK_ROWS, 'name'];
export const NAME_MAX = 14;

export const optionCount = (row: LookRow): number => LOOK_OPTIONS[row].length;

export function setOption(p: Profile, row: 'body' | LookRow, v: number | Body): void {
  if (row === 'body') { p.body = v as Body; return; }
  const n = optionCount(row), j = Number(v);
  if (Number.isInteger(j) && j >= 0 && j < n) p.looks[p.body][row] = j;
}

/** ←/→ on a row. Body flips male/female; the name row ignores arrows. */
export function stepOption(p: Profile, row: TitleRow, d: number): void {
  if (row === 'name') return;
  if (row === 'body') { p.body = p.body === 'male' ? 'female' : 'male'; return; }
  const n = optionCount(row);
  p.looks[p.body][row] = (((p.looks[p.body][row] + d) % n) + n) % n;
}

/** Trims, collapses spaces, drops control characters, caps at NAME_MAX characters (by code point, so Thai and emoji are safe). */
export function cleanName(s: string): string {
  // eslint-disable-next-line no-control-regex
  const flat = s.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(flat).slice(0, NAME_MAX).join('');
}

export const lookOf = (p: Profile, body: Body = p.body): Look => resolveLook(body, p.looks[body]);

/** The look with one row changed, for option thumbnails. */
export function lookVariant(p: Profile, body: Body, row: LookRow, j: number): Look {
  return resolveLook(body, { ...p.looks[body], [row]: j });
}
