import { CONFIG } from './config';

/** Game clock for one hike: `elapsed` real seconds since the start, starting at the trail's start hour. */
export const minutesOf = (startHour: number, elapsed: number): number => startHour * 60 + elapsed * (1440 / CONFIG.DAY_LENGTH_SEC);
export const hourOf = (startHour: number, elapsed: number): number => (minutesOf(startHour, elapsed) / 60) % 24;
export function clockLabel(startHour: number, elapsed: number): string {
  const m = Math.floor(minutesOf(startHour, elapsed)) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/** 0 = full daylight, 0.62 = night. */
export function darkness(h: number): number {
  if (h >= 6.5 && h < 18.5) return 0;
  if (h >= 18.5 && h < 19.5) return (h - 18.5) * 0.62;
  if (h >= 19.5 || h < 4.5) return 0.62;
  return 0.62 * (1 - (h - 4.5) / 2);
}

/** Warm tint for dawn and dusk, as [color, alpha], or null. */
export function tint(h: number): [number, number] | null {
  if (h >= 5 && h < 7) return [0xffaa96, 0.12];
  if (h >= 17 && h < 18.8) return [0xff963c, 0.16];
  return null;
}
