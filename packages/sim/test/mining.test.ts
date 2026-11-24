import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { TICK_RATE } from '../src/config/simulation';
import { minedOreFraction } from '../src/queries';
import { createTestGame, getPlayer, place, runTicks } from './helpers';

describe('mining', () => {
  it('moves ore from an asteroid in range to the player at the configured rate', () => {
    const state = createTestGame();
    place(state, 'mine', 8, 5);
    const asteroid = state.asteroids[0];
    if (!asteroid) throw new Error('asteroid missing');
    const oreBefore = getPlayer(state).ore;
    const asteroidOreBefore = asteroid.ore;

    runTicks(state, TICK_RATE);

    const perSecond = getBuildingStats('mine', 1).orePerSecond;
    expect(getPlayer(state).ore - oreBefore).toBeCloseTo(perSecond, 9);
    expect(asteroidOreBefore - asteroid.ore).toBeCloseTo(perSecond, 9);
  });

  it('removes depleted asteroids and reports the mined share', () => {
    // a second, unreachable asteroid keeps the game from being won
    const state = createTestGame({}, [
      { x: 10, y: 5, ore: 100 },
      { x: 18, y: 10, ore: 300 },
    ]);
    place(state, 'mine', 8, 5);
    expect(minedOreFraction(state)).toBeGreaterThan(0);

    const seconds = 100 / getBuildingStats('mine', 1).orePerSecond;
    // one extra tick: the per-tick amounts do not add up to exactly 100 in floating point
    runTicks(state, seconds * TICK_RATE + 1);

    expect(state.asteroids.map((asteroid) => asteroid.ore)).toEqual([300]);
    expect(minedOreFraction(state)).toBe(0.25);
  });

  it('ignores asteroids out of range', () => {
    const state = createTestGame();
    const range = getBuildingStats('mine', 1).range;
    place(state, 'mine', 10 - Math.floor(range) - 1, 5);
    runTicks(state, TICK_RATE);

    expect(state.asteroids[0]?.ore).toBe(100);
    expect(minedOreFraction(state)).toBe(0);
  });
});
