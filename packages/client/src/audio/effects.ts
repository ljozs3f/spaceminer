import type { RenderedSound } from './rendered';
import { playRendered } from './soundBank';

/**
 * The sound effects. Weapons, explosions, the wave alarm and the warp jumps are rendered sample by sample
 * (rendered.ts, played from soundBank.ts); the rest is synthesized with the Web Audio API on every play,
 * built like foley rather than like arcade beeps: layers of filtered noise for the physical part, a short low
 * thump for the weight, and only a little pitched tone. Everything goes through a short space reverb
 * (AudioEngine).
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
  | 'placeRepair'
  | 'droneLaunch'
  | 'repairWeld'
  | 'upgrade'
  | 'sell'
  | 'error'
  | 'pirateShot'
  | 'pirateCannon'
  | 'notify'
  | 'warning'
  | 'countdown'
  | 'waveAlarm'
  | 'warpIn'
  | 'warpOut'
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
  // an energy weapon: an electrical crack, a buzzing discharge sweeping down, a thump, ionized air
  laser: { maxVoices: 6, minIntervalMs: 45, play: rendered('laser') },
  // the ejection pop, then a fizzing motor roar that darkens and drops as the missile flies off
  missileLaunch: { maxVoices: 5, minIntervalMs: 60, play: rendered('missileLaunch') },
  // explosions: crack, boom, sub, rolling rumble, crackling debris, shrapnel, secondary blasts
  missileImpact: { maxVoices: 4, minIntervalMs: 60, play: rendered('missileImpact') },
  explosionSmall: { maxVoices: 5, minIntervalMs: 40, play: rendered('explosionSmall') },
  explosionMedium: { maxVoices: 4, minIntervalMs: 60, play: rendered('explosionMedium') },
  explosionLarge: { maxVoices: 3, minIntervalMs: 100, play: rendered('explosionLarge') },
  // a big blast, the steel groaning and creaking, then the collapse
  buildingDestroyed: { maxVoices: 3, minIntervalMs: 120, play: rendered('buildingDestroyed') },
  // building something: a heavy set-down, then what the building does when it starts
  placeMine: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      setDown(ctx, out, t, 0.9);
      // the drills spinning up
      noiseBurst(ctx, out, t + 0.15, {
        duration: 0.7,
        peak: 0.05,
        filter: 'bandpass',
        from: 300,
        to: 900,
        q: 3,
        attack: 0.25,
        tremolo: 24,
      });
      tone(ctx, out, t + 0.15, {
        wave: 'sawtooth',
        from: 45,
        to: 110,
        duration: 0.7,
        peak: 0.035,
        attack: 0.3,
        lowpass: 500,
        tremolo: 24,
      });
      return 0.9;
    },
  },
  placeSolar: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      setDown(ctx, out, t, 0.6);
      // the panels unfolding with a soft swish each, then a quiet hum of power
      for (const at of [0.12, 0.22, 0.32]) {
        noiseBurst(ctx, out, t + at, {
          duration: 0.09,
          peak: 0.035,
          filter: 'bandpass',
          from: 1800,
          to: 3500,
          q: 2,
          attack: 0.03,
        });
        metal(ctx, out, t + at + 0.08, 900, 0.012);
      }
      tone(ctx, out, t + 0.35, {
        wave: 'sawtooth',
        from: 98,
        to: 98,
        duration: 0.7,
        peak: 0.025,
        attack: 0.2,
        lowpass: 420,
      });
      return 1.05;
    },
  },
  placeLaser: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      setDown(ctx, out, t, 0.7);
      // the turret turning on its servo, the capacitors charging up, the lock
      noiseBurst(ctx, out, t + 0.1, {
        duration: 0.3,
        peak: 0.04,
        filter: 'bandpass',
        from: 700,
        to: 1400,
        q: 8,
        attack: 0.05,
      });
      noiseBurst(ctx, out, t + 0.25, {
        duration: 0.35,
        peak: 0.035,
        filter: 'bandpass',
        from: 1500,
        to: 6000,
        q: 4,
        attack: 0.3,
      });
      metal(ctx, out, t + 0.6, 1100, 0.03);
      return 0.85;
    },
  },
  placeMissile: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      setDown(ctx, out, t, 1);
      // two heavy clamps and the hiss of hydraulics
      for (const at of [0.2, 0.5]) {
        metal(ctx, out, t + at, 300, 0.03);
        noiseBurst(ctx, out, t + at, { duration: 0.08, peak: 0.1, filter: 'lowpass', from: 500, to: 90 });
      }
      noiseBurst(ctx, out, t + 0.25, {
        duration: 0.35,
        peak: 0.045,
        filter: 'highpass',
        from: 3500,
        to: 6000,
        attack: 0.03,
      });
      return 0.8;
    },
  },
  placeRepair: {
    maxVoices: 2,
    minIntervalMs: 80,
    play: (ctx, out, t) => {
      setDown(ctx, out, t, 0.7);
      // the bay doors, then the drones' rotors spinning up
      noiseBurst(ctx, out, t + 0.12, {
        duration: 0.2,
        peak: 0.04,
        filter: 'highpass',
        from: 3000,
        to: 4500,
        attack: 0.02,
      });
      rotor(ctx, out, t + 0.3, 0.6, 0.04);
      return 0.95;
    },
  },
  // a drone lifting off its hive: a short rotor whirr
  droneLaunch: {
    maxVoices: 3,
    minIntervalMs: 120,
    play: (ctx, out, t) => {
      rotor(ctx, out, t, 0.35, 0.025);
      return 0.4;
    },
  },
  // the drones at work: a few welding crackles and a faint electric buzz
  repairWeld: {
    maxVoices: 2,
    minIntervalMs: 250,
    play: (ctx, out, t) => {
      for (let i = 0; i < 6; i++) {
        noiseBurst(ctx, out, t + Math.random() * 0.3, {
          duration: 0.006 + Math.random() * 0.01,
          peak: 0.025 + Math.random() * 0.02,
          filter: 'highpass',
          from: 3500 + Math.random() * 3000,
          to: 3000,
        });
      }
      tone(ctx, out, t, {
        wave: 'sawtooth',
        from: 118,
        to: 122,
        duration: 0.3,
        peak: 0.01,
        attack: 0.05,
        lowpass: 1600,
        tremolo: 50,
      });
      return 0.35;
    },
  },
  // more power: air rushing in, a low swell, then the new parts locking in place
  upgrade: {
    maxVoices: 2,
    minIntervalMs: 50,
    play: (ctx, out, t) => {
      noiseBurst(ctx, out, t, {
        duration: 0.45,
        peak: 0.06,
        filter: 'bandpass',
        from: 300,
        to: 5000,
        q: 2,
        attack: 0.35,
      });
      tone(ctx, out, t, { wave: 'sine', from: 55, to: 110, duration: 0.5, peak: 0.1, attack: 0.3 });
      setDown(ctx, out, t + 0.42, 0.8);
      metal(ctx, out, t + 0.46, 700, 0.03);
      metal(ctx, out, t + 0.56, 1000, 0.02);
      return 1;
    },
  },
  // the building taken apart: a falling whoosh and a soft thud
  sell: {
    maxVoices: 2,
    minIntervalMs: 50,
    play: (ctx, out, t) => {
      noiseBurst(ctx, out, t, {
        duration: 0.35,
        peak: 0.05,
        filter: 'bandpass',
        from: 4500,
        to: 400,
        q: 2,
      });
      metal(ctx, out, t + 0.05, 600, 0.02);
      tone(ctx, out, t + 0.25, { wave: 'sine', from: 110, to: 60, duration: 0.15, peak: 0.08 });
      return 0.42;
    },
  },
  // a muted double knock, not a buzzer
  error: {
    maxVoices: 1,
    minIntervalMs: 150,
    play: (ctx, out, t) => {
      for (const at of [0, 0.09]) {
        tone(ctx, out, t + at, { wave: 'sine', from: 180, to: 120, duration: 0.07, peak: 0.09 });
        noiseBurst(ctx, out, t + at, {
          duration: 0.025,
          peak: 0.035,
          filter: 'lowpass',
          from: 1200,
          to: 500,
        });
      }
      return 0.18;
    },
  },
  // pirate guns: a dirtier, lower discharge with a growl; the dreadnought's cannon is the same, much lower
  pirateShot: { maxVoices: 5, minIntervalMs: 60, play: rendered('pirateShot') },
  pirateCannon: { maxVoices: 3, minIntervalMs: 120, play: rendered('pirateShot', 0.68) },
  // discreet: a wave on its way; two short, soft radio blips
  notify: {
    maxVoices: 1,
    minIntervalMs: 500,
    play: (ctx, out, t) => {
      for (const at of [0, 0.11]) {
        tone(ctx, out, t + at, {
          wave: 'triangle',
          from: 1046.5,
          to: 1046.5,
          duration: 0.07,
          peak: 0.03,
          lowpass: 2200,
        });
      }
      noiseBurst(ctx, out, t, { duration: 0.2, peak: 0.008, filter: 'bandpass', from: 2500, to: 2500, q: 2 });
      return 0.3;
    },
  },
  // something needs attention: low energy, an attack; two low, filtered pulses
  warning: {
    maxVoices: 1,
    minIntervalMs: 500,
    play: (ctx, out, t) => {
      for (const at of [0, 0.2]) {
        tone(ctx, out, t + at, {
          wave: 'sawtooth',
          from: 233,
          to: 220,
          duration: 0.16,
          peak: 0.06,
          attack: 0.01,
          lowpass: 800,
        });
        tone(ctx, out, t + at, { wave: 'sine', from: 116.5, to: 110, duration: 0.16, peak: 0.07 });
      }
      return 0.4;
    },
  },
  // the last seconds before a wave: a sonar ping
  countdown: {
    maxVoices: 1,
    minIntervalMs: 400,
    play: (ctx, out, t) => {
      tone(ctx, out, t, { wave: 'sine', from: 1318.5, to: 1318.5, duration: 0.35, peak: 0.05 });
      tone(ctx, out, t, { wave: 'sine', from: 2637, to: 2637, duration: 0.12, peak: 0.012 });
      return 0.4;
    },
  },
  // battle stations: a cinematic impact under a two-tone klaxon
  waveAlarm: { maxVoices: 1, minIntervalMs: 1000, play: rendered('waveAlarm') },
  // the intro and the sector loading: spooling up for the jump, and dropping out of it
  warpIn: { maxVoices: 1, minIntervalMs: 500, play: rendered('warpIn') },
  warpOut: { maxVoices: 1, minIntervalMs: 500, play: rendered('warpOut') },
  won: {
    maxVoices: 1,
    minIntervalMs: 1000,
    play: (ctx, out, t) => {
      // a wide major-ninth chord blooming, with a soft rising shimmer
      horn(ctx, out, t, [146.8, 220, 293.7, 370, 440, 659.3], 3.2, 0.035, 2600);
      noiseBurst(ctx, out, t, {
        duration: 2.5,
        peak: 0.025,
        filter: 'bandpass',
        from: 2000,
        to: 8000,
        q: 3,
        attack: 1.2,
      });
      return 3.3;
    },
  },
  lost: {
    maxVoices: 1,
    minIntervalMs: 1000,
    play: (ctx, out, t) => {
      horn(ctx, out, t, [73.4, 87.3, 110], 2.4, 0.06, 700);
      groan(ctx, out, t, 2, 0.04);
      noiseBurst(ctx, out, t, { duration: 2.2, peak: 0.08, filter: 'lowpass', from: 500, to: 50 });
      return 2.4;
    },
  },
};

/** Plays a rendered sound (soundBank.ts), optionally at another pitch. */
function rendered(sound: RenderedSound, rate = 1): EffectDefinition['play'] {
  return (ctx, out, t) => playRendered(ctx, out, t, sound, rate);
}

