import { LEVELS } from '@space-miner/sim';
import type { SaveData } from './SaveRepository';

/** The first level is always open; every other one opens when the level before it has been won. */
export function isLevelUnlocked(save: SaveData, levelId: string): boolean {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index <= 0) return index === 0;
  const previous = LEVELS[index - 1];
  return previous !== undefined && save.completedLevelIds.includes(previous.id);
}

export function withLevelCompleted(save: SaveData, levelId: string): SaveData {
  if (save.completedLevelIds.includes(levelId)) return save;
  return { ...save, completedLevelIds: [...save.completedLevelIds, levelId] };
}
