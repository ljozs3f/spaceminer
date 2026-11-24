import { getBuildingStats } from '../buildings';
import type { GameEvent } from '../events';
import { findNearest } from '../queries';
import type { GameState } from '../types';
import { cellCenter, distance, intervalTicks } from '../units';
import { getEfficiencies } from './energy';

/**
 * Lasers and missile launchers fire at the nearest pirate in range. Their reload speeds up with the owner's
 * energy efficiency, so an energy shortage lowers the fire rate proportionally.
 */
export function updateTurrets(state: GameState, events: GameEvent[]): void {
  const efficiencies = getEfficiencies(state);
  for (const turret of state.buildings) {
    if (turret.type !== 'laser' && turret.type !== 'missile') continue;
    const efficiency = efficiencies.get(turret.ownerId) ?? 0;
    const stats = getBuildingStats(turret.type, turret.level);
    const x = cellCenter(turret.x);
    const y = cellCenter(turret.y);
    // aim every tick, not only when firing, so the turret can follow its target
    const target =
      efficiency > 0
        ? findNearest(state.enemies, (enemy) => distance(x, y, enemy.x, enemy.y), stats.range)
        : undefined;
    turret.targetId = target?.id ?? null;
    if (efficiency === 0) continue;

    turret.cooldown -= efficiency;
    if (turret.cooldown > 0) continue;
    if (!target) {
      // stay ready, but do not save up shots
      turret.cooldown = 0;
      continue;
    }
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
    // fractional intervals carry over, so the average fire rate matches the config exactly
    turret.cooldown += intervalTicks(stats.shotsPerSecond);
  }
}
