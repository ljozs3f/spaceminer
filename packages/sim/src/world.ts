import { addBuilding } from './buildings';
import { ASTEROID_CONFIG } from './config/asteroids';
import type { AsteroidFieldConfig, LevelConfig } from './config/levels';
import { findAsteroidAt, findAt, isInBounds } from './queries';
import { randomInt, seedRngState } from './rng';
import { updateEnergy } from './systems/energy';
import { ASTEROID_SIZES, type AsteroidSize, type GameModeId, type GameState, type PlayerId } from './types';
import { secondsToTicks } from './units';

/** Random cells tried per asteroid before a crowded field gives up. */
const PLACEMENT_ATTEMPTS_PER_ASTEROID = 10;

/** Initial state shared by the game modes: players, their starting buildings and the asteroid fields. */
export function createWorld(
  modeId: GameModeId,
  level: LevelConfig,
  seed: number,
  playerIds: readonly PlayerId[],
): GameState {
  if (playerIds.length === 0 || playerIds.length > level.spawns.length) {
    throw new Error(`Level ${level.id} needs 1 to ${String(level.spawns.length)} players`);
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('Player ids must be unique');
  }

  const state: GameState = {
    modeId,
    level,
    seed,
    rngState: seedRngState(seed),
    tick: 0,
    status: 'running',
    nextEntityId: 1,
    totalOre: 0,
    wave: { index: 0, nextWaveTick: secondsToTicks(level.waves.firstWaveSeconds) },
    players: playerIds.map((id) => ({ id, ore: level.startingOre, energyProduced: 0, energyConsumed: 0 })),
    asteroids: [],
    buildings: [],
    enemies: [],
    projectiles: [],
    drones: [],
  };

  playerIds.forEach((playerId, index) => {
    for (const { type, x, y } of level.spawns[index] ?? []) {
      addBuilding(state, playerId, type, x, y);
    }
  });
  scatterAsteroids(state);
  state.totalOre = state.asteroids.reduce((sum, asteroid) => sum + asteroid.ore, 0);
  updateEnergy(state);
  return state;
}

function scatterAsteroids(state: GameState): void {
  // the largest first: they need the most room
  const sizes = [...ASTEROID_SIZES].reverse();
  for (const field of state.level.asteroidFields) {
    for (const size of sizes) {
      const count = field.asteroids[size] ?? 0;
      let placed = 0;
      for (let attempt = 0; placed < count && attempt < count * PLACEMENT_ATTEMPTS_PER_ASTEROID; attempt++) {
        if (tryPlaceAsteroid(state, field, size)) placed++;
      }
    }
  }
}

function tryPlaceAsteroid(state: GameState, field: AsteroidFieldConfig, size: AsteroidSize): boolean {
  const { cells, minOre, maxOre } = ASTEROID_CONFIG[size];
  const dx = randomInt(state, -field.radius, field.radius);
  const dy = randomInt(state, -field.radius, field.radius);
  if (dx * dx + dy * dy > field.radius * field.radius) return false;
  const x = field.x + dx;
  const y = field.y + dy;
  for (let cellY = y; cellY < y + cells; cellY++) {
    for (let cellX = x; cellX < x + cells; cellX++) {
      if (!isInBounds(state.level, cellX, cellY)) return false;
      if (findAt(state.buildings, cellX, cellY) || findAsteroidAt(state.asteroids, cellX, cellY))
        return false;
    }
  }
  const ore = Math.round(randomInt(state, minOre, maxOre) * field.richness);
  state.asteroids.push({ id: state.nextEntityId++, size, x, y, ore, initialOre: ore });
  return true;
}
