import Phaser from 'phaser';
import { touch, touchClaims } from '../input/touch';
import { audio } from '../audio/audio';
import { EMOTES } from '../core/coop';
import { PARTY_MAX } from '../core/hub';
import { trailById } from '../data/trails';
import { t } from '../i18n';
import { nameTag } from './nameTag';
import { EMOTE_ICON, type HubScene } from './HubScene';
import { C, FONT, keyCap, notch, paper, PIXEL_FONT, rule, scrim, splitIcon, tag, toastNote, TX, wood, woodButton } from '../ui/theme';

interface Hit { x: number; y: number; w: number; h: number; i: number }
/** Desktop action bar: each button presses the hub's own key. */
const ACTIONS = [
  { id: 'party', icon: '🎒', key: 'P', code: 'KeyP' },
  { id: 'info', icon: '🗺️', key: 'I', code: 'KeyI' },
  ...EMOTES.map((e, i) => ({ id: 'emote_' + e, icon: EMOTE_ICON[e], key: String(i + 1), code: 'Digit' + (i + 1) })),
  { id: 'camp', icon: '🏕️', key: 'Esc', code: 'Escape' },
];

/** Full-resolution hub overlay: plaza sign, party chip, name tags and emotes, prompts, toasts and the party / park info panels. */
export class HubHudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private rowHits: Hit[] = [];
  private actHits: (Hit & { code: string })[] = [];
  private panel: Hit | null = null;

  constructor() { super('hubHud'); }

  create(): void {
    this.g = this.add.graphics();
    this.texts = [];
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const hub = this.scene.get('hub') as HubScene;
      const inside = (h: Hit) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h;
      const a = this.actHits.find(inside);
      if (a) { window.dispatchEvent(new KeyboardEvent('keydown', { code: a.code })); return; }
      if (!hub.menu) return;
      const r = this.rowHits.find(inside);
      if (!r) { if (!(this.panel && inside(this.panel))) hub.menu = null; return; }
      if (hub.menu.sel === r.i) hub.confirmMenu(); else { hub.menu.sel = r.i; audio.sfx('blip'); }
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
    const hub = this.scene.get('hub') as HubScene;
    if (!hub?.profile) return;
    const IW = this.scale.width, IH = this.scale.height, g = this.g, narrow = IW < 700, h = hub.hub;
    g.clear(); this.used = 0; this.rowHits = []; this.actHits = []; this.panel = null;
    const desktopBar = !touch.enabled && !narrow;
    const cam = hub.cameras.main, toScreen = (x: number, y: number) => [(x - cam.worldView.x) * cam.zoom, (y - cam.worldView.y) * cam.zoom];

    // ---- name tags and emote bubbles ----
    if (!hub.menu) {
      const bubble = (icon: string, sx: number, sy: number) => { notch(g, sx - 16, sy - 42, 32, 28, 3, C.paperEdge); g.fillStyle(C.paperLight, 1).fillRect(sx - 13, sy - 39, 26, 22); this.text(icon, sx, sy - 28, 16, '#ffffff', 'center'); };
      if (h) for (const o of h.others.values()) {
        const [sx, sy] = toScreen(o.x, o.y - 30);
        if (sx < -80 || sy < -40 || sx > IW + 80 || sy > IH + 40) continue;
        const inParty = !!h.party?.members.some((m) => m.id === o.id);
        const nt = this.text((inParty ? '🎒 ' : '') + o.name + ' · ' + t('title_' + o.title), sx, sy, 12, inParty ? TX.gold : TX.sky, 'center');
        tag(g, sx - nt.width / 2 - 8, sy - 10, nt.width + 16, 20, 0.75);
        if (o.emote) bubble(EMOTE_ICON[o.emote], sx, sy);
      }
      const [mx, my] = toScreen(hub.pos.x, hub.pos.y - 30);
      const nt = this.text(nameTag(hub.profile), mx, my, 12, TX.gold, 'center');
      // on touch the prompt sits over the player: hide our own tag when they would overlap
      const pt = touch.enabled && hub.status === 'live' ? hub.findTarget() : null, pw2 = pt ? pt.label.length * 9 + 60 : 0;
      if (pt && Math.abs(my - (IH - 290 + 18)) < 34 && Math.abs(mx - IW / 2) < (nt.width + pw2) / 2 + 8) nt.setVisible(false);
      else tag(g, mx - nt.width / 2 - 8, my - 10, nt.width + 16, 20, 0.8);
      if (hub.myEmote) bubble(EMOTE_ICON[hub.myEmote.e], mx, my);
    }

    // ---- plaza sign: name, who is here, your party ----
    if (!hub.menu) {
      const w = narrow ? IW - 28 : 330;
      wood(g, 14, 14, w, 64);
      this.signText(t('hub_title'), 30, 34, 16);
      const online = h ? h.others.size + 1 : 0;
      this.text(hub.status === 'live' ? t('hub_online', { n: online }) : t('hub_connecting'), 30, 58, 12, TX.creamDim);
      if (h?.party) {
        const tr = trailById(h.party.trail), s = `🎒 ${t('party_chip', { c: h.party.code, n: h.party.members.length, m: PARTY_MAX })} · ${tr ? t(tr.trailKey) : ''}`;
        const pt = this.text(s, 0, 104, 12.5, TX.cream, 'left', true), pw = Math.min(pt.width + 28, IW - 28);
        wood(g, 14, 86, pw, 36); pt.setPosition(28, 104).setCrop(0, 0, pw - 28, 30);
      }
    }

    // ---- toasts (hidden while a panel is open: the panel would cover the notes but not their text) ----
    if (!hub.menu) hub.toasts.forEach((tt, i) => {
      const y = (narrow ? 132 : 84) + i * 44, w = Math.min(IW - 28, 480), a = Math.min(1, tt.t), [icon, rest] = splitIcon(tt.text);
      const n = toastNote(g, IW / 2 - w / 2, y, w, 38, !!icon, a);
      if (icon) { this.text(icon, n.iconX, y + 19, 14, '#ffffff', 'center').setAlpha(a); this.text(rest, n.tx, y + 19, 14, TX.ink, 'left', true).setAlpha(a).setCrop(0, 0, IW / 2 + w / 2 - n.tx - 10, 30); }
      else this.text(rest, IW / 2, y + 19, 14, TX.ink, 'center', true).setAlpha(a);
    });

    // ---- desktop action bar ----
    const barH = 72, barY = IH - 34 - barH;
    if (desktopBar && !hub.menu) {
      const bw = 64, gap = 6, w = ACTIONS.length * (bw + gap) - gap + 20, x0 = Math.round(IW / 2 - w / 2);
      wood(g, x0, barY, w, barH);
      ACTIONS.forEach((a, i) => {
        const x = x0 + 10 + i * (bw + gap), y = barY + 9;
        woodButton(g, x, y, bw, barH - 18, hub.status !== 'live' && a.id !== 'camp');
        this.text(a.icon, x + bw / 2, y + 18, 18, '#ffffff', 'center');
        this.text(a.key, x + bw / 2, y + 41, 11.5, TX.cream, 'center', true);
        this.actHits.push({ x, y, w: bw, h: barH - 18, i, code: a.code });
      });
    }

    // ---- prompt ----
    if (!hub.menu && hub.status === 'live') {
      const tg = hub.findTarget(), py = touch.enabled ? IH - 290 : desktopBar ? barY - 50 : IH - 96;
      if (tg) {
        const lt = this.text(tg.label, 0, py + 18, 15, TX.cream, 'left', true);
        const keyW = touch.enabled ? 0 : 34, tw = lt.width + 28, total = keyW + (keyW ? 8 : 0) + tw, x0 = Math.round(IW / 2 - total / 2);
        if (keyW) { keyCap(g, x0, py + 2, keyW, 32); this.text('E', x0 + keyW / 2, py + 18, 17, TX.woodShadow, 'center', true, PIXEL_FONT); }
        tag(g, x0 + total - tw, py + 2, tw, 32, 0.88);
        lt.setPosition(Math.round(x0 + total - tw + 14), py + 18);
      }
    }
    if (!touch.enabled && !hub.menu) {
      const ct = this.text(t('hub_controls'), IW / 2, IH - 15, 11.5, TX.creamDim, 'center');
      if (ct.width + 16 > IW - 16) ct.setVisible(false); else tag(g, IW / 2 - ct.width / 2 - 8, IH - 27, ct.width + 16, 24, 0.75);
    }

    if (hub.menu) this.drawMenu(hub, IW, IH);
    if (hub.status === 'connecting') {
      scrim(g, IW, IH, 0.45);
      const w = Math.min(360, IW - 28);
      wood(g, IW / 2 - w / 2, IH / 2 - 32, w, 64);
      this.signText(t('hub_connecting'), IW / 2, IH / 2, 16, TX.cream, 'center');
    }
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  /** Party panel or park info: a wood header over a paper page (same as the camp menus). */
  private drawMenu(hub: HubScene, IW: number, IH: number): void {
    const m = hub.menu!, g = this.g, rows = hub.menuRows(), party = hub.hub?.party;
    const headH = 56, rh = 48, pw = Math.min(640, IW - 24), reserve = touch.enabled ? 236 : 0, chrome = headH + 16 + 44;
    const maxRows = Math.max(3, Math.floor((IH - 24 - reserve - chrome) / rh)), shown = Math.min(rows.length, maxRows);
    const first = Math.max(0, Math.min(m.sel - Math.floor(shown / 2), rows.length - shown));
    const ph = chrome + shown * rh, px = Math.round(IW / 2 - pw / 2), py = touch.enabled ? 12 : Math.max(12, Math.round(IH / 2 - ph / 2));
    scrim(g, IW, IH, 0.5);
    paper(g, px, py + headH - 8, pw, ph - headH + 8);
    wood(g, px, py, pw, headH);
    this.panel = { x: px, y: py, w: pw, h: ph, i: -1 };
    this.signText(t(m.type === 'info' ? 'hub_info_title' : party ? 'party_title' : 'party_board_title'), px + 20, py + headH / 2, 18);
    if (m.type === 'party' && party) this.signText(t('party_code', { c: party.code }), px + pw - 20, py + headH / 2, 15, TX.gold, 'right');
    const top = py + headH + 10 + rh / 2;
    for (let k = 0; k < shown; k++) {
      const i = first + k, r = rows[i], y = top + k * rh, sel = m.sel === i;
      this.rowHits.push({ x: px + 12, y: y - rh / 2 + 2, w: pw - 24, h: rh - 4, i });
      if (sel) { notch(g, px + 14, y - rh / 2 + 2, pw - 28, rh - 4, 3, C.gold); g.fillStyle(C.paperLight, 1).fillRect(px + 17, y - rh / 2 + 5, pw - 34, rh - 10); }
      else if (k < shown - 1) rule(g, px + 24, y + rh / 2 - 1, pw - 48);
      const a = r.enabled || r.icon === '👑' || r.icon === '🥾' ? 1 : 0.5;
      this.text(r.icon, px + 36, y, 20, '#ffffff', 'center').setAlpha(a);
      this.text(r.label, px + 60, y - 9, 14.5, TX.ink, 'left', sel).setAlpha(a).setCrop(0, 0, pw - 200, 30);
      this.text(r.sub, px + 60, y + 11, 11.5, TX.inkSoft).setAlpha(a).setCrop(0, 0, pw - 200, 30);
      this.text(r.right, px + pw - 26, y, 12.5, TX.green, 'right', true).setAlpha(a);
    }
    if (first > 0) this.text('▲', px + pw / 2, top - rh / 2 - 2, 12, TX.inkFaint, 'center');
    if (first + shown < rows.length) this.text('▼', px + pw / 2, top + (shown - 0.5) * rh + 4, 12, TX.inkFaint, 'center');
    this.text(t(m.type === 'info' ? 'hub_info_hint' : 'party_hint'), IW / 2, py + ph - 20, 12, TX.inkFaint, 'center');
  }
}
