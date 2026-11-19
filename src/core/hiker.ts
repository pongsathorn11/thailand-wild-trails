/**
 * Hiker simulation for one hike: movement, stamina, hunger, thirst and body warmth.
 * No Phaser here; the scene feeds input and reads the state, so the rules can be tested.
 */
import { CONFIG } from './config';
import { clamp } from './rng';
import { T, TERRAIN, type TileId } from '../data/terrain';
import type { WeatherId } from '../data/trails';
import { canStand, tileAt, type WorldMap } from './world';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Input { left: boolean; right: boolean; up: boolean; down: boolean; run: boolean }

export interface Hiker {
  x: number; y: number; dir: Dir; frame: number; animT: number;
  moving: boolean; running: boolean; sitting: boolean; exhausted: boolean;
  stamina: number; hunger: number; thirst: number; warmth: number;
  wearingJacket: boolean; dist: number; zeroTimer: number;
}

export interface HikeEnv {
  weather: WeatherId; hour: number; zone: string; climateC: number; overweight: boolean; wet: boolean;
  /** from active trail events: slippery path, cold wind */
  speedMult?: number; tempDelta?: number;
  /** from skills: Hiking (stamina drain), Survival (hunger/thirst), Camping (resting) */
  drainMult?: number; needsMult?: number; regenMult?: number;
}

export function newHiker(m: WorldMap, wearingJacket = true): Hiker {
  const [sx, sy] = m.trail.start;
  return {
    x: sx * CONFIG.TILE + 8, y: sy * CONFIG.TILE + 10, dir: 'up', frame: 0, animT: 0,
    moving: false, running: false, sitting: false, exhausted: false,
    stamina: 100, hunger: 100, thirst: 100, warmth: CONFIG.WARMTH_START,
    wearingJacket, dist: 0, zeroTimer: 0,
  };
}

/** In-game air temperature (game content, not real weather). */
const HOURLY: [number, number][] = [[0, 6], [6, 8], [10, 14], [14, 18], [18, 12], [22, 7], [24, 6]];
const ZONE_C: Record<string, number> = { ridge: -2, plateau: -1 };
export function ambientC(env: HikeEnv): number {
  let c = HOURLY[0][1];
  for (let i = 0; i < HOURLY.length - 1; i++) {
    const [h0, c0] = HOURLY[i], [h1, c1] = HOURLY[i + 1];
    if (env.hour >= h0 && env.hour <= h1) { c = c0 + ((c1 - c0) * (env.hour - h0)) / (h1 - h0); break; }
  }
  c += (ZONE_C[env.zone] ?? 0) + env.climateC + (env.tempDelta ?? 0);
  if (env.weather === 'fog') c -= 2;
  if (env.weather === 'drizzle') c -= 3;
  return c;
}

export function feelsC(h: Hiker, env: HikeEnv): number {
  let c = ambientC(env);
  if (h.wearingJacket) c += CONFIG.JACKET_C;
  if (h.moving) c += h.running ? CONFIG.RUN_C : CONFIG.MOVE_C;
  if (env.wet) c += CONFIG.WET_C;
  return c;
}

export function moveHiker(h: Hiker, m: WorldMap, inp: Input, env: HikeEnv, dt: number): { stepped: boolean } {
  let dx = 0, dy = 0;
  if (inp.left) dx -= 1; if (inp.right) dx += 1;
  if (inp.up) dy -= 1; if (inp.down) dy += 1;
  h.moving = dx !== 0 || dy !== 0;
  let stepped = false;
  if (h.moving) {
    h.sitting = false;
    const len = Math.hypot(dx, dy); dx /= len; dy /= len;
    h.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    h.running = inp.run && !h.exhausted && h.stamina > 0;
    const tile = tileAt(m, Math.floor(h.x / CONFIG.TILE), Math.floor(h.y / CONFIG.TILE));
    let speed = (h.running ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED) * (TERRAIN[tile].speed || 1);
    if (env.weather === 'drizzle') speed *= TERRAIN[tile].steep ? 0.75 : 0.88;
    if (h.exhausted) speed *= CONFIG.EXHAUSTED_SPEED;
    if (env.overweight) speed *= CONFIG.OVERWEIGHT_SPEED;
    speed *= env.speedMult ?? 1;
    const ox = h.x, oy = h.y, nx = h.x + dx * speed * dt, ny = h.y + dy * speed * dt;
    if (canStand(m, nx, h.y)) h.x = nx;
    if (canStand(m, h.x, ny)) h.y = ny;
    h.dist += Math.hypot(h.x - ox, h.y - oy);
    h.animT += dt * (h.running ? 12 : 8);
    const nf = Math.floor(h.animT) % 4;
    stepped = nf !== h.frame && nf % 2 === 1;
    h.frame = nf;
  } else { h.running = false; h.frame = 0; }
  h.x = clamp(h.x, 6, m.w * CONFIG.TILE - 6);
  h.y = clamp(h.y, 6, m.h * CONFIG.TILE - 2);
  return { stepped };
}

