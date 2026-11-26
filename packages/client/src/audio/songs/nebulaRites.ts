import type { Song, SongSection, SongSound } from '../song';

/**
 * "Nebula Rites", an original composition: E minor, 96 BPM, mysterious rather than bouncy. A choir-like pad,
 * soft glassy arpeggios and a flute-like lead carry a short hook; the Phrygian F major and the harmonic-minor
 * B major give it its mystery. In battle, cinematic drums, a driving bass and chord stabs take over.
 *
 * The menu (the intro, the loading screens and the menu) plays it as a slow ambient, without drums and without
 * the melody: only the choir, the glassy arpeggios and bells, so it never sounds like the driving music of a
 * sector (songs/index.ts).
 */

const ARP = {
  glass: [0, -1, 2, -1, 4, -1, 3, -1, 1, -1, 3, -1, 5, -1, 4, -1],
  shimmer: [0, -1, 2, -1, 3, -1, 5, -1, 4, -1, 2, -1, 3, -1, 1, -1],
  sparse: [0, -1, -1, -1, 2, -1, -1, -1, 4, -1, -1, -1, 3, -1, -1, -1],
} as const;

const SECTIONS = {
  intro: {
    chords: ['Em', 'Em', 'Cmaj7', 'Cmaj7', 'Am', 'Am', 'B', 'B'],
    arp: ARP.sparse,
    drums: false,
    bells: 0.25,
  },
  theme: {
    chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'Am', 'B'],
    lead: [
      'E5/6 F#5/2 G5/4 B5/4',
      'A5/6 G5/2 E5/8',
      'C6/4 B5/4 A5/4 E5/4',
      'F#5/8 D#5/8',
      'E5/6 F#5/2 G5/4 B5/4',
      'C6/6 B5/2 G5/8',
      'A5/4 C6/4 E6/4 D6/2 C6/2',
      'B5/12 -/4',
    ],
    arp: ARP.glass,
    drums: true,
    bells: 0.12,
  },
  rise: {
    chords: ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'],
    lead: [
      'G5/8 E6/8',
      'F#6/6 E6/2 D6/8',
      'E6/8 B5/4 G5/4',
      'B5/12 -/4',
      'G5/4 C6/4 E6/4 G6/4',
      'F#6/8 A6/4 F#6/4',
      'D#6/8 F#6/4 B5/4',
      'B5/16',
    ],
    arp: ARP.shimmer,
    drums: true,
    bells: 0.15,
  },
  mystery: {
    chords: ['Em', 'F', 'Em', 'F', 'C', 'Am', 'B', 'B'],
    lead: [
      'B4/8 E5/8',
      'F5/8 A5/4 C6/4',
      'B5/8 G5/4 E5/4',
      'A5/12 -/4',
      'G5/4 E5/4 C5/4 E5/4',
      'A5/8 C6/8',
      'B5/4 A5/4 F#5/4 D#5/4',
      'F#5/8 -/8',
    ],
    arp: ARP.sparse,
    drums: true,
    bells: 0.3,
  },
  drift: {
    chords: ['Em', 'Cmaj7', 'Am', 'Bsus4', 'Em', 'Cmaj7', 'Am', 'B'],
    arp: ARP.sparse,
    drums: false,
    bells: 0.45,
  },
  // the menu's ambient: the choir, slow shimmering arpeggios opening up, bells
  haze: {
    chords: ['Cmaj7', 'Am', 'Em', 'Em', 'Cmaj7', 'Am', 'Bsus4', 'B'],
    arp: ARP.shimmer,
    drums: false,
    bells: 0.35,
    sweep: [0.6, 1],
  },
} as const satisfies Record<string, SongSection>;

const SOUND: SongSound = {
  output: 0.45,
  lead: { waves: ['sine', 'triangle'], detune: 4, attack: 0.08, cutoff: 2400, vibrato: 20, level: 0.3 },
  arp: {
    wave: 'triangle',
    decay: 1.1,
    filterFrom: 2600,
    filterTo: 1300,
    resonance: 0.7,
    register: 72,
    level: 0.16,
  },
  // the vowel "ah": a soft choir
  pad: { formants: [730, 1090, 2440], cutoff: 1400, attack: 1.2, level: 0.18 },
  bass: 0.025,
  bells: 0.25,
  drums: 'cinematic',
  drumLevel: 1.25,
  groove: {
    steps: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 12],
      [8, 0],
      [10, 0],
      [12, 7],
      [14, 12],
    ],
    cutoff: 800,
    level: 0.55,
  },
  stabs: 0.3,
};

export const NEBULA_RITES = {
  menu: {
    tempo: 76,
    sections: SECTIONS,
    arrangement: ['intro', 'drift', 'haze', 'drift'],
    loopFrom: 1,
    battle: false,
    sound: SOUND,
  },
  game: {
    tempo: 96,
    sections: SECTIONS,
    arrangement: ['intro', 'theme', 'rise', 'theme', 'mystery', 'drift'],
    loopFrom: 1,
    battle: true,
    sound: SOUND,
  },
} as const satisfies Record<string, Song>;
