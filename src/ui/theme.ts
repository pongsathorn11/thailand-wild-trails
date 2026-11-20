/**
 * Wood & paper pixel UI kit (design: "Wild Trails UI ใหม่" canvas).
 * Every HUD and menu draws its frames with these helpers so the look stays in one place.
 * Frames have 4 px pixel-notched corners, hard borders and flat bevels: no rounded corners, no blur.
 */
import type Phaser from 'phaser';

export const FONT = 'Mitr, "Noto Sans Thai", Tahoma, sans-serif';
/** Latin-only pixel face for the logo, numbers and key caps; Thai falls back to Mitr. */
export const PIXEL_FONT = '"Pixelify Sans", Mitr, "Noto Sans Thai", sans-serif';

export const C = {
  // wood
  woodDeep: 0x2b180c, woodDark: 0x3a2213, woodShade: 0x5f3b1c, wood: 0x8b5a2b, woodLight: 0xb47a42,
  // paper
  paperLight: 0xfbf0d4, paper: 0xf2e2bc, paperShade: 0xe3c98f, paperLine: 0xd8bd84, paperEdge: 0x5c3a1e,
  // accents
  gold: 0xf2c14e, goldShade: 0xc99a2e, green: 0x5f9e3a, greenDark: 0x24461a, greenShade: 0x3d7326, greenLight: 0x8cc65a,
  red: 0xd9583b, disabled: 0xc9b48c, disabledEdge: 0x8a7050,
  // stat bars (always shown with a label, never color alone)
  stamina: 0x6fbf4a, hunger: 0xe39b3a, thirst: 0x4aa3d8, warmth: 0xd9583b, cold: 0x7fb2e5,
};

/** Text colors as CSS strings for Phaser text. */
export const TX = {
  cream: '#fff4dc', creamDim: '#f2d9a8', gold: '#f2c14e', ink: '#3a2414', inkSoft: '#5c4a36', inkFaint: '#7a5a3a',
  green: '#3d7326', greenOnWood: '#a3dd7a', red: '#b23a22', redOnWood: '#ff9a8a', sky: '#bfe3ff', woodShadow: '#3a2213',
};

type G = Phaser.GameObjects.Graphics;

/** Filled rectangle with 1-step pixel notches of size c at each corner. */
export function notch(g: G, x: number, y: number, w: number, h: number, c: number, color: number, alpha = 1): void {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w <= 2 * c || h <= 2 * c) { g.fillStyle(color, alpha).fillRect(x, y, w, h); return; }
  g.fillStyle(color, alpha);
  g.fillRect(x + c, y, w - 2 * c, h);
  g.fillRect(x, y + c, c, h - 2 * c);
  g.fillRect(x + w - c, y + c, c, h - 2 * c);
}

/** Wood sign: dark border, plank fill, light top bevel, dark bottom bevel. */
export function wood(g: G, x: number, y: number, w: number, h: number, alpha = 1): void {
  notch(g, x, y, w, h, 4, C.woodDark, alpha);
  notch(g, x + 4, y + 4, w - 8, h - 8, 0, C.wood, alpha);
  g.fillStyle(C.woodLight, alpha).fillRect(Math.round(x + 4), Math.round(y + 4), Math.round(w - 8), 3);
  g.fillStyle(C.woodShade, alpha).fillRect(Math.round(x + 4), Math.round(y + h - 7), Math.round(w - 8), 3);
}

/** Notebook paper: brown edge, parchment fill, light inner line, darker bottom band. */
export function paper(g: G, x: number, y: number, w: number, h: number, alpha = 1): void {
  notch(g, x, y, w, h, 4, C.paperEdge, alpha);
  g.fillStyle(C.paperShade, alpha).fillRect(Math.round(x + 4), Math.round(y + 4), Math.round(w - 8), Math.round(h - 8));
  g.fillStyle(C.paperLight, alpha).fillRect(Math.round(x + 4), Math.round(y + 4), Math.round(w - 8), Math.round(h - 12));
  g.fillStyle(C.paper, alpha).fillRect(Math.round(x + 7), Math.round(y + 7), Math.round(w - 14), Math.round(h - 18));
}

/** Small dark label behind world text (name tags, prompts). */
export function tag(g: G, x: number, y: number, w: number, h: number, alpha = 0.85): void {
  notch(g, x, y, w, h, 2, C.woodDeep, alpha);
}

