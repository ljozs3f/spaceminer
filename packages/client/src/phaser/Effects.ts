import {
  asteroidCenter,
  findById,
  type EnemyType,
  type GameEvent,
  type PlayerId,
  type ReadonlyGameState,
} from '@space-miner/sim';
import * as Phaser from 'phaser';

/**
 * Visual effects drawn with additive blending: short ones started by game events (explosions, muzzle flashes,
 * pirate fire, build rings) and continuous ones showing which buildings are working (mining beams, solar
 * glow, turrets locked on). Positions are in pixels unless noted.
 */

type Transient =
  | { readonly kind: 'explosion'; readonly x: number; readonly y: number; readonly radius: number }
  | {
      readonly kind: 'flash';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly color: number;
    }
  | {
      readonly kind: 'bolt';
      readonly fromX: number;
      readonly fromY: number;
      readonly toX: number;
      readonly toY: number;
      readonly color: number;
      readonly width: number;
    }
  | {
      readonly kind: 'ring';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly color: number;
    };

interface Timed {
  readonly effect: Transient;
  readonly startMs: number;
  readonly durationMs: number;
}

const EXPLOSION_COLOR = 0xffb347;
const EXPLOSION_CORE = 0xfff2c4;
const MUZZLE_COLORS = { laser: 0x8ff3ff, missile: 0xffb066 } as const;
const PIRATE_FIRE: Readonly<Record<EnemyType, { readonly color: number; readonly width: number }>> = {
  raider: { color: 0xff9a5c, width: 2.5 },
  gunship: { color: 0xff4d5e, width: 3 },
  dreadnought: { color: 0xf060ff, width: 4 },
};
const MINING_COLOR = 0xffa531;
const SOLAR_COLOR = 0xffd84a;
const LOCK_COLORS = { laser: 0x40c4ff, missile: 0xc77dff } as const;

