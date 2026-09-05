import Phaser from 'phaser';
import { Palette } from '../config';
import { sfx } from '../audio/sfx';

/** Three stars that can be revealed one by one with a pop animation. */
export class StarRating extends Phaser.GameObjects.Container {
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly size: number;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number) {
    super(scene, x, y);
    this.size = size;
    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * size * 1.15;
      const sy = i === 1 ? -size * 0.18 : 0;
      const img = scene.add.image(sx, sy, 'star').setDisplaySize(size, size).setTint(0x3a2a55);
      img.setAlpha(0.6);
      this.stars.push(img);
      this.add(img);
    }
    scene.add.existing(this);
  }

  /** Show `count` stars instantly (used for level select cards). */
  setStatic(count: number): this {
    this.stars.forEach((s, i) => {
      const on = i < count;
      s.setTint(on ? Palette.gold : 0x3a2a55).setAlpha(on ? 1 : 0.5);
    });
    return this;
  }

  /** Animate stars popping in. Returns total duration in ms. */
  reveal(count: number, startDelay = 300, gap = 380, withSound = true): number {
    this.stars.forEach((s, i) => {
      if (i >= count) return;
      s.setScale(0);
      this.scene.time.delayedCall(startDelay + i * gap, () => {
        if (!this.scene) return;
        s.setTint(Palette.gold).setAlpha(1);
        const target = this.size / s.width;
        this.scene.tweens.add({
          targets: s,
          scaleX: { from: 0, to: target },
          scaleY: { from: 0, to: target },
          angle: { from: -30, to: 0 },
          duration: 420,
          ease: 'Back.easeOut',
        });
        const glow = this.scene.add
          .image(this.x + s.x * this.scaleX, this.y + s.y * this.scaleY, 'glow')
          .setDisplaySize(this.size * 2.6, this.size * 2.6)
          .setTint(Palette.gold)
          .setAlpha(0.8)
          .setDepth(this.depth + 1)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({
          targets: glow,
          alpha: 0,
          scale: glow.scale * 1.5,
          duration: 500,
          onComplete: () => glow.destroy(),
        });
        if (withSound) sfx.star(i);
      });
    });
    return startDelay + Math.max(0, count - 1) * gap + 420;
  }
}
