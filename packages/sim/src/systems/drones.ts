import { getBuildingStats } from '../buildings';
import { DRONE_CONFIG } from '../config/buildings';
import { boostOf, findById } from '../queries';
import type { Building, Drone, GameState } from '../types';
import { cellCenter, DISTANCE_EPSILON, distance, perTick } from '../units';
import { getEfficiencies } from './energy';

/**
 * Repair hives keep their drones (one per level) and send them to the damaged buildings of their owner in
 * range: the most damaged first, spread over the damage. A drone repairs from a spot beside its building,
 * at a rate that follows the owner's energy efficiency, and flies home when nothing needs repair. Under
 * Ultra Instinct they fly and repair many times faster. Drones of a hive that is gone disappear with it.
 */
export function updateDrones(state: GameState): void {
  const hives = state.buildings.filter((building) => building.type === 'repair');
  const hiveIds = new Set(hives.map((hive) => hive.id));
  state.drones = state.drones.filter((drone) => hiveIds.has(drone.hiveId));

  for (const hive of hives) {
    const { drones } = getBuildingStats('repair', hive.level);
    const slots = new Set(
      state.drones.filter((drone) => drone.hiveId === hive.id).map((drone) => drone.slot),
    );
    for (let slot = 0; slot < drones; slot++) {
      if (slots.has(slot)) continue;
      const dock = dockPoint(hive, slot);
      state.drones.push({
        id: state.nextEntityId++,
        hiveId: hive.id,
        ownerId: hive.ownerId,
        slot,
        x: dock.x,
        y: dock.y,
        targetId: null,
        repairing: false,
      });
    }
  }

  const efficiencies = getEfficiencies(state);
  for (const drone of state.drones) {
    const hive = findById(state.buildings, drone.hiveId);
    if (!hive) continue;
    const stats = getBuildingStats('repair', hive.level);
    const boost = boostOf(state, drone.ownerId);
    const target = chooseTarget(state, drone, hive, stats.range);
    drone.targetId = target?.id ?? null;
    const point = target ? workPoint(target, drone.slot) : dockPoint(hive, drone.slot);
    const d = distance(drone.x, drone.y, point.x, point.y);
    const move = perTick(stats.droneSpeed) * boost;
    drone.repairing = false;
    if (d > move) {
      drone.x += ((point.x - drone.x) / d) * move;
      drone.y += ((point.y - drone.y) / d) * move;
      continue;
    }
    drone.x = point.x;
    drone.y = point.y;
    const efficiency = efficiencies.get(drone.ownerId) ?? 0;
    if (!target || efficiency === 0) continue;
    const { maxHp } = getBuildingStats(target.type, target.level);
    target.hp = Math.min(maxHp, target.hp + perTick(stats.repairPerSecond) * efficiency * boost);
    drone.repairing = true;
  }
}

/** The drone's building: the one it works on while that still needs it, otherwise the most urgent one. */
function chooseTarget(state: GameState, drone: Drone, hive: Building, range: number): Building | undefined {
  const needsRepair = (building: Building): boolean =>
    building.ownerId === drone.ownerId &&
    building.hp < getBuildingStats(building.type, building.level).maxHp &&
    distance(cellCenter(hive.x), cellCenter(hive.y), cellCenter(building.x), cellCenter(building.y)) <=
      range + DISTANCE_EPSILON;

  const current = drone.targetId === null ? undefined : findById(state.buildings, drone.targetId);
  if (current && needsRepair(current)) return current;

  const busy = new Map<number, number>();
  for (const other of state.drones) {
    if (other === drone || other.hiveId !== drone.hiveId || other.targetId === null) continue;
    busy.set(other.targetId, (busy.get(other.targetId) ?? 0) + 1);
  }
  let best: Building | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const building of state.buildings) {
    if (!needsRepair(building)) continue;
    const share = building.hp / getBuildingStats(building.type, building.level).maxHp;
    const score = share + (busy.get(building.id) ?? 0) * DRONE_CONFIG.spreadPenalty;
    if (score < bestScore) {
      best = building;
      bestScore = score;
    }
  }
  return best;
}

/** Where a drone repairs a building from: its own side of it (the slots are a third of a turn apart). */
export function workPoint(building: Building, slot: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (slot * Math.PI * 2) / 3;
  return {
    x: cellCenter(building.x) + Math.cos(angle) * DRONE_CONFIG.workDistance,
    y: cellCenter(building.y) + Math.sin(angle) * DRONE_CONFIG.workDistance,
  };
}

/** Where a drone rests on its hive. */
export function dockPoint(hive: Building, slot: number): { x: number; y: number } {
  const angle = Math.PI / 2 + (slot * Math.PI * 2) / 3;
  return {
    x: cellCenter(hive.x) + Math.cos(angle) * DRONE_CONFIG.dockDistance,
    y: cellCenter(hive.y) + Math.sin(angle) * DRONE_CONFIG.dockDistance,
  };
}
