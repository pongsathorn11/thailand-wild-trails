import th from './th.json';
import en from './en.json';
import { EXTRA } from './extra';
import { STORY_TEXT } from './story';

export type Lang = 'th' | 'en';
const STR: Record<Lang, Record<string, unknown>> = { th: { ...th, ...EXTRA.th, ...STORY_TEXT.th }, en: { ...en, ...EXTRA.en, ...STORY_TEXT.en } };
let lang: Lang = 'th';

export const setLang = (l: Lang): void => { lang = l; };
export const getLang = (): Lang => lang;

/** Looks up a UI string; `{name}` placeholders are filled from `vars`. Falls back to Thai, then the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = (STR[lang][key] ?? STR.th[key] ?? key) as string;
  if (typeof s !== 'string') return key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', String(vars[k]));
  return s;
}

/** For string arrays such as NPC dialogue lines. */
export function tList(key: string): string[] {
  const v = STR[lang][key] ?? STR.th[key];
  return Array.isArray(v) ? (v as string[]) : [];
}
