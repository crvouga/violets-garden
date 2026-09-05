import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { Board, computeStars, posKey, type Dir, type MoveEvent, type Pos } from '../logic/board';
import { LEVELS, TOTAL_LEVELS } from '../levels';
import {
  ChannelColorHex,
  Css,
  Depth,
  DPR,
  KeyColorHex,
  Palette,
  px,
  type KeyColor,
} from '../config';
import { Tex } from '../art/atlas';
import { FLOOR_VARIANTS, WALL_VARIANTS } from '../art/tiles';
import { sfx } from '../audio/sfx';
import { music } from '../audio/music';
import { audio } from '../audio/engine';
import { Button } from '../ui/Button';
import { DPad } from '../ui/DPad';
import { makeText } from '../ui/text';
import { drawPanel } from '../ui/Panel';
import { recordLevelResult } from '../save';

export interface GameSceneData {
  levelIndex: number;
}

/** Local tile size inside the board container (scaled to fit the screen). */
const T = 100;
const MOVE_MS = 150;

interface DoorView {
  frame: Phaser.GameObjects.Image;
  bars: Phaser.GameObjects.Image;
  open: boolean;
}

export class GameScene extends BaseScene {
  static readonly KEY = 'Game';

  private levelIndex = 0;
  private board!: Board;

  private boardC!: Phaser.GameObjects.Container;
  private boardScale = 1;
  private groundG!: Phaser.GameObjects.Graphics;

  private pugC!: Phaser.GameObjects.Container;
  private pugBody!: Phaser.GameObjects.Container;
  private pugSprite!: Phaser.GameObjects.Image;
  private breathTween?: Phaser.Tweens.Tween;

  private boxSprites: Phaser.GameObjects.Image[] = [];
  private keySprites = new Map<string, Phaser.GameObjects.Container>();
  private treatSprites = new Map<string, Phaser.GameObjects.Image>();
  private lockSprites = new Map<string, Phaser.GameObjects.Image>();
  private doorViews = new Map<string, DoorView>();
  private buttonSprites = new Map<string, Phaser.GameObjects.Image>();
  private exitSprite!: Phaser.GameObjects.Image;
  private lampSprites: Phaser.GameObjects.Image[] = [];

  private lightsOn = false;
  private pugLight?: Phaser.GameObjects.Light;
  private lampLights: Phaser.GameObjects.Light[] = [];

  private dustE!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkE!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiE!: Phaser.GameObjects.Particles.ParticleEmitter;

  // HUD
  private hudG!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private movesLabel!: Phaser.GameObjects.Text;
  private keySlots!: Phaser.GameObjects.Container;
  private keyIcons: Phaser.GameObjects.Image[] = [];
  private treatIcon!: Phaser.GameObjects.Image;
  private treatText!: Phaser.GameObjects.Text;
  private pauseBtn!: Button;
  private undoBtn!: Button;
  private restartBtn!: Button;
  private dpad!: DPad;
  private hintText?: Phaser.GameObjects.Text;

  // Pause overlay
  private pauseC!: Phaser.GameObjects.Container;
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pausePanel!: Phaser.GameObjects.Graphics;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseButtons: Button[] = [];
  private musicBtn!: Button;
  private sfxBtn!: Button;

  // State
  private animating = false;
  private pendingDir: Dir | null = null;
  private finished = false;
  private paused = false;
  private swipe: { x: number; y: number; id: number; t: number } | null = null;
  private blinkEvent?: Phaser.Time.TimerEvent;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastHoldMove = 0;

  constructor() {
    super(GameScene.KEY);
  }

  init(data: GameSceneData): void {
    this.levelIndex = Phaser.Math.Clamp(data?.levelIndex ?? 0, 0, TOTAL_LEVELS - 1);
    this.animating = false;
    this.pendingDir = null;
    this.finished = false;
    this.paused = false;
    this.swipe = null;
    this.boxSprites = [];
    this.keySprites.clear();
    this.treatSprites.clear();
    this.lockSprites.clear();
    this.doorViews.clear();
    this.buttonSprites.clear();
    this.lampSprites = [];
    this.lampLights = [];
    this.keyIcons = [];
    this.pauseButtons = [];
  }

  get level() {
    return LEVELS[this.levelIndex]!;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  create(): void {
    this.initBase();
    this.board = new Board(this.level.map);
    this.addBackground(true);

    this.lightsOn = this.sys.game.renderer.type === Phaser.WEBGL;
    if (this.lightsOn) {
      this.lights.enable().setAmbientColor(0xb8aad0);
    }

    this.buildBoard();
    this.buildHud();
    this.buildPauseOverlay();
    this.setupInput();
    this.layout();
    this.fadeIn();
    music.play('game');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.startBlinking();
    this.showLevelBanner();
  }

  private onShutdown(): void {
    this.blinkEvent?.remove(false);
    if (this.lightsOn) {
      if (this.pugLight) this.lights.removeLight(this.pugLight);
      this.lampLights.forEach((l) => this.lights.removeLight(l));
      this.lights.disable();
    }
  }

  private lit<TObj extends Phaser.GameObjects.Image>(img: TObj): TObj {
    if (this.lightsOn) img.setPipeline('Light2D');
    return img;
  }

  private cellX(x: number): number {
    return x * T + T / 2;
  }

  private cellY(y: number): number {
    return y * T + T / 2;
  }

  private hash(x: number, y: number, mod: number): number {
    return Math.abs((x * 73856093) ^ (y * 19349663)) % mod;
  }

  private buildBoard(): void {
    const b = this.board;
    this.boardC = this.add.container(0, 0).setDepth(Depth.Floor);

    // Ground plate beneath the board.
    this.groundG = this.add.graphics();
    const pad = T * 0.35;
    this.groundG.fillStyle(0x000000, 0.35);
    this.groundG.fillRoundedRect(
      -pad + 6,
      -pad + 14,
      b.width * T + pad * 2,
      b.height * T + pad * 2,
      T * 0.5,
    );
    this.groundG.fillStyle(0x1e1430, 1);
    this.groundG.fillRoundedRect(
      -pad,
      -pad,
      b.width * T + pad * 2,
      b.height * T + pad * 2,
      T * 0.5,
    );
    this.groundG.lineStyle(4, 0x4a3670, 0.8);
    this.groundG.strokeRoundedRect(
      -pad,
      -pad,
      b.width * T + pad * 2,
      b.height * T + pad * 2,
      T * 0.5,
    );
    this.boardC.add(this.groundG);

    // Floors first.
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        if (b.terrain[y]![x] !== 'floor') continue;
        const img = this.add
          .image(this.cellX(x), this.cellY(y), `floor-${this.hash(x, y, FLOOR_VARIANTS)}`)
          .setDisplaySize(T, T);
        this.boardC.add(this.lit(img));
      }
    }

