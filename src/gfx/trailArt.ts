/**
 * Trail scenery and wildlife, painted once into canvases (same art as the prototype).
 * Animated things are a few frames each; Phaser animations or tweens play them.
 */
import { mulberry32 } from '../core/rng';
import { blob, makeCanvas } from './paint';
import type { PropArt } from './props';

type Painter = (c: CanvasRenderingContext2D, x: number, y: number) => void;
const art = (w: number, h: number, ax: number, ay: number, fn: Painter): PropArt => {
  const canvas = makeCanvas(w, h); fn(canvas.getContext('2d')!, ax, ay); return { canvas, ax, ay };
};
const R = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

export function buildTrailArt(): Record<string, PropArt> {
  const out: Record<string, PropArt> = {
    rhodo: art(16, 14, 8, 13, (c, x, y) => {
      blob(c, x, y - 6, 6, '#2f6b2f'); blob(c, x - 2, y - 8, 4, '#3f8a3a');
      for (const [fx, fy] of [[-4, -9], [1, -11], [3, -6], [-1, -5], [4, -10]]) R(c, '#d8343f', x + fx, y + fy, 2, 2);
    }),
    moss: art(18, 12, 8, 11, (c, x, y) => {
      blob(c, x, y - 4, 5, '#6d6f74'); blob(c, x - 1, y - 6, 4, '#4f8a3c');
      R(c, '#7cc05a', x - 3, y - 8, 1, 1); R(c, '#7cc05a', x + 1, y - 7, 1, 1);
      R(c, '#5aa64a', x + 5, y - 7, 1, 6); R(c, '#5aa64a', x + 3, y - 6, 2, 1); R(c, '#5aa64a', x + 6, y - 5, 2, 1);
    }),
    bigPine: art(26, 44, 13, 42, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.22)', x - 10, y - 2, 20, 3);
      R(c, '#5e3c22', x - 2, y - 14, 4, 14); R(c, '#4a2e18', x - 2, y - 14, 1, 14);
      for (let i = 0; i < 5; i++) {
        const top = y - 40 + i * 6, hw = 3 + i * 2;
        for (let r = 0; r < 9; r++) { const w = Math.round((r / 8) * hw) + 1; R(c, '#24503a', x - w, top + r, w * 2, 1); R(c, '#356a48', x - w, top + r, w, 1); }
      }
    }),
    stall: art(24, 22, 12, 21, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.2)', x - 11, y - 1, 22, 2);
      R(c, '#6b4528', x - 10, y - 16, 2, 16); R(c, '#6b4528', x + 8, y - 16, 2, 16);
      for (let i = 0; i < 22; i++) R(c, i % 4 < 2 ? '#3b7dd8' : '#f4ecd8', x - 11 + i, y - 19, 1, 4);
      R(c, '#9a6a3a', x - 9, y - 7, 18, 3);
      R(c, '#bfe3f0', x - 6, y - 11, 2, 4); R(c, '#bfe3f0', x - 3, y - 11, 2, 4);
      R(c, '#f4ecd8', x + 2, y - 9, 3, 2); R(c, '#c8955a', x + 5, y - 9, 2, 2);
    }),
    flashlight: art(10, 12, 4, 10, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.2)', x - 3, y - 1, 7, 1); R(c, '#f0c23a', x - 3, y - 5, 6, 3); R(c, '#fff8c0', x + 3, y - 5, 1, 3);
    }),
    litter0: art(4, 8, 2, 7, (c, x, y) => { R(c, '#bfe3f0', x - 1, y - 5, 2, 5); R(c, '#3b7dd8', x - 1, y - 6, 2, 1); }),
    litter1: art(6, 4, 3, 3, (c, x, y) => { R(c, '#e85a5a', x - 2, y - 2, 4, 2); R(c, '#f5f5f5', x - 1, y - 2, 1, 1); }),
    bag: art(10, 12, 5, 11, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.2)', x - 4, y - 1, 8, 1); R(c, '#c8955a', x - 3, y - 6, 6, 5); R(c, '#8a5a30', x - 3, y - 7, 6, 1);
    }),
    sparkle: art(6, 6, 2, 9, (c) => { R(c, '#ffffff', 2, 0, 1, 5); R(c, '#ffffff', 0, 2, 5, 1); }),
    'maple-red': art(22, 28, 11, 27, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.22)', x - 9, y - 2, 18, 3); R(c, '#6b4528', x - 1, y - 12, 3, 12);
      blob(c, x, y - 16, 8, '#b8322a'); blob(c, x - 2, y - 18, 5, '#e0523a');
      R(c, '#f2a03a', x + 3, y - 20, 2, 2); R(c, '#f2a03a', x - 5, y - 13, 2, 2);
    }),
    'maple-green': art(22, 28, 11, 27, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.22)', x - 9, y - 2, 18, 3); R(c, '#6b4528', x - 1, y - 12, 3, 12);
      blob(c, x, y - 16, 8, '#3f8a3a'); blob(c, x - 2, y - 18, 5, '#5aa64a');
    }),
    'rafflesia-bloom': art(24, 16, 12, 15, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.2)', x - 10, y - 1, 20, 2);
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2 - Math.PI / 2, px = Math.round(x + Math.cos(ang) * 6), py = Math.round(y - 6 + Math.sin(ang) * 4);
        blob(c, px, py, 4, '#b0302a'); R(c, '#f0d8c8', px - 1, py - 1, 1, 1); R(c, '#f0d8c8', px + 1, py, 1, 1);
      }
      blob(c, x, y - 6, 4, '#7a1e1a'); blob(c, x, y - 6, 2, '#3a0e0c');
    }),
    'rafflesia-bud': art(24, 16, 12, 15, (c, x, y) => { blob(c, x, y - 4, 4, '#6b3a22'); blob(c, x - 1, y - 5, 2, '#8a5030'); }),
    // a wild elephant and calf, seen from a distance across the clearing (never walk up to them)
    elephant: art(40, 28, 20, 26, (c, x, y) => {
      const body = (bx: number, s: number) => {
        R(c, 'rgba(0,0,0,0.22)', bx - 9 * s, y - 1, 18 * s, 2);
        for (const lx of [-7, -3, 2, 6]) R(c, '#6e6a70', bx + lx * s, y - 7 * s, 2 * s, 7 * s);
        blob(c, bx, y - 11 * s, Math.round(8 * s), '#7d7a80'); blob(c, bx - 2 * s, y - 13 * s, Math.round(6 * s), '#8c898f');
        blob(c, bx + 8 * s, y - 14 * s, Math.round(4 * s), '#7d7a80');                        // head
        R(c, '#6e6a70', bx + 10 * s, y - 12 * s, 2 * s, 9 * s); R(c, '#6e6a70', bx + 11 * s, y - 4 * s, 2 * s, 2 * s); // trunk
        R(c, '#5e5a60', bx + 5 * s, y - 16 * s, 3 * s, 5 * s);                               // ear
        R(c, '#222', bx + 9 * s, y - 15 * s, 1, 1);
      };
      body(x - 4, 1); body(x + 11, 0.6);
    }),
    // soro brook carp (ปลาพลวง) in a stream pool
    carp: art(22, 12, 11, 10, (c, x, y) => {
      blob(c, x, y - 4, 7, '#3f8fb8'); blob(c, x, y - 5, 5, '#5aaee0');
      for (const [fx, fy] of [[-4, -6], [1, -4], [3, -7]]) { R(c, '#4a5560', x + fx, y + fy, 4, 2); R(c, '#4a5560', x + fx - 1, y + fy, 1, 2); R(c, '#cfd8e0', x + fx + 3, y + fy, 1, 1); }
      R(c, '#e8f4fb', x - 6, y - 8, 2, 1); R(c, '#e8f4fb', x + 4, y - 3, 2, 1);
    }),
    // yellow warning sign: wild elephants cross here
    elephantSign: art(16, 22, 8, 21, (c, x, y) => {
      R(c, '#6b4528', x - 1, y - 10, 2, 10);
      R(c, '#e8b830', x - 6, y - 20, 12, 11); R(c, '#2a2a2a', x - 6, y - 20, 12, 1); R(c, '#2a2a2a', x - 6, y - 10, 12, 1);
      R(c, '#2a2a2a', x - 3, y - 17, 6, 3); R(c, '#2a2a2a', x + 2, y - 15, 2, 3); R(c, '#2a2a2a', x - 3, y - 14, 1, 2); R(c, '#2a2a2a', x + 1, y - 14, 1, 2);
    }),
  };
  for (let n = 1; n <= 8; n++) out['tier' + n] = art(14, 20, 7, 19, (c, x, y) => {
    R(c, '#6b4528', x - 1, y - 10, 2, 10); R(c, '#2a7db0', x - 6, y - 17, 12, 8);
    for (let i = 0; i < n; i++) R(c, '#f4ecd8', x - 5 + (i % 4) * 3, y - 16 + Math.floor(i / 4) * 3, 2, 2);
  });
  return out;
}

