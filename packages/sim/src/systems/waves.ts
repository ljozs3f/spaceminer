import { ENEMY_CONFIG } from '../config/enemies';
import type { WaveConfig } from '../config/levels';
import type { GameEvent } from '../events';
import { nextRandom, randomInt } from '../rng';
import { MAP_EDGES, type EnemyType, type GameState } from '../types';
import { secondsToTicks } from '../units';

export interface WaveGroup {
  readonly type: EnemyType;
  readonly count: number;
  readonly maxHp: number;
}

/** The enemies of wave `index` (0-based). Pure, so the client can show what the next wave brings. */
export function getWaveComposition(waves: WaveConfig, index: number): WaveGroup[] {
  const wave = Math.min(index, waves.lastScalingWave);
  const hpFactor = waves.hpMultiplier * (1 + wave * waves.hpGrowthPerWave);
  return waves.groups
    .filter((group) => wave >= group.fromWave)
    .map((group) => ({
      type: group.type,
      count: Math.floor(group.count + (wave - group.fromWave) * group.extraPerWave),
      maxHp: ENEMY_CONFIG[group.type].maxHp * hpFactor,
    }))
    .filter((group) => group.count > 0);
}

/** Spawns the next wave at random points of the map edges when its time has come. */
export function updateWaves(state: GameState, events: GameEvent[]): void {
  if (state.tick < state.wave.nextWaveTick) return;
  events.push({ type: 'waveStarted', index: state.wave.index });
  for (const { type, count, maxHp } of getWaveComposition(state.level.waves, state.wave.index)) {
    for (let i = 0; i < count; i++) {
      const { x, y } = randomEdgePoint(state);
      state.enemies.push({ id: state.nextEntityId++, type, x, y, hp: maxHp, maxHp, cooldown: 0 });
    }
  }
  state.wave.index += 1;
  state.wave.nextWaveTick += secondsToTicks(state.level.waves.intervalSeconds);
}

/** A random point on one of the edges the level's pirates come from (all four when it names none). */
function randomEdgePoint(state: GameState): { x: number; y: number } {
  const { width, height } = state.level;
  const edges = state.level.waves.spawnEdges ?? MAP_EDGES;
  const edge = edges[randomInt(state, 0, edges.length - 1)] ?? 'top';
  const along = nextRandom(state);
  switch (edge) {
    case 'top':
      return { x: along * width, y: 0 };
    case 'right':
      return { x: width, y: along * height };
    case 'bottom':
      return { x: along * width, y: height };
    case 'left':
      return { x: 0, y: along * height };
  }
}
