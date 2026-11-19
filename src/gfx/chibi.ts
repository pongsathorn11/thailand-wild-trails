/**
 * Big chibi portrait (40×58) for the character creator, same art as the prototype.
 * Feet at (20, 56). Frames 0-3 are a walk cycle; `blink` closes the eyes.
 */
import type { Look } from '../data/looks';
import { makeCanvas, outlined } from './paint';

export const CHIBI = { W: 40, H: 58, FX: 20, FY: 56 };
/** Head crop inside the portrait, used for option thumbnails. */
export const CHIBI_HEAD = { x: 6, y: 2, w: 28, h: 28 };

export function paintChibi(look: Look, frame = 0, blink = false): HTMLCanvasElement {
  const base = makeCanvas(CHIBI.W, CHIBI.H), c = base.getContext('2d')!, x = CHIBI.FX, y = CHIBI.FY;
  const r = (px: number, py: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x + px, y + py, w, h); };
  const hair = look.hair, skin = look.skin, shirt = look.shirt, dark = look.shirtDark || shirt;
  const pants = look.pants || '#5a4a3a', pack = look.packColor || '#3b5a8a';
  const step = [0, 1, 0, -1][frame % 4], bob = frame % 2 ? -1 : 0, hs = look.hairStyle;
  r(-11, -1, 22, 2, 'rgba(0,0,0,0.28)');
  // boots + legs (walk cycle lifts one foot)
  const lL = step === 1 ? 1 : 0, rL = step === -1 ? 1 : 0;
  r(-7, -6 - lL, 6, 5, '#6b4528'); r(-7, -6 - lL, 6, 1, '#8a5e38'); r(-7, -2 - lL, 6, 1, '#3e2614');
  r(1, -6 - rL, 6, 5, '#6b4528'); r(1, -6 - rL, 6, 1, '#8a5e38'); r(1, -2 - rL, 6, 1, '#3e2614');
  r(-6, -14 - lL + bob, 5, 8, pants); r(1, -14 - rL + bob, 5, 8, pants);
  r(-6, -16 + bob, 12, 3, pants); r(-6, -17 + bob, 12, 1, '#4a3020'); r(-1, -17 + bob, 2, 1, '#d8b26a');
  // backpack behind the torso
  r(-10, -30 + bob, 4, 13, pack); r(6, -30 + bob, 4, 13, pack); r(-8, -33 + bob, 16, 4, pack);
  r(-10, -22 + bob, 4, 1, 'rgba(0,0,0,0.25)'); r(6, -22 + bob, 4, 1, 'rgba(0,0,0,0.25)');
  // long hair / ponytail hang behind the body
  if (hs === 'long') r(-9, -42 + bob, 18, 17, hair);
  if (hs === 'ponytail') { r(7, -44 + bob, 4, 4, hair); r(9, -41 + bob, 4, 11, hair); r(8, -45 + bob, 3, 2, '#e85a8a'); }
  // torso: shirt, collar, pocket, straps
  r(-6, -28 + bob, 12, 12, shirt); r(-6, -28 + bob, 2, 12, dark);
  r(-3, -28 + bob, 6, 2, dark); r(-1, -26 + bob, 2, 1, skin);
  r(2, -24 + bob, 3, 3, dark); r(-1, -23 + bob, 1, 1, '#f4ecd8'); r(-1, -20 + bob, 1, 1, '#f4ecd8');
  r(-5, -28 + bob, 1, 10, '#3e2c24'); r(4, -28 + bob, 1, 10, '#3e2c24');
  // arms swing opposite to legs
  r(-9, -27 + bob + step, 3, 7, shirt); r(-9, -27 + bob + step, 1, 7, dark); r(-9, -20 + bob + step, 3, 3, skin);
  r(6, -27 + bob - step, 3, 7, shirt); r(6, -20 + bob - step, 3, 3, skin);
  // head
  r(-2, -29 + bob, 4, 1, skin);
  r(-7, -45 + bob, 14, 16, skin); r(-8, -43 + bob, 16, 12, skin);
  r(-9, -38 + bob, 1, 4, skin); r(8, -38 + bob, 1, 4, skin);
  // hair top + sides
  r(-8, -47 + bob, 16, 5, hair); r(-9, -44 + bob, 2, 7, hair); r(7, -44 + bob, 2, 7, hair); r(-6, -48 + bob, 12, 1, hair);
  if (hs === 'short') { r(-7, -42 + bob, 14, 2, hair); r(-7, -40 + bob, 3, 1, hair); r(4, -40 + bob, 3, 1, hair); }
  if (hs === 'spiky') {
    r(-9, -49 + bob, 3, 2, hair); r(-4, -50 + bob, 3, 3, hair); r(1, -50 + bob, 3, 3, hair); r(6, -49 + bob, 3, 2, hair); r(9, -46 + bob, 2, 2, hair);
    r(-7, -42 + bob, 4, 3, hair); r(-2, -42 + bob, 3, 2, hair); r(2, -42 + bob, 4, 3, hair); r(6, -42 + bob, 1, 2, hair);
  }
  if (hs === 'ponytail' || hs === 'bun' || hs === 'long') { r(-7, -42 + bob, 9, 2, hair); r(-7, -40 + bob, 4, 2, hair); r(5, -42 + bob, 2, 3, hair); }
  if (hs === 'bun') { r(-3, -52 + bob, 6, 5, hair); r(-2, -53 + bob, 4, 1, hair); }
  if (hs === 'long') { r(-9, -37 + bob, 2, 8, hair); r(7, -37 + bob, 2, 8, hair); }
  r(-5, -46 + bob, 4, 1, 'rgba(255,255,255,0.25)');
  // face
  const eye = '#2a1a14', ey = -37 + bob;
  if (blink || look.face === 'calm') { r(-5, ey + 2, 3, 1, eye); r(2, ey + 2, 3, 1, eye); }
  else if (look.face === 'smile') { r(-5, ey + 1, 1, 1, eye); r(-4, ey, 1, 1, eye); r(-3, ey + 1, 1, 1, eye); r(2, ey + 1, 1, 1, eye); r(3, ey, 1, 1, eye); r(4, ey + 1, 1, 1, eye); }
  else { r(-5, ey, 3, 4, eye); r(2, ey, 3, 4, eye); r(-5, ey, 1, 1, '#fff'); r(2, ey, 1, 1, '#fff'); r(-4, ey + 3, 2, 1, '#5a3a2a'); r(3, ey + 3, 2, 1, '#5a3a2a'); }
  if (look.face === 'brave') { r(-6, ey - 2, 4, 1, hair); r(2, ey - 2, 4, 1, hair); }
  if (look.body === 'female' && !blink && look.face !== 'calm') { r(-6, ey, 1, 1, eye); r(5, ey, 1, 1, eye); }
  r(-7, ey + 5, 2, 1, '#f0a0a0'); r(5, ey + 5, 2, 1, '#f0a0a0');
  if (look.face === 'smile') { r(-2, ey + 6, 4, 1, '#a0503a'); r(-1, ey + 7, 2, 1, '#c0605a'); } else r(-1, ey + 6, 2, 1, '#a0503a');
  // accessories
  if (look.acc === 'glasses' || look.acc === 'sunglasses') {
    const f = '#2a2a30';
    r(-6, ey - 1, 5, 1, f); r(-6, ey + 4, 5, 1, f); r(-6, ey - 1, 1, 6, f); r(-2, ey - 1, 1, 6, f);
    r(1, ey - 1, 5, 1, f); r(1, ey + 4, 5, 1, f); r(1, ey - 1, 1, 6, f); r(5, ey - 1, 1, 6, f); r(-1, ey + 1, 2, 1, f);
    if (look.acc === 'sunglasses') { r(-5, ey, 3, 4, '#2a2a3a'); r(2, ey, 3, 4, '#2a2a3a'); r(-5, ey, 1, 1, '#8a9ab0'); r(2, ey, 1, 1, '#8a9ab0'); }
  }
  if (look.acc === 'bucket') { r(-8, -52 + bob, 16, 6, '#d8b878'); r(-11, -47 + bob, 22, 2, '#c8a868'); r(-8, -48 + bob, 16, 1, '#6b4528'); }
  if (look.acc === 'cap') { r(-8, -52 + bob, 16, 6, '#3b7dd8'); r(-1, -53 + bob, 2, 1, '#2a5ea8'); r(3, -47 + bob, 9, 2, '#2a5ea8'); r(-6, -51 + bob, 4, 2, '#f4ecd8'); }
  return outlined(base);
}

