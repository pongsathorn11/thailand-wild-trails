/**
 * All sound is synthesized with Web Audio (no audio files): effects, footsteps, looping ambience
 * (wind, water, rain, campfire), bird chirps, and the generative music from core/music.
 * The context starts on the first key press or tap, as browsers require.
 */
import { midiToHz, moodFor, phraseOf, writeTune, type Mood, type MoodId } from '../core/music';
import { mulberry32 } from '../core/rng';
import { T, type TileId } from '../data/terrain';

export type Sfx = 'blip' | 'select' | 'error' | 'shutter' | 'pickup' | 'drink' | 'eat' | 'splash' | 'water' | 'chime' | 'fanfare' | 'sleep' | 'sad' | 'stamp';
export type AmbId = 'wind' | 'water' | 'rain' | 'fire';
export interface Prefs { sound: boolean; music: boolean }

const MASTER = 0.55, MUSIC_VOL = 0.32;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private amb: Partial<Record<AmbId, GainNode>> = {};
  prefs: Prefs = { sound: true, music: true };
  // music state
  private mGain: GainNode | null = null;
  private moodKey = '';
  private mood: Mood | null = null;
  private nextTime = 0;
  private stepN = 0;
  private phrases: ReturnType<typeof writeTune> | null = null;
  private rng = mulberry32(7);
  private muted = false;

  /** Call from a user gesture. Safe to call many times. */
  init(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = this.prefs.sound ? MASTER : 0; this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      const loop = (type: BiquadFilterType, freq: number, q: number): GainNode => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(this.master); src.start();
        return g;
      };
      this.amb = { wind: loop('lowpass', 380, 0.5), water: loop('bandpass', 900, 0.6), rain: loop('highpass', 2500, 0.3), fire: loop('bandpass', 600, 0.8) };
      this.mGain = ctx.createGain(); this.mGain.gain.value = 0; this.mGain.connect(this.master);
    } catch { this.ctx = null; }
  }

  setPrefs(p: Prefs): void {
    this.prefs = { ...p };
    if (this.ctx) this.master.gain.setTargetAtTime(p.sound ? MASTER : 0, this.ctx.currentTime, 0.05);
  }
  private get on(): boolean { return !!this.ctx && this.prefs.sound; }

  tone(freq: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.15, to = 0, delay = 0 } = {}): void {
    if (!this.on) return;
    const c = this.ctx!, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(dur: number, { vol = 0.15, freq = 1500, type = 'bandpass' as BiquadFilterType, q = 1, delay = 0 } = {}): void {
    if (!this.on) return;
    const c = this.ctx!, t0 = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }

  sfx(name: Sfx | string | undefined | null): void {
    switch (name) {
      case 'blip': this.tone(660, 0.05, { type: 'square', vol: 0.04 }); break;
      case 'select': this.tone(520, 0.08, { type: 'triangle', vol: 0.1 }); this.tone(780, 0.1, { type: 'triangle', vol: 0.1, delay: 0.07 }); break;
      case 'error': this.tone(180, 0.15, { type: 'square', vol: 0.06, to: 120 }); break;
      case 'shutter': this.noise(0.04, { vol: 0.25, freq: 3000 }); this.noise(0.06, { vol: 0.2, freq: 1800, delay: 0.08 }); break;
      case 'pickup': this.tone(880, 0.07, { type: 'triangle', vol: 0.1 }); this.tone(1320, 0.1, { type: 'triangle', vol: 0.1, delay: 0.06 }); break;
      case 'drink': this.tone(300, 0.12, { vol: 0.15, to: 700 }); this.tone(350, 0.12, { vol: 0.12, to: 800, delay: 0.14 }); break;
      case 'eat': this.noise(0.06, { vol: 0.15, freq: 900 }); this.noise(0.06, { vol: 0.15, freq: 1100, delay: 0.12 }); break;
      case 'splash': this.noise(0.5, { vol: 0.3, freq: 700, q: 0.5 }); break;
      case 'water': this.noise(0.35, { vol: 0.12, freq: 2500, type: 'highpass' }); break;
      case 'chime': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 3 ? 0.5 : 0.18, { type: 'square', vol: 0.06, delay: i * 0.11 })); break;
      case 'sleep': [660, 523, 440, 330].forEach((f, i) => this.tone(f, 0.4, { vol: 0.08, delay: i * 0.18 })); break;
      case 'sad': [392, 349, 311].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.08, delay: i * 0.22 })); break;
      case 'stamp': this.noise(0.12, { vol: 0.35, freq: 200, type: 'lowpass' }); this.sfx('fanfare'); break;
    }
  }

  step(tile: TileId): void {
    const soft = tile === T.GRASS || tile === T.MOSS || tile === T.TALL;
    this.noise(0.05, { vol: soft ? 0.05 : 0.08, freq: tile === T.BRIDGE ? 500 : soft ? 2200 : 1200, q: 0.8 });
  }

  /** Ambience levels (0-1-ish) and random critters; call about 10× a second. */
  ambience(lv: Record<AmbId, number>, o: { birds: number; gibbon: boolean; crickets: boolean }): void {
    if (!this.ctx) return;
    for (const k of Object.keys(lv) as AmbId[]) this.amb[k]?.gain.setTargetAtTime(lv[k], this.ctx.currentTime, 0.6);
    if (Math.random() < o.birds * 0.1) {
      const f = 2200 + Math.random() * 1600, n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone(f, 0.08, { vol: 0.03, to: f * 1.3, delay: i * 0.12 });
    }
    if (o.gibbon && Math.random() < 0.012) for (let i = 0; i < 6; i++) this.tone(500 + i * 90, 0.22, { vol: 0.025, to: 900 + i * 120, delay: i * 0.26 });
    if (o.crickets && Math.random() < 0.06) for (let i = 0; i < 3; i++) this.tone(4200, 0.03, { type: 'square', vol: 0.012, delay: i * 0.06 });
    if (lv.fire && Math.random() < 0.15) this.noise(0.03, { vol: 0.08, freq: 2500 });
  }

  // ---------- music ----------
  private pluck(f: number, t: number, vol: number, dur = 0.9): void {
    const c = this.ctx!, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), g2 = c.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.value = 0.25;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.mGain!);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  private pad(freqs: number[], t: number, dur: number, vol: number): void {
    const c = this.ctx!, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
    lp.connect(g); g.connect(this.mGain!);
    for (const f of freqs) for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur * 1.1); }
  }
  private bass(f: number, t: number, vol: number): void {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(this.mGain!); o.start(t); o.stop(t + 0.75);
  }
  /** Small Thai hand cymbals: bright ring ("ching") or short damped "chap". */
  private ching(t: number, open: boolean): void {
    const c = this.ctx!, s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain(), d = open ? 0.35 : 0.06;
    s.buffer = this.noiseBuf; hp.type = 'highpass'; hp.frequency.value = 6500;
    g.gain.setValueAtTime(open ? 0.05 : 0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(hp); hp.connect(g); g.connect(this.mGain!); s.start(t, Math.random()); s.stop(t + d + 0.02);
    if (open) {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = 4186;
      og.gain.setValueAtTime(0.012, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(og); og.connect(this.mGain!); o.start(t); o.stop(t + 0.45);
    }
  }
  private scheduleStep(i: number, t: number): void {
    const m = this.mood!, eighth = 60 / m.tempo / 2, barLen = eighth * 8, bar = Math.floor(i / 8), beat = i % 8, barIn = bar % 4;
    if (!this.phrases || (beat === 0 && bar > 0 && bar % 16 === 0)) this.phrases = writeTune(m, this.rng);
    const [root, q] = m.prog[barIn], third = q === 'M' ? 4 : 3;
    const base = m.key - 12 + root;
    if (beat === 0) {
      if (m.pad) this.pad([base + 12, base + 12 + third, base + 19].map(midiToHz), t, barLen, m.pad);
      this.bass(midiToHz(base - 12), t, 0.09);
    }
    if (beat === 4) this.bass(midiToHz(base - 5), t, 0.06);
    if (m.ching && (beat === 2 || beat === 6)) this.ching(t, beat === 2);
    if (m.ching && beat === 4 && m.tempo > 90) this.ching(t, false);
    if (m.arp) this.pluck(midiToHz(base + 12 + [0, third, 7, 12, 7, third, 0, 7][beat]), t, 0.035, 0.7);
    const note = this.phrases[phraseOf(bar)][barIn][beat];
    if (note) this.pluck(midiToHz(note), t, 0.075, m.tempo < 70 ? 1.4 : 0.9);
  }
  /** Schedules music ahead; call every frame with the current mood. */
  music(id: MoodId, trailIndex = 0): void {
    if (!this.ctx || !this.mGain) return;
    const c = this.ctx, g = this.mGain.gain;
    if (!this.prefs.sound || !this.prefs.music) {
      if (!this.muted) { g.cancelScheduledValues(c.currentTime); g.setTargetAtTime(0, c.currentTime, 0.3); this.muted = true; }
      return;
    }
    if (this.muted) { this.muted = false; this.moodKey = ''; }
    const key = `${id}:${trailIndex}`;
    if (key !== this.moodKey) {
      this.moodKey = key; this.mood = moodFor(id, trailIndex); this.stepN = 0; this.phrases = null;
      this.nextTime = c.currentTime + 0.6;
      g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0, c.currentTime); g.linearRampToValueAtTime(MUSIC_VOL, c.currentTime + 2.5);
    }
    const eighth = 60 / this.mood!.tempo / 2;
    if (this.nextTime < c.currentTime - 1) this.nextTime = c.currentTime + 0.05; // tab was in the background
    while (this.nextTime < c.currentTime + 0.3) { this.scheduleStep(this.stepN, this.nextTime); this.nextTime += eighth; this.stepN++; }
  }
}

export const audio = new AudioEngine();
