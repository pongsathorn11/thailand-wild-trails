/**
 * Touch controls: a floating joystick on the left half of the screen and round buttons on the right.
 * Buttons send the same key codes as the keyboard, so scenes need no touch-specific code.
 * Layout and stick math are pure so they can be tested; SystemScene draws and feeds them.
 */
import type { Screen } from '../core/music';

/** Held directions from the joystick / run button, merged into keyboard input by the scenes. */
export const vkeys = { left: false, right: false, up: false, down: false, run: false };

export interface TouchButton { id: string; x: number; y: number; r: number; label: string; code?: string; hold?: 'run' }
export interface TouchView { screen: Screen; menu: boolean; build: boolean; sound: boolean; music: boolean; /** row for the sound buttons (title screen puts them beside Start) */ soundY?: number }
/** Width the title screen keeps free at the right of its Start button for the sound buttons. */
export const TITLE_SOUND_GAP = 92;

export const STICK_RADIUS = 56;
const DEAD = 12, AXIS = 0.38, RUN_PUSH = 70;

export function layoutButtons(v: TouchView, IW: number, IH: number): TouchButton[] {
  const B: TouchButton[] = [], add = (id: string, x: number, y: number, r: number, label: string, o: Partial<TouchButton> = {}) => B.push({ id, x, y, r, label, ...o });
  const rx = IW - 58, by = IH - 150;
  const sy = v.soundY ?? IH - 24, big = v.soundY !== undefined;
  add('snd', IW - (big ? 34 : 26), sy, big ? 18 : 15, v.sound ? '🔊' : '🔇', { code: 'KeyM' });
  add('mus', IW - (big ? 76 : 62), sy, big ? 18 : 15, v.music ? '🎵' : '🚫', { code: 'KeyN' });
  if (v.screen === 'pack' || (v.screen === 'camp' && v.menu)) {
    add('up', rx - 52, by - 58, 24, '▲', { code: 'ArrowUp' }); add('down', rx - 52, by + 30, 24, '▼', { code: 'ArrowDown' });
    add('left', rx - 100, by - 14, 24, '◀', { code: 'ArrowLeft' }); add('right', rx - 4, by - 14, 24, '▶', { code: 'ArrowRight' });
    add('ok', 64, by + 10, 30, 'OK', { code: 'Enter' });
    add('back', 64, by - 66, 24, '✕', { code: 'Escape' });
  } else if (v.screen === 'hike' || v.screen === 'camp') {
    add('act', rx, by + 16, 34, 'E', { code: 'KeyE' });
    add('run', rx - 78, by + 40, 26, '🏃', { hold: 'run' });
    if (v.screen === 'camp') {
      if (v.build) {
        add('place', rx, by - 62, 24, '✔', { code: 'KeyE' }); add('pick', rx - 56, by - 62, 22, 'X', { code: 'KeyX' });
        add('next', rx - 108, by - 62, 22, '⟳', { code: 'BracketRight' }); add('bexit', rx - 160, by - 62, 22, '🔨', { code: 'KeyB' });
      } else {
        add('seed', rx, by - 62, 22, '🌱', { code: 'KeyQ' }); add('build', rx - 52, by - 62, 22, '🔨', { code: 'KeyB' });
        add('skills', rx - 104, by - 62, 22, '⭐', { code: 'KeyK' }); add('journal', rx - 156, by - 62, 22, '📖', { code: 'KeyJ' });
        add('home', IW - 98, IH - 24, 15, '🏠', { code: 'Escape' });
      }
    }
  }
  return B;
}

export const hitButton = (B: TouchButton[], x: number, y: number): TouchButton | undefined => B.find((b) => Math.hypot(x - b.x, y - b.y) <= b.r + 6);

/** Joystick vector → held directions. Diagonals press two keys; pushing far runs. */
export function stickDirs(dx: number, dy: number): { left: boolean; right: boolean; up: boolean; down: boolean; run: boolean } {
  const len = Math.hypot(dx, dy), nx = len > DEAD ? dx / len : 0, ny = len > DEAD ? dy / len : 0;
  return { left: nx < -AXIS, right: nx > AXIS, up: ny < -AXIS, down: ny > AXIS, run: len > RUN_PUSH };
}

/** Shared touch state, written by SystemScene every frame. */
export const touch = {
  enabled: false,
  buttons: [] as TouchButton[],
  /** Where a new touch would start the joystick (null = nowhere on this screen). */
  stickZone: null as null | ((x: number, y: number) => boolean),
  owned: new Set<number>(),
};

/** True when the touch layer handles this pointer, so other scenes should ignore it. */
export function touchClaims(p: { x: number; y: number; id: number }): boolean {
  if (!touch.enabled) return false;
  return touch.owned.has(p.id) || !!hitButton(touch.buttons, p.x, p.y) || !!touch.stickZone?.(p.x, p.y);
}
