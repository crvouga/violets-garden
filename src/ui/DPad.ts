import Phaser from 'phaser';
import type { Dir } from '../logic/board';

/**
 * On-screen directional pad for touch play.
 * Emits 'press' (dir) when a pad is touched and 'release' when let go.
 * `heldDir` exposes the currently held direction for hold-to-move.
 */
export class DPad extends Phaser.GameObjects.Container {
  heldDir: Dir | null = null;
  private readonly pads = new Map<Dir, Phaser.GameObjects.Container>();
  private readonly size: number;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number) {
    super(scene, x, y);
    this.size = size;
    const gap = size * 1.08;
    const layout: Array<[Dir, number, number, number]> = [
      ['up', 0, -gap, 0],
      ['down', 0, gap, 180],
      ['left', -gap, 0, -90],
      ['right', gap, 0, 90],
    ];
    // Center hub.
    const hub = scene.add.graphics();
    hub.fillStyle(0x1a1027, 0.55);
    hub.fillCircle(0, 0, size * 0.42);
    hub.lineStyle(2, 0x6b4fa0, 0.5);
    hub.strokeCircle(0, 0, size * 0.42);
    this.add(hub);

    for (const [dir, px, py, angle] of layout) {
      const pad = this.makePad(dir, angle);
      pad.setPosition(px, py);
      this.pads.set(dir, pad);
      this.add(pad);
    }
    scene.add.existing(this);
  }

  private makePad(dir: Dir, angle: number): Phaser.GameObjects.Container {
    const s = this.size;
    const c = new Phaser.GameObjects.Container(this.scene, 0, 0);
    const g = this.scene.add.graphics();
    this.drawPad(g, false);
    c.add(g);
    const chevron = this.scene.add.graphics();
    chevron.lineStyle(Math.max(4, s * 0.09), 0xfff3dd, 0.95);
    chevron.beginPath();
    chevron.moveTo(-s * 0.2, s * 0.1);
    chevron.lineTo(0, -s * 0.12);
    chevron.lineTo(s * 0.2, s * 0.1);
    chevron.strokePath();
    chevron.setAngle(angle);
    c.add(chevron);
    c.setSize(s, s);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.heldDir = dir;
      this.drawPad(g, true);
      c.setScale(0.93);
      this.emit('press', dir);
    });
    const release = (): void => {
      if (this.heldDir === dir) this.heldDir = null;
      this.drawPad(g, false);
      c.setScale(1);
      this.emit('release', dir);
    };
    c.on('pointerup', release);
    c.on('pointerout', release);
    c.on('pointerupoutside', release);
    return c;
  }

  private drawPad(g: Phaser.GameObjects.Graphics, down: boolean): void {
    const s = this.size;
    const r = s * 0.28;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-s / 2, -s / 2 + (down ? 2 : 5), s, s, r);
    g.fillStyle(down ? 0x7a48c9 : 0x3a2a55, down ? 0.95 : 0.85);
    g.fillRoundedRect(-s / 2, -s / 2 + (down ? 3 : 0), s, s, r);
    g.fillStyle(0xffffff, down ? 0.05 : 0.1);
    g.fillRoundedRect(-s / 2 + 4, -s / 2 + (down ? 5 : 2), s - 8, s * 0.4, r * 0.8);
    g.lineStyle(2, down ? 0xd8bfff : 0x6b4fa0, 0.8);
    g.strokeRoundedRect(-s / 2, -s / 2 + (down ? 3 : 0), s, s, r);
  }

  /** Overall footprint (width == height). */
  get footprint(): number {
    return this.size * 3.2;
  }
}
