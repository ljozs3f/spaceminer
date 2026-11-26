import {
  findPlayer,
  isUltraInstinctActive,
  TICK_RATE,
  ticksUntilNextWave,
  type BuildingType,
  type Command,
  type EntityId,
  type GameEvent,
} from '@space-miner/sim';
import type { EventBus, GameEvents } from '../events';
import type { GameSession } from '../game/GameSession';
import type { AudioEngine } from './AudioEngine';
import type { SoundEffect } from './effects';

/** How far sounds are panned at the map edges (1 would be fully left or right). */
const PAN_WIDTH = 0.7;
/** Pirates on the map at which the battle music is at full strength. */
const FULL_INTENSITY_ENEMIES = 4;
/** The last seconds before a wave ping, one ping a second. */
const COUNTDOWN_SECONDS = 3;
/** While the wave alarm sounds the music is pulled down to this level, for this many seconds. */
const ALARM_DUCK = { level: 0.3, seconds: 2.2 } as const;

const PLACE_SOUNDS: Readonly<Record<BuildingType, SoundEffect>> = {
  mine: 'placeMine',
  solar: 'placeSolar',
  laser: 'placeLaser',
  missile: 'placeMissile',
  repair: 'placeRepair',
};

function commandSound(command: Command): SoundEffect {
  switch (command.type) {
    case 'placeBuilding':
      return PLACE_SOUNDS[command.buildingType];
    case 'upgradeBuilding':
      return 'upgrade';
    case 'sellBuilding':
      return 'sell';
    case 'ultraInstinct':
      return 'ultraInstinct';
  }
}

/** Turns what happens in one game into sound effects and music intensity. */
export class GameAudio {
  private readonly unsubscribers: (() => void)[];
  /** What each repair drone was going to in the last tick, to hear it take off. */
  private readonly droneTargets = new Map<EntityId, EntityId | null>();
  private weldTurn = 0;
  /** The countdown second pinged last. */
  private lastCountdown = 0;
  /** Whether Ultra Instinct was on in the last tick, to hear it end. */
  private ultraInstinct = false;

  constructor(
    private readonly audio: AudioEngine,
    private readonly session: GameSession,
    bus: EventBus<GameEvents>,
  ) {
    this.unsubscribers = [
      bus.on('sim:events', (events) => {
        for (const event of events) this.onEvent(event);
      }),
      bus.on('command:applied', (command) => {
        audio.play(commandSound(command));
      }),
      bus.on('command:rejected', () => {
        audio.play('error');
      }),
      bus.on('alert', ({ kind }) => {
        if (kind === 'info') audio.play('notify');
        else if (kind === 'warning') audio.play('warning');
      }),
      bus.on('tick', () => {
        audio.setIntensity(Math.min(1, session.state.enemies.length / FULL_INTENSITY_ENEMIES));
        this.onDrones();
        this.onCountdown();
        this.onUltraInstinct();
      }),
      bus.on('game:over', (status) => {
        audio.setIntensity(0);
        audio.play(status);
      }),
    ];
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.audio.setIntensity(0);
  }

  private onEvent(event: GameEvent): void {
    switch (event.type) {
      case 'shotFired':
        this.audio.play(event.turret === 'laser' ? 'laser' : 'missileLaunch', this.pan(event.x));
        break;
      case 'enemyFired':
        this.audio.play(event.enemy === 'dreadnought' ? 'pirateCannon' : 'pirateShot', this.pan(event.x));
        break;
      case 'projectileHit':
        if (event.turret === 'missile') this.audio.play('missileImpact', this.pan(event.x));
        break;
      case 'enemyDestroyed': {
        const sizes = {
          raider: 'explosionSmall',
          gunship: 'explosionMedium',
          dreadnought: 'explosionLarge',
        } as const;
        this.audio.play(sizes[event.enemy], this.pan(event.x));
        break;
      }
      case 'buildingDestroyed':
        this.audio.play('buildingDestroyed', this.pan(event.x));
        break;
      case 'waveStarted':
        this.audio.play('waveAlarm');
        this.audio.duckMusic(ALARM_DUCK.level, ALARM_DUCK.seconds);
        break;
      case 'asteroidDepleted':
        break;
    }
  }

  /** The aura dies down when Ultra Instinct ends. */
  private onUltraInstinct(): void {
    const { state, playerId } = this.session;
    const player = findPlayer(state.players, playerId);
    const active = player !== undefined && isUltraInstinctActive(state, player);
    if (this.ultraInstinct && !active && state.status === 'running') this.audio.play('ultraInstinctEnd');
    this.ultraInstinct = active;
  }

  /** A ping for each of the last seconds before a wave. */
  private onCountdown(): void {
    const seconds = Math.ceil(ticksUntilNextWave(this.session.state) / TICK_RATE);
    if (seconds !== this.lastCountdown && seconds >= 1 && seconds <= COUNTDOWN_SECONDS) {
      this.audio.play('countdown');
    }
    this.lastCountdown = seconds;
  }

  /** Drones whir when they take off; while any of them repairs, welding crackles (limited per effect). */
  private onDrones(): void {
    const { drones } = this.session.state;
    const repairing = drones.filter((drone) => drone.repairing);
    if (repairing.length > 0) {
      const drone = repairing[this.weldTurn++ % repairing.length];
      if (drone) this.audio.play('repairWeld', this.pan(drone.x));
    }
    for (const drone of drones) {
      const before = this.droneTargets.get(drone.id);
      if (before === null && drone.targetId !== null) this.audio.play('droneLaunch', this.pan(drone.x));
      this.droneTargets.set(drone.id, drone.targetId);
    }
    if (this.droneTargets.size > drones.length) {
      const alive = new Set(drones.map((drone) => drone.id));
      for (const id of this.droneTargets.keys()) if (!alive.has(id)) this.droneTargets.delete(id);
    }
  }

  private pan(x: number): number {
    return ((x / this.session.state.level.width) * 2 - 1) * PAN_WIDTH;
  }
}
