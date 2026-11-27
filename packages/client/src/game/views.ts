import {
  ASTEROID_CONFIG,
  asteroidCenter,
  boostOf,
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
  ULTRA_INSTINCT_CONFIG,
  validateCommand,
  type AsteroidSize,
  type BuildingLevel,
  type BuildingType,
  type EntityId,
  type PlayerId,
  type ReadonlyGameState,
  type WaveGroup,
} from '@space-miner/sim';
import { asteroidColor } from '../phaser/asteroidLook';
import { cssColor, describeStats, type StatLine } from './presentation';

/** Plain snapshots of the state for Vue: the UI never holds on to the live game state. */

export interface HudView {
  readonly tick: number;
  readonly ore: number;
  /** Ore per second the player's mines bring in right now (bounties not included). */
  readonly oreRate: number;
  readonly energyProduced: number;
  readonly energyConsumed: number;
  readonly efficiency: number;
  readonly minedFraction: number;
  readonly goalFraction: number;
  readonly wavesSpawned: number;
  readonly secondsToNextWave: number;
  /** How far the wait for the next wave has gone, 0 (just started) to 1 (the wave is here). */
  readonly waveProgress: number;
  readonly nextWave: readonly WaveGroup[];
  /** Pirate ships on the map. */
  readonly enemies: number;
  readonly ultraInstinct: UltraInstinctView;
}

export interface UltraInstinctView {
  /** On in this tick. */
  readonly active: boolean;
  /** Its burnout, right after it, is on in this tick: every building works many times worse. */
  readonly burnout: boolean;
  /** Can be started now. */
  readonly ready: boolean;
  /**
   * While on: seconds left; in the burnout: seconds of it left; while recharging: seconds until it is ready;
   * 0 when ready.
   */
  readonly secondsLeft: number;
  /** Seconds until it can be started again; 0 when ready. */
  readonly readyInSeconds: number;
  /**
   * While on or in the burnout: the share of its time left (1 to 0); while recharging: how far it has
   * recharged (0 to 1); 1 when ready.
   */
  readonly fraction: number;
}

