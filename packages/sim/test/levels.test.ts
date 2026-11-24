import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { ASTEROID_CONFIG } from '../src/config/asteroids';
import { LEVELS } from '../src/config/levels';
import { getGameMode } from '../src/modes/registry';
import { distanceToAsteroid, isInBounds } from '../src/queries';
import { createGame } from '../src/simulation';
import { ASTEROID_SIZES } from '../src/types';

describe.each(LEVELS)('level $name', (level) => {
  it.each([1, 2, 3, 4, 5])('sets up a playable start with seed %d', (seed) => {
    const state = createGame('mining', level, seed, ['player-1']);

    expect(state.status).toBe('running');
    expect(state.buildings).toHaveLength(level.spawns[0]?.length ?? 0);
    expect(state.totalOre).toBeGreaterThan(0);
    // every cell holds at most one thing, and everything is on the map
    const taken = new Set<string>();
    const cells = [
      ...state.buildings.map(({ x, y }) => ({ x, y })),
      ...state.asteroids.flatMap(({ size, x, y }) =>
        Array.from({ length: ASTEROID_CONFIG[size].cells ** 2 }, (_, i) => ({
          x: x + (i % ASTEROID_CONFIG[size].cells),
          y: y + Math.floor(i / ASTEROID_CONFIG[size].cells),
        })),
      ),
    ];
    for (const { x, y } of cells) {
      expect(isInBounds(level, x, y)).toBe(true);
      expect(taken.has(`${String(x)},${String(y)}`)).toBe(false);
      taken.add(`${String(x)},${String(y)}`);
    }
    expect(new Set(state.asteroids.map((asteroid) => asteroid.size))).toEqual(new Set(ASTEROID_SIZES));
    // the starting mine has ore within reach
    const mine = state.buildings.find((building) => building.type === 'mine');
    const range = getBuildingStats('mine', 1).range;
    expect(state.asteroids.some((a) => mine && distanceToAsteroid(mine.x, mine.y, a) <= range)).toBe(true);
  });
});

describe('mode registry', () => {
  it('holds the mining mode', () => {
    expect(getGameMode('mining').id).toBe('mining');
  });
});
