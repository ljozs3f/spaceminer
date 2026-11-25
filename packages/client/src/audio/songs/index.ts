import type { Song } from '../song';
import { SENTINEL_EXPANSE } from './sentinelExpanse';

/**
 * The built-in soundtrack: it plays where a music file (src/assets/music) is missing. menu: the intro, the
 * loading screens and the menu; game: in a sector.
 */
export const BUILT_IN_SOUNDTRACK: Readonly<Record<'menu' | 'game', Song>> = SENTINEL_EXPANSE;
