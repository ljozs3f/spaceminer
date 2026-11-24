import { describe, expect, it } from 'vitest';
import { getBuildingStats, getSellValue } from '../src/buildings';
import { BUILDING_SALE } from '../src/config/buildings';
import { createGame } from '../src/simulation';
import {
  addAsteroid,
  buildingAt,
  createTestGame,
  getPlayer,
  place,
  PLAYER,
  sell,
  testLevel,
  upgrade,
} from './helpers';

describe('selling buildings', () => {
  it('pays back part of everything spent on the building and frees its cell', () => {
    const state = createTestGame();
    place(state, 'laser', 5, 5);
    const laser = buildingAt(state, 5, 5);
    upgrade(state, laser.id);
    const ore = getPlayer(state).ore;

    expect(sell(state, laser.id).ok).toBe(true);

    const invested = getBuildingStats('laser', 1).cost + getBuildingStats('laser', 2).cost;
    expect(getPlayer(state).ore).toBe(ore + Math.floor(invested * BUILDING_SALE.refundFraction));
    expect(state.buildings.some((building) => building.id === laser.id)).toBe(false);
    expect(place(state, 'mine', 5, 5).ok).toBe(true);
  });

  it('pays back less for a damaged building', () => {
    const full = { type: 'missile', level: 1, hp: getBuildingStats('missile', 1).maxHp } as const;
    const half = { ...full, hp: full.hp / 2 };
    expect(getSellValue(half)).toBe(Math.floor(getSellValue(full) / 2));
  });

  it('rejects selling the last building, which would lose the game', () => {
    const state = createTestGame();
    expect(sell(state, buildingAt(state, 1, 1).id)).toMatchObject({ ok: false, reason: 'lastBuilding' });
    expect(state.buildings).toHaveLength(1);
  });

  it('rejects unknown buildings and buildings of other players', () => {
    const level = testLevel({
      spawns: [
        [
          { type: 'solar', x: 1, y: 1 },
          { type: 'mine', x: 2, y: 1 },
        ],
        [{ type: 'solar', x: 18, y: 10 }],
      ],
    });
    const state = createGame('mining', level, 1, [PLAYER, 'player-2']);
    addAsteroid(state, { x: 10, y: 5, ore: 100 }); // a level without ore would be won at once

    expect(sell(state, 9999)).toMatchObject({ ok: false, reason: 'buildingNotFound' });
    expect(sell(state, buildingAt(state, 18, 10).id)).toMatchObject({ ok: false, reason: 'notOwner' });
  });
});
