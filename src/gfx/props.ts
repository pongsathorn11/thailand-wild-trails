/** Trail props painted once into small canvases. (ax, ay) is the foot point inside the canvas. */
import { makeCanvas } from './paint';

export interface PropArt { canvas: HTMLCanvasElement; ax: number; ay: number }
type Painter = (c: CanvasRenderingContext2D, x: number, y: number) => void;
const prop = (w: number, h: number, ax: number, ay: number, fn: Painter): PropArt => {
  const canvas = makeCanvas(w, h); fn(canvas.getContext('2d')!, ax, ay); return { canvas, ax, ay };
};

export function buildProps(): Record<string, PropArt> {
  return {
    sign: prop(20, 20, 10, 19, (c, x, y) => {
      c.fillStyle = '#6b4528'; c.fillRect(x - 1, y - 10, 2, 10);
      c.fillStyle = '#8a5a30'; c.fillRect(x - 8, y - 17, 16, 9);
      c.fillStyle = '#d8b37a'; c.fillRect(x - 7, y - 16, 14, 7);
      c.fillStyle = '#8a5a30'; c.fillRect(x - 5, y - 14, 10, 1); c.fillRect(x - 5, y - 12, 7, 1);
    }),
    bench: prop(22, 14, 11, 13, (c, x, y) => {
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x - 9, y - 1, 18, 2);
      c.fillStyle = '#5a3818'; c.fillRect(x - 7, y - 4, 2, 4); c.fillRect(x + 5, y - 4, 2, 4);
      c.fillStyle = '#9a6a3a'; c.fillRect(x - 9, y - 6, 18, 3);
      c.fillStyle = '#7a4e28'; c.fillRect(x - 9, y - 11, 18, 2); c.fillRect(x - 8, y - 9, 1, 3); c.fillRect(x + 7, y - 9, 1, 3);
    }),
    viewpoint: prop(48, 22, 18, 21, (c, x, y) => {
      c.fillStyle = '#6b4528'; for (let i = -16; i <= 16; i += 8) c.fillRect(x + i, y - 9, 2, 9);
      c.fillStyle = '#9a6a3a'; c.fillRect(x - 16, y - 9, 34, 2); c.fillRect(x - 16, y - 5, 34, 1);
      c.fillStyle = '#6b4528'; c.fillRect(x + 20, y - 12, 2, 12);
      c.fillStyle = '#2f5d8a'; c.fillRect(x + 16, y - 18, 10, 7);
      c.fillStyle = '#fff'; c.fillRect(x + 18, y - 16, 6, 4); c.fillStyle = '#2f5d8a'; c.fillRect(x + 20, y - 15, 2, 2);
    }),
    goal: prop(30, 32, 12, 31, (c, x, y) => {
      c.fillStyle = '#6b4528'; c.fillRect(x - 6, y - 12, 2, 12); c.fillRect(x + 4, y - 12, 2, 12);
      c.fillStyle = '#8a5a30'; c.fillRect(x - 9, y - 20, 18, 9);
      c.fillStyle = '#e8c88a'; c.fillRect(x - 8, y - 19, 16, 7);
      c.fillStyle = '#c0392b'; c.fillRect(x - 3, y - 18, 6, 5); c.fillStyle = '#e8c88a'; c.fillRect(x - 2, y - 17, 4, 3);
      c.fillStyle = '#555'; c.fillRect(x + 9, y - 28, 1, 28);
      c.fillStyle = '#e74c3c'; c.fillRect(x + 10, y - 28, 8, 5);
    }),
  };
}

/** Soft white disc used to cut a light hole in the night overlay. */
export function lightMask(radius: number): HTMLCanvasElement {
  const s = radius * 2, cv = makeCanvas(s, s), c = cv.getContext('2d')!;
  const g = c.createRadialGradient(radius, radius, radius * 0.25, radius, radius, radius);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  return cv;
}
