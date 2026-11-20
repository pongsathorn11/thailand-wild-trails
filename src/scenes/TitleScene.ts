import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { cloud } from '../net/cloud';
import { onlinePanelOpen, openOnlinePanel } from '../ui/onlinePanel';
import { openAuthPage } from '../ui/authPage';
import { TITLE_SOUND_GAP, touch, touchClaims } from '../input/touch';
import { levelInfo } from '../core/camp';
import { cleanName, LOOK_ROWS, lookOf, lookVariant, NAME_MAX, optionCount, setOption, stepOption, TITLE_ROWS, type TitleRow } from '../core/creator';
import { saveProfile, type Profile } from '../core/profile';
import { RANKS, rankIndex } from '../core/progress';
import { LOOK_OPTIONS, type Body, type LookRow } from '../data/looks';
import { CHIBI, CHIBI_BLINK_FRAME, paintChibiStrip, paintHeadThumb, paintShirtIcon } from '../gfx/chibi';
import { MINI, MINI_SIT_FRAME, miniFrameIndex } from '../gfx/paint';
import { installMiniSheet, installStrip } from '../gfx/sheets';
import { flagStripe, paintTitleBackground, TITLE_SCALE } from '../gfx/titleArt';
import { getLang, setLang, t } from '../i18n';
import { C, FONT, greenButton, notch, paper, PIXEL_FONT, tag, TX, wood, woodButton } from '../ui/theme';

const BODIES: Body[] = ['male', 'female'];
const THUMB = 48;
interface Hit { x: number; y: number; w: number; h: number; fn: () => void }

