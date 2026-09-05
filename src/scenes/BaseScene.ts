import Phaser from 'phaser';
import { Depth, DPR, Palette, px } from '../config';
import { audio } from '../audio/engine';

/**
 * Shared behaviour for all scenes: responsive layout hooks, background,
 * audio unlock on first interaction and helpers for UI scaling.
 */
export abstract class BaseScene extends Phaser.Scene {
  protected bgGraphics?: Phaser.GameObjects.Graphics;
  protected vignette?: Phaser.GameObjects.Image;
  protected dust?: Phaser.GameObjects.Particles.ParticleEmitter;

  get W(): number {
    return this.scale.width;
  }

  get H(): number {
    return this.scale.height;
  }

  get isPortrait(): boolean {
    return this.H >= this.W;
  }

  /**
   * UI scale factor relative to a ~420 CSS-px wide phone, clamped for desktop,
   * and multiplied by DPR because the canvas renders at device resolution.
   */
  get ui(): number {
    const base = Math.min(this.W, this.H) / DPR / 420;
    return Phaser.Math.Clamp(base, 0.75, 1.35) * DPR;
  }

  /** Subclasses arrange their objects here; called on create and every resize. */
  protected abstract layout(): void;

  protected initBase(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
    // Any interaction unlocks audio.
    this.input.once('pointerdown', () => void audio.unlock());
    this.input.keyboard?.once('keydown', () => void audio.unlock());
  }

  private onResize(): void {
    this.cameras.resize(this.W, this.H);
    this.layoutBackground();
    this.layout();
  }

  /** Gradient backdrop, floating dust and a vignette. */
  protected addBackground(withDust = true): void {
    this.bgGraphics = this.add.graphics().setDepth(Depth.Background);
    this.vignette = this.add.image(0, 0, 'vignette').setDepth(Depth.Vignette).setAlpha(0.9);
    if (withDust) {
      this.dust = this.add.particles(0, 0, 'p-dot', {
        x: { min: 0, max: this.W },
        y: { min: 0, max: this.H },
        lifespan: { min: 6000, max: 11000 },
        speedY: { min: px(-12), max: px(-4) },
        speedX: { min: px(-6), max: px(6) },
        scale: { start: 0.05 * DPR, end: 0.16 * DPR },
        alpha: { start: 0, end: 0.35, ease: 'Sine.easeInOut' },
        tint: [Palette.violetLight, Palette.cream, Palette.teal],
        quantity: 1,
        frequency: 420,
        blendMode: Phaser.BlendModes.ADD,
      });
      this.dust.setDepth(Depth.Background + 1);
    }
    this.layoutBackground();
  }

  protected layoutBackground(): void {
    if (this.bgGraphics) {
      const g = this.bgGraphics;
      g.clear();
      g.fillGradientStyle(Palette.bgMid, Palette.bgMid, Palette.bgDeep, Palette.bgDeep, 1);
      g.fillRect(0, 0, this.W, this.H);
      // Soft radial highlight behind content.
      g.fillStyle(Palette.violet, 0.08);
      g.fillCircle(this.W * 0.5, this.H * 0.35, Math.max(this.W, this.H) * 0.35);
    }
    if (this.vignette) {
      this.vignette.setPosition(this.W / 2, this.H / 2);
      this.vignette.setDisplaySize(this.W * 1.05, this.H * 1.05);
    }
    if (this.dust) {
      this.dust.updateConfig({ x: { min: 0, max: this.W }, y: { min: 0, max: this.H } });
    }
  }

  protected fadeIn(duration = 350): void {
    this.cameras.main.fadeIn(duration, 26, 16, 39);
  }

  protected fadeTo(key: string, data?: object, duration = 300): void {
    this.cameras.main.fadeOut(duration, 26, 16, 39);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key, data);
    });
  }
}
