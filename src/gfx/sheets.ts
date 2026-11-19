import type Phaser from 'phaser';
import type { Look } from '../data/looks';
import { MINI, paintMiniSheet } from './paint';

/** (Re)registers a mini-chibi sheet: 4 rows (down/left/right/up) × 5 frames (walk 0-3, sit). */
export function installMiniSheet(textures: Phaser.Textures.TextureManager, key: string, look: Look): void {
  if (textures.exists(key)) textures.remove(key);
  const tex = textures.addCanvas(key, paintMiniSheet(look))!;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) tex.add(row * 5 + col, 0, col * MINI.W, row * MINI.H, MINI.W, MINI.H);
}

/** (Re)registers equal-width frames laid side by side in one canvas. */
export function installStrip(textures: Phaser.Textures.TextureManager, key: string, canvas: HTMLCanvasElement, frameW: number): void {
  if (textures.exists(key)) textures.remove(key);
  const tex = textures.addCanvas(key, canvas)!, n = Math.floor(canvas.width / frameW);
  for (let i = 0; i < n; i++) tex.add(i, 0, i * frameW, 0, frameW, canvas.height);
}
