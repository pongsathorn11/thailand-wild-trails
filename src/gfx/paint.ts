/**
 * Pixel art drawn with code (same art as the prototype). Each painter draws into a canvas,
 * which Phaser then registers as a texture. Swap these for Aseprite sprite sheets later.
 */
import { CONFIG } from '../core/config';
import { mulberry32 } from '../core/rng';
import { T, TERRAIN, type TileId } from '../data/terrain';
import type { Look } from '../data/looks';
import { tileAt, type WorldMap } from '../core/world';
import type { Dir } from '../core/hiker';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - w, cy + dy, w * 2, 1); }
}

/** Adds a 1px dark outline around everything drawn on `base`. */
export function outlined(base: HTMLCanvasElement, color = '#1e1a1c'): HTMLCanvasElement {
  const { width: w, height: h } = base;
  const sil = makeCanvas(w, h), sc = sil.getContext('2d')!;
  sc.drawImage(base, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = color; sc.fillRect(0, 0, w, h);
  const out = makeCanvas(w, h), oc = out.getContext('2d')!;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) oc.drawImage(sil, dx, dy);
  oc.drawImage(base, 0, 0);
  return out;
}

// ---------- trees: trunk and canopy are separate so the canopy can sway ----------
export interface TreeSprite { trunk: HTMLCanvasElement; canopy: HTMLCanvasElement; w: number; h: number }
export function buildTreeSprites(): { broad: TreeSprite[]; pine: TreeSprite[] } {
  const rng = mulberry32(7), broad: TreeSprite[] = [], pine: TreeSprite[] = [];
  const broadPal = [['#2f6b2f', '#3f8a3a', '#5aa64a'], ['#2d6436', '#3c8044', '#58a055'], ['#35702c', '#4a9036', '#6cb050']];
  for (let v = 0; v < 3; v++) {
    const trunk = makeCanvas(26, 30), tc = trunk.getContext('2d')!;
    tc.fillStyle = '#6b4528'; tc.fillRect(11, 17, 4, 13); tc.fillStyle = '#4e321c'; tc.fillRect(11, 17, 1, 13);
    const canopy = makeCanvas(26, 24), cc = canopy.getContext('2d')!;
    const [d, m, l] = broadPal[v];
    blob(cc, 13, 12, 10, d); blob(cc, 10 + Math.floor(rng() * 3), 10, 7, m); blob(cc, 16, 9, 5, m); blob(cc, 9, 6, 3, l);
    cc.fillStyle = l; for (let i = 0; i < 8; i++) cc.fillRect(5 + Math.floor(rng() * 14), 3 + Math.floor(rng() * 10), 1, 1);
    broad.push({ trunk, canopy, w: 26, h: 30 });
  }
  const pinePal = [['#2d5e3a', '#3f7a4a'], ['#2a573a', '#3a7048'], ['#305f34', '#467e44']];
  for (let v = 0; v < 3; v++) {
    const trunk = makeCanvas(18, 30), tc = trunk.getContext('2d')!;
    tc.fillStyle = '#5e3c22'; tc.fillRect(8, 21, 2, 9);
    const canopy = makeCanvas(18, 24), cc = canopy.getContext('2d')!;
    const [d, l] = pinePal[v];
    for (let i = 0; i < 4; i++) {
      const top = 1 + i * 5, hw = 3 + i * 2;
      for (let r = 0; r < 8; r++) { const w = Math.round((r / 7) * hw) + 1; cc.fillStyle = d; cc.fillRect(9 - w, top + r, w * 2, 1); cc.fillStyle = l; cc.fillRect(9 - w, top + r, w, 1); }
    }
    pine.push({ trunk, canopy, w: 18, h: 30 });
  }
  return { broad, pine };
}

