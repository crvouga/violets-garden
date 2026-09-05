import Phaser from 'phaser';
import { Css, Fonts } from '../config';

export interface TextOpts {
  size: number;
  color?: string;
  font?: 'display' | 'body';
  weight?: string | number;
  align?: 'left' | 'center' | 'right';
  stroke?: string;
  strokeThickness?: number;
  shadow?: boolean;
  wrap?: number;
  origin?: [number, number];
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: TextOpts,
): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: opts.font === 'body' ? Fonts.body : Fonts.display,
    fontSize: `${Math.round(opts.size)}px`,
    fontStyle: String(opts.weight ?? (opts.font === 'body' ? 600 : 700)),
    color: opts.color ?? Css.cream,
    align: opts.align ?? 'center',
  };
  if (opts.stroke) {
    style.stroke = opts.stroke;
    style.strokeThickness = opts.strokeThickness ?? Math.max(2, opts.size * 0.12);
  }
  if (opts.wrap) {
    style.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
  }
  const t = scene.add.text(x, y, text, style);
  const [ox, oy] = opts.origin ?? [0.5, 0.5];
  t.setOrigin(ox, oy);
  if (opts.shadow) {
    t.setShadow(
      0,
      Math.max(1, opts.size * 0.08),
      'rgba(0,0,0,0.45)',
      Math.max(2, opts.size * 0.15),
      true,
      true,
    );
  }
  return t;
}
