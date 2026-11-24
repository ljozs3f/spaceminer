/**
 * Sound effects synthesized with the Web Audio API: no files, and every play varies a little, so repeated
 * shots and explosions do not sound copy-pasted.
 */

export type SoundEffect =
  | 'laser'
  | 'missileLaunch'
  | 'missileImpact'
  | 'explosionSmall'
  | 'explosionMedium'
  | 'explosionLarge'
  | 'buildingDestroyed'
  | 'placeMine'
  | 'placeSolar'
  | 'placeLaser'
  | 'placeMissile'
  | 'upgrade'
  | 'sell'
  | 'error'
  | 'pirateShot'
  | 'notify'
  | 'warning'
  | 'waveWarning'
  | 'won'
  | 'lost';

interface EffectDefinition {
  /** Plays the effect into `out` at `start` (AudioContext time); returns its length in seconds. */
  readonly play: (ctx: AudioContext, out: AudioNode, start: number) => number;
  /** At most this many copies sound at once, the rest are dropped. */
  readonly maxVoices: number;
  /** Plays closer together than this are dropped (rapid-fire turrets). */
  readonly minIntervalMs: number;
}

export const EFFECTS: Readonly<Record<SoundEffect, EffectDefinition>> = {
  laser: {
    maxVoices: 6,
    minIntervalMs: 45,
    play: (ctx, out, t) => {
      const pitch = vary(0.12);
      tone(ctx, out, t, {
        wave: 'square',
        from: 1700 * pitch,
        to: 380 * pitch,
        duration: 0.09,
        peak: 0.07,
        lowpass: 5000,
      });
      return 0.09;
    },
  },
  missileLaunch: {
    maxVoices: 4,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      noiseBurst(ctx, out, t, {
        duration: 0.45,
        peak: 0.22,
        filter: 'bandpass',
        from: 500,
        to: 2600 * vary(0.2),
        q: 2,
      });
      tone(ctx, out, t, { wave: 'sine', from: 160, to: 55, duration: 0.25, peak: 0.25 });
      return 0.45;
    },
  },
  missileImpact: { maxVoices: 4, minIntervalMs: 60, play: (ctx, out, t) => explosion(ctx, out, t, 0.6) },
  explosionSmall: { maxVoices: 5, minIntervalMs: 40, play: (ctx, out, t) => explosion(ctx, out, t, 0.5) },
  explosionMedium: { maxVoices: 4, minIntervalMs: 60, play: (ctx, out, t) => explosion(ctx, out, t, 0.85) },
  explosionLarge: { maxVoices: 3, minIntervalMs: 100, play: (ctx, out, t) => explosion(ctx, out, t, 1.3) },
  buildingDestroyed: {
    maxVoices: 3,
    minIntervalMs: 120,
    play: (ctx, out, t) => {
      const length = explosion(ctx, out, t, 1.6);
      // falling metal debris
      for (let i = 0; i < 7; i++) {
        noiseBurst(ctx, out, t + 0.08 + Math.random() * 0.7, {
          duration: 0.05 + Math.random() * 0.06,
          peak: 0.08,
          filter: 'highpass',
          from: 2500 + Math.random() * 3000,
          to: 1500,
        });
      }
      // the power going down
      tone(ctx, out, t + 0.05, {
        wave: 'sawtooth',
        from: 320,
        to: 40,
        duration: 0.9,
        peak: 0.07,
        lowpass: 900,
      });
      return Math.max(length, 0.95);
    },
  },
  // starting up a new building: every type has its own
  placeMine: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      noiseBurst(ctx, out, t, { duration: 0.14, peak: 0.25, filter: 'lowpass', from: 700, to: 120 });
      tone(ctx, out, t + 0.05, {
        wave: 'sawtooth',
        from: 60,
        to: 190,
        duration: 0.7,
        peak: 0.08,
        attack: 0.15,
        lowpass: 900,
        tremolo: 18,
      });
      tone(ctx, out, t + 0.7, { wave: 'triangle', from: 1320, to: 1320, duration: 0.3, peak: 0.06 });
      return 1;
    },
  },
  placeSolar: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      [1318.5, 1661.2, 1975.5, 2637].forEach((frequency, i) => {
        tone(ctx, out, t + i * 0.07, {
          wave: 'sine',
          from: frequency,
          to: frequency,
          duration: 0.4,
          peak: 0.05,
        });
      });
      noiseBurst(ctx, out, t, {
        duration: 0.7,
        peak: 0.035,
        filter: 'highpass',
        from: 5000,
        to: 8000,
        attack: 0.3,
      });
      for (const frequency of [329.6, 494]) {
        tone(ctx, out, t, {
          wave: 'sine',
          from: frequency,
          to: frequency,
          duration: 0.9,
          peak: 0.05,
          attack: 0.3,
        });
      }
      return 0.95;
    },
  },
  placeLaser: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      tone(ctx, out, t, {
        wave: 'sawtooth',
        from: 220,
        to: 1760,
        duration: 0.55,
        peak: 0.05,
        attack: 0.4,
        lowpass: 3000,
      });
      tone(ctx, out, t + 0.55, { wave: 'square', from: 2400, to: 2400, duration: 0.03, peak: 0.05 });
      tone(ctx, out, t + 0.6, {
        wave: 'square',
        from: 1800,
        to: 600,
        duration: 0.11,
        peak: 0.05,
        lowpass: 5000,
      });
      return 0.75;
    },
  },
  placeMissile: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      noiseBurst(ctx, out, t, { duration: 0.5, peak: 0.12, filter: 'bandpass', from: 3000, to: 800, q: 1.5 });
      for (const at of [0.05, 0.45]) {
        noiseBurst(ctx, out, t + at, { duration: 0.12, peak: 0.2, filter: 'lowpass', from: 450, to: 80 });
        tone(ctx, out, t + at, { wave: 'sine', from: 95, to: 50, duration: 0.18, peak: 0.25 });
      }
      tone(ctx, out, t + 0.15, {
        wave: 'square',
        from: 180,
        to: 260,
        duration: 0.35,
        peak: 0.035,
        lowpass: 1200,
      });
      return 0.65;
    },
  },
  upgrade: {
    maxVoices: 2,
    minIntervalMs: 50,
    play: (ctx, out, t) => {
      [440, 554.4, 659.3, 880, 1108.7].forEach((frequency, i) => {
        tone(ctx, out, t + i * 0.06, {
          wave: 'triangle',
          from: frequency,
          to: frequency,
          duration: 0.25,
          peak: 0.11,
        });
      });
      noiseBurst(ctx, out, t + 0.1, {
        duration: 0.5,
        peak: 0.03,
        filter: 'highpass',
        from: 6000,
        to: 9000,
        attack: 0.2,
      });
      tone(ctx, out, t, { wave: 'sine', from: 110, to: 220, duration: 0.4, peak: 0.12 });
      return 0.6;
    },
  },
  sell: {
    maxVoices: 2,
    minIntervalMs: 50,
    play: (ctx, out, t) => {
      tone(ctx, out, t, { wave: 'triangle', from: 659.3, to: 659.3, duration: 0.09, peak: 0.12 });
      tone(ctx, out, t + 0.09, { wave: 'triangle', from: 440, to: 440, duration: 0.16, peak: 0.12 });
      noiseBurst(ctx, out, t, { duration: 0.2, peak: 0.03, filter: 'highpass', from: 6000, to: 8000 });
      return 0.25;
    },
  },
  error: {
    maxVoices: 1,
    minIntervalMs: 150,
    play: (ctx, out, t) => {
      tone(ctx, out, t, { wave: 'square', from: 150, to: 130, duration: 0.15, peak: 0.08, lowpass: 1200 });
      return 0.15;
    },
  },
  pirateShot: {
    maxVoices: 5,
    minIntervalMs: 60,
    play: (ctx, out, t) => {
      const pitch = vary(0.15);
      tone(ctx, out, t, {
        wave: 'sawtooth',
        from: 950 * pitch,
        to: 240 * pitch,
        duration: 0.12,
        peak: 0.045,
        lowpass: 2200,
      });
      return 0.12;
    },
  },
  // discreet: a wave on its way
  notify: {
    maxVoices: 1,
    minIntervalMs: 500,
    play: (ctx, out, t) => {
      tone(ctx, out, t, { wave: 'sine', from: 880, to: 880, duration: 0.25, peak: 0.06, attack: 0.02 });
      tone(ctx, out, t + 0.13, {
        wave: 'sine',
        from: 1318.5,
        to: 1318.5,
        duration: 0.4,
        peak: 0.05,
        attack: 0.02,
      });
      return 0.55;
    },
  },
  // something needs attention: low energy, an attack
  warning: {
    maxVoices: 1,
    minIntervalMs: 500,
    play: (ctx, out, t) => {
      tone(ctx, out, t, { wave: 'triangle', from: 523.3, to: 523.3, duration: 0.16, peak: 0.08 });
      tone(ctx, out, t + 0.18, { wave: 'triangle', from: 392, to: 392, duration: 0.25, peak: 0.08 });
      return 0.45;
    },
  },
  waveWarning: {
    maxVoices: 1,
    minIntervalMs: 1000,
    play: (ctx, out, t) => {
      for (let i = 0; i < 6; i++) {
        const frequency = i % 2 === 0 ? 520 : 390;
        tone(ctx, out, t + i * 0.18, {
          wave: 'sawtooth',
          from: frequency,
          to: frequency,
          duration: 0.17,
          peak: 0.06,
          lowpass: 2200,
        });
      }
      return 1.1;
    },
  },
  won: {
    maxVoices: 1,
    minIntervalMs: 1000,
    play: (ctx, out, t) => {
      for (const frequency of [261.6, 329.6, 392, 523.3]) {
        tone(ctx, out, t, {
          wave: 'sine',
          from: frequency,
          to: frequency,
          duration: 3,
          peak: 0.07,
          attack: 0.5,
        });
      }
      return 3;
    },
  },
  lost: {
    maxVoices: 1,
    minIntervalMs: 1000,
    play: (ctx, out, t) => {
      tone(ctx, out, t, { wave: 'sawtooth', from: 392, to: 98, duration: 1.8, peak: 0.08, lowpass: 800 });
      noiseBurst(ctx, out, t, { duration: 2, peak: 0.1, filter: 'lowpass', from: 400, to: 60 });
      return 2;
    },
  },
};

