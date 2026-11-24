import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import type { GameEvent } from '../src/events';
import { step } from '../src/simulation';
import type { GameState } from '../src/types';
import { addEnemy, createTestGame, place } from './helpers';

function collectEvents(state: GameState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...step(state).events);
  return events;
}

describe('events', () => {
  it('report shots, hits and destroyed ships', () => {
    const state = createTestGame();
    place(state, 'missile', 5, 5);
    const ship = addEnemy(state, 5.5, 9, getBuildingStats('missile', 1).damage, 'raider');
    ship.cooldown = Number.MAX_SAFE_INTEGER;

    const types = collectEvents(state, 40).map((event) => event.type);

    expect(types).toContain('shotFired');
    expect(types).toContain('projectileHit');
    expect(types).toContain('enemyDestroyed');
    expect(types.indexOf('shotFired')).toBeLessThan(types.indexOf('enemyDestroyed'));
  });

  it('report where turrets aim and where pirates fire', () => {
    const state = createTestGame();
    place(state, 'laser', 5, 5);
    const laser = state.buildings.find((building) => building.type === 'laser');
    if (!laser) throw new Error('laser missing');
    laser.hp = 1_000_000;
    const ship = addEnemy(state, 5.5, 6.5, 1_000_000, 'raider');

    const events = collectEvents(state, 2);

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'shotFired', buildingId: laser.id, targetX: ship.x, targetY: ship.y }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'enemyFired',
        enemy: 'raider',
        enemyId: ship.id,
        targetX: 5.5,
        targetY: 5.5,
      }),
    );
  });

  it('report destroyed buildings with their position', () => {
    const state = createTestGame();
    place(state, 'laser', 15, 10);
    const laser = state.buildings.find((building) => building.type === 'laser');
    if (!laser) throw new Error('laser missing');
    laser.hp = 1;
    addEnemy(state, 15.5, 11.3, 1_000_000, 'gunship');

    expect(collectEvents(state, 2)).toContainEqual({
      type: 'buildingDestroyed',
      building: 'laser',
      ownerId: 'player-1',
      x: 15.5,
      y: 10.5,
    });
  });

  it('report depleted asteroids and starting waves', () => {
    const state = createTestGame(
      {
        waves: {
          firstWaveSeconds: 1,
          intervalSeconds: 60,
          lastScalingWave: 0,
          hpMultiplier: 1,
          hpGrowthPerWave: 0,
          groups: [{ type: 'raider', fromWave: 0, count: 1, extraPerWave: 0 }],
        },
      },
      // a crumb that one tick of mining empties, and a far asteroid so the game goes on
      [
        { x: 10, y: 5, ore: 0.01 },
        { x: 18, y: 10, ore: 1000 },
      ],
    );

    const events = [
      ...step(state, [{ type: 'placeBuilding', playerId: 'player-1', buildingType: 'mine', x: 8, y: 5 }])
        .events,
      ...collectEvents(state, 30),
    ];

    expect(events).toContainEqual({ type: 'asteroidDepleted', x: 10.5, y: 5.5 });
    expect(events).toContainEqual({ type: 'waveStarted', index: 0 });
  });
});
