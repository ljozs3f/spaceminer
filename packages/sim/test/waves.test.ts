import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIG } from '../src/config/enemies';
import { LEVELS, type WaveConfig } from '../src/config/levels';
import { TICK_RATE } from '../src/config/simulation';
import { getWaveComposition } from '../src/systems/waves';
import { perTick } from '../src/units';
import { createTestGame, runTicks } from './helpers';

const WAVES: WaveConfig = {
  firstWaveSeconds: 2,
  intervalSeconds: 5,
  lastScalingWave: 4,
  hpMultiplier: 1.5,
  hpGrowthPerWave: 0.5,
  groups: [
    { type: 'raider', fromWave: 0, count: 2, extraPerWave: 0.5 },
    { type: 'dreadnought', fromWave: 2, count: 1, extraPerWave: 1 },
  ],
};

/** Total enemy hit points of a wave: a simple measure of its strength. */
function strength(waves: WaveConfig, index: number): number {
  return getWaveComposition(waves, index).reduce((sum, group) => sum + group.count * group.maxHp, 0);
}

describe('waves', () => {
  it('bring in enemy types at their first wave and grow in number and hit points', () => {
    expect(getWaveComposition(WAVES, 0)).toEqual([
      { type: 'raider', count: 2, maxHp: ENEMY_CONFIG.raider.maxHp * 1.5 },
    ]);
    expect(getWaveComposition(WAVES, 2)).toEqual([
      { type: 'raider', count: 3, maxHp: ENEMY_CONFIG.raider.maxHp * 1.5 * 2 },
      { type: 'dreadnought', count: 1, maxHp: ENEMY_CONFIG.dreadnought.maxHp * 1.5 * 2 },
    ]);
  });

  it('stop getting stronger after the last scaling wave', () => {
    expect(getWaveComposition(WAVES, 9)).toEqual(getWaveComposition(WAVES, WAVES.lastScalingWave));
  });

  it('spawn on the map edges at the configured times', () => {
    const state = createTestGame({ waves: WAVES });
    const [base] = state.buildings;
    if (!base) throw new Error('base missing');
    base.hp = Number.MAX_SAFE_INTEGER; // the game must not end while the waves arrive
    runTicks(state, WAVES.firstWaveSeconds * TICK_RATE);
    expect(state.enemies).toHaveLength(0);

    // the wave spawns in the tick that starts at firstWaveSeconds, and the ships take their first step in it
    runTicks(state, 1);
    expect(state.enemies.map((enemy) => enemy.type)).toEqual(['raider', 'raider']);
    const { width, height } = state.level;
    for (const enemy of state.enemies) {
      const toEdge = Math.min(enemy.x, enemy.y, width - enemy.x, height - enemy.y);
      expect(toEdge).toBeLessThanOrEqual(perTick(ENEMY_CONFIG.raider.speed) + 1e-9);
    }

    runTicks(state, 2 * WAVES.intervalSeconds * TICK_RATE);
    expect(state.enemies.filter((enemy) => enemy.type === 'dreadnought')).toHaveLength(1);
  });

  it('spawn only on the edges the level names', () => {
    const state = createTestGame({ waves: { ...WAVES, spawnEdges: ['right'] } });
    const [base] = state.buildings;
    if (!base) throw new Error('base missing');
    base.hp = Number.MAX_SAFE_INTEGER;
    runTicks(state, WAVES.firstWaveSeconds * TICK_RATE + 1);
    expect(state.enemies.length).toBeGreaterThan(0);
    for (const enemy of state.enemies) {
      expect(state.level.width - enemy.x).toBeLessThanOrEqual(perTick(ENEMY_CONFIG.raider.speed) + 1e-9);
    }
  });

  describe.each(LEVELS)('level $name', (level) => {
    it('gets stronger with every wave up to the last scaling wave', () => {
      for (let wave = 1; wave <= level.waves.lastScalingWave; wave++) {
        expect(strength(level.waves, wave)).toBeGreaterThan(strength(level.waves, wave - 1));
      }
    });

    it('brings in every enemy type before the waves stop scaling', () => {
      for (const group of level.waves.groups) {
        expect(group.fromWave).toBeLessThanOrEqual(level.waves.lastScalingWave);
      }
    });
  });

  it('get harder from level to level', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [previous, current] = [LEVELS[i - 1], LEVELS[i]];
      if (!previous || !current) throw new Error('level missing');
      for (let wave = 0; wave <= 20; wave++) {
        expect(strength(current.waves, wave)).toBeGreaterThanOrEqual(strength(previous.waves, wave));
      }
    }
  });
});
