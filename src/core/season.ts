import type { Season, RareShot, WeatherId } from '../data/trails';

export const SEASONS: Season[] = ['cool', 'hot', 'rain']; // camp day 1 starts in the cool season
export const SEASON_DAYS = 7;
export const seasonOf = (day: number): Season => SEASONS[Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length];

/** Is a rare shot possible right now (weather and hour window)? */
export function rareOk(r: RareShot | undefined, weather: WeatherId, hour: number): r is RareShot {
  if (!r) return false;
  if (r.weather && weather !== r.weather) return false;
  if (r.hourFrom !== undefined && hour < r.hourFrom) return false;
  if (r.hourTo !== undefined && hour >= r.hourTo) return false;
  return true;
}