export class Effects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private effects: Timed[] = [];

  constructor(
    scene: Phaser.Scene,
    depth: number,
    private readonly cellSize: number,
  ) {
    this.graphics = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Starts the effects of what happened in a tick. */
  onEvents(events: readonly GameEvent[], now: number): void {
    const cell = this.cellSize;
    for (const event of events) {
      switch (event.type) {
        case 'shotFired': {
          // the flash sits at the barrel's end, towards the target
          const dx = event.targetX - event.x;
          const dy = event.targetY - event.y;
          const length = Math.hypot(dx, dy) || 1;
          const reach = event.turret === 'laser' ? 0.45 : 0.3;
          this.add(now, event.turret === 'laser' ? 90 : 160, {
            kind: 'flash',
            x: (event.x + (dx / length) * reach) * cell,
            y: (event.y + (dy / length) * reach) * cell,
            radius: (event.turret === 'laser' ? 0.18 : 0.3) * cell,
            color: MUZZLE_COLORS[event.turret],
          });
          break;
        }
        case 'enemyFired': {
          const style = PIRATE_FIRE[event.enemy];
          this.add(now, 220, {
            kind: 'bolt',
            fromX: event.x * cell,
            fromY: event.y * cell,
            toX: event.targetX * cell,
            toY: event.targetY * cell,
            ...style,
          });
          break;
        }
        case 'projectileHit':
          if (event.turret === 'missile') {
            this.add(now, 300, {
              kind: 'explosion',
              x: event.x * cell,
              y: event.y * cell,
              radius: 0.5 * cell,
            });
          }
          break;
        case 'enemyDestroyed':
          this.add(now, 450, { kind: 'explosion', x: event.x * cell, y: event.y * cell, radius: 0.7 * cell });
          break;
        case 'buildingDestroyed':
          this.add(now, 700, { kind: 'explosion', x: event.x * cell, y: event.y * cell, radius: 1.3 * cell });
          break;
        case 'asteroidDepleted':
          this.add(now, 500, {
            kind: 'ring',
            x: event.x * cell,
            y: event.y * cell,
            radius: 0.8 * cell,
            color: MINING_COLOR,
          });
          break;
        case 'waveStarted':
          break;
      }
    }
  }

  /** A ring of light where a building was placed or upgraded. */
  addBuildRing(x: number, y: number, color: number, now: number, upgraded: boolean): void {
    this.add(now, upgraded ? 650 : 500, {
      kind: 'ring',
      x,
      y,
      radius: (upgraded ? 1.2 : 0.9) * this.cellSize,
      color,
    });
    this.add(now, 220, { kind: 'flash', x, y, radius: 0.5 * this.cellSize, color: 0xffffff });
  }

  draw(state: ReadonlyGameState, playerId: PlayerId, now: number): void {
    const g = this.graphics;
    g.clear();
    this.drawWorking(state, playerId, now);
    this.effects = this.effects.filter((timed) => now - timed.startMs < timed.durationMs);
    for (const { effect, startMs, durationMs } of this.effects) {
      const progress = (now - startMs) / durationMs;
      switch (effect.kind) {
        case 'explosion': {
          const radius = effect.radius * (0.3 + 0.7 * progress);
          g.fillStyle(EXPLOSION_CORE, 0.8 * (1 - progress) ** 2).fillCircle(effect.x, effect.y, radius * 0.6);
          g.lineStyle(3, EXPLOSION_COLOR, 1 - progress).strokeCircle(effect.x, effect.y, radius);
          break;
        }
        case 'flash':
          g.fillStyle(effect.color, 0.9 * (1 - progress)).fillCircle(
            effect.x,
            effect.y,
            effect.radius * (1 + progress),
          );
          break;
        case 'bolt': {
          // a streak flying from the ship to the building, a small flash where it lands
          const head = Math.min(1, progress * 1.6);
          const tail = Math.max(0, head - 0.5);
          const at = (t: number): [number, number] => [
            effect.fromX + (effect.toX - effect.fromX) * t,
            effect.fromY + (effect.toY - effect.fromY) * t,
          ];
          if (head < 1) {
            g.lineStyle(effect.width, effect.color, 0.95).lineBetween(...at(tail), ...at(head));
          } else {
            g.fillStyle(effect.color, 0.8 * (1 - progress)).fillCircle(
              effect.toX,
              effect.toY,
              effect.width * 2.5,
            );
          }
          break;
        }
        case 'ring':
          g.lineStyle(3 * (1 - progress) + 1, effect.color, 1 - progress).strokeCircle(
            effect.x,
            effect.y,
            effect.radius * (0.4 + 0.6 * progress),
          );
          break;
      }
    }
  }

  private add(now: number, durationMs: number, effect: Transient): void {
    this.effects.push({ effect, startMs: now, durationMs });
  }

  /** Mines pull a stream of ore from their asteroid, solar panels glow, turrets locked on a target shine. */
  private drawWorking(state: ReadonlyGameState, playerId: PlayerId, now: number): void {
    const g = this.graphics;
    const cell = this.cellSize;
    for (const building of state.buildings) {
      if (building.ownerId !== playerId) continue;
      const x = (building.x + 0.5) * cell;
      const y = (building.y + 0.5) * cell;
      const wobble = Math.sin(now / 260 + building.id);
      switch (building.type) {
        case 'mine': {
          const asteroid =
            building.targetId === null ? undefined : findById(state.asteroids, building.targetId);
          if (!asteroid) break;
          const center = asteroidCenter(asteroid);
          const ax = center.x * cell;
          const ay = center.y * cell;
          g.lineStyle(3, MINING_COLOR, 0.18 + 0.08 * wobble).lineBetween(ax, ay, x, y);
          g.lineStyle(1, 0xffe3b0, 0.35).lineBetween(ax, ay, x, y);
          // ore particles flowing to the mine
          for (let i = 0; i < 3; i++) {
            const t = (now / 700 + i / 3 + building.id * 0.37) % 1;
            g.fillStyle(MINING_COLOR, 0.9 * Math.sin(t * Math.PI)).fillCircle(
              ax + (x - ax) * t,
              ay + (y - ay) * t,
              1.8,
            );
          }
          // sparks where the drill bites
          g.fillStyle(0xffd27a, 0.5 + 0.4 * wobble).fillCircle(
            ax + Math.cos(now / 90 + building.id) * 3,
            ay + Math.sin(now / 110 + building.id) * 3,
            2,
          );
          break;
        }
        case 'solar':
          g.fillStyle(SOLAR_COLOR, 0.13 + 0.07 * wobble).fillCircle(x, y, cell * (0.38 + 0.04 * wobble));
          break;
        case 'laser':
        case 'missile':
          if (building.targetId === null) break;
          g.lineStyle(1.5, LOCK_COLORS[building.type], 0.35 + 0.25 * wobble).strokeCircle(x, y, cell * 0.48);
          break;
      }
    }
  }
}