    // Exit (dog bed) sits on the floor.
    this.exitSprite = this.add
      .image(this.cellX(b.exit.x), this.cellY(b.exit.y), Tex.bed)
      .setDisplaySize(T * 0.96, T * 0.96);
    this.boardC.add(this.exitSprite);
    this.tweens.add({
      targets: this.exitSprite,
      scaleX: this.exitSprite.scaleX * 1.04,
      scaleY: this.exitSprite.scaleY * 1.04,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Buttons.
    for (const bt of b.buttons) {
      const img = this.add
        .image(this.cellX(bt.pos.x), this.cellY(bt.pos.y), `button-up-${bt.channel}`)
        .setDisplaySize(T, T);
      this.buttonSprites.set(posKey(bt.pos), this.lit(img));
      this.boardC.add(img);
    }

    // Walls (top to bottom so lower rows overlap upper).
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        if (b.terrain[y]![x] !== 'wall') continue;
        const img = this.add
          .image(this.cellX(x), this.cellY(y), `wall-${this.hash(x, y, WALL_VARIANTS)}`)
          .setDisplaySize(T, T);
        this.boardC.add(this.lit(img));
      }
    }

    // Lamps on walls.
    for (const lp of b.lamps) {
      const img = this.add
        .image(this.cellX(lp.x), this.cellY(lp.y) - T * 0.08, Tex.lamp)
        .setDisplaySize(T * 0.9, T * 0.9);
      this.lampSprites.push(img);
      this.boardC.add(img);
      this.tweens.add({
        targets: img,
        alpha: { from: 1, to: 0.86 },
        duration: 900 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Toggle doors: frame + bars.
    for (const d of b.toggleDoors) {
      const frame = this.add
        .image(this.cellX(d.pos.x), this.cellY(d.pos.y), `door-frame-${d.channel}`)
        .setDisplaySize(T, T);
      const bars = this.add
        .image(this.cellX(d.pos.x), d.pos.y * T, `door-bars-${d.channel}`)
        .setOrigin(0.5, 0)
        .setDisplaySize(T, T);
      this.boardC.add(this.lit(bars));
      this.boardC.add(this.lit(frame));
      const open = b.isToggleDoorOpen(d);
      if (open) {
        bars.setScale(bars.scaleX, bars.scaleY * 0.06).setAlpha(0.5);
      }
      this.doorViews.set(posKey(d.pos), { frame, bars, open });
    }

    // Locked doors.
    for (const d of b.lockedDoors) {
      const img = this.add
        .image(this.cellX(d.pos.x), this.cellY(d.pos.y), `locked-${d.color}`)
        .setDisplaySize(T, T);
      this.lockSprites.set(posKey(d.pos), this.lit(img));
      this.boardC.add(img);
    }

    // Keys.
    for (const kdef of b.keys) {
      const c = this.makeKeyPickup(kdef.pos, kdef.color);
      this.keySprites.set(posKey(kdef.pos), c);
      this.boardC.add(c);
    }

    // Treats.
    for (const t of b.treats) {
      const img = this.add
        .image(this.cellX(t.x), this.cellY(t.y), Tex.bone)
        .setDisplaySize(T * 0.62, T * 0.62);
      this.treatSprites.set(posKey(t), img);
      this.boardC.add(img);
      this.tweens.add({
        targets: img,
        y: img.y - T * 0.05,
        angle: { from: -6, to: 6 },
        duration: 1200 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Boxes.
    for (const bx of b.boxes) {
      const img = this.add
        .image(this.cellX(bx.x), this.cellY(bx.y), Tex.crate)
        .setDisplaySize(T * 0.98, T * 0.98);
      this.boxSprites.push(this.lit(img));
      this.boardC.add(img);
    }

    // Pug.
    this.pugC = this.add.container(this.cellX(b.pug.x), this.cellY(b.pug.y));
    this.pugBody = this.add.container(0, 0);
    this.pugSprite = this.add.image(0, 0, Tex.pugDown).setOrigin(0.5, 0.58);
    this.pugSprite.setDisplaySize(T * 1.16, T * 1.16);
    this.pugBody.add(this.pugSprite);
    this.pugC.add(this.pugBody);
    this.boardC.add(this.pugC);
    this.setFacing(b.facing);
    this.startBreathing();

    // Particles live inside the board container so they scale with it.
    this.dustE = this.add.particles(0, 0, 'p-dot', {
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 300, max: 520 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xfff3dd, 0xc49bff],
      gravityY: -40,
      emitting: false,
    });
    this.sparkE = this.add.particles(0, 0, 'p-spark', {
      speed: { min: 60, max: 200 },
      lifespan: { min: 400, max: 750 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xffd166, 0xffffff, 0xc49bff],
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.confettiE = this.add.particles(0, 0, 'p-confetti', {
      speed: { min: 220, max: 520 },
      angle: { min: 230, max: 310 },
      lifespan: { min: 1400, max: 2400 },
      scale: { start: 1.2, end: 0.7 },
      alpha: { start: 1, end: 0 },
      rotate: { start: 0, end: 720 },
      gravityY: 650,
      tint: [Palette.gold, Palette.rose, Palette.teal, Palette.violetLight, 0xffffff],
      emitting: false,
    });
    this.boardC.add([this.dustE, this.sparkE, this.confettiE]);

    if (this.lightsOn) {
      this.pugLight = this.lights.addLight(0, 0, 300, 0xffe2bd, 1.1);
      for (let i = 0; i < b.lamps.length; i++) {
        const l = this.lights.addLight(0, 0, 260, 0xffb060, 0.9);
        this.lampLights.push(l);
      }
    }
  }

  private makeKeyPickup(pos: Pos, color: KeyColor): Phaser.GameObjects.Container {
    const c = this.add.container(this.cellX(pos.x), this.cellY(pos.y));
    const glow = this.add
      .image(0, 0, 'glow')
      .setDisplaySize(T * 1.3, T * 1.3)
      .setTint(KeyColorHex[color])
      .setAlpha(0.45)
      .setBlendMode(Phaser.BlendModes.ADD);
    const key = this.add
      .image(0, 0, Tex.key)
      .setDisplaySize(T * 0.72, T * 0.72)
      .setTint(KeyColorHex[color]);
    c.add([glow, key]);
    this.tweens.add({
      targets: key,
      y: -T * 0.06,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 0.6 },
      scaleX: glow.scaleX * 1.15,
      scaleY: glow.scaleY * 1.15,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return c;
  }

  // ---------------------------------------------------------------------------
  // HUD & controls
  // ---------------------------------------------------------------------------

  private buildHud(): void {
    this.hudG = this.add.graphics().setDepth(Depth.HUD);
    this.titleText = makeText(this, 0, 0, `${this.level.id}. ${this.level.name}`, {
      size: 22,
      shadow: true,
      origin: [0, 0.5],
    }).setDepth(Depth.HUD + 1);
    this.subtitleText = makeText(this, 0, 0, this.level.subtitle, {
      size: 13,
      color: Css.muted,
      font: 'body',
      origin: [0, 0.5],
    }).setDepth(Depth.HUD + 1);
    this.movesText = makeText(this, 0, 0, '0', {
      size: 26,
      shadow: true,
      origin: [1, 0.5],
    }).setDepth(Depth.HUD + 1);
    this.movesLabel = makeText(this, 0, 0, `moves · par ${this.level.par}`, {
      size: 12,
      color: Css.muted,
      font: 'body',
      origin: [1, 0.5],
    }).setDepth(Depth.HUD + 1);

    this.keySlots = this.add.container(0, 0).setDepth(Depth.HUD + 1);
    this.treatIcon = this.add.image(0, 0, Tex.bone).setDepth(Depth.HUD + 1);
    this.treatText = makeText(this, 0, 0, `0/${this.board.totalTreats}`, {
      size: 18,
      origin: [0, 0.5],
      shadow: true,
    }).setDepth(Depth.HUD + 1);
    if (this.board.totalTreats === 0) {
      this.treatIcon.setVisible(false);
      this.treatText.setVisible(false);
    }

    this.pauseBtn = new Button(this, 0, 0, {
      width: 52,
      height: 52,
      icon: 'icon-pause',
      variant: 'secondary',
      onClick: () => this.togglePause(true),
    }).setDepth(Depth.HUD + 2);
    this.undoBtn = new Button(this, 0, 0, {
      width: 60,
      height: 60,
      icon: 'icon-undo',
      variant: 'secondary',
      silent: true,
      onClick: () => this.undo(),
    }).setDepth(Depth.HUD + 2);
    this.restartBtn = new Button(this, 0, 0, {
      width: 60,
      height: 60,
      icon: 'icon-restart',
      variant: 'secondary',
      onClick: () => this.restartLevel(),
    }).setDepth(Depth.HUD + 2);

    this.dpad = new DPad(this, 0, 0, 60).setDepth(Depth.HUD + 2);
    this.dpad.on('press', (dir: Dir) => {
      void audio.unlock();
      this.requestMove(dir);
    });
  }

  private buildPauseOverlay(): void {
    this.pauseC = this.add.container(0, 0).setDepth(Depth.Overlay).setVisible(false);
    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x0a0512, 0.7).setOrigin(0).setInteractive();
    this.pausePanel = this.add.graphics();
    this.pauseTitle = makeText(this, 0, 0, 'Paused', { size: 40, shadow: true });
    this.pauseC.add([this.pauseDim, this.pausePanel, this.pauseTitle]);

    const mk = (
      label: string,
      icon: string,
      variant: 'primary' | 'secondary' | 'ghost',
      fn: () => void,
    ) => {
      const btn = new Button(this, 0, 0, {
        width: 260,
        height: 58,
        label,
        icon,
        variant,
        onClick: fn,
      });
      this.pauseC.add(btn);
      this.pauseButtons.push(btn);
      return btn;
    };
    mk('Resume', 'icon-play', 'primary', () => this.togglePause(false));
    mk('Restart level', 'icon-restart', 'secondary', () => {
      this.togglePause(false);
      this.restartLevel();
    });
    mk('Level select', 'icon-grid', 'secondary', () => this.fadeTo('LevelSelect'));
    mk('Main menu', 'icon-home', 'ghost', () => this.fadeTo('Menu'));

    this.musicBtn = new Button(this, 0, 0, {
      width: 58,
      height: 58,
      icon: audio.musicOn ? 'icon-music-on' : 'icon-music-off',
      variant: 'ghost',
      onClick: () => {
        audio.setMusicOn(!audio.musicOn);
        this.musicBtn.setIcon(audio.musicOn ? 'icon-music-on' : 'icon-music-off');
      },
    });
    this.sfxBtn = new Button(this, 0, 0, {
      width: 58,
      height: 58,
      icon: audio.sfxOn ? 'icon-sfx-on' : 'icon-sfx-off',
      variant: 'ghost',
      onClick: () => {
        audio.setSfxOn(!audio.sfxOn);
        this.sfxBtn.setIcon(audio.sfxOn ? 'icon-sfx-on' : 'icon-sfx-off');
      },
    });
    this.pauseC.add([this.musicBtn, this.sfxBtn]);
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        d: Phaser.Input.Keyboard.KeyCodes.D,
      }) as Record<string, Phaser.Input.Keyboard.Key>;
      kb.on('keydown', (ev: KeyboardEvent) => {
        if (ev.repeat) return;
        switch (ev.code) {
          case 'ArrowUp':
          case 'KeyW':
            this.requestMove('up');
            break;
          case 'ArrowDown':
          case 'KeyS':
            this.requestMove('down');
            break;
          case 'ArrowLeft':
          case 'KeyA':
            this.requestMove('left');
            break;
          case 'ArrowRight':
          case 'KeyD':
            this.requestMove('right');
            break;
          case 'KeyZ':
          case 'KeyU':
          case 'Backspace':
            this.undo();
            break;
          case 'KeyR':
            this.restartLevel();
            break;
          case 'Escape':
          case 'KeyP':
            this.togglePause(!this.paused);
            break;
        }
        if (ev.code.startsWith('Arrow') || ev.code === 'Space') ev.preventDefault();
      });
    }

    // Swipe anywhere that is not a UI control.
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length > 0) return;
        this.swipe = { x: p.x, y: p.y, id: p.id, t: this.time.now };
      },
    );
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.swipe || this.swipe.id !== p.id) return;
      const dx = p.x - this.swipe.x;
      const dy = p.y - this.swipe.y;
      this.swipe = null;
      const dist = Math.hypot(dx, dy);
      if (dist < px(18)) return;
      const dir: Dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      this.requestMove(dir);
    });
    // Allow long drags to keep stepping (swipe-and-hold).
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.swipe || this.swipe.id !== p.id || !p.isDown) return;
      const dx = p.x - this.swipe.x;
      const dy = p.y - this.swipe.y;
      const threshold = Math.max(px(48), Math.min(this.W, this.H) * 0.14);
      if (Math.hypot(dx, dy) < threshold) return;
      const dir: Dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      this.swipe = { x: p.x, y: p.y, id: p.id, t: this.time.now };
      this.requestMove(dir);
    });
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  protected layout(): void {
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const portrait = this.isPortrait;

    // --- HUD bar --------------------------------------------------------------
    const hudH = 92 * ui;
    this.hudG.clear();
    this.hudG.fillStyle(0x120b1c, 0.72);
    this.hudG.fillRect(0, 0, W, hudH);
    this.hudG.fillStyle(Palette.violet, 0.5);
    this.hudG.fillRect(0, hudH - 2, W, 2);

    const pad = 14 * ui;
    const row1 = hudH * 0.34;
    const row2 = hudH * 0.74;
    this.pauseBtn.setPosition(pad + 26 * ui, row1).setScale(ui);
    this.titleText.setFontSize(Math.round(21 * ui)).setPosition(pad + 60 * ui, row1 - 9 * ui);
    this.subtitleText.setFontSize(Math.round(12 * ui)).setPosition(pad + 60 * ui, row1 + 11 * ui);
    this.movesText.setFontSize(Math.round(26 * ui)).setPosition(W - pad, row1 - 6 * ui);
    this.movesLabel.setFontSize(Math.round(11 * ui)).setPosition(W - pad, row1 + 14 * ui);

    this.keySlots.setPosition(pad + 60 * ui, row2);
    this.layoutKeyIcons();
    const treatSize = 26 * ui;
    this.treatIcon.setDisplaySize(treatSize, treatSize).setPosition(W - pad - 52 * ui, row2);
    this.treatText.setFontSize(Math.round(17 * ui)).setPosition(W - pad - 34 * ui, row2);

    // --- Controls -------------------------------------------------------------
    const padSize = Phaser.Math.Clamp(Math.min(W, H) * 0.15, px(46), px(68));
    this.dpad.setScale(padSize / 60);
    const foot = this.dpad.footprint * this.dpad.scaleX;
    const btnScale = Phaser.Math.Clamp(ui, px(0.85), px(1.2));
    this.undoBtn.setScale(btnScale);
    this.restartBtn.setScale(btnScale);

    const areaX = 0;
    const areaY = hudH;
    let areaW = W;
    let areaH = H - hudH;

    if (portrait) {
      const controlsH = foot + 22 * ui;
      areaH = H - hudH - controlsH;
      const cy = H - controlsH / 2 - 4;
      this.dpad.setPosition(W / 2, cy);
      const sideX = Math.max(38 * btnScale, (W / 2 - foot / 2) / 2);
      this.undoBtn.setPosition(sideX, cy);
      this.restartBtn.setPosition(W - sideX, cy);
    } else {
      const colW = foot + 48 * ui;
      areaW = W - colW;
      const cx = W - colW / 2;
      const cy = hudH + (H - hudH) * 0.6;
      this.dpad.setPosition(cx, cy);
      const by = cy - foot / 2 - 44 * btnScale;
      this.undoBtn.setPosition(cx - 40 * btnScale, by);
      this.restartBtn.setPosition(cx + 40 * btnScale, by);
    }

    // --- Board fit ------------------------------------------------------------
    const b = this.board;
    const inner = 18 * ui;
    const bw = b.width * T + T * 0.7;
    const bh = b.height * T + T * 0.7;
    const s = Math.min((areaW - inner * 2) / bw, (areaH - inner * 2) / bh, 1.1 * DPR);
    this.boardScale = s;
    this.boardC.setScale(s);
    this.boardC.setPosition(
      areaX + (areaW - b.width * T * s) / 2,
      areaY + (areaH - b.height * T * s) / 2,
    );
    this.updateLights();

    // --- Pause overlay --------------------------------------------------------
    this.pauseDim.setPosition(0, 0).setSize(W, H);
    const pw = Math.min(W - px(32), 360 * ui);
    const ph = 470 * ui;
    this.pausePanel.setPosition(W / 2, H / 2);
    drawPanel(this.pausePanel, { width: pw, height: ph, radius: 30 * ui });
    this.pauseTitle.setFontSize(Math.round(40 * ui)).setPosition(W / 2, H / 2 - ph / 2 + 54 * ui);
    this.pauseButtons.forEach((btn, i) => {
      btn.setScale(ui).setPosition(W / 2, H / 2 - ph / 2 + (126 + i * 70) * ui);
    });
    this.musicBtn.setScale(ui).setPosition(W / 2 - 40 * ui, H / 2 + ph / 2 - 52 * ui);
    this.sfxBtn.setScale(ui).setPosition(W / 2 + 40 * ui, H / 2 + ph / 2 - 52 * ui);

    if (this.hintText) {
      this.hintText.setPosition(W / 2, hudH + 22 * ui).setFontSize(Math.round(14 * ui));
    }
  }

  private layoutKeyIcons(): void {
    const ui = this.ui;
    const size = 30 * ui;
    this.keyIcons.forEach((icon, i) => {
      icon.setDisplaySize(size, size).setPosition(i * (size + 4 * ui) + size / 2, 0);
    });
  }

  private boardToWorld(lx: number, ly: number): { x: number; y: number } {
    return { x: this.boardC.x + lx * this.boardScale, y: this.boardC.y + ly * this.boardScale };
  }

  private updateLights(): void {
    if (!this.lightsOn) return;
    const s = this.boardScale;
    if (this.pugLight) {
      const p = this.boardToWorld(this.pugC.x, this.pugC.y);
      this.pugLight.setPosition(p.x, p.y - T * 0.15 * s).setRadius(T * 3.2 * s);
    }
    this.board.lamps.forEach((lp, i) => {
      const l = this.lampLights[i];
      if (!l) return;
      const p = this.boardToWorld(this.cellX(lp.x), this.cellY(lp.y) - T * 0.1);
      l.setPosition(p.x, p.y).setRadius(T * 2.6 * s);
    });
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------

  override update(time: number): void {
    if (this.paused || this.finished || this.animating) return;
    // Hold-to-move via D-pad or keyboard.
    let dir: Dir | null = this.dpad.heldDir;
    if (!dir && this.keys) {
      if (this.keys.up!.isDown || this.keys.w!.isDown) dir = 'up';
      else if (this.keys.down!.isDown || this.keys.s!.isDown) dir = 'down';
      else if (this.keys.left!.isDown || this.keys.a!.isDown) dir = 'left';
      else if (this.keys.right!.isDown || this.keys.d!.isDown) dir = 'right';
    }
    if (dir && time - this.lastHoldMove > MOVE_MS + 40) {
      this.doMove(dir);
    }
    this.updateLights();
  }

  private requestMove(dir: Dir): void {
    if (this.paused || this.finished) return;
    if (this.animating) {
      this.pendingDir = dir;
      return;
    }
    this.doMove(dir);
  }

  private doMove(dir: Dir): void {
    if (this.paused || this.finished) return;
    this.lastHoldMove = this.time.now;
    this.hideHint();
    const events = this.board.tryMove(dir);
    this.setFacing(dir);

    const blocked = events.find((e) => e.type === 'blocked');
    if (blocked && blocked.type === 'blocked') {
      this.animateBlocked(dir, blocked.reason);
      return;
    }
    if (!events.some((e) => e.type === 'moved')) return;

    this.animating = true;
    this.updateMovesText();
    this.undoBtn.setEnabled(true);

    // Immediate effects.
    for (const e of events) {
      if (e.type === 'unlocked') this.animateUnlock(e.at, e.color);
      if (e.type === 'pushed') this.animatePush(e.from, e.to);
    }
    if (events.some((e) => e.type === 'pushed')) sfx.push();
    else sfx.step();

    const to = this.board.pug;
    const target = { x: this.cellX(to.x), y: this.cellY(to.y) };
    this.tweens.add({
      targets: this.pugC,
      x: target.x,
      y: target.y,
      duration: MOVE_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => this.afterMove(events),
    });
    // Hop + squash.
    this.tweens.add({
      targets: this.pugBody,
      y: -T * 0.11,
      duration: MOVE_MS / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: this.pugBody,
      scaleX: { from: 1.06, to: 1 },
      scaleY: { from: 0.92, to: 1 },
      duration: MOVE_MS,
      ease: 'Sine.easeOut',
    });
    // Foot dust.
    const from = { x: this.pugC.x, y: this.pugC.y + T * 0.3 };
    this.dustE.explode(4, from.x, from.y);
  }

  private afterMove(events: MoveEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'pickedKey':
          this.animateKeyPickup(e.at, e.color);
          break;
        case 'treat':
          this.animateTreat(e.at);
          break;
        case 'buttonPressed':
          this.setButton(e.at, true);
          sfx.buttonPress();
          break;
        case 'buttonReleased':
          this.setButton(e.at, false);
          sfx.buttonRelease();
          break;
        case 'doorOpened':
          this.setDoor(e.at, true, true);
          break;
        case 'doorClosed':
          this.setDoor(e.at, false, true);
          break;
        default:
          break;
      }
    }
    this.animating = false;
    if (events.some((e) => e.type === 'win')) {
      this.onWin();
      return;
    }
    if (this.pendingDir) {
      const d = this.pendingDir;
      this.pendingDir = null;
      this.doMove(d);
    }
  }

  private animateBlocked(dir: Dir, reason: string): void {
    if (this.animating) return;
    this.animating = true;
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    this.tweens.add({
      targets: this.pugBody,
      x: v[0]! * T * 0.14,
      y: v[1]! * T * 0.14,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.pugBody.setPosition(0, 0);
        this.animating = false;
        if (this.pendingDir) {
          const d = this.pendingDir;
          this.pendingDir = null;
          this.doMove(d);
        }
      },
    });
    this.cameras.main.shake(70, 0.0025);
    if (reason === 'locked') {
      sfx.locked();
      const p = { x: this.board.pug.x + v[0]!, y: this.board.pug.y + v[1]! };
      const door = this.lockSprites.get(posKey(p));
      if (door) {
        this.tweens.add({
          targets: door,
          angle: { from: -3, to: 3 },
          duration: 50,
          yoyo: true,
          repeat: 2,
        });
        this.time.delayedCall(320, () => door.setAngle(0));
      }
      this.showHint('Locked! Find the matching key.');
    } else if (reason === 'door') {
      sfx.bump();
      this.showHint('Hold the button down to open this gate.');
    } else {
      sfx.bump();
    }
  }

  private animatePush(_from: Pos, to: Pos): void {
    // Box order in the model never changes, so sprites stay index-aligned.
    const idx = this.board.boxes.findIndex((b) => b.x === to.x && b.y === to.y);
    const sprite = idx >= 0 ? this.boxSprites[idx] : undefined;
    if (!sprite) return;
    this.tweens.killTweensOf(sprite);
    sprite.setDisplaySize(T * 0.98, T * 0.98);
    this.tweens.add({
      targets: sprite,
      x: this.cellX(to.x),
      y: this.cellY(to.y),
      duration: MOVE_MS,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: sprite,
      scaleX: { from: sprite.scaleX * 1.05, to: sprite.scaleX },
      scaleY: { from: sprite.scaleY * 0.95, to: sprite.scaleY },
      duration: MOVE_MS,
      ease: 'Back.easeOut',
    });
    this.dustE.explode(6, this.cellX(to.x), this.cellY(to.y) + T * 0.35);
  }

  private animateUnlock(at: Pos, color: KeyColor): void {
    const door = this.lockSprites.get(posKey(at));
    this.lockSprites.delete(posKey(at));
    sfx.unlock();
    this.removeKeyIcon(color);
    if (!door) return;
    this.sparkE.explode(16, door.x, door.y);
    this.tweens.add({
      targets: door,
      scaleX: door.scaleX * 0.2,
      scaleY: door.scaleY * 1.1,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => door.destroy(),
    });
  }

  private animateKeyPickup(at: Pos, color: KeyColor): void {
    const c = this.keySprites.get(posKey(at));
    this.keySprites.delete(posKey(at));
    sfx.keyPickup();
    this.sparkE.explode(14, this.cellX(at.x), this.cellY(at.y));
    if (c) {
      this.tweens.add({
        targets: c,
        y: c.y - T * 0.5,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () => c.destroy(),
      });
    }
    // HUD fly-in.
    const start = this.boardToWorld(this.cellX(at.x), this.cellY(at.y));
    const icon = this.add
      .image(start.x, start.y, Tex.key)
      .setTint(KeyColorHex[color])
      .setDisplaySize(T * 0.7 * this.boardScale, T * 0.7 * this.boardScale)
      .setDepth(Depth.HUD + 5);
    this.keyIcons.push(icon);
    icon.setData('color', color);
    const size = 30 * this.ui;
    const i = this.keyIcons.length - 1;
    const tx = this.keySlots.x + i * (size + 4 * this.ui) + size / 2;
    const ty = this.keySlots.y;
    this.tweens.add({
      targets: icon,
      x: tx,
      y: ty,
      displayWidth: size,
      displayHeight: size,
      duration: 480,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        icon.setPosition(0, 0);
        this.keySlots.add(icon);
        this.layoutKeyIcons();
        this.tweens.add({
          targets: icon,
          scaleX: icon.scaleX * 1.25,
          scaleY: icon.scaleY * 1.25,
          duration: 120,
          yoyo: true,
        });
      },
    });
  }

  private removeKeyIcon(color: KeyColor): void {
    const idx = this.keyIcons.findIndex((k) => k.getData('color') === color);
    if (idx < 0) return;
    const icon = this.keyIcons.splice(idx, 1)[0]!;
    this.tweens.add({
      targets: icon,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        icon.destroy();
        this.layoutKeyIcons();
      },
    });
  }

  private animateTreat(at: Pos): void {
    const img = this.treatSprites.get(posKey(at));
    this.treatSprites.delete(posKey(at));
    sfx.treat();
    this.sparkE.explode(10, this.cellX(at.x), this.cellY(at.y));
    if (img) {
      this.tweens.killTweensOf(img);
      this.tweens.add({
        targets: img,
        y: img.y - T * 0.6,
        alpha: 0,
        angle: 25,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => img.destroy(),
      });
    }
    this.treatText.setText(`${this.board.treatsCollected}/${this.board.totalTreats}`);
    this.tweens.add({
      targets: [this.treatText, this.treatIcon],
      scale: 1.3,
      duration: 120,
      yoyo: true,
    });
  }

  private setButton(at: Pos, pressed: boolean, animate = true): void {
    const img = this.buttonSprites.get(posKey(at));
    if (!img) return;
    const bt = this.board.buttonAt(at);
    img.setTexture(`button-${pressed ? 'down' : 'up'}-${bt?.channel ?? 0}`).setDisplaySize(T, T);
    if (animate && pressed) {
      const color = ChannelColorHex[bt?.channel ?? 0]!;
      this.sparkE.setParticleTint(color);
      this.sparkE.explode(8, img.x, img.y);
      this.sparkE.setParticleTint(0xffffff);
    }
  }

  private setDoor(at: Pos, open: boolean, animate: boolean): void {
    const view = this.doorViews.get(posKey(at));
    if (!view || view.open === open) return;
    view.open = open;
    const fullScale = T / view.bars.height;
    this.tweens.killTweensOf(view.bars);
    if (animate) {
      if (open) sfx.doorOpen();
      else sfx.doorClose();
    }
    this.tweens.add({
      targets: view.bars,
      scaleY: open ? fullScale * 0.06 : fullScale,
      alpha: open ? 0.5 : 1,
      duration: animate ? 300 : 0,
      ease: open ? 'Quad.easeIn' : 'Bounce.easeOut',
    });
    if (animate) {
      this.dustE.explode(8, view.frame.x, open ? view.frame.y - T * 0.35 : view.frame.y + T * 0.3);
    }
  }

  private setFacing(dir: Dir): void {
    switch (dir) {
      case 'up':
        this.pugSprite.setTexture(Tex.pugUp).setFlipX(false);
        break;
      case 'down':
        this.pugSprite.setTexture(Tex.pugDown).setFlipX(false);
        break;
      case 'left':
        this.pugSprite.setTexture(Tex.pugSide).setFlipX(true);
        break;
      case 'right':
        this.pugSprite.setTexture(Tex.pugSide).setFlipX(false);
        break;
    }
    this.pugSprite.setDisplaySize(T * 1.16, T * 1.16);
  }

  private startBreathing(): void {
    this.breathTween?.stop();
    this.breathTween = this.tweens.add({
      targets: this.pugSprite,
      scaleY: this.pugSprite.scaleY * 1.03,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private startBlinking(): void {
    const schedule = (): void => {
      this.blinkEvent = this.time.delayedCall(2200 + Math.random() * 3000, () => {
        if (!this.animating && !this.finished && this.board.facing === 'down') {
          this.pugSprite.setTexture(Tex.pugBlink).setDisplaySize(T * 1.16, T * 1.16);
          this.time.delayedCall(140, () => {
            if (
              !this.finished &&
              this.board.facing === 'down' &&
              this.pugSprite.texture.key === Tex.pugBlink
            ) {
              this.pugSprite.setTexture(Tex.pugDown).setDisplaySize(T * 1.16, T * 1.16);
            }
          });
        }
        schedule();
      });
    };
    schedule();
  }

  private updateMovesText(): void {
    this.movesText.setText(String(this.board.moves));
    this.movesText.setColor(this.board.moves > this.level.par ? '#ff9ab0' : Css.cream);
  }

  // ---------------------------------------------------------------------------
  // Undo / restart / pause
  // ---------------------------------------------------------------------------

  private undo(): void {
    if (this.finished || this.paused || this.animating) return;
    if (!this.board.undo()) {
      sfx.bump();
      return;
    }
    sfx.undo();
    this.syncAll(true);
    this.updateMovesText();
    this.undoBtn.setEnabled(this.board.canUndo);
  }

  private restartLevel(): void {
    if (this.finished) return;
    if (this.animating) {
      this.pendingDir = null;
    }
    this.board.restart();
    sfx.uiBack();
    this.cameras.main.flash(180, 26, 16, 39);
    this.syncAll(false);
    this.updateMovesText();
    this.undoBtn.setEnabled(false);
  }

  /** Rebuild every entity sprite from the board state (used after undo/restart). */
  private syncAll(animated: boolean): void {
    const b = this.board;
    this.tweens.killTweensOf(this.pugC);
    this.tweens.killTweensOf(this.pugBody);
    this.pugBody.setPosition(0, 0).setScale(1);
    this.animating = false;
    this.pendingDir = null;
    this.setFacing(b.facing);
    const dur = animated ? 160 : 0;
    this.tweens.add({
      targets: this.pugC,
      x: this.cellX(b.pug.x),
      y: this.cellY(b.pug.y),
      duration: dur,
    });

    // Boxes.
    b.boxes.forEach((bx, i) => {
      const s = this.boxSprites[i];
      if (!s) return;
      this.tweens.killTweensOf(s);
      s.setDisplaySize(T * 0.98, T * 0.98);
      this.tweens.add({ targets: s, x: this.cellX(bx.x), y: this.cellY(bx.y), duration: dur });
    });

    // Keys on the floor.
    for (const k of b.keys) {
      const key = posKey(k.pos);
      if (!this.keySprites.has(key)) {
        const c = this.makeKeyPickup(k.pos, k.color);
        this.keySprites.set(key, c);
        this.boardC.addAt(c, this.boardC.getIndex(this.pugC));
      }
    }
    // Locked doors.
    for (const d of b.lockedDoors) {
      const key = posKey(d.pos);
      if (!this.lockSprites.has(key)) {
        const img = this.add
          .image(this.cellX(d.pos.x), this.cellY(d.pos.y), `locked-${d.color}`)
          .setDisplaySize(T, T);
        this.lockSprites.set(key, this.lit(img));
        this.boardC.addAt(img, this.boardC.getIndex(this.pugC));
      }
    }
    // Treats.
    for (const t of b.treats) {
      const key = posKey(t);
      if (!this.treatSprites.has(key)) {
        const img = this.add
          .image(this.cellX(t.x), this.cellY(t.y), Tex.bone)
          .setDisplaySize(T * 0.62, T * 0.62);
        this.treatSprites.set(key, img);
        this.boardC.addAt(img, this.boardC.getIndex(this.pugC));
        this.tweens.add({
          targets: img,
          y: img.y - T * 0.05,
          angle: { from: -6, to: 6 },
          duration: 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    this.treatText.setText(`${b.treatsCollected}/${b.totalTreats}`);

    // Held keys in HUD.
    this.keyIcons.forEach((k) => k.destroy());
    this.keyIcons = [];
    for (const color of b.heldKeys) {
      const icon = this.add.image(0, 0, Tex.key).setTint(KeyColorHex[color]);
      icon.setData('color', color);
      this.keyIcons.push(icon);
      this.keySlots.add(icon);
    }
    this.layoutKeyIcons();

    // Buttons and doors.
    for (const bt of b.buttons) this.setButton(bt.pos, b.isButtonPressed(bt), false);
    for (const d of b.toggleDoors) this.setDoor(d.pos, b.isToggleDoorOpen(d), false);
  }

  private togglePause(on: boolean): void {
    if (this.finished) return;
    this.paused = on;
    this.pauseC.setVisible(on);
    if (on) {
      this.pauseC.setAlpha(0);
      this.tweens.add({ targets: this.pauseC, alpha: 1, duration: 160 });
      this.musicBtn.setIcon(audio.musicOn ? 'icon-music-on' : 'icon-music-off');
      this.sfxBtn.setIcon(audio.sfxOn ? 'icon-sfx-on' : 'icon-sfx-off');
    }
  }

  // ---------------------------------------------------------------------------
  // Win
  // ---------------------------------------------------------------------------

  private onWin(): void {
    this.finished = true;
    this.pendingDir = null;
    sfx.win();
    this.pugSprite
      .setTexture(Tex.pugHappy)
      .setFlipX(false)
      .setDisplaySize(T * 1.16, T * 1.16);
    this.confettiE.explode(60, this.pugC.x, this.pugC.y - T * 0.2);
    this.sparkE.explode(24, this.pugC.x, this.pugC.y);
    this.tweens.add({
      targets: this.pugBody,
      y: -T * 0.35,
      duration: 260,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: this.boardC,
      scaleX: this.boardScale * 1.025,
      scaleY: this.boardScale * 1.025,
      duration: 220,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    this.cameras.main.flash(260, 255, 240, 220);

    const stars = computeStars(
      this.board.moves,
      this.level.par,
      this.board.treatsCollected,
      this.board.totalTreats,
    );
    recordLevelResult(this.levelIndex, TOTAL_LEVELS, {
      bestMoves: this.board.moves,
      stars,
      treats: this.board.treatsCollected,
    });

    this.time.delayedCall(1100, () => {
      this.scene.launch('LevelComplete', {
        levelIndex: this.levelIndex,
        moves: this.board.moves,
        par: this.level.par,
        treats: this.board.treatsCollected,
        totalTreats: this.board.totalTreats,
        stars,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Hints & banner
  // ---------------------------------------------------------------------------

  private showLevelBanner(): void {
    const ui = this.ui;
    const c = this.add.container(this.W / 2, this.H * 0.42).setDepth(Depth.Overlay);
    const g = this.add.graphics();
    const w = Math.min(this.W - px(40), 420 * ui);
    drawPanel(g, { width: w, height: 110 * ui, radius: 24 * ui, alpha: 0.92 });
    const t1 = makeText(this, 0, -18 * ui, `Level ${this.level.id}`, {
      size: 18 * ui,
      color: Css.gold,
    });
    const t2 = makeText(this, 0, 16 * ui, this.level.name, { size: 32 * ui, shadow: true });
    c.add([g, t1, t2]);
    c.setAlpha(0).setScale(0.9);
    this.tweens.add({
      targets: c,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.time.delayedCall(1300, () => {
      this.tweens.add({
        targets: c,
        alpha: 0,
        y: c.y - 30 * ui,
        duration: 300,
        onComplete: () => c.destroy(),
      });
    });
  }

  private showHint(text: string): void {
    if (this.hintText) {
      this.hintText.setText(text);
      this.hintText.setAlpha(1);
      return;
    }
    this.hintText = makeText(this, this.W / 2, 92 * this.ui + 22 * this.ui, text, {
      size: 14 * this.ui,
      color: Css.gold,
      font: 'body',
      shadow: true,
    }).setDepth(Depth.HUD + 3);
    this.hintText.setAlpha(0);
    this.tweens.add({ targets: this.hintText, alpha: 1, duration: 200 });
  }

  private hideHint(): void {
    if (!this.hintText) return;
    const t = this.hintText;
    this.hintText = undefined;
    this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
  }
}
