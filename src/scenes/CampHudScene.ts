import Phaser from 'phaser';
import { touch, touchClaims } from '../input/touch';
import { audio } from '../audio/audio';
import { levelInfo, storeQty } from '../core/camp';
import { SEASON_DAYS, seasonOf } from '../core/season';
import { COOKED, ITEMS } from '../data/items';
import { CROPS, QUEST_POOL } from '../data/camp';
import { t } from '../i18n';
import { JOURNAL_TABS, type CampScene } from './CampScene';
import { RANKS, rankIndex, skillPoints } from '../core/progress';
import { PHOTO_EXP } from '../data/photos';
import { nameTag } from './nameTag';
import { npcView } from '../core/story';
import { NPCS } from '../data/story';
import { eventBanner } from './storyText';
import { drawJournalBook, medal } from '../ui/journalBook';
import { splitIcon, toastNote } from '../ui/theme';
import { badge, bar, C, FONT, greenButton, keyCap, notch, paper, PIXEL_FONT, posts, rule, scrim, tag, TX, wood, woodButton } from '../ui/theme';

interface Hit { x: number; y: number; w: number; h: number; i: number }
/** Desktop action bar: each button presses the camp's own key, so mouse and keyboard do the same thing. */
const ACTIONS = [
  { id: 'hike', icon: '🥾', key: 'T', code: 'KeyT' },
  { id: 'seed', icon: '🌱', key: 'Q', code: 'KeyQ' },
  { id: 'build', icon: '🔨', key: 'B', code: 'KeyB' },
  { id: 'skills', icon: '⭐', key: 'K', code: 'KeyK' },
  { id: 'journal', icon: '📖', key: 'J', code: 'KeyJ' },
  { id: 'hub', icon: '🏞️', key: 'H', code: 'KeyH' },
  { id: 'online', icon: '☁️', key: 'O', code: 'KeyO' },
] as const;

