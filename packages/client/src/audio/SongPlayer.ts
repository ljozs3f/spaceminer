import {
  parseBar,
  parseChord,
  STEPS_PER_BAR,
  type LeadNote,
  type Song,
  type SongSection,
  type SongSound,
} from './song';

/**
 * Plays a Song (song.ts) with synthesized instruments whose character the song sets: lead, arpeggio, pad,
 * bass, bells and drums, with a tempo-synced echo and a reverb. The calm output has everything a quiet
 * moment needs; the battle output adds the full drums, a driving bass and chord stabs, to be faded in by the
 * music intensity.
 */

/** Notes are scheduled this far ahead of the audio clock, on a timer (also enough for throttled tabs). */
const LOOKAHEAD_SECONDS = 1.5;
const SCHEDULER_INTERVAL_MS = 250;

/** Drum levels before the song's drumLevel. */
const KIT = { lightKick: 0.55, lightHat: 0.066, kick: 0.66, snare: 0.26, hat: 0.055, openHat: 0.06 } as const;
const CINEMATIC = { lightKick: 0.35, shaker: 0.022, kick: 0.75, tom: 0.5, snare: 0.32, crash: 0.07 } as const;

interface Chord {
  readonly root: number;
  readonly intervals: readonly number[];
}

interface PreparedSection {
  readonly section: SongSection;
  readonly chords: readonly Chord[];
  /** Lead notes per bar, by the step they start on. */
  readonly lead: readonly ReadonlyMap<number, LeadNote>[];
}

/** Where the song is within its section, for the drums. */
interface Beat {
  readonly step: number;
  readonly bar: number;
  readonly firstBar: boolean;
  readonly lastBar: boolean;
}

export class SongPlayer {
  readonly calm: GainNode;
  readonly battle: GainNode;

