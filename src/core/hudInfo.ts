/**
 * Small read-only facts the HUD shows: how much of the walkable map is explored,
 * and the one most urgent warning about the hiker's body or pack.
 */
import { isSolidTile, type WorldMap } from './world';

/** Percent (0–100) of walkable tiles the hiker has revealed on the minimap. */
export function exploredPct(m: WorldMap, revealed: Uint8Array): number {
  let walk = 0, seen = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (isSolidTile(m, x, y)) continue;
    walk++; if (revealed[y * m.w + x]) seen++;
  }
  return walk ? Math.min(100, Math.round((seen / walk) * 100)) : 0;
}

export interface WarnInput {
  stamina: number; hunger: number; thirst: number; warmth: number; exhausted: boolean;
  /** a jacket is in the pack but not worn */ jacketOff: boolean;
  overweight: boolean;
}

/** i18n key of the most urgent warning, or null when all is well. Order: exhausted, cold, thirst, hunger, weight. */
export function statusWarning(w: WarnInput): string | null {
  if (w.exhausted || w.stamina < 10) return 'ui_warn_tired';
  if (w.warmth < 30) return w.jacketOff ? 'ui_warn_cold_jacket' : 'ui_warn_cold';
  if (w.thirst < 25) return 'ui_warn_thirst';
  if (w.hunger < 25) return 'ui_warn_hunger';
  if (w.overweight) return 'ui_warn_heavy';
  return null;
}
