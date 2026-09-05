import Phaser from 'phaser';
import { DPR, Palette } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';
import { LevelCompleteScene } from './scenes/LevelCompleteScene';
import { GameCompleteScene } from './scenes/GameCompleteScene';

const parent = document.getElementById('game') as HTMLDivElement;

function parentSize(): { w: number; h: number } {
  const w = Math.max(1, parent.clientWidth || window.innerWidth);
  const h = Math.max(1, parent.clientHeight || window.innerHeight);
  return { w, h };
}

const initial = parentSize();

/**
 * We render at device resolution for crisp text and vector art on phones:
 * the canvas backing store is CSS size x DPR while `zoom` shrinks it back
 * to CSS size on screen. `fit()` keeps that in sync with the viewport.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent,
  backgroundColor: Palette.bgDeep,
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(initial.w * DPR),
    height: Math.round(initial.h * DPR),
    zoom: 1 / DPR,
    autoRound: false,
  },
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
    maxLights: 10,
  },
  // Audio is handled entirely by Tone.js.
  audio: { noAudio: true },
  input: {
    activePointers: 3,
    touch: { capture: true },
  },
  dom: { createContainer: false },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, LevelCompleteScene, GameCompleteScene],
};

const game = new Phaser.Game(config);

let fitQueued = false;
function fit(): void {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => {
    fitQueued = false;
    const { w, h } = parentSize();
    const gw = Math.round(w * DPR);
    const gh = Math.round(h * DPR);
    if (game.scale.width !== gw || game.scale.height !== gh) {
      game.scale.resize(gw, gh);
    }
  });
}

if ('ResizeObserver' in window) {
  new ResizeObserver(() => fit()).observe(parent);
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => {
  fit();
  setTimeout(fit, 250);
  setTimeout(fit, 700);
});
window.visualViewport?.addEventListener('resize', fit);

// Block iOS double-tap zoom / gesture zoom on the canvas.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

// Expose for debugging and automated smoke tests.
(window as Window & { __violet?: Phaser.Game }).__violet = game;

export default game;
