import Phaser from 'phaser';
import { touch, touchClaims } from '../input/touch';
import { audio } from '../audio/audio';
import { levelInfo, storeQty } from '../core/camp';
import { seasonOf } from '../core/season';
import { COOKED, ITEMS } from '../data/items';
import { CROPS, QUEST_POOL } from '../data/camp';
import { t } from '../i18n';
import { JOURNAL_TABS, type CampScene } from './CampScene';
import { skillPoints } from '../core/progress';
import { PHOTO_EXP } from '../data/photos';
import { nameTag } from './nameTag';

const FONT = 'Mitr, "Noto Sans Thai", Tahoma, sans-serif';
interface Hit { x: number; y: number; w: number; h: number; i: number }

/** Full-resolution camp overlay: profile, quests, prompts, decorate banner and the four menus. */
export class CampHudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private rowHits: Hit[] = [];
  private tabHits: (Hit & { tab: (typeof JOURNAL_TABS)[number] })[] = [];

  constructor() { super('campHud'); }

  create(): void {
    this.g = this.add.graphics();
    this.texts = [];
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const camp = this.scene.get('camp') as CampScene;
      if (!camp.menu) return;
      const tb = this.tabHits.find((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
      if (tb) { camp.menu.tab = tb.tab; camp.menu.sel = 0; audio.sfx('blip'); return; }
      const r = this.rowHits.find((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
      if (!r) { camp.menu = null; return; }
      if (camp.menu.sel === r.i) camp.confirmMenu(); else camp.menu.sel = r.i;
    });
  }

  private text(s: string, x: number, y: number, size = 14, color = '#f4ecd8', align: 'left' | 'center' | 'right' = 'left', bold = false): Phaser.GameObjects.Text {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }).setDepth(2); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setAlpha(1).setText(s).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal').setWordWrapWidth(0);
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }
  private panel(x: number, y: number, w: number, h: number, a = 0.78): void {
    this.g.fillStyle(0x121c16, a).fillRoundedRect(x, y, w, h, 10);
    this.g.lineStyle(1.5, 0xe8d9a8, 0.35).strokeRoundedRect(x, y, w, h, 10);
  }

  update(): void {
    const camp = this.scene.get('camp') as CampScene;
    if (!camp?.profile) return;
    const p = camp.profile, IW = this.scale.width, IH = this.scale.height, g = this.g, narrow = IW < 700;
    g.clear(); this.used = 0; this.rowHits = []; this.tabHits = [];
    g.fillStyle(0xffaa5a, 0.08).fillRect(0, 0, IW, IH); // warm evening camp tone

    // profile panel + quest tracker (hidden behind an open menu, whose panel would sit under their text)
    const L = levelInfo(p.exp);
    if (!camp.menu) {
    this.panel(14, 14, 270, 112);
    this.text(`Lv.${L.level}`, 28, 34, 18, '#ffe9a8', 'left', true);
    g.fillStyle(0x000000, 0.45).fillRoundedRect(80, 28, 150, 12, 6);
    g.fillStyle(0x9bd35a, 1).fillRoundedRect(80, 28, Math.max(6, (150 * L.into) / L.need), 12, 6);
    this.text(`${L.into}/${L.need}`, 238, 34, 11, '#cfc3a6');
    this.text(`🪙 ${p.coins}    📅 ${t('day', { n: p.day })} · ${t('season_' + seasonOf(p.day))}`, 28, 60, 13.5);
    const crop = camp.selectedCrop();
    this.text(crop ? t('seed_sel', { s: t('item_' + CROPS[crop].produce), n: storeQty(p, CROPS[crop].seed) }) : t('seed_none'), 28, 84, 12.5, '#cfe3b8');
    const produce = ['kaprao', 'chili', 'strawberry', ...COOKED].filter((id) => storeQty(p, id) > 0).map((id) => `${ITEMS[id].icon}${storeQty(p, id)}`).join('  ');
    this.text(produce || '—', 28, 106, 12.5);

    // quest tracker
    const qw = 260, qx = narrow ? 14 : IW - qw - 14, qy = narrow ? 134 : 14, list = camp.quests;
    this.panel(qx, qy, qw, 34 + list.length * 24);
    this.text(t('menu_quests'), qx + 14, qy + 16, 13.5, '#ffe9a8', 'left', true);
    list.forEach((q, i) => {
      const d = QUEST_POOL.find((x) => x.id === q.id)!;
      this.text(`${q.done ? '✅' : '▫️'} ${t('q_' + d.id)}  ${q.progress}/${d.count}`, qx + 14, qy + 40 + i * 24, 12.5, q.done ? '#9bd35a' : '#f4ecd8');
    });
    }

    // toasts
    camp.toasts.forEach((tt, i) => {
      const y = (narrow ? 250 : 64) + i * 40, w = Math.min(IW - 28, 480);
      this.panel(IW / 2 - w / 2, y, w, 32, 0.85 * Math.min(1, tt.t));
      this.text(tt.text, IW / 2, y + 16, 14, '#fff6dc', 'center');
    });

    // decorate banner or interaction prompt
    if (camp.build) {
      const id = camp.buildItem(), s = id ? `${ITEMS[id].icon} ` + t('build_banner', { s: t('item_' + id), n: storeQty(p, id) }) : t('build_none');
      const bw = Math.min(400, IW - 24), by = touch.enabled ? IH - 300 : IH - 104;
      this.panel(IW / 2 - bw / 2, by, bw, 58, 0.9);
      this.text(s, IW / 2, by + 18, 15, '#ffe9a8', 'center', true);
      if (!touch.enabled) this.text(t('build_hint'), IW / 2, by + 41, 12.5, '#cfc3a6', 'center');
    } else if (!camp.menu) {
      const tg = camp.findTarget();
      const py = touch.enabled ? IH - 290 : IH - 96, key = touch.enabled ? '👆' : '[E]';
      if (tg) { const w = 40 + tg.label.length * 9; this.panel(IW / 2 - w / 2, py, w, 38, 0.88); this.text(`${key} ${tg.label}`, IW / 2, py + 19, 16, '#ffe9a8', 'center', true); }
    }
    if (!touch.enabled) this.text(t('port_camp_controls'), 16, IH - 18, 12, 'rgba(244,236,216,0.75)');

    // skill point badge
    const pts = skillPoints(p);
    if (pts > 0 && !camp.menu) {
      const s = t('skill_badge', { n: pts }), w = 24 + s.length * 8;
      this.panel(14, IH - 70, w, 30, 0.85);
      this.text(s, 14 + w / 2, IH - 55, 13, '#f2c94c', 'center', true);
    }

    // name and title above the player
    if (!camp.menu) {
      const cam = camp.cameras.main, sx = (camp.pos.x - cam.worldView.x) * cam.zoom, sy = (camp.pos.y - 30 - cam.worldView.y) * cam.zoom;
      const tag = nameTag(p), tw = 16 + tag.length * 7.2;
      g.fillStyle(0x121c16, 0.6).fillRoundedRect(sx - tw / 2, sy - 10, tw, 20, 8);
      this.text(tag, sx, sy, 12, '#ffe9a8', 'center');
    }

    if (camp.menu) this.drawMenu(camp, IW, IH);
    if (camp.flash > 0) g.fillStyle(0x0a0e1e, camp.flash).fillRect(0, 0, IW, IH);
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  private drawMenu(camp: CampScene, IW: number, IH: number): void {
    const m = camp.menu!, rows = camp.menuRows(), g = this.g, p = camp.profile;
    const tab = m.tab ?? 'album';
    const title = m.type === 'journal' ? 'menu_journal_' + tab : 'menu_' + m.type;
    const hint = ({ quests: 'menu_hint_q', trails: 'trails_hint', shop: 'menu_hint', cook: 'menu_hint', skills: 'skill_hint',
      journal: tab === 'titles' ? 'titles_hint' : 'journal_hint' } as Record<string, string>)[m.type];
    const tabsH = m.type === 'journal' ? 30 : 0, rh = 46, pw = Math.min(680, IW - 32);
    const reserve = touch.enabled ? 236 : 0; // keep the touch buttons clear of the rows
    const maxRows = Math.max(3, Math.floor((IH - 32 - reserve - 96 - tabsH) / rh)), shown = Math.min(rows.length, maxRows);
    const first = Math.max(0, Math.min(m.sel - Math.floor(shown / 2), rows.length - shown));
    const ph = 96 + tabsH + shown * rh, px = IW / 2 - pw / 2, py = touch.enabled ? 12 : Math.max(16, IH / 2 - ph / 2);
    g.fillStyle(0x0a140e, 0.45).fillRect(0, 0, IW, IH);
    this.panel(px, py, pw, ph, 0.94);
    this.text(t(title), px + 20, py + 28, 19, '#ffe9a8', 'left', true);
    if (m.type === 'shop') this.text(`🪙 ${p.coins}`, px + pw - 20, py + 28, 16, '#f2c94c', 'right', true);
    if (m.type === 'skills') this.text(t('skill_points', { n: skillPoints(p) }), px + pw - 20, py + 28, 15, '#f2c94c', 'right', true);
    if (m.type === 'journal' && tab === 'album') {
      this.text(t('album_count', { n: ((p as any).album ?? []).length, m: Object.keys(PHOTO_EXP).length }), px + pw - 20, py + 28, 14, '#cfe3b8', 'right');
    }
    if (m.type === 'journal') {
      const tw = (pw - 40) / JOURNAL_TABS.length;
      JOURNAL_TABS.forEach((id, i) => {
        const x = px + 20 + i * tw, on = id === tab;
        g.fillStyle(on ? 0xffe9a8 : 0xffffff, on ? 0.2 : 0.05).fillRoundedRect(x + 2, py + 48, tw - 4, 24, 6);
        this.tabHits.push({ x: x + 2, y: py + 44, w: tw - 4, h: 32, i, tab: id });
        this.text(t('menu_journal_' + id).split(' ')[0], x + tw / 2, py + 60, 14, '#ffffff', 'center');
      });
    }
    const top = py + 66 + tabsH;
    for (let k = 0; k < shown; k++) {
      const i = first + k, r = rows[i], y = top + k * rh, sel = m.sel === i && m.type !== 'quests';
      this.rowHits.push({ x: px + 12, y: y - 19, w: pw - 24, h: rh - 4, i });
      if (sel) g.fillStyle(0xffe9a8, 0.12).fillRoundedRect(px + 12, y - 19, pw - 24, rh - 4, 8);
      const a = r.enabled ? 1 : 0.5;
      if (r.medal) this.medal(px + 32, y, r.medal.color, r.medal.ring, r.medal.got);
      this.text(r.icon, px + 32, y, r.medal ? 14 : 20, '#ffffff', 'center').setAlpha(r.medal && !r.medal.got ? 0.35 : a);
      this.text(r.label, px + 54, y - 8, 14.5, sel ? '#ffe9a8' : '#f4ecd8', 'left', sel).setAlpha(a);
      this.text(r.sub, px + 54, y + 10, 11.5, '#cfc3a6').setAlpha(a);
      this.text(r.right, px + pw - 24, y, 12.5, '#cfe3b8', 'right').setAlpha(a);
    }
    if (first > 0) this.text('▲', px + pw / 2, top - 30, 12, '#ffe9a8', 'center');
    if (first + shown < rows.length) this.text('▼', px + pw / 2, top + shown * rh - 22, 12, '#ffe9a8', 'center');
    this.text(t(hint), IW / 2, py + ph - 16, 12.5, '#ffe9a8', 'center');
  }

  /** Round medal: ribbon, colored disc and ring; greyed out until earned. */
  private medal(x: number, y: number, color: number, ring: number, got: boolean): void {
    const g = this.g, a = got ? 1 : 0.3;
    g.fillStyle(0xc0504d, a).fillTriangle(x - 9, y - 18, x - 2, y - 18, x - 6, y - 6);
    g.fillStyle(0x3a6ea5, a).fillTriangle(x + 2, y - 18, x + 9, y - 18, x + 6, y - 6);
    g.fillStyle(got ? ring : 0x555555, 1).fillCircle(x, y + 2, 14);
    g.fillStyle(got ? color : 0x333333, 1).fillCircle(x, y + 2, 11);
  }
}
