export const SAVE_SCHEMA_VERSION = 5;

export interface AudioSettings {
  readonly muted: boolean;
  /** 0 to 1. */
  readonly musicVolume: number;
  /** 0 to 1. */
  readonly effectsVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  musicVolume: 0.5,
  effectsVolume: 0.7,
};

export interface SaveData {
  readonly schemaVersion: typeof SAVE_SCHEMA_VERSION;
  /** Generated once per browser with crypto.randomUUID. */
  readonly playerId: string;
  readonly completedLevelIds: readonly string[];
  /**
   * Added in schema version 2. Versions 3 and 4 also stored a soundtrack choice; the soundtrack is fixed
   * since version 5.
   */
  readonly audio: AudioSettings;
}

/**
 * Where the player's progress lives. The only code that knows about the storage behind it: the localStorage
 * implementation can later be replaced by one that talks to an API backed by a database.
 */
export interface SaveRepository {
  /** The saved progress, or a new save (with a new player id) when there is none yet. */
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
}
