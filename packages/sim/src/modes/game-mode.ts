import type { LevelConfig } from '../config/levels';
import type { GameModeId, GameState, GameStatus, PlayerId, ReadonlyGameState } from '../types';

export interface GameMode {
  readonly id: GameModeId;
  /** Builds the initial state from a level and a seed. */
  setup(level: LevelConfig, seed: number, playerIds: readonly PlayerId[]): GameState;
  /** Decides after every tick whether the game goes on, is won or is lost. */
  evaluate(state: ReadonlyGameState): GameStatus;
}
