/**
 * Pure, framework-free grid model for the puzzle game.
 *
 * Legend (ASCII maps):
 *   '#' wall            'L' wall with lamp      ' ' void (outside)
 *   '.' floor           'P' pug start           'X' exit (dog bed)
 *   'B' box             't' treat (bone)
 *   'k' gold key        'K' gold locked door
 *   'c' teal key        'C' teal locked door
 *   'v' violet key      'V' violet locked door
 *   'b' button ch 0     'D' toggle door ch 0
 *   'o' button ch 1     'O' toggle door ch 1
 *
 * A toggle door is open while every button on its channel is weighed down
 * (by the pug or a box). A door that is currently occupied is always passable.
 */

import type { KeyColor } from '../config';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Pos {
  x: number;
  y: number;
}

export const DIR_VECTORS: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type Terrain = 'void' | 'floor' | 'wall';

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  par: number;
  map: string[];
}

export type MoveEvent =
  | { type: 'moved'; from: Pos; to: Pos; dir: Dir }
  | { type: 'pushed'; from: Pos; to: Pos; dir: Dir }
  | { type: 'blocked'; dir: Dir; reason: 'wall' | 'box' | 'door' | 'locked' | 'edge' }
  | { type: 'pickedKey'; at: Pos; color: KeyColor }
  | { type: 'unlocked'; at: Pos; color: KeyColor }
  | { type: 'treat'; at: Pos }
  | { type: 'buttonPressed'; at: Pos; channel: number }
  | { type: 'buttonReleased'; at: Pos; channel: number }
  | { type: 'doorOpened'; at: Pos; channel: number }
  | { type: 'doorClosed'; at: Pos; channel: number }
  | { type: 'win'; at: Pos };

export interface BoardSnapshot {
  pug: Pos;
  facing: Dir;
  boxes: Pos[];
  keys: Array<{ pos: Pos; color: KeyColor }>;
  lockedDoors: Array<{ pos: Pos; color: KeyColor }>;
  treats: Pos[];
  heldKeys: KeyColor[];
  moves: number;
  won: boolean;
}

export const posKey = (p: Pos): string => `${p.x},${p.y}`;
export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;

const KEY_CHARS: Record<string, KeyColor> = { k: 'gold', c: 'teal', v: 'violet' };
const LOCK_CHARS: Record<string, KeyColor> = { K: 'gold', C: 'teal', V: 'violet' };
const BUTTON_CHARS: Record<string, number> = { b: 0, o: 1 };
const TDOOR_CHARS: Record<string, number> = { D: 0, O: 1 };

export class Board {
  readonly width: number;
  readonly height: number;
  readonly terrain: Terrain[][];
  readonly lamps: Pos[] = [];
  readonly buttons: Array<{ pos: Pos; channel: number }> = [];
  readonly toggleDoors: Array<{ pos: Pos; channel: number }> = [];
  readonly exit: Pos;
  readonly totalTreats: number;

  pug: Pos;
  facing: Dir = 'down';
  boxes: Pos[] = [];
  keys: Array<{ pos: Pos; color: KeyColor }> = [];
  lockedDoors: Array<{ pos: Pos; color: KeyColor }> = [];
  treats: Pos[] = [];
  heldKeys: KeyColor[] = [];
  moves = 0;
  won = false;

  private history: BoardSnapshot[] = [];
  private readonly initial: BoardSnapshot;

  constructor(map: string[]) {
    this.height = map.length;
    this.width = Math.max(...map.map((r) => r.length));
    this.terrain = [];
    let pug: Pos | null = null;
    let exit: Pos | null = null;

    for (let y = 0; y < this.height; y++) {
      const row: Terrain[] = [];
      const line = map[y] ?? '';
      for (let x = 0; x < this.width; x++) {
        const ch = line[x] ?? ' ';
        const pos = { x, y };
        switch (ch) {
          case ' ':
            row.push('void');
            break;
          case '#':
            row.push('wall');
            break;
          case 'L':
            row.push('wall');
            this.lamps.push(pos);
            break;
          case 'P':
            row.push('floor');
            pug = pos;
            break;
          case 'X':
            row.push('floor');
            exit = pos;
            break;
          case 'B':
            row.push('floor');
            this.boxes.push(pos);
            break;
          case 't':
            row.push('floor');
            this.treats.push(pos);
            break;
          case '.':
            row.push('floor');
            break;
          default: {
            row.push('floor');
            const key = KEY_CHARS[ch];
            const lock = LOCK_CHARS[ch];
            const button = BUTTON_CHARS[ch];
            const tdoor = TDOOR_CHARS[ch];
            if (key) this.keys.push({ pos, color: key });
            else if (lock) this.lockedDoors.push({ pos, color: lock });
            else if (button !== undefined) this.buttons.push({ pos, channel: button });
            else if (tdoor !== undefined) this.toggleDoors.push({ pos, channel: tdoor });
            else throw new Error(`Unknown map character '${ch}' at ${x},${y}`);
          }
        }
      }
      this.terrain.push(row);
    }

    if (!pug) throw new Error('Level has no pug start (P)');
    if (!exit) throw new Error('Level has no exit (X)');
    this.pug = pug;
    this.exit = exit;
    this.totalTreats = this.treats.length;
    this.initial = this.snapshot();
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  inBounds(p: Pos): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }

