import { activeEvent, type StoryEvent } from '../core/story';
import { EVENTS_DEF, NPCS } from '../data/story';
import { t } from '../i18n';

/** Toast lines (and whether to play the big fanfare) for story/event results. */
export function storyMessages(events: StoryEvent[]): { lines: string[]; fanfare: boolean } {
  const lines: string[] = [];
  let fanfare = false;
  for (const e of events) {
    if (e.kind === 'npcReady') { const n = NPCS.find((x) => x.id === e.npc)!; lines.push(t('msg_storyReady', { i: n.icon, n: t('npc_' + n.id) })); }
    else {
      const d = EVENTS_DEF.find((x) => x.id === e.id)!;
      if (e.kind === 'eventGoal') lines.push(t('msg_eventGoal', { i: d.icon, e: t('event_' + d.id) }));
      else {
        lines.push(t('msg_eventDone', { e: t('event_' + d.id), x: e.exp, c: e.coins }));
        if (e.levelUp) lines.push(t('msg_levelUp', { n: e.levelUp }));
        fanfare = true;
      }
    }
  }
  return { lines, fanfare };
}

/** "🌫️ Sea of Mist Festival · 3 days left" for the camp sign and the trail start, or null. */
export function eventBanner(day: number): string | null {
  const a = activeEvent(day);
  return a ? t('event_banner', { i: a.def.icon, e: t('event_' + a.def.id), d: a.daysLeft }) : null;
}
