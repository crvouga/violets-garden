/** Global constants, palette and depth layers shared across scenes. */

export const GAME_TITLE = 'Violet';

/** Base texture resolution for tile art (scaled down at runtime). */
export const TILE_TEX = 128;

/** Depth layers used inside GameScene. */
export const Depth = {
  Background: 0,
  BoardShadow: 5,
  Floor: 10,
  FloorDecor: 12,
  Button: 14,
  Wall: 20,
  Door: 22,
  Item: 30,
  Box: 40,
  Pug: 50,
  ParticlesLow: 60,
  ParticlesHigh: 70,
  Vignette: 80,
  HUD: 100,
  Overlay: 200,
  OverlayContent: 210,
} as const;

export const Palette = {
  bgDeep: 0x1a1027,
  bgMid: 0x2a1b45,
  violet: 0x9b5de5,
  violetLight: 0xc49bff,
  violetDark: 0x5a2ea0,
  cream: 0xfff3dd,
  gold: 0xffd166,
  goldDark: 0xc9902a,
  teal: 0x2ec4b6,
  tealDark: 0x1a8f85,
  rose: 0xff6b8a,
  roseDark: 0xb33d58,
  blue: 0x4cc9f0,
  blueDark: 0x2a7ea8,
  ink: 0x120b1c,
  textDark: 0x2b1b3d,
} as const;

/** CSS color strings for text objects. */
export const Css = {
  cream: '#fff3dd',
  violet: '#9b5de5',
  violetLight: '#c49bff',
  gold: '#ffd166',
  ink: '#120b1c',
  textDark: '#2b1b3d',
  muted: '#b8a7d4',
} as const;

export const Fonts = {
  display: "'Fredoka', 'Nunito', system-ui, sans-serif",
  body: "'Nunito', 'Fredoka', system-ui, sans-serif",
} as const;

export type KeyColor = 'gold' | 'teal' | 'violet';

export const KeyColorHex: Record<KeyColor, number> = {
  gold: Palette.gold,
  teal: Palette.teal,
  violet: Palette.violetLight,
};

export const ChannelColorHex: Record<number, number> = {
  0: Palette.rose,
  1: Palette.blue,
};

/** Minimum touch target in CSS pixels. */
export const MIN_TOUCH = 48;

/**
 * Device pixel ratio the game renders at (capped at 2 for mobile GPU budgets).
 * The canvas backing store is DPR x CSS size, so all "CSS pixel" constants go through `px()`.
 */
export const DPR: number =
  typeof window !== 'undefined' ? Math.min(Math.max(1, window.devicePixelRatio || 1), 2) : 1;

/** Convert a CSS pixel value into game (canvas) pixels. */
export const px = (cssPixels: number): number => cssPixels * DPR;
