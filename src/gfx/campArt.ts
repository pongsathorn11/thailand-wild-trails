/** Camp art (same as the prototype): ground, fixed objects, furniture and garden plots. */
import { mulberry32 } from '../core/rng';
import { CAMP, CROPS } from '../data/camp';
import { TERRAIN, T } from '../data/terrain';
import { blob, makeCanvas } from './paint';
import type { PropArt } from './props';
import type { Plot } from '../core/camp';
import { plotStage } from '../core/camp';

type Painter = (c: CanvasRenderingContext2D, x: number, y: number) => void;
const art = (w: number, h: number, ax: number, ay: number, fn: Painter): PropArt => { const canvas = makeCanvas(w, h); fn(canvas.getContext('2d')!, ax, ay); return { canvas, ax, ay }; };
const R = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

/** Path mask, solid tiles (border trees + fixed objects) and tree positions. */
export function campLayout(): { path: Uint8Array; solid: Uint8Array; trees: { x: number; y: number; type: 'broad' | 'pine'; v: number; phase: number }[] } {
  const W = CAMP.W, H = CAMP.H, rng = mulberry32(99), path = new Uint8Array(W * H), solid = new Uint8Array(W * H), trees = [];
  for (const [x0, y0, x1, y1] of CAMP.paths) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) path[y * W + x] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const border = x === 0 || x === W - 1 || y === 0 || (y === H - 1 && !(x >= 2 && x <= 3));
    const r = rng(), v = Math.floor(rng() * 3), phase = rng() * 6.28;
    if (border) { trees.push({ x: x * 16 + 8, y: y * 16 + 14, type: (r < 0.5 ? 'broad' : 'pine') as 'broad' | 'pine', v, phase }); solid[y * W + x] = 1; }
  }
  for (const f of CAMP.fixed) if (f.type !== 'trailSign') { solid[f.y * W + f.x] = 1; if (f.type === 'tent') solid[f.y * W + f.x + 1] = 1; }
  return { path, solid, trees };
}

export function campGround(path: Uint8Array): HTMLCanvasElement {
  const W = CAMP.W, H = CAMP.H, rng = mulberry32(99 * 7), g = makeCanvas(W * 16, H * 16), c = g.getContext('2d')!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const def = TERRAIN[path[y * W + x] ? T.PATH : T.GRASS], px = x * 16, py = y * 16;
    R(c, def.base, px, py, 16, 16);
    for (let i = 0; i < 10; i++) R(c, def.speck[Math.floor(rng() * def.speck.length)], px + Math.floor(rng() * 16), py + Math.floor(rng() * 16), 1, 1);
    if (!path[y * W + x] && rng() < 0.08) R(c, ['#f4ecd8', '#f2c94c', '#e88aa8'][Math.floor(rng() * 3)], px + 4 + Math.floor(rng() * 8), py + 4 + Math.floor(rng() * 8), 1, 1);
  }
  return g;
}

