import { applyCommand, type Command, type CommandResult } from './commands';
import type { LevelConfig } from './config/levels';
import type { GameEvent } from './events';
import { getGameMode } from './modes/registry';
import { updateEnemies } from './systems/enemies';
import { updateEnergy } from './systems/energy';
import { updateMining } from './systems/mining';
import { updateProjectiles } from './systems/projectiles';
import { updateTurrets } from './systems/turrets';
import { updateWaves } from './systems/waves';
import type { GameModeId, GameState, PlayerId } from './types';

export function createGame(
  modeId: GameModeId,
  level: LevelConfig,
  seed: number,
  playerIds: readonly PlayerId[],
): GameState {
  return getGameMode(modeId).setup(level, seed, playerIds);
}

export interface StepResult {
  /** One result per command, in order. */
  readonly commandResults: CommandResult[];
  readonly events: GameEvent[];
}

/**
 * Advances the game by one tick: applies the commands in order, runs the systems and lets the mode decide
 * the status. The same state and commands always produce the same result.
 */
export function step(state: GameState, commands: readonly Command[] = []): StepResult {
  const commandResults = commands.map((command) => applyCommand(state, command));
  const events: GameEvent[] = [];
  if (state.status !== 'running') return { commandResults, events };

  updateEnergy(state);
  updateMining(state, events);
  updateWaves(state, events);
  updateEnemies(state, events);
  updateTurrets(state, events);
  updateProjectiles(state, events);

  state.tick += 1;
  state.status = getGameMode(state.modeId).evaluate(state);
  return { commandResults, events };
}
