import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Css, Depth, DPR, Palette, px } from '../config';
import { LEVELS } from '../levels';
import { Button } from '../ui/Button';
import { makeText } from '../ui/text';
import { Tex } from '../art/atlas';
import { loadSave } from '../save';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';

/** Final celebration after the last level. */
export class GameCompleteScene extends BaseScene {
  static readonly KEY = 'GameComplete';
  private heading!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private pug!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private againBtn!: Button;
  private menuBtn!: Button;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bones: Phaser.GameObjects.Image[] = [];

  constructor() {
    super(GameCompleteScene.KEY);
  }

  create(): void {
    this.initBase();
    this.addBackground(true);
    music.play('menu');
    this.time.delayedCall(300, () => sfx.win());
    this.time.delayedCall(1400, () => sfx.bark());

    const save = loadSave();
    const totalStars = Object.values(save.levels).reduce((a, r) => a + r.stars, 0);
    const totalMoves = Object.values(save.levels).reduce((a, r) => a + r.bestMoves, 0);

    this.glow = this.add
      .image(0, 0, 'glow')
      .setTint(Palette.gold)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.Item);
    this.pug = this.add.image(0, 0, Tex.pugHappy).setDepth(Depth.Pug);
    this.heading = makeText(this, 0, 0, 'Good girl, Violet!', {
      size: 44,
      shadow: true,
      stroke: '#5a2ea0',
      strokeThickness: 6,
    }).setDepth(Depth.HUD);
    this.body = makeText(
      this,
      0,
      0,
      'Every gate opened, every bed reached.\nThe garden is quiet and the pug is snoring.',
      {
        size: 16,
        color: Css.violetLight,
        font: 'body',
      },
    ).setDepth(Depth.HUD);
    this.stats = makeText(
      this,
      0,
      0,
      `${totalStars} / ${LEVELS.length * 3} stars  ·  ${totalMoves} best moves total`,
      {
        size: 16,
        color: Css.gold,
        font: 'body',
      },
    ).setDepth(Depth.HUD);

    this.againBtn = new Button(this, 0, 0, {
      width: 260,
      height: 60,
      label: 'Play again',
      icon: 'icon-restart',
      variant: 'primary',
      onClick: () => this.fadeTo('Game', { levelIndex: 0 }),
    }).setDepth(Depth.HUD);
    this.menuBtn = new Button(this, 0, 0, {
      width: 260,
      height: 54,
      label: 'Main menu',
      icon: 'icon-home',
      variant: 'secondary',
      onClick: () => this.fadeTo('Menu'),
    }).setDepth(Depth.HUD);

    this.confetti = this.add.particles(0, 0, 'p-confetti', {
      x: { min: 0, max: this.W },
      y: px(-20),
      speedY: { min: px(60), max: px(160) },
      speedX: { min: px(-40), max: px(40) },
      lifespan: 7000,
      scale: { min: 0.7 * DPR, max: 1.3 * DPR },
      rotate: { start: 0, end: 720 },
      tint: [Palette.gold, Palette.rose, Palette.teal, Palette.violetLight, 0xffffff],
      frequency: 90,
      quantity: 1,
    });
    this.confetti.setDepth(Depth.ParticlesHigh);

    for (let i = 0; i < 6; i++) {
      const b = this.add.image(0, 0, Tex.bone).setAlpha(0.7).setDepth(Depth.Item);
      this.bones.push(b);
    }

    this.layout();
    this.fadeIn(500);

    this.tweens.add({
      targets: this.pug,
      y: `-=${px(12)}`,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.pug,
      angle: { from: -5, to: 5 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.glow,
      alpha: { from: 0.35, to: 0.7 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });
    this.bones.forEach((b, i) => {
      this.tweens.add({
        targets: b,
        y: `-=${px(18)}`,
        angle: { from: -15, to: 15 },
        duration: 1400 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 150,
      });
    });
  }

  protected layout(): void {
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const pugSize = Phaser.Math.Clamp(Math.min(W, H) * 0.42, px(140), px(300));
    this.pug.setDisplaySize(pugSize, pugSize).setPosition(W / 2, H * 0.36);
    this.glow.setDisplaySize(pugSize * 2, pugSize * 2).setPosition(W / 2, H * 0.36);
    this.heading
      .setFontSize(Math.round(Math.min(44 * ui, W * 0.1)))
      .setPosition(W / 2, H * 0.36 + pugSize / 2 + 40 * ui);
    this.body.setFontSize(Math.round(15 * ui)).setPosition(W / 2, H * 0.36 + pugSize / 2 + 92 * ui);
    this.stats
      .setFontSize(Math.round(15 * ui))
      .setPosition(W / 2, H * 0.36 + pugSize / 2 + 136 * ui);
    const btnScale = Phaser.Math.Clamp(ui, px(0.8), px(1.2));
    this.againBtn.setScale(btnScale).setPosition(W / 2, H - 150 * btnScale);
    this.menuBtn.setScale(btnScale).setPosition(W / 2, H - 84 * btnScale);
    this.confetti.updateConfig({ x: { min: 0, max: W } });
    this.bones.forEach((b, i) => {
      const a = (i / this.bones.length) * Math.PI * 2;
      const r = pugSize * 0.75;
      b.setDisplaySize(36 * ui, 36 * ui).setPosition(
        W / 2 + Math.cos(a) * r,
        H * 0.36 + Math.sin(a) * r * 0.8,
      );
    });
  }
}
