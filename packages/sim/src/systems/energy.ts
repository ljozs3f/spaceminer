import { getBuildingEnergy } from '../buildings';
import { boostOf, energyEfficiency } from '../queries';
import type { GameState, PlayerId } from '../types';

/**
 * Recomputes every player's energy production and consumption from their buildings. Under Ultra Instinct
 * the solar panels make many times their energy. During its burnout they make a fraction of it, and the
 * consumers, working at that fraction, use that fraction too: the covered share stays, so the burnout
 * makes every building the same times worse, not the consumers twice.
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
    const boost = boostOf(state, player.id);
    player.energyProduced += energy.produced * boost;
    player.energyConsumed += energy.consumed * Math.min(1, boost);
  }
}

/** Energy consumers of a player work at this rate (0 to 1). */
export function getEfficiencies(state: GameState): Map<PlayerId, number> {
  return new Map(state.players.map((player) => [player.id, energyEfficiency(player)]));
}