  private readonly sound: SongSound;
  private readonly sections: readonly PreparedSection[];
  private readonly stepSeconds: number;
  private readonly groove: ReadonlyMap<number, number>;
  private readonly lead: GainNode;
  private readonly arp: GainNode;
  private readonly pad: GainNode;
  private readonly bass: GainNode;
  private readonly bells: GainNode;
  private readonly percussion: GainNode;
  private readonly drums: GainNode;
  private readonly driving: GainNode;
  private readonly stabs: GainNode;
  private readonly noise: AudioBuffer;
  private position = 0;
  private bar = 0;
  private step = 0;
  private nextStepTime = 0;
  private timer: number | undefined;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly song: Song,
  ) {
    this.sound = song.sound;
    this.sections = song.arrangement.map((name) => prepare(song, name));
    this.stepSeconds = 60 / song.tempo / 4;
    this.groove = new Map(song.sound.groove.steps);
    this.noise = noiseBuffer(ctx);

    this.calm = gain(ctx, song.sound.output);
    this.battle = gain(ctx, song.sound.output);
    const reverb = convolver(ctx, 3.2, 2.8);
    reverb.connect(this.calm);
    const battleReverb = convolver(ctx, 2.2, 3);
    battleReverb.connect(this.battle);
    // a dotted-eighth echo that gets duller with every repeat
    const echo = ctx.createDelay(2);
    echo.delayTime.value = this.stepSeconds * 3;
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = 3500;
    echo.connect(dull).connect(gain(ctx, 0.35)).connect(echo);
    dull.connect(gain(ctx, 0.5)).connect(this.calm);
    dull.connect(gain(ctx, 0.3)).connect(reverb);

    const bus = (
      out: GainNode,
      dry: number,
      echoSend: number,
      reverbSend: number,
      room = reverb,
    ): GainNode => {
      const node = gain(ctx, 1);
      node.connect(gain(ctx, dry)).connect(out);
      if (echoSend > 0) node.connect(gain(ctx, echoSend)).connect(echo);
      if (reverbSend > 0) node.connect(gain(ctx, reverbSend)).connect(room);
      return node;
    };
    this.lead = bus(this.calm, 0.8, 0.3, 0.35);
    this.arp = bus(this.calm, 0.7, 0.45, 0.3);
    this.pad = bus(this.calm, 0.6, 0, 0.6);
    this.bells = bus(this.calm, 0.4, 0.6, 0.7);
    this.bass = bus(this.calm, 1, 0, 0);
    this.percussion = bus(this.calm, 0.9, 0, 0.1);
    this.drums = bus(this.battle, 1, 0, 0.25, battleReverb);
    this.driving = bus(this.battle, 1, 0, 0);
    this.stabs = bus(this.battle, 0.8, 0, 0.4, battleReverb);
  }

  /** Starts in real time: notes are scheduled a little ahead, on a timer. */
  start(): void {
    this.begin(this.ctx.currentTime + 0.05);
    this.scheduleUntil(this.ctx.currentTime + LOOKAHEAD_SECONDS);
    this.timer = window.setInterval(() => {
      this.scheduleUntil(this.ctx.currentTime + LOOKAHEAD_SECONDS);
    }, SCHEDULER_INTERVAL_MS);
  }

  /** The song starts at `time`. Call scheduleUntil() afterwards (start() does both in real time). */
  begin(time: number): void {
    this.nextStepTime = time;
  }

  /** Schedules every step that starts before `time` (audio clock seconds); also used to render offline. */
  scheduleUntil(time: number): void {
    while (this.nextStepTime < time) {
      this.playStep(this.nextStepTime);
      this.nextStepTime += this.stepSeconds;
      this.advance();
    }
  }

  /** Stops scheduling; notes already scheduled ring out. */
  stop(): void {
    window.clearInterval(this.timer);
  }

  private advance(): void {
    this.step += 1;
    if (this.step < STEPS_PER_BAR) return;
    this.step = 0;
    this.bar += 1;
    if (this.bar < (this.sections[this.position]?.chords.length ?? 0)) return;
    this.bar = 0;
    this.position = this.position + 1 < this.sections.length ? this.position + 1 : this.song.loopFrom;
  }

  private playStep(time: number): void {
    const prepared = this.sections[this.position];
    const chord = prepared?.chords[this.bar];
    if (!prepared || !chord) return;
    const { section } = prepared;
    const step = this.step;

    if (step === 0) {
      this.padChord(chord, time, this.stepSeconds * STEPS_PER_BAR);
      this.bassNote(chord.root + 36, time, this.stepSeconds * STEPS_PER_BAR);
    }

    const arpIndex = section.arp[step] ?? -1;
    if (arpIndex >= 0) this.arpNote(arpTone(chord, arpIndex, this.sound.arp.register), time);

    const lead = prepared.lead[this.bar]?.get(step);
    if (lead && lead.note !== null) this.leadNote(lead.note, time, lead.steps * this.stepSeconds);

    if (step % 4 === 0 && Math.random() < section.bells) {
      const tones = chordTones(chord, 72);
      this.bell(tones[Math.floor(Math.random() * tones.length)] ?? 84, time);
    }

    // battle: the driving bass (only on the beats in sections without drums) and chord stabs
    const grooveInterval = this.groove.get(step);
    if (grooveInterval !== undefined && (section.drums || step % 8 === 0)) {
      this.grooveNote(chord.root + 36 + grooveInterval, time);
    }
    if (this.sound.stabs > 0 && section.drums && (step === 0 || (step === 10 && this.bar % 2 === 1))) {
      this.stab(chord, time);
    }

    if (!section.drums) return;
    const beat: Beat = {
      step,
      bar: this.bar,
      firstBar: this.bar === 0,
      lastBar: this.bar === prepared.chords.length - 1,
    };
    if (this.sound.drums === 'kit') this.kitStep(beat, time);
    else this.cinematicStep(beat, time);
  }

  /** Kick, snare and hi-hats: light ones in calm, the full kit in battle, a snare fill into each section. */
  private kitStep({ step, bar, lastBar }: Beat, time: number): void {
    const level = this.sound.drumLevel;
    if (step % 4 === 2) this.hat(time, this.percussion, KIT.lightHat * level, false);
    if (step === 0) this.kick(time, this.percussion, KIT.lightKick * level);
    if (step === 0 || step === 8 || (step === 10 && bar % 2 === 1))
      this.kick(time, this.drums, KIT.kick * level);
    if (step === 4 || step === 12) this.snare(time, KIT.snare * level, 0.16);
    else if (lastBar && step > 12) this.snare(time, KIT.snare * level * (0.3 + 0.2 * (step - 12)), 0.16);
    if (step % 2 === 0 && step !== 14) this.hat(time, this.drums, KIT.hat * level, false);
    if (step === 14) this.hat(time, this.drums, KIT.openHat * level, true);
  }

  /**
   * Film-score drums: a soft shaker in calm; in battle deep kicks, a big snare on the third beat, toms, a crash
   * at the start of each section and a tom roll into the next one.
   */
  private cinematicStep({ step, bar, firstBar, lastBar }: Beat, time: number): void {
    const level = this.sound.drumLevel;
    if (step % 2 === 0)
      this.shaker(time, this.percussion, CINEMATIC.shaker * level * (step % 4 === 0 ? 1 : 0.6));
    if (step === 0) this.kick(time, this.percussion, CINEMATIC.lightKick * level);

    if (step === 0 && firstBar) this.crash(time, CINEMATIC.crash * level);
    if (step === 0 || step === 6 || (step === 10 && bar % 2 === 1))
      this.kick(time, this.drums, CINEMATIC.kick * level);
    if (step === 8) this.snare(time, CINEMATIC.snare * level, 0.3);
    if (lastBar && step >= 8 && step % 2 === 0) {
      this.tom(time, CINEMATIC.tom * level * (0.6 + 0.1 * (step - 8)), 150 - (step - 8) * 8);
    } else if (lastBar && step > 12) {
      this.tom(time, CINEMATIC.tom * level * 0.8, 95);
    } else if (bar % 2 === 1 && (step === 12 || step === 14)) {
      this.tom(time, CINEMATIC.tom * level * 0.7, step === 12 ? 140 : 100);
    }
    this.shaker(time, this.drums, CINEMATIC.shaker * level * (step % 2 === 0 ? 1 : 0.5));
  }

  private leadNote(note: number, time: number, length: number): void {
    const { waves, detune, attack, cutoff, vibrato, level } = this.sound.lead;
    const end = Math.max(time + length * 0.92, time + attack + 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.8;
    const envelope = gain(this.ctx, 0);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + attack);
    envelope.gain.linearRampToValueAtTime(level * 0.75, time + attack + 0.1);
    envelope.gain.setValueAtTime(level * 0.75, end);
    envelope.gain.linearRampToValueAtTime(0, end + 0.15);
    filter.connect(envelope).connect(this.lead);
    // vibrato that fades in on longer notes
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = gain(this.ctx, 0);
    depth.gain.setValueAtTime(0, time);
    depth.gain.linearRampToValueAtTime(vibrato, time + 0.35);
    lfo.connect(depth);
    waves.forEach((wave, index) => {
      const oscillator = this.ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.value = frequency(note);
      oscillator.detune.value = index * detune;
      depth.connect(oscillator.detune);
      oscillator.connect(gain(this.ctx, 1 / waves.length)).connect(filter);
      oscillator.start(time);
      oscillator.stop(end + 0.2);
    });
    lfo.start(time);
    lfo.stop(end + 0.2);
  }

  private arpNote(note: number, time: number): void {
    const { wave, decay: length, filterFrom, filterTo, resonance, level } = this.sound.arp;
    const oscillator = this.ctx.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.value = frequency(note);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = resonance;
    filter.frequency.setValueAtTime(filterFrom, time);
    filter.frequency.exponentialRampToValueAtTime(filterTo, time + Math.min(0.3, length));
    oscillator.connect(filter).connect(decay(this.ctx, this.arp, time, level, length));
    oscillator.start(time);
    oscillator.stop(time + length + 0.05);
  }

  /** A chord held over the bar: a plain synth pad, or a choir through vowel formant filters. */
  private padChord(chord: Chord, time: number, length: number): void {
    const { formants, cutoff, attack, level } = this.sound.pad;
    const release = 1;
    const end = time + length;
    const envelope = gain(this.ctx, 0);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + attack);
    envelope.gain.setValueAtTime(1, end);
    envelope.gain.linearRampToValueAtTime(0, end + release);
    envelope.connect(this.pad);
    const input = gain(this.ctx, level);
    if (formants.length === 0) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      input.connect(filter).connect(envelope);
    } else {
      for (const formant of formants) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = formant;
        filter.Q.value = 6;
        input.connect(filter).connect(envelope);
      }
    }
    for (const note of [...chordTones(chord, 48).slice(0, chord.intervals.length), chord.root + 60]) {
      for (const cents of [-6, 6]) {
        const oscillator = this.ctx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency(note);
        oscillator.detune.value = cents;
        oscillator.connect(input);
        oscillator.start(time);
        oscillator.stop(end + release + 0.1);
      }
    }
  }

  /** The calm, long bass note under each bar. */
  private bassNote(note: number, time: number, length: number): void {
    const level = this.sound.bass;
    const end = time + length;
    const envelope = gain(this.ctx, 0);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + 0.05);
    envelope.gain.setValueAtTime(level, end - 0.05);
    envelope.gain.linearRampToValueAtTime(0, end + 0.2);
    envelope.connect(this.bass);
    for (const wave of ['sine', 'triangle'] as const) {
      const oscillator = this.ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.value = frequency(note);
      oscillator.connect(envelope);
      oscillator.start(time);
      oscillator.stop(end + 0.25);
    }
  }

  private grooveNote(note: number, time: number): void {
    const { cutoff, level } = this.sound.groove;
    const oscillator = this.ctx.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = frequency(note);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.22, time + 0.18);
    oscillator.connect(filter).connect(decay(this.ctx, this.driving, time, level, 0.26));
    oscillator.start(time);
    oscillator.stop(time + 0.3);
  }

  /** A brassy chord hit whose filter opens and closes again. */
  private stab(chord: Chord, time: number): void {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(2200, time + 0.08);
    filter.frequency.exponentialRampToValueAtTime(500, time + 0.6);
    filter.connect(decay(this.ctx, this.stabs, time, this.sound.stabs, 0.75));
    for (const note of [...chordTones(chord, 48).slice(0, 3), chord.root + 60]) {
      for (const cents of [-8, 8]) {
        const oscillator = this.ctx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency(note);
        oscillator.detune.value = cents;
        oscillator.connect(filter);
        oscillator.start(time);
        oscillator.stop(time + 0.8);
      }
    }
  }

  /** A soft bell: a few inharmonic sine partials that ring out. */
  private bell(note: number, time: number): void {
    const base = frequency(note);
    for (const [ratio, level, length] of [
      [1, 1, 3],
      [2.76, 0.35, 1.8],
      [5.4, 0.12, 0.9],
    ] as const) {
      const oscillator = this.ctx.createOscillator();
      oscillator.frequency.value = base * ratio;
      oscillator.connect(decay(this.ctx, this.bells, time, this.sound.bells * level, length));
      oscillator.start(time);
      oscillator.stop(time + length + 0.1);
    }
  }

  private kick(time: number, out: AudioNode, level: number): void {
    const oscillator = this.ctx.createOscillator();
    oscillator.frequency.setValueAtTime(150, time);
    oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    oscillator.connect(decay(this.ctx, out, time, level, 0.32));
    oscillator.start(time);
    oscillator.stop(time + 0.35);
  }

  private snare(time: number, level: number, length: number): void {
    const source = this.noiseSource(time, length + 0.04);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    source.connect(filter).connect(decay(this.ctx, this.drums, time, level, length));
    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = 190;
    body.connect(decay(this.ctx, this.drums, time, level * 0.6, 0.09));
    body.start(time);
    body.stop(time + 0.11);
  }

  private tom(time: number, level: number, pitch: number): void {
    const oscillator = this.ctx.createOscillator();
    oscillator.frequency.setValueAtTime(pitch, time);
    oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.6, time + 0.35);
    oscillator.connect(decay(this.ctx, this.drums, time, level, 0.45));
    oscillator.start(time);
    oscillator.stop(time + 0.5);
    const thump = this.noiseSource(time, 0.06);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    thump.connect(filter).connect(decay(this.ctx, this.drums, time, level * 0.5, 0.05));
  }

  private crash(time: number, level: number): void {
    const source = this.noiseSource(time, 1.6);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    source.connect(filter).connect(decay(this.ctx, this.drums, time, level, 1.5));
  }

  private hat(time: number, out: AudioNode, level: number, open: boolean): void {
    const length = open ? 0.18 : 0.035;
    const source = this.noiseSource(time, length + 0.02);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    source.connect(filter).connect(decay(this.ctx, out, time, level, length));
  }

  private shaker(time: number, out: AudioNode, level: number): void {
    const source = this.noiseSource(time, 0.09);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 6500;
    filter.Q.value = 1.2;
    source.connect(filter).connect(decay(this.ctx, out, time, level, 0.07));
  }

  private noiseSource(time: number, length: number): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    // start somewhere in the buffer so that no two hits are the same noise
    source.start(time, Math.random() * 0.4);
    source.stop(time + length);
    return source;
  }
}

