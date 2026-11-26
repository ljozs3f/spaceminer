import { getBuildingStats } from '../buildings';
import { asteroidCenter, boostOf, distanceToAsteroid, findNearest, findPlayer } from '../queries';
import type { GameEvent } from '../events';
import type { GameState } from '../types';
import { perTick } from '../units';
import { getEfficiencies } from './energy';

/**
 * Mines move ore from the nearest asteroids in range to their owner (many times as much under Ultra
 * Instinct). Depleted asteroids disappear.
 */
export function updateMining(state: GameState, events: GameEvent[]): void {
  const efficiencies = getEfficiencies(state);
  for (const mine of state.buildings) {
    if (mine.type !== 'mine') continue;
    const owner = findPlayer(state.players, mine.ownerId);
    if (!owner) continue;
    const stats = getBuildingStats('mine', mine.level);
    let amount = perTick(stats.orePerSecond) * (efficiencies.get(owner.id) ?? 0) * boostOf(state, owner.id);
    mine.targetId = null;
    while (amount > 0) {
      const asteroid = findNearest(
        state.asteroids.filter((candidate) => candidate.ore > 0),
        (candidate) => distanceToAsteroid(mine.x, mine.y, candidate),
        stats.range,
      );
      if (!asteroid) break;
      mine.targetId ??= asteroid.id;
      const mined = Math.min(amount, asteroid.ore);
      asteroid.ore -= mined;
      owner.ore += mined;
      amount -= mined;
      if (asteroid.ore <= 0) events.push({ type: 'asteroidDepleted', ...asteroidCenter(asteroid) });
    }
  }
  state.asteroids = state.asteroids.filter((asteroid) => asteroid.ore > 0);
}
