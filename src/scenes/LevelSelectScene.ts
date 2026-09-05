import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Css, Depth, Palette } from '../config';
import { LEVELS } from '../levels';
import { Button } from '../ui/Button';
import { makeText } from '../ui/text';
import { StarRating } from '../ui/StarRating';
import { loadSave } from '../save';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';

interface Card {
  c: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  num: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  stars: StarRating;
  lock?: Phaser.GameObjects.Image;
  unlocked: boolean;
}

export class LevelSelectScene extends BaseScene {
  static readonly KEY = 'LevelSelect';
  private title!: Phaser.GameObjects.Text;
  private backBtn!: Button;
  private cards: Card[] = [];
  private totalText!: Phaser.GameObjects.Text;

  constructor() {
    super(LevelSelectScene.KEY);
  }

  create(): void {
    this.initBase();
    this.addBackground(true);
    music.play('menu');
    this.cards = [];

    this.title = makeText(this, 0, 0, 'Choose a level', { size: 36, shadow: true }).setDepth(
      Depth.HUD,
    );
    this.backBtn = new Button(this, 0, 0, {
      width: 52,
      height: 52,
      icon: 'icon-home',
      variant: 'secondary',
      onClick: () => {
        sfx.uiBack();
        this.fadeTo('Menu');
      },
    }).setDepth(Depth.HUD);

    const save = loadSave();
    const totalStars = Object.values(save.levels).reduce((a, r) => a + r.stars, 0);
    this.totalText = makeText(this, 0, 0, `${totalStars} / ${LEVELS.length * 3} stars`, {
      size: 15,
      color: Css.gold,
      font: 'body',
    }).setDepth(Depth.HUD);

    LEVELS.forEach((lvl, i) => {
      const unlocked = i < save.unlocked;
      const result = save.levels[i];
      const c = this.add.container(0, 0).setDepth(Depth.HUD);
      const bg = this.add.graphics();
      const num = makeText(this, 0, 0, String(lvl.id), {
        size: 40,
        color: unlocked ? Css.gold : Css.muted,
        shadow: true,
      });
      const name = makeText(this, 0, 0, lvl.name, {
        size: 20,
        origin: [0, 0.5],
        color: unlocked ? Css.cream : Css.muted,
      });
      const meta = makeText(
        this,
        0,
        0,
        result
          ? `Best ${result.bestMoves} moves · par ${lvl.par}`
          : unlocked
            ? lvl.subtitle
            : 'Locked',
        {
          size: 13,
          color: Css.muted,
          font: 'body',
          origin: [0, 0.5],
        },
      );
      const stars = new StarRating(this, 0, 0, 22).setStatic(result?.stars ?? 0);
      c.add([bg, num, name, meta, stars]);
      let lock: Phaser.GameObjects.Image | undefined;
      if (!unlocked) {
        lock = this.add.image(0, 0, 'icon-lock').setTint(0x8a7aa8);
        c.add(lock);
        c.setAlpha(0.7);
      }
      const card: Card = { c, bg, num, name, meta, stars, lock, unlocked };
      this.cards.push(card);
      if (unlocked) {
        c.setSize(300, 80);
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => c.setScale(0.97));
        c.on('pointerout', () => c.setScale(1));
        c.on('pointerup', () => {
          c.setScale(1);
          sfx.uiClick();
          this.fadeTo('Game', { levelIndex: i });
        });
      }
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: unlocked ? 1 : 0.7, duration: 300, delay: 80 + i * 70 });
    });

    this.layout();
    this.fadeIn();
  }

  protected layout(): void {
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const top = 44 * ui;
    this.title.setFontSize(Math.round(32 * ui)).setPosition(W / 2, top);
    this.totalText.setFontSize(Math.round(14 * ui)).setPosition(W / 2, top + 32 * ui);
    this.backBtn.setScale(ui).setPosition(16 * ui + 26 * ui, top);

    const cardW = Math.min(W - 32 * ui, 440 * ui);
    const cardH = 84 * ui;
    const gap = 12 * ui;
    const listTop = top + 64 * ui;
    const avail = H - listTop - 16 * ui;
    const needed = this.cards.length * (cardH + gap);
    const scale = needed > avail ? avail / needed : 1;
    const ch = cardH * scale;
    const cg = gap * scale;

    this.cards.forEach((card, i) => {
      const y = listTop + i * (ch + cg) + ch / 2;
      card.c.setPosition(W / 2, y);
      card.c.setSize(cardW, ch);
      if (card.c.input) {
        const hit = card.c.input.hitArea as Phaser.Geom.Rectangle;
        hit.setTo(0, 0, cardW, ch);
      }
      const g = card.bg;
      g.clear();
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-cardW / 2 + 3, -ch / 2 + 6, cardW, ch, 18 * ui);
      g.fillStyle(card.unlocked ? 0x3a2a55 : 0x241838, 1);
      g.fillRoundedRect(-cardW / 2, -ch / 2, cardW, ch, 18 * ui);
      g.fillStyle(0xffffff, 0.05);
      g.fillRoundedRect(-cardW / 2 + 4, -ch / 2 + 4, cardW - 8, ch * 0.4, 14 * ui);
      g.lineStyle(2, card.unlocked ? Palette.violet : 0x4a3670, 0.7);
      g.strokeRoundedRect(-cardW / 2, -ch / 2, cardW, ch, 18 * ui);
      // number badge
      g.fillStyle(card.unlocked ? Palette.violetDark : 0x1a1027, 1);
      g.fillCircle(-cardW / 2 + ch / 2, 0, ch * 0.34);

      card.num.setFontSize(Math.round(30 * ui * scale)).setPosition(-cardW / 2 + ch / 2, 0);
      card.name
        .setFontSize(Math.round(19 * ui * scale))
        .setPosition(-cardW / 2 + ch + 4 * ui, -ch * 0.18);
      card.meta
        .setFontSize(Math.round(12 * ui * scale))
        .setPosition(-cardW / 2 + ch + 4 * ui, ch * 0.2);
      card.stars.setScale(ui * scale).setPosition(cardW / 2 - 52 * ui * scale, 0);
      card.lock
        ?.setDisplaySize(30 * ui * scale, 30 * ui * scale)
        .setPosition(cardW / 2 - 52 * ui * scale, 0);
      if (card.lock) card.stars.setVisible(false);
    });
  }
}