  terrainAt(p: Pos): Terrain {
    if (!this.inBounds(p)) return 'void';
    return this.terrain[p.y]?.[p.x] ?? 'void';
  }

  isWall(p: Pos): boolean {
    return this.terrainAt(p) === 'wall';
  }

  isFloor(p: Pos): boolean {
    return this.terrainAt(p) === 'floor';
  }

  boxAt(p: Pos): number {
    return this.boxes.findIndex((b) => samePos(b, p));
  }

  keyAt(p: Pos): number {
    return this.keys.findIndex((k) => samePos(k.pos, p));
  }

  lockedDoorAt(p: Pos): number {
    return this.lockedDoors.findIndex((d) => samePos(d.pos, p));
  }

  treatAt(p: Pos): number {
    return this.treats.findIndex((t) => samePos(t, p));
  }

  buttonAt(p: Pos): { pos: Pos; channel: number } | undefined {
    return this.buttons.find((b) => samePos(b.pos, p));
  }

  toggleDoorAt(p: Pos): { pos: Pos; channel: number } | undefined {
    return this.toggleDoors.find((d) => samePos(d.pos, p));
  }

  isExit(p: Pos): boolean {
    return samePos(p, this.exit);
  }

  /** True when the pug or a box is standing on the cell. */
  isOccupied(p: Pos): boolean {
    return samePos(this.pug, p) || this.boxAt(p) >= 0;
  }

  isButtonPressed(button: { pos: Pos }): boolean {
    return this.isOccupied(button.pos);
  }

  /** Channel is satisfied when all of its buttons are pressed. */
  isChannelActive(channel: number): boolean {
    const group = this.buttons.filter((b) => b.channel === channel);
    if (group.length === 0) return false;
    return group.every((b) => this.isButtonPressed(b));
  }

  /** A toggle door is open when its channel is active or when something occupies it. */
  isToggleDoorOpen(door: { pos: Pos; channel: number }): boolean {
    return this.isChannelActive(door.channel) || this.isOccupied(door.pos);
  }

  hasKey(color: KeyColor): boolean {
    return this.heldKeys.includes(color);
  }

  get treatsCollected(): number {
    return this.totalTreats - this.treats.length;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  snapshot(): BoardSnapshot {
    return {
      pug: { ...this.pug },
      facing: this.facing,
      boxes: this.boxes.map((b) => ({ ...b })),
      keys: this.keys.map((k) => ({ pos: { ...k.pos }, color: k.color })),
      lockedDoors: this.lockedDoors.map((d) => ({ pos: { ...d.pos }, color: d.color })),
      treats: this.treats.map((t) => ({ ...t })),
      heldKeys: [...this.heldKeys],
      moves: this.moves,
      won: this.won,
    };
  }

  restore(s: BoardSnapshot): void {
    this.pug = { ...s.pug };
    this.facing = s.facing;
    this.boxes = s.boxes.map((b) => ({ ...b }));
    this.keys = s.keys.map((k) => ({ pos: { ...k.pos }, color: k.color }));
    this.lockedDoors = s.lockedDoors.map((d) => ({ pos: { ...d.pos }, color: d.color }));
    this.treats = s.treats.map((t) => ({ ...t }));
    this.heldKeys = [...s.heldKeys];
    this.moves = s.moves;
    this.won = s.won;
  }

  /** Undo the last successful move. Returns false when there is nothing to undo. */
  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.restore(prev);
    return true;
  }

  restart(): void {
    this.history = [];
    this.restore(this.initial);
  }

  /** Serialized state key; useful for solvers and tests. */
  stateKey(): string {
    const boxes = this.boxes.map(posKey).sort().join(';');
    const keys = this.keys
      .map((k) => posKey(k.pos))
      .sort()
      .join(';');
    const doors = this.lockedDoors
      .map((d) => posKey(d.pos))
      .sort()
      .join(';');
    const treats = this.treats.map(posKey).sort().join(';');
    const held = [...this.heldKeys].sort().join(',');
    return `${posKey(this.pug)}|${boxes}|${keys}|${doors}|${treats}|${held}`;
  }

