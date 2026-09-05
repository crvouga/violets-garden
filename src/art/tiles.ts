/**
 * Procedurally drawn tile & particle textures using the Canvas 2D API.
 * Everything is drawn at TILE_TEX resolution and scaled down at runtime.
 */
import Phaser from 'phaser';
import { ChannelColorHex, KeyColorHex, TILE_TEX, type KeyColor } from '../config';

type Ctx = CanvasRenderingContext2D;

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

function rgba(n: number, a: number): string {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** Deterministic pseudo random generator so variants look identical every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx, w: number, h: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// -----------------------------------------------------------------------------
// Floor
// -----------------------------------------------------------------------------

function drawFloor(ctx: Ctx, s: number, seed: number): void {
  const rand = rng(seed);
  // Base warm stone.
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, '#4b3f63');
  g.addColorStop(1, '#3a2f4f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Flagstone slab inset.
  const inset = s * 0.05;
  const slab = ctx.createLinearGradient(0, inset, 0, s - inset);
  slab.addColorStop(0, '#665784');
  slab.addColorStop(1, '#4e4168');
  ctx.fillStyle = slab;
  roundRect(ctx, inset, inset, s - inset * 2, s - inset * 2, s * 0.12);
  ctx.fill();

  // Speckle noise.
  for (let i = 0; i < 90; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const r = rand() * s * 0.02 + 0.5;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle cracks.
  ctx.strokeStyle = 'rgba(20,10,35,0.35)';
  ctx.lineWidth = s * 0.012;
  ctx.lineCap = 'round';
  const cracks = 1 + Math.floor(rand() * 2);
  for (let c = 0; c < cracks; c++) {
    let x = inset + rand() * (s - inset * 2);
    let y = inset + rand() * (s - inset * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < segs; i++) {
      x += (rand() - 0.5) * s * 0.3;
      y += (rand() - 0.5) * s * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Top-left highlight edge, bottom-right shade edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(inset + s * 0.1, inset);
  ctx.lineTo(s - inset - s * 0.1, inset);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(inset, inset + s * 0.1);
  ctx.lineTo(inset, s - inset - s * 0.1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(inset + s * 0.1, s - inset);
  ctx.lineTo(s - inset - s * 0.1, s - inset);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s - inset, inset + s * 0.1);
  ctx.lineTo(s - inset, s - inset - s * 0.1);
  ctx.stroke();

  // Occasional tiny leaf / petal.
  if (rand() > 0.55) {
    const lx = inset + rand() * (s - inset * 2);
    const ly = inset + rand() * (s - inset * 2);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = rand() > 0.5 ? 'rgba(155,93,229,0.45)' : 'rgba(46,196,182,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.05, s * 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// -----------------------------------------------------------------------------
// Hedge wall
// -----------------------------------------------------------------------------

function drawWall(ctx: Ctx, s: number, seed: number): void {
  const rand = rng(seed);
  // Dark base (soil) - visible as the "front" face at the bottom.
  const base = ctx.createLinearGradient(0, 0, 0, s);
  base.addColorStop(0, '#173321');
  base.addColorStop(1, '#0b1a11');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);

  // Top face: lush rounded hedge, slightly smaller than the cell so walls read as blocks.
  const topH = s * 0.86;
  const g = ctx.createRadialGradient(s * 0.35, s * 0.25, s * 0.05, s * 0.5, s * 0.45, s * 0.75);
  g.addColorStop(0, '#5fa85a');
  g.addColorStop(0.55, '#3b7d3c');
  g.addColorStop(1, '#22532a');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, s, topH, s * 0.16);
  ctx.fill();

  // Leaf clusters.
  for (let i = 0; i < 70; i++) {
    const x = rand() * s;
    const y = rand() * topH;
    const r = s * (0.03 + rand() * 0.05);
    const light = y < topH * 0.4 ? 0.22 : 0.1;
    ctx.fillStyle =
      rand() > 0.5 ? `rgba(160,220,120,${light * rand()})` : `rgba(10,40,20,${0.25 * rand()})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny flowers.
  const flowers = Math.floor(rand() * 4);
  for (let i = 0; i < flowers; i++) {
    const x = s * 0.12 + rand() * s * 0.76;
    const y = s * 0.12 + rand() * topH * 0.7;
    ctx.fillStyle = rand() > 0.5 ? '#e8a4ff' : '#ffd166';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s * 0.02, y + Math.sin(a) * s * 0.02, s * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ambient occlusion at the front edge.
  const ao = ctx.createLinearGradient(0, topH - s * 0.12, 0, topH);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = ao;
  roundRect(ctx, 0, 0, s, topH, s * 0.16);
  ctx.fill();

  // Rim light on top-left.
  ctx.strokeStyle = 'rgba(200,255,180,0.28)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(s * 0.18, s * 0.03);
  ctx.lineTo(s * 0.82, s * 0.03);
  ctx.stroke();
}

// -----------------------------------------------------------------------------
// Buttons (pressure plates)
// -----------------------------------------------------------------------------

function drawButton(ctx: Ctx, s: number, color: number, pressed: boolean): void {
  const c = s / 2;
  const r = s * 0.34;
  // Recess.
  const recess = ctx.createRadialGradient(c, c, r * 0.6, c, c, r * 1.15);
  recess.addColorStop(0, 'rgba(0,0,0,0.5)');
  recess.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = recess;
  ctx.beginPath();
  ctx.arc(c, c, r * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Base ring.
  ctx.fillStyle = '#26202f';
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  const plateR = pressed ? r * 0.8 : r * 0.84;
  const lift = pressed ? 0 : -s * 0.03;
  const plate = ctx.createRadialGradient(
    c - r * 0.3,
    c + lift - r * 0.3,
    r * 0.1,
    c,
    c + lift,
    plateR,
  );
  plate.addColorStop(0, pressed ? '#5a5266' : '#8f86a0');
  plate.addColorStop(1, pressed ? '#2b2533' : '#4d445c');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.arc(c, c + lift, plateR, 0, Math.PI * 2);
  ctx.fill();

  // Coloured ring (glows when pressed).
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = hex(color);
  ctx.globalAlpha = pressed ? 1 : 0.7;
  ctx.beginPath();
  ctx.arc(c, c + lift, plateR * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (pressed) {
    ctx.shadowColor = hex(color);
    ctx.shadowBlur = s * 0.12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(color, 0.35);
    ctx.beginPath();
    ctx.arc(c, c, plateR * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }

  // Side highlight when raised.
  if (!pressed) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.arc(c, c + lift, plateR - s * 0.012, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

// -----------------------------------------------------------------------------
// Toggle door: frame + retractable bars
// -----------------------------------------------------------------------------

function drawDoorFrame(ctx: Ctx, s: number, color: number): void {
  // Floor beneath is drawn separately; this is just the two posts and lintel.
  const post = ctx.createLinearGradient(0, 0, s * 0.18, 0);
  post.addColorStop(0, '#6d6f7a');
  post.addColorStop(0.5, '#3b3c45');
  post.addColorStop(1, '#22232a');
  ctx.fillStyle = post;
  roundRect(ctx, s * 0.02, s * 0.04, s * 0.17, s * 0.92, s * 0.05);
  ctx.fill();
  ctx.save();
  ctx.translate(s, 0);
  ctx.scale(-1, 1);
  roundRect(ctx, s * 0.02, s * 0.04, s * 0.17, s * 0.92, s * 0.05);
  ctx.fill();
  ctx.restore();

  // Lintel.
  const lintel = ctx.createLinearGradient(0, 0, 0, s * 0.18);
  lintel.addColorStop(0, '#7a7c88');
  lintel.addColorStop(1, '#2c2d35');
  ctx.fillStyle = lintel;
  roundRect(ctx, 0, 0, s, s * 0.16, s * 0.04);
  ctx.fill();

  // Gem indicator.
  ctx.fillStyle = hex(color);
  ctx.shadowColor = hex(color);
  ctx.shadowBlur = s * 0.1;
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.08, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(s / 2 - s * 0.015, s * 0.065, s * 0.015, 0, Math.PI * 2);
  ctx.fill();
}

function drawDoorBars(ctx: Ctx, s: number, color: number): void {
  const bars = 4;
  const left = s * 0.2;
  const right = s * 0.8;
  const step = (right - left) / (bars - 1);
  for (let i = 0; i < bars; i++) {
    const x = left + step * i;
    const g = ctx.createLinearGradient(x - s * 0.035, 0, x + s * 0.035, 0);
    g.addColorStop(0, '#9a9cab');
    g.addColorStop(0.5, '#4e5060');
    g.addColorStop(1, '#25262e');
    ctx.fillStyle = g;
    roundRect(ctx, x - s * 0.035, s * 0.12, s * 0.07, s * 0.86, s * 0.03);
    ctx.fill();
  }
  // Cross bar.
  const cross = ctx.createLinearGradient(0, s * 0.5, 0, s * 0.6);
  cross.addColorStop(0, '#8a8c9a');
  cross.addColorStop(1, '#2c2d35');
  ctx.fillStyle = cross;
  roundRect(ctx, s * 0.17, s * 0.5, s * 0.66, s * 0.09, s * 0.03);
  ctx.fill();
  // Coloured energy line so players connect bars to buttons.
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = s * 0.02;
  ctx.shadowColor = hex(color);
  ctx.shadowBlur = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.545);
  ctx.lineTo(s * 0.8, s * 0.545);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// -----------------------------------------------------------------------------
// Locked door
// -----------------------------------------------------------------------------

function drawLockedDoor(ctx: Ctx, s: number, color: number): void {
  // Wooden door filling the cell with iron bands & padlock in key colour.
  const wood = ctx.createLinearGradient(0, 0, s, s);
  wood.addColorStop(0, '#8a5a30');
  wood.addColorStop(1, '#4f2f14');
  ctx.fillStyle = wood;
  roundRect(ctx, s * 0.04, s * 0.04, s * 0.92, s * 0.92, s * 0.1);
  ctx.fill();

  // Planks.
  ctx.strokeStyle = 'rgba(40,20,5,0.55)';
  ctx.lineWidth = s * 0.02;
  for (let i = 1; i < 4; i++) {
    const x = s * 0.04 + (s * 0.92 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, s * 0.06);
    ctx.lineTo(x, s * 0.94);
    ctx.stroke();
  }
  // Iron bands.
  const iron = ctx.createLinearGradient(0, 0, 0, s * 0.1);
  iron.addColorStop(0, '#7c7e8c');
  iron.addColorStop(1, '#2e2f38');
  ctx.fillStyle = iron;
  roundRect(ctx, s * 0.04, s * 0.2, s * 0.92, s * 0.09, s * 0.02);
  ctx.fill();
  roundRect(ctx, s * 0.04, s * 0.71, s * 0.92, s * 0.09, s * 0.02);
  ctx.fill();
  ctx.fillStyle = '#1b1c22';
  for (const x of [0.12, 0.88]) {
    for (const y of [0.245, 0.755]) {
      ctx.beginPath();
      ctx.arc(s * x, s * y, s * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Padlock body.
  const c = s / 2;
  ctx.fillStyle = hex(color);
  ctx.shadowColor = hex(color);
  ctx.shadowBlur = s * 0.1;
  roundRect(ctx, c - s * 0.15, c - s * 0.08, s * 0.3, s * 0.26, s * 0.05);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Shackle.
  ctx.strokeStyle = '#d8dae6';
  ctx.lineWidth = s * 0.045;
  ctx.beginPath();
  ctx.arc(c, c - s * 0.1, s * 0.1, Math.PI, 0);
  ctx.stroke();
  // Keyhole.
  ctx.fillStyle = 'rgba(20,10,30,0.9)';
  ctx.beginPath();
  ctx.arc(c, c + s * 0.02, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(c - s * 0.018, c + s * 0.03, s * 0.036, s * 0.08);
  // Gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, c - s * 0.12, c - s * 0.06, s * 0.1, s * 0.05, s * 0.02);
  ctx.fill();
}

// -----------------------------------------------------------------------------
// Particles & misc
// -----------------------------------------------------------------------------

function drawSoftDot(ctx: Ctx, s: number): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

function drawSpark(ctx: Ctx, s: number): void {
  const c = s / 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? c * 0.95 : c * 0.28;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

function drawConfetti(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = '#fff';
  roundRect(ctx, 0, 0, w, h, Math.min(w, h) * 0.25);
  ctx.fill();
}

function drawShadow(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.scale(1, h / w);
  ctx.fillRect(0, 0, w, w);
  ctx.restore();
}

function drawVignette(ctx: Ctx, s: number): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.25, s / 2, s / 2, s * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,4,20,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

function drawGlow(ctx: Ctx, s: number): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

function drawStar(ctx: Ctx, s: number): void {
  const c = s / 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? c * 0.92 : c * 0.42;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#d9d9d9');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.04;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
}

function drawPaw(ctx: Ctx, s: number): void {
  ctx.fillStyle = '#fff';
  const c = s / 2;
  ctx.beginPath();
  ctx.ellipse(c, c + s * 0.14, s * 0.2, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [
    [-0.22, -0.08],
    [-0.08, -0.22],
    [0.08, -0.22],
    [0.22, -0.08],
  ];
  for (const [dx, dy] of toes) {
    ctx.beginPath();
    ctx.arc(c + dx! * s, c + dy! * s, s * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -----------------------------------------------------------------------------
// UI icons (white, tint at runtime)
// -----------------------------------------------------------------------------

function iconBase(ctx: Ctx, s: number): void {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.11;
}

function drawIconPause(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  roundRect(ctx, s * 0.22, s * 0.18, s * 0.18, s * 0.64, s * 0.06);
  ctx.fill();
  roundRect(ctx, s * 0.6, s * 0.18, s * 0.18, s * 0.64, s * 0.06);
  ctx.fill();
}

function drawIconPlay(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  ctx.beginPath();
  ctx.moveTo(s * 0.3, s * 0.18);
  ctx.lineTo(s * 0.82, s * 0.5);
  ctx.lineTo(s * 0.3, s * 0.82);
  ctx.closePath();
  ctx.fill();
}

function drawIconUndo(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  ctx.beginPath();
  ctx.arc(s * 0.52, s * 0.54, s * 0.28, Math.PI * 1.15, Math.PI * 0.35, false);
  ctx.stroke();
  // arrow head at left end of arc
  ctx.beginPath();
  ctx.moveTo(s * 0.14, s * 0.32);
  ctx.lineTo(s * 0.3, s * 0.52);
  ctx.lineTo(s * 0.08, s * 0.56);
  ctx.closePath();
  ctx.fill();
}

function drawIconRestart(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.52, s * 0.28, Math.PI * -0.35, Math.PI * 1.45, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.66, s * 0.14);
  ctx.lineTo(s * 0.82, s * 0.36);
  ctx.lineTo(s * 0.56, s * 0.38);
  ctx.closePath();
  ctx.fill();
}

function drawIconHome(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.14);
  ctx.lineTo(s * 0.88, s * 0.48);
  ctx.lineTo(s * 0.78, s * 0.48);
  ctx.lineTo(s * 0.78, s * 0.84);
  ctx.lineTo(s * 0.22, s * 0.84);
  ctx.lineTo(s * 0.22, s * 0.48);
  ctx.lineTo(s * 0.12, s * 0.48);
  ctx.closePath();
  ctx.fill();
}

function drawIconGrid(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  for (const x of [0.16, 0.56]) {
    for (const y of [0.16, 0.56]) {
      roundRect(ctx, s * x, s * y, s * 0.28, s * 0.28, s * 0.06);
      ctx.fill();
    }
  }
}

function drawIconMusic(ctx: Ctx, s: number, off: boolean): void {
  iconBase(ctx, s);
  ctx.beginPath();
  ctx.moveTo(s * 0.4, s * 0.7);
  ctx.lineTo(s * 0.4, s * 0.2);
  ctx.lineTo(s * 0.78, s * 0.14);
  ctx.lineTo(s * 0.78, s * 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(s * 0.3, s * 0.72, s * 0.12, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.68, s * 0.64, s * 0.12, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  if (off) slash(ctx, s);
}

function drawIconSfx(ctx: Ctx, s: number, off: boolean): void {
  iconBase(ctx, s);
  ctx.beginPath();
  ctx.moveTo(s * 0.14, s * 0.38);
  ctx.lineTo(s * 0.3, s * 0.38);
  ctx.lineTo(s * 0.5, s * 0.2);
  ctx.lineTo(s * 0.5, s * 0.8);
  ctx.lineTo(s * 0.3, s * 0.62);
  ctx.lineTo(s * 0.14, s * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.52, s * 0.5, s * 0.18, -0.9, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.52, s * 0.5, s * 0.32, -0.9, 0.9);
  ctx.stroke();
  if (off) slash(ctx, s);
}

function slash(ctx: Ctx, s: number): void {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = s * 0.2;
  ctx.beginPath();
  ctx.moveTo(s * 0.18, s * 0.12);
  ctx.lineTo(s * 0.88, s * 0.82);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#ff6b8a';
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.16);
  ctx.lineTo(s * 0.84, s * 0.8);
  ctx.stroke();
}

function drawIconLock(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  roundRect(ctx, s * 0.22, s * 0.44, s * 0.56, s * 0.42, s * 0.08);
  ctx.fill();
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.42, s * 0.18, Math.PI, 0);
  ctx.stroke();
}

function drawIconClose(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  ctx.lineWidth = s * 0.13;
  ctx.beginPath();
  ctx.moveTo(s * 0.24, s * 0.24);
  ctx.lineTo(s * 0.76, s * 0.76);
  ctx.moveTo(s * 0.76, s * 0.24);
  ctx.lineTo(s * 0.24, s * 0.76);
  ctx.stroke();
}

function drawIconArrow(ctx: Ctx, s: number): void {
  iconBase(ctx, s);
  ctx.lineWidth = s * 0.13;
  ctx.beginPath();
  ctx.moveTo(s * 0.18, s * 0.5);
  ctx.lineTo(s * 0.82, s * 0.5);
  ctx.moveTo(s * 0.56, s * 0.24);
  ctx.lineTo(s * 0.82, s * 0.5);
  ctx.lineTo(s * 0.56, s * 0.76);
  ctx.stroke();
}

// -----------------------------------------------------------------------------
// Public entry
// -----------------------------------------------------------------------------

export const FLOOR_VARIANTS = 4;
export const WALL_VARIANTS = 3;

export function buildProceduralTextures(scene: Phaser.Scene): void {
  const s = TILE_TEX;
  for (let i = 0; i < FLOOR_VARIANTS; i++) {
    makeCanvas(scene, `floor-${i}`, s, s, (ctx) => drawFloor(ctx, s, 1000 + i * 77));
  }
  for (let i = 0; i < WALL_VARIANTS; i++) {
    makeCanvas(scene, `wall-${i}`, s, s, (ctx) => drawWall(ctx, s, 5000 + i * 131));
  }
  for (const ch of [0, 1]) {
    const color = ChannelColorHex[ch]!;
    makeCanvas(scene, `button-up-${ch}`, s, s, (ctx) => drawButton(ctx, s, color, false));
    makeCanvas(scene, `button-down-${ch}`, s, s, (ctx) => drawButton(ctx, s, color, true));
    makeCanvas(scene, `door-frame-${ch}`, s, s, (ctx) => drawDoorFrame(ctx, s, color));
    makeCanvas(scene, `door-bars-${ch}`, s, s, (ctx) => drawDoorBars(ctx, s, color));
  }
  (Object.keys(KeyColorHex) as KeyColor[]).forEach((k) => {
    makeCanvas(scene, `locked-${k}`, s, s, (ctx) => drawLockedDoor(ctx, s, KeyColorHex[k]));
  });
  makeCanvas(scene, 'p-dot', 64, 64, (ctx) => drawSoftDot(ctx, 64));
  makeCanvas(scene, 'p-spark', 64, 64, (ctx) => drawSpark(ctx, 64));
  makeCanvas(scene, 'p-confetti', 24, 14, (ctx, w, h) => drawConfetti(ctx, w, h));
  makeCanvas(scene, 'shadow', 128, 64, (ctx, w, h) => drawShadow(ctx, w, h));
  makeCanvas(scene, 'vignette', 512, 512, (ctx) => drawVignette(ctx, 512));
  makeCanvas(scene, 'glow', 256, 256, (ctx) => drawGlow(ctx, 256));
  makeCanvas(scene, 'star', 128, 128, (ctx) => drawStar(ctx, 128));
  makeCanvas(scene, 'paw', 64, 64, (ctx) => drawPaw(ctx, 64));

  const I = 96;
  makeCanvas(scene, 'icon-pause', I, I, (ctx) => drawIconPause(ctx, I));
  makeCanvas(scene, 'icon-play', I, I, (ctx) => drawIconPlay(ctx, I));
  makeCanvas(scene, 'icon-undo', I, I, (ctx) => drawIconUndo(ctx, I));
  makeCanvas(scene, 'icon-restart', I, I, (ctx) => drawIconRestart(ctx, I));
  makeCanvas(scene, 'icon-home', I, I, (ctx) => drawIconHome(ctx, I));
  makeCanvas(scene, 'icon-grid', I, I, (ctx) => drawIconGrid(ctx, I));
  makeCanvas(scene, 'icon-music-on', I, I, (ctx) => drawIconMusic(ctx, I, false));
  makeCanvas(scene, 'icon-music-off', I, I, (ctx) => drawIconMusic(ctx, I, true));
  makeCanvas(scene, 'icon-sfx-on', I, I, (ctx) => drawIconSfx(ctx, I, false));
  makeCanvas(scene, 'icon-sfx-off', I, I, (ctx) => drawIconSfx(ctx, I, true));
  makeCanvas(scene, 'icon-lock', I, I, (ctx) => drawIconLock(ctx, I));
  makeCanvas(scene, 'icon-close', I, I, (ctx) => drawIconClose(ctx, I));
  makeCanvas(scene, 'icon-arrow', I, I, (ctx) => drawIconArrow(ctx, I));
}
