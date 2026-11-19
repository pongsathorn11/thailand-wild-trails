import Phaser from 'phaser';
import { touch, touchClaims } from '../input/touch';
import { CONFIG } from '../core/config';
import { ambientC, walkedKm } from '../core/hiker';
import { clockLabel, darkness, tint } from '../core/time';
import { lightMask } from '../gfx/props';
import { weight } from '../core/backpack';
import { ITEMS } from '../data/items';
import { t } from '../i18n';
import type { HikeScene } from './HikeScene';
import { nameTag } from './nameTag';

const FONT = 'Mitr, "Noto Sans Thai", Tahoma, sans-serif';
const TS = CONFIG.TILE;
const EV_ICON: Record<string, string> = { slippery: '⚠️', coldWind: '🌬️', fogRoll: '🌫️', wildlife: '🦌' };

/** Full-resolution overlay drawn on top of the zoomed world. Reads HikeScene state, never changes it. */
export class HudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private top!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.RenderTexture;
  private mini!: Phaser.GameObjects.Image;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private rain: { x: number; y: number; s: number }[] = [];
  private hotbar = { x0: 0, y: 0, sz: 0, step: 0 };

  constructor() { super('hud'); }

  create(): void {
    if (!this.textures.exists('light-small')) this.textures.addCanvas('light-small', lightMask(CONFIG.LIGHT_RADIUS * 3));
    if (!this.textures.exists('light-big')) this.textures.addCanvas('light-big', lightMask(CONFIG.LIGHT_RADIUS_FLASHLIGHT * 3));
    this.night = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setOrigin(0).setDepth(0);
    this.g = this.add.graphics().setDepth(1);
    this.mini = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(1.5).setVisible(false);
    this.top = this.add.graphics().setDepth(3);
    this.scale.on('resize', (s: Phaser.Structs.Size) => this.night.resize(s.width, s.height));
    for (let i = 0; i < 160; i++) this.rain.push({ x: Math.random() * 2000, y: Math.random() * 1200, s: 420 + Math.random() * 240 });
    // click/tap a hotbar slot to use it
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const hb = this.hotbar, hike = this.scene.get('hike') as HikeScene;
      if (hike.finished || p.y < hb.y || p.y > hb.y + hb.sz || p.x < hb.x0) return;
      const i = Math.floor((p.x - hb.x0) / hb.step);
      if (i < CONFIG.MAX_SLOTS) hike.useSlot(i);
    });
  }

  private text(s: string, x: number, y: number, size = 14, color = '#f4ecd8', align: 'left' | 'center' | 'right' = 'left', bold = false, depth = 2): void {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setAlpha(1).setText(s).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal').setDepth(depth);
    tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }

  private panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, a = 0.78): void {
    g.fillStyle(0x121c16, a).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1.5, 0xe8d9a8, 0.35 * Math.min(1, a / 0.78)).strokeRoundedRect(x, y, w, h, 10);
  }

  private bar(x: number, y: number, w: number, v: number, color: number, label: string): void {
    this.text(label, x, y + 6, 13, '#e8dcc0');
    const bx = x + 52;
    this.g.fillStyle(0x000000, 0.45).fillRoundedRect(bx, y, w, 12, 6);
    if (v > 0) this.g.fillStyle(color, 1).fillRoundedRect(bx, y, Math.max(6, (w * v) / 100), 12, 6);
    this.text(String(Math.ceil(v)), bx + w + 8, y + 6, 12, '#e8dcc0');
  }

  update(_t: number, deltaMs: number): void {
    const hike = this.scene.get('hike') as HikeScene;
    if (!hike?.hiker || !hike.world) return;
    const IW = this.scale.width, IH = this.scale.height, g = this.g, h = hike.hiker, cam = hike.cameras.main, narrow = IW < 700;
    g.clear(); this.top.clear(); this.used = 0;

    // ---- light and weather ----
    const sx = (h.x - cam.worldView.x) * cam.zoom, sy = (h.y - 10 - cam.worldView.y) * cam.zoom;
    const dark = darkness(hike.hour);
    this.night.clear();
    if (dark > 0) {
      this.night.fill(0x080c24, dark);
      const big = hike.flashlight, r = (big ? CONFIG.LIGHT_RADIUS_FLASHLIGHT : CONFIG.LIGHT_RADIUS) * 3;
      this.night.erase(big ? 'light-big' : 'light-small', sx - r, sy - r);
    }
    const ti = tint(hike.hour);
    if (ti) g.fillStyle(ti[0], ti[1]).fillRect(0, 0, IW, IH);
    let fog = hike.weather === 'fog' ? (hike.hour < 9 ? 0.42 : hike.hour < 11 ? 0.25 : 0.12) : hike.hour < 7 ? 0.1 : 0;
    fog = Math.min(0.6, fog + hike.eventFog());
    if (fog > 0) g.fillStyle(0xe1ebf0, fog).fillRect(0, 0, IW, IH);
    if (hike.weather === 'drizzle') {
      g.fillStyle(0x283c5a, 0.12).fillRect(0, 0, IW, IH);
      const dt = Math.min(0.05, deltaMs / 1000);
      g.fillStyle(0xbed2f0, 0.55);
      for (const r of this.rain) {
        r.y += r.s * dt; r.x -= r.s * 0.15 * dt;
        if (r.y > IH) { r.y = -8; r.x = Math.random() * (IW + 60); }
        g.fillRect(Math.round(r.x), Math.round(r.y), 2, 8);
      }
    }

    // ---- name and title above the hiker ----
    if (!hike.finished) {
      const tag = nameTag(hike.profile), tw = 16 + tag.length * 7.2, ty = sy - 22 * cam.zoom;
      g.fillStyle(0x121c16, 0.6).fillRoundedRect(sx - tw / 2, ty - 10, tw, 20, 8);
      this.text(tag, sx, ty, 12, '#ffe9a8', 'center');
      // friends in a co-op room
      for (const o of hike.coopTags()) {
        const ox = (o.x - cam.worldView.x) * cam.zoom, oy = (o.y - 10 - cam.worldView.y) * cam.zoom - 22 * cam.zoom;
        if (ox < -60 || oy < -20 || ox > IW + 60 || oy > IH + 20) continue;
        const s = '🤝 ' + o.name, w = 20 + s.length * 7.2;
        g.fillStyle(0x1a3a5a, 0.7).fillRoundedRect(ox - w / 2, oy - 10, w, 20, 8);
        this.text(s, ox, oy, 12, '#cfe8ff', 'center');
      }
    }

    // ---- stats + carried items ----
    this.panel(g, 14, 14, 250, 150);
    const low = (v: number) => v < 25 && Math.sin(this.time.now / 125) > 0;
    this.bar(28, 28, 150, h.stamina, h.exhausted ? 0xc0504d : 0x9bd35a, t('stamina'));
    this.bar(28, 50, 150, h.hunger, low(h.hunger) ? 0xffd27a : 0xe8a33d, t('hunger'));
    this.bar(28, 72, 150, h.thirst, low(h.thirst) ? 0xa8dcff : 0x4aa3e0, t('thirst'));
    this.bar(28, 94, 150, h.warmth, h.warmth < 30 ? 0x7fb2e5 : 0xf08a5d, t('warmth'));
    const kg = weight(hike.bp), over = kg > CONFIG.MAX_WEIGHT_KG;
    this.text(`🎒 ${kg.toFixed(1)}/${CONFIG.MAX_WEIGHT_KG} kg · ${hike.bp.slots.length}/${CONFIG.MAX_SLOTS} ${t('slots')}`, 28, 122, 12.5, over ? '#ff9a8a' : '#f4ecd8');
    this.text(t('walked', { d: walkedKm(h, hike.world).toFixed(1) }) + `   📷 ${hike.photos.length}`, 28, 144, 12.5, '#cfc3a6');

    // ---- clock, weather, temperature, minimap ----
    const icon = { clear: '☀️', fog: '🌫️', drizzle: '🌦️' }[hike.weather];
    const clock = narrow
      ? `${clockLabel(hike.trail.startHour, hike.elapsed)} ${icon} ${Math.round(ambientC(hike.env()))}°C`
      : `🕒 ${clockLabel(hike.trail.startHour, hike.elapsed)}  ${icon} ${t('w_' + hike.weather)}  🌡️ ${Math.round(ambientC(hike.env()))}°C`;
    const mmS = narrow ? 1.6 : 3, mmW = hike.world.w * mmS, mmH = hike.world.h * mmS, mmX = IW - mmW - 18, mmY = 58;
    this.panel(g, mmX - 8, 14, mmW + 16, mmH + 58);
    this.text(clock, mmX + mmW / 2, 36, narrow ? 12 : 13.5, '#f4ecd8', 'center', true);
    g.fillStyle(0x0e1612, 1).fillRect(mmX, mmY, mmW, mmH);
    this.mini.setTexture('minimap').setPosition(mmX, mmY).setDisplaySize(mmW, mmH).setVisible(true);
    const dot = (tx: number, ty: number, color: number, r: number) => this.top.fillStyle(color, 1).fillCircle(mmX + tx * mmS + mmS / 2, mmY + ty * mmS + mmS / 2, r);
    for (const poi of hike.trail.pois) {
      const known = poi.type === 'viewpoint' || poi.type === 'goal' || hike.revealed[poi.y * hike.world.w + poi.x];
      if (known && poi.type !== 'secret') dot(poi.x, poi.y, poi.type === 'viewpoint' ? 0x4fc3f7 : poi.type === 'goal' ? 0xe74c3c : 0xf4ecd8, 2.5);
    }
    dot(h.x / TS - 0.5, h.y / TS - 0.5, 0xffffff, 3.5);
    hike.activeEvents.forEach((a, i) => this.text(EV_ICON[a.id] ?? '•', mmX + mmW - 10 - i * 22, mmY + mmH + 14, 14, '#fff', 'center'));

    // ---- objective ----
    const tr = hike.trail, toCp = !!tr.checkpointId && !hike.checkpoint;
    const target = tr.pois.find((p) => p.id === (toCp ? tr.checkpointId : tr.goalId))!;
    const dx = target.x * TS + 8 - h.x, dy = target.y * TS + 8 - h.y;
    const meters = Math.round((Math.hypot(dx, dy) * tr.realData.distanceKm * 1000) / hike.world.pathLenPx);
    const label = t((toCp ? tr.objKeys.checkpoint : tr.objKeys.goal) ?? '') + ` · ${meters} m`;
    const ow = Math.min(narrow ? IW - 28 : 380, 380), ox = narrow ? 14 : IW / 2 - ow / 2, oy = narrow ? 174 : 14;
    this.panel(g, ox, oy, ow, 40);
    const ang = Math.atan2(dy, dx), ax = ox + 24, ay = oy + 20;
    const pt = (r: number, a: number) => [ax + Math.cos(ang + a) * r, ay + Math.sin(ang + a) * r];
    const [x1, y1] = pt(11, 0), [x2, y2] = pt(9, 2.4), [x3, y3] = pt(9, -2.4);
    g.fillStyle(toCp ? 0x4fc3f7 : 0xe74c3c, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
    this.text(label, ox + 44, oy + 20, 15, '#f4ecd8', 'left', true);

    // ---- toasts ----
    hike.toasts.forEach((tt, i) => {
      const y = (narrow ? 224 : 64) + i * 40, w = Math.min(IW - 28, 460);
      this.panel(g, IW / 2 - w / 2, y, w, 32, 0.85 * Math.min(1, tt.t));
      this.text(tt.text, IW / 2, y + 16, 14, '#fff6dc', 'center');
    });

    // ---- hotbar: 12 backpack slots, keys 1–9 0 - = ----
    const n = CONFIG.MAX_SLOTS, sz = Math.min(46, (IW - 40) / n - 4), hbW = n * (sz + 4) + 8, hbX = IW / 2 - hbW / 2, hbY = IH - sz - 44;
    this.hotbar = { x0: hbX + 6, y: hbY, sz, step: sz + 4 };
    this.panel(g, hbX, hbY - 4, hbW, sz + 8, 0.8);
    const keyLabel = (i: number) => (i < 9 ? String(i + 1) : ['0', '-', '='][i - 9]);
    for (let i = 0; i < n; i++) {
      const x = hbX + 6 + i * (sz + 4), s = hike.bp.slots[i];
      g.fillStyle(0xffffff, 0.08).fillRoundedRect(x, hbY, sz, sz, 6);
      if (s) {
        if (Object.values(hike.bp.wearing).includes(s.itemId)) g.lineStyle(2, 0x9bd35a, 1).strokeRoundedRect(x, hbY, sz, sz, 6);
        this.text(ITEMS[s.itemId].icon, x + sz / 2, hbY + sz / 2 + 1, sz * 0.5, '#ffffff', 'center');
        this.texts[this.used - 1].setAlpha(s.itemId === 'water_bottle' && !s.full ? 0.35 : 1);
        const count = s.qty > 1 ? s.qty : s.charges ? s.charges : '';
        if (count) this.text(String(count), x + sz - 4, hbY + sz - 8, 11, '#ffffff', 'right', true);
      }
      this.text(keyLabel(i), x + 4, hbY + 8, 10, 'rgba(244,236,216,0.6)');
    }

    // ---- dialog or interaction prompt ----
    if (hike.dialog) {
      const dw = Math.min(640, IW - 40), dxp = IW / 2 - dw / 2, dyp = hbY - 116;
      this.panel(g, dxp, dyp, dw, 104, 0.9);
      this.text(t('guide_name'), dxp + 20, dyp + 22, 14, '#9bd35a', 'left', true);
      this.text(hike.dialog.lines[hike.dialog.i] ?? '', dxp + 20, dyp + 54, 15, '#f4ecd8');
      this.texts[this.used - 1].setWordWrapWidth(dw - 40, true).setOrigin(0, 0.5);
      this.text(`${t('dialog_next')} (${hike.dialog.i + 1}/${hike.dialog.lines.length})`, dxp + dw - 20, dyp + 88, 12, '#cfc3a6', 'right');
    } else if (!hike.finished) {
      const tg = hike.findTarget();
      const py = touch.enabled ? IH - 290 : hbY - 52, key = touch.enabled ? '👆' : '[E]';
      if (tg) { const w = 40 + tg.label.length * 9; this.panel(g, IW / 2 - w / 2, py, w, 38, 0.88); this.text(`${key} ${tg.label}`, IW / 2, py + 19, 16, '#ffe9a8', 'center', true); }
    }
    if (!touch.enabled) this.text(t('controls'), 16, IH - 18, 12, 'rgba(244,236,216,0.75)');
    if (h.zeroTimer > 0) g.fillStyle(0xa01414, 0.15 + 0.1 * Math.sin(this.time.now / 160)).fillRect(0, 0, IW, IH);
    if (hike.flash > 0) this.top.fillStyle(0xffffff, hike.flash).fillRect(0, 0, IW, IH);

    if (hike.summary) this.drawSummary(IW, IH, hike);
    else if (hike.rescued) this.drawRescue(IW, IH, hike.rescued);
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  private drawSummary(IW: number, IH: number, hike: HikeScene): void {
    const s = hike.summary!, g = this.top;
    g.fillStyle(0x0a140e, 0.6).fillRect(0, 0, IW, IH);
    const pw = Math.min(600, IW - 32), ph = 420, px = IW / 2 - pw / 2, py = Math.max(8, IH / 2 - ph / 2);
    this.panel(g, px, py, pw, ph, 0.94);
    this.text('🏅 ' + t('sum_title'), IW / 2, py + 38, 26, '#ffe9a8', 'center', true, 4);
    const narrow = pw < 520, scx = narrow ? IW / 2 : px + 130, scy = narrow ? py + 120 : py + 200, sr = narrow ? 52 : 86;
    g.lineStyle(4, 0xc0392b, 1).strokeCircle(scx, scy, sr); g.lineStyle(2, 0xc0392b, 1).strokeCircle(scx, scy, sr - 12);
    g.fillStyle(0xc0392b, 1).fillTriangle(scx - sr * 0.45, scy + sr * 0.15, scx - sr * 0.1, scy - sr * 0.28, scx + sr * 0.2, scy + sr * 0.15);
    g.fillTriangle(scx - sr * 0.05, scy + sr * 0.15, scx + sr * 0.22, scy - sr * 0.18, scx + sr * 0.48, scy + sr * 0.15);
    this.text(t(hike.trail.stampKeys[0]), scx, scy - sr * 0.48, narrow ? 12 : 15, '#c0392b', 'center', true, 4);
    this.text(t(hike.trail.stampKeys[1]), scx, scy + sr * 0.38, narrow ? 11 : 14, '#c0392b', 'center', true, 4);
    this.text(s.date, scx, scy + sr * 0.62, 11, '#c0392b', 'center', false, 4);
    const rows: [string, string][] = [
      [t('sum_time'), s.time], [t('sum_dist'), s.km + ' km'], [t('sum_photos'), String(s.photos)], [t('sum_litter'), String(s.litter)],
      [t('sum_secret'), s.secret ? t('found') : t('notFound')], [t('sum_exp'), '+' + s.exp], [t('sum_coins'), '+' + s.coins + ' 🪙'],
    ];
    const rx = narrow ? px + 24 : px + 260, ry0 = narrow ? py + 190 : py + 96;
    rows.forEach(([k, v], i) => { this.text(k, rx, ry0 + i * 30, 15, '#e8dcc0', 'left', false, 4); this.text(v, px + pw - 28, ry0 + i * 30, 15, i >= 5 ? '#9bd35a' : '#f4ecd8', 'right', true, 4); });
    this.text(t('port_restart'), IW / 2, py + ph - 22, 13.5, '#ffe9a8', 'center', false, 4);
  }

  private drawRescue(IW: number, IH: number, reason: 'starve' | 'cold'): void {
    const g = this.top;
    g.fillStyle(0x0a140e, 0.7).fillRect(0, 0, IW, IH);
    const pw = Math.min(560, IW - 32), ph = 210, px = IW / 2 - pw / 2, py = IH / 2 - ph / 2;
    this.panel(g, px, py, pw, ph, 0.94);
    this.text('🚑 ' + t('rescue_title'), IW / 2, py + 40, 20, '#ffb38a', 'center', true, 4);
    this.text(t(reason === 'cold' ? 'rescue_cold' : 'rescue_body'), px + 28, py + 100, 15, '#f4ecd8', 'left', false, 4);
    this.texts[this.used - 1].setWordWrapWidth(pw - 56, true);
    this.text(t('port_restart'), IW / 2, py + ph - 24, 13.5, '#ffe9a8', 'center', false, 4);
  }
}
