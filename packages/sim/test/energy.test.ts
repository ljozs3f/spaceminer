import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { TICK_RATE } from '../src/config/simulation';
import { energyEfficiency } from '../src/queries';
import type { GameState } from '../src/types';
import { addEnemy, createTestGame, getPlayer, place, runTicks } from './helpers';

const SOLAR = getBuildingStats('solar', 1);
const MINE = getBuildingStats('mine', 1);
const LASER = getBuildingStats('laser', 1);

/** The test level has one solar panel; every extra mine adds consumption. */
function gameWithMines(mineCount: number): GameState {
  const state = createTestGame({}, [{ x: 10, y: 5, ore: 10_000 }]);
  for (let i = 0; i < mineCount; i++) place(state, 'mine', 8, 3 + i);
  return state;
}

/** Damage a laser deals to a pirate that never dies and never attacks. */
function laserDamageIn(state: GameState, seconds: number): number {
  place(state, 'laser', 5, 5);
  const target = addEnemy(state, 5.5, 7.5, Number.MAX_SAFE_INTEGER);
  target.cooldown = Number.MAX_SAFE_INTEGER;
  runTicks(state, seconds * TICK_RATE);
  return Number.MAX_SAFE_INTEGER - target.hp;
}

describe('energy', () => {
  it('runs consumers at full efficiency while production covers consumption', () => {
    const player = getPlayer(gameWithMines(1));
    expect(player.energyProduced).toBe(SOLAR.energyOutput);
    expect(player.energyConsumed).toBe(MINE.energyUse);
    expect(energyEfficiency(player)).toBe(1);
  });

  it('slows mining down proportionally when consumption exceeds production', () => {
    const mineCount = 4;
    const state = gameWithMines(mineCount);
    const efficiency = SOLAR.energyOutput / (mineCount * MINE.energyUse);
    expect(efficiency).toBeLessThan(1);
    expect(energyEfficiency(getPlayer(state))).toBeCloseTo(efficiency, 12);

    const before = getPlayer(state).ore;
    runTicks(state, TICK_RATE);
    expect(getPlayer(state).ore - before).toBeCloseTo(mineCount * MINE.orePerSecond * efficiency, 9);
  });

  it('slows turrets down proportionally when consumption exceeds production', () => {
    const seconds = 10;
    const fullRate = LASER.shotsPerSecond * seconds * LASER.damage;
    // a shot may still be in flight at the end
    expect(Math.abs(laserDamageIn(createTestGame(), seconds) - fullRate)).toBeLessThanOrEqual(LASER.damage);

    const starved = gameWithMines(3);
    const efficiency = SOLAR.energyOutput / (3 * MINE.energyUse + LASER.energyUse);
    expect(efficiency).toBeLessThan(1);
    const damage = laserDamageIn(starved, seconds);
    expect(Math.abs(damage - fullRate * efficiency)).toBeLessThanOrEqual(LASER.damage);
  });

  it('stops consumers when nothing produces energy', () => {
    const state = createTestGame({ spawns: [[{ type: 'mine', x: 8, y: 5 }]] });
    expect(energyEfficiency(getPlayer(state))).toBe(0);
    runTicks(state, TICK_RATE);
    expect(state.asteroids[0]?.ore).toBe(100);
  });
});
