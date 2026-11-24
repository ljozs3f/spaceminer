import {
  createGame,
  step,
  TICK_MS,
  type Command,
  type EntityId,
  type GameState,
  type LevelConfig,
  type PlayerId,
  type ReadonlyGameState,
} from '@space-miner/sim';
import type { EventBus, GameEvents } from '../events';

/** Longest frame the loop catches up on: after a pause (hidden tab) the game resumes, it does not fast-forward. */
const MAX_FRAME_MS = 250;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Runs one game on the client. Commands from the bus are queued and applied at the next tick; the simulation
 * advances in fixed ticks (accumulator loop) while the display renders at its own rate.
 */
export class GameSession {
  private readonly game: GameState;
  private readonly queue: Command[] = [];
  private readonly previousPositions = new Map<EntityId, Point>();
  private accumulatorMs = 0;
  private readonly unsubscribe: () => void;

  constructor(
    level: LevelConfig,
    seed: number,
    readonly playerId: PlayerId,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.game = createGame('mining', level, seed, [playerId]);
    this.unsubscribe = bus.on('command', (command) => this.queue.push(command));
  }

  get state(): ReadonlyGameState {
    return this.game;
  }

  /**
   * Runs the ticks that are due after deltaMs of real time. Returns how far the display is between the
   * previous and the current tick (0 to 1), for interpolating moving objects.
   */
  advance(deltaMs: number): number {
    this.accumulatorMs += Math.min(deltaMs, MAX_FRAME_MS);
    let ticks = 0;
    while (this.accumulatorMs >= TICK_MS && this.isRunning()) {
      this.accumulatorMs -= TICK_MS;
      this.tick();
      ticks++;
    }
    if (ticks > 0) {
      this.bus.emit('tick', this.game.tick);
      if (!this.isRunning()) this.bus.emit('game:over', this.game.status === 'won' ? 'won' : 'lost');
    }
    return this.isRunning() ? this.accumulatorMs / TICK_MS : 1;
  }

  /** Where a moving object was at the previous tick. */
  previousPosition(id: EntityId): Point | undefined {
    return this.previousPositions.get(id);
  }

  dispose(): void {
    this.unsubscribe();
  }

  private isRunning(): boolean {
    return this.game.status === 'running';
  }

  private tick(): void {
    this.previousPositions.clear();
    for (const { id, x, y } of [...this.game.enemies, ...this.game.projectiles]) {
      this.previousPositions.set(id, { x, y });
    }
    const { commandResults, events } = step(this.game, this.queue.splice(0));
    for (const result of commandResults) {
      if (result.ok) this.bus.emit('command:applied', result.command);
      else this.bus.emit('command:rejected', result);
    }
    if (events.length > 0) this.bus.emit('sim:events', events);
  }
}
