/**
 * Generative music rules (no Web Audio here, so they can be tested).
 * Each screen has a mood: key, tempo, chord loop, instruments. A melody is written from the
 * pentatonic scale in 4-bar phrases played A A B A; a new tune every 16 bars.
 * Small "ching" cymbals (as in Thai ensembles) keep time.
 */
import { clamp } from './rng';

export type MoodId = 'title' | 'camp' | 'hike' | 'night';
export interface Mood { tempo: number; key: number; scale: 'maj' | 'min'; prog: [number, 'M' | 'm'][]; pad: number; arp: boolean; ching: boolean; mel: number }

export const MUSIC_MOODS: Record<MoodId, Mood> = {
  title: { tempo: 84, key: 60, scale: 'maj', prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], pad: 0.05, arp: false, ching: true, mel: 0.55 },
  camp: { tempo: 70, key: 62, scale: 'maj', prog: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']], pad: 0.04, arp: true, ching: false, mel: 0.35 },
  hike: { tempo: 100, key: 67, scale: 'maj', prog: [[0, 'M'], [4, 'm'], [5, 'M'], [7, 'M']], pad: 0.025, arp: false, ching: true, mel: 0.6 },
  night: { tempo: 58, key: 57, scale: 'min', prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], pad: 0.05, arp: false, ching: false, mel: 0.25 },
};
export const SCALES = { maj: [0, 2, 4, 7, 9], min: [0, 3, 5, 7, 10] };
/** Each trail plays the hike mood in its own key (offset in semitones, by trail order). */
export const TRAIL_KEY_SHIFT = [0, -2, 2, -5];

export type Screen = 'title' | 'camp' | 'pack' | 'hike' | 'none';
export const isNight = (hour: number): boolean => hour >= 19 || hour < 5;

export function pickMood(screen: Screen, hour: number): MoodId {
  if (screen === 'title') return 'title';
  if (screen === 'hike') return isNight(hour) ? 'night' : 'hike';
  return 'camp';
}

export function moodFor(id: MoodId, trailIndex = 0): Mood {
  const m = { ...MUSIC_MOODS[id] };
  if (id === 'hike') m.key += TRAIL_KEY_SHIFT[trailIndex] ?? 0;
  return m;
}

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Chord tones (pitch classes relative to the key) of one bar. */
export function chordOf(m: Mood, bar: number): number[] {
  const [root, q] = m.prog[bar % m.prog.length];
  return [root, root + (q === 'M' ? 4 : 3), root + 7].map((n) => ((n % 12) + 12) % 12);
}

/** Two phrases (A and B): 4 bars × 8 eighth notes, each a MIDI note or null (rest). */
export function writeTune(m: Mood, rng: () => number): { A: (number | null)[][]; B: (number | null)[][] } {
  const sc = SCALES[m.scale], notes: number[] = [];
  for (let o = 0; o < 2; o++) for (const d of sc) notes.push(m.key + 12 + o * 12 + d);
  const make = () => {
    let idx = 4 + Math.floor(rng() * 3);
    return [0, 1, 2, 3].map((bar) => {
      const chord = chordOf(m, bar);
      return Array.from({ length: 8 }, (_, b) => {
        if (rng() > m.mel && b !== 0) return null;
        idx = clamp(idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)], 0, notes.length - 1);
        if (b === 0 || b === 4) { // lean on chord tones on strong beats
          let best = idx, bd = 99;
          notes.forEach((n, i) => { if (chord.includes((n - m.key + 120) % 12) && Math.abs(i - idx) < bd) { bd = Math.abs(i - idx); best = i; } });
          idx = best;
        }
        return notes[idx];
      });
    });
  };
  return { A: make(), B: make() };
}

/** Which phrase plays in a bar: A A B A over 16 bars. */
export const phraseOf = (bar: number): 'A' | 'B' => (['A', 'A', 'B', 'A'] as const)[Math.floor(bar / 4) % 4];
