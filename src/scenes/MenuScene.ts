import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Css, Depth, Palette, px } from '../config';
import { Tex } from '../art/atlas';
import { Button } from '../ui/Button';
import { makeText } from '../ui/text';
import { drawPanel } from '../ui/Panel';
import { audio } from '../audio/engine';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { loadSave } from '../save';
import { TOTAL_LEVELS } from '../levels';

export class MenuScene extends BaseScene {
  static readonly KEY = 'Menu';

  private title!: Phaser.GameObjects.Text;
  private tagline!: Phaser.GameObjects.Text;
  private pug!: Phaser.GameObjects.Container;
  private pugImg!: Phaser.GameObjects.Image;
  private pugGlow!: Phaser.GameObjects.Image;
  private playBtn!: Button;
  private levelsBtn!: Button;
  private helpBtn!: Button;
  private musicBtn!: Button;
  private sfxBtn!: Button;
  private footer!: Phaser.GameObjects.Text;
  private tapGate!: Phaser.GameObjects.Container;
  private tapText!: Phaser.GameObjects.Text;
  private helpC!: Phaser.GameObjects.Container;
  private helpPanel!: Phaser.GameObjects.Graphics;
  private helpTitle!: Phaser.GameObjects.Text;
  private helpBody!: Phaser.GameObjects.Text;
  private helpClose!: Button;
  private helpDim!: Phaser.GameObjects.Rectangle;
  private gateOpen = false;
  private blinkTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super(MenuScene.KEY);
  }

  create(): void {
    this.initBase();
    this.addBackground(true);

    this.title = makeText(this, 0, 0, 'Violet', {
      size: 84,
      color: Css.cream,
      shadow: true,
      stroke: '#5a2ea0',
      strokeThickness: 8,
    }).setDepth(Depth.HUD);
    this.tagline = makeText(this, 0, 0, 'A pug-sized puzzle adventure', {
      size: 18,
      color: Css.violetLight,
      font: 'body',
    }).setDepth(Depth.HUD);

    this.pug = this.add.container(0, 0).setDepth(Depth.Pug);
    this.pugGlow = this.add
      .image(0, 20, 'glow')
      .setTint(Palette.violet)
      .setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.pugImg = this.add.image(0, 0, Tex.pugDown);
    this.pug.add([this.pugGlow, this.pugImg]);
    this.pug.setSize(200, 200).setInteractive({ useHandCursor: true });
    this.pug.on('pointerdown', () => this.pokePug());

    const save = loadSave();
    const cont = save.unlocked > 1;
    this.playBtn = new Button(this, 0, 0, {
      width: 280,
      height: 64,
      label: cont ? 'Continue' : 'Play',
      icon: 'icon-play',
      variant: 'primary',
      fontSize: 26,
      onClick: () => {
        const idx = Math.min(save.unlocked - 1, TOTAL_LEVELS - 1);
        this.fadeTo('Game', { levelIndex: idx });
      },
    }).setDepth(Depth.HUD);
    this.levelsBtn = new Button(this, 0, 0, {
      width: 280,
      height: 56,
      label: 'Level select',
      icon: 'icon-grid',
      variant: 'secondary',
      onClick: () => this.fadeTo('LevelSelect'),
    }).setDepth(Depth.HUD);
    this.helpBtn = new Button(this, 0, 0, {
      width: 280,
      height: 56,
      label: 'How to play',
      icon: 'paw',
      variant: 'ghost',
      onClick: () => this.showHelp(true),
    }).setDepth(Depth.HUD);
    this.musicBtn = new Button(this, 0, 0, {
      width: 56,
      height: 56,
      icon: audio.musicOn ? 'icon-music-on' : 'icon-music-off',
      variant: 'ghost',
      onClick: () => {
        audio.setMusicOn(!audio.musicOn);
        this.musicBtn.setIcon(audio.musicOn ? 'icon-music-on' : 'icon-music-off');
      },
    }).setDepth(Depth.HUD);
    this.sfxBtn = new Button(this, 0, 0, {
      width: 56,
      height: 56,
      icon: audio.sfxOn ? 'icon-sfx-on' : 'icon-sfx-off',
      variant: 'ghost',
      onClick: () => {
        audio.setSfxOn(!audio.sfxOn);
        this.sfxBtn.setIcon(audio.sfxOn ? 'icon-sfx-on' : 'icon-sfx-off');
      },
    }).setDepth(Depth.HUD);
    this.footer = makeText(this, 0, 0, 'Swipe or use the D-pad · Arrow keys / WASD on desktop', {
      size: 12,
      color: Css.muted,
      font: 'body',
    })
      .setDepth(Depth.HUD)
      .setAlign('center')
      .setOrigin(0.5, 1);

    this.buildHelp();
    this.buildTapGate();

    this.layout();
    this.fadeIn();
    this.startIdleAnimations();
  }

  private buildTapGate(): void {
    this.tapGate = this.add.container(0, 0).setDepth(Depth.Overlay + 10);
    const dim = this.add.rectangle(0, 0, 10, 10, 0x0a0512, 0.55).setOrigin(0).setInteractive();
    this.tapText = makeText(this, 0, 0, 'Tap to start', {
      size: 30,
      shadow: true,
      color: Css.cream,
    });
    this.tapGate.add([dim, this.tapText]);
    this.tapGate.setData('dim', dim);
    this.tweens.add({
      targets: this.tapText,
      alpha: { from: 1, to: 0.45 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    const open = (): void => {
      if (this.gateOpen) return;
      this.gateOpen = true;
      void audio.unlock().then(() => {
        music.play('menu');
        sfx.bark();
      });
      this.tweens.add({
        targets: this.tapGate,
        alpha: 0,
        duration: 250,
        onComplete: () => this.tapGate.destroy(),
      });
      this.footer.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.footer, alpha: 1, duration: 400, delay: 200 });
      this.tweens.add({
        targets: this.pug,
        scaleX: { from: 0.9, to: 1 },
        scaleY: { from: 0.9, to: 1 },
        duration: 300,
        ease: 'Back.easeOut',
      });
    };
    // Any tap/click/key anywhere opens the gate (the dim blocks the buttons underneath).
    dim.once('pointerdown', open);
    this.input.once('pointerdown', open);
    this.input.keyboard?.once('keydown', open);
  }

  private buildHelp(): void {
    this.helpC = this.add.container(0, 0).setDepth(Depth.Overlay).setVisible(false);
    this.helpDim = this.add.rectangle(0, 0, 10, 10, 0x0a0512, 0.75).setOrigin(0).setInteractive();
    this.helpDim.on('pointerdown', () => this.showHelp(false));
    this.helpPanel = this.add.graphics();
    this.helpTitle = makeText(this, 0, 0, 'How to play', { size: 34, shadow: true });
    this.helpBody = makeText(
      this,
      0,
      0,
      [
        'Guide Violet the pug to her cozy bed.',
        '',
        'Swipe, tap the D-pad, or use arrow keys / WASD to move one tile at a time.',
        '',
        'Push crates onto pressure buttons to open gates of the same colour. Crates keep the gate open while you walk through.',
        '',
        'Pick up keys to unlock matching padlocked doors. Each key opens one door.',
        '',
        'Collect bones and finish under par for three stars. Undo (Z) and restart (R) any time.',
      ].join('\n'),
      { size: 15, color: Css.cream, font: 'body', wrap: 300, align: 'left', origin: [0.5, 0] },
    );
    this.helpClose = new Button(this, 0, 0, {
      width: 200,
      height: 54,
      label: 'Got it',
      variant: 'primary',
      onClick: () => this.showHelp(false),
    });
    this.helpC.add([this.helpDim, this.helpPanel, this.helpTitle, this.helpBody, this.helpClose]);
  }

  private showHelp(on: boolean): void {
    this.helpC.setVisible(on);
    if (on) {
      this.helpC.setAlpha(0);
      this.tweens.add({ targets: this.helpC, alpha: 1, duration: 180 });
    }
  }

  protected layout(): void {
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const portrait = this.isPortrait;

    const titleSize = Math.min(96 * ui, W * 0.22);
    this.title.setFontSize(Math.round(titleSize));
    this.tagline.setFontSize(Math.round(17 * ui));

    const pugSize = Phaser.Math.Clamp(Math.min(W, H) * (portrait ? 0.5 : 0.36), px(150), px(320));
    this.pugImg.setDisplaySize(pugSize, pugSize);
    this.pugGlow.setDisplaySize(pugSize * 1.7, pugSize * 1.7);
    this.pug.setSize(pugSize, pugSize);

    const btnScale = Phaser.Math.Clamp(ui, px(0.8), px(1.2));
    [this.playBtn, this.levelsBtn, this.helpBtn, this.musicBtn, this.sfxBtn].forEach((b) =>
      b.setScale(btnScale),
    );

    if (portrait) {
      this.title.setPosition(W / 2, H * 0.14);
      this.tagline.setPosition(W / 2, H * 0.14 + titleSize * 0.62);
      this.pug.setPosition(W / 2, H * 0.42);
      const base = H * 0.62;
      this.playBtn.setPosition(W / 2, base);
      this.levelsBtn.setPosition(W / 2, base + 74 * btnScale);
      this.helpBtn.setPosition(W / 2, base + 142 * btnScale);
      this.musicBtn.setPosition(W / 2 - 38 * btnScale, base + 214 * btnScale);
      this.sfxBtn.setPosition(W / 2 + 38 * btnScale, base + 214 * btnScale);
    } else {
      // Landscape: pug + audio toggles on the left, title + main buttons on the right.
      const leftX = W * 0.28;
      const rightX = W * 0.7;
      const titleY = H * 0.17;
      this.title.setPosition(rightX, titleY);
      this.tagline.setPosition(rightX, titleY + titleSize * 0.62);
      const taglineBottom = titleY + titleSize * 0.62 + 17 * ui;
      // Fit the three stacked buttons between the tagline and the bottom edge.
      const bottomPad = 22 * ui;
      const stackH = 138 * btnScale + 32 * btnScale;
      const room = H - taglineBottom - bottomPad;
      const fitScale = Phaser.Math.Clamp(room / (stackH + 24 * ui), 0.7, 1);
      const bs = btnScale * fitScale;
      [this.playBtn, this.levelsBtn, this.helpBtn].forEach((b) => b.setScale(bs));
      const base = taglineBottom + 24 * ui + 32 * bs;
      this.playBtn.setPosition(rightX, base);
      this.levelsBtn.setPosition(rightX, base + 72 * bs);
      this.helpBtn.setPosition(rightX, base + 138 * bs);

      const pugY = H * 0.42;
      this.pug.setPosition(leftX, pugY);
      const audioY = Math.min(pugY + pugSize / 2 + 44 * btnScale, H - 40 * ui - 26 * btnScale);
      this.musicBtn.setPosition(leftX - 38 * btnScale, audioY);
      this.sfxBtn.setPosition(leftX + 38 * btnScale, audioY);
    }
    this.footer
      .setFontSize(Math.round(12 * ui))
      .setPosition(portrait ? W / 2 : W * 0.28, H - 16 * ui)
      .setWordWrapWidth(portrait ? W - 24 * ui : W * 0.5);

    // Tap gate
    if (this.tapGate?.active) {
      const dim = this.tapGate.getData('dim') as Phaser.GameObjects.Rectangle;
      dim.setSize(W, H);
      this.tapText
        .setFontSize(Math.round(30 * ui))
        .setPosition(W / 2, portrait ? H * 0.86 : H - 30 * ui);
      // The controls hint is redundant behind the gate and would collide with it in landscape.
      this.footer.setVisible(false);
    } else {
      this.footer.setVisible(true);
    }

    // Help overlay
    this.helpDim.setSize(W, H);
    const pw = Math.min(W - px(32), 380 * ui);
    const ph = Math.min(H - px(32), 520 * ui);
    this.helpPanel.setPosition(W / 2, H / 2);
    drawPanel(this.helpPanel, { width: pw, height: ph, radius: 28 * ui });
    this.helpTitle.setFontSize(Math.round(32 * ui)).setPosition(W / 2, H / 2 - ph / 2 + 44 * ui);
    this.helpBody.setFontSize(Math.round(15 * ui));
    this.helpBody.setWordWrapWidth(pw - 56 * ui, true);
    this.helpBody.setPosition(W / 2, H / 2 - ph / 2 + 84 * ui);
    this.helpClose.setScale(ui).setPosition(W / 2, H / 2 + ph / 2 - 48 * ui);
  }

  private startIdleAnimations(): void {
    this.tweens.add({
      targets: this.pugImg,
      y: px(-8),
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.pugGlow,
      alpha: { from: 0.35, to: 0.65 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.title,
      y: `+=${px(6)}`,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const blink = (): void => {
      this.blinkTimer = this.time.delayedCall(2000 + Math.random() * 2500, () => {
        if (this.pugImg.texture.key === Tex.pugDown) {
          const w = this.pugImg.displayWidth;
          this.pugImg.setTexture(Tex.pugBlink).setDisplaySize(w, w);
          this.time.delayedCall(150, () => {
            if (this.pugImg.texture.key === Tex.pugBlink)
              this.pugImg.setTexture(Tex.pugDown).setDisplaySize(w, w);
          });
        }
        blink();
      });
    };
    blink();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.blinkTimer?.remove(false));
  }

  private pokePug(): void {
    void audio.unlock();
    sfx.bark();
    const w = this.pugImg.displayWidth;
    this.pugImg.setTexture(Tex.pugHappy).setDisplaySize(w, w);
    this.tweens.add({
      targets: this.pug,
      scaleX: { from: 1.1, to: 1 },
      scaleY: { from: 0.9, to: 1 },
      duration: 380,
      ease: 'Elastic.easeOut',
    });
    this.time.delayedCall(700, () => {
      if (this.pugImg.texture.key === Tex.pugHappy)
        this.pugImg.setTexture(Tex.pugDown).setDisplaySize(w, w);
    });
  }
}
