import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { ASTEROID_CONFIG } from '../src/config/asteroids';
import { ENEMY_CONFIG } from '../src/config/enemies';
import { TICK_RATE } from '../src/config/simulation';
import { asteroidCenter } from '../src/queries';
import { addEnemy, buildingAt, createTestGame, place, runTicks } from './helpers';
import { step } from '../src/simulation';

describe('pirate flight', () => {
  it('flies around an asteroid in the way instead of through it, and still reaches its target', () => {
    // the mine at (4, 6), a large asteroid straight between it and the ship
    const state = createTestGame({}, [{ x: 9, y: 5, ore: 1000, size: 'large' }]);
    place(state, 'mine', 4, 6);
    const mine = buildingAt(state, 4, 6);
    mine.hp = 1_000_000;
    const ship = addEnemy(state, 16, 6, 1_000_000, 'gunship');
    const rock = state.asteroids[0];
    if (!rock) throw new Error('asteroid missing');
    const center = asteroidCenter(rock);

    let closest = Number.POSITIVE_INFINITY;
    for (let tick = 0; tick < 15 * TICK_RATE; tick++) {
      step(state);
      closest = Math.min(closest, Math.hypot(ship.x - center.x, ship.y - center.y));
    }

    expect(closest).toBeGreaterThan(ASTEROID_CONFIG.large.radius);
    expect(Math.hypot(ship.x - 4.5, ship.y - 6.5)).toBeCloseTo(ENEMY_CONFIG.gunship.attackRange, 6);
    expect(mine.hp).toBeLessThan(1_000_000);
  });
});

describe('building targets', () => {
  it('a mine targets the asteroid it mines, and nothing without one in range', () => {
    const state = createTestGame();
    place(state, 'mine', 8, 5);
    place(state, 'mine', 1, 10);
    expect(buildingAt(state, 8, 5).targetId).toBe(state.asteroids[0]?.id);
    expect(buildingAt(state, 1, 10).targetId).toBeNull();
  });

  it('a turret aims at the nearest pirate in range on every tick, also while reloading', () => {
    const state = createTestGame();
    place(state, 'missile', 5, 5);
    const missile = buildingAt(state, 5, 5);
    const far = addEnemy(state, 5.5, 5.5 + getBuildingStats('missile', 1).range - 0.5);
    const near = addEnemy(state, 5.5, 8.5);
    for (const enemy of [far, near]) enemy.cooldown = Number.MAX_SAFE_INTEGER;

    runTicks(state, 1);
    expect(missile.targetId).toBe(near.id);
    expect(missile.cooldown).toBeGreaterThan(0);
    runTicks(state, 1);
    expect(missile.targetId).toBe(near.id);
  });
});
