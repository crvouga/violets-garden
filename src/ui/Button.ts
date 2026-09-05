import Phaser from 'phaser';
import { Css, MIN_TOUCH, Palette } from '../config';
import { sfx } from '../audio/sfx';
import { makeText } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonOpts {
  width: number;
  height: number;
  label?: string;
  icon?: string;
  iconScale?: number;
  variant?: ButtonVariant;
  fontSize?: number;
  onClick?: () => void;
  silent?: boolean;
  radius?: number;
}

const VARIANTS: Record<
  ButtonVariant,
  { fill: number; fillDark: number; text: string; border: number }
> = {
  primary: {
    fill: Palette.violet,
    fillDark: Palette.violetDark,
    text: Css.cream,
    border: 0xd8bfff,
  },
  secondary: { fill: 0x3a2a55, fillDark: 0x241838, text: Css.cream, border: 0x6b4fa0 },
  ghost: { fill: 0x2a1b45, fillDark: 0x1a1027, text: Css.violetLight, border: 0x4a3670 },
  danger: { fill: 0xb33d58, fillDark: 0x7a2238, text: Css.cream, border: 0xff9ab0 },
};

/** Rounded, touch-friendly button with press feedback. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelText?: Phaser.GameObjects.Text;
  private readonly iconImg?: Phaser.GameObjects.Image;
  private readonly opts: ButtonOpts;
  private enabled = true;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    const w = Math.max(opts.width, MIN_TOUCH);
    const h = Math.max(opts.height, MIN_TOUCH);
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.setSize(w, h);
    this.draw(false);

    if (opts.icon) {
      this.iconImg = scene.add.image(opts.label ? -w / 2 + h * 0.55 : 0, 0, opts.icon);
      const target = h * (opts.iconScale ?? 0.55);
      this.iconImg.setDisplaySize(target, target);
      this.add(this.iconImg);
    }
    if (opts.label) {
      const v = VARIANTS[opts.variant ?? 'primary'];
      this.labelText = makeText(scene, opts.icon ? h * 0.3 : 0, 0, opts.label, {
        size: opts.fontSize ?? Math.min(h * 0.42, 30),
        color: v.text,
        shadow: true,
      });
      this.add(this.labelText);
    }

    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', this.onDown, this);
    this.on('pointerup', this.onUp, this);
    this.on('pointerout', this.onOut, this);
    this.on('pointerover', this.onOver, this);
    scene.add.existing(this);
  }

  private draw(down: boolean): void {
    const { width: w, height: h } = this;
    const v = VARIANTS[this.opts.variant ?? 'primary'];
    const r = this.opts.radius ?? Math.min(h / 2, 22);
    const g = this.bg;
    g.clear();
    const lift = down ? 2 : 6;
    // Drop shadow / darker base.
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2, -h / 2 + lift + 3, w, h, r);
    g.fillStyle(v.fillDark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    // Face.
    g.fillStyle(v.fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (down ? 4 : 0), w, h, r);
    // Gloss.
    g.fillStyle(0xffffff, down ? 0.06 : 0.14);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + (down ? 6 : 2), w - 8, h * 0.42, r * 0.9);
    // Border.
    g.lineStyle(2, v.border, 0.55);
    g.strokeRoundedRect(-w / 2, -h / 2 + (down ? 4 : 0), w, h, r);
  }

  private onDown(): void {
    if (!this.enabled) return;
    this.pressed = true;
    this.draw(true);
    this.scene.tweens.add({ targets: this, scaleX: 0.96, scaleY: 0.96, duration: 60 });
  }

  private onUp(): void {
    if (!this.enabled) return;
    const wasPressed = this.pressed;
    this.pressed = false;
    this.draw(false);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 120,
      ease: 'Back.easeOut',
    });
    if (wasPressed) {
      if (!this.opts.silent) sfx.uiClick();
      this.opts.onClick?.();
    }
  }

  private onOut(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.draw(false);
    this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 120 });
  }

  private onOver(): void {
    if (!this.enabled) return;
    this.scene.tweens.add({ targets: this, scaleX: 1.03, scaleY: 1.03, duration: 100 });
    this.once('pointerout', () => {
      if (this.scene) this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 100 });
    });
  }

  setLabel(text: string): this {
    this.labelText?.setText(text);
    return this;
  }

  setIcon(key: string): this {
    this.iconImg?.setTexture(key);
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.45);
    if (on) this.setInteractive({ useHandCursor: true });
    else this.disableInteractive();
    return this;
  }
}
