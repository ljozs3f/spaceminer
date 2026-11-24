import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { LEVELS } from '../src/config/levels';
import { TICK_RATE } from '../src/config/simulation';
import { createGame, step } from '../src/simulation';
import type { GameState } from '../src/types';

const PLAYER = 'player-1';
const [LEVEL] = LEVELS;
if (!LEVEL) throw new Error('No levels configured');

/** Commands per tick: build up a base, upgrade it and keep the pirates busy. */
const SCRIPT = new Map<number, Command[]>([
  [10, [{ type: 'placeBuilding', playerId: PLAYER, buildingType: 'solar', x: 4, y: 14 }]],
  [20, [{ type: 'placeBuilding', playerId: PLAYER, buildingType: 'mine', x: 7, y: 10 }]],
  [
    30,
    [
      { type: 'placeBuilding', playerId: PLAYER, buildingType: 'laser', x: 7, y: 14 },
      { type: 'placeBuilding', playerId: PLAYER, buildingType: 'laser', x: 3, y: 10 },
    ],
  ],
  [400, [{ type: 'upgradeBuilding', playerId: PLAYER, buildingId: 2 }]],
  [900, [{ type: 'placeBuilding', playerId: PLAYER, buildingType: 'missile', x: 5, y: 8 }]],
]);

function play(state: GameState, ticks: number): string[] {
  const rejections: string[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const result of step(state, SCRIPT.get(state.tick) ?? []).commandResults) {
      if (!result.ok) rejections.push(`${String(state.tick)}: ${result.reason}`);
    }
  }
  return rejections;
}

const TICKS = 180 * TICK_RATE;

describe('determinism', () => {
  it('produces the same state from the same seed and commands', () => {
    const a = createGame('mining', LEVEL, 42, [PLAYER]);
    const b = createGame('mining', LEVEL, 42, [PLAYER]);
    play(a, TICKS);
    play(b, TICKS);

    expect(a.wave.index).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('continues identically from a JSON copy of the state', () => {
    const original = createGame('mining', LEVEL, 7, [PLAYER]);
    play(original, TICKS / 2);
    const copy = JSON.parse(JSON.stringify(original)) as GameState;

    play(original, TICKS / 2);
    play(copy, TICKS / 2);

    expect(JSON.stringify(copy)).toBe(JSON.stringify(original));
  });

  it('produces a different map from a different seed', () => {
    const a = createGame('mining', LEVEL, 1, [PLAYER]);
    const b = createGame('mining', LEVEL, 2, [PLAYER]);
    expect(JSON.stringify(a.asteroids)).not.toBe(JSON.stringify(b.asteroids));
  });
});
