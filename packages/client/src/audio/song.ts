/**
 * The soundtrack's building blocks: songs are written as data (songs/*.ts) in a small notation, and played by
 * SongPlayer with synthesized instruments whose character every song sets (SongSound).
 *
 * Notation:
 * - chords: one per bar, e.g. 'Em', 'C', 'B', 'Fmaj7', 'Bsus4' (see CHORD_INTERVALS)
 * - lead: one string per bar, 16 sixteenth-note steps in total; 'A4/2' is A4 for 2 steps, '-/4' a rest
 * - arp: 16 steps of indices into the chord's notes over two octaves (-1: rest)
 */

export interface SongSection {
  readonly chords: readonly string[];
  readonly lead?: readonly string[];
  readonly arp: readonly number[];
  /** Drums play in this section (light ones in calm, the full kit in battle). */
  readonly drums: boolean;
  /** Chance of a bell on each beat. */
  readonly bells: number;
  /**
   * A filter sweep over the section: the bassline's and the arpeggio's brightness goes from the first factor
   * to the second (1: as the song sets it). Opening up builds tension, closing calms down.
   */
  readonly sweep?: readonly [from: number, to: number];
}

export interface Song {
  readonly tempo: number;
  readonly sections: Readonly<Record<string, SongSection>>;
  readonly arrangement: readonly string[];
  /** After the last section the song continues from this one (the intro plays once). */
  readonly loopFrom: number;
  /** Whether the song has a battle layer (full drums, bass, stabs) for the intensity to bring in. */
  readonly battle: boolean;
  readonly sound: SongSound;
}

/** How a song's instruments sound. Levels are peak gains, balanced by measuring the rendered song. */
export interface SongSound {
  /** Volume of the whole song. */
  readonly output: number;
  readonly lead: {
    readonly waves: readonly OscillatorType[];
    /** Cents between the oscillators, for width. */
    readonly detune: number;
    /** Seconds to full volume: short for a plucked lead, long for a soft one. */
    readonly attack: number;
    readonly cutoff: number;
    /** Depth of the vibrato in cents. */
    readonly vibrato: number;
    readonly level: number;
    /** Seconds a note slides from the one before when they are played legato (portamento). */
    readonly glide?: number;
    /** Octaves every note is doubled at, in semitones (e.g. [0, -12]: a horn section). Default [0]. */
    readonly octaves?: readonly number[];
    /** Seconds the filter takes to open at the start of a note, like a brass instrument (0: open at once). */
    readonly bloom?: number;
  };
  readonly arp: {
    readonly wave: OscillatorType;
    /** Seconds each note rings: short plucks or long, glassy notes. */
    readonly decay: number;
    /** Filter sweep of each note, from bright to dull (Hz). */
    readonly filterFrom: number;
    readonly filterTo: number;
    readonly resonance: number;
    /** MIDI note around which the arpeggio plays (a C: 48, 60, 72). */
    readonly register: number;
    readonly level: number;
    /** Cents between two detuned voices, for width (0: one voice). */
    readonly detune?: number;
  };
  readonly pad: {
    /** Vowel formants (Hz) for a choir-like pad; empty for a plain synth pad. */
    readonly formants: readonly number[];
    readonly cutoff: number;
    /** Seconds to fade in. */
    readonly attack: number;
    readonly level: number;
  };
  /** Level of the long bass note under each bar. */
  readonly bass: number;
  /**
   * A plucked bassline in the calm music, on these steps of the bar (interval above the root): what keeps a
   * driving song moving when no battle is on.
   */
  readonly pulse?: {
    readonly steps: readonly (readonly [step: number, interval: number])[];
    readonly cutoff: number;
    /** Seconds each note rings. */
    readonly decay: number;
    readonly level: number;
  };
  /** Sidechain pumping: how deep the pad and the arpeggio duck on every beat of a section with drums (0 to 1). */
  readonly pump?: number;
  /** Level of the noise sweep rising into the next section (0: none). */
  readonly riser?: number;
  readonly bells: number;
  /**
   * 'kit': kick, snare and hi-hats; 'cinematic': deep kicks, toms, a big snare and a shaker; 'drive': a
   * four-on-the-floor kick, off-beat hats and claps, a snare roll into each section.
   */
  readonly drums: 'kit' | 'cinematic' | 'drive';
  readonly drumLevel: number;
  /** The driving bass of the battle layer: steps of the bar it plays on, and the interval above the root. */
  readonly groove: {
    readonly steps: readonly (readonly [step: number, interval: number])[];
    readonly cutoff: number;
    readonly level: number;
  };
  /** Level of the battle layer's chord stabs (0: none). */
  readonly stabs: number;
}

export const STEPS_PER_BAR = 16;

const CHORD_INTERVALS: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

const NOTE_OFFSETS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI note of a name like 'C#5' or 'Bb4'. */
export function noteNumber(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const offset = match ? NOTE_OFFSETS[match[1] ?? ''] : undefined;
  if (!match || offset === undefined) throw new Error(`Bad note "${name}"`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + offset + accidental;
}

/** Pitch class of the root (0 = C) and the intervals of a chord name like 'Bbmaj7'. */
export function parseChord(name: string): { root: number; intervals: readonly number[] } {
  const match = /^([A-G])([#b]?)(.*)$/.exec(name);
  const offset = match ? NOTE_OFFSETS[match[1] ?? ''] : undefined;
  const intervals = match ? CHORD_INTERVALS[match[3] ?? ''] : undefined;
  if (!match || offset === undefined || !intervals) throw new Error(`Bad chord "${name}"`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return { root: (offset + accidental + 12) % 12, intervals };
}

export interface LeadNote {
  readonly step: number;
  /** null: a rest. */
  readonly note: number | null;
  readonly steps: number;
}

/** The notes of one bar of a lead line; every bar must fill exactly 16 steps. */
export function parseBar(bar: string): LeadNote[] {
  let step = 0;
  const notes = bar.split(/\s+/).map((token) => {
    const [name = '', length = ''] = token.split('/');
    const steps = Number(length);
    const note = { step, note: name === '-' ? null : noteNumber(name), steps };
    step += steps;
    return note;
  });
  if (step !== STEPS_PER_BAR)
    throw new Error(`Bar "${bar}" has ${String(step)} steps, not ${String(STEPS_PER_BAR)}`);
  return notes;
}