export type HikeWarning = 'exhausted' | 'hungry' | 'thirsty' | 'cold' | 'hot' | 'rescue';

/** Advances the body stats; returns the warnings that just started this tick. */
export function updateStats(h: Hiker, m: WorldMap, env: HikeEnv, dt: number, warned: Set<HikeWarning>): { warnings: HikeWarning[]; rescued: 'starve' | 'cold' | null } {
  const out: HikeWarning[] = [];
  const warn = (w: HikeWarning, on: boolean, off: boolean) => { if (on && !warned.has(w)) { warned.add(w); out.push(w); } if (off) warned.delete(w); };
  const tile: TileId = tileAt(m, Math.floor(h.x / CONFIG.TILE), Math.floor(h.y / CONFIG.TILE));
  if (h.moving) {
    let drain = h.running ? CONFIG.STAMINA_RUN : CONFIG.STAMINA_WALK;
    if (TERRAIN[tile].steep) drain *= CONFIG.STEEP_STAMINA_MULT;
    if (env.overweight) drain *= CONFIG.OVERWEIGHT_STAMINA;
    if (h.warmth < 30) drain *= CONFIG.COLD_STAMINA_MULT;
    h.stamina -= drain * (env.drainMult ?? 1) * dt;
  } else {
    let regen = (h.sitting ? CONFIG.STAMINA_REGEN_REST : CONFIG.STAMINA_REGEN_IDLE) * (env.regenMult ?? 1);
    if (h.hunger <= 0) regen *= 0.5;
    h.stamina += regen * dt;
  }
  h.stamina = clamp(h.stamina, 0, h.thirst <= 0 ? 50 : 100);
  if (h.stamina <= 0 && !h.exhausted) { h.exhausted = true; out.push('exhausted'); }
  if (h.exhausted && h.stamina >= CONFIG.EXHAUSTED_RECOVER) h.exhausted = false;

  const thirstMult = env.weather === 'drizzle' ? 0.6 : env.weather === 'clear' && env.hour >= 11 && env.hour < 15 ? 1.3 : 1;
  const needs = env.needsMult ?? 1;
  h.hunger = clamp(h.hunger - CONFIG.HUNGER_RATE * dt * (h.sitting ? 0.5 : 1) * needs, 0, 100);
  h.thirst = clamp(h.thirst - CONFIG.THIRST_RATE * dt * thirstMult * needs, 0, 100);
  warn('hungry', h.hunger < 25, h.hunger > 40);
  warn('thirsty', h.thirst < 25, h.thirst > 40);

  const feels = feelsC(h, env);
  if (feels < CONFIG.COMFORT_MIN_C) h.warmth -= (CONFIG.COMFORT_MIN_C - feels) * CONFIG.COLD_LOSS * dt;
  else {
    h.warmth += CONFIG.WARM_GAIN * dt;
    if (feels > CONFIG.COMFORT_MAX_C) h.thirst = clamp(h.thirst - (feels - CONFIG.COMFORT_MAX_C) * CONFIG.HOT_THIRST * dt, 0, 100);
  }
  h.warmth = clamp(h.warmth, 0, 100);
  warn('cold', h.warmth < 30, h.warmth > 50);
  warn('hot', feels > CONFIG.COMFORT_MAX_C + 2 && h.wearingJacket, feels < CONFIG.COMFORT_MAX_C);

  const starving = h.hunger <= 0 && h.thirst <= 0, frozen = h.warmth <= 0;
  let rescued: 'starve' | 'cold' | null = null;
  if (starving || frozen) {
    if (h.zeroTimer === 0) out.push('rescue');
    h.zeroTimer += dt;
    if (h.zeroTimer > CONFIG.RESCUE_SECONDS) rescued = frozen ? 'cold' : 'starve';
  } else h.zeroTimer = 0;
  return { warnings: out, rescued };
}

/** Real-world kilometres the hiker has walked, scaled from the trail's real length. */
export const walkedKm = (h: Hiker, m: WorldMap): number => (h.dist * m.trail.realData.distanceKm) / m.pathLenPx;

export const isWaterTile = (t: TileId): boolean => t === T.WATER;