function prepare(song: Song, name: string): PreparedSection {
  const section = song.sections[name];
  if (!section) throw new Error(`Song section "${name}" is missing`);
  return {
    section,
    chords: section.chords.map(parseChord),
    lead: section.chords.map(
      (_, bar) => new Map(parseBar(section.lead?.[bar] ?? '-/16').map((note) => [note.step, note])),
    ),
  };
}

/** The chord's notes from its root in the octave starting at `from`, and the same notes an octave higher. */
function chordTones(chord: Chord, from: number): number[] {
  const root = from + chord.root;
  const notes = chord.intervals.map((interval) => root + interval);
  return [...notes, ...notes.map((note) => note + 12)];
}

/** Arpeggio notes stay within about an octave and a half above `register`, whatever the chord. */
function arpTone(chord: Chord, index: number, register: number): number {
  const tones = chordTones(chord, chord.root + register > register + 5 ? register - 12 : register).slice(
    0,
    6,
  );
  return tones[index % tones.length] ?? register;
}

function frequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

/** A gain that jumps to `peak` and decays exponentially over `length` seconds, into `out`. */
function decay(ctx: BaseAudioContext, out: AudioNode, time: number, peak: number, length: number): GainNode {
  const node = ctx.createGain();
  node.gain.setValueAtTime(0.0001, time);
  node.gain.exponentialRampToValueAtTime(peak, time + 0.004);
  node.gain.exponentialRampToValueAtTime(0.0001, time + length);
  node.connect(out);
  return node;
}

/** A reverb from a synthetic impulse response: stereo noise that decays over `seconds`. */
function convolver(ctx: BaseAudioContext, seconds: number, falloff: number): ConvolverNode {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** falloff;
  }
  const node = ctx.createConvolver();
  node.buffer = impulse;
  return node;
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
