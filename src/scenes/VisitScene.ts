import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import { clamp } from '../core/rng';
import type { Plot } from '../core/camp';
import type { Profile } from '../core/profile';
import type { Dir } from '../core/hiker';
import { STICKER_ICON, STICKERS, thirstyPlots, type CampCard, type Sticker } from '../core/visit';
import { CAMP } from '../data/camp';
import { resolveLook } from '../data/looks';
import { campGround, campLayout, paintPlots } from '../gfx/campArt';
import { MINI, miniFrameIndex } from '../gfx/paint';
import { installMiniSheet } from '../gfx/sheets';
import { t } from '../i18n';
import type { Toast } from './HikeScene';
import type { MenuRow } from './journalRows';
import { audio } from '../audio/audio';
import { onlinePanelOpen } from '../ui/onlinePanel';
import { vkeys } from '../input/touch';
import { cloud } from '../net/cloud';

const TS = CONFIG.TILE;
/** Where the host stands to greet visitors (by the campfire). */
export const HOST_AT = { x: 9 * TS + 4, y: 9 * TS + 6 };
type VisitRow = MenuRow & { act: 'water' | 'sticker' | 'home'; sticker?: Sticker };

/**
 * A friend's camp, drawn from their published camp card. The visitor can walk around, water the
 * garden and leave one guestbook sticker a day. Nothing here changes the friend's save directly:
 * the visit is stored on the server and the friend's game picks it up later.
 */
export class VisitScene extends Phaser.Scene {
  toasts: Toast[] = [];
  menu: { sel: number } | null = null;
  code = '';
  card: CampCard | null = null;
  status: 'loading' | 'live' = 'loading';
  /** The visitor offered to water (sent with the sticker). */
  water = false;
  /** A sticker was left today: the guestbook is closed for this visit. */
  signed = false;
  sending = false;
  pos = { x: 0, y: 0, dir: 'up' as Dir, frame: 0, animT: 0, moving: false };
  private layout = campLayout();
  private solid = new Uint8Array(0);
  private player!: Phaser.GameObjects.Sprite;
  private plotsTex: Phaser.Textures.CanvasTexture | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private leaving = false;

  constructor() { super('visit'); }
  profileForTag(): Profile { return this.registry.get('profile') as Profile; }

  init(data: { code?: string }): void {
    this.code = data.code ?? ''; this.card = null; this.status = 'loading'; this.toasts = []; this.menu = null;
    this.water = false; this.signed = false; this.sending = false; this.leaving = false; this.plotsTex = null;
  }

