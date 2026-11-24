import { describe, expect, it } from 'vitest';
import { LEVELS, type LevelConfig } from '../src/config/levels';
import { TICK_RATE } from '../src/config/simulation';
import { createGame, step } from '../src/simulation';
import type { GameStatus } from '../src/types';
import { chooseCommand } from './autoplayer';

const PLAYER = 'player-1';
/** The simple player acts twice a second, about as often as a person clicks. */
const DECISION_TICKS = TICK_RATE / 2;
const TIME_LIMIT_TICKS = 30 * 60 * TICK_RATE;

interface Outcome {
  readonly status: GameStatus;
  /** Buildings the pirates destroyed (sold ones do not count). */
  readonly destroyed: number;
}

function autoplay(level: LevelConfig, seed: number): Outcome {
  const state = createGame('mining', level, seed, [PLAYER]);
  let destroyed = 0;
  while (state.status === 'running' && state.tick < TIME_LIMIT_TICKS) {
    const command = state.tick % DECISION_TICKS === 0 ? chooseCommand(state, PLAYER) : null;
    const before = new Set(state.buildings.map((building) => building.id));
    const { commandResults } = step(state, command ? [command] : []);
    const sold = new Set(
      commandResults.flatMap((result) =>
        result.ok && result.command.type === 'sellBuilding' ? [result.command.buildingId] : [],
      ),
    );
    const remaining = new Set(state.buildings.map((building) => building.id));
    destroyed += [...before].filter((id) => !remaining.has(id) && !sold.has(id)).length;
  }
  return { status: state.status, destroyed };
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const [QUIET_BELT, SCATTERED_DRIFT, MAELSTROM] = LEVELS;
if (!QUIET_BELT || !SCATTERED_DRIFT || !MAELSTROM) throw new Error('Expected three levels');
const outcomes = new Map<string, Outcome[]>();

/** Every level is played once per seed, on first use. */
function outcomesOf(level: LevelConfig): Outcome[] {
  let levelOutcomes = outcomes.get(level.id);
  if (!levelOutcomes) {
    levelOutcomes = SEEDS.map((seed) => autoplay(level, seed));
    outcomes.set(level.id, levelOutcomes);
  }
  return levelOutcomes;
}

/**
 * Balance checks with a simple scripted player (see autoplayer.ts). It is far from optimal, so a level it
 * wins is not "mission impossible" for a person.
 */
describe('balance', () => {
  it.each([QUIET_BELT, SCATTERED_DRIFT])('a simple player wins $name with every seed', (level) => {
    expect(outcomesOf(level).map((outcome) => outcome.status)).toEqual(SEEDS.map(() => 'won'));
  });

  it('a simple player wins Maelstrom, the hardest level, with most seeds', () => {
    const wins = outcomesOf(MAELSTROM).filter((outcome) => outcome.status === 'won').length;
    expect(wins).toBeGreaterThanOrEqual(6);
  });

  it('the pirates destroy more buildings from level to level', () => {
    const averages = LEVELS.map((level) => {
      const levelOutcomes = outcomesOf(level);
      return levelOutcomes.reduce((sum, outcome) => sum + outcome.destroyed, 0) / levelOutcomes.length;
    });
    for (let i = 1; i < averages.length; i++) {
      expect(averages[i]).toBeGreaterThan(averages[i - 1] ?? Number.POSITIVE_INFINITY);
    }
  });
});