export function buildCampArt(): Record<string, PropArt> {
  return {
    tent: art(36, 26, 18, 25, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.22)', x - 17, y - 1, 34, 3);
      for (let i = 0; i < 20; i++) { const w = Math.round(i * 0.85) + 1; R(c, '#d9783a', x - w, y - 20 + i, w * 2, 1); R(c, '#b85e28', x - w, y - 20 + i, w, 1); }
      for (let i = 7; i < 20; i++) { const w = Math.round((i - 7) * 0.45) + 1; R(c, '#3a2418', x - w, y - 20 + i, w * 2, 1); }
      R(c, '#6b4528', x - 1, y - 23, 2, 4);
    }),
    board: art(22, 22, 11, 21, (c, x, y) => {
      R(c, '#6b4528', x - 8, y - 14, 2, 14); R(c, '#6b4528', x + 6, y - 14, 2, 14);
      R(c, '#8a5a30', x - 10, y - 20, 20, 12);
      R(c, '#f4ecd8', x - 8, y - 18, 5, 6); R(c, '#f4ecd8', x + 2, y - 18, 5, 4); R(c, '#f2c94c', x - 2, y - 17, 4, 6);
    }),
    mailbox: art(14, 18, 6, 17, (c, x, y) => {
      R(c, '#6b4528', x - 1, y - 9, 2, 9); R(c, '#c0392b', x - 5, y - 15, 10, 7); R(c, '#8e2a20', x - 5, y - 9, 10, 1);
      R(c, '#f2c94c', x + 5, y - 16, 1, 5); R(c, '#f2c94c', x + 6, y - 16, 2, 2);
    }),
    trailSign: art(18, 20, 8, 19, (c, x, y) => {
      R(c, '#6b4528', x - 1, y - 12, 2, 12); R(c, '#4f7a3a', x - 8, y - 18, 14, 7);
      R(c, '#4f7a3a', x + 6, y - 17, 1, 5); R(c, '#4f7a3a', x + 7, y - 16, 1, 3);
      R(c, '#f4ecd8', x - 5, y - 15, 8, 1); R(c, '#f4ecd8', x + 1, y - 16, 1, 3);
    }),
    flower_pot: art(12, 18, 6, 17, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.2)', x - 5, y - 1, 10, 2); R(c, '#b8643a', x - 4, y - 6, 8, 6); R(c, '#9a4e2a', x - 4, y - 6, 8, 1);
      blob(c, x, y - 9, 4, '#3f8a3a');
      R(c, '#e88aa8', x - 3, y - 12, 2, 2); R(c, '#f2c94c', x + 1, y - 11, 2, 2); R(c, '#f4ecd8', x - 1, y - 14, 2, 2);
    }),
    lantern: art(22, 24, 11, 22, (c, x, y) => {
      blob(c, x, y - 12, 9, 'rgba(255,210,120,0.16)');
      R(c, '#3a3a3a', x - 1, y - 12, 2, 12); R(c, '#3a3a3a', x - 1, y - 14, 5, 1);
      R(c, '#ffcf5a', x + 2, y - 13, 3, 4); R(c, '#fff2a8', x + 3, y - 12, 1, 2);
    }),
    hammock: art(26, 18, 13, 16, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.2)', x - 10, y - 1, 20, 2);
      R(c, '#6b4528', x - 11, y - 14, 2, 14); R(c, '#6b4528', x + 9, y - 14, 2, 14);
      for (let i = 0; i < 18; i++) R(c, i % 4 < 2 ? '#3b7dd8' : '#e8a33d', x - 9 + i, y - 11 + Math.round(Math.sin((i / 17) * Math.PI) * 4), 1, 2);
    }),
    rock_garden: art(18, 12, 9, 11, (c, x, y) => {
      blob(c, x - 3, y - 4, 4, '#7d7f86'); blob(c, x + 3, y - 3, 3, '#9a9ca2'); blob(c, x - 3, y - 6, 2, '#4f8a3c');
      R(c, '#e88aa8', x + 5, y - 7, 1, 1); R(c, '#f4ecd8', x - 6, y - 2, 1, 1);
    }),
  };
}

/** Campfire, 3 flicker frames. */
export function campfireFrames(): PropArt[] {
  return [[0, 0], [1.5, -1], [-1, 1]].map(([f, g]) => art(30, 26, 15, 22, (c, x, y) => {
    blob(c, x, y - 4, 13, 'rgba(255,170,70,0.12)');
    for (const [sx, sy] of [[-7, -2], [-4, 0], [1, 0], [5, -2], [-6, -5], [4, -5]]) R(c, '#7d7f86', x + sx, y + sy, 3, 2);
    R(c, '#6b4528', x - 5, y - 3, 10, 2); R(c, '#4e321c', x - 2, y - 5, 4, 4);
    R(c, '#e8562a', x - 3, y - 9 - Math.round(f), 6, 6 + Math.round(f));
    R(c, '#f5a623', x - 2, y - 8 - Math.round(g), 4, 5 + Math.round(g));
    R(c, '#fff2a8', x - 1, y - 6, 2, 3);
  }));
}

/** Draws all garden plots into one camp-sized canvas (redrawn when something changes). */
export function paintPlots(c: CanvasRenderingContext2D, plots: Plot[], sway: number): void {
  c.clearRect(0, 0, CAMP.W * 16, CAMP.H * 16);
  for (const pl of plots) {
    const x = pl.x * 16, y = pl.y * 16;
    R(c, pl.watered ? '#4a321e' : '#6b4a2e', x + 1, y + 1, 14, 14);
    R(c, pl.watered ? '#3a2616' : '#5a3d24', x + 2, y + 5, 12, 1); R(c, pl.watered ? '#3a2616' : '#5a3d24', x + 2, y + 10, 12, 1);
    if (!pl.cropId) continue;
    const crop = CROPS[pl.cropId], cx = x + 8, cy = y + 12, stage = plotStage(pl), s = (pl.x + pl.y) % 2 ? sway : 0;
    if (stage === 0) { R(c, '#c8a878', cx - 1, cy - 2, 2, 2); R(c, crop.leaf, cx, cy - 3, 1, 1); }
    if (stage === 1) { R(c, crop.leaf, cx, cy - 5, 1, 4); R(c, crop.leaf, cx - 2 + s, cy - 5, 2, 1); R(c, crop.leaf, cx + 1 + s, cy - 4, 2, 1); }
    if (stage >= 2) { blob(c, cx + s, cy - 5, stage === 2 ? 3 : 5, crop.leaf); R(c, '#5aa64a', cx - 1 + s, cy - 7, 1, 1); }
    if (stage === 3) for (const [fx, fy] of [[-3, -6], [2, -8], [1, -3], [-2, -2], [3, -5]]) R(c, crop.fruit, cx + fx + s, cy + fy, 2, 2);
  }
}
