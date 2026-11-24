import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { validateCommand } from '../src/commands';
import { createTestGame, getPlayer, place, PLAYER } from './helpers';

describe('placing buildings', () => {
  it('places a building on a free cell, owned by the player, and charges its cost', () => {
    const state = createTestGame();
    const result = place(state, 'laser', 5, 5);

    expect(result.ok).toBe(true);
    expect(state.buildings).toContainEqual(
      expect.objectContaining({ type: 'laser', ownerId: PLAYER, level: 1, x: 5, y: 5 }),
    );
    expect(getPlayer(state).ore).toBe(1000 - getBuildingStats('laser', 1).cost);
  });

  it.each([
    [-1, 0],
    [0, -1],
    [20, 0],
    [0, 12],
    [1.5, 2],
  ])('rejects the cell %d, %d as out of bounds', (x, y) => {
    expect(place(createTestGame(), 'mine', x, y)).toMatchObject({ ok: false, reason: 'outOfBounds' });
  });

  it('rejects a cell that already has a building', () => {
    expect(place(createTestGame(), 'mine', 1, 1)).toMatchObject({ ok: false, reason: 'cellOccupied' });
  });

  it('rejects a cell with an asteroid', () => {
    expect(place(createTestGame(), 'mine', 10, 5)).toMatchObject({ ok: false, reason: 'cellHasAsteroid' });
  });

  it('rejects a building the player cannot afford and keeps the ore', () => {
    const cost = getBuildingStats('missile', 1).cost;
    const state = createTestGame({ startingOre: cost - 1 });

    expect(place(state, 'missile', 5, 5)).toMatchObject({ ok: false, reason: 'insufficientOre' });
    expect(getPlayer(state).ore).toBe(cost - 1);
    expect(state.buildings).toHaveLength(1);
  });

  it('rejects commands of unknown players and after the game has ended', () => {
    const state = createTestGame();
    const command = {
      type: 'placeBuilding',
      playerId: 'stranger',
      buildingType: 'mine',
      x: 5,
      y: 5,
    } as const;
    expect(validateCommand(state, command)).toBe('unknownPlayer');

    state.status = 'lost';
    expect(validateCommand(state, { ...command, playerId: PLAYER })).toBe('gameOver');
  });
});
