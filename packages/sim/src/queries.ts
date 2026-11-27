import { ASTEROID_CONFIG } from './config/asteroids';
import type { LevelConfig } from './config/levels';
import { ULTRA_INSTINCT_CONFIG } from './config/ultraInstinct';
import { DISTANCE_EPSILON, distance } from './units';
import type { AsteroidSize, EntityId, PlayerId, PlayerState, ReadonlyDeep, ReadonlyGameState } from './types';

/** Read-only queries. They accept the mutable state too and then return mutable objects. */

export function findById<T extends { readonly id: EntityId }>(
  items: readonly T[],
  id: EntityId,
): T | undefined {
  return items.find((item) => item.id === id);
}

export function findPlayer<T extends { readonly id: PlayerId }>(
  players: readonly T[],
  id: PlayerId,
): T | undefined {
  return players.find((player) => player.id === id);
}

export function findAt<T extends { readonly x: number; readonly y: number }>(
  items: readonly T[],
  x: number,
  y: number,
): T | undefined {
  return items.find((item) => item.x === x && item.y === y);
}

interface AsteroidShape {
  readonly size: AsteroidSize;
  readonly x: number;
  readonly y: number;
}

/** The asteroid covering a cell (large asteroids cover several). */
export function findAsteroidAt<T extends AsteroidShape>(
  asteroids: readonly T[],
  x: number,
  y: number,
): T | undefined {
  return asteroids.find((asteroid) => {
    const { cells } = ASTEROID_CONFIG[asteroid.size];
    return x >= asteroid.x && y >= asteroid.y && x < asteroid.x + cells && y < asteroid.y + cells;
  });
}

/** Center of an asteroid in continuous coordinates. */
export function asteroidCenter(asteroid: AsteroidShape): { x: number; y: number } {
  const half = ASTEROID_CONFIG[asteroid.size].cells / 2;
  return { x: asteroid.x + half, y: asteroid.y + half };
}

/** Distance from the center of a cell to the center of an asteroid: what mine ranges are measured with. */
export function distanceToAsteroid(x: number, y: number, asteroid: AsteroidShape): number {
  const center = asteroidCenter(asteroid);
  return distance(x + 0.5, y + 0.5, center.x, center.y);
}

export function isInBounds(level: LevelConfig, x: number, y: number): boolean {
  return (
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < level.width && y < level.height
  );
}

/** Share of the level's ore that has been mined, 0 to 1. */
export function minedOreFraction(state: ReadonlyGameState): number {
  if (state.totalOre === 0) return 1;
  const remaining = state.asteroids.reduce((sum, asteroid) => sum + asteroid.ore, 0);
  return (state.totalOre - remaining) / state.totalOre;
}

/** 1 when production covers consumption, otherwise the share of the demand that is covered. */
export function energyEfficiency(player: ReadonlyDeep<PlayerState>): number {
  if (player.energyConsumed === 0) return 1;
  return Math.min(1, player.energyProduced / player.energyConsumed);
}

/** Whether the player's Ultra Instinct is on in the current tick. */
export function isUltraInstinctActive(
  state: { readonly tick: number },
  player: { readonly ultraInstinctUntilTick: number },
): boolean {
  return state.tick < player.ultraInstinctUntilTick;
}

/** Whether the burnout after the player's Ultra Instinct is on in the current tick. */
export function isUltraInstinctBurnout(
  state: { readonly tick: number },
  player: { readonly ultraInstinctUntilTick: number; readonly ultraInstinctBurnoutUntilTick: number },
): boolean {
  return !isUltraInstinctActive(state, player) && state.tick < player.ultraInstinctBurnoutUntilTick;
}

/**
 * How many times better the player's buildings work in the current tick: the Ultra Instinct multiplier
 * while it is on, a fraction during its burnout, otherwise 1.
 */
export function boostOf(
  state: { readonly tick: number; readonly players: readonly ReadonlyDeep<PlayerState>[] },
  playerId: PlayerId,
): number {
  const player = findPlayer(state.players, playerId);
  if (!player) return 1;
  if (isUltraInstinctActive(state, player)) return ULTRA_INSTINCT_CONFIG.multiplier;
  if (isUltraInstinctBurnout(state, player)) return 1 / ULTRA_INSTINCT_CONFIG.burnoutDivisor;
  return 1;
}

export function ticksUntilNextWave(state: ReadonlyGameState): number {
  return Math.max(0, state.wave.nextWaveTick - state.tick);
}

/** The item nearest to a point, within maxDistance (inclusive). Ties go to the earlier item. */
export function findNearest<T>(
  items: readonly T[],
  distanceTo: (item: T) => number,
  maxDistance = Number.POSITIVE_INFINITY,
): T | undefined {
  let nearest: T | undefined;
  let nearestDistance = maxDistance;
  for (const item of items) {
    const d = distanceTo(item);
    if (d <= maxDistance + DISTANCE_EPSILON && (nearest === undefined || d < nearestDistance)) {
      nearest = item;
      nearestDistance = d;
    }
  }
  return nearest;
}
