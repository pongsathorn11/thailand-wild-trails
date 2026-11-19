import { TIERS, MEDALS, type ProgressEvent } from '../core/progress';
import { t } from '../i18n';

/** Toast text for achievements, rank-ups, medals and titles earned. */
export function progressMessages(events: ProgressEvent[]): string[] {
  return events.map((e) => {
    if (e.kind === 'achievement') return `${TIERS[e.tier].icon} ${t('msg_ach', { t: t('tier_' + TIERS[e.tier].id), a: t('ach_' + e.id) })} +${e.coins}🪙`;
    if (e.kind === 'rank') return t('msg_rankUp', { r: t('rank_' + e.rank) });
    if (e.kind === 'medal') return `${MEDALS.find((m) => m.id === e.id)!.icon} ${t('msg_medal', { m: t('medal_' + e.id) })} +${e.coins}🪙`;
    return t('msg_newTitle', { t: t('title_' + e.id) });
  });
}
