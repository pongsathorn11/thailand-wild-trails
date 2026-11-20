import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { touch, touchClaims } from '../input/touch';
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
import { cycleTrail } from '../core/camp';
import { bar, C, FONT, greenButton, notch, paper, PIXEL_FONT, rule, slot, tag, TX, wood, woodButton } from '../ui/theme';

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
    this.weather = rollWeather(this.trail, Math.random(), this.profile.day || 1);
    this.row = 0; this.coopMsg = ''; this.joining = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2f4527');
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

  /** ◀ ▶ on the trail card (or Q / E): switch to another unlocked trail and roll its forecast. */
  private switchTrail(dir: 1 | -1): void {
    const id = cycleTrail(this.profile, this.trail.id, dir);
    if (id === this.trail.id) { audio.sfx('error'); return; }
    this.trail = trailById(id)!; this.weather = rollWeather(this.trail, Math.random(), this.profile.day || 1); audio.sfx('blip');
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
    if (code === 'KeyQ') this.switchTrail(-1);
    if (code === 'KeyE') this.switchTrail(1);
    if (code === 'Escape') this.scene.start('camp');
    if (code === 'Enter' || code === 'Space') this.go();
  }

  private text(s: string, x: number, y: number, size = 14, color = TX.cream, align: 'left' | 'center' | 'right' = 'left', bold = false, font = FONT): Phaser.GameObjects.Text {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setAlpha(1).setCrop().setText(s).setFontFamily(font === PIXEL_FONT && size < 16 ? FONT : font).setFontSize(size).setColor(color)
      .setFontStyle(bold ? 'bold' : 'normal').setShadow(0, 0, '', 0).setWordWrapWidth(0);
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }
  private sign(s: string, x: number, y: number, size: number, color: string = TX.cream, align: 'left' | 'center' | 'right' = 'left'): Phaser.GameObjects.Text {
    return this.text(s, x, y, size, color, align, true).setShadow(0, 2, TX.woodShadow, 0, false, true);
  }
  private hit(x: number, y: number, w: number, h: number, fn: () => void): void { this.hits.push({ x, y, w, h, fn }); }

  update(): void {
    const IW = this.scale.width, IH = this.scale.height, g = this.g, p = this.profile, st = p.storage, ids = this.ids();
    g.clear(); this.used = 0; this.hits = [];
    this.row = Math.min(this.row, ids.length - 1);
    const wide = IW >= 900, n = ids.length;
    const W = Math.min(1120, IW - 24), SIDE = wide ? 340 : 0, LW = wide ? W - 24 - SIDE : W;
    const x0 = Math.round(IW / 2 - W / 2);
    // narrow: a compact trail card and capacity sit inside the ledger column; on touch it all stays above the
    // touch buttons (their OK sets off, ✕ goes back), so the green button is only drawn when there is room
    const extraTop = wide ? 0 : 72, extraBottom = wide ? 0 : 72;
    const fixed = 56 + 34 + 16 + extraTop + extraBottom, limit = !wide && touch.enabled ? IH - 244 : IH - 12;
    const rh = Math.max(34, Math.min(50, Math.floor((limit - 12 - fixed - (wide ? 0 : touch.enabled ? 0 : 60)) / n)));
    const LH = fixed + n * rh, y0 = Math.max(12, wide ? Math.round(IH / 2 - Math.max(LH, 560) / 2) : touch.enabled ? 12 : Math.round((IH - LH - 60) / 2));
    const tips = rh >= 46, cxOff = wide ? 150 : 124;

    // ---- ledger: wood header over paper ----
    paper(g, x0, y0 + 48, LW, LH - 48);
    wood(g, x0, y0, LW, 56);
    this.sign('🎒 ' + t('pack_title'), x0 + 18, y0 + 28, 19);
    woodButton(g, x0 + LW - 52, y0 + 10, 38, 36);
    this.text('✕', x0 + LW - 33, y0 + 28, 16, TX.cream, 'center', true);
    this.hit(x0 + LW - 56, y0 + 6, 46, 44, () => this.scene.start('camp'));

    let cy = y0 + 64;
    if (!wide) { this.trailCard(x0 + 12, cy, LW - 24, 64, false); cy += 72; }
    this.text(t('ui_item'), x0 + 74, cy + 14, 11.5, TX.inkFaint);
    this.text(t('ui_qty'), x0 + LW - cxOff, cy + 14, 11.5, TX.inkFaint, 'center');
    this.text(t('ui_kg'), x0 + LW - 22, cy + 14, 11.5, TX.inkFaint, 'right');
    cy += 30;

    ids.forEach((id, i) => {
      const y = cy + i * rh + rh / 2, sel = this.row === i, def = ITEMS[id], max = packMax(id, st), q = Math.min(p.pack[id] || 0, max);
      if (sel) { notch(g, x0 + 12, y - rh / 2 + 2, LW - 24, rh - 4, 3, C.gold); g.fillStyle(C.paperLight, 1).fillRect(x0 + 15, y - rh / 2 + 5, LW - 30, rh - 10); }
      else if (i < n - 1) rule(g, x0 + 20, y + rh / 2 - 1, LW - 40);
      const ic = Math.min(38, rh - 10);
      slot(g, x0 + 22, y - ic / 2, ic, false, false);
      this.text(def.icon, x0 + 22 + ic / 2, y + 1, ic * 0.5, '#ffffff', 'center');
      const cx = x0 + LW - cxOff, bs = 32, nameW = cx - 56 - (x0 + 74) - 6;
      const nameT = this.text(t('item_' + id), x0 + 74, tips ? y - 9 : y, 14.5, TX.ink, 'left', true).setCrop(0, 0, nameW, 40);
      if (COOKED.includes(id) && nameT.width + 90 < nameW) this.text(t('from_camp'), x0 + 82 + nameT.width, tips ? y - 9 : y, 11, TX.green, 'left', true);
      if (tips) this.text(t('tip_' + id), x0 + 74, y + 11, 11, TX.inkSoft).setCrop(0, 0, nameW, 30);
      woodButton(g, cx - 52, y - bs / 2, bs, bs, q <= 0);
      this.text('−', cx - 36, y, 18, q <= 0 ? '#7a6a50' : TX.cream, 'center', true);
      this.text(`${q}/${max}`, cx, y, 16, q ? TX.ink : TX.inkFaint, 'center', true, PIXEL_FONT);
      woodButton(g, cx + 20, y - bs / 2, bs, bs, q >= max);
      this.text('+', cx + 36, y, 18, q >= max ? '#7a6a50' : TX.cream, 'center', true);
      this.text(((def.weightKg ?? 0) * q).toFixed(1) + ' kg', x0 + LW - 22, y, 13, q ? TX.ink : TX.inkFaint, 'right', true);
      this.hit(cx - 56, y - rh / 2 + 2, 40, rh - 4, () => { this.row = i; this.change(id, -1); });
      this.hit(cx + 16, y - rh / 2 + 2, 40, rh - 4, () => { this.row = i; this.change(id, 1); });
      this.hit(x0 + 12, y - rh / 2 + 2, cx - 60 - x0 - 12, rh - 4, () => { this.row = i; });
    });

    // ---- side column (wide) or bottom block (narrow): capacity + set off ----
    if (wide) {
      const sx = x0 + LW + 24;
      this.trailCard(sx, y0, SIDE, 0, true);
      this.capacity(sx, y0 + 272, SIDE);
      this.goButton(sx, y0 + 272 + 138, SIDE, 64);
    } else {
      this.capacityCompact(x0 + 12, cy + n * rh + 6, LW - 24);
      if (!touch.enabled) this.goButton(x0 + LW / 2 - Math.min(140, LW / 2 - 12), y0 + LH + 10, Math.min(280, LW - 24), 50);
      else if (coopPlan.room || this.coopMsg) this.text(this.coopMsg || t('coop_room_badge', { r: coopPlan.room! }), IW / 2, y0 + LH + 14, 12, TX.gold, 'center', true).setWordWrapWidth(IW - 32, true);
    }
    if (!touch.enabled) {
      const kt = this.text(t('pack_keys'), IW / 2, IH - 14, 11.5, TX.creamDim, 'center');
      if (y0 + LH + (wide ? 0 : 64) > IH - 30) kt.setVisible(false);
    }
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  /** Trail picked at the camp sign, plus the forecast. Wide: a wood sign and a paper forecast card. */
  private trailCard(x: number, y: number, w: number, h: number, wide: boolean): void {
    const g = this.g, icon = { clear: '☀️', fog: '🌫️', drizzle: '🌦️' }[this.weather];
    if (wide) {
      wood(g, x, y, w, 104);
      this.text(t('ui_trail'), x + 16, y + 20, 11.5, TX.creamDim);
      this.sign(t(this.trail.trailKey), x + w / 2, y + 48, 15, TX.cream, 'center').setWordWrapWidth(w - 100, true).setAlign('center');
      this.arrows(x + 10, x + w - 44, y + 32);
      this.text(t(this.trail.parkKey), x + w / 2, y + 80, 11.5, TX.creamDim, 'center').setCrop(0, 0, w - 24, 30);
      paper(g, x, y + 116, w, 140);
      this.text(t('ui_forecast'), x + 18, y + 136, 11.5, TX.inkFaint);
      slot(g, x + 18, y + 152, 52);
      this.text(icon, x + 44, y + 179, 26, '#ffffff', 'center');
      this.text(t('w_' + this.weather), x + 84, y + 166, 16, TX.ink, 'left', true);
      this.text(t(this.trail.diffKey), x + 84, y + 190, 12, TX.inkSoft);
      this.text(t('tip_' + this.weather), x + 18, y + 226, 12, TX.inkSoft).setWordWrapWidth(w - 36, true).setOrigin(0, 0.5);
    } else {
      wood(g, x, y, w, h);
      this.sign(t(this.trail.trailKey), x + 14, y + 22, 14).setCrop(0, 0, w - 112, 30);
      this.text(`${icon} ${t('w_' + this.weather)} · ${t('tip_' + this.weather)}`, x + 14, y + 44, 11.5, TX.sky).setCrop(0, 0, w - 112, 30);
      this.arrows(x + w - 86, x + w - 46, y + 15);
    }
  }

  private arrows(lx: number, rx: number, y: number): void {
    const one = cycleTrail(this.profile, this.trail.id, 1) === this.trail.id;
    woodButton(this.g, lx, y, 34, 34, one); this.text('◀', lx + 17, y + 17, 13, one ? '#7a6a50' : TX.cream, 'center', true);
    woodButton(this.g, rx, y, 34, 34, one); this.text('▶', rx + 17, y + 17, 13, one ? '#7a6a50' : TX.cream, 'center', true);
    this.hit(lx - 4, y - 4, 42, 42, () => this.switchTrail(-1));
    this.hit(rx - 4, y - 4, 42, 42, () => this.switchTrail(1));
  }

  /** Weight bar and the 12 backpack slots as a row of blocks. */
  private capacity(x: number, y: number, w: number): void {
    const g = this.g, p = this.profile, st = p.storage, kg = packWeight(p.pack, st), over = kg > CONFIG.MAX_WEIGHT_KG, used = packSlots(p.pack, st);
    paper(g, x, y, w, 126);
    this.text(t('weight'), x + 18, y + 22, 13, TX.ink);
    this.text(`${kg.toFixed(1)} / ${CONFIG.MAX_WEIGHT_KG} kg`, x + w - 18, y + 22, 13, over ? TX.red : TX.ink, 'right', true);
    bar(g, x + 18, y + 34, w - 36, 14, kg / CONFIG.MAX_WEIGHT_KG, over ? C.red : C.stamina);
    this.text(t('ui_slots'), x + 18, y + 66, 13, TX.ink);
    this.text(`${used} / ${CONFIG.MAX_SLOTS}`, x + w - 18, y + 66, 13, used > CONFIG.MAX_SLOTS ? TX.red : TX.ink, 'right', true);
    const n = CONFIG.MAX_SLOTS, cw = (w - 36 - (n - 1) * 3) / n;
    for (let i = 0; i < n; i++) g.fillStyle(i < used ? C.wood : C.paperLine, 1).fillRect(Math.round(x + 18 + i * (cw + 3)), y + 78, Math.round(cw), 12);
    this.text(over ? t('pack_over') : t('ui_over_tip', { n: CONFIG.MAX_WEIGHT_KG }), x + 18, y + 106, 11, over ? TX.red : TX.inkSoft).setCrop(0, 0, w - 36, 30);
  }

  /** Phones: weight and slots on one paper strip. */
  private capacityCompact(x: number, y: number, w: number): void {
    const g = this.g, p = this.profile, st = p.storage, kg = packWeight(p.pack, st), over = kg > CONFIG.MAX_WEIGHT_KG, used = packSlots(p.pack, st);
    paper(g, x, y, w, 60);
    this.text(`${t('weight')} ${kg.toFixed(1)}/${CONFIG.MAX_WEIGHT_KG} kg`, x + 16, y + 20, 12.5, over ? TX.red : TX.ink, 'left', true);
    this.text(`${used}/${CONFIG.MAX_SLOTS} ${t('slots')}`, x + w - 16, y + 20, 12.5, used > CONFIG.MAX_SLOTS ? TX.red : TX.ink, 'right', true);
    bar(g, x + 16, y + 34, w - 32, 12, kg / CONFIG.MAX_WEIGHT_KG, over ? C.red : C.stamina);
  }

  private goButton(x: number, y: number, w: number, h: number): void {
    greenButton(this.g, x, y, w, h);
    this.text(t('port_go'), x + w / 2, y + h / 2 - 3, h > 56 ? 21 : 17, '#ffffff', 'center', true).setShadow(0, 3, '#24461a', 0, false, true);
    this.hit(x, y, w, h, () => this.go());
    if (coopPlan.room) {
      const m = this.text(this.coopMsg || t('coop_room_badge', { r: coopPlan.room }), x + w / 2, y + h + 18, 12.5, TX.gold, 'center', true).setWordWrapWidth(w, true);
      tag(this.g, x + w / 2 - Math.min(w, m.width) / 2 - 8, y + h + 4, Math.min(w, m.width) + 16, m.height + 8, 0.85);
    }
  }
}
