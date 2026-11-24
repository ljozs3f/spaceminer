import {
  energyEfficiency,
  findById,
  findPlayer,
  getBuildingStats,
  getSellValue,
  getWaveComposition,
  MINING_MODE_CONFIG,
  minedOreFraction,
  nextBuildingLevel,
  TICK_RATE,
  ticksUntilNextWave,
  validateCommand,
  type AsteroidSize,
  type BuildingLevel,
  type BuildingType,
  type EntityId,
  type PlayerId,
  type ReadonlyGameState,
  type WaveGroup,
} from '@space-miner/sim';
import { describeStats, type StatLine } from './presentation';

/** Plain snapshots of the state for Vue: the UI never holds on to the live game state. */

export interface HudView {
  readonly ore: number;
  readonly energyProduced: number;
  readonly energyConsumed: number;
  readonly efficiency: number;
  readonly minedFraction: number;
  readonly goalFraction: number;
  readonly wavesSpawned: number;
  readonly secondsToNextWave: number;
  readonly nextWave: readonly WaveGroup[];
}

export interface BuildingView {
  readonly kind: 'building';
  readonly id: EntityId;
  readonly type: BuildingType;
  readonly level: BuildingLevel;
  readonly hp: number;
  readonly maxHp: number;
  readonly stats: readonly StatLine[];
  /** null: the building is at the highest level. */
  readonly upgrade: {
    readonly level: BuildingLevel;
    readonly cost: number;
    readonly affordable: boolean;
  } | null;
  readonly sellValue: number;
  /** false for the player's last building. */
  readonly sellable: boolean;
}

export interface AsteroidView {
  readonly kind: 'asteroid';
  readonly id: EntityId;
  readonly size: AsteroidSize;
  readonly ore: number;
  readonly initialOre: number;
  /** Share of the ore still in the asteroid, 0 to 1. */
  readonly remainingFraction: number;
}

export type SelectionView = BuildingView | AsteroidView;

export function selectHud(state: ReadonlyGameState, playerId: PlayerId): HudView {
  const player = findPlayer(state.players, playerId);
  return {
    ore: player?.ore ?? 0,
    energyProduced: player?.energyProduced ?? 0,
    energyConsumed: player?.energyConsumed ?? 0,
    efficiency: player ? energyEfficiency(player) : 0,
    minedFraction: minedOreFraction(state),
    goalFraction: MINING_MODE_CONFIG.winMinedOreFraction,
    wavesSpawned: state.wave.index,
    secondsToNextWave: Math.ceil(ticksUntilNextWave(state) / TICK_RATE),
    nextWave: getWaveComposition(state.level.waves, state.wave.index),
  };
}

/** The selected building or asteroid; null when nothing is selected or it no longer exists. */
export function selectSelection(
  state: ReadonlyGameState,
  playerId: PlayerId,
  id: EntityId | null,
): SelectionView | null {
  if (id === null) return null;
  const building = findById(state.buildings, id);
  if (building) {
    const ore = findPlayer(state.players, playerId)?.ore ?? 0;
    const nextLevel = nextBuildingLevel(building.level);
    const upgradeCost = nextLevel === null ? 0 : getBuildingStats(building.type, nextLevel).cost;
    return {
      kind: 'building',
      id: building.id,
      type: building.type,
      level: building.level,
      hp: building.hp,
      maxHp: getBuildingStats(building.type, building.level).maxHp,
      stats: describeStats(building.type, building.level),
      upgrade:
        nextLevel === null ? null : { level: nextLevel, cost: upgradeCost, affordable: ore >= upgradeCost },
      sellValue: getSellValue(building),
      sellable: validateCommand(state, { type: 'sellBuilding', playerId, buildingId: building.id }) === null,
    };
  }
  const asteroid = findById(state.asteroids, id);
  if (asteroid) {
    return {
      kind: 'asteroid',
      id: asteroid.id,
      size: asteroid.size,
      ore: asteroid.ore,
      initialOre: asteroid.initialOre,
      remainingFraction: asteroid.ore / asteroid.initialOre,
    };
  }
  return null;
}
