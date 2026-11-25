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
 * bass, bells and drums, with a tempo-synced ping-pong echo and a reverb. The calm output has everything a
 * quiet moment needs; the battle output adds the full drums, a driving bass and chord stabs, to be faded in
 * by the music intensity. For width the pad, the lead and the arpeggio play detuned voices spread across the
 * stereo field; the bass and the kick stay in the middle.
 */

/** Notes are scheduled this far ahead of the audio clock, on a timer (also enough for throttled tabs). */
const LOOKAHEAD_SECONDS = 1.5;
const SCHEDULER_INTERVAL_MS = 250;

/** Drum levels before the song's drumLevel. */
const KIT = { lightKick: 0.55, lightHat: 0.066, kick: 0.66, snare: 0.26, hat: 0.055, openHat: 0.06 } as const;
const CINEMATIC = { lightKick: 0.35, shaker: 0.022, kick: 0.75, tom: 0.5, snare: 0.32, crash: 0.07 } as const;
const DRIVE = {
  lightKick: 0.42,
  lightHat: 0.05,
  lightClap: 0.05,
  kick: 0.62,
  snare: 0.2,
  clap: 0.12,
  hat: 0.045,
  crash: 0.07,
} as const;

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
  private readonly pulse: ReadonlyMap<number, number>;
  /** The sidechain: the pad and the arpeggio go through it and duck on the beat. */
  private readonly pump: GainNode;
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
  /** A metallic noise (six detuned square waves, like the classic drum machines) for the hi-hats. */
  private readonly metal: AudioBuffer;
  /** The last lead note, for the glide into the next one. */
  private lastLead: { note: number; end: number } | null = null;
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
    this.pulse = new Map(song.sound.pulse?.steps ?? []);
    this.noise = noiseBuffer(ctx);
    this.metal = metalBuffer(ctx);

    this.calm = gain(ctx, song.sound.output);
    this.battle = gain(ctx, song.sound.output);
    const reverb = convolver(ctx, 3.2, 2.8);
    reverb.connect(this.calm);
    const battleReverb = convolver(ctx, 2.2, 3);
    battleReverb.connect(this.battle);
    // a dotted-eighth echo bouncing between left and right, a little duller with every repeat
    const echo = gain(ctx, 1);
    const left = ctx.createDelay(2);
    const right = ctx.createDelay(2);
    left.delayTime.value = this.stepSeconds * 3;
    right.delayTime.value = this.stepSeconds * 3;
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass';
    dull.frequency.value = 3200;
    echo.connect(left);
    left.connect(dull).connect(right);
    right.connect(gain(ctx, 0.42)).connect(left);
    const stereo = ctx.createChannelMerger(2);
    left.connect(stereo, 0, 0);
    right.connect(stereo, 0, 1);
    stereo.connect(gain(ctx, 0.5)).connect(this.calm);
    stereo.connect(gain(ctx, 0.25)).connect(reverb);

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
    this.pump = gain(ctx, 1);
    this.pump.connect(this.calm);
    this.lead = bus(this.calm, 0.8, 0.3, 0.35);
    this.arp = bus(this.pump, 0.7, 0.45, 0.3);
    this.pad = bus(this.pump, 0.6, 0, 0.6);
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
      if (this.sound.bass > 0) this.bassNote(chord.root + 36, time, this.stepSeconds * STEPS_PER_BAR);
    }
    const pump = this.sound.pump ?? 0;
    if (pump > 0 && section.drums && step % 4 === 0) this.duck(time, pump);
    // how far the section's filter sweep has come
    const [sweepFrom, sweepTo] = section.sweep ?? [1, 1];
    const sweep =
      sweepFrom +
      ((sweepTo - sweepFrom) * (this.bar * STEPS_PER_BAR + step)) / (prepared.chords.length * STEPS_PER_BAR);
    const pulseInterval = this.pulse.get(step);
    if (pulseInterval !== undefined) this.pulseNote(chord.root + 36 + pulseInterval, time, sweep);

    const arpIndex = section.arp[step] ?? -1;
    if (arpIndex >= 0) this.arpNote(arpTone(chord, arpIndex, this.sound.arp.register), time, sweep, step);

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

    const beat: Beat = {
      step,
      bar: this.bar,
      firstBar: this.bar === 0,
      lastBar: this.bar === prepared.chords.length - 1,
    };
    // a noise sweep rises into every next section
    const riser = this.sound.riser ?? 0;
    if (riser > 0 && beat.lastBar && step === 0) {
      this.riser(time, this.stepSeconds * STEPS_PER_BAR, riser * (section.drums ? 1 : 0.6));
    }
    if (!section.drums) return;
    if (this.sound.drums === 'kit') this.kitStep(beat, time);
    else if (this.sound.drums === 'drive') this.driveStep(beat, time);
    else this.cinematicStep(beat, time);
  }

  /**
   * Club drums: in calm a light four-on-the-floor kick, off-beat hats and a soft clap keep the song moving;
   * in battle a hard kick, snare and clap on the backbeat, 16th hats, a crash at the start of each section
   * and a snare roll into the next one.
   */
  private driveStep({ step, bar, firstBar, lastBar }: Beat, time: number): void {
    const level = this.sound.drumLevel;
    if (step % 4 === 0) this.kick(time, this.percussion, DRIVE.lightKick * level);
    if (step % 4 === 2) this.hat(time, this.percussion, DRIVE.lightHat * level, true);
    if (step === 4 || step === 12) this.clap(time, this.percussion, DRIVE.lightClap * level);

    if (step === 0 && firstBar) this.crash(time, DRIVE.crash * level);
    if (step % 4 === 0) this.kick(time, this.drums, DRIVE.kick * level);
    if (step === 4 || step === 12) {
      this.snare(time, DRIVE.snare * level, 0.18);
      this.clap(time, this.drums, DRIVE.clap * level);
    } else if (lastBar && step >= 8) {
      // the roll gets louder into the next section
      this.snare(time, DRIVE.snare * level * (0.25 + 0.09 * (step - 8)), 0.12);
    } else if (bar % 4 === 3 && step === 14) {
      this.snare(time, DRIVE.snare * level * 0.5, 0.12);
    }
    const accent = step % 4 === 2 ? 1.5 : step % 2 === 0 ? 1 : 0.55;
    this.hat(time, this.drums, DRIVE.hat * level * accent, step % 4 === 2);
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
    const {
      waves,
      detune,
      attack,
      cutoff,
      vibrato,
      level,
      glide = 0,
      octaves = [0],
      bloom = 0,
    } = this.sound.lead;
    const end = Math.max(time + length * 0.92, time + attack + 0.1);
    // legato notes slide in from the note before
    const from = this.lastLead && glide > 0 && time - this.lastLead.end < 0.12 ? this.lastLead.note : null;
    this.lastLead = { note, end };
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    if (bloom > 0) {
      // brass: the tone opens up after the attack and darkens again on the release
      filter.frequency.setValueAtTime(cutoff * 0.3, time);
      filter.frequency.exponentialRampToValueAtTime(cutoff, time + bloom);
      filter.frequency.setValueAtTime(cutoff, end);
      filter.frequency.exponentialRampToValueAtTime(cutoff * 0.4, end + 0.15);
    } else {
      filter.frequency.value = cutoff;
    }
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
    for (const octave of octaves) {
      // a doubling below the melody is a little quieter, so the melody stays on top
      const voiceLevel = (octave < 0 ? 0.75 : 1) / (waves.length * octaves.length);
      waves.forEach((wave, index) => {
        const oscillator = this.ctx.createOscillator();
        oscillator.type = wave;
        if (from === null) oscillator.frequency.value = frequency(note + octave);
        else {
          oscillator.frequency.setValueAtTime(frequency(from + octave), time);
          oscillator.frequency.exponentialRampToValueAtTime(frequency(note + octave), time + glide);
        }
        // the voices are detuned against each other and spread left and right
        oscillator.detune.value = (index - (waves.length - 1) / 2) * detune;
        depth.connect(oscillator.detune);
        const pan = waves.length > 1 ? (index / (waves.length - 1) - 0.5) * 0.5 : 0;
        oscillator.connect(gain(this.ctx, voiceLevel)).connect(panner(this.ctx, pan)).connect(filter);
        oscillator.start(time);
        oscillator.stop(end + 0.2);
      });
    }
    lfo.start(time);
    lfo.stop(end + 0.2);
  }

  /** A plucked arpeggio note; the notes alternate a little left and right. */
  private arpNote(note: number, time: number, sweep: number, step: number): void {
    const { wave, decay: length, filterFrom, filterTo, resonance, level, detune = 0 } = this.sound.arp;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = resonance;
    filter.frequency.setValueAtTime(filterFrom * sweep, time);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, filterTo * sweep),
      time + Math.min(0.3, length),
    );
    filter
      .connect(panner(this.ctx, step % 2 === 0 ? -0.3 : 0.3))
      .connect(decay(this.ctx, this.arp, time, level, length));
    for (const cents of detune > 0 ? [-detune / 2, detune / 2] : [0]) {
      const oscillator = this.ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.value = frequency(note);
      oscillator.detune.value = cents;
      oscillator.connect(gain(this.ctx, detune > 0 ? 0.6 : 1)).connect(filter);
      oscillator.start(time);
      oscillator.stop(time + length + 0.05);
    }
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
      // the filter breathes slowly over the bars (a function of time, so every bar continues the last)
      const breath = (at: number): number => cutoff * (1 + 0.4 * Math.sin(at * Math.PI * 2 * 0.06));
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(breath(time), time);
      filter.frequency.linearRampToValueAtTime(breath(end + release), end + release);
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
    // two detuned voices per note, one on each side
    const sides = [panner(this.ctx, -0.6), panner(this.ctx, 0.6)];
    for (const side of sides) side.connect(input);
    for (const note of [...chordTones(chord, 48).slice(0, chord.intervals.length), chord.root + 60]) {
      [-7, 7].forEach((cents, index) => {
        const oscillator = this.ctx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency(note);
        oscillator.detune.value = cents;
        oscillator.connect(sides[index] ?? input);
        oscillator.start(time);
        oscillator.stop(end + release + 0.1);
      });
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

  /** A plucked, filtered bass note of the calm bassline; `sweep` scales its filter (section sweeps). */
  private pulseNote(note: number, time: number, sweep: number): void {
    const pulse = this.sound.pulse;
    if (!pulse) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(pulse.cutoff * 2.2 * sweep, time);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, pulse.cutoff * 0.45 * sweep),
      time + pulse.decay,
    );
    filter.connect(decay(this.ctx, this.bass, time, pulse.level, pulse.decay));
    for (const [wave, cents] of [
      ['sawtooth', -7],
      ['sawtooth', 7],
    ] as const) {
      const oscillator = this.ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.value = frequency(note);
      oscillator.detune.value = cents;
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + pulse.decay + 0.05);
    }
    // a clean sub an octave down gives it weight without mud
    const sub = this.ctx.createOscillator();
    sub.frequency.value = frequency(note - 12);
    sub.connect(decay(this.ctx, this.bass, time, pulse.level * 0.7, pulse.decay * 1.2));
    sub.start(time);
    sub.stop(time + pulse.decay * 1.2 + 0.05);
  }

  /** The sidechain: the pad and the arpeggio dip on the beat and swell back before the next one. */
  private duck(time: number, depth: number): void {
    const level = this.pump.gain;
    level.setTargetAtTime(1 - depth, time, 0.006);
    level.setTargetAtTime(1, time + 0.04, this.stepSeconds * 0.9);
  }

  /** A hand clap: a few quick noise bursts and a short tail. */
  private clap(time: number, out: AudioNode, level: number): void {
    for (const [offset, part] of [
      [0, 0.7],
      [0.011, 0.8],
      [0.022, 1],
    ] as const) {
      const source = this.noiseSource(time + offset, 0.16);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1300;
      filter.Q.value = 1.4;
      source
        .connect(filter)
        .connect(decay(this.ctx, out, time + offset, level * part, offset === 0.022 ? 0.14 : 0.02));
    }
  }

  /** White noise sweeping up into the next section. */
  private riser(time: number, length: number, level: number): void {
    const source = this.noiseSource(time, length);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(350, time);
    filter.frequency.exponentialRampToValueAtTime(7000, time + length);
    const envelope = gain(this.ctx, 0);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + length * 0.97);
    envelope.gain.linearRampToValueAtTime(0, time + length);
    source.connect(filter).connect(envelope).connect(this.percussion);
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

  /** A punchy kick: a short click for the attack, a sine body that drops in pitch, a little saturation. */
  private kick(time: number, out: AudioNode, level: number): void {
    const body = this.ctx.createOscillator();
    body.frequency.setValueAtTime(170, time);
    body.frequency.exponentialRampToValueAtTime(52, time + 0.07);
    body.frequency.exponentialRampToValueAtTime(42, time + 0.3);
    const drive = this.ctx.createWaveShaper();
    drive.curve = saturation(1.8);
    body.connect(drive).connect(decay(this.ctx, out, time, level, 0.38));
    body.start(time);
    body.stop(time + 0.4);
    const click = this.noiseSource(time, 0.012);
    const bright = this.ctx.createBiquadFilter();
    bright.type = 'highpass';
    bright.frequency.value = 2500;
    click.connect(bright).connect(decay(this.ctx, out, time, level * 0.22, 0.008));
  }

  /** A snare: a two-tone body that drops a little and a crisp, filtered noise. */
  private snare(time: number, level: number, length: number): void {
    const source = this.noiseSource(time, length + 0.04);
    const low = this.ctx.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 1100;
    const high = this.ctx.createBiquadFilter();
    high.type = 'lowpass';
    high.frequency.value = 9000;
    source
      .connect(low)
      .connect(high)
      .connect(decay(this.ctx, this.drums, time, level, length));
    for (const [pitch, part] of [
      [185, 0.6],
      [330, 0.35],
    ] as const) {
      const body = this.ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(pitch, time);
      body.frequency.exponentialRampToValueAtTime(pitch * 0.85, time + 0.08);
      body.connect(decay(this.ctx, this.drums, time, level * part, 0.1));
      body.start(time);
      body.stop(time + 0.12);
    }
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

  /** A metallic hi-hat, closed or open, a little off center (alternating with the beat). */
  private hat(time: number, out: AudioNode, level: number, open: boolean): void {
    const length = open ? 0.2 : 0.04;
    const source = this.ctx.createBufferSource();
    source.buffer = this.metal;
    source.start(time, Math.random() * 0.2);
    source.stop(time + length + 0.02);
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 10000;
    band.Q.value = 0.9;
    const cut = this.ctx.createBiquadFilter();
    cut.type = 'highpass';
    cut.frequency.value = 7000;
    source
      .connect(band)
      .connect(cut)
      .connect(panner(this.ctx, open ? 0.2 : -0.15))
      .connect(decay(this.ctx, out, time, level * 1.6, length));
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

function panner(ctx: BaseAudioContext, pan: number): StereoPannerNode {
  const node = ctx.createStereoPanner();
  node.pan.value = pan;
  return node;
}

const saturationCurves = new Map<number, Float32Array<ArrayBuffer>>();

/** A soft clipping curve for a WaveShaper; drive around 1 to 3. */
function saturation(drive: number): Float32Array<ArrayBuffer> {
  let curve = saturationCurves.get(drive);
  if (!curve) {
    curve = new Float32Array(512);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    saturationCurves.set(drive, curve);
  }
  return curve;
}

/** Half a second of six square waves at inharmonic pitches, the metallic source of drum-machine hats. */
function metalBuffer(ctx: BaseAudioContext): AudioBuffer {
  const pitches = [205.3, 304.4, 369.6, 522.7, 540, 800].map((pitch) => pitch * 1.7);
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    let sum = 0;
    for (const pitch of pitches) sum += (t * pitch) % 1 < 0.5 ? 1 : -1;
    data[i] = (sum / pitches.length) * 0.8 + (Math.random() * 2 - 1) * 0.2;
  }
  return buffer;
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
