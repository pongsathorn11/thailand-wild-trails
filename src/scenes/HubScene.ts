import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import { clamp } from '../core/rng';
import { hubCanStand, hubSolid, PARTY_MAX } from '../core/hub';
import { EMOTES, type Emote } from '../core/coop';
import { trailUnlocked } from '../core/camp';
import { displayName } from '../core/cloud';
import { saveProfile, type Profile } from '../core/profile';
import { HUB, type HubSpotType } from '../data/hub';
import { TRAILS, trailById } from '../data/trails';
import { hubGround, hubLayout } from '../gfx/hubArt';
import { MINI, miniFrameIndex } from '../gfx/paint';
import { installMiniSheet } from '../gfx/sheets';
import { resolveLook } from '../data/looks';
import type { Dir } from '../core/hiker';
import { t } from '../i18n';
import type { Toast } from './HikeScene';
import type { MenuRow } from './journalRows';
import { audio } from '../audio/audio';
import { onlinePanelOpen, openOnlinePanel } from '../ui/onlinePanel';
import { vkeys } from '../input/touch';
import { cloud } from '../net/cloud';
import { coopPlan } from '../net/coop';
import { HubSession, type HubOther } from '../net/hub';

const TS = CONFIG.TILE;
export type HubMenu = { type: 'party' | 'info'; sel: number };
/** One row of the party panel and what pressing it does. */
type PartyAct = 'new' | 'join' | 'trail' | 'member' | 'ready' | 'go' | 'leave';
export const EMOTE_ICON: Record<Emote, string> = { wave: '👋', photo: '📸', rest: '☕', go: '🚩' };

/**
 * Social Hub: a shared plaza on the game server. Other hikers walk around live; the party board and the
 * gathering sign form parties that set off together into one co-op room.
 */
export class HubScene extends Phaser.Scene {
  toasts: Toast[] = [];
  menu: HubMenu | null = null;
  hub: HubSession | null = null;
  status: 'connecting' | 'live' | 'error' = 'connecting';
  /** Trail picked on the party panel before a party exists. */
  newTrail = TRAILS[0].id;
  pos = { x: 0, y: 0, dir: 'up' as Dir, frame: 0, animT: 0, moving: false };
  myEmote: { e: Emote; t: number } | null = null;
  private solid = hubSolid();
  private player!: Phaser.GameObjects.Sprite;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private canopies: { img: Phaser.GameObjects.Image; x: number; phase: number }[] = [];
  private leaving = false;

  constructor() { super('hub'); }
  get profile(): Profile { return this.registry.get('profile') as Profile; }

  init(): void {
    this.toasts = []; this.menu = null; this.hub = null; this.status = 'connecting'; this.sprites.clear(); this.canopies = [];
    this.myEmote = null; this.leaving = false;
    const p = this.profile;
    this.newTrail = (p.lastTrail && trailById(p.lastTrail) && trailUnlocked(p, trailById(p.lastTrail)!)) ? p.lastTrail : TRAILS[0].id;
  }

