import { addBuilding, getBuildingStats, getSellValue, nextBuildingLevel } from './buildings';
import { findAsteroidAt, findAt, findById, findPlayer, isInBounds } from './queries';
import {
  BUILDING_TYPES,
  type BuildingType,
  type EntityId,
  type GameState,
  type PlayerId,
  type ReadonlyGameState,
} from './types';

export interface PlaceBuildingCommand {
  readonly type: 'placeBuilding';
  readonly playerId: PlayerId;
  readonly buildingType: BuildingType;
  readonly x: number;
  readonly y: number;
}

export interface UpgradeBuildingCommand {
  readonly type: 'upgradeBuilding';
  readonly playerId: PlayerId;
  readonly buildingId: EntityId;
}

export interface SellBuildingCommand {
  readonly type: 'sellBuilding';
  readonly playerId: PlayerId;
  readonly buildingId: EntityId;
}

/** Every player action. Commands are the only way to change the state from outside the simulation. */
export type Command = PlaceBuildingCommand | UpgradeBuildingCommand | SellBuildingCommand;

export type RejectionReason =
  | 'gameOver'
  | 'unknownPlayer'
  | 'unknownBuildingType'
  | 'outOfBounds'
  | 'cellOccupied'
  | 'cellHasAsteroid'
  | 'insufficientOre'
  | 'buildingNotFound'
  | 'notOwner'
  | 'maxLevel'
  | 'lastBuilding';

export type CommandResult =
  | { readonly ok: true; readonly command: Command }
  | { readonly ok: false; readonly command: Command; readonly reason: RejectionReason };

/** null: the command is valid. Read-only, so the client can use it for previews. */
export function validateCommand(state: ReadonlyGameState, command: Command): RejectionReason | null {
  if (state.status !== 'running') return 'gameOver';
  const player = findPlayer(state.players, command.playerId);
  if (!player) return 'unknownPlayer';

  switch (command.type) {
    case 'placeBuilding': {
      if (!BUILDING_TYPES.includes(command.buildingType)) return 'unknownBuildingType';
      if (!isInBounds(state.level, command.x, command.y)) return 'outOfBounds';
      if (findAt(state.buildings, command.x, command.y)) return 'cellOccupied';
      if (findAsteroidAt(state.asteroids, command.x, command.y)) return 'cellHasAsteroid';
      if (player.ore < getBuildingStats(command.buildingType, 1).cost) return 'insufficientOre';
      return null;
    }
    case 'upgradeBuilding': {
      const building = findById(state.buildings, command.buildingId);
      if (!building) return 'buildingNotFound';
      if (building.ownerId !== player.id) return 'notOwner';
      const nextLevel = nextBuildingLevel(building.level);
      if (nextLevel === null) return 'maxLevel';
      if (player.ore < getBuildingStats(building.type, nextLevel).cost) return 'insufficientOre';
      return null;
    }
    case 'sellBuilding': {
      const building = findById(state.buildings, command.buildingId);
      if (!building) return 'buildingNotFound';
      if (building.ownerId !== player.id) return 'notOwner';
      // selling the last building would lose the game on the spot
      const owned = state.buildings.filter((candidate) => candidate.ownerId === player.id).length;
      if (owned === 1) return 'lastBuilding';
      return null;
    }
  }
}

export function applyCommand(state: GameState, command: Command): CommandResult {
  const reason = validateCommand(state, command);
  if (reason !== null) return { ok: false, command, reason };

  const player = expectDefined(findPlayer(state.players, command.playerId));
  switch (command.type) {
    case 'placeBuilding':
      player.ore -= getBuildingStats(command.buildingType, 1).cost;
      addBuilding(state, player.id, command.buildingType, command.x, command.y);
      break;
    case 'upgradeBuilding': {
      const building = expectDefined(findById(state.buildings, command.buildingId));
      const nextLevel = expectDefined(nextBuildingLevel(building.level));
      const current = getBuildingStats(building.type, building.level);
      const next = getBuildingStats(building.type, nextLevel);
      player.ore -= next.cost;
      building.level = nextLevel;
      // the extra hit points of the new level are added, damage taken so far is kept
      building.hp += next.maxHp - current.maxHp;
      break;
    }
    case 'sellBuilding': {
      const building = expectDefined(findById(state.buildings, command.buildingId));
      player.ore += getSellValue(building);
      state.buildings = state.buildings.filter((candidate) => candidate !== building);
      break;
    }
  }
  return { ok: true, command };
}

/** For values that validateCommand has already checked. */
function expectDefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('A validated command no longer applies');
  return value;
}
