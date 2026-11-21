import Phaser from 'phaser';
import { touch, touchClaims } from '../input/touch';
import { audio } from '../audio/audio';
import { t } from '../i18n';
import { nameTag } from './nameTag';
import { HOST_AT, type VisitScene } from './VisitScene';
import { C, FONT, keyCap, notch, paper, PIXEL_FONT, rule, scrim, splitIcon, tag, toastNote, TX, wood } from '../ui/theme';

interface Hit { x: number; y: number; w: number; h: number; i: number }

/** Full-resolution overlay while visiting a friend's camp: host sign, name tags, prompt, toasts and the guestbook. */
export class VisitHudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private rowHits: Hit[] = [];
  private panel: Hit | null = null;

  constructor() { super('visitHud'); }

  create(): void {
    this.g = this.add.graphics();
    this.texts = [];
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const v = this.scene.get('visit') as VisitScene;
      if (!v.menu) return;
      const inside = (h: Hit) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h;
      const r = this.rowHits.find(inside);
      if (!r) { if (!(this.panel && inside(this.panel))) v.menu = null; return; }
      if (v.menu.sel === r.i) v.confirmMenu(); else { v.menu.sel = r.i; audio.sfx('blip'); }
    });
  }

  private text(s: string, x: number, y: number, size = 14, color = TX.cream, align: 'left' | 'center' | 'right' = 'left', bold = false, font = FONT): Phaser.GameObjects.Text {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }).setDepth(2); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setAlpha(1).setCrop().setText(s).setFontFamily(font === PIXEL_FONT && size < 16 ? FONT : font).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal').setWordWrapWidth(0).setShadow(0, 0, '', 0);
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }
  private signText(s: string, x: number, y: number, size: number, color: string = TX.cream, align: 'left' | 'center' | 'right' = 'left'): Phaser.GameObjects.Text {
    return this.text(s, x, y, size, color, align, true).setShadow(0, 2, TX.woodShadow, 0, false, true);
  }

  update(): void {
    const v = this.scene.get('visit') as VisitScene;
    if (!v?.scene.isActive()) return;
    const IW = this.scale.width, IH = this.scale.height, g = this.g, narrow = IW < 700, card = v.card;
    g.clear(); this.used = 0; this.rowHits = []; this.panel = null;
    g.fillStyle(0xffaa5a, 0.08).fillRect(0, 0, IW, IH);
    const cam = v.cameras.main, toScreen = (x: number, y: number) => [(x - cam.worldView.x) * cam.zoom, (y - cam.worldView.y) * cam.zoom];

    if (!v.menu && card) {
      // name tags: the host (gold) and you
      const [hx, hy] = toScreen(HOST_AT.x, HOST_AT.y - 30);
      const ht = this.text(`🏕️ ${card.name} · ${t('title_' + card.title)}`, hx, hy, 12, TX.gold, 'center');
      tag(g, hx - ht.width / 2 - 8, hy - 10, ht.width + 16, 20, 0.8);
      const [mx, my] = toScreen(v.pos.x, v.pos.y - 30), mt = this.text(nameTag(v.profileForTag()), mx, my, 12, TX.sky, 'center');
      const pt = touch.enabled ? v.findTarget() : null, pw2 = pt ? pt.label.length * 9 + 60 : 0;
      if (pt && Math.abs(my - (IH - 290 + 18)) < 34 && Math.abs(mx - IW / 2) < (mt.width + pw2) / 2 + 8) mt.setVisible(false);
      else tag(g, mx - mt.width / 2 - 8, my - 10, mt.width + 16, 20, 0.8);
    }

    // ---- sign: whose camp this is ----
    if (!v.menu) {
      const w = narrow ? IW - 28 : 360;
      wood(g, 14, 14, w, 64);
      this.signText(card ? t('visit_title', { n: card.name }) : t('visit_loading'), 30, 34, 16).setCrop(0, 0, w - 90, 30);
      if (card) {
        this.text(`Lv.${card.level}`, 14 + w - 16, 34, 15, TX.gold, 'right', true, PIXEL_FONT);
        this.text(v.signed ? t('visit_signed') : t('visit_hint'), 30, 58, 12, TX.creamDim).setCrop(0, 0, w - 40, 30);
      }
      // toasts
      v.toasts.forEach((tt, i) => {
        const y = (narrow ? 90 : 84) + i * 44, tw = Math.min(IW - 28, 480), a = Math.min(1, tt.t), [icon, rest] = splitIcon(tt.text);
        const n = toastNote(g, IW / 2 - tw / 2, y, tw, 38, !!icon, a);
        if (icon) { this.text(icon, n.iconX, y + 19, 14, '#ffffff', 'center').setAlpha(a); this.text(rest, n.tx, y + 19, 14, TX.ink, 'left', true).setAlpha(a).setCrop(0, 0, IW / 2 + tw / 2 - n.tx - 10, 30); }
        else this.text(rest, IW / 2, y + 19, 14, TX.ink, 'center', true).setAlpha(a);
      });
      // prompt
      const tg = v.status === 'live' ? v.findTarget() : null, py = touch.enabled ? IH - 290 : IH - 96;
      if (tg) {
        const lt = this.text(tg.label, 0, py + 18, 15, TX.cream, 'left', true);
        const keyW = touch.enabled ? 0 : 34, tw = lt.width + 28, total = keyW + (keyW ? 8 : 0) + tw, x0 = Math.round(IW / 2 - total / 2);
        if (keyW) { keyCap(g, x0, py + 2, keyW, 32); this.text('E', x0 + keyW / 2, py + 18, 17, TX.woodShadow, 'center', true, PIXEL_FONT); }
        tag(g, x0 + total - tw, py + 2, tw, 32, 0.88);
        lt.setPosition(Math.round(x0 + total - tw + 14), py + 18);
      }
      if (!touch.enabled) {
        const ct = this.text(t('visit_controls'), IW / 2, IH - 15, 11.5, TX.creamDim, 'center');
        if (ct.width + 16 > IW - 16) ct.setVisible(false); else tag(g, IW / 2 - ct.width / 2 - 8, IH - 27, ct.width + 16, 24, 0.75);
      }
    }

    if (v.menu) this.drawMenu(v, IW, IH);
    if (v.status === 'loading') {
      scrim(g, IW, IH, 0.45);
      const w = Math.min(360, IW - 28);
      wood(g, IW / 2 - w / 2, IH / 2 - 32, w, 64);
      this.signText(t('visit_loading'), IW / 2, IH / 2, 16, TX.cream, 'center');
    }
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  /** The guestbook: optional watering, then one row per sticker. */
  private drawMenu(v: VisitScene, IW: number, IH: number): void {
    const m = v.menu!, g = this.g, rows = v.menuRows();
    const headH = 56, rh = 44, pw = Math.min(560, IW - 24), reserve = touch.enabled ? 236 : 0, chrome = headH + 16 + 44;
    const maxRows = Math.max(3, Math.floor((IH - 24 - reserve - chrome) / rh)), shown = Math.min(rows.length, maxRows);
    const first = Math.max(0, Math.min(m.sel - Math.floor(shown / 2), rows.length - shown));
    const ph = chrome + shown * rh, px = Math.round(IW / 2 - pw / 2), py = touch.enabled ? 12 : Math.max(12, Math.round(IH / 2 - ph / 2));
    scrim(g, IW, IH, 0.5);
    paper(g, px, py + headH - 8, pw, ph - headH + 8);
    wood(g, px, py, pw, headH);
    this.panel = { x: px, y: py, w: pw, h: ph, i: -1 };
    this.signText(t('visit_book_title', { n: v.card?.name ?? '' }), px + 20, py + headH / 2, 17).setCrop(0, 0, pw - 40, 30);
    const top = py + headH + 10 + rh / 2;
    for (let k = 0; k < shown; k++) {
      const i = first + k, r = rows[i], y = top + k * rh, sel = m.sel === i;
      this.rowHits.push({ x: px + 12, y: y - rh / 2 + 2, w: pw - 24, h: rh - 4, i });
      if (sel) { notch(g, px + 14, y - rh / 2 + 2, pw - 28, rh - 4, 3, C.gold); g.fillStyle(C.paperLight, 1).fillRect(px + 17, y - rh / 2 + 5, pw - 34, rh - 10); }
      else if (k < shown - 1) rule(g, px + 24, y + rh / 2 - 1, pw - 48);
      const a = r.enabled ? 1 : 0.5;
      this.text(r.icon, px + 36, y, 18, '#ffffff', 'center').setAlpha(a);
      if (r.sub) { this.text(r.label, px + 60, y - 8, 14, TX.ink, 'left', sel).setAlpha(a); this.text(r.sub, px + 60, y + 11, 11, TX.inkSoft).setAlpha(a).setCrop(0, 0, pw - 140, 30); }
      else this.text(r.label, px + 60, y, 14.5, TX.ink, 'left', sel).setAlpha(a);
      this.text(r.right, px + pw - 26, y, 14, TX.green, 'right', true).setAlpha(a);
    }
    if (first > 0) this.text('▲', px + pw / 2, top - rh / 2 - 2, 12, TX.inkFaint, 'center');
    if (first + shown < rows.length) this.text('▼', px + pw / 2, top + (shown - 0.5) * rh + 4, 12, TX.inkFaint, 'center');
    this.text(t('visit_book_hint'), IW / 2, py + ph - 20, 12, TX.inkFaint, 'center');
  }
}
