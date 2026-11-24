import type { BuildingType } from '../types';

interface BaseStats {
  /** Ore to place the building (level 1) or to upgrade it to this level. */
  readonly cost: number;
  readonly maxHp: number;
}

export interface MineStats extends BaseStats {
  readonly energyUse: number;
  readonly range: number;
  readonly orePerSecond: number;
}

export interface SolarStats extends BaseStats {
  readonly energyOutput: number;
}

export interface TurretStats extends BaseStats {
  readonly energyUse: number;
  readonly range: number;
  readonly damage: number;
  readonly shotsPerSecond: number;
  /** Cells per second. */
  readonly projectileSpeed: number;
  /** 0: the projectile only hits its target. */
  readonly splashRadius: number;
}

export interface BuildingStatsByType {
  readonly mine: MineStats;
  readonly solar: SolarStats;
  readonly laser: TurretStats;
  readonly missile: TurretStats;
}

export type BuildingStats = BuildingStatsByType[BuildingType];

type LevelStats<T> = readonly [level1: T, level2: T, level3: T];

/** Balance of every building per level. Ranges and distances are in cells. */
export const BUILDING_CONFIG: { readonly [K in BuildingType]: LevelStats<BuildingStatsByType[K]> } = {
  mine: [
    { cost: 50, maxHp: 60, energyUse: 2, range: 3, orePerSecond: 1.5 },
    { cost: 75, maxHp: 90, energyUse: 3, range: 3.5, orePerSecond: 2.5 },
    { cost: 120, maxHp: 130, energyUse: 4, range: 4, orePerSecond: 3.5 },
  ],
  solar: [
    { cost: 40, maxHp: 50, energyOutput: 5 },
    { cost: 60, maxHp: 75, energyOutput: 9 },
    { cost: 100, maxHp: 100, energyOutput: 14 },
  ],
  laser: [
    {
      cost: 40,
      maxHp: 70,
      energyUse: 1.5,
      range: 3,
      damage: 4,
      shotsPerSecond: 4,
      projectileSpeed: 20,
      splashRadius: 0,
    },
    {
      cost: 60,
      maxHp: 100,
      energyUse: 2,
      range: 3.5,
      damage: 6,
      shotsPerSecond: 5,
      projectileSpeed: 20,
      splashRadius: 0,
    },
    {
      cost: 100,
      maxHp: 140,
      energyUse: 3,
      range: 4,
      damage: 9,
      shotsPerSecond: 6,
      projectileSpeed: 22,
      splashRadius: 0,
    },
  ],
  missile: [
    {
      cost: 120,
      maxHp: 80,
      energyUse: 3,
      range: 6,
      damage: 30,
      shotsPerSecond: 0.5,
      projectileSpeed: 6,
      splashRadius: 1.2,
    },
    {
      cost: 150,
      maxHp: 110,
      energyUse: 4,
      range: 6.5,
      damage: 45,
      shotsPerSecond: 0.6,
      projectileSpeed: 7,
      splashRadius: 1.4,
    },
    {
      cost: 220,
      maxHp: 150,
      energyUse: 5,
      range: 7,
      damage: 65,
      shotsPerSecond: 0.7,
      projectileSpeed: 8,
      splashRadius: 1.6,
    },
  ],
};

export const BUILDING_SALE = {
  /**
   * Share of the ore spent on a building (placing and upgrades) paid back when it is sold at full health.
   * A damaged building pays back proportionally less, so selling one that is about to fall is no trick.
   */
  refundFraction: 0.6,
} as const;
