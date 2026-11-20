/** Journal pages as rows: shared by the camp menu and the journal opened on a hike. */
import { levelInfo } from '../core/camp';
import type { Profile } from '../core/profile';
import { ACHIEVEMENTS, MEDALS, MEDAL_COINS, PARKS, RANKS, REGIONS, TIERS, TITLES, achPoints, achTier, rankIndex } from '../core/progress';
import { PHOTO_EXP, PHOTO_ICONS } from '../data/photos';
import { TRAILS } from '../data/trails';
import { t } from '../i18n';

export const JOURNAL_TABS = ['album', 'passport', 'achievements', 'medals', 'titles', 'stats'] as const;
export type JournalTab = (typeof JOURNAL_TABS)[number];
export interface MenuRow { icon: string; label: string; sub: string; right: string; enabled: boolean; medal?: { color: number; ring: number; got: boolean } }

const fmtTime = (s: number | null | undefined): string => (s === null || s === undefined ? '—' : `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`);

export function journalRows(profile: Profile, tab: JournalTab): MenuRow[] {
  const p = profile as Profile & Record<string, any>, album: { subjectId: string; date: string | null }[] = p.album ?? [];
  if (tab === 'album') return Object.keys(PHOTO_EXP).map((id) => {
    const a = album.find((x) => x.subjectId === id);
    return { icon: a ? PHOTO_ICONS[id] : '❔', label: a ? t('ph_' + id) : t('unknown'), sub: a ? (a.date ? t('photo_date', { d: a.date }) : '') : '💡 ' + t('hint_' + id), right: `+${PHOTO_EXP[id]} EXP`, enabled: !!a };
  });
  if (tab === 'passport') return PARKS.map((pk) => {
    const pp = p.passport?.[pk.id];
    let sub = t('coming_soon');
    if (pk.open) {
      const done = TRAILS.filter((x) => x.parkId === pk.id && pp?.trails?.[x.id]);
      sub = done.length ? done.map((x) => { const tr = pp.trails[x.id]; return t('passport_trail', { t: t(x.trailKey), n: tr.completions, b: fmtTime(tr.bestTimeSec) }); }).join(' · ')
        + (pp.firstDate ? ' · ' + t('first_date', { d: pp.firstDate }) : '') : t('not_stamped');
    }
    return { icon: pp?.stamped ? '🏅' : pk.open ? '⬜' : '🔒', label: t(pk.nameKey), sub, right: t('region_' + pk.region), enabled: !!pp?.stamped };
  });
  if (tab === 'achievements') return ACHIEVEMENTS.map((a) => {
    const tier = achTier(p, a.id), v = a.value(p), done = tier + 1 >= a.tiers.length, next = done ? a.tiers[a.tiers.length - 1] : a.tiers[tier + 1];
    const tiers = a.tiers.map((_, i) => (i <= tier ? TIERS[i].icon : '▫️')).join('');
    return { icon: tier >= 0 ? TIERS[tier].icon : a.icon, label: `${t('ach_' + a.id)}  ${tiers}`,
      sub: t('adesc_' + a.id, { v: Number.isInteger(v) ? v : v.toFixed(1), n: next }) + ' · ' + (done ? t('ach_complete') : t('ach_next', { t: t('tier_' + TIERS[tier + 1].id) })),
      right: done ? '' : `+${TIERS[tier + 1].coins}🪙`, enabled: tier >= 0 };
  });
  if (tab === 'medals') return MEDALS.map((md) => {
    const got = p.medals?.[md.id], region = (REGIONS as string[]).includes(md.id);
    const noTrail = region && !TRAILS.some((x) => x.region === md.id);
    return { icon: md.icon, medal: { color: md.color, ring: md.ring, got: !!got }, label: t('medal_' + md.id),
      sub: noTrail ? t('coming_soon') : t('mdesc_' + (region ? 'region' : md.id), { r: t('region_' + md.id) }), right: got ? got : `+${MEDAL_COINS}🪙`, enabled: !!got };
  });
  if (tab === 'titles') return TITLES.map((ti) => {
    const ok = ti.cond(p), on = (p.title ?? 'newbie') === ti.id;
    return { icon: on ? '🏷️' : ok ? '▫️' : '🔒', label: t('title_' + ti.id), sub: t('tcond_' + ti.id), right: on ? t('equipped') : ok ? t('equip') : '', enabled: ok };
  });
  const st = p.stats ?? {}, L = levelInfo(p.exp), r = rankIndex(p), nextRank = RANKS[r + 1];
  return ([
    ['🎖️', 'st_rank', t('rank_' + RANKS[r][0]), nextRank ? t('rank_points', { p: achPoints(p), n: nextRank[1] }) : t('rank_max', { p: achPoints(p) })],
    ['🥾', 'st_trails', String(st.trailsCompleted || 0), ''], ['📏', 'st_distance', (st.totalDistanceKm || 0).toFixed(1) + ' km', ''],
    ['🗑️', 'st_litter', String(st.litterCollected || 0), ''], ['📷', 'st_photos', String(st.photosTaken || 0), ''],
    ['📅', 'st_days', String(p.day), ''], ['⭐', 'st_level', `Lv.${L.level} · ${p.exp} EXP`, ''],
  ] as [string, string, string, string][]).map(([icon, k, v, sub]) => ({ icon, label: t(k), sub, right: v, enabled: true }));
}
