import { getBuildingStats, nextBuildingLevel } from '../src/buildings';
import { validateCommand, type Command } from '../src/commands';
import { distanceToAsteroid, findAsteroidAt, findAt, findPlayer, isInBounds } from '../src/queries';
import type { Building, BuildingType, PlayerId, ReadonlyDeep, ReadonlyGameState } from '../src/types';
import { distance } from '../src/units';

type OwnBuilding = ReadonlyDeep<Building>;

/** Ore the player keeps for the next priority before spending on upgrades. */
const UPGRADE_RESERVE = 60;

/**
 * A simple, greedy player for the balance tests. In order: sell mines with nothing left to mine, keep the
 * energy up, guard every mine with turrets (more as the waves grow), put a mine next to the nearest unmined
 * asteroid, upgrade. It saves up for the first thing it wants and never plans ahead. It is deliberately
 * not clever: if it can win a level, a person can too.
 */
export function chooseCommand(state: ReadonlyGameState, playerId: PlayerId): Command | null {
  const player = findPlayer(state.players, playerId);
  if (!player) return null;
  const own = state.buildings.filter((building) => building.ownerId === playerId);
  const mines = own.filter((building) => building.type === 'mine');
  const valid = (command: Command): Command | null =>
    validateCommand(state, command) === null ? command : null;

  const exhausted = mines.find((mine) => !hasOreInRange(state, mine));
  if (exhausted) return valid({ type: 'sellBuilding', playerId, buildingId: exhausted.id });

  if (player.energyProduced < player.energyConsumed + 2) {
    return build(state, playerId, 'solar', centerOf(own));
  }

  // guard strength counts turret levels: a level 2 laser guards like two level 1 lasers
  const wantedStrength = 1 + Math.floor(state.wave.index / 3);
  for (const mine of mines) {
    const guards = own.filter(
      (building) => (building.type === 'laser' || building.type === 'missile') && near(building, mine, 2.5),
    );
    const strength = guards.reduce((sum, guard) => sum + guard.level, 0);
    if (strength < wantedStrength) {
      // upgrade before building more: level 2 (level 3 later) turrets are what stops the heavy ships
      const targetLevel = state.wave.index >= 8 ? 3 : 2;
      const weakest = [...guards].sort((a, b) => a.level - b.level)[0];
      if (weakest && weakest.level < targetLevel) {
        return valid({ type: 'upgradeBuilding', playerId, buildingId: weakest.id });
      }
      const missiles = guards.filter((guard) => guard.type === 'missile').length;
      const type = state.wave.index >= 4 && missiles < guards.length / 2 ? 'missile' : 'laser';
      return build(state, playerId, type, mine);
    }
  }

  const mineCommand = nextMine(state, playerId, own, mines);
  if (mineCommand) return valid(mineCommand);

  if (player.ore < UPGRADE_RESERVE) return null;
  const upgradable = [...own]
    .filter((building) => building.type !== 'solar' && nextBuildingLevel(building.level) !== null)
    .sort((a, b) => a.level - b.level || turretFirst(a) - turretFirst(b));
  for (const building of upgradable) {
    const command = valid({ type: 'upgradeBuilding', playerId, buildingId: building.id });
    if (command) return command;
  }
  return null;
}

function turretFirst(building: OwnBuilding): number {
  return building.type === 'mine' ? 1 : 0;
}

function hasOreInRange(state: ReadonlyGameState, mine: OwnBuilding): boolean {
  const { range } = getBuildingStats('mine', mine.level);
  return state.asteroids.some((asteroid) => distanceToAsteroid(mine.x, mine.y, asteroid) <= range);
}

/** A mine on the free cell that reaches the most ore around the asteroid closest to the base. */
function nextMine(
  state: ReadonlyGameState,
  playerId: PlayerId,
  own: readonly OwnBuilding[],
  mines: readonly OwnBuilding[],
): Command | null {
  const { range } = getBuildingStats('mine', 1);
  const unmined = state.asteroids.filter(
    (asteroid) =>
      !mines.some(
        (mine) => distanceToAsteroid(mine.x, mine.y, asteroid) <= getBuildingStats('mine', mine.level).range,
      ),
  );
  const target = closestTo(unmined, own);
  if (!target) return null;

  let best: { x: number; y: number; ore: number; d: number } | null = null;
  for (const cell of freeCellsAround(state, target, range)) {
    if (distanceToAsteroid(cell.x, cell.y, target) > range) continue;
    const ore = state.asteroids
      .filter((asteroid) => distanceToAsteroid(cell.x, cell.y, asteroid) <= range)
      .reduce((sum, asteroid) => sum + asteroid.ore, 0);
    const d = Math.min(...own.map((building) => distance(cell.x, cell.y, building.x, building.y)));
    if (!best || ore > best.ore || (ore === best.ore && d < best.d)) best = { ...cell, ore, d };
  }
  return best && { type: 'placeBuilding', playerId, buildingType: 'mine', x: best.x, y: best.y };
}

/** null also while it is not affordable: the player waits and saves up instead of spending elsewhere. */
function build(
  state: ReadonlyGameState,
  playerId: PlayerId,
  buildingType: BuildingType,
  near: { readonly x: number; readonly y: number },
): Command | null {
  const [cell] = freeCellsAround(state, near, 4);
  if (!cell) return null;
  const command: Command = { type: 'placeBuilding', playerId, buildingType, x: cell.x, y: cell.y };
  return validateCommand(state, command) === null ? command : null;
}

/** Free cells within `radius` of a point, nearest first. */
function freeCellsAround(
  state: ReadonlyGameState,
  center: { readonly x: number; readonly y: number },
  radius: number,
): { x: number; y: number }[] {
  const cells: { x: number; y: number; d: number }[] = [];
  const r = Math.ceil(radius);
  for (let y = Math.round(center.y) - r; y <= Math.round(center.y) + r; y++) {
    for (let x = Math.round(center.x) - r; x <= Math.round(center.x) + r; x++) {
      const d = distance(x, y, center.x, center.y);
      if (d > radius || !isInBounds(state.level, x, y)) continue;
      if (findAt(state.buildings, x, y) || findAsteroidAt(state.asteroids, x, y)) continue;
      cells.push({ x, y, d });
    }
  }
  return cells.sort((a, b) => a.d - b.d).map(({ x, y }) => ({ x, y }));
}

function near(a: OwnBuilding, b: OwnBuilding, radius: number): boolean {
  return distance(a.x, a.y, b.x, b.y) <= radius;
}

function centerOf(buildings: readonly OwnBuilding[]): { x: number; y: number } {
  const count = Math.max(1, buildings.length);
  return {
    x: buildings.reduce((sum, building) => sum + building.x, 0) / count,
    y: buildings.reduce((sum, building) => sum + building.y, 0) / count,
  };
}

function closestTo<T extends { readonly x: number; readonly y: number }>(
  items: readonly T[],
  own: readonly OwnBuilding[],
): T | undefined {
  let closest: T | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const d = Math.min(...own.map((building) => distance(item.x, item.y, building.x, building.y)));
    if (d < closestDistance) {
      closest = item;
      closestDistance = d;
    }
  }
  return closest;
}