// ---------- ground ----------
export function renderGround(m: WorldMap): HTMLCanvasElement {
  const TS = CONFIG.TILE, rng = mulberry32(m.trail.gen.seed + 1);
  const g = makeCanvas(m.w * TS, m.h * TS), c = g.getContext('2d')!;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const v = m.tiles[y * m.w + x] as TileId, def = TERRAIN[v], px = x * TS, py = y * TS;
    if (v === T.BRIDGE) {
      c.fillStyle = m.trail.gen.waterBase || TERRAIN[T.WATER].base; c.fillRect(px, py, TS, TS);
      c.fillStyle = def.base; c.fillRect(px, py + 1, TS, TS - 2);
      c.fillStyle = def.speck[0]; for (let i = 0; i < TS; i += 4) c.fillRect(px + i, py + 1, 1, TS - 2);
      c.fillStyle = '#5a3818'; c.fillRect(px, py + 1, TS, 1); c.fillRect(px, py + TS - 2, TS, 1);
      continue;
    }
    const waterC = v === T.WATER ? m.trail.gen.waterBase : undefined;
    c.fillStyle = waterC || def.base; c.fillRect(px, py, TS, TS);
    for (let i = 0; i < 10; i++) { c.fillStyle = waterC ? '#5cc8b8' : def.speck[Math.floor(rng() * def.speck.length)]; c.fillRect(px + Math.floor(rng() * TS), py + Math.floor(rng() * TS), 1, 1); }
    if (v === T.TALL) { c.fillStyle = '#8c9c48'; for (let i = 0; i < 4; i++) c.fillRect(px + Math.floor(rng() * 15), py + Math.floor(rng() * 13), 1, 3); }
    if (v === T.MOSS && rng() < 0.12) {
      c.fillStyle = '#6aa64a'; const fx = px + 4 + Math.floor(rng() * 8), fy = py + 6 + Math.floor(rng() * 6);
      c.fillRect(fx, fy, 1, 3); c.fillRect(fx - 2, fy + 1, 2, 1); c.fillRect(fx + 1, fy + 1, 2, 1);
    }
    if (v === T.STEEP) { c.fillStyle = '#9c7c58'; c.fillRect(px, py + 5, TS, 1); c.fillRect(px, py + 11, TS, 1); }
    if (v === T.ROCK && tileAt(m, x, y + 1) !== T.ROCK) { c.fillStyle = '#55575e'; c.fillRect(px, py + 11, TS, 5); }
    if ((v === T.PATH || v === T.STEEP) && rng() < 0.15) { c.fillStyle = '#9a8a78'; c.fillRect(px + Math.floor(rng() * 12), py + Math.floor(rng() * 12), 2, 2); }
  }
  return g;
}

