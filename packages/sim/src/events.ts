import type { BuildingType, EnemyType, EntityId, PlayerId, TurretType } from './types';

/**
 * What happened during a tick, for sound and visual effects (and later for clients of a server). Positions
 * are continuous map coordinates in cells.
 */
export type GameEvent =
  | {
      readonly type: 'shotFired';
      readonly turret: TurretType;
      readonly buildingId: EntityId;
      readonly x: number;
      readonly y: number;
      readonly targetX: number;
      readonly targetY: number;
    }
  | {
      readonly type: 'enemyFired';
      readonly enemy: EnemyType;
      readonly enemyId: EntityId;
      readonly x: number;
      readonly y: number;
      readonly targetX: number;
      readonly targetY: number;
    }
  | { readonly type: 'projectileHit'; readonly turret: TurretType; readonly x: number; readonly y: number }
  | { readonly type: 'enemyDestroyed'; readonly enemy: EnemyType; readonly x: number; readonly y: number }
  | {
      readonly type: 'buildingDestroyed';
      readonly building: BuildingType;
      readonly ownerId: PlayerId;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'asteroidDepleted'; readonly x: number; readonly y: number }
  | { readonly type: 'waveStarted'; readonly index: number };
