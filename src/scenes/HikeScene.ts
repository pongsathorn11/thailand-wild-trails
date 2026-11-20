import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import { clamp } from '../core/rng';
import { buildWorld, tileAt, type WorldMap } from '../core/world';
import { newHiker, moveHiker, updateStats, walkedKm, type Hiker, type HikeEnv, type HikeWarning, type Input } from '../core/hiker';
import { hourOf } from '../core/time';
import { seasonOf, rareOk } from '../core/season';
import { EVENTS, EVENT_GAP, pickEvent, spotAhead } from '../core/events';
import { applyFinish, type Summary } from '../core/rewards';
import { MINI, miniFrameIndex, MINI_SIT_FRAME, renderGround } from '../gfx/paint';
import { karstArt } from '../gfx/trailArt';
import { T, TERRAIN, type TileId } from '../data/terrain';
import { trailById, TRAILS, type TrailDef, type WeatherId, type Poi, type Season } from '../data/trails';
import { t, tList } from '../i18n';
import { saveProfile, type Profile } from '../core/profile';
import { JOURNAL_TABS, journalRows, type JournalTab, type MenuRow } from './journalRows';
import { add, fromPack, has, hasEmptyBottle, overweight, refill, returnCooked, useSlot, type Backpack } from '../core/backpack';
import { COOKED } from '../data/items';
import { levelInfo, lockedTrails, notifyQuest } from '../core/camp';
import type { QuestKind } from '../data/camp';
import { CampScene } from './CampScene';
import { checkProgress, skillBonus, skillRank } from '../core/progress';
import { progressMessages } from './progressText';
import { audio } from '../audio/audio';
import { cloud } from '../net/cloud';
import { CoopSession, coopPlan, type Other } from '../net/coop';
import type { CoopInput } from '../core/coop';
import { installMiniSheet } from '../gfx/sheets';
import { resolveLook } from '../data/looks';
import { vkeys } from '../input/touch';

const TS = CONFIG.TILE;
const WEATHER_DEFAULT: Record<WeatherId, number> = { clear: 0.5, fog: 0.3, drizzle: 0.2 };
const STALL_PRICE = 8;

export function rollWeather(trail: TrailDef, rnd = Math.random()): WeatherId {
  const ch = trail.weatherChances ?? WEATHER_DEFAULT;
  let acc = 0;
  for (const id of ['clear', 'fog', 'drizzle'] as WeatherId[]) { acc += ch[id]; if (rnd < acc) return id; }
  return 'clear';
}

export interface Toast { text: string; t: number }
interface Litter { x: number; y: number; taken: boolean; img: Phaser.GameObjects.Image }
interface Spawn { kind: 'animal' | 'item'; subject?: string; itemId?: string; x: number; y: number; until?: number; gone: boolean; obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image }
interface Bird { x: number; y: number; homeX: number; homeY: number; tx: number; ty: number; wait: number; flying: boolean; spr: Phaser.GameObjects.Sprite; subject: string }
export interface Target { kind: 'poi' | 'litter' | 'water' | 'swim' | 'spawn' | 'bird'; label: string; poi?: Poi; litter?: Litter; spawn?: Spawn }