/** Strip of 5 frames: walk 0-3, then frame 0 with eyes closed (blink). */
export function paintChibiStrip(look: Look): HTMLCanvasElement {
  const s = makeCanvas(CHIBI.W * 5, CHIBI.H), c = s.getContext('2d')!;
  for (let f = 0; f < 4; f++) c.drawImage(paintChibi(look, f), f * CHIBI.W, 0);
  c.drawImage(paintChibi(look, 0, true), 4 * CHIBI.W, 0);
  return s;
}
export const CHIBI_BLINK_FRAME = 4;

/** Head-only thumbnail on a slate square, `size` px. */
export function paintHeadThumb(look: Look, size: number, bg = '#6a8aa0'): HTMLCanvasElement {
  const cv = makeCanvas(size, size), c = cv.getContext('2d')!, spr = paintChibi(look);
  c.imageSmoothingEnabled = false;
  c.fillStyle = bg; c.fillRect(0, 0, size, size);
  c.drawImage(spr, CHIBI_HEAD.x, CHIBI_HEAD.y, CHIBI_HEAD.w, CHIBI_HEAD.h, 2, 3, size - 4, size - 4);
  return cv;
}

/** Shirt icon for the outfit row. */
export function paintShirtIcon(o: { shirt: string; dark: string; pants: string }, size: number): HTMLCanvasElement {
  const cv = makeCanvas(size, size), c = cv.getContext('2d')!, u = (size - 6) / 12;
  c.fillStyle = '#3a4450'; c.fillRect(0, 0, size, size);
  const r = (px: number, py: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(3 + px * u, 3 + py * u, w * u, h * u); };
  r(3, 2, 6, 8, o.shirt); r(1, 2, 2, 4, o.shirt); r(9, 2, 2, 4, o.shirt); r(3, 2, 1, 8, o.dark); r(5, 2, 2, 2, o.dark); r(7, 5, 2, 2, o.dark); r(3, 10, 6, 1, o.pants);
  return cv;
}
