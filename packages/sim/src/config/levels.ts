import type { AsteroidSize, BuildingType, EnemyType, MapEdge } from '../types';

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
  /** The map edges the pirates come from; every edge when left out. */
  readonly spawnEdges?: readonly MapEdge[];
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

/** The same base in the middle of the map. */
const CENTER_BASE: readonly StartingBuilding[] = [
  { type: 'solar', x: 18, y: 12 },
  { type: 'mine', x: 20, y: 12 },
  { type: 'laser', x: 19, y: 10 },
];

/** In the bottom left corner. */
const CORNER_BASE: readonly StartingBuilding[] = [
  { type: 'solar', x: 3, y: 20 },
  { type: 'mine', x: 5, y: 20 },
  { type: 'laser', x: 4, y: 18 },
];

/** On the east side, mirrored. */
const EAST_BASE: readonly StartingBuilding[] = [
  { type: 'solar', x: 35, y: 12 },
  { type: 'mine', x: 33, y: 12 },
  { type: 'laser', x: 34, y: 10 },
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
  {
    id: 'twin-reefs',
    name: 'Twin Reefs',
    width: 40,
    height: 24,
    startingOre: 250,
    spawns: [BASE],
    asteroidFields: [
      { x: 9, y: 12, radius: 1, asteroids: { small: 1, medium: 2 }, richness: 1 },
      { x: 14, y: 12, radius: 2, asteroids: { small: 2, medium: 2 }, richness: 1 },
      { x: 27, y: 5, radius: 4, asteroids: { small: 3, medium: 4, large: 3 }, richness: 1.5 },
      { x: 27, y: 19, radius: 4, asteroids: { small: 3, medium: 4, large: 3 }, richness: 1.5 },
    ],
    waves: {
      firstWaveSeconds: 35,
      intervalSeconds: 27,
      lastScalingWave: 10,
      hpMultiplier: 1.18,
      hpGrowthPerWave: 0.066,
      groups: [
        { type: 'raider', fromWave: 0, count: 3, extraPerWave: 0.62 },
        { type: 'gunship', fromWave: 2, count: 1, extraPerWave: 0.42 },
        { type: 'dreadnought', fromWave: 5, count: 1, extraPerWave: 0.26 },
      ],
      spawnEdges: ['top', 'bottom'],
    },
  },
  {
    id: 'iron-ring',
    name: 'Iron Ring',
    width: 40,
    height: 24,
    startingOre: 225,
    spawns: [CENTER_BASE],
    asteroidFields: [
      { x: 23, y: 12, radius: 1, asteroids: { small: 1, medium: 2 }, richness: 1 },
      { x: 20, y: 4, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.2 },
      { x: 20, y: 20, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.2 },
      { x: 10, y: 7, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.3 },
      { x: 10, y: 17, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.3 },
      { x: 30, y: 7, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.3 },
      { x: 30, y: 17, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.3 },
    ],
    waves: {
      firstWaveSeconds: 32,
      intervalSeconds: 29,
      lastScalingWave: 10,
      hpMultiplier: 1.19,
      hpGrowthPerWave: 0.066,
      groups: [
        { type: 'raider', fromWave: 0, count: 4, extraPerWave: 0.7 },
        { type: 'gunship', fromWave: 2, count: 1, extraPerWave: 0.42 },
        { type: 'dreadnought', fromWave: 5, count: 1, extraPerWave: 0.26 },
      ],
    },
  },
  {
    id: 'ember-shoals',
    name: 'Ember Shoals',
    width: 40,
    height: 24,
    startingOre: 250,
    spawns: [BASE],
    asteroidFields: [
      { x: 9, y: 12, radius: 1, asteroids: { small: 3 }, richness: 1.2 },
      { x: 12, y: 5, radius: 2, asteroids: { small: 5, medium: 1 }, richness: 1.2 },
      { x: 12, y: 19, radius: 2, asteroids: { small: 5, medium: 1 }, richness: 1.2 },
      { x: 20, y: 12, radius: 3, asteroids: { small: 6, medium: 2, large: 1 }, richness: 1.3 },
      { x: 27, y: 4, radius: 3, asteroids: { small: 5, medium: 2 }, richness: 1.4 },
      { x: 27, y: 20, radius: 3, asteroids: { small: 5, medium: 2 }, richness: 1.4 },
      { x: 34, y: 12, radius: 3, asteroids: { small: 5, medium: 2, large: 1 }, richness: 1.6 },
    ],
    waves: {
      firstWaveSeconds: 32,
      intervalSeconds: 28,
      lastScalingWave: 10,
      hpMultiplier: 1.2,
      hpGrowthPerWave: 0.067,
      groups: [
        { type: 'raider', fromWave: 0, count: 4, extraPerWave: 0.7 },
        { type: 'gunship', fromWave: 2, count: 1, extraPerWave: 0.45 },
        { type: 'dreadnought', fromWave: 5, count: 1, extraPerWave: 0.27 },
      ],
    },
  },
  {
    id: 'leviathan-deep',
    name: 'Leviathan Deep',
    width: 40,
    height: 24,
    startingOre: 300,
    spawns: [EAST_BASE],
    asteroidFields: [
      { x: 31, y: 12, radius: 1, asteroids: { small: 1, medium: 2 }, richness: 1 },
      { x: 27, y: 4, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.2 },
      { x: 27, y: 20, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.2 },
      { x: 18, y: 12, radius: 4, asteroids: { small: 3, medium: 3, large: 2 }, richness: 1.4 },
      { x: 9, y: 5, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.7 },
      { x: 9, y: 19, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.7 },
    ],
    waves: {
      firstWaveSeconds: 28,
      intervalSeconds: 26,
      lastScalingWave: 10,
      hpMultiplier: 1.21,
      hpGrowthPerWave: 0.068,
      groups: [
        { type: 'raider', fromWave: 0, count: 4, extraPerWave: 0.72 },
        { type: 'gunship', fromWave: 1, count: 1, extraPerWave: 0.45 },
        { type: 'dreadnought', fromWave: 3, count: 1, extraPerWave: 0.28 },
      ],
      spawnEdges: ['left', 'top', 'bottom'],
    },
  },
  {
    id: 'crimson-reach',
    name: 'Crimson Reach',
    width: 40,
    height: 24,
    startingOre: 275,
    spawns: [BASE],
    asteroidFields: [
      { x: 9, y: 12, radius: 1, asteroids: { medium: 3 }, richness: 1 },
      { x: 14, y: 5, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.1 },
      { x: 14, y: 19, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.1 },
      { x: 22, y: 12, radius: 4, asteroids: { small: 3, medium: 4, large: 2 }, richness: 1.4 },
      { x: 29, y: 6, radius: 2, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.6 },
      { x: 29, y: 18, radius: 2, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.6 },
    ],
    waves: {
      firstWaveSeconds: 40,
      intervalSeconds: 36,
      lastScalingWave: 10,
      hpMultiplier: 1.22,
      hpGrowthPerWave: 0.068,
      groups: [
        { type: 'raider', fromWave: 0, count: 4, extraPerWave: 0.72 },
        { type: 'gunship', fromWave: 1, count: 1, extraPerWave: 0.46 },
        { type: 'dreadnought', fromWave: 3, count: 1, extraPerWave: 0.28 },
      ],
      spawnEdges: ['right'],
    },
  },
  {
    id: 'corsair-gate',
    name: 'Corsair Gate',
    width: 40,
    height: 24,
    startingOre: 300,
    spawns: [CORNER_BASE],
    asteroidFields: [
      { x: 8, y: 20, radius: 1, asteroids: { medium: 3 }, richness: 1 },
      { x: 4, y: 14, radius: 2, asteroids: { small: 1, medium: 2 }, richness: 1 },
      { x: 13, y: 17, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.2 },
      { x: 9, y: 6, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.3 },
      { x: 23, y: 19, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.3 },
      { x: 22, y: 9, radius: 4, asteroids: { small: 3, medium: 3, large: 2 }, richness: 1.5 },
      { x: 33, y: 16, radius: 3, asteroids: { small: 2, medium: 3, large: 1 }, richness: 1.7 },
    ],
    waves: {
      firstWaveSeconds: 30,
      intervalSeconds: 30,
      lastScalingWave: 10,
      hpMultiplier: 1.23,
      hpGrowthPerWave: 0.069,
      groups: [
        { type: 'raider', fromWave: 0, count: 4, extraPerWave: 0.75 },
        { type: 'gunship', fromWave: 1, count: 1, extraPerWave: 0.48 },
        { type: 'dreadnought', fromWave: 3, count: 1, extraPerWave: 0.3 },
      ],
      spawnEdges: ['top', 'right'],
    },
  },
  {
    id: 'event-horizon',
    name: 'Event Horizon',
    width: 40,
    height: 24,
    startingOre: 325,
    spawns: [CENTER_BASE],
    asteroidFields: [
      { x: 23, y: 12, radius: 1, asteroids: { small: 1, medium: 2 }, richness: 1 },
      { x: 16, y: 12, radius: 1, asteroids: { medium: 2 }, richness: 1 },
      { x: 12, y: 4, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.4 },
      { x: 28, y: 20, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.4 },
      { x: 28, y: 4, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.5 },
      { x: 12, y: 20, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.5 },
      { x: 4, y: 12, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.8 },
      { x: 36, y: 12, radius: 3, asteroids: { small: 2, medium: 2, large: 1 }, richness: 1.8 },
    ],
    waves: {
      firstWaveSeconds: 30,
      intervalSeconds: 29,
      lastScalingWave: 10,
      hpMultiplier: 1.25,
      hpGrowthPerWave: 0.07,
      groups: [
        { type: 'raider', fromWave: 0, count: 4, extraPerWave: 0.78 },
        { type: 'gunship', fromWave: 1, count: 1, extraPerWave: 0.5 },
        { type: 'dreadnought', fromWave: 3, count: 1, extraPerWave: 0.32 },
      ],
    },
  },
];
