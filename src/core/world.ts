/** Map generation for a trail. Pure data, no rendering, so it can be unit-tested. */
import { CONFIG } from './config';
import { mulberry32 } from './rng';
import { T, TERRAIN, type TileId } from '../data/terrain';
import type { TrailDef } from '../data/trails';

export interface Tree { x: number; y: number; type: 'broad' | 'pine'; v: number; phase: number }

export interface WorldMap {
  trail: TrailDef;
  w: number;
  h: number;
  tiles: Uint8Array;
  treeSolid: Uint8Array;
  trees: Tree[];
  pathTiles: [number, number][];
  /** Length of the main trail in world pixels; used to scale walked distance to real km. */
  pathLenPx: number;
}

export function buildWorld(trail: TrailDef): WorldMap {
  const W = CONFIG.MAP_W, H = CONFIG.MAP_H, TS = CONFIG.TILE;
  const gen = trail.gen, rng = mulberry32(gen.seed);
  const tiles = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = gen.zones[gen.zoneAt(x, y)];
    let v: TileId = rng() < z.baseP ? z.base[0] : z.base[1];
    if (gen.rock(x, y)) v = T.ROCK;
    if (gen.water(x, y)) v = T.WATER;
    tiles[y * W + x] = v;
  }

  // paths: 2-tile-wide brush along each polyline; water becomes bridge, rock is left alone
  let pathLenPx = 0;
  const lines = [{ pts: trail.waypoints, main: true, steep: false }, ...(trail.extraPaths ?? []).map((p) => ({ ...p, main: false, steep: !!p.steep }))];
  for (const line of lines) for (let i = 0; i < line.pts.length - 1; i++) {
    const [ax, ay] = line.pts[i], [bx, by] = line.pts[i + 1];
    const steep = line.main ? trail.steepSegments.some(([s, e]) => i >= s && i < e) : line.steep;
    const len = Math.hypot(bx - ax, by - ay);
    if (line.main) pathLenPx += len * TS;
    const steps = Math.ceil(len * 4);
    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(ax + ((bx - ax) * s) / steps), cy = Math.round(ay + ((by - ay) * s) / steps);
      for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
        const tx = cx + ox, ty = cy + oy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const k = ty * W + tx, cur = tiles[k];
        if (cur === T.WATER) tiles[k] = T.BRIDGE;
        else if (cur === T.ROCK || cur === T.BRIDGE) continue;
        else tiles[k] = steep ? T.STEEP : T.PATH;
      }
    }
  }

  const pathTiles: [number, number][] = [];
  const noTree = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = tiles[y * W + x];
    if (v === T.PATH || v === T.STEEP || v === T.BRIDGE) {
      if (v !== T.BRIDGE) pathTiles.push([x, y]);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) noTree[ny * W + nx] = 1;
      }
    }
  }

  const treeSolid = new Uint8Array(W * H);
  const trees: Tree[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = tiles[y * W + x];
    if (v !== T.MOSS && v !== T.GRASS && v !== T.TALL) continue;
    const r = rng(), phase = rng() * 6.28, variant = Math.floor(rng() * 3);
    if (noTree[y * W + x]) continue;
    if (trail.pois.some((p) => Math.hypot(p.x - x, p.y - y) < 2.5)) continue;
    if (Math.hypot(trail.start[0] - x, trail.start[1] - y) < 3) continue;
    const edge = x < 2 || x > W - 3 || y > H - 3;
    const zone = gen.zones[gen.zoneAt(x, y)];
    if (r < (edge ? 0.85 : zone.density)) {
      trees.push({ x: x * TS + 8, y: y * TS + 14, type: zone.tree, v: variant, phase });
      treeSolid[y * W + x] = 1;
    }
  }
  return { trail, w: W, h: H, tiles, treeSolid, trees, pathTiles, pathLenPx };
}

export function tileAt(m: WorldMap, x: number, y: number): TileId {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return T.ROCK;
  return m.tiles[y * m.w + x] as TileId;
}

export function isSolidTile(m: WorldMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  return TERRAIN[m.tiles[y * m.w + x] as TileId].solid || m.treeSolid[y * m.w + x] === 1;
}

/** Can a hiker's 8×4 px foot box stand at world position (px, py)? */
export function canStand(m: WorldMap, px: number, py: number): boolean {
  const TS = CONFIG.TILE;
  const pts: [number, number][] = [[px - 4, py - 3], [px + 4, py - 3], [px - 4, py + 1], [px + 4, py + 1]];
  return pts.every(([x, y]) => !isSolidTile(m, Math.floor(x / TS), Math.floor(y / TS)));
}

/** Tiles reachable on foot from the trail start (4-neighbour flood fill). */
export function reachable(m: WorldMap): Uint8Array {
  const seen = new Uint8Array(m.w * m.h);
  const [sx, sy] = m.trail.start;
  const q: [number, number][] = [[sx, sy]];
  seen[sy * m.w + sx] = 1;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const k = ny * m.w + nx;
      if (seen[k] || isSolidTile(m, nx, ny)) continue;
      seen[k] = 1; q.push([nx, ny]);
    }
  }
  return seen;
}
