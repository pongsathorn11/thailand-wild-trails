import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import { clamp } from '../core/rng';
import {
  addStore, buy, canCook, cook, ensureQuests, levelInfo, lockedTrails, notifyQuest, ownedFurniture, placedAt, plotAction, plotAt,
  seedsOwned, sleep, storeQty, trailDone, trailUnlocked, type CampState, type Plot, type QuestProgress,
} from '../core/camp';
import { seasonOf } from '../core/season';
import { saveProfile, type Profile } from '../core/profile';
import { CAMP, CATALOG, CROPS, QUEST_POOL, RECIPES, type QuestKind } from '../data/camp';
import { ITEMS } from '../data/items';
import { TRAILS } from '../data/trails';
import { campGround, campLayout, paintPlots } from '../gfx/campArt';
import { MINI, miniFrameIndex } from '../gfx/paint';
import type { Dir } from '../core/hiker';
import { t } from '../i18n';
import type { Toast } from './HikeScene';
import {
  ACHIEVEMENTS, MEDALS, MEDAL_COINS, PARKS, RANKS, REGIONS, SKILLS, TIERS, TITLES,
  achPoints, achTier, checkProgress, rankIndex, skillRank, skillValue, upgradeSkill,
} from '../core/progress';
import { PHOTO_EXP, PHOTO_ICONS } from '../data/photos';
import { progressMessages } from './progressText';
import { audio } from '../audio/audio';
import { onlinePanelOpen, openOnlinePanel } from '../ui/onlinePanel';
import { vkeys } from '../input/touch';

