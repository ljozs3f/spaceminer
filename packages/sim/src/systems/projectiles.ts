import { ENEMY_CONFIG } from '../config/enemies';
import type { GameEvent } from '../events';
import { findPlayer } from '../queries';
import type { Enemy, GameState, Projectile } from '../types';
import { distance, perTick } from '../units';

/**
 * Projectiles home in on their target and deal damage on arrival. With a splash radius they damage every
 * pirate near the impact point, otherwise only their target. Destroyed pirates disappear and pay their
 * bounty to the owner of the projectile.
 */
export function updateProjectiles(state: GameState, events: GameEvent[]): void {
  const enemies = new Map(state.enemies.map((enemy) => [enemy.id, enemy]));
  const flying: Projectile[] = [];

  for (const projectile of state.projectiles) {
    const target = enemies.get(projectile.targetId);
    if (target && target.hp > 0) {
      projectile.targetX = target.x;
      projectile.targetY = target.y;
    }
    const step = perTick(projectile.speed);
    const d = distance(projectile.x, projectile.y, projectile.targetX, projectile.targetY);
    if (d > step) {
      projectile.x += ((projectile.targetX - projectile.x) / d) * step;
      projectile.y += ((projectile.targetY - projectile.y) / d) * step;
      flying.push(projectile);
      continue;
    }

    events.push({
      type: 'projectileHit',
      turret: projectile.type,
      x: projectile.targetX,
      y: projectile.targetY,
    });
    if (projectile.splashRadius > 0) {
      for (const enemy of state.enemies) {
        if (distance(enemy.x, enemy.y, projectile.targetX, projectile.targetY) <= projectile.splashRadius) {
          hit(state, projectile, enemy, events);
        }
      }
    } else if (target) {
      hit(state, projectile, target, events);
    }
  }

  state.projectiles = flying;
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
}

function hit(state: GameState, projectile: Projectile, enemy: Enemy, events: GameEvent[]): void {
  if (enemy.hp <= 0) return;
  enemy.hp -= projectile.damage;
  if (enemy.hp > 0) return;
  events.push({ type: 'enemyDestroyed', enemy: enemy.type, x: enemy.x, y: enemy.y });
  const owner = findPlayer(state.players, projectile.ownerId);
  if (owner) owner.ore += ENEMY_CONFIG[enemy.type].bounty;
}