/** Full-resolution camp overlay: player card, day sign, quest board, storage, prompts, decorate banner and the menus. */
export class CampHudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private used = 0;
  private rowHits: Hit[] = [];
  private tabHits: (Hit & { tab: (typeof JOURNAL_TABS)[number] })[] = [];
  private actHits: (Hit & { code: string })[] = [];
  /** Clicks inside the open book that miss an entry do nothing (instead of closing it). */
  private book: Hit | null = null;
  private bookClose: Hit | null = null;

  constructor() { super('campHud'); }

  create(): void {
    this.g = this.add.graphics();
    this.texts = [];
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const camp = this.scene.get('camp') as CampScene;
      const inside = (h: Hit) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h;
      if (camp.dialog) { camp.dialogNext(); return; }
      if (!camp.menu) {
        const a = this.actHits.find(inside);
        if (a) window.dispatchEvent(new KeyboardEvent('keydown', { code: a.code }));
        return;
      }
      const tb = this.tabHits.find(inside);
      if (tb) { camp.menu.tab = tb.tab; camp.menu.sel = 0; audio.sfx('blip'); return; }
      const r = this.rowHits.find(inside);
      if (!r) { if (this.book && inside(this.book) && !(this.bookClose && inside(this.bookClose))) return; camp.menu = null; return; }
      if (camp.menu.sel === r.i) camp.confirmMenu(); else camp.menu.sel = r.i;
    });
  }

  private text(s: string, x: number, y: number, size = 14, color = TX.cream, align: 'left' | 'center' | 'right' = 'left', bold = false, font = FONT): Phaser.GameObjects.Text {
    let tx = this.texts[this.used];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }).setDepth(2); this.texts.push(tx); }
    this.used++;
    tx.setVisible(true).setAlpha(1).setCrop().setText(s).setFontFamily(font === PIXEL_FONT && size < 16 ? FONT : font).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal').setWordWrapWidth(0).setShadow(0, 0, '', 0);
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }
  private signText(s: string, x: number, y: number, size: number, color: string = TX.cream, align: 'left' | 'center' | 'right' = 'left', font = FONT): Phaser.GameObjects.Text {
    return this.text(s, x, y, size, color, align, true, font).setShadow(0, 2, TX.woodShadow, 0, false, true);
  }

  update(): void {
    const camp = this.scene.get('camp') as CampScene;
    if (!camp?.profile) return;
    const p = camp.profile, IW = this.scale.width, IH = this.scale.height, g = this.g, narrow = IW < 700;
    g.clear(); this.used = 0; this.rowHits = []; this.tabHits = []; this.actHits = []; this.book = null; this.bookClose = null;
    g.fillStyle(0xffaa5a, 0.08).fillRect(0, 0, IW, IH); // warm evening camp tone
    const desktopBar = !touch.enabled && !narrow;

    if (!camp.menu) {
      // ---- player card: level box, name, rank, EXP, coins ----
      const L = levelInfo(p.exp), cw = narrow ? IW - 28 : 340;
      wood(g, 14, 14, cw, 92);
      keyCap(g, 24, 24, 64, 72);
      this.text(t('ui_level'), 56, 40, 10.5, TX.woodShadow, 'center', true);
      this.text(String(L.level), 56, 66, 28, TX.woodShadow, 'center', true, PIXEL_FONT);
      this.signText((p.name ?? '').trim() || t('on_hiker'), 100, 34, 15).setCrop(0, 0, cw - 210, 30);
      this.text(t('rank_' + RANKS[rankIndex(p)][0]), 14 + cw - 14, 34, 12, TX.creamDim, 'right');
      bar(g, 100, 52, cw - 100, 16, L.into / L.need, C.gold, C.woodDark);
      this.text(`EXP ${L.into} / ${L.need}`, 100, 84, 12.5, TX.cream, 'left', false, PIXEL_FONT);
      this.text(`🪙 ${p.coins}`, 14 + cw - 14, 84, 14, TX.gold, 'right', true, PIXEL_FONT);

      // ---- day and season sign ----
      const day = p.day || 1, left = SEASON_DAYS - ((day - 1) % SEASON_DAYS), ev = eventBanner(day);
      const dayStr = `${t('season_' + seasonOf(day))} · ${t('day', { n: day })}`;
      let below = 114;
      if (narrow) {
        wood(g, 14, below, cw, 40);
        this.signText(dayStr, 28, below + 20, 14);
        this.text(t('ui_season_left', { n: left }), 14 + cw - 14, below + 20, 11.5, TX.creamDim, 'right');
        below += 48;
        if (ev) { tag(g, 14, below - 4, cw, 26, 0.9); this.text(ev, 14 + cw / 2, below + 9, 12.5, TX.gold, 'center', true).setCrop(0, 0, cw - 12, 24); below += 30; }
      } else {
        const dt = this.signText(dayStr, IW / 2, 34, 17, TX.cream, 'center');
        const st = this.text(t('ui_season_left', { n: left }), IW / 2, 56, 11.5, TX.creamDim, 'center');
        const dw = Math.max(dt.width, st.width) + 48;
        wood(g, IW / 2 - dw / 2, 14, dw, 58);
        if (ev) { const et = this.text(ev, IW / 2, 90, 13.5, TX.gold, 'center', true); tag(g, IW / 2 - et.width / 2 - 12, 76, et.width + 24, 28, 0.9); }
      }

      // ---- quest board: wood header hanging a paper note ----
      const qw = narrow ? cw : 290, qx = narrow ? 14 : IW - qw - 14, qy = narrow ? below : 14, list = camp.quests;
      wood(g, qx, qy, qw, 36);
      this.signText(t('menu_quests'), qx + qw / 2, qy + 18, 14.5, TX.cream, 'center');
      posts(g, qx + 40, qx + qw - 40, qy + 34, 10);
      // phones: compact rows (no bars, no footer) so the board doesn't cover the camp
      const qr = narrow ? 24 : 44, qh = narrow ? 14 + list.length * qr : 22 + list.length * qr + 22;
      paper(g, qx, qy + 42, qw, qh);
      list.forEach((q, i) => {
        const d = QUEST_POOL.find((x) => x.id === q.id)!, y = qy + 42 + (narrow ? 7 : 18) + i * qr;
        this.text(t('q_' + d.id), qx + 16, y + 6, 13, q.done ? TX.green : TX.ink, 'left', q.done).setCrop(0, 0, qw - 80, 30);
        this.text(`${q.progress}/${d.count}`, qx + qw - 16, y + 6, 13, q.done ? TX.green : TX.ink, 'right', true, PIXEL_FONT);
        if (!narrow) bar(g, qx + 16, y + 20, qw - 32, 10, q.progress / d.count, q.done ? C.green : 0xc9822e, C.paperLine);
      });
      if (!narrow) this.text(t('ui_quest_new'), qx + 16, qy + 42 + qh - 18, 11, TX.inkFaint);

      // ---- camp storage: selected seed + produce and cooked food ----
      const crop = camp.selectedCrop();
      const seedLine = crop ? t('seed_sel', { s: t('item_' + CROPS[crop].produce), n: storeQty(p, CROPS[crop].seed) }) : t('seed_none');
      const produce = ['kaprao', 'chili', 'strawberry', ...COOKED].filter((id) => storeQty(p, id) > 0).map((id) => `${ITEMS[id].icon}${storeQty(p, id)}`).join('  ');
      if (desktopBar) {
        const sl = this.text(seedLine, 28, IH - 112, 12.5, TX.cream), pl = this.text(produce || '—', 28, IH - 88, 13, TX.cream);
        const sw = Math.max(sl.width, pl.width, 120) + 28;
        wood(g, 14, IH - 152, sw, 84);
        this.text(t('ui_store'), 28, IH - 136, 11.5, TX.creamDim);
      } else {
        const sy = narrow ? qy + 42 + qh + 8 : 114;
        wood(g, 14, sy, cw, 36);
        this.text(seedLine + (produce ? '   ' + produce : ''), 28, sy + 18, 12, TX.cream).setCrop(0, 0, cw - 28, 30);
      }
    }

    // ---- toasts: paper notes ----
    const toastY = narrow ? 250 : 84 + (eventBanner(p.day || 1) && !camp.menu ? 34 : 0);
    camp.toasts.forEach((tt, i) => {
      const y = toastY + i * 44, w = Math.min(IW - 28, 480), a = Math.min(1, tt.t), [icon, rest] = splitIcon(tt.text);
      const n = toastNote(g, IW / 2 - w / 2, y, w, 38, !!icon, a);
      if (icon) { this.text(icon, n.iconX, y + 19, 14, '#ffffff', 'center').setAlpha(a); this.text(rest, n.tx, y + 19, 14, TX.ink, 'left', true).setAlpha(a).setCrop(0, 0, IW / 2 + w / 2 - n.tx - 10, 30); }
      else this.text(rest, IW / 2, y + 19, 14, TX.ink, 'center', true).setAlpha(a);
    });

    // ---- desktop action bar ----
    const barH = 80, barY = IH - 34 - barH;
    if (desktopBar && !camp.menu) {
      const bw = 78, gap = 8, w = ACTIONS.length * (bw + gap) - gap + 20, x0 = Math.round(IW / 2 - w / 2), pts = skillPoints(p);
      wood(g, x0, barY, w, barH);
      ACTIONS.forEach((a, i) => {
        const x = x0 + 10 + i * (bw + gap), y = barY + 9, on = a.id === 'build' && !!camp.build;
        if (a.id === 'hike' && !on) greenButton(g, x, y, bw, barH - 18); else woodButton(g, x, y, bw, barH - 18, false, on);
        this.text(a.icon, x + bw / 2, y + 20, 20, '#ffffff', 'center');
        this.text(`${t('ui_' + a.id)} ${a.key}`, x + bw / 2, y + 46, 11.5, on ? TX.woodShadow : TX.cream, 'center', true);
        if (a.id === 'skills' && pts > 0) { badge(g, x + bw - 14, y - 6, 20); this.text(String(pts), x + bw - 4, y + 4, 12, TX.cream, 'center', true, PIXEL_FONT); }
        this.actHits.push({ x, y, w: bw, h: barH - 18, i, code: a.code });
      });
      // system buttons: sound, music, back to the title screen
      const prefs = p as typeof p & { sound?: boolean; music?: boolean };
      const sys = [{ code: 'KeyM', icon: prefs.sound === false ? '🔇' : '🔊' }, { code: 'KeyN', icon: prefs.music === false ? '🚫' : '🎵' }, { code: 'Escape', icon: '🏠' }];
      if (x0 + w + sys.length * 52 + 24 < IW) sys.forEach((b, i) => {
        const x = IW - 14 - (sys.length - i) * 52 + 4, y = IH - 62;
        woodButton(g, x, y, 46, 46);
        this.text(b.icon, x + 23, y + 23, 18, TX.cream, 'center', true);
        this.actHits.push({ x, y, w: 46, h: 46, i: 99 + i, code: b.code });
      });
    }

    // ---- decorate banner or interaction prompt ----
    if (camp.build) {
      const id = camp.buildItem(), s = id ? `${ITEMS[id].icon} ` + t('build_banner', { s: t('item_' + id), n: storeQty(p, id) }) : t('build_none');
      const bw = Math.min(420, IW - 24), by = touch.enabled ? IH - 300 : desktopBar ? barY - 72 : IH - 104;
      paper(g, IW / 2 - bw / 2, by, bw, 62);
      this.text(s, IW / 2, by + 20, 15, TX.ink, 'center', true);
      if (!touch.enabled) this.text(t('build_hint'), IW / 2, by + 42, 12, TX.inkSoft, 'center');
    } else if (camp.dialog) {
      const d = camp.dialog, n = NPCS.find((x) => x.id === d.npc)!, dw = Math.min(660, IW - 28), dh = 128;
      const dyp = touch.enabled ? IH - 300 - dh + 40 : desktopBar ? barY - dh - 14 : IH - dh - 30, dxp = IW / 2 - dw / 2;
      paper(g, dxp, dyp, dw, dh);
      this.text(`${n.icon} ${t('npc_' + n.id)}`, dxp + 20, dyp + 22, 15, TX.green, 'left', true);
      this.text(t('npc_' + n.id + '_role'), dxp + dw - 20, dyp + 22, 11.5, TX.inkFaint, 'right');
      this.text(d.lines[d.i] ?? '', dxp + 20, dyp + 44, 15, TX.ink).setOrigin(0, 0).setWordWrapWidth(dw - 40, true);
      this.text(`${t('story_next')}  (${d.i + 1}/${d.lines.length})`, dxp + dw - 20, dyp + dh - 16, 12, TX.inkFaint, 'right');
    } else if (!camp.menu) {
      const tg = camp.findTarget();
      const py = touch.enabled ? IH - 290 : desktopBar ? barY - 50 : IH - 96;
      if (tg) {
        const lt = this.text(tg.label, 0, py + 18, 15, TX.cream, 'left', true);
        const keyW = touch.enabled ? 0 : 34, tw = lt.width + 28, total = keyW + (keyW ? 8 : 0) + tw, x0 = Math.round(IW / 2 - total / 2);
        if (keyW) { keyCap(g, x0, py + 2, keyW, 32); this.text('E', x0 + keyW / 2, py + 18, 17, TX.woodShadow, 'center', true, PIXEL_FONT); }
        tag(g, x0 + total - tw, py + 2, tw, 32, 0.88);
        lt.setPosition(Math.round(x0 + total - tw + 14), py + 18);
      }
    }
    if (!touch.enabled && !camp.menu) {
      const ct = this.text(t('port_camp_controls'), IW / 2, IH - 15, 11.5, TX.creamDim, 'center');
      if (ct.width + 16 > IW - 16) ct.setVisible(false); else tag(g, IW / 2 - ct.width / 2 - 8, IH - 27, ct.width + 16, 24, 0.75);
    }

    // skill point badge (touch / small screens; the desktop bar shows it on the Skills button)
    const pts = skillPoints(p);
    if (pts > 0 && !camp.menu && !desktopBar) {
      const s = t('skill_badge', { n: pts }), st = this.text(s, 0, IH - 55, 13, TX.gold, 'left', true), w = st.width + 24;
      wood(g, 14, IH - 74, w, 38); st.setPosition(26, IH - 55);
    }

    // story markers over the NPCs
    if (!camp.menu && !camp.dialog) {
      const cam = camp.cameras.main;
      for (const n of NPCS) {
        const v = npcView(p, n.id), mark = v.status === 'new' ? '!' : v.status === 'ready' ? '💬' : '';
        if (!mark) continue;
        const mx = (n.x * 16 + 8 - cam.worldView.x) * cam.zoom, my = (n.y * 16 - 22 - cam.worldView.y) * cam.zoom + Math.sin(this.time.now / 250) * 3;
        badge(g, mx - 11, my - 11, 22);
        this.text(mark, mx, my, mark === '!' ? 15 : 12, TX.woodShadow, 'center', true, PIXEL_FONT);
      }
    }

    // name and title above the player
    if (!camp.menu && !camp.dialog) {
      const cam = camp.cameras.main, sx = (camp.pos.x - cam.worldView.x) * cam.zoom, sy = (camp.pos.y - 30 - cam.worldView.y) * cam.zoom;
      const nt = this.text(nameTag(p), sx, sy, 12, TX.gold, 'center');
      const pt = touch.enabled && !camp.build ? camp.findTarget() : null, pw2 = pt ? pt.label.length * 9 + 60 : 0;
      if (pt && Math.abs(sy - (IH - 290 + 18)) < 34 && Math.abs(sx - IW / 2) < (nt.width + pw2) / 2 + 8) nt.setVisible(false);
      else tag(g, sx - nt.width / 2 - 8, sy - 10, nt.width + 16, 20, 0.8);
    }

    if (camp.menu) this.drawMenu(camp, IW, IH);
    if (camp.flash > 0) g.fillStyle(0x0a0e1e, camp.flash).fillRect(0, 0, IW, IH);
    for (let i = this.used; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  /** Menus are a wood header over a paper page; the journal is an open book. */
  private drawMenu(camp: CampScene, IW: number, IH: number): void {
    const m = camp.menu!, g = this.g, p = camp.profile;
    if (m.type === 'journal') { this.drawBook(camp, IW, IH); return; }
    const rows = camp.menuRows(), title = 'menu_' + m.type;
    const hint = ({ quests: 'menu_hint_q', trails: 'trails_hint', shop: 'menu_hint', cook: 'menu_hint', skills: 'skill_hint' } as Record<string, string>)[m.type];
    const headH = 56, tabsH = 0, rh = 48, pw = Math.min(700, IW - 24);
    const reserve = touch.enabled ? 236 : 0; // keep the touch buttons clear of the rows
    const chrome = headH + 16 + tabsH + 44;
    const maxRows = Math.max(3, Math.floor((IH - 24 - reserve - chrome) / rh)), shown = Math.min(rows.length, maxRows);
    const first = Math.max(0, Math.min(m.sel - Math.floor(shown / 2), rows.length - shown));
    const ph = chrome + shown * rh, px = Math.round(IW / 2 - pw / 2), py = touch.enabled ? 12 : Math.max(12, Math.round(IH / 2 - ph / 2));
    scrim(g, IW, IH, 0.5);
    paper(g, px, py + headH - 8, pw, ph - headH + 8);
    wood(g, px, py, pw, headH);
    this.signText(t(title), px + 20, py + headH / 2, 19);
    if (m.type === 'shop') this.signText(`🪙 ${p.coins}`, px + pw - 20, py + headH / 2, 16, TX.gold, 'right', PIXEL_FONT);
    if (m.type === 'skills') this.signText(t('skill_points', { n: skillPoints(p) }), px + pw - 20, py + headH / 2, 15, TX.gold, 'right');
    const top = py + headH + 10 + tabsH + rh / 2;
    for (let k = 0; k < shown; k++) {
      const i = first + k, r = rows[i], y = top + k * rh, sel = m.sel === i && m.type !== 'quests';
      this.rowHits.push({ x: px + 12, y: y - rh / 2 + 2, w: pw - 24, h: rh - 4, i });
      if (sel) { notch(g, px + 14, y - rh / 2 + 2, pw - 28, rh - 4, 3, C.gold); g.fillStyle(C.paperLight, 1).fillRect(px + 17, y - rh / 2 + 5, pw - 34, rh - 10); }
      else if (k < shown - 1) rule(g, px + 24, y + rh / 2 - 1, pw - 48);
      const a = r.enabled ? 1 : 0.5;
      if (r.medal) medal(this.g, px + 36, y, r.medal.color, r.medal.ring, r.medal.got);
      this.text(r.icon, px + 36, y, r.medal ? 14 : 20, '#ffffff', 'center').setAlpha(r.medal && !r.medal.got ? 0.35 : a);
      this.text(r.label, px + 60, y - 9, 14.5, TX.ink, 'left', sel).setAlpha(a);
      this.text(r.sub, px + 60, y + 11, 11.5, TX.inkSoft).setAlpha(a);
      this.text(r.right, px + pw - 26, y, 12.5, TX.green, 'right', true).setAlpha(a);
    }
    if (first > 0) this.text('▲', px + pw / 2, top - rh / 2 - 2, 12, TX.inkFaint, 'center');
    if (first + shown < rows.length) this.text('▼', px + pw / 2, top + (shown - 0.5) * rh + 4, 12, TX.inkFaint, 'center');
    this.text(t(hint), IW / 2, py + ph - 20, 12, TX.inkFaint, 'center');
  }

  /** Journal as an open book (shared with the hike). */
  private drawBook(camp: CampScene, IW: number, IH: number): void {
    const m = camp.menu!, p = camp.profile, tab = m.tab ?? 'album';
    const hits = drawJournalBook({ g: this.g, text: (s, x, y, size, color, align, bold) => this.text(s, x, y, size, color, align, bold) }, {
      tab, sel: m.sel, rows: camp.menuRows(), hint: tab === 'titles' ? 'titles_hint' : 'journal_hint', reserveBottom: touch.enabled ? 236 : 0,
      corner: tab === 'album' ? t('album_count', { n: ((p as any).album ?? []).length, m: Object.keys(PHOTO_EXP).length }) : undefined,
    }, IW, IH);
    hits.rows.forEach((r) => this.rowHits.push(r));
    hits.tabs.forEach((r, i) => this.tabHits.push({ ...r, i }));
    this.book = { ...hits.area, i: -1 }; this.bookClose = { ...hits.close, i: -1 };
  }

}
