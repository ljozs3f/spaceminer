import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { ASTEROID_CONFIG } from '../src/config/asteroids';
import { TICK_RATE } from '../src/config/simulation';
import { distanceToAsteroid, findAsteroidAt } from '../src/queries';
import { createTestGame, place, runTicks } from './helpers';

describe('asteroid sizes', () => {
  it('large asteroids cover several cells, and nothing can be built on any of them', () => {
    const { cells } = ASTEROID_CONFIG.large;
    expect(cells).toBeGreaterThan(1);
    const state = createTestGame({}, [{ x: 10, y: 5, ore: 300, size: 'large' }]);

    for (let y = 5; y < 5 + cells; y++) {
      for (let x = 10; x < 10 + cells; x++) {
        expect(findAsteroidAt(state.asteroids, x, y)?.size).toBe('large');
        expect(place(state, 'solar', x, y)).toMatchObject({ ok: false, reason: 'cellHasAsteroid' });
      }
    }
    expect(findAsteroidAt(state.asteroids, 10 + cells, 5)).toBeUndefined();
  });

  it('mine ranges are measured to the center of a large asteroid', () => {
    const { range } = getBuildingStats('mine', 1);
    expect(range).toBe(3);
    // the 2 × 2 asteroid at (10, 5) has its center at (11, 6)
    const state = createTestGame({}, [{ x: 10, y: 5, ore: 300, size: 'large' }]);
    expect(distanceToAsteroid(8, 5, state.asteroids[0] ?? fail())).toBeLessThanOrEqual(range);
    expect(distanceToAsteroid(7, 5, state.asteroids[0] ?? fail())).toBeGreaterThan(range);

    place(state, 'mine', 7, 5);
    runTicks(state, TICK_RATE);
    expect(state.asteroids[0]?.ore).toBe(300);

    place(state, 'mine', 8, 5);
    runTicks(state, TICK_RATE);
    expect(state.asteroids[0]?.ore).toBeLessThan(300);
  });
});

function fail(): never {
  throw new Error('asteroid missing');
}
