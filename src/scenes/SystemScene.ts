import Phaser from 'phaser';
import { audio, type AmbId } from '../audio/audio';
import { isNight, pickMood, type Screen } from '../core/music';
import { saveProfile, type Profile } from '../core/profile';
import { T } from '../data/terrain';
import { TRAILS } from '../data/trails';
import { tileAt } from '../core/world';
import { CONFIG } from '../core/config';
import { t } from '../i18n';
import { hitButton, layoutButtons, STICK_RADIUS, stickDirs, touch, vkeys, type TouchButton } from '../input/touch';
import type { HikeScene } from './HikeScene';
import type { CampScene } from './CampScene';
import type { HubScene } from './HubScene';
import type { VisitScene } from './VisitScene';
import { C, FONT, TX, woodButton } from '../ui/theme';

type Prefs = Profile & { sound?: boolean; music?: boolean };

/**
 * Always-running top scene: drives sound, ambience and music for whatever screen is showing,
 * handles the M (sound) / N (music) keys, and draws + reads the touch controls.
 */
export class SystemScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private ambT = 0;
  private stick: { id: number; x0: number; y0: number; x: number; y: number } | null = null;
  private holds = new Map<number, 'run'>();
  private pressed = new Map<number, string>();
  private stickRun = false;

  constructor() { super('system'); }

  get profile(): Prefs { return this.registry.get('profile') as Prefs; }

  create(): void {
    this.g = this.add.graphics();
    this.input.addPointer(2); // joystick + run + one more finger
    const q = new URLSearchParams(location.search);
    touch.enabled = q.get('touch') === '1' || (q.get('touch') !== '0' && !!window.matchMedia?.('(pointer: coarse)').matches);
    this.syncPrefs();

    const wake = () => audio.init();
    window.addEventListener('keydown', (e) => {
      wake();
      if (e.repeat || (document.activeElement && document.activeElement.tagName === 'INPUT')) return;
      if (e.code === 'KeyM') this.togglePref('sound');
      if (e.code === 'KeyN') this.togglePref('music');
    });
    window.addEventListener('pointerdown', (e) => { wake(); if (e.pointerType === 'touch' && !touch.enabled) touch.enabled = true; });
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.up(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.up(p));
    this.game.events.on('blur', () => this.releaseAll());
    // "Visit" in the Online panel: go to a friend's camp from camp, the plaza or the title screen (not mid-hike)
    window.addEventListener('twt-visit', (e) => {
      const code = (e as CustomEvent<string>).detail, from = (['camp', 'hub', 'visit', 'title', 'pack'] as const).find((k) => this.scene.isActive(k));
      if (from && code) this.scene.get(from).scene.start('visit', { code });
    });
  }

  // ---------- settings ----------
  private syncPrefs(): void { const p = this.profile; audio.setPrefs({ sound: p.sound !== false, music: p.music !== false }); }
  private togglePref(k: 'sound' | 'music'): void {
    const p = this.profile;
    p[k] = p[k] === false;
    saveProfile(p); this.syncPrefs();
    const msg = k === 'sound' ? (p.sound ? '🔊' : '🔇') : t(p.music ? 'msg_musicOn' : 'msg_musicOff');
    for (const key of ['hike', 'camp', 'hub']) { const s = this.scene.get(key) as unknown as { toast?: (m: string) => void }; if (this.scene.isActive(key) && s.toast) s.toast(msg); }
    if (p[k] !== false) audio.sfx('blip');
  }

  // ---------- which screen is showing ----------
  private screen(): Screen {
    for (const k of ['hike', 'pack', 'camp', 'hub', 'visit', 'title'] as const) if (this.scene.isActive(k)) return k;
    return 'none';
  }
  private get hike(): HikeScene { return this.scene.get('hike') as HikeScene; }
  private get camp(): CampScene { return this.scene.get('camp') as CampScene; }
  private get hub(): HubScene { return this.scene.get('hub') as HubScene; }
  private get visit(): VisitScene { return this.scene.get('visit') as VisitScene; }

  // ---------- touch input ----------
  private press(code: string): void { window.dispatchEvent(new KeyboardEvent('keydown', { code })); }
  private down(p: Phaser.Input.Pointer): void {
    if (!touch.enabled) {
      // tap anywhere on the hike summary / rescue panel continues, also with a mouse
      if (this.screen() === 'hike' && this.hike.finished) this.press('Enter');
      return;
    }
    const b = hitButton(touch.buttons, p.x, p.y);
    if (b) {
      touch.owned.add(p.id); this.pressed.set(p.id, b.id);
      if (b.hold) { this.holds.set(p.id, b.hold); this.syncRun(); } else if (b.code) this.press(b.code);
      return;
    }
    if (this.screen() === 'hike' && this.hike.finished) { this.press('Enter'); return; }
    if (!this.stick && touch.stickZone?.(p.x, p.y)) {
      touch.owned.add(p.id);
      this.stick = { id: p.id, x0: p.x, y0: p.y, x: p.x, y: p.y };
      this.updateStick();
    }
  }
  private move(p: Phaser.Input.Pointer): void {
    if (this.stick && p.id === this.stick.id) { this.stick.x = p.x; this.stick.y = p.y; this.updateStick(); }
  }
  private up(p: Phaser.Input.Pointer): void {
    if (this.stick && p.id === this.stick.id) { this.stick = null; vkeys.left = vkeys.right = vkeys.up = vkeys.down = false; this.stickRun = false; }
    this.holds.delete(p.id); this.pressed.delete(p.id); touch.owned.delete(p.id);
    this.syncRun();
  }
  private releaseAll(): void {
    this.stick = null; this.holds.clear(); this.pressed.clear(); touch.owned.clear(); this.stickRun = false;
    vkeys.left = vkeys.right = vkeys.up = vkeys.down = vkeys.run = false;
  }
  private updateStick(): void {
    const s = this.stick!, d = stickDirs(s.x - s.x0, s.y - s.y0);
    vkeys.left = d.left; vkeys.right = d.right; vkeys.up = d.up; vkeys.down = d.down; this.stickRun = d.run;
    this.syncRun();
  }
  private syncRun(): void { vkeys.run = this.stickRun || [...this.holds.values()].includes('run'); }

  // ---------- frame ----------
  update(_t: number, deltaMs: number): void {
    this.scene.bringToTop();
    const screen = this.screen(), dt = Math.min(0.1, deltaMs / 1000), p = this.profile;
    const hikeOn = screen === 'hike' && !!this.hike.hiker;
    const hour = hikeOn ? this.hike.hour : 14;

    // music + ambience
    if (audio.ctx) {
      audio.music(pickMood(screen, hour), hikeOn ? Math.max(0, TRAILS.indexOf(this.hike.trail)) : 0);
      this.ambT -= dt;
      if (this.ambT <= 0) { this.ambT = 0.1; this.ambience(screen, hikeOn, hour); }
    }

    // touch layout for this frame
    const IW = this.scale.width, IH = this.scale.height, g = this.g;
    g.clear(); this.used = 0;
    const menu = (screen === 'camp' && !!this.camp.menu) || (screen === 'hike' && !!this.hike.journal) || (screen === 'hub' && !!this.hub.menu) || (screen === 'visit' && !!this.visit.menu), build = screen === 'camp' && !!this.camp.build;
    const finished = hikeOn && this.hike.finished;
    touch.buttons = touch.enabled && !finished ? layoutButtons({ screen, menu, build, sound: p.sound !== false, music: p.music !== false, soundY: screen === 'title' ? (this.scene.get('title') as unknown as { soundY: number }).soundY || undefined : undefined }, IW, IH) : [];
    const walk = touch.enabled && ((hikeOn && !finished && !this.hike.journal && !this.hike.bigMap) || (screen === 'camp' && !menu) || (screen === 'hub' && !menu && this.hub.status === 'live') || (screen === 'visit' && !menu && this.visit.status === 'live'));
    const hb = (this.scene.get('hud') as unknown as { hotbar?: { y: number } }).hotbar;
    const barY = screen === 'hike' && hb?.y ? hb.y - 8 : IH;
    touch.stickZone = walk ? (x, y) => x < IW * 0.55 && y > 70 && y < barY : null;
    if (!walk && this.stick) this.releaseAll();
    if (touch.enabled) this.drawTouch(touch.buttons, walk, IW, IH);
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  private ambience(screen: Screen, hikeOn: boolean, hour: number): void {
    const lv: Record<AmbId, number> = { wind: 0, water: 0, rain: 0, fire: 0 };
    let birds = 0, gibbon = false, crickets = false;
    if (hikeOn && !this.hike.finished) {
      const h = this.hike, TS = CONFIG.TILE, tx = Math.floor(h.hiker.x / TS), ty = Math.floor(h.hiker.y / TS), night = isNight(hour);
      let best = 99;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (tileAt(h.world, tx + dx, ty + dy) === T.WATER) best = Math.min(best, Math.hypot(dx, dy));
      if (best < 7) lv.water = 0.22 * (1 - best / 7);
      for (const d of (h.trail.decor ?? []).filter((q) => q.type === 'falls')) { const dd = Math.hypot(d.x + 1 - tx, d.y - ty); if (dd < 9) lv.water = Math.max(lv.water, 0.45 * (1 - dd / 9)); }
      if (h.zone === 'ridge' || h.zone === 'plateau') lv.wind = 0.1;
      if (h.activeEvents.some((e) => e.id === 'coldWind')) lv.wind = 0.3;
      if (h.weather === 'drizzle') lv.rain = 0.14;
      birds = night ? 0 : h.weather === 'drizzle' ? 0.05 : 0.35;
      gibbon = h.trail.ambient === 'gibbon' && !night;
      crickets = night;
    } else if (screen === 'camp' || screen === 'pack') { lv.fire = 0.07; birds = 0.2; }
    else if (screen === 'hub' || screen === 'visit') { lv.fire = 0.05; birds = 0.3; }
    else if (screen === 'title') birds = 0.15;
    audio.ambience(lv, { birds, gibbon, crickets });
  }

  private text(s: string, x: number, y: number, size: number, color: string): void {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setText(s).setFontSize(size).setColor(color).setPosition(Math.round(x), Math.round(y));
  }

  private drawTouch(B: TouchButton[], walk: boolean, _IW: number, IH: number): void {
    const g = this.g, active = new Set(this.pressed.values());
    for (const b of B) {
      // wooden square buttons (hit test stays the circle of radius r)
      const on = active.has(b.id), s = Math.round(b.r * 1.8);
      woodButton(g, b.x - s / 2, b.y - s / 2, s, s, false, on);
      this.text(b.label, b.x, b.y + 1, Math.round(b.r * 0.72), on ? TX.woodShadow : TX.cream);
    }
    if (this.stick) {
      const s = this.stick, dx = s.x - s.x0, dy = s.y - s.y0, len = Math.hypot(dx, dy), k = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
      g.fillStyle(C.woodDeep, 0.35).fillCircle(s.x0, s.y0, STICK_RADIUS);
      g.lineStyle(3, C.woodDark, 0.6).strokeCircle(s.x0, s.y0, STICK_RADIUS);
      g.fillStyle(C.woodDark, 0.9).fillCircle(s.x0 + dx * k, s.y0 + dy * k, 26);
      g.fillStyle(this.stickRun ? C.hunger : C.gold, 0.95).fillCircle(s.x0 + dx * k, s.y0 + dy * k, 22);
    } else if (walk) {
      g.fillStyle(C.woodDeep, 0.2).fillCircle(96, IH - 150, 50);
      this.text('✥', 96, IH - 150, 26, 'rgba(255,246,220,0.35)');
    }
  }
}