  /**
   * Attempt to move the pug one cell. Returns the list of events that occurred.
   * A blocked attempt still updates facing and emits a single 'blocked' event.
   */
  tryMove(dir: Dir): MoveEvent[] {
    const events: MoveEvent[] = [];
    if (this.won) return events;

    this.facing = dir;
    const v = DIR_VECTORS[dir];
    const from = { ...this.pug };
    const target = { x: from.x + v.x, y: from.y + v.y };

    if (!this.inBounds(target) || this.terrainAt(target) === 'void') {
      events.push({ type: 'blocked', dir, reason: 'edge' });
      return events;
    }
    if (this.isWall(target)) {
      events.push({ type: 'blocked', dir, reason: 'wall' });
      return events;
    }

    const lockedIdx = this.lockedDoorAt(target);
    let unlocking: KeyColor | null = null;
    if (lockedIdx >= 0) {
      const color = this.lockedDoors[lockedIdx]!.color;
      if (!this.hasKey(color)) {
        events.push({ type: 'blocked', dir, reason: 'locked' });
        return events;
      }
      unlocking = color;
    }

    const tdoor = this.toggleDoorAt(target);
    if (tdoor && !this.isToggleDoorOpen(tdoor)) {
      events.push({ type: 'blocked', dir, reason: 'door' });
      return events;
    }

    const boxIdx = this.boxAt(target);
    let pushTo: Pos | null = null;
    if (boxIdx >= 0) {
      const beyond = { x: target.x + v.x, y: target.y + v.y };
      if (!this.canBoxEnter(beyond)) {
        events.push({ type: 'blocked', dir, reason: 'box' });
        return events;
      }
      pushTo = beyond;
    }

    // ---- Commit the move -----------------------------------------------------
    const before = this.captureSwitchState();
    this.history.push(this.snapshot());

    if (unlocking) {
      this.lockedDoors.splice(lockedIdx, 1);
      const idx = this.heldKeys.indexOf(unlocking);
      if (idx >= 0) this.heldKeys.splice(idx, 1);
      events.push({ type: 'unlocked', at: { ...target }, color: unlocking });
    }

    if (pushTo && boxIdx >= 0) {
      this.boxes[boxIdx] = { ...pushTo };
      events.push({ type: 'pushed', from: { ...target }, to: { ...pushTo }, dir });
    }

    this.pug = { ...target };
    this.moves += 1;
    events.push({ type: 'moved', from, to: { ...target }, dir });

    const keyIdx = this.keyAt(target);
    if (keyIdx >= 0) {
      const color = this.keys[keyIdx]!.color;
      this.keys.splice(keyIdx, 1);
      this.heldKeys.push(color);
      events.push({ type: 'pickedKey', at: { ...target }, color });
    }

    const treatIdx = this.treatAt(target);
    if (treatIdx >= 0) {
      this.treats.splice(treatIdx, 1);
      events.push({ type: 'treat', at: { ...target } });
    }

    events.push(...this.diffSwitchState(before));

    if (this.isExit(target)) {
      this.won = true;
      events.push({ type: 'win', at: { ...target } });
    }

    return events;
  }

  /** Whether a box may be pushed into the given cell. */
  canBoxEnter(p: Pos): boolean {
    if (!this.inBounds(p)) return false;
    if (this.terrainAt(p) !== 'floor') return false;
    if (this.boxAt(p) >= 0) return false;
    if (this.lockedDoorAt(p) >= 0) return false;
    if (this.keyAt(p) >= 0) return false;
    if (this.treatAt(p) >= 0) return false;
    if (this.isExit(p)) return false;
    const tdoor = this.toggleDoorAt(p);
    if (tdoor && !this.isChannelActive(tdoor.channel)) return false;
    return true;
  }

  private captureSwitchState(): { buttons: boolean[]; doors: boolean[] } {
    return {
      buttons: this.buttons.map((b) => this.isButtonPressed(b)),
      doors: this.toggleDoors.map((d) => this.isToggleDoorOpen(d)),
    };
  }

  private diffSwitchState(before: { buttons: boolean[]; doors: boolean[] }): MoveEvent[] {
    const out: MoveEvent[] = [];
    this.buttons.forEach((b, i) => {
      const now = this.isButtonPressed(b);
      if (now !== before.buttons[i]) {
        out.push({
          type: now ? 'buttonPressed' : 'buttonReleased',
          at: { ...b.pos },
          channel: b.channel,
        });
      }
    });
    this.toggleDoors.forEach((d, i) => {
      const now = this.isToggleDoorOpen(d);
      if (now !== before.doors[i]) {
        out.push({ type: now ? 'doorOpened' : 'doorClosed', at: { ...d.pos }, channel: d.channel });
      }
    });
    return out;
  }
}

/** Star rating: reaching the exit (1) + all treats (1) + within par (1). */
export function computeStars(moves: number, par: number, treats: number, totalTreats: number) {
  let stars = 1;
  if (treats >= totalTreats) stars += 1;
  if (moves <= par) stars += 1;
  return stars;
}
