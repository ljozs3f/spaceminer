import { getBuildingStats } from '../buildings';
import { SALVO_GAP_SECONDS } from '../config/buildings';
import type { GameEvent } from '../events';
import { boostOf } from '../queries';
import type { Enemy, GameState } from '../types';
import { cellCenter, DISTANCE_EPSILON, distance, intervalTicks, secondsToTicks } from '../units';
import { getEfficiencies } from './energy';

/**
 * Lasers and missile launchers fire at the nearest pirate in range. Their reload speeds up with the owner's
 * energy efficiency, so an energy shortage lowers the fire rate proportionally, and many times over under
 * Ultra Instinct (then a turret may fire more than once in a tick). A turret with a salvo of more than one
 * (upgraded missile launchers) fires its projectiles in quick succession, each at the next nearest pirate,
 * then reloads.
 */
export function updateTurrets(state: GameState, events: GameEvent[]): void {
  const efficiencies = getEfficiencies(state);
  const salvoGap = secondsToTicks(SALVO_GAP_SECONDS);
  for (const turret of state.buildings) {
    if (turret.type !== 'laser' && turret.type !== 'missile') continue;
    const efficiency = efficiencies.get(turret.ownerId) ?? 0;
    const stats = getBuildingStats(turret.type, turret.level);
    const x = cellCenter(turret.x);
    const y = cellCenter(turret.y);
    // aim every tick, not only when firing, so the turret can follow its target
    const targets = efficiency > 0 ? enemiesInRange(state.enemies, x, y, stats.range) : [];
    turret.targetId = targets[0]?.id ?? null;
    if (efficiency === 0) continue;

    turret.cooldown -= efficiency * boostOf(state, turret.ownerId);
    // every shot adds at least the salvo gap to the cooldown, so this ends
    while (turret.cooldown <= 0) {
      if (targets.length === 0) {
        // stay ready, but do not save up shots (a salvo that lost its target goes on at the next one)
        turret.cooldown = 0;
        break;
      }
      // the projectiles of a salvo spread over the nearest pirates
      const fired = turret.salvoLeft > 0 ? stats.salvo - turret.salvoLeft : 0;
      const target = targets[fired % targets.length] ?? targets[0];
      if (!target) break;
      state.projectiles.push({
        id: state.nextEntityId++,
        type: turret.type,
        ownerId: turret.ownerId,
        x,
        y,
        targetId: target.id,
        targetX: target.x,
        targetY: target.y,
        damage: stats.damage,
        speed: stats.projectileSpeed,
        splashRadius: stats.splashRadius,
      });
      events.push({
        type: 'shotFired',
        turret: turret.type,
        buildingId: turret.id,
        x,
        y,
        targetX: target.x,
        targetY: target.y,
      });
      turret.salvoLeft = (turret.salvoLeft > 0 ? turret.salvoLeft : stats.salvo) - 1;
      // the gaps of a salvo are part of its reload, so salvos come exactly shotsPerSecond times a second;
      // fractional intervals carry over, so the average fire rate matches the config exactly
      turret.cooldown +=
        turret.salvoLeft > 0
          ? salvoGap
          : intervalTicks(stats.shotsPerSecond) - Math.max(0, stats.salvo - 1) * salvoGap;
    }
  }
}

/** Pirates within range, nearest first (ties keep the order of the state, so the result is deterministic). */
function enemiesInRange(enemies: readonly Enemy[], x: number, y: number, range: number): Enemy[] {
  return enemies
    .map((enemy) => ({ enemy, d: distance(x, y, enemy.x, enemy.y) }))
    .filter(({ d }) => d <= range + DISTANCE_EPSILON)
    .sort((a, b) => a.d - b.d)
    .map(({ enemy }) => enemy);
}
