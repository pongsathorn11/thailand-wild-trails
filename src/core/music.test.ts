import { describe, expect, it } from 'vitest';
import { chordOf, midiToHz, moodFor, MUSIC_MOODS, phraseOf, pickMood, SCALES, writeTune } from './music';
import { mulberry32 } from './rng';

describe('generative music', () => {
  it('picks the mood from the screen and the hour', () => {
    expect(pickMood('title', 12)).toBe('title');
    expect(pickMood('camp', 23)).toBe('camp');
    expect(pickMood('pack', 3)).toBe('camp');
    expect(pickMood('hike', 10)).toBe('hike');
    expect(pickMood('hike', 20)).toBe('night');
    expect(pickMood('hike', 4.5)).toBe('night');
  });

  it('gives each trail its own key without changing the base mood', () => {
    expect(moodFor('hike', 1).key).toBe(MUSIC_MOODS.hike.key - 2);
    expect(moodFor('hike', 3).key).toBe(MUSIC_MOODS.hike.key - 5);
    expect(moodFor('camp', 3).key).toBe(MUSIC_MOODS.camp.key);
    expect(MUSIC_MOODS.hike.key).toBe(67);
  });

  it('writes 4×8 phrases using only scale notes, with a note on every downbeat', () => {
    for (const id of Object.keys(MUSIC_MOODS) as (keyof typeof MUSIC_MOODS)[]) {
      const m = moodFor(id), tune = writeTune(m, mulberry32(3));
      for (const ph of [tune.A, tune.B]) {
        expect(ph).toHaveLength(4);
        ph.forEach((bar, bi) => {
          expect(bar).toHaveLength(8);
          expect(bar[0]).not.toBeNull();
          for (const n of bar) if (n !== null) expect(SCALES[m.scale]).toContain((n - m.key + 120) % 12);
          // strong beats lean on chord tones when the scale has one
          const pc = (bar[0]! - m.key + 120) % 12, chord = chordOf(m, bi);
          if (chord.some((c) => SCALES[m.scale].includes(c))) expect(chord).toContain(pc);
        });
      }
    }
  });

  it('is deterministic for a seed and plays A A B A', () => {
    expect(writeTune(MUSIC_MOODS.title, mulberry32(9))).toEqual(writeTune(MUSIC_MOODS.title, mulberry32(9)));
    expect([0, 4, 8, 12, 16].map(phraseOf)).toEqual(['A', 'A', 'B', 'A', 'A']);
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });
});
