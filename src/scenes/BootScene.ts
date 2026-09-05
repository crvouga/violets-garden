import Phaser from 'phaser';
import { buildArt, queueArt } from '../art/atlas';
import { Css, Palette, px } from '../config';

/** Loads vector art, builds procedural textures and hands off to the menu. */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'Boot';
  private bar?: Phaser.GameObjects.Graphics;

  constructor() {
    super(BootScene.KEY);
  }

  preload(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor(Palette.bgDeep);
    const label = this.add
      .text(W / 2, H / 2 - px(30), 'Violet', {
        fontFamily: "'Fredoka', system-ui, sans-serif",
        fontSize: `${Math.round(px(42))}px`,
        color: Css.violetLight,
      })
      .setOrigin(0.5);
    label.setAlpha(0);
    this.tweens.add({ targets: label, alpha: 1, duration: 300 });
    this.bar = this.add.graphics();
    const drawBar = (p: number): void => {
      const g = this.bar!;
      g.clear();
      const w = Math.min(px(260), W * 0.6);
      g.fillStyle(0x3a2a55, 1);
      g.fillRoundedRect(W / 2 - w / 2, H / 2 + px(20), w, px(10), px(5));
      g.fillStyle(Palette.violet, 1);
      g.fillRoundedRect(W / 2 - w / 2, H / 2 + px(20), Math.max(px(10), w * p), px(10), px(5));
    };
    drawBar(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, drawBar);
    queueArt(this);
  }

  create(): void {
    buildArt(this);
    // Give web fonts a moment to be ready so text measures correctly.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const go = (): void => {
      this.scene.start('Menu');
    };
    if (fonts?.ready) {
      void Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(go);
    } else {
      go();
    }
  }
}
