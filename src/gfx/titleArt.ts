/**
 * Title-screen landscape (sky, misty ridges, tree line, meadow, dirt path, tent, trail sign),
 * painted at 1/S of the screen and scaled up with nearest-neighbour. Same art as the prototype.
 */
import { mulberry32 } from '../core/rng';
import { blob, makeCanvas } from './paint';

export const TITLE_SCALE = 4;

export function paintTitleBackground(w: number, h: number): HTMLCanvasElement {
  const cv = makeCanvas(w, h), c = cv.getContext('2d')!, rng = mulberry32(42), hz = Math.round(h * 0.56);
  for (let y = 0; y < hz; y++) {
    const k = y / hz, mix = (a: number, b: number) => Math.round(a + (b - a) * k);
    c.fillStyle = `rgb(${mix(104, 206)},${mix(176, 234)},${mix(228, 242)})`; c.fillRect(0, y, w, 1);
  }
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(rng() * w), cy = Math.floor(rng() * h * 0.25) + 4;
    blob(c, cx, cy, 3 + Math.floor(rng() * 3), '#f4fbff'); blob(c, cx + 5, cy + 1, 3, '#ffffff'); blob(c, cx - 5, cy + 2, 2, '#eaf6fb');
  }
  const ridge = (base: number, amp: number, f1: number, f2: number, col: string, phase: number) => {
    c.fillStyle = col;
    for (let x = 0; x < w; x++) { const top = Math.round(base - amp * (0.6 * Math.sin(x * f1 + phase) + 0.4 * Math.sin(x * f2 + phase * 2))); c.fillRect(x, top, 1, hz + 8 - top); }
  };
  ridge(h * 0.33, h * 0.08, 0.045, 0.12, '#93b4c8', 1.2);
  ridge(h * 0.42, h * 0.07, 0.06, 0.17, '#6f9a90', 2.6);
  ridge(h * 0.5, h * 0.04, 0.09, 0.23, '#4f8250', 0.4);
  for (let x = -4; x < w + 4; x += 3) {
    const ty = hz + Math.floor(rng() * 3), th = 6 + Math.floor(rng() * 6);
    if (rng() < 0.55) for (let r = 0; r < th; r++) { const hw = Math.round((r / th) * 3) + 1; c.fillStyle = r % 3 ? '#2d5e3a' : '#356a48'; c.fillRect(x - hw, ty - th + r, hw * 2, 1); }
    else blob(c, x, ty - 3, 3 + Math.floor(rng() * 2), rng() < 0.5 ? '#3f7a3a' : '#2f6b2f');
  }
  c.fillStyle = '#6fa84a'; c.fillRect(0, hz + 1, w, h - hz);
  c.fillStyle = '#5a9040'; c.fillRect(0, Math.round(h * 0.86), w, h);
  for (let i = 0; i < w * 3; i++) { c.fillStyle = rng() < 0.5 ? '#88c05a' : '#4f8a3c'; c.fillRect(Math.floor(rng() * w), hz + 2 + Math.floor(rng() * (h - hz)), 1, 1); }
  for (let y = hz + 2; y < h; y++) {
    const k = (y - hz) / (h - hz), cx = w * 0.44 + Math.sin(y * 0.09) * w * 0.04, hw = 2 + k * w * 0.09;
    c.fillStyle = '#c8a878'; c.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1);
    if (rng() < 0.4) { c.fillStyle = '#b89466'; c.fillRect(Math.round(cx - hw + rng() * hw * 2), y, 1, 1); }
  }
  const tx = Math.round(w * 0.06), tyb = Math.round(h * 0.72);
  for (let i = 0; i < 14; i++) { const hw = Math.round(i * 0.9) + 1; c.fillStyle = '#d8c8a0'; c.fillRect(tx - hw, tyb - 14 + i, hw * 2, 1); c.fillStyle = '#c0b088'; c.fillRect(tx - hw, tyb - 14 + i, hw, 1); }
  for (let i = 6; i < 14; i++) { const hw = Math.round((i - 6) * 0.4) + 1; c.fillStyle = '#5a4a32'; c.fillRect(tx - hw, tyb - 14 + i, hw * 2, 1); }
  const sx = Math.round(w * 0.4), sy = Math.round(h * 0.62);
  c.fillStyle = '#6b4528'; c.fillRect(sx, sy - 6, 1, 7); c.fillStyle = '#9a6a3a'; c.fillRect(sx - 3, sy - 7, 7, 3);
  return cv;
}

/** Thai flag stripes 1:1:2:1:1 over 12 rows. */
export const flagStripe = (j: number): number => (j < 2 || j >= 10 ? 0xd8243a : j < 4 || j >= 8 ? 0xf4f4f4 : 0x2a2f7a);
