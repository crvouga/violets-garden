import { describe, expect, it } from 'vitest';
import { Board, computeStars } from './board';
import { LEVELS } from '../levels';
import { solve } from './solver';

const tiny = (rows: string[]) => new Board(rows);

describe('Board movement', () => {
  it('moves onto floor and blocks on walls', () => {
    const b = tiny(['#####', '#P.X#', '#####']);
    expect(b.tryMove('up').some((e) => e.type === 'blocked')).toBe(true);
    const ev = b.tryMove('right');
    expect(ev.some((e) => e.type === 'moved')).toBe(true);
    expect(b.pug).toEqual({ x: 2, y: 1 });
    expect(b.moves).toBe(1);
  });

  it('wins when reaching the exit', () => {
    const b = tiny(['####', '#PX#', '####']);
    const ev = b.tryMove('right');
    expect(ev.some((e) => e.type === 'win')).toBe(true);
    expect(b.won).toBe(true);
    expect(b.tryMove('left')).toEqual([]);
  });

  it('pushes boxes and refuses to push into walls, boxes or the exit', () => {
    const b = tiny(['#######', '#PB..X#', '#######']);
    expect(b.tryMove('right').some((e) => e.type === 'pushed')).toBe(true);
    expect(b.boxes[0]).toEqual({ x: 3, y: 1 });
    b.tryMove('right');
    expect(b.boxes[0]).toEqual({ x: 4, y: 1 });
    // box now adjacent to exit: cannot push onto exit
    const blocked = b.tryMove('right');
    expect(blocked).toEqual([{ type: 'blocked', dir: 'right', reason: 'box' }]);

    const two = tiny(['#######', '#PBB.X#', '#######']);
    expect(two.tryMove('right')[0]).toMatchObject({ type: 'blocked', reason: 'box' });
  });

  it('collects keys and unlocks matching doors, consuming the key', () => {
    const b = tiny(['#######', '#PkK.X#', '#######']);
    expect(b.tryMove('right').some((e) => e.type === 'pickedKey')).toBe(true);
    expect(b.heldKeys).toEqual(['gold']);
    const ev = b.tryMove('right');
    expect(ev.some((e) => e.type === 'unlocked')).toBe(true);
    expect(b.heldKeys).toEqual([]);
    expect(b.lockedDoors).toHaveLength(0);
  });

  it('blocks locked doors of another colour', () => {
    const b = tiny(['#######', '#PkC.X#', '#######']);
    b.tryMove('right');
    expect(b.tryMove('right')[0]).toMatchObject({ type: 'blocked', reason: 'locked' });
  });

  it('opens toggle doors while a button is held and closes them after', () => {
    const b = tiny(['#######', '#PbD.X#', '#######']);
    let ev = b.tryMove('right'); // step onto button
    expect(ev.some((e) => e.type === 'buttonPressed')).toBe(true);
    expect(ev.some((e) => e.type === 'doorOpened')).toBe(true);
    ev = b.tryMove('right'); // into doorway (still occupied => open)
    expect(ev.some((e) => e.type === 'moved')).toBe(true);
    expect(ev.some((e) => e.type === 'buttonReleased')).toBe(true);
    expect(ev.some((e) => e.type === 'doorClosed')).toBe(false); // occupied, stays open
    ev = b.tryMove('right'); // leave doorway
    expect(ev.some((e) => e.type === 'doorClosed')).toBe(true);
    // walking back into the closed door is blocked
    expect(b.tryMove('left')[0]).toMatchObject({ type: 'blocked', reason: 'door' });
  });

  it('keeps toggle doors open while a box holds the button', () => {
    const b = tiny(['########', '#PBb.D.#', '#.....X#', '########']);
    b.tryMove('right'); // push box onto button
    expect(b.isChannelActive(0)).toBe(true);
    b.tryMove('down');
    b.tryMove('right');
    b.tryMove('right');
    b.tryMove('right');
    b.tryMove('up'); // onto the open door
    expect(b.pug).toEqual({ x: 5, y: 1 });
  });

  it('requires all buttons on a channel to be pressed', () => {
    const b = tiny(['########', '#Pb.bDX#', '########']);
    b.tryMove('right');
    expect(b.isChannelActive(0)).toBe(false);
  });

  it('undo restores full state including keys, boxes and moves', () => {
    const b = tiny(['#######', '#PkBX.#', '#######']);
    const before = b.stateKey();
    b.tryMove('right'); // key
    b.tryMove('right'); // push box onto x=4? exit -> blocked
    expect(b.moves).toBe(1);
    expect(b.undo()).toBe(true);
    expect(b.stateKey()).toBe(before);
    expect(b.heldKeys).toEqual([]);
    expect(b.undo()).toBe(false);
  });

  it('restart returns to the initial layout', () => {
    const b = tiny(['#######', '#PBt.X#', '#######']);
    const initial = b.stateKey();
    b.tryMove('right');
    b.tryMove('right');
    b.restart();
    expect(b.stateKey()).toBe(initial);
    expect(b.canUndo).toBe(false);
  });

  it('computes stars', () => {
    expect(computeStars(10, 12, 1, 1)).toBe(3);
    expect(computeStars(14, 12, 1, 1)).toBe(2);
    expect(computeStars(14, 12, 0, 1)).toBe(1);
  });
});

describe('Levels', () => {
  for (const level of LEVELS) {
    it(`level ${level.id} "${level.name}" parses, is solvable and par is fair`, () => {
      const board = new Board(level.map);
      expect(board.width).toBeLessThanOrEqual(9);
      const solution = solve(level.map);
      expect(solution, 'level must be solvable').not.toBeNull();
      const withTreats = solve(level.map, true);
      expect(withTreats, 'all treats must be collectable before the exit').not.toBeNull();
      // Par should be reachable while collecting all treats (3-star run possible).
      expect(withTreats!.length).toBeLessThanOrEqual(level.par);
      // ...but not absurdly generous either.
      expect(level.par).toBeLessThanOrEqual(withTreats!.length + 12);
      // Replay solution to double check the board agrees.
      for (const dir of withTreats!) board.tryMove(dir);
      expect(board.won).toBe(true);
      expect(board.treats).toHaveLength(0);
      console.log(
        `Level ${level.id}: optimal ${solution!.length}, with treats ${withTreats!.length}, par ${level.par}`,
      );
    });
  }
});