/** Where a selected object is on the map, in cells: its center and its radius. */
export interface MapSpot {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface BuildingView {
  readonly kind: 'building';
  readonly id: EntityId;
  readonly type: BuildingType;
  readonly level: BuildingLevel;
  readonly spot: MapSpot;
  readonly hp: number;
  readonly maxHp: number;
  readonly stats: readonly StatLine[];
  /** null: the building is at the highest level. */
  readonly upgrade: {
    readonly level: BuildingLevel;
    readonly cost: number;
    readonly affordable: boolean;
    /** Ore still missing for the upgrade (0 when affordable). */
    readonly missing: number;
    /** The stats at the next level, in the same order as `stats`. */
    readonly stats: readonly StatLine[];
  } | null;
  readonly sellValue: number;
  /** false for the player's last building. */
  readonly sellable: boolean;
}

export interface AsteroidView {
  readonly kind: 'asteroid';
  readonly id: EntityId;
  readonly size: AsteroidSize;
  readonly spot: MapSpot;
  /** The asteroid's ore color as it looks now (it fades as the asteroid is mined), as CSS. */
  readonly color: string;
  readonly ore: number;
  readonly initialOre: number;
  /** Share of the ore still in the asteroid, 0 to 1. */
  readonly remainingFraction: number;
}

export type SelectionView = BuildingView | AsteroidView;

export function selectHud(state: ReadonlyGameState, playerId: PlayerId): HudView {
  const player = findPlayer(state.players, playerId);
  const efficiency = player ? energyEfficiency(player) : 0;
  const boost = boostOf(state, playerId);
  const oreRate = state.buildings
    .filter(
      (building) => building.ownerId === playerId && building.type === 'mine' && building.targetId !== null,
    )
    .reduce((sum, mine) => sum + getBuildingStats('mine', mine.level).orePerSecond * efficiency * boost, 0);
  const { waves } = state.level;
  const waitTicks = (state.wave.index === 0 ? waves.firstWaveSeconds : waves.intervalSeconds) * TICK_RATE;
  const ticksLeft = ticksUntilNextWave(state);
  return {
    tick: state.tick,
    ore: player?.ore ?? 0,
    oreRate,
    energyProduced: player?.energyProduced ?? 0,
    energyConsumed: player?.energyConsumed ?? 0,
    efficiency,
    minedFraction: minedOreFraction(state),
    goalFraction: MINING_MODE_CONFIG.winMinedOreFraction,
    wavesSpawned: state.wave.index,
    secondsToNextWave: Math.ceil(ticksLeft / TICK_RATE),
    waveProgress: Math.min(1, Math.max(0, 1 - ticksLeft / waitTicks)),
    nextWave: getWaveComposition(waves, state.wave.index),
    enemies: state.enemies.length,
    ultraInstinct: selectUltraInstinct(state, playerId),
  };
}

function selectUltraInstinct(state: ReadonlyGameState, playerId: PlayerId): UltraInstinctView {
  const player = findPlayer(state.players, playerId);
  const until = player?.ultraInstinctUntilTick ?? 0;
  const burnoutUntil = player?.ultraInstinctBurnoutUntilTick ?? 0;
  const readyAt = player?.ultraInstinctReadyTick ?? 0;
  const seconds = (ticks: number): number => Math.ceil(ticks / TICK_RATE);
  const readyInSeconds = seconds(Math.max(0, readyAt - state.tick));
  if (state.tick < until) {
    const left = until - state.tick;
    return {
      active: true,
      burnout: false,
      ready: false,
      secondsLeft: seconds(left),
      readyInSeconds,
      fraction: left / (ULTRA_INSTINCT_CONFIG.durationSeconds * TICK_RATE),
    };
  }
  if (state.tick < burnoutUntil) {
    const left = burnoutUntil - state.tick;
    return {
      active: false,
      burnout: true,
      ready: false,
      secondsLeft: seconds(left),
      readyInSeconds,
      fraction: left / (ULTRA_INSTINCT_CONFIG.burnoutSeconds * TICK_RATE),
    };
  }
  if (state.tick < readyAt) {
    const left = readyAt - state.tick;
    return {
      active: false,
      burnout: false,
      ready: false,
      secondsLeft: seconds(left),
      readyInSeconds,
      fraction: 1 - left / (ULTRA_INSTINCT_CONFIG.rechargeSeconds * TICK_RATE),
    };
  }
  return {
    active: false,
    burnout: false,
    ready: player !== undefined,
    secondsLeft: 0,
    readyInSeconds,
    fraction: 1,
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
      spot: { x: building.x + 0.5, y: building.y + 0.5, radius: 0.5 },
      hp: building.hp,
      maxHp: getBuildingStats(building.type, building.level).maxHp,
      stats: describeStats(building.type, building.level),
      upgrade:
        nextLevel === null
          ? null
          : {
              level: nextLevel,
              cost: upgradeCost,
              affordable: ore >= upgradeCost,
              missing: Math.max(0, Math.ceil(upgradeCost - ore)),
              stats: describeStats(building.type, nextLevel),
            },
      sellValue: getSellValue(building),
      sellable: validateCommand(state, { type: 'sellBuilding', playerId, buildingId: building.id }) === null,
    };
  }
  const asteroid = findById(state.asteroids, id);
  if (asteroid) {
    const remainingFraction = asteroid.ore / asteroid.initialOre;
    return {
      kind: 'asteroid',
      id: asteroid.id,
      size: asteroid.size,
      spot: { ...asteroidCenter(asteroid), radius: ASTEROID_CONFIG[asteroid.size].cells / 2 },
      color: cssColor(asteroidColor(asteroid.id, remainingFraction).tint),
      ore: asteroid.ore,
      initialOre: asteroid.initialOre,
      remainingFraction,
    };
  }
  return null;
}