/** One hike on one trail (port milestones M1–M3): world, hiker, backpack, trail life, finish. */
export class HikeScene extends Phaser.Scene {
  world!: WorldMap;
  hiker!: Hiker;
  trail!: TrailDef;
  season: Season = 'cool';
  weather: WeatherId = 'clear';
  elapsed = 0;
  zone = '';
  checkpoint = false;
  finished = false;
  summary: Summary | null = null;
  rescued: 'starve' | 'cold' | null = null;
  toasts: Toast[] = [];
  photos: string[] = [];
  litterTaken = 0;
  secretFound = false;
  bp!: Backpack;
  flash = 0;
  dialog: { lines: string[]; i: number } | null = null;
  activeEvents: { id: string; until: number }[] = [];
  revealed!: Uint8Array;
  private wetUntil = 0;
  private nextEventIn = 30;
  private done = new Set<string>();
  private poiObjs = new Map<string, Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => unknown }>();
  private sparkles: { img: Phaser.GameObjects.Image; x: number; y: number; id: string }[] = [];
  private litter: Litter[] = [];
  private spawns: Spawn[] = [];
  private bird: Bird | null = null;
  /** Set when hiking with friends: the server moves everyone, this client predicts its own hiker. */
  coop: CoopSession | null = null;
  private coopSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private player!: Phaser.GameObjects.Sprite;
  private canopies: { img: Phaser.GameObjects.Image; x: number; phase: number }[] = [];
  private warned = new Set<HikeWarning>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private seenZones = new Set<string>();
  private miniCtx!: CanvasRenderingContext2D;
  private miniTex!: Phaser.Textures.CanvasTexture;

  constructor() { super('hike'); }

  get profile(): Profile { return this.registry.get('profile') as Profile; }
  get hour(): number { return hourOf(this.trail.startHour, this.elapsed); }

  private presetWeather: WeatherId | null = null;
  private runId: Promise<string | null> = Promise.resolve(null);
  private overWarned = false;

  init(data: { trailId?: string; weather?: WeatherId; coop?: CoopSession }): void {
    this.trail = trailById(data.trailId ?? '') ?? TRAILS[0];
    this.coop = data.coop ?? null;
    this.coopSprites.clear();
    this.presetWeather = data.weather ?? null;
    Object.assign(this, { elapsed: 0, checkpoint: false, finished: false, summary: null, rescued: null, toasts: [], photos: [], litterTaken: 0,
      secretFound: false, flash: 0, dialog: null, activeEvents: [], wetUntil: 0, zone: '', overWarned: false, campMessages: [], paused: false, journal: null, bigMap: false });
    this.nextEventIn = 25 + Math.random() * 15;
    this.canopies = []; this.sparkles = []; this.litter = []; this.spawns = []; this.bird = null;
    this.done.clear(); this.poiObjs.clear(); this.warned.clear(); this.seenZones.clear();
  }

  create(): void {
    this.runId = cloud.startRun(this.trail.id).catch(() => null);
    this.world = buildWorld(this.trail);
    this.weather = this.presetWeather ?? rollWeather(this.trail);
    this.season = seasonOf(this.profile.day || 1);
    // the backpack comes from the packing screen; packed cooked food leaves camp storage
    const st = this.profile.storage;
    this.bp = fromPack(this.profile.pack, st);
    for (const s of this.bp.slots) if (COOKED.includes(s.itemId)) st[s.itemId] = Math.max(0, (st[s.itemId] || 0) - s.qty);
    if (this.trail.climateC >= 8) this.bp.wearing.body = null; // the jacket stays in the pack on hot lowland trails
    saveProfile(this.profile);
    this.hiker = newHiker(this.world, this.bp.wearing.body === 'jacket');

    if (this.textures.exists('ground')) this.textures.remove('ground');
    this.textures.addCanvas('ground', renderGround(this.world));
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-1);

    for (const tr of this.world.trees) {
      const w = tr.type === 'broad' ? 26 : 18, h = 30;
      this.add.image(tr.x - w / 2, tr.y - h + 1, `tree-${tr.type}-${tr.v}-trunk`).setOrigin(0).setDepth(tr.y);
      const can = this.add.image(tr.x - w / 2, tr.y - h + 1, `tree-${tr.type}-${tr.v}-canopy`).setOrigin(0).setDepth(tr.y + 0.1);
      this.canopies.push({ img: can, x: tr.x - w / 2, phase: tr.phase });
    }
    for (const d of this.trail.decor ?? []) this.placeDecor(d.type, d.x, d.y);
    for (const poi of this.trail.pois) this.placePoi(poi);
    this.placeLitter();
    this.placeBird();

    this.player = this.add.sprite(this.hiker.x, this.hiker.y, 'hiker', 0).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H);

    // minimap: 1 px per tile, filled in as the hiker explores
    this.revealed = new Uint8Array(this.world.w * this.world.h);
    if (this.textures.exists('minimap')) this.textures.remove('minimap');
    this.miniTex = this.textures.createCanvas('minimap', this.world.w, this.world.h)!;
    this.miniCtx = this.miniTex.getContext();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.w * TS, this.world.h * TS);
    cam.startFollow(this.player, true, 1, 1, 0, 10);
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    // one DOM listener for discrete actions (exactly one call per key press; held keys use this.keys)
    const onDown = (e: KeyboardEvent) => { if (e.code === 'Tab') e.preventDefault(); if (!e.repeat) this.onKey(e.code); };
    window.addEventListener('keydown', onDown);
    this.events.once('shutdown', () => { window.removeEventListener('keydown', onDown); this.scale.off('resize', this.applyZoom, this); this.scene.stop('hud'); this.coop?.leave(); this.coop = null; });
    if (this.coop) this.setupCoop(this.coop);

    if (!this.scene.isActive('hud')) this.scene.launch('hud');
    this.toast(`📍 ${t(this.trail.trailKey)}`);
  }

  private applyZoom(): void { this.cameras.main.setZoom(Math.min(window.innerWidth, window.innerHeight) < 560 ? 2 : 3); }

  // ---------- placing things ----------
  private anchor(key: string): [number, number] { return (this.registry.get('propAnchors') as Record<string, [number, number]>)[key] ?? [0, 0]; }
  private img(key: string, fx: number, fy: number, depth = fy): Phaser.GameObjects.Image {
    const [ax, ay] = this.anchor(key);
    return this.add.image(fx - ax, fy - ay, `prop-${key}`).setOrigin(0).setDepth(depth);
  }

  private placeDecor(type: 'falls' | 'karst', x: number, y: number): void {
    if (type === 'falls') {
      const [ax, ay] = this.anchor('falls'), fx = x * TS + 16, fy = y * TS + 12;
      this.add.sprite(fx - ax, fy - ay, 'falls', 0).setOrigin(0).setDepth(fy - 30).play('falls-flow');
    } else {
      const seed = x * 7 + y, key = `karst-${seed}`;
      const a = karstArt(seed);
      if (!this.textures.exists(key)) this.textures.addCanvas(key, a.canvas);
      const fx = x * TS + 8, fy = (y + 2) * TS + 12;
      this.add.image(fx - a.ax, fy - a.ay, key).setOrigin(0).setDepth(fy);
    }
  }

  private placePoi(poi: Poi): void {
    const fx = poi.x * TS + 8, fy = poi.y * TS + 14;
    const byType: Record<string, string | undefined> = { sign: 'sign', bench: 'bench', viewpoint: 'viewpoint', goal: 'goal', stall: 'stall' };
    let key = byType[poi.type];
    if (poi.type === 'waterfall') key = 'tier' + (poi.n ?? 1);
    if (poi.type === 'photo') {
      key = poi.prop;
      if (key === 'maple') key = this.season === 'cool' ? 'maple-red' : 'maple-green';
      if (key === 'rafflesia') key = poi.seasons?.includes(this.season) ? 'rafflesia-bloom' : 'rafflesia-bud';
    }
    if (poi.type === 'item') {
      const im = this.img(poi.item === 'flashlight' ? 'flashlight' : 'bag', fx, fy);
      this.tweens.add({ targets: im, y: im.y - 1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.poiObjs.set(poi.id, im);
      return;
    }
    if (poi.type === 'secret') {
      const im = this.img('sparkle', fx, fy).setVisible(false);
      this.tweens.add({ targets: im, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
      this.sparkles.push({ img: im, x: fx, y: fy, id: poi.id });
      return;
    }
    if (poi.type === 'npc') {
      this.add.sprite(fx, fy, 'guide', miniFrameIndex('left', 0)).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H).setDepth(fy);
      return;
    }
    if (key) this.poiObjs.set(poi.id, this.img(key, fx, fy));
  }

  private placeLitter(): void {
    const [sx, sy] = this.trail.start;
    const cand = this.world.pathTiles.filter(([x, y]) => Math.hypot(x - sx, y - sy) > 8);
    let guard = 0;
    while (this.litter.length < this.trail.litterCount && guard++ < 500) {
      const [x, y] = cand[Math.floor(Math.random() * cand.length)];
      if (this.litter.some((l) => Math.hypot(l.x / TS - x, l.y / TS - y) < 6)) continue;
      const lx = x * TS + 4 + Math.random() * 8, ly = y * TS + 6 + Math.random() * 6;
      this.litter.push({ x: lx, y: ly, taken: false, img: this.img(Math.random() < 0.5 ? 'litter0' : 'litter1', Math.round(lx), Math.round(ly)) });
    }
  }

  private placeBird(): void {
    const b = this.trail.bird;
    if (!b) return;
    const [bx, by] = b.home, x = bx * TS + 8, y = by * TS + 8, kind = b.kind ?? 'sunbird';
    const [ax, ay] = this.anchor('bird-' + kind);
    const spr = this.add.sprite(x, y, 'bird-' + kind, 0).setOrigin(ax / (kind === 'hornbill' ? 24 : 14), ay / (kind === 'hornbill' ? 32 : 22));
    this.bird = { x, y, homeX: x, homeY: y, tx: x, ty: y, wait: 1, flying: false, spr, subject: b.subject ?? 'sunbird' };
  }

  // ---------- helpers ----------
  toast(text: string): void { this.toasts.push({ text, t: 3.5 }); if (this.toasts.length > 3) this.toasts.shift(); }
  hasPhoto(id: string): boolean { return this.photos.includes(id); }
  private takePhoto(subject: string): void {
    this.flash = 1; audio.sfx('shutter');
    if (this.hasPhoto(subject)) { this.toast(t('msg_photoDup')); return; }
    this.photos.push(subject);
    this.toast(t('msg_photo', { s: t('ph_' + subject) }));
    this.quest('takePhoto');
  }
  private sumEvents(key: 'speedMult' | 'tempC' | 'fog'): number {
    return this.activeEvents.reduce((v, a) => { const d = EVENTS.find((e) => e.id === a.id)!; const x = d[key]; return key === 'speedMult' ? v * (x ?? 1) : v + (x ?? 0); }, key === 'speedMult' ? 1 : 0);
  }
  eventFog(): number { return this.sumEvents('fog'); }

  env(): HikeEnv {
    return {
      weather: this.weather, hour: this.hour, zone: this.zone, climateC: this.trail.climateC, overweight: overweight(this.bp),
      wet: (this.weather === 'drizzle' && this.bp.wearing.rain !== 'raincoat') || this.wetUntil > this.elapsed,
      speedMult: this.sumEvents('speedMult'), tempDelta: this.sumEvents('tempC'),
      drainMult: 1 - skillBonus(this.profile, 'hiking'), needsMult: 1 - skillBonus(this.profile, 'survival'), regenMult: 1 + skillBonus(this.profile, 'camping'),
    };
  }

  private readInput(): Input {
    const k = this.keys;
    if (this.journal || this.bigMap) return { left: false, right: false, up: false, down: false, run: false }; // co-op: keys browse the overlay
    return { left: k.A.isDown || k.LEFT.isDown || vkeys.left, right: k.D.isDown || k.RIGHT.isDown || vkeys.right, up: k.W.isDown || k.UP.isDown || vkeys.up, down: k.S.isDown || k.DOWN.isDown || vkeys.down, run: k.SHIFT.isDown || vkeys.run };
  }

  /** Solo hikes can pause (P): the clock, body stats and events stop. Co-op rooms keep running on the server. */
  paused = false;
  /** Journal (J) and the big map (Tab) open over the trail; on a solo hike they hold the clock like the pause does. */
  journal: { tab: JournalTab; sel: number } | null = null;
  bigMap = false;
  get frozen(): boolean { return this.paused || (!this.coop && (!!this.journal || this.bigMap)); }
  journalRows(): MenuRow[] { return this.journal ? journalRows(this.profile, this.journal.tab) : []; }
  openJournal(): void { if (!this.finished) { this.bigMap = false; this.journal = { tab: 'album', sel: 0 }; audio.sfx('select'); } }
  closeOverlays(): void { if (this.journal || this.bigMap) audio.sfx('blip'); this.journal = null; this.bigMap = false; }
  toggleMap(): void { if (!this.finished) { this.journal = null; this.bigMap = !this.bigMap; audio.sfx('blip'); } }
  private journalKey(code: string): void {
    const j = this.journal!, n = this.journalRows().length;
    if (code === 'Escape' || code === 'KeyJ') { this.closeOverlays(); return; }
    if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS', 'ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(code)) audio.sfx('blip');
    if (n && (code === 'ArrowUp' || code === 'KeyW')) j.sel = (j.sel + n - 1) % n;
    if (n && (code === 'ArrowDown' || code === 'KeyS')) j.sel = (j.sel + 1) % n;
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(code)) {
      const i = JOURNAL_TABS.indexOf(j.tab), d = code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1;
      j.tab = JOURNAL_TABS[(i + d + JOURNAL_TABS.length) % JOURNAL_TABS.length]; j.sel = 0;
    }
  }
  togglePause(): void {
    if (this.finished) return;
    if (this.coop) { this.toast(t('ui_pause_coop')); audio.sfx('error'); return; }
    this.paused = !this.paused;
    audio.sfx('blip');
  }

  private onKey(code: string): void {
    if (code === 'KeyP' || (this.paused && (code === 'Escape' || code === 'Enter'))) { this.togglePause(); return; }
    if (this.paused) return;
    if (this.journal) { this.journalKey(code); return; }
    if (this.bigMap) { if (['Tab', 'Escape', 'Enter', 'Space'].includes(code)) this.closeOverlays(); return; }
    if (!this.finished && code === 'KeyJ') { this.openJournal(); return; }
    if (!this.finished && code === 'Tab') { this.toggleMap(); return; }
    if (this.finished) {
      if (code === 'Enter' || code === 'Space') this.scene.start('camp', { messages: this.campMessages });
      return;
    }
    if (code === 'KeyE' || code === 'Space') {
      if (this.dialog) { this.dialog.i++; if (this.dialog.i >= this.dialog.lines.length) this.dialog = null; }
      else this.run(this.findTarget());
    }
    // hotbar: 1–9, 0, -, = use backpack slots 1–12
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(code);
    const slot = m ? (m[1] === '0' ? 9 : Number(m[1]) - 1) : code === 'Minus' ? 10 : code === 'Equal' ? 11 : -1;
    if (slot >= 0) this.useSlot(slot);
  }

  useSlot(i: number): void {
    const r = useSlot(this.bp, i, this.hiker, skillBonus(this.profile, 'cooking'));
    if (r) { this.toast(t(r.msg, r.vars ? { s: t(r.vars.s) } : undefined)); audio.sfx(r.sound); }
  }

  /** Adds an item to the backpack, or says the pack is full. */
  private pick(id: string): boolean {
    if (add(this.bp, id)) return true;
    this.toast(t('msg_full')); audio.sfx('error');
    return false;
  }

  get flashlight(): boolean { return has(this.bp, 'flashlight'); }

  // ---------- interaction ----------
  /** The nearest thing the hiker can act on, with its prompt label. */
  findTarget(): Target | null {
    const h = this.hiker;
    let best: Target | null = null, bd = Infinity;
    const consider = (d: number, range: number, tg: Target) => { if (d <= range && d < bd) { bd = d; best = tg; } };
    const act: Record<string, string> = { sign: 'act_read', npc: 'act_talk', bench: 'act_rest', viewpoint: 'act_photo', photo: 'act_photo', secret: 'act_explore', item: 'act_pick', goal: 'act_finish', waterfall: 'act_photo' };
    for (const poi of this.trail.pois) {
      if ((poi.type === 'item' || poi.type === 'secret' || poi.type === 'photo') && this.done.has(poi.id)) continue;
      if (poi.type === 'bench' && h.sitting) continue;
      const d = Math.hypot(h.x - (poi.x * TS + 8), h.y - (poi.y * TS + 10));
      const range = poi.type === 'secret' ? 20 : poi.type === 'viewpoint' ? 30 : CONFIG.INTERACT_RANGE;
      const label = poi.type === 'stall' ? t('act_stall', { s: t(poi.nameKey ?? ''), p: STALL_PRICE }) : t(act[poi.type]);
      consider(d, range, { kind: 'poi', poi, label });
    }
    for (const l of this.litter) if (!l.taken) consider(Math.hypot(h.x - l.x, h.y - l.y), 18, { kind: 'litter', litter: l, label: t('act_litter') });
    for (const s of this.spawns) {
      const d = Math.hypot(h.x - s.x, h.y - s.y);
      if (s.kind === 'animal' && !this.hasPhoto(s.subject!)) consider(d, 44, { kind: 'spawn', spawn: s, label: t('act_photo') });
      if (s.kind === 'item') consider(d, 18, { kind: 'spawn', spawn: s, label: t('act_pick') });
    }
    const tx = Math.floor(h.x / TS), ty = Math.floor(h.y / TS);
    let wet = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(this.world, tx + dx, ty + dy) === T.WATER) wet = true;
    if (wet && hasEmptyBottle(this.bp)) consider(14, 20, { kind: 'water', label: t('act_refill') });
    else if (wet && this.trail.swim) consider(15, 20, { kind: 'swim', label: t('act_swim') });
    const b = this.bird;
    if (b && !b.flying && !this.hasPhoto(b.subject)) consider(Math.hypot(h.x - b.x, h.y - b.y), 44, { kind: 'bird', label: t('act_photo') });
    return best;
  }

  private run(tg: Target | null): void {
    if (!tg) return;
    const h = this.hiker;
    if (tg.kind === 'litter') {
      if (!this.pick('litter')) return;
      tg.litter!.taken = true; tg.litter!.img.setVisible(false); this.litterTaken++; this.toast(t('msg_litter')); audio.sfx('pickup'); this.quest('collectLitter'); return;
    }
    if (tg.kind === 'water') { refill(this.bp); this.toast(t('msg_refill')); audio.sfx('water'); return; }
    if (tg.kind === 'swim') { this.wetUntil = this.elapsed + 45; h.stamina = clamp(h.stamina + 25, 0, h.thirst <= 0 ? 50 : 100); this.flash = 0.4; this.toast(t('msg_swim')); audio.sfx('splash'); return; }
    if (tg.kind === 'bird') { if (h.running) { this.toast(t('msg_birdRun')); return; } this.takePhoto(this.bird!.subject); return; }
    if (tg.kind === 'spawn') {
      const s = tg.spawn!;
      if (s.kind === 'animal') { if (h.running) { this.toast(t('msg_birdRun')); return; } this.takePhoto(s.subject!); return; }
      if (!this.pick(s.itemId!)) return;
      s.gone = true; s.obj.destroy(); this.toast(t('msg_pickedUp', { s: t('item_' + s.itemId) })); audio.sfx('pickup'); return;
    }
    const poi = tg.poi!;
    switch (poi.type) {
      case 'sign': this.toast(t(this.trail.signKey)); break;
      case 'npc': this.dialog = { lines: tList(poi.linesKey ?? 'guide'), i: 0 }; break;
      case 'bench':
        h.sitting = true; h.dir = 'down';
        if (!this.coop) { h.x = poi.x * TS + 8; h.y = poi.y * TS + 12; } // in co-op only the server moves hikers
        break;
      case 'stall':
        if ((this.profile.coins ?? 0) < STALL_PRICE) { this.toast(t('msg_noCoins')); audio.sfx('error'); break; }
        this.profile.coins -= STALL_PRICE; saveProfile(this.profile); audio.sfx('select');
        refill(this.bp); this.toast(add(this.bp, 'sticky_rice') ? t('msg_stall') : t('msg_refill'));
        break;
      case 'viewpoint':
        if (poi.id === this.trail.checkpointId && !this.checkpoint) { this.checkpoint = true; this.toast(t('msg_checkpoint')); }
        if (rareOk(poi.rare, this.weather, this.hour) && !this.hasPhoto(poi.rare.subject)) this.takePhoto(poi.rare.subject);
        else this.takePhoto(poi.subject!);
        break;
      case 'photo':
        if (poi.seasons && !poi.seasons.includes(this.season)) { this.toast(t(poi.seasonMsg ?? 'msg_notSeason')); break; }
        this.done.add(poi.id); this.takePhoto(poi.subject!); break;
      case 'secret': this.done.add(poi.id); this.secretFound = true; this.takePhoto(poi.subject!); break;
      case 'waterfall': this.takePhoto(poi.subject!); break;
      case 'item':
        if (!this.pick(poi.item!)) break;
        this.done.add(poi.id); this.poiObjs.get(poi.id)?.setVisible(false);
        audio.sfx('pickup');
        this.toast(poi.item === 'flashlight' ? t('msg_flashlight') : t('msg_pickedUp', { s: t('item_' + poi.item) }));
        break;
      case 'goal':
        if (this.trail.checkpointId && !this.checkpoint) { this.toast(t('msg_needView')); break; }
        if (rareOk(poi.rare, this.weather, this.hour) && !this.hasPhoto(poi.rare.subject)) this.takePhoto(poi.rare.subject);
        if (poi.photo && !this.hasPhoto(poi.photo)) this.takePhoto(poi.photo);
        this.finish();
        break;
    }
  }

  /** Shown when arriving back at camp: quests completed, level-ups, newly unlocked trails. */
  campMessages: string[] = [];
  private quest(kind: QuestKind): void {
    for (const d of notifyQuest(this.profile, kind)) {
      this.toast(t('msg_questDone', { q: t('q_' + d.id) }) + ` +${d.exp} EXP +${d.coins}🪙`); audio.sfx('chime');
      if (d.levelUp) { this.toast(t('msg_levelUp', { n: d.levelUp })); audio.sfx('fanfare'); }
    }
  }

  private finish(): void {
    const lockedBefore = lockedTrails(this.profile), levelBefore = levelInfo(this.profile.exp).level;
    this.summary = applyFinish(this.profile, this.trail, { timeSec: this.elapsed, km: walkedKm(this.hiker, this.world), photos: this.photos, litter: this.litterTaken, secretFound: this.secretFound },
      undefined, skillBonus(this.profile, 'photography'));
    const msgs: string[] = [];
    const level = levelInfo(this.profile.exp).level;
    if (level > levelBefore) msgs.push(t('msg_levelUp', { n: level }));
    for (const d of notifyQuest(this.profile, 'completeTrail')) msgs.push(t('msg_questDone', { q: t('q_' + d.id) }) + ` +${d.exp} EXP +${d.coins}🪙`);
    msgs.push(...CampScene.unlockMessages(this.profile, lockedBefore));
    msgs.push(...progressMessages(checkProgress(this.profile)));
    this.campMessages = msgs;
    const sec = this.elapsed;
    void this.runId.then((id) => cloud.finishRun(id, sec));
    this.endHike(); audio.sfx('stamp');
  }

  /** Leftover cooked food goes home either way (finished or brought back by rangers). */
  private endHike(): void {
    returnCooked(this.bp, this.profile.storage);
    saveProfile(this.profile);
    this.finished = true;
  }

  // ---------- per-frame systems ----------
  private updateEvents(dt: number): void {
    this.activeEvents = this.activeEvents.filter((a) => a.until > this.elapsed);
    for (const s of this.spawns) {
      if (s.gone) continue;
      if (s.until !== undefined && s.until <= this.elapsed) { s.gone = true; s.obj.destroy(); continue; }
      if (s.kind === 'animal' && this.hiker.running && Math.hypot(this.hiker.x - s.x, this.hiker.y - s.y) < 70) { s.gone = true; s.obj.destroy(); this.toast(t('msg_deerFled')); }
    }
    this.spawns = this.spawns.filter((s) => !s.gone);
    this.nextEventIn -= dt;
    if (this.nextEventIn > 0) return;
    this.nextEventIn = EVENT_GAP[0] + Math.random() * (EVENT_GAP[1] - EVENT_GAP[0]);
    const e = pickEvent({ weather: this.weather, zone: this.zone, hasPhoto: (id) => this.hasPhoto(id), active: this.activeEvents.map((a) => a.id) }, Math.random());
    if (!e) return;
    if (e.spawn) {
      const spot = spotAhead(this.world.pathTiles, this.hiker.x, this.hiker.y, Math.random());
      if (!spot) return;
      const [x, y] = spot;
      const obj = e.spawn.kind === 'animal'
        ? this.add.sprite(x, y, 'deer', 0).setOrigin(9 / 20, 20 / 22).setDepth(y)
        : this.img('bag', x, y);
      this.spawns.push({ ...(e.spawn as object), kind: e.spawn.kind, x, y, until: e.duration ? this.elapsed + e.duration : undefined, gone: false, obj } as Spawn);
    }
    if (e.duration) this.activeEvents.push({ id: e.id, until: this.elapsed + e.duration });
    this.toast(t('ev_' + e.id));
  }

  private updateBird(dt: number): void {
    const b = this.bird, h = this.hiker, spots = this.trail.bird?.fleeSpots;
    if (!b || !spots) return;
    if (!b.flying && h.running && Math.hypot(h.x - b.x, h.y - b.y) < 60) {
      const far = spots.filter(([x, y]) => Math.hypot(x * TS - b.homeX, y * TS - b.homeY) > 40);
      const [sx, sy] = far[Math.floor(Math.random() * far.length)];
      b.homeX = sx * TS + 8; b.homeY = sy * TS + 8; b.tx = b.homeX; b.ty = b.homeY; b.flying = true;
      this.toast(t('msg_birdFled'));
    }
    const speed = b.flying ? 130 : 22, dx = b.tx - b.x, dy = b.ty - b.y, dist = Math.hypot(dx, dy);
    if (dist > 1) { const m = Math.min(dist, speed * dt); b.x += (dx / dist) * m; b.y += (dy / dist) * m; }
    else {
      b.flying = false; b.wait -= dt;
      if (b.wait <= 0) { b.wait = 1.5 + Math.random() * 2; b.tx = b.homeX + (Math.random() - 0.5) * 50; b.ty = b.homeY + (Math.random() - 0.5) * 40; }
    }
    const tick = Math.floor(this.time.now / (b.flying ? 80 : 400)) % 2;
    b.spr.setPosition(Math.round(b.x), Math.round(b.y)).setDepth(b.y).setFrame((b.flying ? 2 : 0) + tick);
  }

  // ---------- co-op ----------
  private setupCoop(c: CoopSession): void {
    const add = (o: Other) => {
      const key = 'coop-' + o.id;
      installMiniSheet(this.textures, key, resolveLook(o.look.body, o.look.looks));
      this.coopSprites.set(o.id, this.add.sprite(-100, -100, key, 0).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H).setVisible(false));
    };
    for (const o of c.others.values()) add(o);
    c.onPeople = (kind, o) => {
      if (kind === 'joined') { add(o); this.toast(t('coop_joined', { n: o.name })); audio.sfx('chime'); }
      else { this.coopSprites.get(o.id)?.destroy(); this.coopSprites.delete(o.id); if (this.textures.exists('coop-' + o.id)) this.textures.remove('coop-' + o.id); this.toast(t('coop_left', { n: o.name })); }
    };
    this.toast(t('coop_inRoom', { r: coopPlan.room ?? '', n: c.others.size + 1 }));
  }

  /** One 50 ms input for the server. Own slow-downs are sent so prediction matches; they can only slow you. */
  private coopInput(inp: Input, env: HikeEnv): CoopInput {
    const h = this.hiker;
    const slow = (env.overweight ? CONFIG.OVERWEIGHT_SPEED : 1) * (h.exhausted ? CONFIG.EXHAUSTED_SPEED : 1) * (env.speedMult ?? 1);
    return { l: inp.left, r: inp.right, u: inp.up, d: inp.down, run: inp.run && !h.exhausted && h.stamina > 0, sit: h.sitting, slow };
  }

  private drawCoop(): void {
    for (const o of this.coop!.others.values()) {
      const spr = this.coopSprites.get(o.id);
      if (!spr || !o.seen) continue;
      spr.setVisible(true).setPosition(Math.round(o.x), Math.round(o.y)).setDepth(o.y)
        .setFrame(o.sitting ? MINI_SIT_FRAME : miniFrameIndex(o.dir, o.moving ? o.frame : 0));
    }
  }

  /** Name tags for the HUD: friends' names over their heads. */
  coopTags(): { x: number; y: number; name: string }[] {
    return this.coop ? [...this.coop.others.values()].filter((o) => o.seen).map((o) => ({ x: o.x, y: o.y, name: o.name })) : [];
  }

  private reveal(): void {
    const R = CONFIG.REVEAL_RADIUS + skillRank(this.profile, 'exploration'), w = this.world.w, tx = Math.floor(this.hiker.x / TS), ty = Math.floor(this.hiker.y / TS);
    let changed = false;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= w || y >= this.world.h) continue;
      const k = y * w + x;
      if (this.revealed[k]) continue;
      this.revealed[k] = 1; changed = true;
      const tree = this.world.treeSolid[k], zone = this.trail.gen.zones[this.trail.gen.zoneAt(x, y)];
      this.miniCtx.fillStyle = tree ? (zone.tree === 'broad' ? '#2f6b2f' : '#2d5e3a') : TERRAIN[this.world.tiles[k] as TileId].mini;
      this.miniCtx.fillRect(x, y, 1, 1);
    }
    if (changed) this.miniTex.refresh();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    for (const tt of this.toasts) tt.t -= dt;
    this.toasts = this.toasts.filter((tt) => tt.t > 0);
    this.flash = Math.max(0, this.flash - dt * 3);
    const now = this.time.now / 1000;
    for (const c of this.canopies) c.img.x = c.x + Math.round(Math.sin(now * 1.4 + c.phase) * 0.8);
    if (this.finished || this.frozen) return;

    this.elapsed += dt;
    const h = this.hiker, bp = this.bp;
    h.wearingJacket = bp.wearing.body === 'jacket';
    if (this.weather === 'drizzle' && !bp.wearing.rain && has(bp, 'raincoat')) { bp.wearing.rain = 'raincoat'; this.toast(t('msg_rain')); }
    const env = this.env();
    if (h.moving && env.overweight && !this.overWarned) { this.overWarned = true; this.toast(t('msg_overweight')); }
    const inp = this.readInput();
    if ((inp.left || inp.right || inp.up || inp.down) && this.dialog) this.dialog = null;
    const stepped = this.coop
      ? this.coop.update(dt, h, this.world, () => this.coopInput(inp, env)).stepped
      : moveHiker(h, this.world, inp, env, dt).stepped;
    if (stepped) audio.step(tileAt(this.world, Math.floor(h.x / TS), Math.floor(h.y / TS)));
    if (this.coop) this.drawCoop();
    const tx = Math.floor(h.x / TS), ty = Math.floor(h.y / TS);
    let zone = this.trail.gen.zoneAt(tx, ty);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tileAt(this.world, tx + dx, ty + dy) === T.WATER) zone = this.trail.bird ? 'stream' : 'water';
    if (zone !== this.zone) { this.zone = zone; if (!this.seenZones.has(zone)) { this.seenZones.add(zone); this.toast('📍 ' + t('zone_' + zone)); } }

    const { warnings, rescued } = updateStats(h, this.world, this.env(), dt, this.warned);
    const msg: Record<HikeWarning, string> = { exhausted: 'msg_exhausted', hungry: 'msg_hungry', thirsty: 'msg_thirsty', cold: 'msg_cold', hot: 'msg_hot', rescue: 'msg_rescueWarn' };
    for (const w of warnings) this.toast(t(msg[w]));
    if (rescued) { this.rescued = rescued; this.endHike(); audio.sfx('sad'); }

    this.updateEvents(dt);
    this.updateBird(dt);
    this.reveal();
    const seeDist = 90 + 40 * skillRank(this.profile, 'exploration');
    for (const s of this.sparkles) s.img.setVisible(!this.done.has(s.id) && Math.hypot(h.x - s.x, h.y - s.y) < seeDist);
    for (const s of this.spawns) if (s.kind === 'animal') (s.obj as Phaser.GameObjects.Sprite).setFrame(Math.sin(now * 1.5) > 0.6 ? 1 : 0).setFlipX(h.x < s.x);

    this.player.setPosition(Math.round(h.x), Math.round(h.y)).setDepth(h.y);
    this.player.setFrame(h.sitting ? MINI_SIT_FRAME : miniFrameIndex(h.dir, h.frame));
  }
}
