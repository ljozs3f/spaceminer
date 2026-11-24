import type { LevelConfig } from './config/levels';

export type PlayerId = string;
/** Entity ids come from a counter in the state, so they are deterministic. */
export type EntityId = number;

export const BUILDING_TYPES = ['mine', 'solar', 'laser', 'missile'] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];
export type TurretType = Extract<BuildingType, 'laser' | 'missile'>;
export type BuildingLevel = 1 | 2 | 3;

export const ASTEROID_SIZES = ['small', 'medium', 'large'] as const;
export type AsteroidSize = (typeof ASTEROID_SIZES)[number];

export const ENEMY_TYPES = ['raider', 'gunship', 'dreadnought'] as const;
export type EnemyType = (typeof ENEMY_TYPES)[number];

export type GameModeId = 'mining';
export type GameStatus = 'running' | 'won' | 'lost';

export interface PlayerState {
  id: PlayerId;
  ore: number;
  /** Energy produced and consumed by the player's buildings in the current tick. */
  energyProduced: number;
  energyConsumed: number;
}

/** Positions of grid objects are cells; a building's center is at (x + 0.5, y + 0.5). */
export interface Asteroid {
  id: EntityId;
  size: AsteroidSize;
  /** Top left cell: large asteroids cover more than one cell (ASTEROID_CONFIG). */
  x: number;
  y: number;
  ore: number;
  initialOre: number;
}

export interface Building {
  id: EntityId;
  type: BuildingType;
  ownerId: PlayerId;
  level: BuildingLevel;
  x: number;
  y: number;
  hp: number;
  /** Turrets: ticks until the next shot. */
  cooldown: number;
  /** What the building works on in this tick: the asteroid a mine mines, the pirate a turret aims at. */
  targetId: EntityId | null;
}

/** Positions of moving objects are continuous, in cells. */
export interface Enemy {
  id: EntityId;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Ticks until the next attack. */
  cooldown: number;
}

export interface Projectile {
  id: EntityId;
  type: TurretType;
  /** Owner of the turret that fired it: gets the bounty of the ships it destroys. */
  ownerId: PlayerId;
  x: number;
  y: number;
  targetId: EntityId;
  /** Last known position of the target: the projectile still lands there if the target dies. */
  targetX: number;
  targetY: number;
  damage: number;
  /** Cells per second. */
  speed: number;
  splashRadius: number;
}

export interface WaveState {
  /** Number of waves spawned so far. */
  index: number;
  nextWaveTick: number;
}

/** The whole game: plain, JSON-serializable data. */
export interface GameState {
  modeId: GameModeId;
  level: LevelConfig;
  seed: number;
  rngState: number;
  tick: number;
  status: GameStatus;
  nextEntityId: EntityId;
  /** Ore on the map at the start of the game. */
  totalOre: number;
  wave: WaveState;
  players: PlayerState[];
  asteroids: Asteroid[];
  buildings: Building[];
  enemies: Enemy[];
  projectiles: Projectile[];
}

export type ReadonlyDeep<T> = T extends readonly (infer E)[]
  ? readonly ReadonlyDeep<E>[]
  : T extends object
    ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> }
    : T;

/** What the client sees: the state can be read but only changed through commands. */
export type ReadonlyGameState = ReadonlyDeep<GameState>;