/** Waterfall cascade, 4 frames of falling water. (x, y) = stream center where it meets the pool. */
export function fallsFrames(): PropArt[] {
  return [0, 1, 2, 3].map((k) => art(42, 30, 21, 22, (c, x, y) => {
    blob(c, x - 13, y - 8, 7, '#6d6f74'); blob(c, x + 13, y - 8, 7, '#7d7f86'); blob(c, x - 12, y - 11, 4, '#4f8a3c'); blob(c, x + 14, y - 12, 3, '#4f8a3c');
    R(c, '#8a8c92', x - 10, y - 20, 20, 4);
    for (let i = 0; i < 10; i++) {
      const cx = x - 9 + i * 2;
      R(c, i % 2 ? '#bfe8f0' : '#f2fbff', cx, y - 17, 2, 16);
      R(c, '#7fcfd8', cx, y - 17 + ((k * 4 + i * 5) % 16), 2, 2);
    }
    blob(c, x, y, 7, 'rgba(255,255,255,0.75)');
    R(c, 'rgba(255,255,255,0.8)', x - 11 + (k % 2), y + 2, 3, 1); R(c, 'rgba(255,255,255,0.8)', x + 8 - (k % 2), y + 1, 3, 1);
  }));
}

/** Limestone pillar with jungle on top; the size comes from its seed. */
export function karstArt(seed: number): PropArt {
  return art(92, 110, 46, 106, (c, x, y) => {
    const rng = mulberry32(seed), w = 34 + Math.floor(rng() * 8), h = 72 + Math.floor(rng() * 30);
    R(c, 'rgba(0,0,0,0.25)', x - w - 2, y - 3, w * 2 + 4, 4);
    for (let i = 0; i < h; i++) {
      const k = i / h, hw = Math.round(w * (0.55 + 0.45 * k) + Math.sin(i * 0.4 + seed) * 2);
      R(c, '#8a8c90', x - hw, y - h + i, hw * 2, 1); R(c, '#a4a6aa', x - hw, y - h + i, Math.round(hw * 0.6), 1); R(c, '#6d6f74', x + hw - 3, y - h + i, 3, 1);
    }
    for (let i = 0; i < 6; i++) R(c, '#7a7c80', x - w + 4 + Math.floor(rng() * (w * 2 - 8)), y - h + 8 + Math.floor(rng() * 10), 1, 14 + Math.floor(rng() * 20));
    blob(c, x - 4, y - h + 2, Math.round(w * 0.6), '#2f6b2f'); blob(c, x + 6, y - h + 4, Math.round(w * 0.45), '#3f8a3a'); blob(c, x - 8, y - h, 4, '#5aa64a');
    for (let i = 0; i < 4; i++) R(c, '#3f8a3a', x - w + 6 + Math.floor(rng() * (w * 2 - 12)), y - h + 6, 1, 10 + Math.floor(rng() * 18));
    blob(c, x - w + 2, y - 4, 5, '#3f7a3a'); blob(c, x + w - 2, y - 3, 4, '#2f6b2f');
  });
}

