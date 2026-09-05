/** Loads vector art and builds procedural textures. */
import Phaser from 'phaser';
import pugDown from '../assets/svg/pug-down.svg?raw';
import pugUp from '../assets/svg/pug-up.svg?raw';
import pugSide from '../assets/svg/pug-side.svg?raw';
import pugBlink from '../assets/svg/pug-blink.svg?raw';
import pugHappy from '../assets/svg/pug-happy.svg?raw';
import keySvg from '../assets/svg/key.svg?raw';
import boneSvg from '../assets/svg/bone.svg?raw';
import crateSvg from '../assets/svg/crate.svg?raw';
import bedSvg from '../assets/svg/dog-bed.svg?raw';
import lampSvg from '../assets/svg/lamp.svg?raw';
import { buildProceduralTextures } from './tiles';

export const Tex = {
  pugDown: 'pug-down',
  pugUp: 'pug-up',
  pugSide: 'pug-side',
  pugBlink: 'pug-blink',
  pugHappy: 'pug-happy',
  key: 'key',
  bone: 'bone',
  crate: 'crate',
  bed: 'dog-bed',
  lamp: 'lamp',
} as const;

const PUG_RES = 320;

/** Turn raw SVG markup into a Blob URL Phaser's loader can fetch. */
function svgUrl(markup: string): string {
  return URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
}
const PROP_RES = 192;

/** Queue SVG loads. Call from a scene's preload(). */
export function queueArt(scene: Phaser.Scene): void {
  const pug = { width: PUG_RES, height: PUG_RES };
  const prop = { width: PROP_RES, height: PROP_RES };
  scene.load.svg(Tex.pugDown, svgUrl(pugDown), pug);
  scene.load.svg(Tex.pugUp, svgUrl(pugUp), pug);
  scene.load.svg(Tex.pugSide, svgUrl(pugSide), pug);
  scene.load.svg(Tex.pugBlink, svgUrl(pugBlink), pug);
  scene.load.svg(Tex.pugHappy, svgUrl(pugHappy), pug);
  scene.load.svg(Tex.key, svgUrl(keySvg), prop);
  scene.load.svg(Tex.bone, svgUrl(boneSvg), prop);
  scene.load.svg(Tex.crate, svgUrl(crateSvg), prop);
  scene.load.svg(Tex.bed, svgUrl(bedSvg), prop);
  scene.load.svg(Tex.lamp, svgUrl(lampSvg), prop);
}

/** Build canvas textures. Call once after preload completes. */
export function buildArt(scene: Phaser.Scene): void {
  buildProceduralTextures(scene);
}
