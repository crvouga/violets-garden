/** Persistent progress and settings stored in localStorage. */

export interface LevelResult {
  bestMoves: number;
  stars: number;
  treats: number;
}

export interface SaveData {
  version: 1;
  levels: Record<number, LevelResult>;
  unlocked: number;
  musicOn: boolean;
  sfxOn: boolean;
}

const KEY = 'violet-pug-save-v1';

const defaults = (): SaveData => ({
  version: 1,
  levels: {},
  unlocked: 1,
  musicOn: true,
  sfxOn: true,
});

let cache: SaveData | null = null;

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  if (cache) return cache;
  const storage = safeStorage();
  if (!storage) {
    cache = defaults();
    return cache;
  }
  try {
    const raw = storage.getItem(KEY);
    if (!raw) {
      cache = defaults();
    } else {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      cache = { ...defaults(), ...parsed, levels: parsed.levels ?? {} };
    }
  } catch {
    cache = defaults();
  }
  return cache;
}

export function writeSave(data: SaveData): void {
  cache = data;
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode errors */
  }
}

export function recordLevelResult(
  levelIndex: number,
  totalLevels: number,
  result: LevelResult,
): SaveData {
  const data = loadSave();
  const prev = data.levels[levelIndex];
  const merged: LevelResult = prev
    ? {
        bestMoves: Math.min(prev.bestMoves, result.bestMoves),
        stars: Math.max(prev.stars, result.stars),
        treats: Math.max(prev.treats, result.treats),
      }
    : result;
  data.levels[levelIndex] = merged;
  data.unlocked = Math.max(data.unlocked, Math.min(totalLevels, levelIndex + 2));
  writeSave(data);
  return data;
}

export function setAudioSettings(partial: Partial<Pick<SaveData, 'musicOn' | 'sfxOn'>>): SaveData {
  const data = { ...loadSave(), ...partial };
  writeSave(data);
  return data;
}

export function resetSave(): SaveData {
  const data = defaults();
  writeSave(data);
  return data;
}
