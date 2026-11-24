import {
  DEFAULT_AUDIO_SETTINGS,
  SAVE_SCHEMA_VERSION,
  type AudioSettings,
  type SaveData,
  type SaveRepository,
} from './SaveRepository';

const STORAGE_KEY = 'space-miner:save';

export class LocalStorageSaveRepository implements SaveRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  load(): Promise<SaveData> {
    const saved = parseSave(this.storage.getItem(STORAGE_KEY));
    if (saved) return Promise.resolve(saved);

    const created: SaveData = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      playerId: crypto.randomUUID(),
      completedLevelIds: [],
      audio: DEFAULT_AUDIO_SETTINGS,
    };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(created));
    return Promise.resolve(created);
  }

  save(data: SaveData): Promise<void> {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return Promise.resolve();
  }
}

/** Reads every schema version and migrates it to the current one. null for a missing or unreadable save. */
function parseSave(raw: string | null): SaveData | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const playerId = data['playerId'];
  const completedLevelIds = data['completedLevelIds'];
  if (typeof playerId !== 'string' || !isStringArray(completedLevelIds)) return null;

  switch (data['schemaVersion']) {
    case 1: // version 1 had no audio settings
      return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        playerId,
        completedLevelIds,
        audio: DEFAULT_AUDIO_SETTINGS,
      };
    case 2:
      return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        playerId,
        completedLevelIds,
        audio: parseAudioSettings(data['audio']) ?? DEFAULT_AUDIO_SETTINGS,
      };
    default:
      return null;
  }
}

function parseAudioSettings(value: unknown): AudioSettings | null {
  if (!isRecord(value)) return null;
  const { muted, musicVolume, effectsVolume } = value;
  if (typeof muted !== 'boolean' || !isVolume(musicVolume) || !isVolume(effectsVolume)) return null;
  return { muted, musicVolume, effectsVolume };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isVolume(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}