/** Something heavy set down: a low thud and a short knock of metal. `weight` about 0.5 to 1. */
function setDown(ctx: AudioContext, out: AudioNode, t: number, weight: number): void {
  noiseBurst(ctx, out, t, { duration: 0.12, peak: 0.14 * weight, filter: 'lowpass', from: 700, to: 90 });
  tone(ctx, out, t, { wave: 'sine', from: 110, to: 52, duration: 0.16, peak: 0.16 * weight });
  metal(ctx, out, t + 0.01, 420 * vary(0.1), 0.02 * weight);
}

/** A short metallic clank: inharmonic partials that ring briefly. */
function metal(ctx: AudioContext, out: AudioNode, t: number, base: number, peak: number): void {
  for (const [ratio, level, length] of [
    [1, 1, 0.22],
    [2.41, 0.6, 0.14],
    [3.87, 0.4, 0.09],
    [5.93, 0.25, 0.06],
  ] as const) {
    tone(ctx, out, t, {
      wave: 'sine',
      from: base * ratio,
      to: base * ratio * 0.995,
      duration: length,
      peak: peak * level,
    });
  }
}

/** Rotors spinning up: band-limited noise chopped by the blades, rising in pitch. */
function rotor(ctx: AudioContext, out: AudioNode, t: number, duration: number, peak: number): void {
  noiseBurst(ctx, out, t, {
    duration,
    peak,
    filter: 'bandpass',
    from: 700,
    to: 1600,
    q: 3,
    attack: duration * 0.4,
    tremolo: 55,
  });
}

