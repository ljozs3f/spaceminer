import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { TICK_RATE } from '../src/config/simulation';
import { dockPoint } from '../src/systems/drones';
import type { GameState } from '../src/types';
import { addEnemy, buildingAt, createTestGame, place, runTicks, sell, upgrade } from './helpers';

/** A hive at (5, 5) and a laser two cells from it. */
function hiveAndLaser(state: GameState): {
  hive: ReturnType<typeof buildingAt>;
  laser: ReturnType<typeof buildingAt>;
} {
  place(state, 'repair', 5, 5);
  place(state, 'laser', 7, 5);
  return { hive: buildingAt(state, 5, 5), laser: buildingAt(state, 7, 5) };
}

describe('repair hives', () => {
  it('send a drone to a damaged building in range, which repairs it at the configured rate', () => {
    const state = createTestGame();
    const { laser } = hiveAndLaser(state);
    const { maxHp } = getBuildingStats('laser', 1);
    const stats = getBuildingStats('repair', 1);
    laser.hp = maxHp - 30;

    // the flight takes about two cells at droneSpeed
    runTicks(state, TICK_RATE);
    const [drone] = state.drones;
    expect(drone?.targetId).toBe(laser.id);
    expect(drone?.repairing).toBe(true);

    const before = laser.hp;
    runTicks(state, TICK_RATE);
    expect(laser.hp - before).toBeCloseTo(stats.repairPerSecond, 6);

    runTicks(state, 10 * TICK_RATE);
    expect(laser.hp).toBe(maxHp);
  });

  it('call their drones home when nothing needs repair', () => {
    const state = createTestGame();
    const { hive, laser } = hiveAndLaser(state);
    laser.hp -= 5;

    runTicks(state, 5 * TICK_RATE);

    const [drone] = state.drones;
    expect(drone).toMatchObject({ targetId: null, repairing: false, ...dockPoint(hive, 0) });
  });

  it('have one drone per level', () => {
    const state = createTestGame();
    const { hive } = hiveAndLaser(state);
    runTicks(state, 1);
    expect(state.drones).toHaveLength(1);

    upgrade(state, hive.id);
    expect(state.drones).toHaveLength(2);
    upgrade(state, hive.id);
    expect(state.drones).toHaveLength(getBuildingStats('repair', 3).drones);
    expect(state.drones.map((drone) => drone.slot)).toEqual([0, 1, 2]);
  });

  it('do not repair buildings out of range', () => {
    const state = createTestGame();
    hiveAndLaser(state);
    const solar = buildingAt(state, 1, 1);
    solar.hp -= 20;
    const hp = solar.hp;

    runTicks(state, 10 * TICK_RATE);

    expect(solar.hp).toBe(hp);
    expect(state.drones.every((drone) => drone.targetId === null)).toBe(true);
  });

  it('spread their drones over buildings that are about as damaged', () => {
    const state = createTestGame();
    const { hive, laser } = hiveAndLaser(state);
    place(state, 'mine', 5, 7);
    const mine = buildingAt(state, 5, 7);
    upgrade(state, hive.id);
    laser.hp = getBuildingStats('laser', 1).maxHp * 0.3;
    mine.hp = getBuildingStats('mine', 1).maxHp * 0.35;

    runTicks(state, 1);

    expect(state.drones.map((drone) => drone.targetId)).toEqual([laser.id, mine.id]);
  });

  it('send every drone to a building far more damaged than the rest', () => {
    const state = createTestGame();
    const { hive, laser } = hiveAndLaser(state);
    place(state, 'mine', 5, 7);
    const mine = buildingAt(state, 5, 7);
    upgrade(state, hive.id);
    laser.hp = 5;
    mine.hp = getBuildingStats('mine', 1).maxHp - 5;

    runTicks(state, 1);

    expect(state.drones.map((drone) => drone.targetId)).toEqual([laser.id, laser.id]);
  });

  it('lose their drones when the hive is gone', () => {
    const state = createTestGame();
    const { hive } = hiveAndLaser(state);
    runTicks(state, 1);
    expect(state.drones).toHaveLength(1);

    sell(state, hive.id);

    expect(state.drones).toHaveLength(0);
  });

  it('send drones the pirates leave alone: they attack the buildings', () => {
    const state = createTestGame();
    const { laser } = hiveAndLaser(state);
    laser.hp -= 20;
    addEnemy(state, 7.5, 7, 1_000_000, 'raider');

    runTicks(state, 5 * TICK_RATE);

    // the raider attacks the laser right next to the drone, the drone keeps repairing it
    expect(laser.hp).toBeLessThan(getBuildingStats('laser', 1).maxHp);
    expect(state.drones).toHaveLength(1);
    expect(state.drones[0]).toMatchObject({ targetId: laser.id, repairing: true });
  });
});
