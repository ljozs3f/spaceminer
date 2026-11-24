import {
  energyEfficiency,
  findPlayer,
  getWaveComposition,
  TICK_RATE,
  ticksUntilNextWave,
  type GameEvent,
} from '@space-miner/sim';
import type { EventBus, GameEvents } from '../events';
import type { GameSession } from './GameSession';
import { BUILDINGS, ENEMIES, REJECTION_MESSAGES } from './presentation';

/** Seconds before a wave when it is announced. */
const WAVE_NOTICE_SECONDS = 10;
/** A continuing energy shortage is reminded of this often (seconds). */
const ENERGY_REMINDER_SECONDS = 20;
/** "Under attack" is raised again only after this many quiet seconds. */
const ATTACK_QUIET_SECONDS = 15;
/** Destroyed buildings closer together than this are not announced one by one (seconds). */
const DESTROYED_GAP_SECONDS = 2;

/**
 * Watches one game and raises alerts on the bus: low energy, a wave coming, buildings destroyed, the base
 * under attack, and rejected commands. Throttled, so a long fight does not flood the screen.
 */
export class AlertMonitor {
  private readonly unsubscribers: (() => void)[];
  private energyShort = false;
  private lastEnergyAlertTick = Number.NEGATIVE_INFINITY;
  private announcedWave = -1;
  private lastAttackTick = Number.NEGATIVE_INFINITY;
  private lastDestroyedTick = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly session: GameSession,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.unsubscribers = [
      bus.on('tick', () => {
        this.checkEnergy();
        this.checkWave();
      }),
      bus.on('sim:events', (events) => {
        for (const event of events) this.onEvent(event);
      }),
      bus.on('command:rejected', ({ reason }) => {
        bus.emit('alert', { kind: 'error', text: REJECTION_MESSAGES[reason] });
      }),
    ];
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
  }

  private get tick(): number {
    return this.session.state.tick;
  }

  private checkEnergy(): void {
    const player = findPlayer(this.session.state.players, this.session.playerId);
    const efficiency = player ? energyEfficiency(player) : 1;
    if (efficiency >= 1) {
      this.energyShort = false;
      return;
    }
    if (this.energyShort && this.tick - this.lastEnergyAlertTick < ENERGY_REMINDER_SECONDS * TICK_RATE)
      return;
    this.energyShort = true;
    this.lastEnergyAlertTick = this.tick;
    this.bus.emit('alert', {
      kind: 'warning',
      text: `Low energy: ${String(Math.floor(efficiency * 100))}% power. Build solar panels.`,
    });
  }

  private checkWave(): void {
    const { state } = this.session;
    if (this.announcedWave === state.wave.index) return;
    if (ticksUntilNextWave(state) > WAVE_NOTICE_SECONDS * TICK_RATE) return;
    this.announcedWave = state.wave.index;
    const ships = getWaveComposition(state.level.waves, state.wave.index)
      .map((group) => `${String(group.count)} ${ENEMIES[group.type].name}`)
      .join(', ');
    this.bus.emit('alert', {
      kind: 'info',
      text: `Wave ${String(state.wave.index + 1)} in ${String(WAVE_NOTICE_SECONDS)} s: ${ships}`,
    });
  }

  private onEvent(event: GameEvent): void {
    switch (event.type) {
      case 'enemyFired':
        if (this.tick - this.lastAttackTick > ATTACK_QUIET_SECONDS * TICK_RATE) {
          this.bus.emit('alert', { kind: 'warning', text: 'Pirates are attacking your base!' });
        }
        this.lastAttackTick = this.tick;
        break;
      case 'buildingDestroyed':
        if (event.ownerId !== this.session.playerId) break;
        if (this.tick - this.lastDestroyedTick >= DESTROYED_GAP_SECONDS * TICK_RATE) {
          this.bus.emit('alert', { kind: 'danger', text: `${BUILDINGS[event.building].name} destroyed` });
        }
        this.lastDestroyedTick = this.tick;
        break;
      default:
        break;
    }
  }
}