  create(): void {
    const layout = hubLayout();
    if (!this.textures.exists('hub-ground')) this.textures.addCanvas('hub-ground', hubGround(layout.path));
    this.add.image(0, 0, 'hub-ground').setOrigin(0).setDepth(-2);
    for (const tr of layout.trees) {
      const w = tr.type === 'broad' ? 26 : 18;
      this.add.image(tr.x - w / 2, tr.y - 29, `tree-${tr.type}-${tr.v}-trunk`).setOrigin(0).setDepth(tr.y);
      const can = this.add.image(tr.x - w / 2, tr.y - 29, `tree-${tr.type}-${tr.v}-canopy`).setOrigin(0).setDepth(tr.y + 0.1);
      this.canopies.push({ img: can, x: tr.x - w / 2, phase: tr.phase });
    }
    const anchors = this.registry.get('propAnchors') as Record<string, [number, number]>;
    const artOf: Record<HubSpotType, string> = { partyBoard: 'board', info: 'infoHut', cafe: 'cafeStall', gate: 'trailSign', home: 'trailSign', campfire: 'campfire' };
    for (const s of HUB.spots) {
      const wide = s.type === 'info' || s.type === 'cafe', fx = s.x * TS + (wide ? 16 : 8), fy = s.y * TS + 15, key = artOf[s.type], [ax, ay] = anchors[key];
      if (key === 'campfire') this.add.sprite(fx - ax, fy - ay, 'campfire', 0).setOrigin(0).setDepth(fy).play('fire-flicker');
      else this.add.image(fx - ax, fy - ay, `prop-${key}`).setOrigin(0).setDepth(fy);
    }
    for (const [x, y] of HUB.benches) { const [ax, ay] = anchors.bench, fx = x * TS + 8, fy = y * TS + 14; this.add.image(fx - ax, fy - ay, 'prop-bench').setOrigin(0).setDepth(fy); }

    const [sx, sy] = HUB.start;
    this.pos = { x: sx * TS + 8, y: sy * TS + 10, dir: 'up', frame: 0, animT: 0, moving: false };
    this.player = this.add.sprite(this.pos.x, this.pos.y, 'hiker', 0).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, HUB.W * TS, HUB.H * TS);
    cam.startFollow(this.player, true, 1, 1, 0, 10);
    cam.setBackgroundColor('#1f3a28');
    const zoom = () => {
      const W = this.scale.width, H = this.scale.height, base = Math.min(W, H) < 560 ? 2 : 3;
      cam.setZoom(Math.max(base, Math.ceil(H / (HUB.H * TS)), Math.ceil(W / (HUB.W * TS))));
    };
    zoom(); this.scale.on('resize', zoom);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    const onKey = (e: KeyboardEvent) => { if (!e.repeat) this.onKey(e.code); };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', onKey); this.scale.off('resize', zoom); this.scene.stop('hubHud');
      this.hub?.leave(); this.hub = null;
      for (const id of this.sprites.keys()) if (this.textures.exists('hub-' + id)) this.textures.remove('hub-' + id);
    });
    this.scene.launch('hubHud');
    this.connect();
  }

  private connect(): void {
    const p = this.profile, title = (p as Profile & { title?: string }).title ?? 'newbie';
    void cloud.accessToken()
      .then((token) => HubSession.join(token, displayName(p, t('on_hiker')), title, { body: p.body, looks: p.looks[p.body] }, cloud.campCode))
      .then(({ hub, x, y }) => {
        if (!this.scene.isActive()) { hub.leave(); return; }
        this.hub = hub; this.status = 'live';
        this.pos.x = x; this.pos.y = y;
        for (const o of hub.others.values()) this.addOther(o);
        hub.onEvent = (e) => this.onHub(e);
        this.toast(t('hub_welcome', { n: hub.others.size + 1 })); audio.sfx('chime');
      })
      .catch((e: Error) => {
        this.status = 'error';
        const key = 'coop_err_' + (['auth', 'no server'].includes(e.message) ? e.message.replace(' ', '_') : 'connect');
        audio.sfx('error');
        this.time.delayedCall(400, () => this.scene.start('camp', { messages: [t(key)] }));
      });
  }

  private addOther(o: HubOther): void {
    const key = 'hub-' + o.id;
    installMiniSheet(this.textures, key, resolveLook(o.look.body, o.look.looks));
    this.sprites.set(o.id, this.add.sprite(o.x, o.y, key, 0).setOrigin(MINI.FX / MINI.W, MINI.FY / MINI.H));
  }

  private onHub(e: Parameters<HubSession['onEvent']>[0]): void {
    switch (e.kind) {
      case 'joined': this.addOther(e.o); this.toast(t('hub_joined', { n: e.o.name })); break;
      case 'left': this.sprites.get(e.o.id)?.destroy(); this.sprites.delete(e.o.id); if (this.textures.exists('hub-' + e.o.id)) this.textures.remove('hub-' + e.o.id); break;
      case 'fix': this.pos.x = e.x; this.pos.y = e.y; this.hub?.resync(); break;
      case 'emote': if (e.o) audio.sfx('blip'); break;
      case 'party': this.clampSel(); break;
      case 'board': this.clampSel(); break;
      case 'partyErr': this.toast(t('party_err_' + e.r)); audio.sfx('error'); break;
      case 'depart': this.depart(e.trail, e.room); break;
      case 'closed': if (!this.leaving) { this.leaving = true; this.scene.start('camp', { messages: [t('hub_lost')] }); } break;
    }
  }

  /** The party set off: everyone packs for the same trail and joins the co-op room named after the party. */
  private depart(trail: string, room: string): void {
    if (this.leaving) return;
    this.leaving = true;
    const p = this.profile;
    coopPlan.room = room; p.lastTrail = trail; saveProfile(p);
    audio.sfx('fanfare');
    this.scene.start('pack', { trailId: trail });
  }

  toast(text: string): void { this.toasts.push({ text, t: 3.5 }); if (this.toasts.length > 3) this.toasts.shift(); }

  // ---------- interaction ----------
  findTarget(): { type: HubSpotType | 'visit'; label: string; code?: string } | null {
    // a hiker standing right next to you: visit their camp
    let who: HubOther | null = null, wd = 22;
    for (const o of this.hub?.others.values() ?? []) { const d = Math.hypot(this.pos.x - o.x, this.pos.y - o.y); if (o.camp && d < wd) { wd = d; who = o; } }
    if (who) return { type: 'visit', label: t('hub_act_visit', { n: who.name }), code: who.camp! };
    let best: (typeof HUB.spots)[number] | null = null, bd = Infinity;
    for (const s of HUB.spots) {
      const wide = s.type === 'info' || s.type === 'cafe';
      const d = Math.hypot(this.pos.x - (s.x * TS + (wide ? 16 : 8)), this.pos.y - (s.y * TS + 12));
      if (d < (wide ? 34 : 30) && d < bd) { bd = d; best = s; }
    }
    return best ? { type: best.type, label: t('hub_act_' + best.type) } : null;
  }

  private use(type: HubSpotType | 'visit', code?: string): void {
    audio.sfx('select');
    if (type === 'visit' && code) { this.leaving = true; this.scene.start('visit', { code }); return; }
    if (type === 'partyBoard' || type === 'gate') this.menu = { type: 'party', sel: 0 };
    else if (type === 'info') this.menu = { type: 'info', sel: 0 };
    else if (type === 'cafe') { this.emote('rest'); this.toast(t('hub_cafe')); }
    else if (type === 'campfire') this.toast(t('hub_fire'));
    else if (type === 'home') this.goHome();
  }

  emote(e: Emote): void {
    if (!this.hub || this.status !== 'live') return;
    this.hub.send({ t: 'hub_emote', emote: e });
    this.myEmote = { e, t: 3 };
  }

  goHome(): void { if (this.leaving) return; this.leaving = true; audio.sfx('select'); this.scene.start('camp'); }

  // ---------- party panel ----------
  private unlockedTrails(): string[] { return TRAILS.filter((tr) => trailUnlocked(this.profile, tr)).map((tr) => tr.id); }
  partyRows(): (MenuRow & { act: PartyAct; code?: string })[] {
    const h = this.hub, party = h?.party, trailName = (id: string) => t(trailById(id)!.trailKey);
    if (!h) return [];
    if (!party) {
      const rows: (MenuRow & { act: PartyAct; code?: string })[] = [
        { act: 'new', icon: '➕', label: t('party_new'), sub: t('party_trail_pick', { t: trailName(this.newTrail) }), right: '◀ ▶', enabled: true },
      ];
      for (const l of h.board) rows.push({ act: 'join', code: l.code, icon: '🎒', label: t('party_of', { n: l.leaderName }), sub: trailName(l.trail), right: `${l.size}/${PARTY_MAX}`, enabled: true });
      if (!h.board.length) rows.push({ act: 'member', icon: '📌', label: t('party_board_empty'), sub: t('party_board_tip'), right: '', enabled: false });
      return rows;
    }
    const lead = party.leader === h.id, tr = trailById(party.trail)!;
    const rows: (MenuRow & { act: PartyAct })[] = [
      { act: 'trail', icon: '⛰️', label: trailName(party.trail), sub: `${t(tr.parkKey)} · ${t(tr.diffKey)}`, right: lead ? '◀ ▶' : t('party_leader_picks'), enabled: lead },
    ];
    for (const m of party.members) {
      const isLead = m.id === party.leader;
      rows.push({ act: 'member', icon: isLead ? '👑' : '🥾', label: m.name + (m.id === h.id ? ` (${t('ui_you')})` : ''), sub: isLead ? t('party_leader') : t('party_member'), right: m.ready ? t('party_ready_yes') : t('party_ready_no'), enabled: false });
    }
    const meReady = party.members.find((m) => m.id === h.id)?.ready ?? false;
    const everyoneReady = party.members.every((m) => m.ready);
    if (lead) rows.push({ act: 'go', icon: '🚩', label: t('party_go'), sub: everyoneReady ? t('party_go_sub') : t('party_wait'), right: '', enabled: everyoneReady });
    else rows.push({ act: 'ready', icon: meReady ? '⏸' : '✋', label: t(meReady ? 'party_unready' : 'party_set_ready'), sub: t('party_ready_sub'), right: '', enabled: true });
    rows.push({ act: 'leave', icon: '🚪', label: t('party_leave'), sub: '', right: '', enabled: true });
    return rows;
  }
  infoRows(): MenuRow[] {
    return TRAILS.map((tr) => {
      const ok = trailUnlocked(this.profile, tr), r = tr.realData;
      return { icon: ok ? '⛰️' : '🔒', label: t(tr.trailKey), sub: `${t(tr.parkKey)} · ${t('region_' + tr.region)}`, right: `${r.distanceKm} km${r.elevationM ? ` · ${r.elevationM} m` : ''}`, enabled: true };
    });
  }
  menuRows(): MenuRow[] { return this.menu?.type === 'info' ? this.infoRows() : this.partyRows(); }
  private clampSel(): void { if (this.menu) { const n = this.menuRows().length; this.menu.sel = Math.max(0, Math.min(this.menu.sel, n - 1)); } }

  /** ◀ ▶ on the trail row: cycle through trails this player has unlocked. */
  private cycleTrail(d: number): void {
    const h = this.hub, list = this.unlockedTrails();
    if (!h || !list.length) return;
    const cur = h.party ? h.party.trail : this.newTrail, i = Math.max(0, list.indexOf(cur)), next = list[(i + d + list.length) % list.length];
    audio.sfx('blip');
    if (h.party) { if (h.party.leader === h.id) h.send({ t: 'party_trail', trail: next }); }
    else this.newTrail = next;
  }

  confirmMenu(): void {
    const m = this.menu, h = this.hub;
    if (!m || !h) return;
    if (m.type === 'info') { this.menu = null; return; }
    const r = this.partyRows()[m.sel];
    if (!r || !r.enabled) { audio.sfx('error'); return; }
    audio.sfx('select');
    switch (r.act) {
      case 'new': h.send({ t: 'party_new', trail: this.newTrail }); m.sel = 0; break;
      case 'join': h.send({ t: 'party_join', code: r.code! }); m.sel = 0; break;
      case 'trail': this.cycleTrail(1); break;
      case 'ready': h.send({ t: 'party_ready', ready: !(h.party?.members.find((x) => x.id === h.id)?.ready) }); break;
      case 'go': h.send({ t: 'party_go' }); break;
      case 'leave': h.send({ t: 'party_leave' }); m.sel = 0; break;
    }
  }

  // ---------- input ----------
  onKey(code: string): void {
    if (onlinePanelOpen() || this.leaving) return;
    if (this.menu) {
      const n = this.menuRows().length, m = this.menu;
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(code)) audio.sfx('blip');
      if (n && (code === 'ArrowUp' || code === 'KeyW')) m.sel = (m.sel + n - 1) % n;
      if (n && (code === 'ArrowDown' || code === 'KeyS')) m.sel = (m.sel + 1) % n;
      const row = m.type === 'party' ? this.partyRows()[m.sel] : null;
      if (row && (row.act === 'new' || row.act === 'trail') && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) this.cycleTrail(code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1);
      if (code === 'Enter' || code === 'Space' || code === 'KeyE') this.confirmMenu();
      else if (code === 'Escape' || (code === 'KeyP' && m.type === 'party') || (code === 'KeyI' && m.type === 'info')) this.menu = null;
      return;
    }
    if (code === 'KeyO') { audio.sfx('select'); openOnlinePanel(); return; }
    if (code === 'Escape') { this.goHome(); return; }
    if (this.status !== 'live') return;
    if (code === 'KeyP') { audio.sfx('select'); this.menu = { type: 'party', sel: 0 }; return; }
    if (code === 'KeyI') { audio.sfx('select'); this.menu = { type: 'info', sel: 0 }; return; }
    const ei = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
    if (ei >= 0) { this.emote(EMOTES[ei]); return; }
    if (code === 'KeyE' || code === 'Space') { const tg = this.findTarget(); if (tg) this.use(tg.type, tg.code); }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000), now = this.time.now / 1000;
    for (const tt of this.toasts) tt.t -= dt;
    this.toasts = this.toasts.filter((tt) => tt.t > 0);
    if (this.myEmote && (this.myEmote.t -= dt) <= 0) this.myEmote = null;
    for (const c of this.canopies) c.img.x = c.x + Math.round(Math.sin(now * 1.4 + c.phase) * 0.8);

    const p = this.pos, k = this.keys, live = this.status === 'live' && !this.leaving;
    let dx = 0, dy = 0;
    if (!this.menu && live && !onlinePanelOpen()) { if (k.A.isDown || k.LEFT.isDown || vkeys.left) dx--; if (k.D.isDown || k.RIGHT.isDown || vkeys.right) dx++; if (k.W.isDown || k.UP.isDown || vkeys.up) dy--; if (k.S.isDown || k.DOWN.isDown || vkeys.down) dy++; }
    p.moving = dx !== 0 || dy !== 0;
    if (p.moving) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      const run = k.SHIFT.isDown || vkeys.run, speed = run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED, nx = p.x + dx * speed * dt, ny = p.y + dy * speed * dt;
      if (hubCanStand(this.solid, nx, p.y)) p.x = nx;
      if (hubCanStand(this.solid, p.x, ny)) p.y = ny;
      p.x = clamp(p.x, 6, HUB.W * TS - 6); p.y = clamp(p.y, 6, HUB.H * TS - 2);
      p.animT += dt * (run ? 12 : 8); p.frame = Math.floor(p.animT) % 4;
      // walking out through the gap at the bottom goes back to camp
      if (p.y > HUB.H * TS - 6) { this.goHome(); return; }
    } else p.frame = 0;
    this.player.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y).setFrame(miniFrameIndex(p.dir, p.frame));

    if (this.hub) {
      this.hub.update(dt, p);
      for (const o of this.hub.others.values()) {
        const spr = this.sprites.get(o.id);
        if (!spr) continue;
        if (o.moving) o.frame = Math.floor(now * 8) % 4;
        spr.setPosition(Math.round(o.x), Math.round(o.y)).setDepth(o.y).setFrame(miniFrameIndex(o.dir, o.moving ? (o.frame ?? 0) : 0));
      }
    }
  }
}
