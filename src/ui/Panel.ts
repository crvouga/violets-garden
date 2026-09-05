import Phaser from 'phaser';

export interface PanelOpts {
  width: number;
  height: number;
  radius?: number;
  fill?: number;
  alpha?: number;
  border?: number;
}

/** Rounded backdrop panel with a soft shadow. Draws centered on its origin. */
export function drawPanel(g: Phaser.GameObjects.Graphics, opts: PanelOpts): void {
  const { width: w, height: h } = opts;
  const r = opts.radius ?? 28;
  g.clear();
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, r);
  g.fillStyle(opts.fill ?? 0x2a1b45, opts.alpha ?? 0.97);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0xffffff, 0.035);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, Math.min(h * 0.18, 70), r * 0.85);
  g.lineStyle(2, opts.border ?? 0x6b4fa0, 0.8);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
}

export function makePanel(scene: Phaser.Scene, x: number, y: number, opts: PanelOpts) {
  const g = scene.add.graphics({ x, y });
  drawPanel(g, opts);
  return g;
}