  create(): void {
    if (!this.textures.exists('camp-ground')) this.textures.addCanvas('camp-ground', campGround(this.layout.path));
    this.add.image(0, 0, 'camp-ground').setOrigin(0).setDepth(-2);
    const [sx, sy] = CAMP.start;
    this.pos = { x: sx * TS + 8, y: sy * TS + 10, dir: 'up', frame: 0, animT: 0, moving: false };
    this.player = this.add.sprite(this.pos.x, this.pos.y, 'hiker', 0).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, CAMP.W * TS, CAMP.H * TS);
    cam.startFollow(this.player, true, 1, 1, 0, 10);
    cam.setBackgroundColor('#1f3a28');
    const zoom = () => {
      const W = this.scale.width, H = this.scale.height, base = Math.min(W, H) < 560 ? 2 : 3;
      cam.setZoom(Math.max(base, Math.ceil(H / (CAMP.H * TS)), Math.ceil(W / (CAMP.W * TS))));
    };
    zoom(); this.scale.on('resize', zoom);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    const onKey = (e: KeyboardEvent) => { if (!e.repeat) this.onKey(e.code); };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', onKey); this.scale.off('resize', zoom); this.scene.stop('visitHud');
      if (this.textures.exists('visit-host')) this.textures.remove('visit-host');
    });
    this.scene.launch('visitHud');

    cloud.getCamp(this.code)
      .then((r) => {
        if (!this.scene.isActive()) return;
        if (!r) return this.back(t('visit_err_none'));
        if (r.isMe) return this.back(t('visit_err_self'));
        this.build(r.card);
      })
      .catch((e: Error) => this.back(t(e.message === 'auth' ? 'visit_err_auth' : 'visit_err_net')));
  }

  /** Draws the friend's camp from their card. */
  private build(card: CampCard): void {
    this.card = card; this.status = 'live';
    const anchors = this.registry.get('propAnchors') as Record<string, [number, number]>;
    if (this.textures.exists('visit-plots')) this.textures.remove('visit-plots');
    this.plotsTex = this.textures.createCanvas('visit-plots', CAMP.W * TS, CAMP.H * TS)!;
    this.add.image(0, 0, 'visit-plots').setOrigin(0).setDepth(-1);
    this.redrawPlots();
    for (const tr of this.layout.trees) {
      const w = tr.type === 'broad' ? 26 : 18;
      this.add.image(tr.x - w / 2, tr.y - 29, `tree-${tr.type}-${tr.v}-trunk`).setOrigin(0).setDepth(tr.y);
      this.add.image(tr.x - w / 2, tr.y - 29, `tree-${tr.type}-${tr.v}-canopy`).setOrigin(0).setDepth(tr.y + 0.1);
    }
    for (const f of CAMP.fixed) {
      const fx = f.x * TS + (f.type === 'tent' ? 16 : 8), fy = f.y * TS + 15, [ax, ay] = anchors[f.type];
      if (f.type === 'campfire') this.add.sprite(fx - ax, fy - ay, 'campfire', 0).setOrigin(0).setDepth(fy).play('fire-flicker');
      else this.add.image(fx - ax, fy - ay, `prop-${f.type}`).setOrigin(0).setDepth(fy);
    }
    this.solid = Uint8Array.from(this.layout.solid);
    for (const o of card.placed) {
      const key = o.itemId === 'wood_bench' ? 'bench' : o.itemId, [ax, ay] = anchors[key], fx = o.x * TS + 8, fy = o.y * TS + 14;
      this.add.image(fx - ax, fy - ay, `prop-${key}`).setOrigin(0).setDepth(fy);
      this.solid[o.y * CAMP.W + o.x] = 1;
    }
    installMiniSheet(this.textures, 'visit-host', resolveLook(card.body, card.looks));
    this.add.sprite(HOST_AT.x, HOST_AT.y, 'visit-host', miniFrameIndex('down', 0)).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H).setDepth(HOST_AT.y);
    this.solid[Math.floor(HOST_AT.y / TS) * CAMP.W + Math.floor(HOST_AT.x / TS)] = 1;
    this.toast(t('visit_welcome', { n: card.name })); audio.sfx('chime');
  }

  private redrawPlots(): void {
    if (!this.plotsTex || !this.card) return;
    const plots: Plot[] = CAMP.plots.map(([x, y], i) => ({ x, y, ...this.card!.plots[i], watered: this.card!.plots[i].watered || (this.water && thirstyPlots(this.card!.plots).includes(i)) }));
    paintPlots(this.plotsTex.getContext(), plots, 0); this.plotsTex.refresh();
  }

  private back(msg?: string): void {
    if (this.leaving) return;
    this.leaving = true;
    if (msg) audio.sfx('error');
    this.scene.start('camp', { messages: msg ? [msg] : [] });
  }
  toast(text: string): void { this.toasts.push({ text, t: 3.5 }); if (this.toasts.length > 3) this.toasts.shift(); }

  // ---------- interaction ----------
  private isSolid(x: number, y: number): boolean { return x < 0 || y < 0 || x >= CAMP.W || y >= CAMP.H || this.solid[y * CAMP.W + x] === 1; }
  private canStand(px: number, py: number): boolean {
    return [[px - 4, py - 3], [px + 4, py - 3], [px - 4, py + 1], [px + 4, py + 1]].every(([x, y]) => !this.isSolid(Math.floor(x / TS), Math.floor(y / TS)));
  }

  findTarget(): { kind: 'host' | 'plot' | 'home'; label: string } | null {
    if (!this.card) return null;
    const near = (x: number, y: number, r: number) => Math.hypot(this.pos.x - x, this.pos.y - y) < r;
    if (near(HOST_AT.x, HOST_AT.y, 30)) return { kind: 'host', label: this.signed ? t('visit_act_chat') : t('visit_act_sign', { n: this.card.name }) };
    const thirsty = thirstyPlots(this.card.plots);
    if (!this.signed && !this.water && thirsty.length && CAMP.plots.some(([x, y]) => near(x * TS + 8, y * TS + 8, 26))) return { kind: 'plot', label: t('visit_act_water') };
    const sign = CAMP.fixed.find((f) => f.type === 'trailSign')!;
    if (near(sign.x * TS + 8, sign.y * TS + 12, 30)) return { kind: 'home', label: t('visit_act_home') };
    return null;
  }

  private use(): void {
    const tg = this.findTarget();
    if (!tg) return;
    if (tg.kind === 'home') { audio.sfx('select'); this.back(); return; }
    if (tg.kind === 'plot') { this.water = true; audio.sfx('water'); this.toast(t('visit_watered')); this.redrawPlots(); return; }
    if (this.signed) { this.toast(t('visit_chat', { n: this.card!.name })); audio.sfx('blip'); return; }
    audio.sfx('select'); this.menu = { sel: 0 };
  }

  menuRows(): VisitRow[] {
    if (!this.card) return [];
    const rows: VisitRow[] = [];
    if (thirstyPlots(this.card.plots).length) rows.push({ act: 'water', icon: '💧', label: t('visit_water_row'), sub: t('visit_water_sub'), right: this.water ? '✅' : '⬜', enabled: true });
    for (const s of STICKERS) rows.push({ act: 'sticker', sticker: s, icon: STICKER_ICON[s], label: t('sticker_' + s), sub: '', right: '', enabled: !this.sending });
    return rows;
  }

  confirmMenu(): void {
    const r = this.menuRows()[this.menu?.sel ?? -1];
    if (!r || !r.enabled) return;
    if (r.act === 'water') { this.water = !this.water; audio.sfx(this.water ? 'water' : 'blip'); this.redrawPlots(); return; }
    if (r.act !== 'sticker' || this.sending) return;
    this.sending = true; audio.sfx('select');
    void cloud.leaveVisit(this.code, r.sticker!, this.water).then((res) => {
      this.sending = false;
      if (res === 'ok' || res === 'already') { this.signed = true; this.menu = null; }
      this.toast(t('visit_res_' + (['ok', 'already', 'none', 'self'].includes(res) ? res : 'error'), { n: this.card?.name ?? '' }));
      audio.sfx(res === 'ok' ? 'chime' : 'error');
    });
  }

  onKey(code: string): void {
    if (onlinePanelOpen() || this.leaving) return;
    if (this.menu) {
      const n = this.menuRows().length, m = this.menu;
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(code)) audio.sfx('blip');
      if (n && (code === 'ArrowUp' || code === 'KeyW')) m.sel = (m.sel + n - 1) % n;
      if (n && (code === 'ArrowDown' || code === 'KeyS')) m.sel = (m.sel + 1) % n;
      if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.confirmMenu();
      else if (code === 'Escape') this.menu = null;
      return;
    }
    if (code === 'Escape') { audio.sfx('select'); this.back(); return; }
    if (this.status === 'live' && (code === 'KeyE' || code === 'Space')) this.use();
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    for (const tt of this.toasts) tt.t -= dt;
    this.toasts = this.toasts.filter((tt) => tt.t > 0);
    const p = this.pos, k = this.keys;
    let dx = 0, dy = 0;
    if (!this.menu && this.status === 'live' && !onlinePanelOpen()) { if (k.A.isDown || k.LEFT.isDown || vkeys.left) dx--; if (k.D.isDown || k.RIGHT.isDown || vkeys.right) dx++; if (k.W.isDown || k.UP.isDown || vkeys.up) dy--; if (k.S.isDown || k.DOWN.isDown || vkeys.down) dy++; }
    p.moving = dx !== 0 || dy !== 0;
    if (p.moving) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      const run = k.SHIFT.isDown || vkeys.run, speed = run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED, nx = p.x + dx * speed * dt, ny = p.y + dy * speed * dt;
      if (this.canStand(nx, p.y)) p.x = nx;
      if (this.canStand(p.x, ny)) p.y = ny;
      p.x = clamp(p.x, 6, CAMP.W * TS - 6); p.y = clamp(p.y, 6, CAMP.H * TS - 2);
      p.animT += dt * (run ? 12 : 8); p.frame = Math.floor(p.animT) % 4;
    } else p.frame = 0;
    this.player.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y).setFrame(miniFrameIndex(p.dir, p.frame));
  }
}
