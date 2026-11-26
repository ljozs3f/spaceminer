import type { Song } from '../song';
import { NEBULA_RITES } from './nebulaRites';
import { SENTINEL_EXPANSE } from './sentinelExpanse';

/**
 * The built-in soundtrack: it plays where a music file (src/assets/music) is missing. menu: the intro, the
 * loading screens and the menu; game: in a sector. Two different songs, so the menu never sounds like the
 * game: "Nebula Rites" as a slow ambient without drums or melody in the menu, the driving "Sentinel Expanse"
 * with its horns and film drums in game.
 */
export const BUILT_IN_SOUNDTRACK: Readonly<Record<'menu' | 'game', Song>> = {
  menu: NEBULA_RITES.menu,
  game: SENTINEL_EXPANSE.game,
};

/** The titles of the built-in songs, for the credits. */
export const BUILT_IN_TITLES: Readonly<Record<'menu' | 'game', string>> = {
  menu: 'Nebula Rites',
  game: 'Sentinel Expanse',
};
