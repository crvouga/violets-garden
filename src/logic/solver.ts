import { Board, type Dir } from './board';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

export interface Solution {
  moves: Dir[];
  /** Minimal moves when also collecting every treat (undefined if impossible). */
  movesAllTreats?: Dir[];
}

/**
 * Breadth-first search over board states. Returns the shortest move sequence
 * to reach the exit, or null when the level cannot be solved.
 * When `requireTreats` is true, the exit only counts once all treats are taken.
 */
export function solve(map: string[], requireTreats = false, maxStates = 400_000): Dir[] | null {
  const start = new Board(map);
  const startKey = start.stateKey();
  const visited = new Set<string>([startKey]);
  const queue: Array<{ snap: ReturnType<Board['snapshot']>; path: Dir[] }> = [
    { snap: start.snapshot(), path: [] },
  ];
  const board = new Board(map);

  while (queue.length) {
    const { snap, path } = queue.shift()!;
    for (const dir of DIRS) {
      board.restore(snap);
      const events = board.tryMove(dir);
      if (!events.some((e) => e.type === 'moved')) continue;
      const won = events.some((e) => e.type === 'win');
      const treatsDone = board.treats.length === 0;
      if (won) {
        if (!requireTreats || treatsDone) return [...path, dir];
        continue; // exit reached too early; not a valid state to expand
      }
      const key = board.stateKey();
      if (visited.has(key)) continue;
      visited.add(key);
      if (visited.size > maxStates) return null;
      queue.push({ snap: board.snapshot(), path: [...path, dir] });
    }
  }
  return null;
}
