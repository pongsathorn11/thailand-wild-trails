import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HikeScene } from './scenes/HikeScene';
import { HudScene } from './scenes/HudScene';
import { PackScene } from './scenes/PackScene';
import { CampScene } from './scenes/CampScene';
import { CampHudScene } from './scenes/CampHudScene';
import { TitleScene } from './scenes/TitleScene';
import { SystemScene } from './scenes/SystemScene';
import { audio } from './audio/audio';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#16241c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [BootScene, TitleScene, CampScene, CampHudScene, PackScene, HikeScene, HudScene, SystemScene],
});

// handy in the browser console while developing: __game.scene.getScene('hike')
if (import.meta.env.DEV) Object.assign(window, { __game: game, __audio: audio });
