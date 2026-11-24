import type { Command, CommandResult } from '../src/commands';
import type { LevelConfig } from '../src/config/levels';
import { createGame, step } from '../src/simulation';
import type {
  Asteroid,
  AsteroidSize,
  Building,
  BuildingType,
  Enemy,
  EnemyType,
  GameState,
  PlayerState,
} from '../src/types';

export const PLAYER = 'player-1';

/** A small level with one starting solar panel, no asteroid fields and no pirate waves. */
export function testLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 'test',
    name: 'Test',
    width: 20,
    height: 12,
    startingOre: 1000,
    spawns: [[{ type: 'solar', x: 1, y: 1 }]],
    asteroidFields: [],
    waves: {
      firstWaveSeconds: 3600,
      intervalSeconds: 3600,
      lastScalingWave: 0,
      hpMultiplier: 1,
      hpGrowthPerWave: 0,
      groups: [],
    },
    ...overrides,
  };
}

export interface TestAsteroid {
  readonly x: number;
  readonly y: number;
  readonly ore: number;
  readonly size?: AsteroidSize;
}

/** By default with one medium asteroid of 100 ore at (10, 5). */
export function createTestGame(
  overrides: Partial<LevelConfig> = {},
  asteroids: readonly TestAsteroid[] = [{ x: 10, y: 5, ore: 100 }],
): GameState {
  const state = createGame('mining', testLevel(overrides), 1, [PLAYER]);
  for (const asteroid of asteroids) addAsteroid(state, asteroid);
  return state;
}

/** Puts an asteroid on the map directly, with exactly the given ore. */
export function addAsteroid(state: GameState, { x, y, ore, size = 'medium' }: TestAsteroid): Asteroid {
  const asteroid: Asteroid = { id: state.nextEntityId++, size, x, y, ore, initialOre: ore };
  state.asteroids.push(asteroid);
  state.totalOre += ore;
  return asteroid;
}

export function stepWith(state: GameState, command: Command): CommandResult {
  const [result] = step(state, [command]).commandResults;
  if (!result) throw new Error('step returned no result');
  return result;
}

export function place(state: GameState, buildingType: BuildingType, x: number, y: number): CommandResult {
  return stepWith(state, { type: 'placeBuilding', playerId: PLAYER, buildingType, x, y });
}

export function upgrade(state: GameState, buildingId: number): CommandResult {
  return stepWith(state, { type: 'upgradeBuilding', playerId: PLAYER, buildingId });
}

export function sell(state: GameState, buildingId: number): CommandResult {
  return stepWith(state, { type: 'sellBuilding', playerId: PLAYER, buildingId });
}

export function runTicks(state: GameState, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(state);
}

export function getPlayer(state: GameState): PlayerState {
  const player = state.players.find((candidate) => candidate.id === PLAYER);
  if (!player) throw new Error('Test player is missing');
  return player;
}

export function buildingAt(state: GameState, x: number, y: number): Building {
  const building = state.buildings.find((candidate) => candidate.x === x && candidate.y === y);
  if (!building) throw new Error(`No building at ${String(x)}, ${String(y)}`);
  return building;
}

/** Puts a pirate on the map directly (tests set up scenarios by editing the plain state). */
export function addEnemy(
  state: GameState,
  x: number,
  y: number,
  hp = 1000,
  type: EnemyType = 'gunship',
): Enemy {
  const enemy: Enemy = { id: state.nextEntityId++, type, x, y, hp, maxHp: hp, cooldown: 0 };
  state.enemies.push(enemy);
  return enemy;
}
