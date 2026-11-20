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
import { levelInfo } from '../core/camp';
import { bar, C, FONT, greenButton, keyCap, paper, PIXEL_FONT, pixelIcon, posts, scrim, slot, STAT_ICONS, tag, TX, wood, woodButton } from '../ui/theme';
import { paintHeadThumb } from '../gfx/chibi';
import { lookOf } from '../core/creator';

interface SysHit { x: number; y: number; w: number; h: number; code: string }

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
  private head!: Phaser.GameObjects.Image;
  private sysHits: SysHit[] = [];

  constructor() { super('hud'); }

  create(): void {
    if (!this.textures.exists('light-small')) this.textures.addCanvas('light-small', lightMask(CONFIG.LIGHT_RADIUS * 3));
    if (!this.textures.exists('light-big')) this.textures.addCanvas('light-big', lightMask(CONFIG.LIGHT_RADIUS_FLASHLIGHT * 3));
    this.night = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setOrigin(0).setDepth(0);
    this.g = this.add.graphics().setDepth(1);
    this.mini = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(1.5).setVisible(false);
    this.top = this.add.graphics().setDepth(3);
    // portrait of the player's own look for the status sign
    const hike0 = this.scene.get('hike') as HikeScene;
    if (this.textures.exists('hud-head')) this.textures.remove('hud-head');
    this.textures.addCanvas('hud-head', paintHeadThumb(lookOf(hike0.profile), 48, '#f2e2bc'));
    this.head = this.add.image(0, 0, 'hud-head').setOrigin(0).setDepth(1.5);
    this.scale.on('resize', (s: Phaser.Structs.Size) => this.night.resize(s.width, s.height));
    for (let i = 0; i < 160; i++) this.rain.push({ x: Math.random() * 2000, y: Math.random() * 1200, s: 420 + Math.random() * 240 });
    // click/tap a hotbar slot to use it
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const hb = this.hotbar, hike = this.scene.get('hike') as HikeScene;
      const sh = this.sysHits.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (sh) { window.dispatchEvent(new KeyboardEvent('keydown', { code: sh.code })); return; }
      if (hike.paused || hike.finished || p.y < hb.y || p.y > hb.y + hb.sz || p.x < hb.x0) return;
      const i = Math.floor((p.x - hb.x0) / hb.step);
      if (i < CONFIG.MAX_SLOTS) hike.useSlot(i);
    });
  }

  private text(s: string, x: number, y: number, size = 14, color = TX.cream, align: 'left' | 'center' | 'right' = 'left', bold = false, depth = 2, font = FONT): Phaser.GameObjects.Text {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setAlpha(1).setCrop().setText(s).setFontFamily(font === PIXEL_FONT && size < 16 ? FONT : font).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal').setDepth(depth)
      .setShadow(0, 0, '', 0).setWordWrapWidth(0).setLineSpacing(0);
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }
  /** Cream text with the 2 px dark drop used on wood signs. */
  private signText(s: string, x: number, y: number, size: number, color: string = TX.cream, align: 'left' | 'center' | 'right' = 'left', bold = true, font = FONT): Phaser.GameObjects.Text {
    return this.text(s, x, y, size, color, align, bold, 2, font).setShadow(0, 2, TX.woodShadow, 0, false, true);
  }

  private bar(x: number, y: number, w: number, v: number, color: number, label: string, warn: boolean, icon: keyof typeof STAT_ICONS): void {
    pixelIcon(this.g, STAT_ICONS[icon], x, y - 1, 2, color);
    this.text(label, x + 20, y + 6, 13, TX.ink);
    bar(this.g, x + 52, y, w, 12, v / 100, color);
    this.text(String(Math.ceil(v)), x + 52 + w + 30, y + 6, 13, warn ? TX.red : TX.ink, 'right', true, 2, PIXEL_FONT);
  }

  update(_t: number, deltaMs: number): void {
    const hike = this.scene.get('hike') as HikeScene;
    if (!hike?.hiker || !hike.world) return;
    const IW = this.scale.width, IH = this.scale.height, g = this.g, h = hike.hiker, cam = hike.cameras.main, narrow = IW < 700;
    g.clear(); this.top.clear(); this.used = 0; this.sysHits = [];

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
      const ty = sy - 22 * cam.zoom, nt = this.text(nameTag(hike.profile), sx, ty, 12, TX.gold, 'center');
      const pt = touch.enabled && !hike.dialog ? hike.findTarget() : null, pyT = IH - 290, pw2 = pt ? pt.label.length * 9 + 60 : 0;
      if (pt && Math.abs(ty - (pyT + 18)) < 34 && Math.abs(sx - IW / 2) < (nt.width + pw2) / 2 + 8) nt.setVisible(false);
      else tag(g, sx - nt.width / 2 - 8, ty - 10, nt.width + 16, 20, 0.8);
      // friends in a co-op room
      for (const o of hike.coopTags()) {
        const ox = (o.x - cam.worldView.x) * cam.zoom, oy = (o.y - 10 - cam.worldView.y) * cam.zoom - 22 * cam.zoom;
        if (ox < -60 || oy < -20 || ox > IW + 60 || oy > IH + 20) continue;
        const ft = this.text('🤝 ' + o.name, ox, oy, 12, TX.sky, 'center');
        tag(g, ox - ft.width / 2 - 8, oy - 10, ft.width + 16, 20, 0.8);
      }
    }

    // ---- status sign: name, level, four stats on paper, pack ----
    const p = hike.profile, L = levelInfo(p.exp ?? 0), SW = narrow ? Math.min(290, IW - hike.world.w * 1.6 - 24 - 10 - 14 - 8) : 300, SX = 14, SY = 14, SH = 198;
    wood(g, SX, SY, SW, SH);
    // portrait, name, title chip, level
    g.fillStyle(C.paperEdge, 1).fillRect(SX + 10, SY + 10, 48, 48);
    this.head.setPosition(SX + 12, SY + 12).setDisplaySize(44, 44).setVisible(true);
    this.signText((p.name ?? '').trim() || t('on_hiker'), SX + 68, SY + 22, 15).setCrop(0, 0, SW - 130, 30);
    this.text(`Lv.${L.level}`, SX + SW - 14, SY + 22, 15, TX.gold, 'right', true, 2, PIXEL_FONT);
    const tt0 = this.text(t('title_' + ((p as typeof p & { title?: string }).title ?? 'newbie')), SX + 76, SY + 46, 11, TX.gold, 'left', true).setCrop(0, 0, SW - 98, 30);
    tag(g, SX + 68, SY + 37, Math.min(tt0.width + 16, SW - 82), 18, 1);
    paper(g, SX + 8, SY + 64, SW - 16, 104);
    const low = (v: number) => v < 25 && Math.sin(this.time.now / 125) > 0;
    const bw = SW - 16 - 24 - 52 - 34;
    this.bar(SX + 20, SY + 76, bw, h.stamina, h.exhausted ? C.red : C.stamina, t('stamina'), h.stamina < 25, 'stamina');
    this.bar(SX + 20, SY + 98, bw, h.hunger, low(h.hunger) ? 0xffd27a : C.hunger, t('hunger'), h.hunger < 25, 'hunger');
    this.bar(SX + 20, SY + 120, bw, h.thirst, low(h.thirst) ? 0xa8dcff : C.thirst, t('thirst'), h.thirst < 25, 'thirst');
    this.bar(SX + 20, SY + 142, bw, h.warmth, h.warmth < 30 ? C.cold : C.warmth, t('warmth'), h.warmth < 30, 'warmth');
    const kg = weight(hike.bp), over = kg > CONFIG.MAX_WEIGHT_KG;
    this.text(`🎒 ${kg.toFixed(1)}/${CONFIG.MAX_WEIGHT_KG} kg · ${hike.bp.slots.length}/${CONFIG.MAX_SLOTS} ${t('slots')}`, SX + 14, SY + 181, 12.5, over ? TX.redOnWood : TX.cream).setCrop(0, 0, SW - 70, 30);
    this.text(`📷 ${hike.photos.length}`, SX + SW - 14, SY + 181, 12.5, TX.creamDim, 'right');

    // ---- clock, weather, temperature, minimap ----
    const icon = { clear: '☀️', fog: '🌫️', drizzle: '🌦️' }[hike.weather];
    const mmS = narrow ? 1.6 : 3, mmW = hike.world.w * mmS, mmH = hike.world.h * mmS, mmX = IW - mmW - 24, mmY = 66;
    wood(g, mmX - 10, 14, mmW + 20, 38);
    const temp = `${Math.round(ambientC(hike.env()))}°C`, clock = clockLabel(hike.trail.startHour, hike.elapsed);
    if (narrow) this.signText(`${clock} ${icon} ${temp}`, mmX + mmW / 2, 33, 12, TX.cream, 'center');
    else {
      this.text(`${icon} ${t('w_' + hike.weather)}`, mmX + 2, 33, 12.5, TX.cream);
      this.signText(clock, mmX + mmW / 2 + 10, 32, 18, TX.gold, 'center', true, PIXEL_FONT);
      this.text(temp, mmX + mmW - 2, 33, 12.5, TX.cream, 'right');
    }
    wood(g, mmX - 10, 56, mmW + 20, mmH + 44);
    let seen = 0; for (let i = 0; i < hike.revealed.length; i++) seen += hike.revealed[i];
    this.text(t('ui_explored', { n: Math.round((seen / hike.revealed.length) * 100) }), mmX, mmY + mmH + 18, narrow ? 10.5 : 12, TX.creamDim);
    g.fillStyle(C.woodDeep, 1).fillRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6);
    g.fillStyle(0x0e1612, 1).fillRect(mmX, mmY, mmW, mmH);
    this.mini.setTexture('minimap').setPosition(mmX, mmY).setDisplaySize(mmW, mmH).setVisible(true);
    const dot = (tx: number, ty: number, color: number, r: number) => {
      const cx = Math.round(mmX + tx * mmS + mmS / 2), cy = Math.round(mmY + ty * mmS + mmS / 2);
      this.top.fillStyle(C.woodDeep, 1).fillRect(cx - r - 1, cy - r - 1, 2 * r + 2, 2 * r + 2);
      this.top.fillStyle(color, 1).fillRect(cx - r, cy - r, 2 * r, 2 * r);
    };
    for (const poi of hike.trail.pois) {
      const known = poi.type === 'viewpoint' || poi.type === 'goal' || hike.revealed[poi.y * hike.world.w + poi.x];
      if (known && poi.type !== 'secret') dot(poi.x, poi.y, poi.type === 'viewpoint' ? 0x4fc3f7 : poi.type === 'goal' ? C.gold : C.paper, 2);
    }
    dot(h.x / TS - 0.5, h.y / TS - 0.5, 0xffffff, 3);
    hike.activeEvents.forEach((a, i) => this.text(EV_ICON[a.id] ?? '•', mmX + mmW - 10 - i * 22, mmY + mmH + 18, 14, '#fff', 'center'));

    // ---- trail sign + objective on paper hanging under it ----
    const tr = hike.trail, toCp = !!tr.checkpointId && !hike.checkpoint;
    const target = tr.pois.find((q) => q.id === (toCp ? tr.checkpointId : tr.goalId))!;
    const dx = target.x * TS + 8 - h.x, dy = target.y * TS + 8 - h.y;
    const meters = Math.round((Math.hypot(dx, dy) * tr.realData.distanceKm * 1000) / hike.world.pathLenPx);
    const label = t((toCp ? tr.objKeys.checkpoint : tr.objKeys.goal) ?? '');
    let oy: number, ow: number, ox: number;
    const freeW = mmX - 10 - (SX + SW) - 32;
    if (!narrow && freeW >= 300) {
      const tw = Math.min(460, freeW), tx0 = Math.round((SX + SW + mmX - 10) / 2 - tw / 2);
      wood(g, tx0, 14, tw, 56);
      this.text(t(tr.parkKey), tx0 + 16, 32, 11, TX.creamDim).setCrop(0, 0, tw - 120, 30);
      this.signText(t(tr.trailKey), tx0 + 16, 52, 14.5).setCrop(0, 0, tw - 120, 30);
      this.signText(walkedKm(h, hike.world).toFixed(1), tx0 + tw - 42, 41, 22, TX.gold, 'right', true, PIXEL_FONT);
      this.text('km', tx0 + tw - 14, 43, 12, TX.cream, 'right');
      ow = Math.min(tw - 40, 380); ox = Math.round(tx0 + tw / 2 - ow / 2); oy = 82;
      posts(g, ox + 30, ox + ow - 30, 68, 16);
    } else {
      ow = Math.min(IW - 28, 380); ox = narrow ? 14 : Math.round(IW / 2 - ow / 2); oy = narrow ? SY + SH + 8 : 14;
    }
    paper(g, ox, oy, ow, 40);
    const ang = Math.atan2(dy, dx), ax = ox + 24, ay = oy + 19;
    const pt = (r: number, a: number) => [ax + Math.cos(ang + a) * r, ay + Math.sin(ang + a) * r];
    const [x1, y1] = pt(11, 0), [x2, y2] = pt(9, 2.4), [x3, y3] = pt(9, -2.4);
    g.fillStyle(toCp ? 0x2f8fc4 : C.red, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
    g.lineStyle(1.5, C.paperEdge, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
    this.text(label, ox + 44, oy + 19, 14, TX.ink, 'left', true).setCrop(0, 0, ow - 116, 30);
    this.text(`${meters} m`, ox + ow - 14, oy + 19, 14, TX.inkFaint, 'right', true, 2, PIXEL_FONT);

    // ---- toasts: paper notes ----
    hike.toasts.forEach((tt, i) => {
      const y = oy + 50 + i * 42, w = Math.min(IW - 28, 460), a = Math.min(1, tt.t);
      paper(g, IW / 2 - w / 2, y, w, 36, a);
      this.text(tt.text, IW / 2, y + 17, 14, TX.ink, 'center', true).setAlpha(a);
    });

    // ---- hotbar: 12 backpack slots, keys 1–9 0 - = ----
    const n = CONFIG.MAX_SLOTS, sz = Math.floor(Math.min(50, (IW - 48) / n - 6)), hbW = n * (sz + 6) + 14, hbX = Math.round(IW / 2 - hbW / 2), hbY = IH - sz - (touch.enabled ? 56 : 40);
    this.hotbar = { x0: hbX + 10, y: hbY, sz, step: sz + 6 };
    wood(g, hbX, hbY - 10, hbW, sz + 20);
    const keyLabel = (i: number) => (i < 9 ? String(i + 1) : ['0', '-', '='][i - 9]);
    for (let i = 0; i < n; i++) {
      const x = hbX + 10 + i * (sz + 6), s = hike.bp.slots[i];
      slot(g, x, hbY, sz, false, !s);
      if (s) {
        if (Object.values(hike.bp.wearing).includes(s.itemId)) { g.fillStyle(C.woodDeep, 1).fillRect(x + sz - 13, hbY + sz - 13, 10, 10); g.fillStyle(C.stamina, 1).fillRect(x + sz - 11, hbY + sz - 11, 6, 6); }
        this.text(ITEMS[s.itemId].icon, x + sz / 2, hbY + sz / 2 + 1, sz * 0.48, '#ffffff', 'center').setAlpha(s.itemId === 'water_bottle' && !s.full ? 0.35 : 1);
        const count = s.qty > 1 ? s.qty : s.charges ? s.charges : '';
        if (count) this.text(String(count), x + sz - 5, hbY + sz - 9, 12, TX.cream, 'right', true, 2, PIXEL_FONT).setShadow(0, 1, TX.woodShadow, 0, false, true);
      }
      this.text(keyLabel(i), x + 6, hbY + 10, 11, s ? TX.creamDim : '#a07a50', 'left', false, 2, PIXEL_FONT);
    }

    // ---- dialog or interaction prompt ----
    if (hike.dialog) {
      const dw = Math.min(640, IW - 40), dxp = IW / 2 - dw / 2, dyp = hbY - 128;
      paper(g, dxp, dyp, dw, 110);
      this.text(t('guide_name'), dxp + 20, dyp + 22, 14, TX.green, 'left', true);
      this.text(hike.dialog.lines[hike.dialog.i] ?? '', dxp + 20, dyp + 54, 15, TX.ink).setWordWrapWidth(dw - 40, true).setOrigin(0, 0.5);
      this.text(`${t('dialog_next')} (${hike.dialog.i + 1}/${hike.dialog.lines.length})`, dxp + dw - 20, dyp + 90, 12, TX.inkFaint, 'right');
    } else if (!hike.finished) {
      const tg = hike.findTarget();
      const py = touch.enabled ? IH - 290 : hbY - 56;
      if (tg) {
        const lt = this.text(tg.label, 0, py + 18, 15, TX.cream, 'left', true);
        const keyW = touch.enabled ? 0 : 34, tw = lt.width + 28, total = keyW + (keyW ? 8 : 0) + tw, x0 = Math.round(IW / 2 - total / 2);
        if (keyW) { keyCap(g, x0, py + 2, keyW, 32); this.text('E', x0 + keyW / 2, py + 18, 17, TX.woodShadow, 'center', true, 2, PIXEL_FONT); }
        tag(g, x0 + total - tw, py + 2, tw, 32, 0.88);
        lt.setPosition(Math.round(x0 + total - tw + 14), py + 18);
      }
    }
    if (!touch.enabled) {
      const ct = this.text(t('controls'), 24, IH - 16, 12, TX.creamDim);
      if (ct.width + 20 < hbX - 10) tag(g, 14, IH - 28, ct.width + 20, 24, 0.75);
      else { ct.setPosition(IW / 2, IH - 14).setOrigin(0.5, 0.5).setFontSize(11); tag(g, IW / 2 - ct.width / 2 - 8, IH - 25, ct.width + 16, 22, 0.75); }
    }
    if (h.zeroTimer > 0) g.fillStyle(0xa01414, 0.15 + 0.1 * Math.sin(this.time.now / 160)).fillRect(0, 0, IW, IH);
    if (hike.flash > 0) this.top.fillStyle(0xffffff, hike.flash).fillRect(0, 0, IW, IH);

    // desktop system buttons (touch screens have their own): sound, music, pause
    if (!touch.enabled && !hike.finished && hbX + hbW + 3 * 52 + 24 < IW) {
      const prefs = p as typeof p & { sound?: boolean; music?: boolean };
      const btns = [{ code: 'KeyM', icon: prefs.sound === false ? '🔇' : '🔊' }, { code: 'KeyN', icon: prefs.music === false ? '🚫' : '🎵' }, { code: 'KeyP', icon: hike.paused ? '▶' : '⏸' }];
      btns.forEach((b, i) => {
        const x = IW - 14 - (btns.length - i) * 52 + 4, y = IH - 62;
        woodButton(g, x, y, 46, 46, false, b.code === 'KeyP' && hike.paused);
        this.text(b.icon, x + 23, y + 23, 18, TX.cream, 'center', true);
        this.sysHits.push({ x, y, w: 46, h: 46, code: b.code });
      });
    }
    if (hike.paused) this.drawPause(IW, IH);
    if (hike.summary) this.drawSummary(IW, IH, hike);
    else if (hike.rescued) this.drawRescue(IW, IH, hike.rescued);
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  private drawSummary(IW: number, IH: number, hike: HikeScene): void {
    const s = hike.summary!, g = this.top;
    scrim(g, IW, IH, 0.6);
    const pw = Math.min(600, IW - 32), ph = 430, px = IW / 2 - pw / 2, py = Math.max(8, IH / 2 - ph / 2);
    wood(g, px, py, pw, 60);
    paper(g, px, py + 52, pw, ph - 52);
    this.signText('🏅 ' + t('sum_title'), IW / 2, py + 30, 24, TX.cream, 'center').setDepth(4);
    const narrow = pw < 520, scx = narrow ? IW / 2 : px + 130, scy = narrow ? py + 126 : py + 216, sr = narrow ? 52 : 86;
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
    const rx = narrow ? px + 24 : px + 260, ry0 = narrow ? py + 196 : py + 100;
    rows.forEach(([k, v], i) => {
      this.text(k, rx, ry0 + i * 30, 15, TX.inkSoft, 'left', false, 4);
      this.text(v, px + pw - 28, ry0 + i * 30, 15, i >= 5 ? TX.green : TX.ink, 'right', true, 4);
      if (i < rows.length - 1) g.fillStyle(C.paperLine, 1).fillRect(Math.round(rx), Math.round(ry0 + i * 30 + 15), Math.round(px + pw - 28 - rx), 1);
    });
    const bw = Math.min(260, pw - 48), by = py + ph - 58;
    greenButton(g, IW / 2 - bw / 2, by, bw, 44);
    this.signText(t('port_restart'), IW / 2, by + 20, 15, '#ffffff', 'center').setDepth(4).setShadow(0, 2, '#24461a', 0, false, true);
  }

  private drawPause(IW: number, IH: number): void {
    const g = this.top, pw = Math.min(420, IW - 32), ph = 190, px = IW / 2 - pw / 2, py = IH / 2 - ph / 2;
    scrim(g, IW, IH, 0.55);
    wood(g, px, py, pw, 56);
    paper(g, px, py + 48, pw, ph - 48);
    this.signText('⏸ ' + t('ui_paused'), IW / 2, py + 28, 20, TX.cream, 'center').setDepth(4);
    this.text(t('ui_paused_sub'), IW / 2, py + 84, 13, TX.inkSoft, 'center', false, 4).setWordWrapWidth(pw - 40, true);
    const bw = Math.min(240, pw - 48), by = py + ph - 62;
    greenButton(g, IW / 2 - bw / 2, by, bw, 46);
    this.signText(t('ui_resume'), IW / 2, by + 21, 16, '#ffffff', 'center').setDepth(4).setShadow(0, 2, '#24461a', 0, false, true);
    this.sysHits.push({ x: IW / 2 - bw / 2, y: by, w: bw, h: 46, code: 'KeyP' });
  }

  private drawRescue(IW: number, IH: number, reason: 'starve' | 'cold'): void {
    const g = this.top;
    scrim(g, IW, IH, 0.7);
    const pw = Math.min(560, IW - 32), ph = 230, px = IW / 2 - pw / 2, py = IH / 2 - ph / 2;
    wood(g, px, py, pw, 56);
    paper(g, px, py + 48, pw, ph - 48);
    this.signText('🚑 ' + t('rescue_title'), IW / 2, py + 28, 19, TX.cream, 'center').setDepth(4);
    this.text(t(reason === 'cold' ? 'rescue_cold' : 'rescue_body'), px + 28, py + 112, 15, TX.ink, 'left', false, 4).setWordWrapWidth(pw - 56, true);
    this.text(t('port_restart'), IW / 2, py + ph - 26, 13.5, TX.green, 'center', true, 4);
  }
}
