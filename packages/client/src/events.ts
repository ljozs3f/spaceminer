import type { BuildingType, Command, CommandResult, EntityId, GameEvent } from '@space-miner/sim';
import type { MapView } from './phaser/CameraController';

/** Everything Vue and Phaser tell each other. Neither changes the game state: they send commands. */
export interface GameEvents {
  /** A building type was picked for placement (build bar, keys 1-4), or placement was cancelled (null). */
  'placement:select': BuildingType | null;
  /** A building was selected on the map, or the selection was cleared (null). */
  'selection:change': EntityId | null;
  /** A player action for the simulation. */
  command: Command;
  /** The simulation applied a command. */
  'command:applied': Command;
  /** The simulation rejected a command. */
  'command:rejected': Extract<CommandResult, { ok: false }>;
  /** What happened in a tick (shots, explosions, waves), for sound and visual effects. */
  'sim:events': readonly GameEvent[];
  /** The simulation advanced to this tick. */
  tick: number;
  'game:over': 'won' | 'lost';
  /** Something the player should notice (see AlertMonitor). */
  alert: Alert;
  /** The part of the map in view changed (zoom or pan). */
  'view:change': MapView;
  /** The zoom buttons. */
  'view:zoom': 'in' | 'out' | 'reset';
  /** What the pointer is over on the map (null: nothing), for its tooltip. */
  'hover:change': MapTarget | null;
}

/** Something on the map: a building, an asteroid or a pirate ship (entity ids are unique across kinds). */
export interface MapTarget {
  readonly kind: 'building' | 'asteroid' | 'enemy';
  readonly id: EntityId;
}

export type AlertKind = 'info' | 'warning' | 'danger' | 'error';

export interface Alert {
  readonly kind: AlertKind;
  readonly text: string;
}

type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  /** Returns the function that removes the listener. */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const listeners = (this.listeners[event] ??= new Set<Listener<Events[K]>>());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const listener of this.listeners[event] ?? []) listener(payload);
  }
}
