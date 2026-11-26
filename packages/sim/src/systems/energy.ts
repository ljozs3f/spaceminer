import { getBuildingEnergy } from '../buildings';
import { boostOf, energyEfficiency } from '../queries';
import type { GameState, PlayerId } from '../types';

/**
 * Recomputes every player's energy production and consumption from their buildings. Under Ultra Instinct
 * the solar panels make many times their energy.
 */
export function updateEnergy(state: GameState): void {
  const players = new Map(state.players.map((player) => [player.id, player]));
  for (const player of state.players) {
    player.energyProduced = 0;
    player.energyConsumed = 0;
  }
  for (const building of state.buildings) {
    const player = players.get(building.ownerId);
    if (!player) continue;
    const energy = getBuildingEnergy(building.type, building.level);
    player.energyProduced += energy.produced * boostOf(state, player.id);
    player.energyConsumed += energy.consumed;
  }
}

/** Energy consumers of a player work at this rate (0 to 1). */
export function getEfficiencies(state: GameState): Map<PlayerId, number> {
  return new Map(state.players.map((player) => [player.id, energyEfficiency(player)]));
}
