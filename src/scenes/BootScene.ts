import Phaser from 'phaser';
import { buildTreeSprites, paintMiniSheet, makeCanvas, MINI } from '../gfx/paint';
import { buildProps, type PropArt } from '../gfx/props';
import { buildTrailArt, fallsFrames, birdFrames, deerFrames } from '../gfx/trailArt';
import { buildCampArt, campfireFrames } from '../gfx/campArt';
import { buildHubArt } from '../gfx/hubArt';
import { loadProfile, type Profile } from '../core/profile';
import { cloud } from '../net/cloud';
import { initAuthPage } from '../ui/authPage';
import { installMiniSheet } from '../gfx/sheets';
import { resolveLook, GUIDE_LOOK } from '../data/looks';
import { setLang } from '../i18n';
import { TRAILS, trailById } from '../data/trails';

/** Builds every code-drawn texture once, loads the profile, then starts the hike. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  async create(): Promise<void> {
    const profile = loadProfile();
    setLang(profile.lang);
    this.registry.set('profile', profile);

    const trees = buildTreeSprites();
    (['broad', 'pine'] as const).forEach((type) => trees[type].forEach((s, v) => {
      this.textures.addCanvas(`tree-${type}-${v}-trunk`, s.trunk);
      this.textures.addCanvas(`tree-${type}-${v}-canopy`, s.canopy);
    }));
    const anchors: Record<string, [number, number]> = {};
    for (const [key, art] of Object.entries({ ...buildProps(), ...buildTrailArt(), ...buildCampArt(), ...buildHubArt() })) {
      this.textures.addCanvas(`prop-${key}`, art.canvas); anchors[key] = [art.ax, art.ay];
    }
    for (const [key, frames] of Object.entries({ campfire: campfireFrames(), falls: fallsFrames(), 'bird-sunbird': birdFrames('sunbird'), 'bird-hornbill': birdFrames('hornbill'), deer: deerFrames() })) {
      this.addStrip(key, frames); anchors[key] = [frames[0].ax, frames[0].ay];
    }
    this.registry.set('propAnchors', anchors);
    this.anims.create({ key: 'falls-flow', frames: this.anims.generateFrameNumbers('falls', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'fire-flicker', frames: this.anims.generateFrameNumbers('campfire', { frames: [0, 1, 2, 1] }), frameRate: 7, repeat: -1 });

    this.addSheet('hiker', paintMiniSheet(resolveLook(profile.body, profile.looks[profile.body])));
    this.addSheet('guide', paintMiniSheet(GUIDE_LOOK));

    try { await Promise.all([document.fonts.load('16px Mitr'), document.fonts.load('700 16px "Pixelify Sans"')]); } catch { /* fallback font is fine */ }

    // ?trail=<id> picks a trail directly while camp and the trail picker are being ported
    const q = new URLSearchParams(location.search).get('trail');
    const trail = (q && trailById(q)) || (profile.lastTrail && trailById(profile.lastTrail)) || TRAILS[0];
    // ?trail=<id> jumps straight to packing for that trail (handy while testing); otherwise the title screen
    // cloud save: restores a session if there is one; a cloud save that got further replaces this one
    initAuthPage();
    void cloud.start(() => this.registry.get('profile') as Profile, (p) => {
      this.registry.set('profile', p);
      setLang(p.lang);
      installMiniSheet(this.textures, 'hiker', resolveLook(p.body, p.looks[p.body]));
      if (this.scene.isActive('title')) this.scene.get('title').scene.restart();
    });

    this.scene.launch('system');
    this.scene.start(q ? 'pack' : 'title', { trailId: trail.id });
  }

  /** Lays equal-size frames side by side in one texture. */
  private addStrip(key: string, frames: PropArt[]): void {
    const { width: w, height: h } = frames[0].canvas, strip = makeCanvas(w * frames.length, h), c = strip.getContext('2d')!;
    frames.forEach((f, i) => c.drawImage(f.canvas, i * w, 0));
    const tex = this.textures.addCanvas(key, strip)!;
    frames.forEach((_, i) => tex.add(i, 0, i * w, 0, w, h));
  }

  private addSheet(key: string, canvas: HTMLCanvasElement): void {
    const tex = this.textures.addCanvas(key, canvas)!;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) tex.add(row * 5 + col, 0, col * MINI.W, row * MINI.H, MINI.W, MINI.H);
  }
}