/** Title screen and character creator. Writes body, looks and name to the profile, then goes to camp. */
export class TitleScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private bg!: Phaser.GameObjects.Image;
  private bgSize = '';
  private texts: Phaser.GameObjects.Text[] = [];
  private imgs: Phaser.GameObjects.Image[] = [];
  private usedT = 0;
  private usedI = 0;
  private hits: Hit[] = [];
  private row = 0;
  /** Where SystemScene puts the touch sound buttons on this screen (beside Start). */
  soundY = 0;
  private sigs: Record<string, string> = {};
  private thumbKeys: string[] = [];
  private nameInput!: HTMLInputElement;
  private onKeyDown!: (e: KeyboardEvent) => void;
  private measure = document.createElement('canvas').getContext('2d')!;

  constructor() { super('title'); }

  get profile(): Profile { return this.registry.get('profile') as Profile; }

  create(): void {
    this.row = 0; this.texts = []; this.imgs = []; this.sigs = {}; this.thumbKeys = []; this.bgSize = '';
    this.bg = this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(0);
    this.g = this.add.graphics().setDepth(1);
    this.input.keyboard?.clearCaptures();

    const inp = this.nameInput = document.createElement('input');
    inp.id = 'char-name'; inp.maxLength = NAME_MAX * 2; inp.autocomplete = 'off'; inp.spellcheck = false;
    Object.assign(inp.style, { position: 'absolute', display: 'none', zIndex: '5', boxSizing: 'border-box', border: '3px solid #5c3a1e', borderRadius: '0',
      background: '#fbf0d4', color: '#3a2414', font: `400 15px ${FONT}`, padding: '0 10px', outline: 'none' });
    inp.addEventListener('focus', () => { inp.style.borderColor = '#f2c14e'; this.row = TITLE_ROWS.indexOf('name'); });
    inp.addEventListener('blur', () => { inp.style.borderColor = '#5c3a1e'; inp.value = this.profile.name; });
    inp.addEventListener('input', () => { this.profile.name = cleanName(inp.value); saveProfile(this.profile); });
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') inp.blur(); });
    inp.value = this.profile.name;
    document.body.appendChild(inp);

    this.onKeyDown = (e: KeyboardEvent) => { if (!e.repeat && document.activeElement !== inp) this.onKey(e.code, e); };
    window.addEventListener('keydown', this.onKeyDown);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchClaims(p)) return;
      const h = this.hits.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (h) h.fn(); else inp.blur();
    });
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.onKeyDown);
      inp.remove();
      for (const k of this.thumbKeys) if (this.textures.exists(k)) this.textures.remove(k);
    });
  }

  // ---------- input ----------
  private onKey(code: string, e?: KeyboardEvent): void {
    if (onlinePanelOpen()) return;
    const n = TITLE_ROWS.length, row = TITLE_ROWS[this.row];
    if (code === 'KeyO') { this.openOnline(); return; }
    if (code === 'KeyL') { this.toggleLang(); return; }
    if (code === 'ArrowUp' || code === 'ArrowDown') audio.sfx('blip');
    if (code === 'ArrowUp' || code === 'KeyW') this.row = (this.row + n - 1) % n;
    if (code === 'ArrowDown' || code === 'KeyS') this.row = (this.row + 1) % n;
    if (code === 'ArrowLeft' || code === 'KeyA') this.change(() => stepOption(this.profile, row, -1));
    if (code === 'ArrowRight' || code === 'KeyD') this.change(() => stepOption(this.profile, row, 1));
    if (code === 'Tab') { e?.preventDefault(); this.change(() => stepOption(this.profile, 'body', 1)); }
    if (code === 'Enter' || code === 'Space') {
      e?.preventDefault();
      if (row === 'name') this.nameInput.focus(); else this.start();
    }
  }
  private change(fn: () => void): void { fn(); saveProfile(this.profile); audio.sfx('blip'); }
  /** Signed out: the Log in / Register page. Signed in: the Online panel (account, leaderboard, co-op). */
  private openOnline(): void {
    this.nameInput.blur(); this.nameInput.style.display = 'none'; audio.sfx('select');
    if (cloud.status !== 'off' && !cloud.signedIn) openAuthPage('login'); else openOnlinePanel();
  }
  private toggleLang(): void { const l = getLang() === 'th' ? 'en' : 'th'; setLang(l); this.profile.lang = l; saveProfile(this.profile); }

  /** Saves, repaints the in-game sprite sheet for the chosen look and enters camp. */
  start(): void {
    const p = this.profile;
    this.nameInput.blur();
    p.name = cleanName(p.name);
    saveProfile(p);
    installMiniSheet(this.textures, 'hiker', lookOf(p));
    audio.sfx('select');
    this.scene.start('camp');
  }

  // ---------- pooled drawing ----------
  private text(s: string, x: number, y: number, size = 14, color = TX.cream, align: 'left' | 'center' | 'right' = 'left', bold = false, font = FONT): Phaser.GameObjects.Text {
    let tx = this.texts[this.usedT];
    if (!tx) { tx = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px' }).setDepth(3); this.texts.push(tx); }
    this.usedT++;
    tx.setVisible(true).setAlpha(1).setCrop().setText(s).setFontFamily(font === PIXEL_FONT && size < 16 ? FONT : font).setFontSize(size).setColor(color).setFontStyle(bold ? 'bold' : 'normal').setLineSpacing(0).setShadow(0, 0, '', 0);
    return tx.setOrigin(align === 'left' ? 0 : align === 'center' ? 0.5 : 1, 0.5).setPosition(Math.round(x), Math.round(y));
  }
  /** Thai has no spaces between words, so wrap by character when a line has no spaces. */
  private wrap(s: string, maxW: number, size: number): string {
    this.measure.font = `400 ${size}px ${FONT}`;
    const tokens = s.includes(' ') ? s.split(/(\s+)/) : Array.from(s), lines: string[] = [];
    let line = '';
    for (const tk of tokens) {
      const test = line + tk;
      if (this.measure.measureText(test).width > maxW && line) { lines.push(line.trim()); line = tk.trimStart(); } else line = test;
    }
    if (line) lines.push(line.trim());
    return lines.join('\n');
  }
  private img(key: string, frame: number | string, x: number, y: number, w: number, h: number, ox = 0, oy = 0, depth = 2): Phaser.GameObjects.Image {
    let im = this.imgs[this.usedI];
    if (!im) { im = this.add.image(0, 0, key); this.imgs.push(im); }
    this.usedI++;
    return im.setTexture(key, frame).setVisible(true).setAlpha(1).setDepth(depth).setOrigin(ox, oy).setPosition(Math.round(x), Math.round(y)).setDisplaySize(w, h);
  }
  private woodPlank(x: number, y: number, w: number, h: number, glow: boolean): void {
    if (glow) notch(this.g, x - 4, y - 4, w + 8, h + 8, 4, C.gold);
    wood(this.g, x, y, w, h);
  }
  private slate(x: number, y: number, w: number, h: number): void { paper(this.g, x, y, w, h); }
  private sign(s: string, x: number, y: number, size: number, color: string = TX.cream, align: 'left' | 'center' | 'right' = 'left', font = FONT): Phaser.GameObjects.Text {
    return this.text(s, x, y, size, color, align, true, font).setShadow(0, size >= 24 ? 3 : 2, TX.woodShadow, 0, false, true);
  }
  private shadow(x: number, y: number, rx: number, ry: number, a: number): void { this.g.fillStyle(0x000000, a).fillEllipse(x, y, rx * 2, ry * 2); }

  // ---------- textures that depend on the profile ----------
  private refreshTextures(): void {
    const p = this.profile;
    for (const b of BODIES) {
      const sig = JSON.stringify(p.looks[b]);
      if (this.sigs[b] === sig) continue;
      this.sigs[b] = sig;
      const look = lookOf(p, b);
      installStrip(this.textures, `chibi-${b}`, paintChibiStrip(look), CHIBI.W);
      installMiniSheet(this.textures, `mini-${b}`, look);
      installStrip(this.textures, `head-${b}`, paintHeadThumb(look, THUMB), THUMB);
    }
    const sig = p.body + JSON.stringify(p.looks[p.body]);
    if (this.sigs.thumbs !== sig) {
      this.sigs.thumbs = sig;
      for (const k of this.thumbKeys) if (this.textures.exists(k)) this.textures.remove(k);
      this.thumbKeys = [];
      for (const row of LOOK_ROWS) for (let j = 0; j < optionCount(row); j++) {
        const key = `thumb-${row}-${j}`;
        let cv: HTMLCanvasElement;
        if (row === 'hair') { cv = document.createElement('canvas'); cv.width = cv.height = THUMB; const c = cv.getContext('2d')!; c.fillStyle = LOOK_OPTIONS.hair[j]; c.fillRect(0, 0, THUMB, THUMB); }
        else if (row === 'outfit') cv = paintShirtIcon(LOOK_OPTIONS.outfit[j], THUMB);
        else cv = paintHeadThumb(lookVariant(p, p.body, row, j), THUMB);
        this.textures.addCanvas(key, cv); this.thumbKeys.push(key);
      }
    }
  }

  // ---------- frame ----------
  update(): void {
    const IW = this.scale.width, IH = this.scale.height, g = this.g, p = this.profile, time = this.time.now / 1000, narrow = IW < 820;
    g.clear(); this.usedT = 0; this.usedI = 0; this.hits = [];
    this.refreshTextures();
    this.drawBackground(IW, IH, time, narrow ? IW - 90 : IW - 380 - 20 - 70);
    const blink = time % 4 < 0.12, walkF = Math.floor(time * 6) % 4, fireF = [0, 1, 2, 1][Math.floor(time * 7) % 4];
    const hit = (x: number, y: number, w: number, h: number, fn: () => void) => this.hits.push({ x, y, w, h, fn });

    // logo, profile line, language chip
    if (narrow) {
      wood(g, 12, 10, IW - 24, 46);
      const a = this.sign('THAILAND ', 26, 33, 18, TX.cream, 'left', PIXEL_FONT);
      this.sign('WILD TRAILS', 26 + a.width, 33, 18, TX.greenOnWood, 'left', PIXEL_FONT);
    } else {
      wood(g, 14, 10, 340, 62);
      const a = this.sign('THAILAND ', 28, 32, 24, TX.cream, 'left', PIXEL_FONT);
      this.sign('WILD TRAILS', 28 + a.width, 32, 24, TX.greenOnWood, 'left', PIXEL_FONT);
      const st = (p as Profile & { stats?: { trailsCompleted?: number } }).stats;
      this.text(t('profile', { lv: levelInfo(p.exp).level, r: t('rank_' + RANKS[rankIndex(p)][0]), c: p.coins, n: st?.trailsCompleted ?? 0 }), 28, 56, 11.5, TX.creamDim).setCrop(0, 0, 312, 30);
    }
    const lw = 78, cwW = 118, lx = narrow ? IW - 14 - lw - 6 : 20 + cwW + 8, ly = narrow ? 18 : IH - 58;
    woodButton(g, lx, ly - 2, lw, 34);
    this.text(getLang() === 'th' ? 'ไทย · EN' : 'TH · Eng', lx + lw / 2, ly + 15, 12.5, TX.cream, 'center', true);
    hit(lx, ly, lw, 30, () => this.toggleLang());
    // online chip: accounts, cloud save, leaderboard
    const cw = narrow ? 36 : cwW, cx = narrow ? lx - cw - 6 : 20, mark = cloud.status === 'synced' ? ' ✓' : cloud.status === 'error' ? ' !' : '';
    woodButton(g, cx, ly - 2, cw, 34, false, cloud.signedIn);
    this.text(narrow ? '☁️' : t('on_title') + mark, cx + cw / 2, ly + 15, 12.5, cloud.signedIn ? TX.woodShadow : TX.cream, 'center', true);
    hit(cx, ly, cw, 30, () => this.openOnline());

    const PW = narrow ? IW - 24 : 380, px = narrow ? 12 : IW - PW - 20;
    const startH = narrow ? 58 : 84, startY = IH - startH - (narrow ? 14 : 22);
    const pickBody = (b: Body) => () => { this.change(() => setOption(p, 'body', b)); this.row = 0; };
    let py: number, ph: number;

    if (narrow) {
      const by = 62, bw = (IW - 36) / 2;
      BODIES.forEach((b, i) => {
        const x = 12 + i * (bw + 12), sel = p.body === b;
        this.woodPlank(x, by, bw, 52, sel);
        this.img(`head-${b}`, 0, x + 8, by + 6, 40, 40);
        this.sign((b === 'male' ? '♂ ' : '♀ ') + t('char_' + b), x + 54, by + 26, 15, sel ? TX.gold : TX.cream);
        hit(x, by, bw, 52, pickBody(b));
      });
      const s = 3, fy = by + 52 + 12 + 58 * s;
      this.shadow(IW / 2, fy, 20 * s, 4 * s, 0.18);
      this.img(`chibi-${p.body}`, blink ? CHIBI_BLINK_FRAME : walkF, IW / 2, fy, CHIBI.W * s, CHIBI.H * s, CHIBI.FX / CHIBI.W, CHIBI.FY / CHIBI.H);
      this.mini(p.body, miniFrameIndex('right', walkF), 56, fy - 4, 2);
      this.img('campfire', fireF, IW - 40, fy + 2, 32, 32, 0.5, 1);
      this.mini(p.body, MINI_SIT_FRAME, IW - 64, fy, 2);
      py = fy + 12; ph = startY - 10 - py;
    } else {
      // left column: starting info and story on paper
      const LW = 340, iy = 86;
      this.slate(14, iy, LW, 128);
      this.text(t('info_title'), 30, iy + 24, 15, TX.ink, 'left', true);
      [['🥾', 'info_aptitude'], ['⭐', 'info_skill'], ['🎒', 'info_items']].forEach(([ic, k], i) => {
        this.text(ic, 36, iy + 54 + i * 24, 15, '#ffffff', 'center');
        this.text(t(k), 54, iy + 54 + i * 24, 12, TX.inkSoft).setCrop(0, 0, LW - 52, 40);
      });
      if (IH >= 600) {
        const sh = 112, sy0 = iy + 128 + 12;
        this.slate(14, sy0, LW, sh);
        this.text(this.wrap(t('story'), LW - 40, 13.5), 32, sy0 + 20, 13.5, TX.ink).setOrigin(0, 0).setLineSpacing(4);
        g.fillStyle(C.paperLine, 1).fillPoints([{ x: 32, y: sy0 + sh - 12 }, { x: 14 + LW * 0.3, y: sy0 + sh - 32 }, { x: 14 + LW * 0.45, y: sy0 + sh - 22 }, { x: 14 + LW * 0.62, y: sy0 + sh - 36 }, { x: 14 + LW - 18, y: sy0 + sh - 12 }], true);
      }

      // center stage: body tabs, one big chibi, small poses, name plate
      const c0 = 14 + LW + 24, c1 = px - 24, mid = Math.round((c0 + c1) / 2), top = 86, feetY = IH - 150;
      BODIES.forEach((b, i) => {
        const bw = 128, x = mid - bw - 6 + i * (bw + 12), on = p.body === b;
        woodButton(g, x, top, bw, 44, false, on);
        this.text((b === 'male' ? '♂ ' : '♀ ') + t('char_' + b), x + bw / 2, top + 22, 15, on ? TX.woodShadow : TX.cream, 'center', true);
        hit(x, top, bw, 44, pickBody(b));
      });
      const s = Math.max(3, Math.min(6, Math.floor((feetY - top - 110) / 58), Math.floor((c1 - c0 - 180) / 40)));
      this.shadow(mid, feetY, 20 * s, 4 * s, 0.2);
      this.img(`chibi-${p.body}`, blink ? CHIBI_BLINK_FRAME : walkF % 2, mid, feetY, CHIBI.W * s, CHIBI.H * s, CHIBI.FX / CHIBI.W, CHIBI.FY / CHIBI.H);
      hit(mid - 20 * s, feetY - 58 * s, 40 * s, 58 * s, () => this.change(() => stepOption(p, 'body', 1)));
      // small poses: standing and walking on the left, resting by the fire with a mug on the right
      const lxp = c0 + 34, gap = Math.min(80, (feetY - top - 120) / 2);
      this.shadow(lxp, feetY - gap, 22, 5, 0.15); this.mini(p.body, miniFrameIndex('down', 0), lxp, feetY - gap, 2);
      this.shadow(lxp, feetY, 22, 5, 0.15); this.mini(p.body, miniFrameIndex('right', walkF), lxp, feetY, 2);
      const rxp = c1 - 56, sy = feetY - 4;
      this.mini(p.body, MINI_SIT_FRAME, rxp - 8, sy + 6, 2);
      g.fillStyle(0xf4f4f4, 1).fillRect(rxp + 4, sy - 24, 7, 8); g.fillStyle(0xc8955a, 1).fillRect(rxp + 5, sy - 23, 5, 2);
      this.img('campfire', fireF, rxp + 30, sy + 6, 48, 48, 0.5, 1);
      // name plate and the body's short description
      const nm = (p.name ?? '').trim() || t('name_ph'), nt = this.text(nm, mid, feetY + 30, 16, (p.name ?? '').trim() ? TX.ink : TX.inkFaint, 'center', true);
      paper(g, mid - nt.width / 2 - 20, feetY + 12, nt.width + 40, 38);
      const dt = this.text(t('cdesc_' + p.body), mid, feetY + 70, 12, TX.cream, 'center');
      if (dt.width > c1 - c0) dt.setCrop(dt.width / 2 - (c1 - c0) / 2, 0, c1 - c0, 30);
      tag(g, mid - Math.min(dt.width, c1 - c0) / 2 - 10, feetY + 58, Math.min(dt.width, c1 - c0) + 20, 24, 0.75);
      py = 20; ph = startY - 14 - py;
    }

    this.drawCustomize(px, py, PW, ph, narrow);

    // start button
    const sx = narrow ? 12 : px, sw = (narrow ? IW - 24 : PW) - (touch.enabled ? TITLE_SOUND_GAP : 0);
    this.soundY = startY + startH / 2 - 2;
    greenButton(g, sx, startY, sw, startH);
    this.text(t('start') + '  ›', sx + sw / 2, startY + startH / 2 - 4, narrow ? 22 : 28, '#ffffff', 'center', true).setShadow(0, 3, '#24461a', 0, false, true);
    hit(sx, startY, sw, startH, () => this.start());
    if (!narrow) { const kt = this.text(t('title_keys'), 20 + (px - 40) / 2 + 110, IH - 12, 11, TX.creamDim, 'center'); tag(g, kt.x - kt.width / 2 - 8, IH - 23, kt.width + 16, 22, 0.7); }

    for (let i = this.usedT; i < this.texts.length; i++) this.texts[i].setVisible(false);
    for (let i = this.usedI; i < this.imgs.length; i++) this.imgs[i].setVisible(false);
  }

  private mini(b: Body, frame: number, x: number, y: number, s: number): void {
    this.img(`mini-${b}`, frame, x, y, MINI.W * s, MINI.H * s, MINI.FX / MINI.W, MINI.FY / MINI.H);
  }

  private drawBackground(IW: number, IH: number, time: number, poleX: number): void {
    const S = TITLE_SCALE, w = Math.ceil(IW / S), h = Math.ceil(IH / S), size = `${w}x${h}`;
    if (this.bgSize !== size) {
      this.bgSize = size;
      if (this.textures.exists('title-bg')) { this.bg.setTexture('__WHITE'); this.textures.remove('title-bg'); }
      this.textures.addCanvas('title-bg', paintTitleBackground(w, h));
      this.bg.setTexture('title-bg').setScale(S);
    }
    // flag pole and waving Thai flag
    const g = this.g, pxl = Math.round(poleX / S), top = Math.round(Math.max(h * 0.12, 180 / S)), base = Math.round(h * 0.62);
    g.fillStyle(0x9a9ca2, 1).fillRect(pxl * S, top * S, S, (base - top) * S);
    g.fillStyle(0xd8b26a, 1).fillRect((pxl - 1) * S, (top - 1) * S, 3 * S, S);
    const fx = (pxl + 1) * S, fy = (top + 1) * S;
    for (let i = 0; i < 18; i++) {
      const off = Math.round(Math.sin(time * 3 - i * 0.45) * (i / 18) * 1.6);
      for (let j = 0; j < 12; j++) g.fillStyle(flagStripe(j), 1).fillRect(fx + i * S, fy + (j + off) * S, S, S);
    }
  }

  private drawCustomize(px: number, py: number, PW: number, ph: number, narrow: boolean): void {
    const g = this.g, p = this.profile, L = p.looks[p.body];
    const headH = narrow ? 36 : 48;
    paper(g, px, py + headH - 8, PW, ph - headH + 8);
    wood(g, px, py, PW, headH);
    this.sign('👕 ' + t('customize'), px + 16, py + headH / 2, narrow ? 15 : 17);
    const rows: TitleRow[] = [...LOOK_ROWS, 'name'], rh = (ph - headH - 8) / rows.length;
    let nameShown = false;
    rows.forEach((row, i) => {
      const ry = py + headH + 4 + i * rh, focused = TITLE_ROWS[this.row] === row;
      if (focused) { notch(g, px + 8, ry + 2, PW - 16, rh - 4, 3, C.gold); g.fillStyle(C.paperLight, 1).fillRect(px + 11, ry + 5, PW - 22, rh - 10); }
      const labelW = narrow ? 76 : 104, lyy = ry + rh / 2;
      this.text(t('row_' + row), px + 18, lyy, narrow ? 12.5 : 14, focused ? TX.ink : TX.inkSoft, 'left', true);
      const ox = px + 18 + labelW, availW = PW - 36 - labelW, availH = rh - 10, oy = ry + 5;
      if (row === 'name') {
        const iw = Math.min(availW, 240), ih = Math.max(30, Math.min(40, availH));
        this.placeName(ox, oy + (availH - ih) / 2, iw, ih); nameShown = true;
        return;
      }
      const lr = row as LookRow, n = optionCount(lr), focusRow = () => { this.row = TITLE_ROWS.indexOf(lr); };
      if (!narrow && lr !== 'hair' && lr !== 'skin') {
        // ◀ current option ▶
        const bs = Math.min(36, availH), cy = oy + availH / 2, ts = Math.min(44, availH);
        woodButton(g, ox, cy - bs / 2, bs, bs);
        this.text('◀', ox + bs / 2, cy, 13, TX.cream, 'center', true);
        woodButton(g, ox + availW - bs, cy - bs / 2, bs, bs);
        this.text('▶', ox + availW - bs / 2, cy, 13, TX.cream, 'center', true);
        const tx0 = ox + bs + 14;
        notch(g, tx0, cy - ts / 2, ts, ts, 2, C.paperEdge); g.fillStyle(C.woodShade, 1).fillRect(tx0 + 2, cy - ts / 2 + 2, ts - 4, ts - 4);
        this.img(`thumb-${lr}-${L[lr]}`, 0, tx0 + 2, cy - ts / 2 + 2, ts - 4, ts - 4);
        this.text(`${L[lr] + 1} / ${n}`, (tx0 + ts + ox + availW - bs) / 2, cy, 16, TX.ink, 'center', true, PIXEL_FONT);
        this.hits.push({ x: ox - 4, y: cy - availH / 2, w: bs + 8, h: availH, fn: () => { this.change(() => stepOption(p, lr, -1)); focusRow(); } });
        this.hits.push({ x: ox + availW - bs - 4, y: cy - availH / 2, w: bs + 8, h: availH, fn: () => { this.change(() => stepOption(p, lr, 1)); focusRow(); } });
        this.hits.push({ x: tx0, y: cy - availH / 2, w: ox + availW - bs - tx0 - 4, h: availH, fn: () => { this.change(() => stepOption(p, lr, 1)); focusRow(); } });
        return;
      }
      const bs = Math.max(22, Math.min(narrow ? 40 : 36, availH, (availW - (n - 1) * 6) / n));
      for (let j = 0; j < n; j++) {
        const bx = ox + j * (bs + 6), by = oy + (availH - bs) / 2, sel = L[lr] === j;
        notch(g, bx, by, bs, bs, 2, C.paperEdge); g.fillStyle(C.woodShade, 1).fillRect(bx + 2, by + 2, bs - 4, bs - 4);
        this.img(`thumb-${lr}-${j}`, 0, bx + 2, by + 2, bs - 4, bs - 4);
        if (lr === 'acc' && j === 0) this.text('✕', bx + bs - 8, by + 9, 10, TX.cream, 'center', true);
        if (sel) g.lineStyle(3, C.gold, 1).strokeRect(bx - 2, by - 2, bs + 4, bs + 4);
        this.hits.push({ x: bx, y: by, w: bs, h: bs, fn: () => { this.change(() => setOption(p, lr, j)); focusRow(); } });
      }
    });
    if (!nameShown) this.nameInput.style.display = 'none';
  }

  /** Lays the real <input> over the canvas so phones get their keyboard. */
  private placeName(x: number, y: number, w: number, h: number): void {
    const inp = this.nameInput, rect = this.game.canvas.getBoundingClientRect(), k = rect.width / this.scale.width;
    Object.assign(inp.style, { display: 'block', left: `${rect.left + window.scrollX + x * k}px`, top: `${rect.top + window.scrollY + y * k}px`, width: `${w * k}px`, height: `${h * k}px` });
    inp.placeholder = t('name_ph');
    if (document.activeElement !== inp && inp.value !== this.profile.name) inp.value = this.profile.name;
  }
}
