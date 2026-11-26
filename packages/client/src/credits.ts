import { hasMusicFile, type Track } from './audio/MusicPlayer';
import { BUILT_IN_TITLES } from './audio/songs';
import { BURNOUT_TRACK, ULTRA_INSTINCT_TRACK } from './audio/YouTubeMusic';

/** What the credits page shows (CreditsScreen.vue). */

export interface CreditLink {
  readonly label: string;
  readonly url: string;
}

export interface Credit {
  /** What it is in the game, e.g. "In game". */
  readonly role: string;
  readonly title: string;
  /** Who made it, one line each. */
  readonly by: readonly string[];
  readonly license?: string;
  readonly links?: readonly CreditLink[];
}

export interface CreditSection {
  readonly heading: string;
  readonly credits: readonly Credit[];
  readonly note?: string;
}

/**
 * The music files in src/assets/music: their credits, by file name. When a file is replaced, its credit
 * here (and in the README there) is replaced with it.
 */
const MUSIC_FILES: Readonly<Record<Track, Omit<Credit, 'role'>>> = {
  loading: {
    title: 'Space',
    by: ['Sub_Clair'],
    license: 'Pixabay Content License',
    links: [{ label: 'Pixabay', url: 'https://pixabay.com/music/ambient-space-627616/' }],
  },
  game: {
    title: 'Sci-Fi Action',
    by: ['leberch'],
    license: 'Pixabay Content License',
    links: [{ label: 'Pixabay', url: 'https://pixabay.com/music/main-title-sci-fi-action-248039/' }],
  },
};

const ROLES: Readonly<Record<Track, string>> = {
  loading: 'Intro, loading screens and menu',
  game: 'In game',
};

function soundtrack(track: Track): Credit {
  if (hasMusicFile(track)) return { role: ROLES[track], ...MUSIC_FILES[track] };
  return {
    role: ROLES[track],
    title: BUILT_IN_TITLES[track === 'loading' ? 'menu' : 'game'],
    by: ['Original composition, written for Space Miner and synthesized in the browser'],
  };
}

export const CREDITS: readonly CreditSection[] = [
  {
    heading: 'Ultra Instinct',
    credits: [
      {
        role: 'Music while Ultra Instinct is on',
        title: ULTRA_INSTINCT_TRACK.title,
        by: [
          `Instrumental cover by ${ULTRA_INSTINCT_TRACK.coverBy}`,
          `Original theme by ${ULTRA_INSTINCT_TRACK.original} (Dragon Ball Super)`,
        ],
        links: [
          { label: 'YouTube', url: ULTRA_INSTINCT_TRACK.url },
          { label: ULTRA_INSTINCT_TRACK.coverBy, url: ULTRA_INSTINCT_TRACK.coverByUrl },
        ],
      },
      {
        role: 'Music in the burnout after it',
        title: BURNOUT_TRACK.title,
        by: [
          `Rock cover by ${BURNOUT_TRACK.coverBy}`,
          `Original theme by ${BURNOUT_TRACK.original} (Dragon Ball Super)`,
        ],
        links: [
          { label: 'YouTube', url: BURNOUT_TRACK.url },
          { label: BURNOUT_TRACK.coverBy, url: BURNOUT_TRACK.coverByUrl },
        ],
      },
    ],
    note:
      'Played from YouTube with its embedded player, credited to their authors (as the Ultra Instinct ' +
      'cover’s author asks). Space Miner is a free, non-commercial project and earns nothing from them.',
  },
  {
    heading: 'Soundtrack',
    credits: [soundtrack('loading'), soundtrack('game')],
  },
  {
    heading: 'Art and sound',
    credits: [
      {
        role: 'Sprites',
        title: 'Buildings, ships, asteroids, the map background',
        by: ['Generated with ChatGPT, cut into sprites by the game’s own script'],
      },
      {
        role: 'Sound effects',
        title: 'Weapons, explosions, alarms, the warp jumps, the interface',
        by: ['Rendered and synthesized in code for Space Miner'],
      },
    ],
  },
  {
    heading: 'Built with',
    credits: [
      {
        role: 'Engine and interface',
        title: 'Phaser · Vue · Vite · TypeScript',
        by: ['Open source: MIT License (TypeScript: Apache License 2.0)'],
        links: [
          { label: 'Phaser', url: 'https://phaser.io' },
          { label: 'Vue', url: 'https://vuejs.org' },
          { label: 'Vite', url: 'https://vite.dev' },
          { label: 'TypeScript', url: 'https://www.typescriptlang.org' },
        ],
      },
    ],
  },
];
