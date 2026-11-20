/**
 * The journal drawn as an open book: bookmark tabs on top, paper pages inside a leather cover.
 * Wide screens get two pages; phones get one page with icon-only tabs and room left for the touch buttons.
 * Album, passport and medals are cards in a grid; achievements, titles and stats are ruled lines.
 * Used by the camp menu and by the journal opened on a hike.
 */
import type Phaser from 'phaser';
import { t } from '../i18n';
import { JOURNAL_TABS, type JournalTab, type MenuRow } from '../scenes/journalRows';
import { C, notch, rule, scrim, TX, woodButton } from './theme';

type Align = 'left' | 'center' | 'right';
export interface BookCtx {
  g: Phaser.GameObjects.Graphics;
  text: (s: string, x: number, y: number, size: number, color: string, align: Align, bold: boolean) => Phaser.GameObjects.Text;
}
export interface Rect { x: number; y: number; w: number; h: number }
export interface BookHits { rows: (Rect & { i: number })[]; tabs: (Rect & { tab: JournalTab })[]; area: Rect; close: Rect }
export interface BookView { tab: JournalTab; sel: number; rows: MenuRow[]; corner?: string; hint: string; reserveBottom: number }

/** Round medal: ribbon, colored disc and ring; greyed out until earned. */
export function medal(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, ring: number, got: boolean): void {
  const a = got ? 1 : 0.3;
  g.fillStyle(0xc0504d, a).fillTriangle(x - 9, y - 18, x - 2, y - 18, x - 6, y - 6);
  g.fillStyle(0x3a6ea5, a).fillTriangle(x + 2, y - 18, x + 9, y - 18, x + 6, y - 6);
  g.fillStyle(got ? ring : 0x8a7050, 1).fillCircle(x, y + 2, 14);
  g.fillStyle(got ? color : 0xc9b48c, 1).fillCircle(x, y + 2, 11);
}

/** Clips a text to max px wide, keeping its alignment (centered text loses both ends, not just the right). */
const fit = (tx: Phaser.GameObjects.Text, max: number): Phaser.GameObjects.Text => (tx.width > max ? tx.setCrop(tx.originX * (tx.width - max), 0, max, tx.height + 4) : tx);

