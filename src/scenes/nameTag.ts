import type { Profile } from '../core/profile';
import { t } from '../i18n';

/** "Name · Title" shown above the player's head in camp and on the trail. */
export function nameTag(p: Profile): string {
  const name = (p.name ?? '').trim(), title = t('title_' + ((p as Profile & { title?: string }).title ?? 'newbie'));
  return name ? `${name} · ${title}` : title;
}