/** Birds: frames 0-1 perched (bob), 2-3 flying (wing beat). */
export function birdFrames(kind: 'sunbird' | 'hornbill'): PropArt[] {
  return [0, 1, 2, 3].map((f) => {
    const flying = f >= 2, bob = flying ? (f === 2 ? -1 : 1) : f === 1 ? -1 : 0;
    if (kind === 'sunbird') return art(14, 22, 7, 20, (c, x, y) => {
      const yy = y - (flying ? 14 : 2) + bob;
      R(c, 'rgba(0,0,0,0.2)', x - 2, y, 4, 1);
      R(c, '#2f9a5a', x - 2, yy - 3, 4, 3); R(c, '#e04a3a', x - 1, yy - 3, 2, 1); R(c, '#2f9a5a', x - 5, yy - 2, 3, 1); R(c, '#222', x + 2, yy - 3, 2, 1);
      if (flying) R(c, '#26804a', x - 1, yy - 5 - bob, 3, 2);
    });
    return art(24, 32, 10, 30, (c, x, y) => {
      const yy = y - (flying ? 18 : 3) + bob;
      R(c, 'rgba(0,0,0,0.2)', x - 4, y, 8, 1);
      R(c, '#1e1e22', x - 4, yy - 5, 8, 5); R(c, '#1e1e22', x - 9, yy - 3, 5, 2);
      R(c, '#f4f4f4', x - 9, yy - 2, 3, 1); R(c, '#f4f4f4', x - 3, yy - 1, 6, 1);
      R(c, '#1e1e22', x + 3, yy - 8, 3, 4); R(c, '#f2c22a', x + 6, yy - 7, 5, 2); R(c, '#f2c22a', x + 5, yy - 9, 5, 2);
      R(c, '#d8402a', x + 9, yy - 9, 2, 1); R(c, '#fff', x + 4, yy - 7, 1, 1);
      if (flying) { R(c, '#2a2a30', x - 6, yy - 9 - bob * 2, 9, 3); R(c, '#f4f4f4', x - 6, yy - 9 - bob * 2, 2, 3); }
    });
  });
}

/** Barking deer facing right, 2 frames (head up / grazing). Flip for left. */
export function deerFrames(): PropArt[] {
  return [0, 1].map((head) => art(20, 22, 9, 20, (c, x, y) => {
    R(c, 'rgba(0,0,0,0.2)', x - 6, y - 1, 13, 2);
    R(c, '#7a4a26', x - 5, y - 6, 2, 6); R(c, '#7a4a26', x + 3, y - 6, 2, 6);
    R(c, '#b06a34', x - 6, y - 11, 12, 6); R(c, '#8a5028', x - 6, y - 7, 12, 1); R(c, '#f4ecd8', x - 7, y - 11, 1, 2);
    R(c, '#b06a34', x + 5, y - 15 + head * 3, 3, 5); R(c, '#9a5a2c', x + 7, y - 13 + head * 3, 3, 2);
    R(c, '#5a3a1a', x + 6, y - 17 + head * 3, 1, 2); R(c, '#222', x + 8, y - 14 + head * 3, 1, 1);
  }));
}
