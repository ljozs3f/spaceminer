import type { Song, SongSection, SongSound } from '../song';

/**
 * "Starlight Prospector", the first soundtrack, kept as an alternative (see songs/index.ts). D minor, 116 BPM:
 * fun and driving (16th-note arpeggios, bouncy bass, a catchy lead), with a mysterious colour from the
 * harmonic minor (the A major chord) and the dorian G major of the bridge.
 */

const ARP = {
  rise: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3],
  bounce: [0, 2, 1, 3, 2, 4, 3, 5, 0, 2, 1, 3, 2, 4, 3, 1],
  pulse: [0, 3, 0, 3, 1, 4, 1, 4, 2, 5, 2, 5, 1, 4, 1, 4],
  sparse: [0, -1, 2, -1, 3, -1, 4, -1, 5, -1, 4, -1, 3, -1, 2, -1],
} as const;

const SECTIONS = {
  intro: {
    chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'Asus4'],
    arp: ARP.sparse,
    drums: false,
    bells: 0.35,
  },
  theme: {
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
    lead: [
      'A4/2 D5/2 F5/2 E5/2 D5/4 A4/4',
      'Bb4/2 D5/2 F5/4 G5/2 F5/2 D5/4',
      'C5/2 F5/2 A5/4 G5/2 F5/2 C5/4',
      'E5/6 D5/2 C5/4 -/4',
      'A4/2 D5/2 F5/2 E5/2 D5/2 F5/2 A5/4',
      'Bb5/4 A5/2 G5/2 F5/4 D5/4',
      'G5/2 F5/2 E5/2 D5/2 Bb4/4 D5/4',
      'C#5/6 E5/2 A5/8',
    ],
    arp: ARP.rise,
    drums: true,
    bells: 0.1,
  },
  lift: {
    chords: ['Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'Gm', 'A'],
    lead: [
      'F5/3 F5/3 G5/2 F5/4 D5/4',
      'E5/3 E5/3 F5/2 G5/8',
      'A5/3 G5/3 E5/2 C5/4 E5/4',
      'D5/12 -/4',
      'F5/3 F5/3 G5/2 A5/4 Bb5/4',
      'C6/4 Bb5/2 A5/2 G5/8',
      'Bb5/3 A5/3 G5/2 D5/4 G5/4',
      'A5/8 C#6/4 E6/4',
    ],
    arp: ARP.bounce,
    drums: true,
    bells: 0.1,
  },
  bridge: {
    chords: ['Dm', 'G', 'Dm', 'G', 'Bb', 'C', 'Dm', 'A'],
    lead: [
      'D5/4 E5/4 F5/4 A5/4',
      'B5/8 A5/4 G5/4',
      'F5/4 E5/4 D5/4 A4/4',
      'B4/8 D5/8',
      'D5/4 F5/4 Bb5/8',
      'A5/4 G5/4 E5/8',
      'F5/4 E5/4 D5/4 C5/4',
      'C#5/8 E5/4 A5/4',
    ],
    arp: ARP.pulse,
    drums: true,
    bells: 0.25,
  },
  drift: {
    chords: ['Dm', 'Bb', 'Gm', 'Asus4', 'Dm', 'Bb', 'G', 'A'],
    arp: ARP.sparse,
    drums: false,
    bells: 0.45,
  },
} as const satisfies Record<string, SongSection>;

const SOUND: SongSound = {
  output: 0.6,
  lead: { waves: ['square', 'sawtooth'], detune: 8, attack: 0.012, cutoff: 3200, vibrato: 14, level: 0.27 },
  arp: {
    wave: 'square',
    decay: 0.2,
    filterFrom: 4000,
    filterTo: 700,
    resonance: 2,
    register: 60,
    level: 0.24,
  },
  pad: { formants: [], cutoff: 1400, attack: 0.4, level: 0.044 },
  bass: 0.03,
  bells: 0.2,
  drums: 'kit',
  drumLevel: 1,
  groove: {
    steps: [
      [0, 0],
      [3, 0],
      [6, 12],
      [8, 0],
      [11, 7],
      [14, 12],
    ],
    cutoff: 1200,
    level: 0.43,
  },
  stabs: 0,
};

export const STARLIGHT_PROSPECTOR = {
  menu: {
    tempo: 116,
    sections: SECTIONS,
    arrangement: ['intro', 'bridge', 'drift'],
    loopFrom: 1,
    battle: false,
    sound: SOUND,
  },
  game: {
    tempo: 116,
    sections: SECTIONS,
    arrangement: ['intro', 'theme', 'lift', 'theme', 'bridge', 'drift'],
    loopFrom: 1,
    battle: true,
    sound: SOUND,
  },
} as const satisfies Record<string, Song>;
