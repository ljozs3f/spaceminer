import type { EnemyType } from '../types';

export interface EnemyStats {
  /** Before the wave scaling of the level (see WaveConfig). */
  readonly maxHp: number;
  /** Cells per second. */
  readonly speed: number;
  readonly damage: number;
  readonly attacksPerSecond: number;
  /** Cells between the enemy and the center of the building it attacks. */
  readonly attackRange: number;
  /**
   * Ore for the player whose turret destroys the ship. Defending pays, so the player still earns when the
   * asteroids near the base run dry while the waves keep coming.
   */
  readonly bounty: number;
}

/** The three pirate ships. Waves start with raiders and bring in the heavier ships later. */
export const ENEMY_CONFIG: Readonly<Record<EnemyType, EnemyStats>> = {
  // fast and fragile, comes in numbers: lasers and missile splash handle them
  raider: { maxHp: 25, speed: 2.2, damage: 3, attacksPerSecond: 1.5, attackRange: 1.2, bounty: 2 },
  // the all-rounder
  gunship: { maxHp: 70, speed: 1.4, damage: 7, attacksPerSecond: 1, attackRange: 1.5, bounty: 5 },
  // slow and tough, hits hard from further out: missiles and upgraded lasers
  dreadnought: { maxHp: 200, speed: 0.8, damage: 14, attacksPerSecond: 0.6, attackRange: 1.8, bounty: 12 },
};

/** How pirate ships fly around asteroids. Distances are in cells. */
export const FLIGHT_CONFIG = {
  /** Room kept between a ship and the rock of an asteroid. */
  asteroidMargin: 0.4,
  /** Asteroids up to this far ahead are steered around. */
  lookahead: 2.5,
  /** How hard ships turn away from an asteroid in their way (1: as hard as they pull towards the target). */
  avoidStrength: 2,
} as const;
