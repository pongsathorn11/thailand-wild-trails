import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { touchClaims } from '../input/touch';
import { CONFIG } from '../core/config';
import { packIds, packInc, packMax, packSlots, packWeight } from '../core/backpack';
import { saveProfile, type Profile } from '../core/profile';
import { ITEMS, COOKED } from '../data/items';
import { TRAILS, trailById, type TrailDef, type WeatherId } from '../data/trails';
import { t } from '../i18n';
import { rollWeather } from './HikeScene';
import { CoopSession, coopPlan } from '../net/coop';
import { cloud } from '../net/cloud';
import { displayName } from '../core/cloud';

const FONT = 'Mitr, "Noto Sans Thai", Tahoma, sans-serif';
interface Hit { x: number; y: number; w: number; h: number; fn: () => void }

/** Packing screen before a hike: pick what goes in the backpack, see the forecast, set off. */
export class PackScene extends Phaser.Scene {
  private trail!: TrailDef;
  private weather: WeatherId = 'clear';
  private row = 0;
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private hits: Hit[] = [];

  constructor() { super('pack'); }
  private get profile(): Profile { return this.registry.get('profile') as Profile; }

  init(data: { trailId?: string }): void {
    this.trail = trailById(data.trailId ?? '') ?? TRAILS[0];
    this.weather = rollWeather(this.trail);
    this.row = 0; this.coopMsg = ''; this.joining = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1b2a22');
    this.g = this.add.graphics();
    this.texts = [];
    const onKey = (e: KeyboardEvent) => { if (!e.repeat) this.onKey(e.code); };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const h = this.hits.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (h) { audio.sfx('blip'); h.fn(); }
    });
  }

  private ids(): string[] { return packIds(this.profile.storage); }

  private change(id: string, d: 1 | -1): void {
    const pack = this.profile.pack;
    if (d > 0) packInc(pack, id, this.profile.storage);
    else pack[id] = Math.max(0, (pack[id] || 0) - 1);
    saveProfile(this.profile);
  }

  private coopMsg = '';
  private joining = false;
  private go(): void {
    if (this.joining) return;
    const p = this.profile;
    p.lastTrail = this.trail.id; saveProfile(p);
    audio.sfx('select');
    if (!coopPlan.room) { this.scene.start('hike', { trailId: this.trail.id, weather: this.weather }); return; }
    // co-op: join the room first; the room decides the weather for everyone in it
    this.joining = true; this.coopMsg = t('coop_joining', { r: coopPlan.room });
    void cloud.accessToken().then((token) => CoopSession.join(this.trail.id, coopPlan.room!, token, displayName(p, t('on_hiker')), { body: p.body, looks: p.looks[p.body] }))
      .then((coop) => this.scene.start('hike', { trailId: this.trail.id, weather: coop.weather, coop }))
      .catch((e: Error) => { this.joining = false; this.coopMsg = t('coop_err_' + (['full', 'auth', 'no server'].includes(e.message) ? e.message.replace(' ', '_') : 'connect')); audio.sfx('error'); });
  }

  private onKey(code: string): void {
    const ids = this.ids(), n = ids.length;
    if (code.startsWith('Arrow')) audio.sfx('blip');
    if (code === 'ArrowUp' || code === 'KeyW') this.row = (this.row + n - 1) % n;
    if (code === 'ArrowDown' || code === 'KeyS') this.row = (this.row + 1) % n;
    if (code === 'ArrowRight' || code === 'KeyD') this.change(ids[this.row], 1);
    if (code === 'ArrowLeft' || code === 'KeyA') this.change(ids[this.row], -1);
    if (code === 'Escape') this.scene.start('camp');
    if (code === 'Enter' || code === 'Space') this.go();
  }

  private text(s: string, x: number, y: number, size = 14, color = '#f4ecd8', align: 'left' | 'center' | 'right' = 'left', bold = false): Phaser.GameObjects.Text {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setText(s).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal');
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }

  update(): void {
    const IW = this.scale.width, IH = this.scale.height, g = this.g, p = this.profile, st = p.storage, ids = this.ids();
    g.clear(); this.used = 0; this.hits = [];
    this.row = Math.min(this.row, ids.length - 1);
    const pw = Math.min(680, IW - 24), rh = 44, ph = 176 + ids.length * rh + 96, px = IW / 2 - pw / 2, py = Math.max(12, IH / 2 - ph / 2);
    g.fillStyle(0x121c16, 0.94).fillRoundedRect(px, py, pw, ph, 12);
    g.lineStyle(1.5, 0xe8d9a8, 0.35).strokeRoundedRect(px, py, pw, ph, 12);
    this.text('🎒 ' + t('pack_title'), IW / 2, py + 30, 22, '#ffe9a8', 'center', true);

    // trail + forecast (the trail was picked at the camp's trail sign)
    g.fillStyle(0xffffff, 0.06).fillRoundedRect(px + 16, py + 54, pw - 32, 96, 8);
    this.text('✕', px + pw - 30, py + 30, 16, '#cfc3a6', 'center', true); this.hits.push({ x: px + pw - 48, y: py + 12, w: 36, h: 36, fn: () => this.scene.start('camp') });
    this.text('⛰️ ' + t(this.trail.trailKey), IW / 2, py + 78, 16, '#f4ecd8', 'center', true);
    this.text(t(this.trail.parkKey) + ' · ' + t(this.trail.diffKey), IW / 2, py + 102, 12.5, '#cfe3b8', 'center');
    const icon = { clear: '☀️', fog: '🌫️', drizzle: '🌦️' }[this.weather];
    this.text(`${t('forecast')}: ${icon} ${t('w_' + this.weather)} · ${t('tip_' + this.weather)}`, IW / 2, py + 128, 12.5, '#a8dcff', 'center')
      .setWordWrapWidth(pw - 60, true);

    // item rows
    ids.forEach((id, i) => {
      const y = py + 176 + i * rh, sel = this.row === i, def = ITEMS[id], n = Math.min(p.pack[id] || 0, packMax(id, st));
      if (sel) g.fillStyle(0xffe9a8, 0.12).fillRoundedRect(px + 12, y - 19, pw - 24, rh - 4, 8);
      this.text(def.icon, px + 34, y, 20, '#ffffff', 'center');
      this.text(t('item_' + id), px + 56, y - 8, 14.5, sel ? '#ffe9a8' : '#f4ecd8', 'left', sel);
      this.text(t('tip_' + id), px + 56, y + 10, 11, '#cfc3a6');
      const cx = px + pw - 118;
      this.text(`◀  ${n}/${packMax(id, st)}  ▶`, cx, y, 15, n ? '#f4ecd8' : '#8a8270', 'center', true);
      if (COOKED.includes(id)) this.text(t('from_camp'), cx - 64, y, 11, '#9bd35a', 'right');
      this.text(((def.weightKg ?? 0) * n).toFixed(1) + ' kg', px + pw - 24, y, 12.5, '#cfc3a6', 'right');
      this.hits.push({ x: cx - 52, y: y - 18, w: 34, h: 36, fn: () => { this.row = i; this.change(id, -1); } });
      this.hits.push({ x: cx + 18, y: y - 18, w: 34, h: 36, fn: () => { this.row = i; this.change(id, 1); } });
      this.hits.push({ x: px + 12, y: y - 19, w: cx - 60 - px, h: rh - 4, fn: () => { this.row = i; } });
    });

    // weight bar + start
    const kg = packWeight(p.pack, st), over = kg > CONFIG.MAX_WEIGHT_KG, by = py + 176 + ids.length * rh - 6, bw = pw - 64;
    g.fillStyle(0x000000, 0.45).fillRoundedRect(px + 32, by, bw, 12, 6);
    g.fillStyle(over ? 0xe06050 : 0x9bd35a, 1).fillRoundedRect(px + 32, by, Math.max(6, Math.min(1, kg / CONFIG.MAX_WEIGHT_KG) * bw), 12, 6);
    this.text(`${t('weight')} ${kg.toFixed(1)}/${CONFIG.MAX_WEIGHT_KG} kg · ${packSlots(p.pack, st)}/${CONFIG.MAX_SLOTS} ${t('slots')} · ${over ? t('pack_over') : t('pack_ok')}`,
      IW / 2, by + 28, 12.5, over ? '#ff9a8a' : '#cfe3b8', 'center');
    const sy = py + ph - 52, sw = Math.min(280, pw - 40);
    g.fillStyle(0x2a5a1a, 1).fillRoundedRect(IW / 2 - sw / 2, sy, sw, 42, 12);
    g.fillStyle(0x5aa63a, 1).fillRoundedRect(IW / 2 - sw / 2 + 3, sy + 3, sw - 6, 34, 10);
    this.text(t('port_go'), IW / 2, sy + 20, 17, '#ffffff', 'center', true);
    this.hits.push({ x: IW / 2 - sw / 2, y: sy, w: sw, h: 42, fn: () => this.go() });
    if (coopPlan.room) this.text(this.coopMsg || t('coop_room_badge', { r: coopPlan.room }), IW / 2, sy - 16, 12.5, '#ffe9a8', 'center', true);
    this.text(t('pack_keys'), IW / 2, py + ph + 14, 11.5, 'rgba(244,236,216,0.7)', 'center');
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }
}
