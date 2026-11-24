import { MINING_MODE_CONFIG } from '../config/modes';
import { minedOreFraction } from '../queries';
import { createWorld } from '../world';
import type { GameMode } from './game-mode';

/** Mine most of the level's ore while pirates attack. Lost when every building is destroyed. */
export const miningMode: GameMode = {
  id: 'mining',
  setup: (level, seed, playerIds) => createWorld('mining', level, seed, playerIds),
  evaluate(state) {
    if (minedOreFraction(state) >= MINING_MODE_CONFIG.winMinedOreFraction) return 'won';
    const anyPlayerHasBuildings = state.players.some((player) =>
      state.buildings.some((building) => building.ownerId === player.id),
    );
    return anyPlayerHasBuildings ? 'running' : 'lost';
  },
};
