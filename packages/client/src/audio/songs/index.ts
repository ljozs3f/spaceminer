import type { Song } from '../song';
import { NEBULA_RITES } from './nebulaRites';

/**
 * The soundtrack that plays. The previous one, "Starlight Prospector" (./starlightProspector.ts), is kept:
 * to play it again, put STARLIGHT_PROSPECTOR here.
 */
export const SOUNDTRACK: Readonly<Record<'menu' | 'game', Song>> = NEBULA_RITES;
