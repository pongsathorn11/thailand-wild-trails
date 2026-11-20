/** Social Hub art: ground with paths and a cobbled plaza, the park info hut and the coffee stall. */
import { mulberry32 } from '../core/rng';
import { HUB } from '../data/hub';
import { TERRAIN, T } from '../data/terrain';
import { blob, makeCanvas } from './paint';
import type { PropArt } from './props';

type Painter = (c: CanvasRenderingContext2D, x: number, y: number) => void;
const art = (w: number, h: number, ax: number, ay: number, fn: Painter): PropArt => { const canvas = makeCanvas(w, h); fn(canvas.getContext('2d')!, ax, ay); return { canvas, ax, ay }; };
const R = (c: CanvasRenderingContext2D, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

/** Path mask and tree positions along the border (the gap at the bottom-left leads back to camp). */
export function hubLayout(): { path: Uint8Array; trees: { x: number; y: number; type: 'broad' | 'pine'; v: number; phase: number }[] } {
  const W = HUB.W, H = HUB.H, rng = mulberry32(2024), path = new Uint8Array(W * H), trees = [];
  for (const [x0, y0, x1, y1] of HUB.paths) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) path[y * W + x] = 1;
  const [g0, g1] = HUB.exitGap;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const border = x === 0 || x === W - 1 || y === 0 || (y === H - 1 && !(x >= g0 && x <= g1));
    const r = rng(), v = Math.floor(rng() * 3), phase = rng() * 6.28;
    if (border) trees.push({ x: x * 16 + 8, y: y * 16 + 14, type: (r < 0.5 ? 'broad' : 'pine') as 'broad' | 'pine', v, phase });
  }
  return { path, trees };
}

export function hubGround(path: Uint8Array): HTMLCanvasElement {
  const W = HUB.W, H = HUB.H, rng = mulberry32(7), g = makeCanvas(W * 16, H * 16), c = g.getContext('2d')!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const onPath = !!path[y * W + x], px = x * 16, py = y * 16;
    // the gathering circle around the fire is cobbled
    const plaza = onPath && x >= 10 && x <= 14 && y >= 8 && y <= 10;
    const def = TERRAIN[onPath ? T.PATH : T.GRASS];
    R(c, plaza ? '#a99a80' : def.base, px, py, 16, 16);
    if (plaza) {
      for (let i = 0; i < 4; i++) R(c, '#8d7f68', px + (i % 2) * 8 + (y % 2) * 4, py + Math.floor(i / 2) * 8, 7, 1);
      for (let i = 0; i < 4; i++) R(c, '#8d7f68', px + (i % 2) * 8 + (y % 2) * 4, py + Math.floor(i / 2) * 8, 1, 7);
      continue;
    }
    for (let i = 0; i < 10; i++) R(c, def.speck[Math.floor(rng() * def.speck.length)], px + Math.floor(rng() * 16), py + Math.floor(rng() * 16), 1, 1);
    if (!onPath && rng() < 0.1) R(c, ['#f4ecd8', '#f2c94c', '#e88aa8'][Math.floor(rng() * 3)], px + 4 + Math.floor(rng() * 8), py + 4 + Math.floor(rng() * 8), 1, 1);
  }
  return g;
}

export function buildHubArt(): Record<string, PropArt> {
  return {
    // park info hut: wooden cabin with a green roof and a map board
    infoHut: art(36, 34, 16, 31, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.22)', x - 15, y - 1, 32, 3);
      R(c, '#8a5a30', x - 13, y - 16, 28, 16); R(c, '#6b4528', x - 13, y - 16, 28, 1);
      for (let i = 0; i < 4; i++) R(c, '#7a4e28', x - 13, y - 13 + i * 4, 28, 1);
      for (let i = 0; i < 9; i++) R(c, i < 2 ? '#2f6b2f' : '#3f8a3a', x - 16 + i, y - 18 - i, 34 - i * 2, 2);
      R(c, '#3a2418', x - 3, y - 10, 6, 10); R(c, '#f2c94c', x + 1, y - 5, 1, 1);
      R(c, '#f4ecd8', x + 6, y - 13, 7, 6); R(c, '#4f8a3c', x + 7, y - 12, 3, 2); R(c, '#3b7dd8', x + 9, y - 10, 3, 1);
      R(c, '#f4ecd8', x - 11, y - 13, 6, 5); R(c, '#2f6b2f', x - 9, y - 12, 2, 3);
    }),
    // coffee stall: counter, striped awning, cups
    cafeStall: art(36, 32, 16, 29, (c, x, y) => {
      R(c, 'rgba(0,0,0,0.22)', x - 15, y - 1, 32, 3);
      R(c, '#6b4528', x - 13, y - 22, 2, 22); R(c, '#6b4528', x + 13, y - 22, 2, 22);
      for (let i = 0; i < 8; i++) R(c, i % 2 ? '#f4ecd8' : '#c0392b', x - 15 + i * 4, y - 25, 4, 6);
      for (let i = 0; i < 8; i++) R(c, i % 2 ? '#d9cfba' : '#8e2a20', x - 15 + i * 4, y - 19, 4, 1);
      R(c, '#8a5a30', x - 13, y - 10, 28, 10); R(c, '#a8703c', x - 14, y - 11, 30, 2);
      R(c, '#f4ecd8', x - 8, y - 14, 3, 3); R(c, '#f4ecd8', x - 3, y - 14, 3, 3); R(c, '#6b4528', x - 7, y - 13, 1, 1);
      blob(c, x + 7, y - 14, 2, '#3a2418'); R(c, '#f2c94c', x + 5, y - 8, 6, 3);
    }),
  };
}
