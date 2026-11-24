import type { AsteroidSize } from '../types';

export interface AsteroidSizeConfig {
  /** Width and height in cells. */
  readonly cells: 1 | 2;
  /** Radius of the rock in cells: pirate ships fly around it. */
  readonly radius: number;
  /** Ore range before the richness of the field (AsteroidFieldConfig). */
  readonly minOre: number;
  readonly maxOre: number;
}

export const ASTEROID_CONFIG: Readonly<Record<AsteroidSize, AsteroidSizeConfig>> = {
  small: { cells: 1, radius: 0.3, minOre: 20, maxOre: 35 },
  medium: { cells: 1, radius: 0.45, minOre: 45, maxOre: 75 },
  large: { cells: 2, radius: 0.95, minOre: 160, maxOre: 240 },
};
