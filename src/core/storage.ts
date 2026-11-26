import { ALL_LEVEL_IDS, LevelId, SAVE_STORAGE_KEY, SaveDataV1 } from './types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const VALID_LEVEL_SET = new Set<string>(ALL_LEVEL_IDS);

export function createDefaultSave(): SaveDataV1 {
  return {
    version: 1,
    unlockedLevelIndex: 0,
    allUnlockedPreview: false,
    clearedLevels: [],
    collectedYarns: [],
    heroBonded: false,
    bestScores: {},
    muted: false,
  };
}

function getSafeStorage(custom?: StorageLike): StorageLike | null {
  if (custom) return custom;
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeLevelIds(raw: unknown): LevelId[] {
  if (!Array.isArray(raw)) return [];
  const out: LevelId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item === 'string' && VALID_LEVEL_SET.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item as LevelId);
    }
  }
  return out;
}

export function loadSave(customStorage?: StorageLike): SaveDataV1 {
  const storage = getSafeStorage(customStorage);
  if (!storage) return createDefaultSave();
  try {
    const rawText = storage.getItem(SAVE_STORAGE_KEY);
    if (!rawText) return createDefaultSave();
    const parsed: unknown = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') return createDefaultSave();
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1) return createDefaultSave();

    const unlocked =
      typeof obj.unlockedLevelIndex === 'number' && Number.isFinite(obj.unlockedLevelIndex)
        ? Math.max(0, Math.min(ALL_LEVEL_IDS.length - 1, Math.floor(obj.unlockedLevelIndex)))
        : 0;

    const bestScores: Partial<Record<LevelId, number>> = {};
    if (obj.bestScores && typeof obj.bestScores === 'object') {
      for (const [k, v] of Object.entries(obj.bestScores as Record<string, unknown>)) {
        if (VALID_LEVEL_SET.has(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          bestScores[k as LevelId] = Math.floor(v);
        }
      }
    }

    return {
      version: 1,
      unlockedLevelIndex: unlocked,
      allUnlockedPreview: Boolean(obj.allUnlockedPreview),
      clearedLevels: sanitizeLevelIds(obj.clearedLevels),
      collectedYarns: sanitizeLevelIds(obj.collectedYarns),
      heroBonded: Boolean(obj.heroBonded),
      bestScores,
      muted: Boolean(obj.muted),
    };
  } catch {
    return createDefaultSave();
  }
}

export function persistSave(data: SaveDataV1, customStorage?: StorageLike): void {
  const storage = getSafeStorage(customStorage);
  if (!storage) return;
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 忽略無痕模式或配額限制
  }
}

export function recordLevelClear(
  save: SaveDataV1,
  levelId: LevelId,
  levelIndex: number,
  score: number,
  yarnCollected: boolean,
  heroBonded: boolean,
): SaveDataV1 {
  const clearedLevels = save.clearedLevels.includes(levelId)
    ? [...save.clearedLevels]
    : [...save.clearedLevels, levelId];

  const collectedYarns =
    yarnCollected && !save.collectedYarns.includes(levelId)
      ? [...save.collectedYarns, levelId]
      : [...save.collectedYarns];

  const prevBest = save.bestScores[levelId] ?? 0;
  const bestScores: Partial<Record<LevelId, number>> = {
    ...save.bestScores,
    [levelId]: Math.max(prevBest, Math.floor(score)),
  };

  return {
    ...save,
    unlockedLevelIndex: Math.min(ALL_LEVEL_IDS.length - 1, Math.max(save.unlockedLevelIndex, levelIndex + 1)),
    clearedLevels,
    collectedYarns,
    heroBonded: save.heroBonded || heroBonded,
    bestScores,
  };
}

export function isTrueEndingUnlocked(save: SaveDataV1): boolean {
  return save.collectedYarns.length === ALL_LEVEL_IDS.length && save.heroBonded;
}
