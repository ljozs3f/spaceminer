import { describe, expect, it } from 'vitest';
import { MINING_MODE_CONFIG } from '../src/config/modes';
import { minedOreFraction } from '../src/queries';
import { step } from '../src/simulation';
import { addEnemy, createTestGame, place, runTicks } from './helpers';

describe('game status (mining mode)', () => {
  it('is won once 90% of the ore has been mined, not before', () => {
    const state = createTestGame({}, [{ x: 10, y: 5, ore: 1000 }]);
    place(state, 'mine', 8, 5);
    const asteroid = state.asteroids[0];
    if (!asteroid) throw new Error('asteroid missing');

    // leave a bit more than 10% on the asteroid: one tick of mining is far less than 0.5 ore
    asteroid.ore = 100.5;
    step(state);
    expect(minedOreFraction(state)).toBeLessThan(MINING_MODE_CONFIG.winMinedOreFraction);
    expect(state.status).toBe('running');

    runTicks(state, 10);
    expect(minedOreFraction(state)).toBeGreaterThanOrEqual(MINING_MODE_CONFIG.winMinedOreFraction);
    expect(state.status).toBe('won');
  });

  it('is lost when all buildings of the player are destroyed', () => {
    const state = createTestGame();
    const [solar] = state.buildings;
    if (!solar) throw new Error('solar panel missing');
    solar.hp = 1;
    addEnemy(state, 1.5, 2.2);

    step(state);

    expect(state.buildings).toHaveLength(0);
    expect(state.status).toBe('lost');
  });

  it('ignores commands and stops advancing once the game is over', () => {
    const state = createTestGame();
    state.status = 'won';
    const tick = state.tick;

    const [result] = step(state, [
      { type: 'placeBuilding', playerId: 'player-1', buildingType: 'mine', x: 5, y: 5 },
    ]).commandResults;

    expect(result).toMatchObject({ ok: false, reason: 'gameOver' });
    expect(state.tick).toBe(tick);
  });
});
