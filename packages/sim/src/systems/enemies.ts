import { ASTEROID_CONFIG } from '../config/asteroids';
import { ENEMY_CONFIG, FLIGHT_CONFIG } from '../config/enemies';
import type { GameEvent } from '../events';
import { asteroidCenter, boostOf, findNearest } from '../queries';
import type { Enemy, GameState } from '../types';
import { cellCenter, DISTANCE_EPSILON, distance, intervalTicks, perTick } from '../units';

/**
 * Pirates fly to the nearest building, around the asteroids in their way, and fire at it once in range.
 * Buildings under Ultra Instinct take only a fraction of the damage. Destroyed buildings disappear.
 */
export function updateEnemies(state: GameState, events: GameEvent[]): void {
  for (const enemy of state.enemies) {
    const stats = ENEMY_CONFIG[enemy.type];
    enemy.cooldown = Math.max(0, enemy.cooldown - 1);
    const target = findNearest(
      state.buildings.filter((building) => building.hp > 0),
      (building) => distance(enemy.x, enemy.y, cellCenter(building.x), cellCenter(building.y)),
    );
    if (!target) continue;

    const targetX = cellCenter(target.x);
    const targetY = cellCenter(target.y);
    const d = distance(enemy.x, enemy.y, targetX, targetY);
    if (d > stats.attackRange + DISTANCE_EPSILON) {
      const move = Math.min(perTick(stats.speed), d - stats.attackRange);
      const direction = steer(state, enemy, (targetX - enemy.x) / d, (targetY - enemy.y) / d, d);
      enemy.x += direction.x * move;
      enemy.y += direction.y * move;
    } else if (enemy.cooldown === 0) {
      target.hp -= stats.damage / boostOf(state, target.ownerId);
      enemy.cooldown = intervalTicks(stats.attacksPerSecond);
      events.push({
        type: 'enemyFired',
        enemy: enemy.type,
        enemyId: enemy.id,
        x: enemy.x,
        y: enemy.y,
        targetX,
        targetY,
      });
      if (target.hp <= 0) {
        events.push({
          type: 'buildingDestroyed',
          building: target.type,
          ownerId: target.ownerId,
          x: targetX,
          y: targetY,
        });
      }
    }
  }
  state.buildings = state.buildings.filter((building) => building.hp > 0);
}

/**
 * The direction to fly in: towards the target (dirX, dirY), turned aside by the asteroids ahead and pushed
 * away from any asteroid the ship is too close to.
 */
function steer(
  state: GameState,
  enemy: Enemy,
  dirX: number,
  dirY: number,
  targetDistance: number,
): { x: number; y: number } {
  const { asteroidMargin, lookahead, avoidStrength } = FLIGHT_CONFIG;
  let x = dirX;
  let y = dirY;
  for (const asteroid of state.asteroids) {
    const center = asteroidCenter(asteroid);
    const clearance = ASTEROID_CONFIG[asteroid.size].radius + asteroidMargin;
    const toX = center.x - enemy.x;
    const toY = center.y - enemy.y;
    const gap = Math.sqrt(toX * toX + toY * toY);
    if (gap < clearance) {
      if (gap === 0) continue;
      const push = ((clearance - gap) / clearance) * avoidStrength;
      x -= (toX / gap) * push;
      y -= (toY / gap) * push;
      continue;
    }
    // where the asteroid is: how far ahead along the flight, and how far to the side (left is positive)
    const ahead = toX * dirX + toY * dirY;
    const side = toY * dirX - toX * dirY;
    if (ahead <= 0 || ahead > Math.min(lookahead, targetDistance) || Math.abs(side) >= clearance) continue;
    const urgency = (1 - ahead / lookahead) * (1 - Math.abs(side) / clearance) * avoidStrength;
    // turn away from the side the asteroid is on; dead ahead, the asteroid id decides, so it stays deterministic
    const turn = side > 0 || (side === 0 && asteroid.id % 2 === 0) ? -1 : 1;
    x += -dirY * turn * urgency;
    y += dirX * turn * urgency;
  }
  const length = Math.sqrt(x * x + y * y);
  return length === 0 ? { x: dirX, y: dirY } : { x: x / length, y: y / length };
}
