import type { GameModeId } from '../types';
import type { GameMode } from './game-mode';
import { miningMode } from './mining';

/** Every GameModeId must have a mode here. */
export const GAME_MODES: Readonly<Record<GameModeId, GameMode>> = {
  mining: miningMode,
};

export function getGameMode(id: GameModeId): GameMode {
  return GAME_MODES[id];
}
