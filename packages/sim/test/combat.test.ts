import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { ENEMY_CONFIG } from '../src/config/enemies';
import { TICK_RATE } from '../src/config/simulation';
import type { GameState } from '../src/types';
import { addEnemy, buildingAt, createTestGame, getPlayer, place, runTicks } from './helpers';

/** Runs until the turret's first projectile has landed. */
function runUntilFirstImpact(state: GameState): void {
  for (let tick = 0; tick < 10 * TICK_RATE; tick++) {
    const hadProjectile = state.projectiles.length > 0;
    runTicks(state, 1);
    if (hadProjectile && state.projectiles.length === 0) return;
  }
  throw new Error('No projectile landed');
}

/** Pirates that never attack, so the buildings survive and only the turrets deal damage. */
function disarm(state: GameState): void {
  for (const enemy of state.enemies) enemy.cooldown = Number.MAX_SAFE_INTEGER;
}

describe('combat', () => {
  it('lasers hit their target for the configured damage', () => {
    const state = createTestGame();
    place(state, 'laser', 5, 5);
    const pirate = addEnemy(state, 5.5, 8, 100);
    disarm(state);

    runUntilFirstImpact(state);

    expect(pirate.hp).toBe(100 - getBuildingStats('laser', 1).damage);
  });

  it('missiles damage every pirate within the splash radius of the impact', () => {
    const state = createTestGame();
    const missile = getBuildingStats('missile', 1);
    place(state, 'missile', 5, 5);
    const target = addEnemy(state, 5.5, 10.5, 1000);
    const near = addEnemy(state, 5.5 + missile.splashRadius / 2, 10.5, 1000);
    const far = addEnemy(state, 5.5 + missile.splashRadius * 3, 10.5, 1000);
    disarm(state);

    runUntilFirstImpact(state);

    expect(target.hp).toBe(1000 - missile.damage);
    expect(near.hp).toBe(1000 - missile.damage);
    expect(far.hp).toBe(1000);
  });

  it('removes destroyed pirates and pays their bounty to the owner of the turret', () => {
    const state = createTestGame();
    place(state, 'laser', 5, 5);
    addEnemy(state, 5.5, 8, getBuildingStats('laser', 1).damage, 'dreadnought');
    disarm(state);
    const ore = getPlayer(state).ore;

    runUntilFirstImpact(state);

    expect(state.enemies).toHaveLength(0);
    expect(getPlayer(state).ore).toBe(ore + ENEMY_CONFIG.dreadnought.bounty);
  });

  it.each(['raider', 'gunship', 'dreadnought'] as const)(
    '%ss fly to the nearest building and attack it with their own stats',
    (type) => {
      const stats = ENEMY_CONFIG[type];
      const state = createTestGame();
      place(state, 'mine', 15, 10);
      const mine = buildingAt(state, 15, 10);
      mine.hp = 1000; // survives every ship for the whole test
      const pirate = addEnemy(state, 19, 11, 1000, type);

      // long enough for the slowest ship to arrive and attack a few times
      runTicks(state, 8 * TICK_RATE);

      expect(Math.hypot(pirate.x - 15.5, pirate.y - 10.5)).toBeCloseTo(stats.attackRange, 9);
      expect(mine.hp).toBeLessThan(1000);
      expect((1000 - mine.hp) % stats.damage).toBe(0);
      expect(buildingAt(state, 1, 1).hp).toBe(getBuildingStats('solar', 1).maxHp);
    },
  );
});