// ---------- in-game mini chibi: 18×30, feet at (9, 28) ----------
export const MINI = { W: 18, H: 30, FX: 9, FY: 28 };
export function paintMini(look: Look, dir: Dir, frame: number, sit: boolean): HTMLCanvasElement {
  const base = makeCanvas(MINI.W, MINI.H), c = base.getContext('2d')!;
  const r = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y + 2, w, h); };
  const hair = look.hair, skin = look.skin, shirt = look.shirt, dark = look.shirtDark || shirt, pants = look.pants || '#4a4f5e';
  const pack = look.packColor || '#c0582a', hasPack = look.pack !== false, boot = '#5a3a22', eye = '#2a1a14';
  const hs = look.hairStyle || 'short', step = sit ? 0 : [0, 1, 0, -1][frame % 4], side = dir === 'left' || dir === 'right';
  const hat = look.acc === 'bucket' || look.acc === 'cap' ? look.acc : look.hat && look.hat !== 'none' ? look.hat : null;
  r(4, 25, 10, 2, 'rgba(0,0,0,0.28)');
  if (sit) { r(5, 20, 8, 2, pants); r(4, 21, 2, 3, boot); r(12, 21, 2, 3, boot); }
  else if (side) {
    const f = dir === 'right' ? 1 : -1;
    r(8 + step * f, 19, 2, 4, pants); r(8 + step * f + (f > 0 ? 0 : -1), 23, 3, 2, boot);
    r(8 - step * f, 19, 2, 4, pants); r(8 - step * f + (f > 0 ? 0 : -1), 23, 3, 2, boot);
  } else {
    const lL = step === 1 ? 1 : 0, rL = step === -1 ? 1 : 0;
    r(6, 19, 2, 4 - lL, pants); r(6, 23 - lL, 2, 2, boot); r(10, 19, 2, 4 - rL, pants); r(10, 23 - rL, 2, 2, boot);
  }
  const by = sit ? 2 : 0;
  if (hs === 'long' && dir !== 'up') { if (dir === 'down') { r(3, 5 + by, 2, 9, hair); r(13, 5 + by, 2, 9, hair); } else r(dir === 'left' ? 10 : 3, 5 + by, 5, 9, hair); }
  if (hs === 'ponytail' && side) r(dir === 'left' ? 14 : 1, 6 + by, 3, 6, hair);
  if (hasPack && dir === 'down') { r(3, 13 + by, 2, 6, pack); r(13, 13 + by, 2, 6, pack); }
  if (hasPack && dir === 'left') r(12, 12 + by, 3, 7, pack);
  if (hasPack && dir === 'right') r(3, 12 + by, 3, 7, pack);
  r(5, 13 + by, 8, 6, shirt); r(5, 13 + by, 1, 6, dark); r(5, 18 + by, 8, 1, '#4a3020');
  if (dir === 'down') { r(8, 13 + by, 2, 1, dark); r(6, 13 + by, 1, 5, '#3e2c24'); r(11, 13 + by, 1, 5, '#3e2c24'); }
  if (side) { const f = dir === 'right' ? 1 : -1; r(8 + step * f, 14 + by, 2, 4, shirt); r(8 + step * f, 18 + by, 2, 1, skin); }
  else { r(4, 14 + by + step, 1, 4, shirt); r(4, 18 + by + step, 1, 1, skin); r(13, 14 + by - step, 1, 4, shirt); r(13, 18 + by - step, 1, 1, skin); }
  if (hasPack && dir === 'up') { r(4, 11 + by, 10, 9, pack); r(4, 11 + by, 10, 2, 'rgba(0,0,0,0.2)'); r(6, 14 + by, 6, 1, 'rgba(0,0,0,0.25)'); }
  r(4, 3 + by, 10, 10, skin); r(3, 5 + by, 12, 7, skin);
  if (dir === 'up') r(3, 1 + by, 12, 11, hair);
  else {
    r(3, 1 + by, 12, 4, hair); r(4, 0 + by, 10, 1, hair);
    if (dir === 'down') { r(3, 5 + by, 2, 4, hair); r(13, 5 + by, 2, 4, hair); }
    if (dir === 'left') r(10, 4 + by, 5, 6, hair);
    if (dir === 'right') r(3, 4 + by, 5, 6, hair);
    const bx0 = dir === 'left' ? 3 : dir === 'right' ? 7 : 5;
    if (hs === 'spiky') { r(bx0, 5 + by, 2, 2, hair); r(bx0 + 3, 5 + by, 2, 1, hair); r(bx0 + 6, 5 + by, 2, 2, hair); }
    else if (hs === 'short') r(bx0, 5 + by, 8, 1, hair);
    else { r(bx0, 5 + by, 5, 1, hair); r(bx0, 6 + by, 2, 1, hair); }
  }
  if (hs === 'spiky') { r(3, -1 + by, 2, 2, hair); r(7, -2 + by, 2, 2, hair); r(11, -1 + by, 2, 2, hair); }
  if (hs === 'bun' && !hat) r(7, -1 + by, 4, 2, hair);
  if (hs === 'ponytail' && dir === 'up') r(8, 12 + by, 2, 4, hair);
  if (hs === 'ponytail' && dir === 'down') r(14, 6 + by, 2, 4, hair);
  if (dir !== 'up') {
    const ex = dir === 'down' ? [6, 10] : dir === 'left' ? [4] : [12];
    for (const x of ex) {
      if (look.face === 'smile' || look.face === 'calm') r(x, 9 + by, 2, 1, eye);
      else { r(x, 8 + by, 2, 2, eye); r(x, 8 + by, 1, 1, '#fff'); }
      if (look.face === 'brave') r(x, 7 + by, 2, 1, hair);
    }
    if (dir === 'down') { r(5, 11 + by, 1, 1, '#f0a0a0'); r(12, 11 + by, 1, 1, '#f0a0a0'); r(8, 12 + by, 2, 1, '#a0503a'); }
    else r(dir === 'left' ? 5 : 12, 11 + by, 1, 1, '#f0a0a0');
    if (look.acc === 'glasses' || look.acc === 'sunglasses') {
      const g = look.acc === 'sunglasses' ? '#22222a' : '#3a3a40';
      for (const x of ex) { if (look.acc === 'sunglasses') r(x - 1, 8 + by, 3, 2, g); else { r(x - 1, 7 + by, 3, 1, g); r(x - 1, 10 + by, 3, 1, g); } }
      if (dir === 'down') r(8, 8 + by, 2, 1, g);
    }
  }
  if (hat === 'bucket') { const hc = look.hatColor || '#d8b878'; r(4, -1 + by, 10, 4, hc); r(2, 3 + by, 14, 1, hc); r(4, 2 + by, 10, 1, '#6b4528'); }
  if (hat === 'cap') {
    r(4, -1 + by, 10, 4, '#3b7dd8'); r(6, 0 + by, 3, 1, '#f4ecd8');
    if (dir === 'down') r(4, 3 + by, 10, 1, '#2a5ea8'); else if (dir === 'left') r(1, 3 + by, 5, 1, '#2a5ea8'); else if (dir === 'right') r(12, 3 + by, 5, 1, '#2a5ea8');
  }
  return outlined(base);
}

/** One sprite sheet: rows = down/left/right/up, columns = walk frames 0-3, plus a sitting frame at the end of row 0. */
export function paintMiniSheet(look: Look): HTMLCanvasElement {
  const dirs: Dir[] = ['down', 'left', 'right', 'up'];
  const sheet = makeCanvas(MINI.W * 5, MINI.H * 4), c = sheet.getContext('2d')!;
  dirs.forEach((d, row) => { for (let f = 0; f < 4; f++) c.drawImage(paintMini(look, d, f, false), f * MINI.W, row * MINI.H); });
  c.drawImage(paintMini(look, 'down', 0, true), 4 * MINI.W, 0);
  return sheet;
}
export const miniFrameIndex = (dir: Dir, frame: number): number => ['down', 'left', 'right', 'up'].indexOf(dir) * 5 + (frame % 4);
export const MINI_SIT_FRAME = 4;
