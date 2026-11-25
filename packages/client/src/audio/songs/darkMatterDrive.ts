import type { Song, SongSection, SongSound } from '../song';

/**
 * "Dark Matter Drive", an original composition: F# minor, 122 BPM, darksynth. Driving rather than sad: an
 * octave-bouncing bassline, a four-on-the-floor kick, saw arpeggios bouncing left and right and a wide pad
 * that pumps on the beat keep it moving even when no battle is on. The mystery comes from the Phrygian G
 * major and E minor, the bright Dorian B major and the harmonic-minor C# major. The lead sings a roomy hook
 * with long notes that glide into each other; filter sweeps open the intro and the climb and close the
 * breakdown. In battle a hard kit, a galloping bass and chord stabs come in.
 */

const ARP = {
  run: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2],
  eighths: [0, -1, 2, -1, 3, -1, 4, -1, 5, -1, 4, -1, 3, -1, 2, -1],
  sparse: [0, -1, -1, 2, -1, -1, 4, -1, -1, 3, -1, -1, 5, -1, 4, -1],
} as const;

const SECTIONS = {
  intro: {
    chords: ['F#m', 'F#m', 'D', 'E', 'F#m', 'F#m', 'G', 'C#'],
    arp: ARP.eighths,
    drums: false,
    bells: 0.2,
    sweep: [0.25, 1],
  },
  hook: {
    chords: ['F#m', 'D', 'A', 'E', 'F#m', 'D', 'B', 'C#'],
    lead: [
      'C#6/6 B5/2 A5/4 -/4',
      'A5/6 F#5/2 -/8',
      'E5/4 A5/4 C#6/4 E6/4',
      'G#5/8 B5/4 -/4',
      'C#6/6 B5/2 A5/4 C#6/4',
      'F#6/8 E6/4 D6/4',
      'D#6/6 C#6/2 B5/8',
      'F5/4 G#5/4 C#6/8',
    ],
    arp: ARP.eighths,
    drums: true,
    bells: 0.06,
  },
  climb: {
    chords: ['D', 'E', 'F#m', 'F#m', 'D', 'E', 'C#', 'C#'],
    lead: [
      'A5/8 D6/4 F#6/4',
      'G#6/8 F#6/4 E6/4',
      'F#6/12 -/4',
      'A6/4 G#6/4 F#6/4 E6/4',
      'F#6/8 A6/8',
      'G#6/6 F#6/2 E6/8',
      'F6/8 G#6/8',
      'G#6/4 F6/4 C#6/8',
    ],
    arp: ARP.run,
    drums: true,
    bells: 0.06,
    sweep: [0.6, 1.25],
  },
  enigma: {
    chords: ['F#m', 'G', 'F#m', 'G', 'Em', 'D', 'C#', 'C#'],
    lead: [
      'F#5/8 -/4 C#6/4',
      'B5/6 A5/2 G5/8',
      'A5/8 -/4 F#5/4',
      'G5/4 B5/4 D6/8',
      'E6/8 D6/4 B5/4',
      'A5/12 -/4',
      'G#5/4 C#6/4 F6/8',
      'F6/12 -/4',
    ],
    arp: ARP.sparse,
    drums: true,
    bells: 0.18,
  },
  breakdown: {
    chords: ['F#m', 'D', 'Bm', 'C#sus4', 'F#m', 'D', 'G', 'C#'],
    arp: ARP.sparse,
    drums: false,
    bells: 0.35,
    sweep: [1, 0.35],
  },
} as const satisfies Record<string, SongSection>;

const SOUND: SongSound = {
  output: 0.58,
  // a warm, wide lead: two detuned saws, a soft attack, a slow vibrato and a glide between legato notes
  lead: {
    waves: ['sawtooth', 'sawtooth'],
    detune: 14,
    attack: 0.03,
    cutoff: 2100,
    vibrato: 9,
    level: 0.17,
    glide: 0.08,
  },
  arp: {
    wave: 'sawtooth',
    decay: 0.18,
    filterFrom: 3000,
    filterTo: 560,
    resonance: 3,
    register: 60,
    level: 0.15,
    detune: 10,
  },
  pad: { formants: [], cutoff: 1250, attack: 0.35, level: 0.055 },
  bass: 0,
  // the octave bounce of synthwave: root on the beat, an octave up on the off-beat
  pulse: {
    steps: [
      [0, 0],
      [2, 12],
      [4, 0],
      [6, 12],
      [8, 0],
      [10, 12],
      [12, 0],
      [14, 12],
    ],
    cutoff: 520,
    decay: 0.17,
    level: 0.2,
  },
  pump: 0.6,
  riser: 0.045,
  bells: 0.14,
  drums: 'drive',
  drumLevel: 1,
  // a gallop (an eighth and two sixteenths per beat) an octave above the bassline
  groove: {
    steps: [
      [0, 12],
      [2, 12],
      [3, 12],
      [4, 12],
      [6, 12],
      [7, 12],
      [8, 12],
      [10, 12],
      [11, 12],
      [12, 12],
      [14, 19],
      [15, 12],
    ],
    cutoff: 1100,
    level: 0.3,
  },
  stabs: 0.12,
};

export const DARK_MATTER_DRIVE = {
  menu: {
    tempo: 122,
    sections: SECTIONS,
    arrangement: ['intro', 'enigma', 'breakdown'],
    loopFrom: 1,
    battle: false,
    sound: SOUND,
  },
  game: {
    tempo: 122,
    sections: SECTIONS,
    arrangement: ['intro', 'hook', 'climb', 'hook', 'enigma', 'breakdown'],
    loopFrom: 1,
    battle: true,
    sound: SOUND,
  },
} as const satisfies Record<string, Song>;
