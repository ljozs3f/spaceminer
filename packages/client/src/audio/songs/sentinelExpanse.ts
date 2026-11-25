import type { Song, SongSection, SongSound } from '../song';

/**
 * "Sentinel Expanse", an original composition: D minor, 100 BPM, epic space music in the style of the
 * 2000s space games, halfway between an orchestra and a synthesizer. A choir pad and a low, driving string
 * ostinato carry it; a horn section (detuned saws doubled an octave below, the filter opening like brass)
 * plays a heroic theme with the dotted rhythm of film scores. The harmonic-minor A major gives the themes
 * their tension, the Phrygian E flat and the C minor of "depths" the darkness. In battle, film drums with
 * toms, a driving low bass and brass stabs come in.
 */

/** Indices into the chord's notes over two octaves (0: root, 2: fifth, 3: the octave); -1 rests. */
const STRINGS = {
  // root, root, fifth, root, octave...: the 16th-note drive of a film-score string section
  ostinato: [0, 0, 2, 0, 3, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 2],
  eighths: [0, -1, 0, -1, 2, -1, 0, -1, 3, -1, 0, -1, 2, -1, 0, -1],
  pulse: [0, -1, -1, 0, -1, -1, 2, -1, 0, -1, -1, 0, -1, -1, 3, -1],
  sparse: [0, -1, -1, -1, 2, -1, -1, -1, 3, -1, -1, -1, 2, -1, -1, -1],
} as const;

const SECTIONS = {
  intro: {
    chords: ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'],
    arp: STRINGS.eighths,
    drums: false,
    bells: 0.15,
    sweep: [0.4, 1],
  },
  theme: {
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'A'],
    lead: [
      'D5/6 A4/2 D5/4 F5/4',
      'F5/8 E5/4 D5/4',
      'C5/6 F5/2 A5/8',
      'G5/12 -/4',
      'D5/6 A4/2 D5/4 F5/4',
      'Bb5/8 A5/4 F5/4',
      'G5/6 A5/2 Bb5/4 C6/4',
      'A5/12 -/4',
    ],
    arp: STRINGS.ostinato,
    drums: true,
    bells: 0.05,
  },
  ascent: {
    chords: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'],
    lead: [
      'D6/8 F6/8',
      'E6/6 D6/2 C6/8',
      'D6/12 A5/4',
      'F6/4 E6/4 D6/4 A5/4',
      'D6/6 F6/2 G6/8',
      'G6/6 F6/2 E6/8',
      'E6/8 C#6/8',
      'A5/12 -/4',
    ],
    arp: STRINGS.ostinato,
    drums: true,
    bells: 0.05,
    sweep: [0.8, 1.2],
  },
  depths: {
    chords: ['Dm', 'Eb', 'Dm', 'Eb', 'Cm', 'Bb', 'A', 'A'],
    lead: [
      'A4/8 D5/8',
      'G5/8 Eb5/8',
      'F5/8 D5/4 A4/4',
      'Bb4/8 G4/8',
      'C5/6 Eb5/2 G5/8',
      'F5/8 D5/8',
      'E5/6 C#5/2 A4/8',
      'A4/12 -/4',
    ],
    arp: STRINGS.pulse,
    drums: true,
    bells: 0.2,
  },
  drift: {
    chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'Asus4'],
    arp: STRINGS.sparse,
    drums: false,
    bells: 0.3,
    sweep: [1, 0.5],
  },
} as const satisfies Record<string, SongSection>;

const SOUND: SongSound = {
  output: 0.52,
  // a horn section: two detuned saws, doubled an octave below, opening up like brass
  lead: {
    waves: ['sawtooth', 'sawtooth'],
    detune: 10,
    attack: 0.07,
    cutoff: 1700,
    vibrato: 7,
    level: 0.2,
    glide: 0.05,
    octaves: [0, -12],
    bloom: 0.18,
  },
  // low strings: short, bowed saw notes, not plucks
  arp: {
    wave: 'sawtooth',
    decay: 0.16,
    filterFrom: 2600,
    filterTo: 1500,
    resonance: 0.6,
    register: 48,
    level: 0.13,
    detune: 14,
  },
  // the vowel "ah": a choir
  pad: { formants: [730, 1090, 2440], cutoff: 1400, attack: 1, level: 0.17 },
  bass: 0.03,
  riser: 0.03,
  bells: 0.18,
  drums: 'cinematic',
  drumLevel: 1.2,
  groove: {
    steps: [
      [0, 0],
      [2, 0],
      [4, 0],
      [6, 0],
      [8, 0],
      [10, 0],
      [12, 0],
      [14, 0],
    ],
    cutoff: 650,
    level: 0.42,
  },
  stabs: 0.2,
};

export const SENTINEL_EXPANSE = {
  menu: {
    tempo: 100,
    sections: SECTIONS,
    arrangement: ['intro', 'depths', 'drift'],
    loopFrom: 1,
    battle: false,
    sound: SOUND,
  },
  game: {
    tempo: 100,
    sections: SECTIONS,
    arrangement: ['intro', 'theme', 'ascent', 'theme', 'depths', 'drift'],
    loopFrom: 1,
    battle: true,
    sound: SOUND,
  },
} as const satisfies Record<string, Song>;