/** A metal structure groaning: detuned low saws sagging in pitch through a dark filter. */
function groan(ctx: AudioContext, out: AudioNode, t: number, duration: number, peak: number): void {
  for (const [from, to] of [
    [110, 52],
    [116, 49],
  ] as const) {
    tone(ctx, out, t, { wave: 'sawtooth', from, to, duration, peak, attack: 0.1, lowpass: 380 });
  }
}

/** Detuned sawtooth chord through a lowpass that opens and closes: a brassy, cinematic swell. */
function horn(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  frequencies: readonly number[],
  duration: number,
  peak: number,
  brightness = 1400,
): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(150, t);
  filter.frequency.exponentialRampToValueAtTime(brightness, t + duration * 0.3);
  filter.frequency.exponentialRampToValueAtTime(200, t + duration);
  filter.connect(envelope(ctx, out, t, peak, duration, duration * 0.25));
  for (const frequency of frequencies) {
    for (const cents of [-9, 9]) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = cents;
      oscillator.connect(filter);
      oscillator.start(t);
      oscillator.stop(t + duration + 0.05);
    }
  }
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
  /** Hz of a volume chop (rotor blades, a drill). */
  readonly tremolo?: number;
}

function noiseBurst(ctx: AudioContext, out: AudioNode, t: number, options: NoiseOptions): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.Q.value = options.q ?? 0.7;
  filter.frequency.setValueAtTime(options.from, t);
  filter.frequency.exponentialRampToValueAtTime(options.to, t + options.duration);
  let node: AudioNode = source.connect(filter);
  if (options.tremolo !== undefined) {
    const chop = ctx.createGain();
    chop.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = options.tremolo;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(chop.gain);
    node = node.connect(chop);
    lfo.start(t);
    lfo.stop(t + options.duration + 0.05);
  }
  node.connect(envelope(ctx, out, t, options.peak, options.duration, options.attack ?? 0.003));
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
