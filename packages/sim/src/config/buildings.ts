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
  /**
   * Projectiles per shot. A salvo leaves one projectile every SALVO_GAP_SECONDS and goes to the nearest
   * pirates in range, one each (the nearest gets more when there are fewer pirates than projectiles).
   */
  readonly salvo: number;
}

export interface RepairStats extends BaseStats {
  readonly energyUse: number;
  /** Buildings within this distance of the hive are repaired (the hive itself too). */
  readonly range: number;
  /** Repair drones the hive sends out. */
  readonly drones: number;
  /** Hit points one drone restores per second. */
  readonly repairPerSecond: number;
  /** Cells per second. */
  readonly droneSpeed: number;
}

export interface BuildingStatsByType {
  readonly mine: MineStats;
  readonly solar: SolarStats;
  readonly laser: TurretStats;
  readonly missile: TurretStats;
  readonly repair: RepairStats;
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
      salvo: 1,
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
      salvo: 1,
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
      salvo: 1,
    },
  ],
  // one missile per level: a level 3 launcher fires a salvo of three, a little lighter each
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
      salvo: 1,
    },
    {
      cost: 150,
      maxHp: 110,
      energyUse: 4,
      range: 6.5,
      damage: 26,
      shotsPerSecond: 0.55,
      projectileSpeed: 7,
      splashRadius: 1.3,
      salvo: 2,
    },
    {
      cost: 220,
      maxHp: 150,
      energyUse: 5,
      range: 7,
      damage: 25,
      shotsPerSecond: 0.6,
      projectileSpeed: 8,
      splashRadius: 1.4,
      salvo: 3,
    },
  ],
  // the repair hive: one more drone per level, each a little faster at the job
  repair: [
    { cost: 90, maxHp: 60, energyUse: 2, range: 3.5, drones: 1, repairPerSecond: 4, droneSpeed: 3 },
    { cost: 110, maxHp: 85, energyUse: 3, range: 4, drones: 2, repairPerSecond: 5, droneSpeed: 3.5 },
    { cost: 160, maxHp: 115, energyUse: 4, range: 4.5, drones: 3, repairPerSecond: 6.5, droneSpeed: 4 },
  ],
};

/** Where repair drones hover, in cells from the center of a building. */
export const DRONE_CONFIG = {
  /** Drones repair from this far beside the building, each from its own side. */
  workDistance: 0.42,
  /** Docked drones sit this far from the center of their hive. */
  dockDistance: 0.2,
  /**
   * A drone picks the damaged building with the lowest share of its hit points, counting every drone of the
   * same hive already on a building as this much of its hit points: the drones spread over the damage.
   */
  spreadPenalty: 0.25,
} as const;

/** Seconds between the projectiles of a salvo. */
export const SALVO_GAP_SECONDS = 0.15;

export const BUILDING_SALE = {
  /**
   * Share of the ore spent on a building (placing and upgrades) paid back when it is sold at full health.
   * A damaged building pays back proportionally less, so selling one that is about to fall is no trick.
   */
  refundFraction: 0.6,
} as const;
