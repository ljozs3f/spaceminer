import type { AsteroidSize, BuildingType, EnemyType } from '../types';

export interface StartingBuilding {
  readonly type: BuildingType;
  readonly x: number;
  readonly y: number;
}

/** Asteroids are scattered by the seeded PRNG on the cells within `radius` of the field center. */
export interface AsteroidFieldConfig {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** How many asteroids of each size the field has (sizes: ASTEROID_CONFIG). */
  readonly asteroids: Readonly<Partial<Record<AsteroidSize, number>>>;
  /** Multiplies the ore of the field's asteroids: rich fields lie far from the base. */
  readonly richness: number;
}

export interface EnemyGroupConfig {
  readonly type: EnemyType;
  /** First wave (0-based) with this enemy type. */
  readonly fromWave: number;
  readonly count: number;
  /** Extra enemies per wave after fromWave; fractions add up (0.5: one more every second wave). */
  readonly extraPerWave: number;
}

export interface WaveConfig {
  readonly firstWaveSeconds: number;
  readonly intervalSeconds: number;
  /**
   * Waves get stronger up to this wave (0-based), later waves repeat it: the difficulty levels off, so a
   * slower player is not overrun by ever-growing waves.
   */
  readonly lastScalingWave: number;
  /** Enemy hit points in wave n: ENEMY_CONFIG maxHp * hpMultiplier * (1 + n * hpGrowthPerWave). */
  readonly hpMultiplier: number;
  readonly hpGrowthPerWave: number;
  readonly groups: readonly EnemyGroupConfig[];
}

export interface LevelConfig {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly startingOre: number;
  /** One entry per player: the buildings the player starts with. */
  readonly spawns: readonly (readonly StartingBuilding[])[];
  readonly asteroidFields: readonly AsteroidFieldConfig[];
  readonly waves: WaveConfig;
}

const BASE: readonly StartingBuilding[] = [
  { type: 'solar', x: 4, y: 12 },
  { type: 'mine', x: 6, y: 12 },
  { type: 'laser', x: 5, y: 10 },
];

/** In order: winning a level unlocks the next one. */
export const LEVELS: readonly LevelConfig[] = [
  {
    id: 'quiet-belt',
    name: 'Quiet Belt',
    width: 40,
    height: 24,
    startingOre: 150,
    spawns: [BASE],
    asteroidFields: [
      { x: 9, y: 12, radius: 2, asteroids: { small: 2, medium: 4, large: 1 }, richness: 1 },
      { x: 16, y: 6, radius: 2, asteroids: { small: 2, medium: 4, large: 1 }, richness: 1.1 },
      { x: 16, y: 18, radius: 2, asteroids: { small: 2, medium: 4, large: 1 }, richness: 1.1 },
      { x: 26, y: 12, radius: 3, asteroids: { small: 3, medium: 5, large: 2 }, richness: 1.2 },
    ],
    waves: {
      firstWaveSeconds: 45,
      intervalSeconds: 35,
      lastScalingWave: 10,
      hpMultiplier: 1,
      hpGrowthPerWave: 0.06,
      groups: [
        { type: 'raider', fromWave: 0, count: 2, extraPerWave: 0.5 },
        { type: 'gunship', fromWave: 3, count: 1, extraPerWave: 0.3 },
        { type: 'dreadnought', fromWave: 7, count: 1, extraPerWave: 0.2 },
      ],
    },
  },
  {
    id: 'scattered-drift',
    name: 'Scattered Drift',
    width: 40,
    height: 24,
    startingOre: 150,
    spawns: [BASE],
    asteroidFields: [
      { x: 9, y: 12, radius: 1, asteroids: { medium: 3 }, richness: 1 },
      { x: 13, y: 4, radius: 3, asteroids: { small: 3, medium: 3, large: 1 }, richness: 1.1 },
      { x: 13, y: 20, radius: 3, asteroids: { small: 3, medium: 3, large: 1 }, richness: 1.1 },
      { x: 23, y: 12, radius: 4, asteroids: { small: 3, medium: 4, large: 2 }, richness: 1.2 },
      { x: 33, y: 5, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.4 },
      { x: 33, y: 19, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.4 },
    ],
    waves: {
      firstWaveSeconds: 40,
      intervalSeconds: 32,
      lastScalingWave: 10,
      hpMultiplier: 1.1,
      hpGrowthPerWave: 0.06,
      groups: [
        { type: 'raider', fromWave: 0, count: 3, extraPerWave: 0.5 },
        { type: 'gunship', fromWave: 2, count: 1, extraPerWave: 0.35 },
        { type: 'dreadnought', fromWave: 6, count: 1, extraPerWave: 0.2 },
      ],
    },
  },
  {
    id: 'maelstrom',
    name: 'Maelstrom',
    width: 40,
    height: 24,
    startingOre: 225,
    spawns: [BASE],
    asteroidFields: [
      { x: 9, y: 12, radius: 1, asteroids: { small: 1, medium: 2 }, richness: 1 },
      { x: 12, y: 3, radius: 3, asteroids: { small: 3, medium: 2, large: 1 }, richness: 1.1 },
      { x: 12, y: 21, radius: 3, asteroids: { small: 3, medium: 2, large: 1 }, richness: 1.1 },
      { x: 21, y: 9, radius: 4, asteroids: { small: 3, medium: 3, large: 1 }, richness: 1.2 },
      { x: 21, y: 16, radius: 4, asteroids: { small: 3, medium: 3, large: 1 }, richness: 1.2 },
      { x: 30, y: 4, radius: 4, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.5 },
      { x: 30, y: 20, radius: 4, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.5 },
      { x: 35, y: 12, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.6 },
    ],
    waves: {
      firstWaveSeconds: 35,
      intervalSeconds: 32,
      lastScalingWave: 10,
      hpMultiplier: 1.15,
      hpGrowthPerWave: 0.065,
      groups: [
        { type: 'raider', fromWave: 0, count: 3, extraPerWave: 0.6 },
        { type: 'gunship', fromWave: 2, count: 1, extraPerWave: 0.4 },
        { type: 'dreadnought', fromWave: 5, count: 1, extraPerWave: 0.25 },
      ],
    },
  },
];