const fmtTime = (s: number | null | undefined): string => (s === null || s === undefined ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

const TS = CONFIG.TILE;
export type MenuType = 'shop' | 'cook' | 'quests' | 'trails' | 'skills' | 'journal';
export const JOURNAL_TABS = ['album', 'passport', 'achievements', 'medals', 'titles', 'stats'] as const;
export type JournalTab = (typeof JOURNAL_TABS)[number];
export interface MenuRow { icon: string; label: string; sub: string; right: string; enabled: boolean; medal?: { color: number; ring: number; got: boolean } }
export interface CampTarget { kind: 'plot' | 'fixed'; label: string; plot?: Plot; fixedType?: string }

/** The player's camp: garden, cooking, shop, decorating, daily quests and the way out to the trails. */
export class CampScene extends Phaser.Scene {
  toasts: Toast[] = [];
  menu: { type: MenuType; sel: number; tab?: JournalTab } | null = null;
  private progressTimer = 0;
  build: { sel: number } | null = null;
  seedSel = 0;
  flash = 0;
  pos = { x: 0, y: 0, dir: 'up' as Dir, frame: 0, animT: 0, moving: false };
  private layout = campLayout();
  private player!: Phaser.GameObjects.Sprite;
  private furniture: Phaser.GameObjects.Image[] = [];
  private plotsTex!: Phaser.Textures.CanvasTexture;
  private cursor!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private canopies: { img: Phaser.GameObjects.Image; x: number; phase: number }[] = [];

  constructor() { super('camp'); }
  get profile(): Profile { return this.registry.get('profile') as Profile; }
  get camp(): CampState { return (this.profile as any).camp as CampState; }
  get quests(): QuestProgress[] { return (this.profile as any).quests?.list ?? []; }

  init(data: { messages?: string[] }): void {
    this.toasts = (data.messages ?? []).map((text) => ({ text, t: 4 }));
    this.menu = null; this.build = null; this.flash = 0; this.canopies = []; this.furniture = [];
  }

  create(): void {
    const p = this.profile;
    ensureQuests(p); saveProfile(p);
    if (!this.textures.exists('camp-ground')) this.textures.addCanvas('camp-ground', campGround(this.layout.path));
    this.add.image(0, 0, 'camp-ground').setOrigin(0).setDepth(-2);
    if (this.textures.exists('camp-plots')) this.textures.remove('camp-plots');
    this.plotsTex = this.textures.createCanvas('camp-plots', CAMP.W * TS, CAMP.H * TS)!;
    this.add.image(0, 0, 'camp-plots').setOrigin(0).setDepth(-1);
    this.redrawPlots();

    for (const tr of this.layout.trees) {
      const w = tr.type === 'broad' ? 26 : 18;
      this.add.image(tr.x - w / 2, tr.y - 29, `tree-${tr.type}-${tr.v}-trunk`).setOrigin(0).setDepth(tr.y);
      const can = this.add.image(tr.x - w / 2, tr.y - 29, `tree-${tr.type}-${tr.v}-canopy`).setOrigin(0).setDepth(tr.y + 0.1);
      this.canopies.push({ img: can, x: tr.x - w / 2, phase: tr.phase });
    }
    const anchors = this.registry.get('propAnchors') as Record<string, [number, number]>;
    for (const f of CAMP.fixed) {
      const fx = f.x * TS + (f.type === 'tent' ? 16 : 8), fy = f.y * TS + 15, [ax, ay] = anchors[f.type];
      if (f.type === 'campfire') this.add.sprite(fx - ax, fy - ay, 'campfire', 0).setOrigin(0).setDepth(fy).play('fire-flicker');
      else this.add.image(fx - ax, fy - ay, `prop-${f.type}`).setOrigin(0).setDepth(fy);
    }
    this.rebuildFurniture();

    const [sx, sy] = CAMP.start;
    this.pos = { x: sx * TS + 8, y: sy * TS + 10, dir: 'up', frame: 0, animT: 0, moving: false };
    this.player = this.add.sprite(this.pos.x, this.pos.y, 'hiker', 0).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H);
    this.cursor = this.add.graphics().setDepth(1e6);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, CAMP.W * TS, CAMP.H * TS);
    cam.startFollow(this.player, true, 1, 1, 0, 10);
    cam.setBackgroundColor('#1f3a28');
    // whole-number zoom (crisp pixels), but never smaller than needed to fill a tall phone screen with the small camp map
    const zoom = () => {
      const W = this.scale.width, H = this.scale.height, base = Math.min(W, H) < 560 ? 2 : 3;
      cam.setZoom(Math.max(base, Math.ceil(H / (CAMP.H * TS)), Math.ceil(W / (CAMP.W * TS))));
    };
    zoom(); this.scale.on('resize', zoom);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    const onKey = (e: KeyboardEvent) => { if (!e.repeat) this.onKey(e.code); };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => { window.removeEventListener('keydown', onKey); this.scale.off('resize', zoom); this.scene.stop('campHud'); });
    this.scene.launch('campHud');
  }

  // ---------- helpers ----------
  toast(text: string): void { this.toasts.push({ text, t: 3.5 }); if (this.toasts.length > 3) this.toasts.shift(); }
  private save(): void { saveProfile(this.profile); }
  private redrawPlots(sway = 0): void { paintPlots(this.plotsTex.getContext(), this.camp.plots, sway); this.plotsTex.refresh(); }
  private rebuildFurniture(): void {
    this.furniture.forEach((f) => f.destroy());
    const anchors = this.registry.get('propAnchors') as Record<string, [number, number]>;
    this.furniture = this.camp.placed.map((o) => {
      const key = o.itemId === 'wood_bench' ? 'bench' : o.itemId, [ax, ay] = anchors[key], fx = o.x * TS + 8, fy = o.y * TS + 14;
      return this.add.image(fx - ax, fy - ay, `prop-${key}`).setOrigin(0).setDepth(fy);
    });
  }
  private isSolid(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= CAMP.W || y >= CAMP.H) return true;
    return this.layout.solid[y * CAMP.W + x] === 1 || !!placedAt(this.profile, x, y);
  }
  private canStand(px: number, py: number): boolean {
    return [[px - 4, py - 3], [px + 4, py - 3], [px - 4, py + 1], [px + 4, py + 1]].every(([x, y]) => !this.isSolid(Math.floor(x / TS), Math.floor(y / TS)));
  }
  cursorTile(): [number, number] {
    const [ox, oy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.pos.dir];
    return [Math.floor(this.pos.x / TS) + ox, Math.floor((this.pos.y - 4) / TS) + oy];
  }
  selectedCrop(): string | null { const s = seedsOwned(this.profile); if (!s.length) return null; this.seedSel %= s.length; return s[this.seedSel]; }
  buildItem(): string | null { const o = ownedFurniture(this.profile); if (!o.length || !this.build) return null; this.build.sel = ((this.build.sel % o.length) + o.length) % o.length; return o[this.build.sel]; }
  private quest(kind: QuestKind): void {
    for (const d of notifyQuest(this.profile, kind)) {
      this.toast(t('msg_questDone', { q: t('q_' + d.id) }) + ` +${d.exp} EXP +${d.coins}🪙`); audio.sfx('chime');
      if (d.levelUp) { this.toast(t('msg_levelUp', { n: d.levelUp })); audio.sfx('fanfare'); }
    }
  }

  // ---------- interaction ----------
  findTarget(): CampTarget | null {
    const [cx, cy] = this.cursorTile(), fx = Math.floor(this.pos.x / TS), fy = Math.floor((this.pos.y - 4) / TS);
    const plot = plotAt(this.profile, cx, cy) ?? plotAt(this.profile, fx, fy);
    if (plot) {
      if (!plot.cropId) { const c = this.selectedCrop(); return { kind: 'plot', plot, label: c ? t('act_plant', { s: t('item_' + CROPS[c].produce) }) : t('act_noSeed') }; }
      const crop = CROPS[plot.cropId];
      return { kind: 'plot', plot, label: plot.grown >= crop.days ? t('act_harvest') : plot.watered ? t('act_growing') : t('act_water') };
    }
    let best: (typeof CAMP.fixed)[number] | null = null, bd = Infinity;
    for (const f of CAMP.fixed) {
      const d = Math.hypot(this.pos.x - (f.x * TS + (f.type === 'tent' ? 16 : 8)), this.pos.y - (f.y * TS + 12));
      if (d < 30 && d < bd) { bd = d; best = f; }
    }
    if (!best) return null;
    const label = { tent: 'act_sleep', campfire: 'act_cook', board: 'act_quests', mailbox: 'act_shop', trailSign: 'act_hike' }[best.type];
    return { kind: 'fixed', fixedType: best.type, label: t(label) };
  }

  private run(tg: CampTarget | null): void {
    if (!tg) return;
    const p = this.profile;
    if (tg.kind === 'plot') {
      const r = plotAction(p, tg.plot!, tg.plot!.cropId ? null : this.selectedCrop(), skillRank(p, 'gardening'));
      const name = 'crop' in r ? t('item_' + r.crop) : '';
      const text = r.msg === 'msg_growing' ? t(r.msg, { n: r.days }) : r.msg === 'msg_harvest' ? t(r.msg, { s: name, n: r.n }) : t(r.msg, { s: name });
      this.toast(text); audio.sfx(r.msg === 'msg_harvest' ? 'pickup' : r.msg === 'msg_watered' ? 'water' : r.msg === 'msg_planted' ? 'select' : 'blip');
      if (r.msg === 'msg_planted') this.quest('plant');
      if (r.msg === 'msg_harvest') this.quest('harvest');
      this.redrawPlots(); this.save();
      return;
    }
    switch (tg.fixedType) {
      case 'tent': {
        const { newSeason } = sleep(p);
        this.flash = 1; audio.sfx('sleep');
        this.toast(t('msg_sleep', { n: p.day, s: t('season_' + seasonOf(p.day)) }));
        if (newSeason) this.toast(t('msg_newSeason', { s: t('season_' + seasonOf(p.day)) }));
        this.redrawPlots(); this.save();
        break;
      }
      case 'campfire': this.menu = { type: 'cook', sel: 0 }; break;
      case 'board': this.menu = { type: 'quests', sel: 0 }; break;
      case 'mailbox': this.menu = { type: 'shop', sel: 0 }; break;
      case 'trailSign': this.openTrails(); break;
    }
  }

  // ---------- menus ----------
  menuRows(): MenuRow[] {
    const m = this.menu, p = this.profile, lvl = levelInfo(p.exp).level;
    if (!m) return [];
    if (m.type === 'shop') return CATALOG.map((e) => {
      const crop = Object.values(CROPS).find((c) => c.seed === e.id);
      const sub = lvl < e.level ? t('need_level', { n: e.level })
        : crop ? t('grows_in', { s: crop.seasons.map((s) => t('season_' + s)).join(' / '), n: crop.days }) + ' · ' + t('have', { n: storeQty(p, e.id) })
          : t('have', { n: storeQty(p, e.id) });
      return { icon: ITEMS[e.id].icon, label: t('item_' + e.id), sub, right: `🪙 ${e.price}`, enabled: lvl >= e.level && p.coins >= e.price };
    });
    if (m.type === 'cook') return RECIPES.map((r) => ({
      icon: ITEMS[r.id].icon, label: t('item_' + r.id) + ` (${t('have', { n: storeQty(p, r.id) })})`,
      sub: Object.entries(r.needs).map(([k, n]) => `${ITEMS[k].icon} ${t('item_' + k)} ${storeQty(p, k)}/${n}`).join(' · '),
      right: t('tip_' + r.id), enabled: canCook(p, r.id),
    }));
    if (m.type === 'trails') return TRAILS.map((tr) => {
      const ok = trailUnlocked(p, tr), req = tr.unlock && TRAILS.find((x) => x.id === tr.unlock!.trail);
      const n = (p as any).passport?.[tr.parkId]?.trails?.[tr.id]?.completions ?? 0;
      return { icon: ok ? (n ? '🏅' : '⛰️') : '🔒', label: t(tr.trailKey),
        sub: ok ? `${t(tr.parkKey)} · ${t(tr.diffKey)}` : t('locked_req', { lv: tr.unlock!.level, t: t(req!.trailKey) }),
        right: ok ? `${t('region_' + tr.region)}${n ? ' · ×' + n : ''}` : '', enabled: ok };
    });
    if (m.type === 'skills') return SKILLS.map((s) => {
      const r = skillRank(p, s.id), locked = 'locked' in s && s.locked, pct = s.per < 1;
      return {
        icon: s.icon, label: `${t('skill_' + s.id)}   ${'●'.repeat(r)}${'○'.repeat(s.max - r)}`,
        sub: t('sdesc_' + s.id, { v: skillValue(s.id, Math.max(r, 1)) }) + (r === 0 && !locked ? ' (Lv.1)' : ''),
        right: locked ? '🔒' : r >= s.max ? 'MAX' : `→ ${pct ? '' : '+'}${skillValue(s.id, r + 1)}${pct ? '%' : ''}`,
        enabled: !locked && r < s.max,
      };
    });
    if (m.type === 'journal') return this.journalRows(m.tab ?? 'album');
    return this.quests.map((q) => {
      const d = QUEST_POOL.find((x) => x.id === q.id)!;
      return { icon: q.done ? '✅' : '📌', label: t('q_' + d.id), sub: `${q.progress}/${d.count}`, right: `+${d.exp} EXP · 🪙 ${d.coins}`, enabled: !q.done };
    });
  }

  private journalRows(tab: JournalTab): MenuRow[] {
    const p = this.profile as Profile & Record<string, any>, album: { subjectId: string; date: string | null }[] = p.album ?? [];
    if (tab === 'album') return Object.keys(PHOTO_EXP).map((id) => {
      const a = album.find((x) => x.subjectId === id);
      return { icon: a ? PHOTO_ICONS[id] : '❔', label: a ? t('ph_' + id) : t('unknown'), sub: a ? (a.date ? t('photo_date', { d: a.date }) : '') : '💡 ' + t('hint_' + id), right: `+${PHOTO_EXP[id]} EXP`, enabled: !!a };
    });
    if (tab === 'passport') return PARKS.map((pk) => {
      const pp = p.passport?.[pk.id];
      let sub = t('coming_soon');
      if (pk.open) {
        const done = TRAILS.filter((x) => x.parkId === pk.id && pp?.trails?.[x.id]);
        sub = done.length ? done.map((x) => { const tr = pp.trails[x.id]; return t('passport_trail', { t: t(x.trailKey), n: tr.completions, b: fmtTime(tr.bestTimeSec) }); }).join(' · ')
          + (pp.firstDate ? ' · ' + t('first_date', { d: pp.firstDate }) : '') : t('not_stamped');
      }
      return { icon: pp?.stamped ? '🏅' : pk.open ? '⬜' : '🔒', label: t(pk.nameKey), sub, right: t('region_' + pk.region), enabled: !!pp?.stamped };
    });
    if (tab === 'achievements') return ACHIEVEMENTS.map((a) => {
      const tier = achTier(p, a.id), v = a.value(p), done = tier + 1 >= a.tiers.length, next = done ? a.tiers[a.tiers.length - 1] : a.tiers[tier + 1];
      const tiers = a.tiers.map((_, i) => (i <= tier ? TIERS[i].icon : '▫️')).join('');
      return { icon: tier >= 0 ? TIERS[tier].icon : a.icon, label: `${t('ach_' + a.id)}  ${tiers}`,
        sub: t('adesc_' + a.id, { v: Number.isInteger(v) ? v : v.toFixed(1), n: next }) + ' · ' + (done ? t('ach_complete') : t('ach_next', { t: t('tier_' + TIERS[tier + 1].id) })),
        right: done ? '' : `+${TIERS[tier + 1].coins}🪙`, enabled: tier >= 0 };
    });
    if (tab === 'medals') return MEDALS.map((md) => {
      const got = p.medals?.[md.id], region = (REGIONS as string[]).includes(md.id);
      const noTrail = region && !TRAILS.some((x) => x.region === md.id);
      return { icon: md.icon, medal: { color: md.color, ring: md.ring, got: !!got }, label: t('medal_' + md.id),
        sub: noTrail ? t('coming_soon') : t('mdesc_' + (region ? 'region' : md.id), { r: t('region_' + md.id) }), right: got ? got : `+${MEDAL_COINS}🪙`, enabled: !!got };
    });
    if (tab === 'titles') return TITLES.map((ti) => {
      const ok = ti.cond(p), on = (p.title ?? 'newbie') === ti.id;
      return { icon: on ? '🏷️' : ok ? '▫️' : '🔒', label: t('title_' + ti.id), sub: t('tcond_' + ti.id), right: on ? t('equipped') : ok ? t('equip') : '', enabled: ok };
    });
    const st = p.stats ?? {}, L = levelInfo(p.exp), r = rankIndex(p), nextRank = RANKS[r + 1];
    return ([
      ['🎖️', 'st_rank', t('rank_' + RANKS[r][0]), nextRank ? t('rank_points', { p: achPoints(p), n: nextRank[1] }) : t('rank_max', { p: achPoints(p) })],
      ['🥾', 'st_trails', String(st.trailsCompleted || 0), ''], ['📏', 'st_distance', (st.totalDistanceKm || 0).toFixed(1) + ' km', ''],
      ['🗑️', 'st_litter', String(st.litterCollected || 0), ''], ['📷', 'st_photos', String(st.photosTaken || 0), ''],
      ['📅', 'st_days', String(p.day), ''], ['⭐', 'st_level', `Lv.${L.level} · ${p.exp} EXP`, ''],
    ] as [string, string, string, string][]).map(([icon, k, v, sub]) => ({ icon, label: t(k), sub, right: v, enabled: true }));
  }

  confirmMenu(): void {
    const m = this.menu!, p = this.profile;
    if (m.type === 'skills') {
      const s = SKILLS[m.sel], r = upgradeSkill(p, s.id);
      this.toast(r === 'ok' ? t('msg_skillUp', { s: t('skill_' + s.id), n: skillRank(p, s.id) }) : t({ locked: 'msg_skillLocked', max: 'msg_skillMax', points: 'msg_noPoints' }[r]));
      audio.sfx(r === 'ok' ? 'fanfare' : 'error');
      this.save(); return;
    }
    if (m.type === 'journal' && m.tab === 'titles') {
      const ti = TITLES[m.sel];
      if (!ti.cond(p)) { this.toast(t('tcond_' + ti.id)); audio.sfx('error'); return; }
      (p as any).title = ti.id; audio.sfx('select'); this.toast(t('msg_titleSet', { t: t('title_' + ti.id) })); this.save(); return;
    }
    if (m.type === 'quests' || m.type === 'journal') { this.menu = null; return; }
    if (m.type === 'trails') {
      const tr = TRAILS[m.sel];
      if (!trailUnlocked(p, tr)) { this.toast(t('msg_trailLocked')); audio.sfx('error'); return; }
      audio.sfx('select');
      p.lastTrail = tr.id; this.save();
      this.scene.start('pack', { trailId: tr.id });
      return;
    }
    if (m.type === 'shop') {
      const e = CATALOG[m.sel], r = buy(p, e.id);
      if (r === 'locked') this.toast(t('msg_lockedLv', { n: e.level }));
      else if (r === 'coins') this.toast(t('msg_noCoins'));
      else this.toast(t('msg_bought', { s: t('item_' + e.id) }));
      audio.sfx(r === 'ok' ? 'select' : 'error');
    }
    if (m.type === 'cook') {
      const r = RECIPES[m.sel];
      if (!cook(p, r.id)) { this.toast(t('msg_noIngr')); audio.sfx('error'); return; }
      audio.sfx('eat');
      this.toast(t('msg_cooked', { s: t('item_' + r.id) })); this.quest('cook');
    }
    this.save();
  }

  // ---------- decorating ----------
  canPlace(x: number, y: number): boolean {
    if (this.isSolid(x, y) || plotAt(this.profile, x, y) || CAMP.fixed.some((f) => f.x === x && f.y === y)) return false;
    return !(Math.floor(this.pos.x / TS) === x && Math.floor(this.pos.y / TS) === y);
  }
  private place(): void {
    const id = this.buildItem();
    if (!id) { this.toast(t('build_none')); return; }
    const [x, y] = this.cursorTile();
    if (!this.canPlace(x, y)) { this.toast(t('msg_cantPlace')); audio.sfx('error'); return; }
    audio.sfx('select');
    this.camp.placed.push({ itemId: id, x, y }); addStore(this.profile, id, -1);
    this.toast(t('msg_placed', { s: t('item_' + id) })); this.quest('placeFurniture');
    this.rebuildFurniture(); this.save();
  }
  private pickUp(): void {
    const [x, y] = this.cursorTile(), o = placedAt(this.profile, x, y);
    if (!o) return;
    audio.sfx('pickup');
    this.camp.placed = this.camp.placed.filter((q) => q !== o); addStore(this.profile, o.itemId, 1);
    this.toast(t('msg_pickedFurn', { s: t('item_' + o.itemId) }));
    this.rebuildFurniture(); this.save();
  }

  /** Trail picker (the trail sign, the T key or the Hike button). */
  openTrails(): void { this.build = null; this.menu = { type: 'trails', sel: Math.max(0, TRAILS.findIndex((x) => x.id === this.profile.lastTrail)) }; }

  // ---------- input ----------
  onKey(code: string): void {
    if (onlinePanelOpen()) return;
    if (code === 'KeyO' && !this.menu && !this.build) { audio.sfx('select'); openOnlinePanel(); return; }
    if (this.menu) {
      const n = this.menuRows().length, m = this.menu;
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight'].includes(code)) audio.sfx('blip');
      if (n && (code === 'ArrowUp' || code === 'KeyW')) m.sel = (m.sel + n - 1) % n;
      if (n && (code === 'ArrowDown' || code === 'KeyS')) m.sel = (m.sel + 1) % n;
      if (m.type === 'journal' && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
        const i = JOURNAL_TABS.indexOf(m.tab ?? 'album'), d = code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1;
        m.tab = JOURNAL_TABS[(i + d + JOURNAL_TABS.length) % JOURNAL_TABS.length]; m.sel = 0;
      }
      if ((code === 'KeyK' && m.type === 'skills') || (code === 'KeyJ' && m.type === 'journal')) { this.menu = null; return; }
      if (code === 'Enter' || code === 'Space' || (code === 'KeyE' && m.type === 'quests')) this.confirmMenu();
      else if (code === 'Escape' || code === 'KeyB') this.menu = null;
      return;
    }
    if (code === 'KeyT') { audio.sfx('select'); this.openTrails(); return; }
    if (code === 'KeyK') { this.build = null; this.menu = { type: 'skills', sel: 0 }; return; }
    if (code === 'KeyJ') { this.build = null; this.menu = { type: 'journal', sel: 0, tab: 'album' }; return; }
    if (code === 'KeyB') { this.build = this.build ? null : { sel: 0 }; if (this.build && !ownedFurniture(this.profile).length && !this.camp.placed.length) this.toast(t('build_none')); return; }
    if (this.build) {
      if (code === 'BracketLeft') this.build.sel--;
      if (code === 'BracketRight' || code === 'KeyQ') this.build.sel++;
      if (code === 'KeyE' || code === 'Space') this.place();
      if (code === 'KeyX') this.pickUp();
      if (code === 'Escape') this.build = null;
      return;
    }
    if (code === 'Escape') { this.save(); this.scene.start('title'); return; }
    if (code === 'KeyQ') { this.seedSel++; const c = this.selectedCrop(); if (c) this.toast(t('seed_sel', { s: t('item_' + CROPS[c].produce), n: storeQty(this.profile, CROPS[c].seed) })); }
    if (code === 'KeyE' || code === 'Space') this.run(this.findTarget());
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000), now = this.time.now / 1000;
    for (const tt of this.toasts) tt.t -= dt;
    this.toasts = this.toasts.filter((tt) => tt.t > 0);
    this.flash = Math.max(0, this.flash - dt * 2);
    for (const c of this.canopies) c.img.x = c.x + Math.round(Math.sin(now * 1.4 + c.phase) * 0.8);
    if (Math.floor(now * 2) !== Math.floor((now - dt) * 2)) this.redrawPlots(Math.sin(now * 2) > 0.8 ? 1 : 0);
    this.progressTimer -= dt;
    if (this.progressTimer <= 0) {
      this.progressTimer = 0.5;
      const msgs = progressMessages(checkProgress(this.profile));
      if (msgs.length) { msgs.forEach((m) => this.toast(m)); audio.sfx('chime'); this.save(); }
    }

    const p = this.pos, k = this.keys;
    let dx = 0, dy = 0;
    if (!this.menu) { if (k.A.isDown || k.LEFT.isDown || vkeys.left) dx--; if (k.D.isDown || k.RIGHT.isDown || vkeys.right) dx++; if (k.W.isDown || k.UP.isDown || vkeys.up) dy--; if (k.S.isDown || k.DOWN.isDown || vkeys.down) dy++; }
    p.moving = dx !== 0 || dy !== 0;
    if (p.moving) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      const speed = (k.SHIFT.isDown || vkeys.run) ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED, nx = p.x + dx * speed * dt, ny = p.y + dy * speed * dt;
      if (this.canStand(nx, p.y)) p.x = nx;
      if (this.canStand(p.x, ny)) p.y = ny;
      p.x = clamp(p.x, 6, CAMP.W * TS - 6); p.y = clamp(p.y, 6, CAMP.H * TS - 2);
      p.animT += dt * ((k.SHIFT.isDown || vkeys.run) ? 12 : 8); p.frame = Math.floor(p.animT) % 4;
    } else p.frame = 0;
    this.player.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y).setFrame(miniFrameIndex(p.dir, p.frame));

    this.cursor.clear();
    if (this.build) {
      const [x, y] = this.cursorTile(), ok = this.canPlace(x, y) || !!placedAt(this.profile, x, y);
      this.cursor.lineStyle(1, ok ? 0x9bd35a : 0xe65046, 0.95).strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1);
    }
  }

  /** Text for trail unlocks gained since `lockedBefore` (shown when arriving back from a hike). */
  static unlockMessages(p: Profile, lockedBefore: string[]): string[] {
    return lockedBefore.filter((id) => !lockedTrails(p).includes(id)).map((id) => t('msg_unlockTrail', { t: t(TRAILS.find((x) => x.id === id)!.trailKey) }));
  }
  static questText(id: string): string { return t('q_' + id); }
  static done(p: Profile, id: string): boolean { return trailDone(p, id); }
}
