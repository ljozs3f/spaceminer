import { BUILDING_CONFIG, BUILDING_SALE, type BuildingStatsByType } from './config/buildings';
import type { Building, BuildingLevel, BuildingType, GameState, PlayerId } from './types';

const LEVEL_INDEX = { 1: 0, 2: 1, 3: 2 } as const;
const BUILDING_LEVELS: readonly BuildingLevel[] = [1, 2, 3];

export function getBuildingStats<T extends BuildingType>(
  type: T,
  level: BuildingLevel,
): BuildingStatsByType[T] {
  return BUILDING_CONFIG[type][LEVEL_INDEX[level]];
}

/** null: the building is at the highest level. */
export function nextBuildingLevel(level: BuildingLevel): BuildingLevel | null {
  switch (level) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return null;
  }
}

export function getBuildingEnergy(
  type: BuildingType,
  level: BuildingLevel,
): { produced: number; consumed: number } {
  return type === 'solar'
    ? { produced: getBuildingStats(type, level).energyOutput, consumed: 0 }
    : { produced: 0, consumed: getBuildingStats(type, level).energyUse };
}

/** Ore paid back when the building is sold: whole ore, less for a damaged building. */
export function getSellValue(building: {
  readonly type: BuildingType;
  readonly level: BuildingLevel;
  readonly hp: number;
}): number {
  const invested = BUILDING_LEVELS.filter((level) => level <= building.level).reduce(
    (sum, level) => sum + getBuildingStats(building.type, level).cost,
    0,
  );
  const health = Math.min(
    1,
    Math.max(0, building.hp / getBuildingStats(building.type, building.level).maxHp),
  );
  return Math.floor(invested * BUILDING_SALE.refundFraction * health);
}

export function addBuilding(
  state: GameState,
  ownerId: PlayerId,
  type: BuildingType,
  x: number,
  y: number,
): Building {
  const building: Building = {
    id: state.nextEntityId++,
    type,
    ownerId,
    level: 1,
    x,
    y,
    hp: getBuildingStats(type, 1).maxHp,
    cooldown: 0,
    salvoLeft: 0,
    targetId: null,
  };
  state.buildings.push(building);
  return building;
}