/** Backpack / hotbar slot. */
export function slot(g: G, x: number, y: number, s: number, selected = false, empty = false): void {
  if (selected) notch(g, x - 3, y - 3, s + 6, s + 6, 2, C.gold);
  g.fillStyle(C.woodDeep, 1).fillRect(Math.round(x), Math.round(y), s, s);
  g.fillStyle(empty ? 0x4f3118 : C.woodShade, 1).fillRect(Math.round(x + 3), Math.round(y + 3), s - 6, s - 6);
  g.fillStyle(C.woodDark, 1).fillRect(Math.round(x + 3), Math.round(y + 3), s - 6, 3);
}

/** Pixel stat bar: dark track, flat fill with a lighter top line. v is 0..1. */
export function bar(g: G, x: number, y: number, w: number, h: number, v: number, color: number, track: number = C.paperEdge): void {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle(track, 1).fillRect(x, y, Math.round(w), h);
  const fw = Math.round((w - 4) * Math.max(0, Math.min(1, v)));
  if (fw > 0) {
    g.fillStyle(color, 1).fillRect(x + 2, y + 2, fw, h - 4);
    g.fillStyle(0xffffff, 0.3).fillRect(x + 2, y + 2, fw, Math.max(1, Math.floor((h - 4) / 3)));
  }
}

/** Big green action button (start, set off, confirm). */
export function greenButton(g: G, x: number, y: number, w: number, h: number, pressed = false): void {
  notch(g, x, y, w, h, 4, C.greenDark);
  g.fillStyle(C.greenShade, 1).fillRect(Math.round(x + 4), Math.round(y + 4), Math.round(w - 8), Math.round(h - 8));
  g.fillStyle(pressed ? C.greenShade : C.green, 1).fillRect(Math.round(x + 4), Math.round(y + 4), Math.round(w - 8), Math.round(h - 14));
  if (!pressed) g.fillStyle(C.greenLight, 1).fillRect(Math.round(x + 4), Math.round(y + 4), Math.round(w - 8), 4);
}

/** Wooden small button (arrows, steppers, system buttons). Disabled ones turn pale. */
export function woodButton(g: G, x: number, y: number, w: number, h: number, disabled = false, on = false): void {
  if (disabled) { notch(g, x, y, w, h, 3, C.disabledEdge); g.fillStyle(C.disabled, 1).fillRect(Math.round(x + 3), Math.round(y + 3), Math.round(w - 6), Math.round(h - 6)); return; }
  notch(g, x, y, w, h, 3, C.woodDeep);
  g.fillStyle(on ? C.gold : C.wood, 1).fillRect(Math.round(x + 3), Math.round(y + 3), Math.round(w - 6), Math.round(h - 6));
  g.fillStyle(on ? 0xf8dc8a : C.woodLight, 1).fillRect(Math.round(x + 3), Math.round(y + 3), Math.round(w - 6), 3);
  g.fillStyle(on ? C.goldShade : C.woodShade, 1).fillRect(Math.round(x + 3), Math.round(y + h - 6), Math.round(w - 6), 3);
}

/** Gold key cap behind a key letter ("E"). */
export function keyCap(g: G, x: number, y: number, w: number, h: number): void {
  notch(g, x, y, w, h, 2, C.woodDark);
  g.fillStyle(C.gold, 1).fillRect(Math.round(x + 3), Math.round(y + 3), Math.round(w - 6), Math.round(h - 6));
  g.fillStyle(C.goldShade, 1).fillRect(Math.round(x + 3), Math.round(y + h - 6), Math.round(w - 6), 3);
}

/** Red notification dot; draw the number on top. */
export function badge(g: G, x: number, y: number, s = 18): void {
  notch(g, x, y, s, s, 2, C.woodDeep);
  g.fillStyle(C.red, 1).fillRect(Math.round(x + 2), Math.round(y + 2), s - 4, s - 4);
}

/** Two short posts that hang one sign under another. */
export function posts(g: G, x1: number, x2: number, y: number, h: number): void {
  g.fillStyle(C.woodDark, 1).fillRect(Math.round(x1 - 4), Math.round(y), 8, h).fillRect(Math.round(x2 - 4), Math.round(y), 8, h);
}

/** Paper divider line. */
export function rule(g: G, x: number, y: number, w: number): void {
  g.fillStyle(C.paperLine, 1).fillRect(Math.round(x), Math.round(y), Math.round(w), 3);
}

/** Dim the scene behind a modal. */
export function scrim(g: G, w: number, h: number, a = 0.5): void {
  g.fillStyle(0x0f170c, a).fillRect(0, 0, w, h);
}