export function drawJournalBook(ctx: BookCtx, v: BookView, IW: number, IH: number): BookHits {
  const { g, text } = ctx, rows = v.rows, tab = v.tab, two = IW >= 760;
  const grid = tab === 'album' || tab === 'passport' || tab === 'medals';
  const BW = two ? Math.min(1120, IW - 40) : IW - 16;
  const BH = Math.max(260, Math.min(600, IH - (two ? 96 : 64) - v.reserveBottom));
  const bx = Math.round(IW / 2 - BW / 2), by = two ? Math.max(56, Math.round((IH - v.reserveBottom) / 2 - BH / 2 + 20)) : 52;
  scrim(g, IW, IH, 0.55);
  const hits: BookHits = { rows: [], tabs: [], area: { x: bx, y: by - 44, w: BW, h: BH + 44 }, close: { x: 0, y: 0, w: 0, h: 0 } };

  // bookmark tabs (icons only on phones) + close
  const closeW = 40, tw = Math.min(172, (BW - closeW - 32 - (JOURNAL_TABS.length - 1) * 4) / JOURNAL_TABS.length), ty = by - 40;
  JOURNAL_TABS.forEach((id, i) => {
    const x = bx + (two ? 24 : 4) + i * (tw + 4), on = id === tab, label = t('menu_journal_' + id);
    if (on) { notch(g, x, ty - 4, tw, 48, 3, C.paperEdge); g.fillStyle(C.paper, 1).fillRect(x + 3, ty - 1, tw - 6, 45); }
    else woodButton(g, x, ty, tw, 40);
    fit(text(two ? label : label.split(' ')[0], x + tw / 2, ty + (on ? 16 : 20), two ? 13 : 16, on ? TX.ink : TX.cream, 'center', true), tw + 40);
    hits.tabs.push({ x, y: ty - 4, w: tw, h: 44, tab: id });
  });
  const cx0 = bx + BW - closeW - (two ? 8 : 4);
  woodButton(g, cx0, ty, closeW, 40);
  text('✕', cx0 + closeW / 2, ty + 20, 16, TX.cream, 'center', true);
  hits.close = { x: cx0, y: ty, w: closeW, h: 40 };

  // cover, page(s), spine
  notch(g, bx, by, BW, BH, 6, C.woodDeep);
  g.fillStyle(0x6b3f1f, 1).fillRect(bx + 6, by + 6, BW - 12, BH - 12);
  const pw = two ? (BW - 40) / 2 : BW - 24, lx = bx + (two ? 16 : 12), rx = bx + BW / 2 + 4, py = by + (two ? 16 : 12), ph = BH - (two ? 32 : 24);
  for (const x of two ? [lx, rx] : [lx]) {
    g.fillStyle(C.paperShade, 1).fillRect(Math.round(x), py, Math.round(pw), ph);
    g.fillStyle(C.paper, 1).fillRect(Math.round(x), py, Math.round(pw), ph - 5);
  }
  if (two) {
    g.fillStyle(C.paperShade, 1).fillRect(Math.round(lx + pw - 12), py, 12, ph - 5).fillRect(Math.round(rx), py, 12, ph - 5);
    g.fillStyle(C.paperEdge, 1).fillRect(Math.round(bx + BW / 2 - 4), by + 10, 8, BH - 20);
  }

  // headers
  const pad = two ? 24 : 14;
  text(t('menu_journal_' + tab), lx + pad, py + 26, two ? 20 : 17, TX.ink, 'left', true);
  if (v.corner) text(v.corner, lx + pw - pad, py + 26, 12.5, TX.inkFaint, 'right', true);
  const bodyTop = py + 52, bodyH = ph - 52 - 30;

  // entries per page, and which spread holds the selection
  const cols = two ? 3 : 2, cardH = two ? 96 : 86, gap = two ? 10 : 8, cardW = (pw - 2 * pad - (cols - 1) * gap) / cols, lineH = two ? 50 : 46;
  const perPage = grid ? cols * Math.max(1, Math.floor((bodyH + gap) / (cardH + gap))) : Math.max(1, Math.floor(bodyH / lineH));
  const pages = two ? 2 : 1, perView = pages * perPage;
  const view = Math.floor(v.sel / perView), first = view * perView, views = Math.max(1, Math.ceil(rows.length / perView));
  const pageLabel = t('ui_book_page', { n: view + 1, m: views });
  if (two) text(pageLabel, rx + pw - pad, py + 26, 13, TX.inkFaint, 'right', true);
  else text(pageLabel, lx + pw - pad, py + ph - 18, 11.5, TX.inkFaint, 'right', true);

  for (let k = 0; k < perView && first + k < rows.length; k++) {
    const i = first + k, r = rows[i], page = k < perPage ? 0 : 1, j = k % perPage, ox = (page ? rx : lx) + pad, sel = v.sel === i, a = r.enabled ? 1 : 0.45;
    if (grid) {
      const cx = ox + (j % cols) * (cardW + gap), cy = bodyTop + Math.floor(j / cols) * (cardH + gap);
      notch(g, cx, cy, cardW, cardH, 3, sel ? C.gold : r.enabled ? C.paperEdge : C.paperLine);
      g.fillStyle(r.enabled ? C.paperLight : C.paperShade, 1).fillRect(Math.round(cx + 3), Math.round(cy + 3), Math.round(cardW - 6), cardH - 6);
      if (r.medal) medal(g, cx + cardW / 2, cy + 26, r.medal.color, r.medal.ring, r.medal.got);
      text(r.icon, cx + cardW / 2, cy + 26, r.medal ? 14 : 22, '#ffffff', 'center', false).setAlpha(r.medal && !r.medal.got ? 0.35 : a);
      fit(text(r.label, cx + cardW / 2, cy + cardH - 36, two ? 12.5 : 11.5, TX.ink, 'center', true).setAlpha(a), cardW - 8);
      fit(text(r.right, cx + cardW / 2, cy + cardH - 16, 11, TX.green, 'center', true).setAlpha(a), cardW - 8);
      hits.rows.push({ x: cx, y: cy, w: cardW, h: cardH, i });
    } else {
      const y = bodyTop + j * lineH + lineH / 2, w = pw - 2 * pad;
      if (sel) { notch(g, ox - 6, y - lineH / 2 + 2, w + 12, lineH - 4, 3, C.gold); g.fillStyle(C.paperLight, 1).fillRect(ox - 3, y - lineH / 2 + 5, w + 6, lineH - 10); }
      else rule(g, ox, y + lineH / 2 - 2, w);
      if (r.medal) medal(g, ox + 14, y, r.medal.color, r.medal.ring, r.medal.got);
      text(r.icon, ox + 14, y, r.medal ? 14 : 20, '#ffffff', 'center', false).setAlpha(a);
      const rt = text(r.right, ox + w, y, 12.5, TX.green, 'right', true).setAlpha(a);
      fit(text(r.label, ox + 36, y - 9, two ? 14 : 13, TX.ink, 'left', sel).setAlpha(a), w - 44 - rt.width);
      fit(text(r.sub, ox + 36, y + 11, 11, TX.inkSoft, 'left', false).setAlpha(a), w - 44 - rt.width);
      hits.rows.push({ x: ox - 6, y: y - lineH / 2 + 2, w: w + 12, h: lineH - 4, i });
    }
  }

  // the selected card's full text (cards only fit a short label)
  if (grid && rows[v.sel]) {
    const r = rows[v.sel];
    fit(text(r.label + (r.sub ? '  ·  ' + r.sub : ''), lx + pad, py + ph - 18, 11.5, TX.inkSoft, 'left', false), (two ? pw * 2 : pw - 70) - 2 * pad);
  }
  if (two || v.reserveBottom === 0) text(t(v.hint), IW / 2, by + BH + 16, 12, TX.creamDim, 'center', false);
  return hits;
}
