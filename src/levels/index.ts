import { LevelData, LevelId } from '../core/types';
import { CHAPTER_1_LEVELS } from './chapter1';
import { CHAPTER_2_LEVELS } from './chapter2';
import { CHAPTER_3_LEVELS } from './chapter3';

export const ALL_LEVELS: readonly LevelData[] = [
  ...CHAPTER_1_LEVELS,
  ...CHAPTER_2_LEVELS,
  ...CHAPTER_3_LEVELS,
];

export function getLevelByIndex(index: number): LevelData {
  const clamped = Math.max(0, Math.min(ALL_LEVELS.length - 1, index));
  return ALL_LEVELS[clamped]!;
}

export function getLevelById(id: LevelId): LevelData {
  const found = ALL_LEVELS.find((l) => l.id === id);
  if (!found) {
    throw new Error(`Unknown level id: ${id}`);
  }
  return found;
}
