import {
  getBuildingStats,
  type BuildingLevel,
  type BuildingType,
  type EnemyType,
  type RejectionReason,
} from '@space-miner/sim';

/** Display data shared by the Phaser scene and the Vue UI. */
export const BUILDINGS: Readonly<Record<BuildingType, { readonly name: string; readonly color: number }>> = {
  mine: { name: 'Mine', color: 0xf0a030 },
  solar: { name: 'Solar', color: 0xf5d442 },
  laser: { name: 'Laser', color: 0x40c4ff },
  missile: { name: 'Missile', color: 0xc77dff },
};

/** size: relative to a grid cell. */
export const ENEMIES: Readonly<
  Record<EnemyType, { readonly name: string; readonly color: number; readonly size: number }>
> = {
  raider: { name: 'Raider', color: 0xff8a4d, size: 0.22 },
  gunship: { name: 'Gunship', color: 0xff4d5e, size: 0.32 },
  dreadnought: { name: 'Dreadnought', color: 0xe040fb, size: 0.46 },
};

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export const REJECTION_MESSAGES: Readonly<Record<RejectionReason, string>> = {
  gameOver: 'The game is over.',
  unknownPlayer: 'Unknown player.',
  unknownBuildingType: 'Unknown building.',
  outOfBounds: 'Outside the map.',
  cellOccupied: 'That cell is taken.',
  cellHasAsteroid: 'Cannot build on an asteroid.',
  insufficientOre: 'Not enough ore.',
  buildingNotFound: 'That building no longer exists.',
  notOwner: 'That building is not yours.',
  maxLevel: 'Already at the highest level.',
  lastBuilding: 'Your last building cannot be sold.',
};

export interface StatLine {
  readonly label: string;
  readonly value: string;
}

export function describeStats(type: BuildingType, level: BuildingLevel): StatLine[] {
  switch (type) {
    case 'mine': {
      const stats = getBuildingStats(type, level);
      return [
        { label: 'Ore / s', value: format(stats.orePerSecond) },
        { label: 'Range', value: format(stats.range) },
        { label: 'Energy use', value: format(stats.energyUse) },
      ];
    }
    case 'solar':
      return [{ label: 'Energy output', value: format(getBuildingStats(type, level).energyOutput) }];
    case 'laser':
    case 'missile': {
      const stats = getBuildingStats(type, level);
      return [
        { label: 'Damage', value: format(stats.damage) },
        { label: 'Shots / s', value: format(stats.shotsPerSecond) },
        { label: 'Range', value: format(stats.range) },
        ...(stats.splashRadius > 0 ? [{ label: 'Splash', value: format(stats.splashRadius) }] : []),
        { label: 'Energy use', value: format(stats.energyUse) },
      ];
    }
  }
}

/** Range of a building type, for range circles (undefined: the type has no range). */
export function rangeOf(type: BuildingType, level: BuildingLevel): number | undefined {
  return type === 'solar' ? undefined : getBuildingStats(type, level).range;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
