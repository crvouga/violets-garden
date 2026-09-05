import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Css, Depth, px } from '../config';
import { TOTAL_LEVELS, LEVELS } from '../levels';
import { Button } from '../ui/Button';
import { makeText } from '../ui/text';
import { drawPanel } from '../ui/Panel';
import { StarRating } from '../ui/StarRating';
import { Tex } from '../art/atlas';
import { sfx } from '../audio/sfx';

export interface LevelCompleteData {
  levelIndex: number;
  moves: number;
  par: number;
  treats: number;
  totalTreats: number;
  stars: number;
}

/** Transparent overlay scene launched on top of the GameScene. */
export class LevelCompleteScene extends BaseScene {
  static readonly KEY = 'LevelComplete';
  private result!: LevelCompleteData;
  private dim!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Graphics;
  private heading!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private stars!: StarRating;
  private statMoves!: Phaser.GameObjects.Text;
  private statTreats!: Phaser.GameObjects.Text;
  private pug!: Phaser.GameObjects.Image;
  private nextBtn!: Button;
  private retryBtn!: Button;
  private levelsBtn!: Button;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super(LevelCompleteScene.KEY);
  }

  init(data: LevelCompleteData): void {
    this.result = data;
  }

  create(): void {
    this.initBase();
    const d = this.result;
    const isLast = d.levelIndex >= TOTAL_LEVELS - 1;

    this.dim = this.add
      .rectangle(0, 0, 10, 10, 0x0a0512, 0)
      .setOrigin(0)
      .setInteractive()
      .setDepth(Depth.Overlay);
    this.tweens.add({ targets: this.dim, fillAlpha: 0.62, duration: 300 });

    this.content = this.add.container(0, 0).setDepth(Depth.OverlayContent);
    this.panel = this.add.graphics();
    this.heading = makeText(this, 0, 0, 'Level complete!', {
      size: 34,
      shadow: true,
      color: Css.cream,
    });
    this.sub = makeText(this, 0, 0, LEVELS[d.levelIndex]?.name ?? '', {
      size: 16,
      color: Css.violetLight,
      font: 'body',
    });
    this.stars = new StarRating(this, 0, 0, 52);
    this.pug = this.add.image(0, 0, Tex.pugHappy);
    this.statMoves = makeText(this, 0, 0, `${d.moves} moves  ·  par ${d.par}`, {
      size: 17,
      color: d.moves <= d.par ? Css.gold : Css.muted,
      font: 'body',
    });
    this.statTreats = makeText(
      this,
      0,
      0,
      d.totalTreats > 0 ? `Bones ${d.treats} / ${d.totalTreats}` : 'No bones on this level',
      {
        size: 17,
        color: d.treats >= d.totalTreats && d.totalTreats > 0 ? Css.gold : Css.muted,
        font: 'body',
      },
    );

    this.nextBtn = new Button(this, 0, 0, {
      width: 260,
      height: 60,
      label: isLast ? 'Finish' : 'Next level',
      icon: 'icon-arrow',
      variant: 'primary',
      fontSize: 24,
      onClick: () => {
        if (isLast) {
          this.closeTo('GameComplete');
        } else {
          this.closeTo('Game', { levelIndex: d.levelIndex + 1 });
        }
      },
    });
    this.retryBtn = new Button(this, 0, 0, {
      width: 124,
      height: 52,
      label: 'Retry',
      icon: 'icon-restart',
      variant: 'secondary',
      fontSize: 18,
      onClick: () => this.closeTo('Game', { levelIndex: d.levelIndex }),
    });
    this.levelsBtn = new Button(this, 0, 0, {
      width: 124,
      height: 52,
      label: 'Levels',
      icon: 'icon-grid',
      variant: 'secondary',
      fontSize: 18,
      onClick: () => this.closeTo('LevelSelect'),
    });
    this.content.add([
      this.panel,
      this.heading,
      this.sub,
      this.pug,
      this.stars,
      this.statMoves,
      this.statTreats,
      this.nextBtn,
      this.retryBtn,
      this.levelsBtn,
    ]);

    this.layout();
    this.content.setAlpha(0).setScale(0.92);
    this.tweens.add({
      targets: this.content,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: 'Back.easeOut',
    });
    this.stars.reveal(d.stars, 500, 400, true);

    this.tweens.add({
      targets: this.pug,
      angle: { from: -6, to: 6 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.input.keyboard?.on(
      'keydown-ENTER',
      () => this.nextBtn.emit('pointerdown') && this.nextBtn.emit('pointerup'),
    );
    this.input.keyboard?.on(
      'keydown-SPACE',
      () => this.nextBtn.emit('pointerdown') && this.nextBtn.emit('pointerup'),
    );
  }

  private closeTo(key: string, data?: object): void {
    sfx.uiClick();
    const game = this.scene.get('Game');
    this.cameras.main.fadeOut(260, 26, 16, 39);
    game.cameras.main.fadeOut(260, 26, 16, 39);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('Game');
      this.scene.start(key, data);
    });
  }

  protected layout(): void {
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    this.dim.setSize(W, H);
    const pw = Math.min(W - px(28), 380 * ui);
    const ph = Math.min(H - px(28), 520 * ui);
    const cx = W / 2;
    const cy = H / 2;
    this.content.setPosition(cx, cy);
    drawPanel(this.panel, { width: pw, height: ph, radius: 30 * ui });
    const top = -ph / 2;
    this.heading
      .setFontSize(Math.round(Math.min(34 * ui, pw * 0.09)))
      .setPosition(0, top + 44 * ui);
    this.sub.setFontSize(Math.round(15 * ui)).setPosition(0, top + 76 * ui);
    const pugSize = Math.min(140 * ui, ph * 0.26);
    this.pug.setDisplaySize(pugSize, pugSize).setPosition(0, top + 96 * ui + pugSize / 2);
    this.stars.setScale(ui).setPosition(0, top + 112 * ui + pugSize + 26 * ui);
    this.statMoves
      .setFontSize(Math.round(16 * ui))
      .setPosition(0, top + 112 * ui + pugSize + 76 * ui);
    this.statTreats
      .setFontSize(Math.round(16 * ui))
      .setPosition(0, top + 112 * ui + pugSize + 100 * ui);
    const bottom = ph / 2;
    this.nextBtn.setScale(ui).setPosition(0, bottom - 108 * ui);
    this.retryBtn.setScale(ui).setPosition(-68 * ui, bottom - 46 * ui);
    this.levelsBtn.setScale(ui).setPosition(68 * ui, bottom - 46 * ui);
  }
}