/** A boom whose size (about 0.5 to 1.6) sets its length, depth and loudness. */
function explosion(ctx: AudioContext, out: AudioNode, t: number, size: number): number {
  const duration = (0.3 + 0.55 * size) * vary(0.15);
  noiseBurst(ctx, out, t, {
    duration,
    peak: 0.3 + 0.12 * size,
    filter: 'lowpass',
    from: 2600 / size,
    to: 90,
  });
  tone(ctx, out, t, {
    wave: 'sine',
    from: 110 / size,
    to: 32,
    duration: duration * 0.8,
    peak: 0.35 + 0.15 * size,
  });
  return duration;
}

interface ToneOptions {
  readonly wave: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly peak: number;
  readonly attack?: number;
  readonly lowpass?: number;
  /** Hz of a volume wobble (a drill, a motor). */
  readonly tremolo?: number;
}

function tone(ctx: AudioContext, out: AudioNode, t: number, options: ToneOptions): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = options.wave;
  oscillator.frequency.setValueAtTime(options.from, t);
  oscillator.frequency.exponentialRampToValueAtTime(options.to, t + options.duration);
  let node: AudioNode = oscillator;
  if (options.lowpass !== undefined) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = options.lowpass;
    node = node.connect(filter);
  }
  if (options.tremolo !== undefined) {
    const wobble = ctx.createGain();
    wobble.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = options.tremolo;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(wobble.gain);
    node = node.connect(wobble);
    lfo.start(t);
    lfo.stop(t + options.duration + 0.05);
  }
  node.connect(envelope(ctx, out, t, options.peak, options.duration, options.attack ?? 0.005));
  oscillator.start(t);
  oscillator.stop(t + options.duration + 0.05);
}

interface NoiseOptions {
  readonly duration: number;
  readonly peak: number;
  readonly filter: BiquadFilterType;
  /** Filter frequency at the start and at the end. */
  readonly from: number;
  readonly to: number;
  readonly q?: number;
  readonly attack?: number;
}

function noiseBurst(ctx: AudioContext, out: AudioNode, t: number, options: NoiseOptions): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.Q.value = options.q ?? 0.7;
  filter.frequency.setValueAtTime(options.from, t);
  filter.frequency.exponentialRampToValueAtTime(options.to, t + options.duration);
  source
    .connect(filter)
    .connect(envelope(ctx, out, t, options.peak, options.duration, options.attack ?? 0.003));
  // start somewhere in the buffer so that no two bursts are the same noise
  source.start(t, Math.random() * 0.5);
  source.stop(t + options.duration + 0.05);
}

/** Gain that rises to `peak` and decays exponentially; disconnects itself when done. */
function envelope(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  peak: number,
  duration: number,
  attack: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(out);
  return gain;
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

/** One second of white noise per context, shared by every burst. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A random factor around 1, e.g. vary(0.1) is between 0.95 and 1.05. */
function vary(amount: number): number {
  return 1 + (Math.random() - 0.5) * amount;
}
