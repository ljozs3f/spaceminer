import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { ENEMY_CONFIG } from '../src/config/enemies';
import { TICK_RATE } from '../src/config/simulation';
import { ULTRA_INSTINCT_CONFIG } from '../src/config/ultraInstinct';
import { isUltraInstinctActive } from '../src/queries';
import { step } from '../src/simulation';
import type { GameState } from '../src/types';
import {
  addEnemy,
  buildingAt,
  createTestGame,
  getPlayer,
  place,
  PLAYER,
  runTicks,
  stepWith,
} from './helpers';

const { multiplier, durationSeconds, rechargeSeconds } = ULTRA_INSTINCT_CONFIG;
const DURATION_TICKS = durationSeconds * TICK_RATE;
const RECHARGE_TICKS = rechargeSeconds * TICK_RATE;

function activate(state: GameState): ReturnType<typeof stepWith> {
  return stepWith(state, { type: 'ultraInstinct', playerId: PLAYER });
}

/** Shots fired in the next ticks. */
function shotsIn(state: GameState, ticks: number): number {
  let shots = 0;
  for (let tick = 0; tick < ticks; tick++) {
    shots += step(state).events.filter((event) => event.type === 'shotFired').length;
  }
  return shots;
}

/** A laser at (5, 5) and a pirate in its range that never dies and never attacks. */
function laserAndTarget(state: GameState): void {
  place(state, 'laser', 5, 5);
  const target = addEnemy(state, 5.5, 7.5, Number.MAX_SAFE_INTEGER);
  target.cooldown = Number.MAX_SAFE_INTEGER;
}

describe('ultra instinct', () => {
  it('is on for its duration, then recharges before it can start again', () => {
    const state = createTestGame();
    const player = getPlayer(state);

    expect(activate(state).ok).toBe(true);
    // the tick of the command counts
    runTicks(state, DURATION_TICKS - 2);
    expect(isUltraInstinctActive(state, player)).toBe(true);
    expect(activate(state)).toMatchObject({ ok: false, reason: 'ultraInstinctActive' });
    expect(isUltraInstinctActive(state, player)).toBe(false);

    expect(activate(state)).toMatchObject({ ok: false, reason: 'ultraInstinctRecharging' });
    runTicks(state, RECHARGE_TICKS - 2);
    expect(activate(state)).toMatchObject({ ok: false, reason: 'ultraInstinctRecharging' });
    expect(activate(state).ok).toBe(true);
  });

  it('makes the mines mine many times as fast', () => {
    const normal = createTestGame({}, [{ x: 10, y: 5, ore: 10_000 }]);
    const boosted = createTestGame({}, [{ x: 10, y: 5, ore: 10_000 }]);
    for (const state of [normal, boosted]) place(state, 'mine', 8, 5);
    activate(boosted);
    step(normal);
    const before = { normal: getPlayer(normal).ore, boosted: getPlayer(boosted).ore };

    runTicks(normal, TICK_RATE);
    runTicks(boosted, TICK_RATE);

    const mined = getBuildingStats('mine', 1).orePerSecond;
    expect(getPlayer(normal).ore - before.normal).toBeCloseTo(mined);
    expect(getPlayer(boosted).ore - before.boosted).toBeCloseTo(mined * multiplier);
  });

  it('makes the solar panels produce many times their energy, until it ends', () => {
    const state = createTestGame();
    const { energyOutput } = getBuildingStats('solar', 1);

    activate(state);
    expect(getPlayer(state).energyProduced).toBe(energyOutput * multiplier);

    runTicks(state, DURATION_TICKS);
    expect(getPlayer(state).energyProduced).toBe(energyOutput);
  });

  it('makes the turrets fire many times as fast', () => {
    const normal = createTestGame();
    const boosted = createTestGame();
    for (const state of [normal, boosted]) laserAndTarget(state);
    activate(boosted);
    step(normal);
    // past the first shot, which every turret fires at once
    runTicks(normal, TICK_RATE);
    runTicks(boosted, TICK_RATE);

    const seconds = 2;
    const shots = getBuildingStats('laser', 1).shotsPerSecond * seconds;
    expect(shotsIn(normal, seconds * TICK_RATE)).toBe(shots);
    expect(shotsIn(boosted, seconds * TICK_RATE)).toBe(shots * multiplier);
  });

  it('lets the buildings take only a fraction of the damage', () => {
    const normal = createTestGame();
    const boosted = createTestGame();
    for (const state of [normal, boosted]) {
      place(state, 'mine', 5, 5);
      addEnemy(state, 5.5, 6.5, Number.MAX_SAFE_INTEGER, 'gunship');
    }
    activate(boosted);
    step(normal);
    const { maxHp } = getBuildingStats('mine', 1);

    expect(maxHp - buildingAt(normal, 5, 5).hp).toBe(ENEMY_CONFIG.gunship.damage);
    expect(maxHp - buildingAt(boosted, 5, 5).hp).toBeCloseTo(ENEMY_CONFIG.gunship.damage / multiplier);
  });

  it('makes the repair drones repair many times as fast', () => {
    const repairedIn = (boost: boolean): number => {
      const state = createTestGame();
      place(state, 'repair', 5, 5);
      place(state, 'laser', 7, 5);
      const laser = buildingAt(state, 7, 5);
      laser.hp = 1;
      // the drone flies over and starts repairing
      runTicks(state, TICK_RATE);
      expect(state.drones[0]?.repairing).toBe(true);
      if (boost) activate(state);
      else step(state);
      const before = laser.hp;
      runTicks(state, 10);
      return laser.hp - before;
    };

    const perTick = getBuildingStats('repair', 1).repairPerSecond / TICK_RATE;
    expect(repairedIn(false)).toBeCloseTo(perTick * 10);
    expect(repairedIn(true)).toBeCloseTo(perTick * 10 * multiplier);
  });

  it('works for the player who started it only', () => {
    const state = createTestGame();
    expect(stepWith(state, { type: 'ultraInstinct', playerId: 'nobody' })).toMatchObject({
      ok: false,
      reason: 'unknownPlayer',
    });
    expect(isUltraInstinctActive(state, getPlayer(state))).toBe(false);
  });
});
