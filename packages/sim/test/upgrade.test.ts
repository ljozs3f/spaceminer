import { describe, expect, it } from 'vitest';
import { getBuildingStats } from '../src/buildings';
import { createGame } from '../src/simulation';
import { addAsteroid, buildingAt, createTestGame, getPlayer, PLAYER, testLevel, upgrade } from './helpers';

describe('upgrading buildings', () => {
  it('upgrades up to level 3, charging each level and adding its hit points', () => {
    const state = createTestGame();
    const solar = buildingAt(state, 1, 1);
    solar.hp -= 10;

    expect(upgrade(state, solar.id).ok).toBe(true);
    expect(solar.level).toBe(2);
    expect(solar.hp).toBe(getBuildingStats('solar', 2).maxHp - 10);

    expect(upgrade(state, solar.id).ok).toBe(true);
    expect(solar.level).toBe(3);
    expect(solar.hp).toBe(getBuildingStats('solar', 3).maxHp - 10);
    expect(getPlayer(state).ore).toBe(
      1000 - getBuildingStats('solar', 2).cost - getBuildingStats('solar', 3).cost,
    );
  });

  it('rejects upgrades beyond level 3', () => {
    const state = createTestGame();
    const solar = buildingAt(state, 1, 1);
    upgrade(state, solar.id);
    upgrade(state, solar.id);
    const ore = getPlayer(state).ore;

    expect(upgrade(state, solar.id)).toMatchObject({ ok: false, reason: 'maxLevel' });
    expect(solar.level).toBe(3);
    expect(getPlayer(state).ore).toBe(ore);
  });

  it('rejects upgrades the player cannot afford', () => {
    const state = createTestGame({ startingOre: 0 });
    expect(upgrade(state, buildingAt(state, 1, 1).id)).toMatchObject({
      ok: false,
      reason: 'insufficientOre',
    });
  });

  it('rejects unknown buildings and buildings of other players', () => {
    const level = testLevel({
      spawns: [[{ type: 'solar', x: 1, y: 1 }], [{ type: 'solar', x: 18, y: 10 }]],
    });
    const state = createGame('mining', level, 1, [PLAYER, 'player-2']);
    addAsteroid(state, { x: 10, y: 5, ore: 100 }); // a level without ore would be won at once
    const foreign = buildingAt(state, 18, 10);

    expect(upgrade(state, 9999)).toMatchObject({ ok: false, reason: 'buildingNotFound' });
    expect(upgrade(state, foreign.id)).toMatchObject({ ok: false, reason: 'notOwner' });
    expect(foreign.level).toBe(1);
  });
});
