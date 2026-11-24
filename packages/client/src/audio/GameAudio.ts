import type { BuildingType, Command, GameEvent } from '@space-miner/sim';
import type { EventBus, GameEvents } from '../events';
import type { GameSession } from '../game/GameSession';
import type { AudioEngine } from './AudioEngine';
import type { SoundEffect } from './effects';

/** How far sounds are panned at the map edges (1 would be fully left or right). */
const PAN_WIDTH = 0.7;
/** Pirates on the map at which the battle music is at full strength. */
const FULL_INTENSITY_ENEMIES = 4;

const PLACE_SOUNDS: Readonly<Record<BuildingType, SoundEffect>> = {
  mine: 'placeMine',
  solar: 'placeSolar',
  laser: 'placeLaser',
  missile: 'placeMissile',
};

function commandSound(command: Command): SoundEffect {
  switch (command.type) {
    case 'placeBuilding':
      return PLACE_SOUNDS[command.buildingType];
    case 'upgradeBuilding':
      return 'upgrade';
    case 'sellBuilding':
      return 'sell';
  }
}

/** Turns what happens in one game into sound effects and music intensity. */
export class GameAudio {
  private readonly unsubscribers: (() => void)[];

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
        this.audio.play('pirateShot', this.pan(event.x));
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
        this.audio.play('waveWarning');
        break;
      case 'asteroidDepleted':
        break;
    }
  }

  private pan(x: number): number {
    return ((x / this.session.state.level.width) * 2 - 1) * PAN_WIDTH;
  }
}
