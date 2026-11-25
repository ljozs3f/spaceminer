/**
 * The weapon, explosion, alarm and warp sounds, rendered sample by sample into buffers instead of being
 * patched together from oscillators: that is what lets them sound recorded rather than synthesized. Each is
 * layered like a sound designer's library sound:
 *
 * - explosions: a clipped crack (the pressure front), a boom whose lowpass closes as the fireball cools, a
 *   sub-bass pressure wave, a rolling rumble that lingers differently in each ear, debris crackling and
 *   thinning out, shrapnel pinging off hulls (modal metal), secondary detonations for the big ones and the
 *   groan and collapse of a structure for buildings;
 * - energy weapons: a sharp electrical crack, a discharge whose resonance sweeps down and buzzes with the
 *   mains hum of the capacitor, only a hint of a dispersive "zing", a low thump and the hiss of ionized air;
 * - the wave alarm: a cinematic impact under a two-tone battle-stations klaxon (a horn formant, overdriven).
 *
 * Every sound is rendered in a few variants per audio context (in idle time after the audio starts) and
 * played back at a slightly random pitch, so a battle never repeats one sample. Pure DSP without DOM types,
 * so the renders can be checked outside the browser too.
 */

export type RenderedSound =
  | 'laser'
  | 'pirateShot'
  | 'missileLaunch'
  | 'missileImpact'
  | 'explosionSmall'
  | 'explosionMedium'
  | 'explosionLarge'
  | 'buildingDestroyed'
  | 'waveAlarm'
  | 'warpIn'
  | 'warpOut';

export const RENDERED_SOUNDS: readonly RenderedSound[] = [
  'laser',
  'pirateShot',
  'missileLaunch',
  'missileImpact',
  'explosionSmall',
  'explosionMedium',
  'explosionLarge',
  'buildingDestroyed',
  'waveAlarm',
  'warpIn',
  'warpOut',
];

/** A rendered stereo sound. */
export interface Render {
  readonly sampleRate: number;
  readonly left: Float32Array<ArrayBuffer>;
  readonly right: Float32Array<ArrayBuffer>;
}

interface Recipe {
  readonly seconds: number;
  /** Peak level the render is normalized to. */
  readonly peak: number;
  readonly render: (mix: Mix) => void;
}

const TWO_PI = Math.PI * 2;

/** Renders one variant of a sound (every call differs a little). */
export function renderSound(sound: RenderedSound, sampleRate: number): Render {
  const recipe = RECIPES[sound];
  const mix = new Mix(sampleRate, recipe.seconds);
  recipe.render(mix);
  mix.finish(recipe.peak);
  return { sampleRate, left: mix.left, right: mix.right };
}

const RECIPES: Readonly<Record<RenderedSound, Recipe>> = {
  laser: {
    seconds: 0.36,
    peak: 0.2,
    render: (mix) => {
      energyShot(mix, LASER);
    },
  },
  pirateShot: {
    seconds: 0.42,
    peak: 0.19,
    render: (mix) => {
      energyShot(mix, PIRATE_GUN);
    },
  },
  missileLaunch: { seconds: 1.3, peak: 0.27, render: missileLaunch },
  missileImpact: {
    seconds: 1.4,
    peak: 0.38,
    render: (mix) => {
      blast(mix, {
        size: 0.6,
        crack: 1.4,
        brightness: 5200,
        tail: 0.32,
        debris: 1.2,
        metal: 0,
        secondaries: 0,
      });
    },
  },
  explosionSmall: {
    seconds: 1.5,
    peak: 0.4,
    render: (mix) => {
      blast(mix, { size: 0.5, crack: 1.1, brightness: 4200, tail: 0.3, debris: 1, metal: 3, secondaries: 0 });
    },
  },
  explosionMedium: {
    seconds: 2.2,
    peak: 0.52,
    render: (mix) => {
      blast(mix, { size: 0.9, crack: 1, brightness: 3400, tail: 0.5, debris: 1.1, metal: 4, secondaries: 1 });
    },
  },
  explosionLarge: {
    seconds: 3.2,
    peak: 0.64,
    render: (mix) => {
      blast(mix, {
        size: 1.35,
        crack: 1,
        brightness: 2800,
        tail: 0.85,
        debris: 1.2,
        metal: 6,
        secondaries: 3,
      });
    },
  },
  buildingDestroyed: {
    seconds: 3.6,
    peak: 0.68,
    render: (mix) => {
      blast(mix, {
        size: 1.5,
        crack: 1.1,
        brightness: 2600,
        tail: 0.9,
        debris: 1.4,
        metal: 9,
        secondaries: 2,
      });
      structureCollapse(mix);
    },
  },
  waveAlarm: { seconds: 2.9, peak: 0.55, render: waveAlarm },
  warpIn: { seconds: 2.8, peak: 0.5, render: warpIn },
  warpOut: { seconds: 2.2, peak: 0.55, render: warpOut },
};

// ---------------------------------------------------------------------------------------------------------
// energy weapons

interface ShotStyle {
  /** Highpass of the crack (Hz) and how fast it dies (s). */
  readonly crackCut: number;
  readonly crackTime: number;
  /** The discharge resonance sweeps from top + bottom down to bottom (Hz). */
  readonly sweepTop: number;
  readonly sweepBottom: number;
  readonly sweepTime: number;
  readonly resonance: number;
  readonly dischargeTime: number;
  /** The capacitor's hum (Hz) and how much it chops the discharge (0 to 1). */
  readonly buzz: number;
  readonly buzzDepth: number;
  /** A low sawtooth growl under the discharge (pirate guns). */
  readonly growl: number;
  /** Level of the dispersive zing. */
  readonly zing: number;
  readonly thumpFrom: number;
  readonly thumpTo: number;
  readonly drive: number;
  /** Band of the hissing air tail (Hz). */
  readonly air: number;
}

const LASER: ShotStyle = {
  crackCut: 2500,
  crackTime: 0.0011,
  sweepTop: 4200,
  sweepBottom: 1300,
  sweepTime: 0.03,
  resonance: 3.5,
  dischargeTime: 0.032,
  buzz: 115,
  buzzDepth: 0.45,
  growl: 0,
  zing: 0.12,
  thumpFrom: 160,
  thumpTo: 50,
  drive: 1.8,
  air: 3200,
};

const PIRATE_GUN: ShotStyle = {
  crackCut: 1100,
  crackTime: 0.0017,
  sweepTop: 2600,
  sweepBottom: 520,
  sweepTime: 0.045,
  resonance: 2.2,
  dischargeTime: 0.05,
  buzz: 72,
  buzzDepth: 0.6,
  growl: 0.32,
  zing: 0.04,
  thumpFrom: 130,
  thumpTo: 42,
  drive: 2.6,
  air: 1100,
};

function energyShot(mix: Mix, style: ShotStyle): void {
  const { sampleRate: sr } = mix;
  const pitch = vary(0.2);
  const buzzHz = style.buzz * vary(0.3);
  const crackFilter = new OnePole(sr);
  const discharge = new Svf(sr);
  const growlFilter = new OnePole(sr);
  const airLeft = new Svf(sr);
  const airRight = new Svf(sr);
  const growl = new Saw(sr);
  let zing = 0;
  let thump = 0;
  for (let i = 0; i < mix.length; i++) {
    const t = i / sr;
    const crack =
      t < 0.02 ? crackFilter.highpass(white(), style.crackCut) * Math.exp(-t / style.crackTime) * 1.3 : 0;

    discharge.process(
      white(),
      (style.sweepBottom + style.sweepTop * Math.exp(-t / style.sweepTime)) * pitch,
      style.resonance,
    );
    const hum = 1 - style.buzzDepth + style.buzzDepth * (Math.sin(TWO_PI * buzzHz * t) > 0 ? 1 : 0);
    const dischargeLevel = rise(t, 0.0008) * Math.exp(-t / style.dischargeTime);
    const body = discharge.band * hum * dischargeLevel;

    const growlLevel = rise(t, 0.002) * Math.exp(-t / (style.dischargeTime * 1.2)) * style.growl;
    const growlValue =
      style.growl > 0 ? growlFilter.lowpass(growl.next(style.thumpTo * 1.6 * pitch), 900) * growlLevel : 0;

    // a dispersive chirp, as from a struck cable: the highs arrive first; kept faint
    const zingHz = (700 + 3600 * Math.exp(-t / 0.018)) * pitch;
    zing += zingHz / sr;
    const zingValue =
      (Math.sin(TWO_PI * zing) + 0.5 * Math.sin(TWO_PI * zing * 1.47)) * Math.exp(-t / 0.045) * style.zing;

    thump += (style.thumpTo + (style.thumpFrom - style.thumpTo) * Math.exp(-t / 0.016)) / sr;
    const thumpValue = Math.sin(TWO_PI * thump) * rise(t, 0.002) * Math.exp(-t / 0.04) * 0.6;

    const core = Math.tanh((crack + body + growlValue + zingValue + thumpValue) * style.drive) * 0.75;
    const airLevel = rise(t, 0.003) * Math.exp(-t / 0.075) * 0.18;
    airLeft.process(white(), style.air, 0.9);
    airRight.process(white(), style.air, 0.9);
    mix.addStereo(i, core + airLeft.band * airLevel, core + airRight.band * airLevel);
  }
}

// ---------------------------------------------------------------------------------------------------------
// missiles

function missileLaunch(mix: Mix): void {
  const { sampleRate: sr } = mix;
  const click = new OnePole(sr);
  const roar = new Svf(sr);
  const pink = new Pink();
  const rumble = new OnePole(sr);
  const brown = new Brown();
  const whooshLeft = new Svf(sr);
  const whooshRight = new Svf(sr);
  const fizz = new Crackle(sr);
  const ignition = 0.025;
  const drop = vary(0.25);
  let pop = 0;
  for (let i = 0; i < mix.length; i++) {
    const t = i / sr;
    // the ejection charge: a dull pop and a click of the latch
    pop += (55 + 150 * Math.exp(-t / 0.012)) / sr;
    const popValue =
      Math.sin(TWO_PI * pop) * rise(t, 0.001) * Math.exp(-t / 0.04) * 0.8 +
      (t < 0.01 ? click.highpass(white(), 2000) * Math.exp(-t / 0.0008) * 0.7 : 0);

    // the motor: a roar that fizzes and crackles, darkening and dropping (doppler) as it flies off
    const m = Math.max(0, t - ignition);
    const motor = t < ignition ? 0 : rise(m, 0.06) * Math.exp(-m / 0.45);
    fizz.next(700);
    const fizzing = 0.6 + 0.4 * Math.min(1, Math.abs(fizz.left + fizz.right) * 3);
    roar.process(pink.next() * 2.5, (700 + 2300 * Math.exp(-m / 0.5)) * drop, 0.7);
    const roarValue = roar.low * motor * fizzing;
    const rumbleValue = rumble.lowpass(brown.next(), 180) * motor * 0.8;
    const whooshHz = (400 + 2400 * Math.exp(-m / 0.6)) * drop;
    whooshLeft.process(white(), whooshHz, 1.2);
    whooshRight.process(white(), whooshHz * 1.06, 1.2);
    const whooshLevel = motor * 0.5;

    const core = Math.tanh((popValue + roarValue + rumbleValue) * 1.5);
    mix.addStereo(i, core + whooshLeft.band * whooshLevel, core + whooshRight.band * whooshLevel);
  }
}

// ---------------------------------------------------------------------------------------------------------
// explosions

interface Blast {
  /** About 0.5 (a raider) to 1.6 (a building): length, depth and weight. */
  readonly size: number;
  /** Level of the initial crack. */
  readonly crack: number;
  /** Where the lowpass of the boom starts (Hz): brighter is closer and sharper. */
  readonly brightness: number;
  /** Time constant of the rumbling tail (s). */
  readonly tail: number;
  /** Density of the debris crackle. */
  readonly debris: number;
  /** Shrapnel pings. */
  readonly metal: number;
  /** Smaller detonations following the first one. */
  readonly secondaries: number;
}

function blast(mix: Mix, spec: Blast, start = 0, gain = 1): void {
  const { sampleRate: sr } = mix;
  const size = spec.size * vary(0.15);
  const pink = new Pink();
  const brownLeft = new Brown();
  const brownRight = new Brown();
  const crackFilter = new OnePole(sr);
  const boom = new Svf(sr);
  const tailLeft = new Svf(sr);
  const tailRight = new Svf(sr);
  const roll = new SmoothNoise(sr, 7);
  const debris = new Crackle(sr);
  const pan = (Math.random() - 0.5) * 0.3;
  const panLeft = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const panRight = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const fast = 0.07 * size;
  const slow = 0.32 * size;
  const tail = spec.tail * vary(0.2);
  const first = Math.floor(start * sr);
  const last = Math.min(mix.length, first + Math.floor((0.2 + 6 * Math.max(slow, tail)) * sr));
  let sub = 0;
  for (let i = first; i < last; i++) {
    const t = (i - first) / sr;
    // the pressure front: an instant of broadband noise, clipped hard below
    const crack = t < 0.03 ? crackFilter.highpass(white(), 450) * Math.exp(-t / 0.0025) * spec.crack : 0;
    // the boom: pink noise behind a lowpass that closes as the fireball cools
    boom.process(pink.next() * 3, 110 + spec.brightness * Math.exp(-t / (0.05 + 0.05 * size)), 0.8);
    const boomValue = boom.low * rise(t, 0.0015) * (0.72 * Math.exp(-t / fast) + 0.28 * Math.exp(-t / slow));
    // the sub: the pressure wave felt in the chest
    sub += (26 + (60 / Math.sqrt(size)) * Math.exp(-t / (0.045 * size))) / sr;
    const subValue = Math.sin(TWO_PI * sub) * rise(t, 0.004) * Math.exp(-t / (0.16 * size)) * 0.9;
    // a rolling rumble that lingers, different in each ear
    const tailLevel = rise(t, 0.04) * Math.exp(-t / tail) * (0.6 + 0.4 * roll.next()) * 1.2;
    tailLeft.process(brownLeft.next(), 240, 0.7);
    tailRight.process(brownRight.next(), 240, 0.7);
    // debris crackling in the fire, thinning out
    debris.next(spec.debris * 260 * Math.exp(-t / (0.22 * size + 0.1)));

    const core = Math.tanh((crack + boomValue * 1.4 + subValue) * 1.6);
    mix.addStereo(
      i,
      (core * panLeft + tailLeft.low * tailLevel + debris.left * 0.6) * gain,
      (core * panRight + tailRight.low * tailLevel + debris.right * 0.6) * gain,
    );
  }
  // shrapnel pinging off hulls
  for (let k = 0; k < spec.metal; k++) {
    ping(
      mix,
      start + 0.04 + Math.random() * 0.55 * size,
      700 + Math.random() * 2600,
      (0.03 + Math.random() * 0.05) * gain,
      Math.random() * 1.6 - 0.8,
    );
  }
  for (let k = 0; k < spec.secondaries; k++) {
    const smaller: Blast = {
      size: spec.size * 0.45,
      crack: spec.crack * 0.7,
      brightness: spec.brightness * 1.2,
      tail: spec.tail * 0.45,
      debris: spec.debris * 0.6,
      metal: 1,
      secondaries: 0,
    };
    blast(mix, smaller, start + 0.14 + Math.random() * 0.6 * size, gain * (0.3 + Math.random() * 0.22));
  }
}

/** A structure giving way: steel groaning under strain, creaking, then the heavy thud of the collapse. */
function structureCollapse(mix: Mix): void {
  const { sampleRate: sr } = mix;
  const low = new Svf(sr);
  const mid = new Svf(sr);
  const creak = new Svf(sr);
  const thudFilter = new Svf(sr);
  const start = 0.12;
  const collapse = 0.95 + Math.random() * 0.25;
  const stick = 24 + Math.random() * 14;
  let thud = 0;
  for (let i = Math.floor(start * sr); i < mix.length; i++) {
    const t = i / sr - start;
    const strain = rise(t, 0.15) * Math.exp(-t / 0.55);
    const noise = white();
    low.process(noise, 175 - 60 * Math.min(1, t / 1.2), 14);
    mid.process(noise, 310 - 90 * Math.min(1, t / 1.2), 12);
    // stick-slip: the metal catches and lets go a few dozen times a second
    const slip = Math.max(0, Math.sin(TWO_PI * stick * t)) ** 8;
    creak.process(noise * slip, 720 - 160 * Math.min(1, t), 9);
    const groan = (low.band * 0.8 + mid.band * 0.6) * strain * 0.6 + creak.band * strain * 0.45;

    const c = t - (collapse - start);
    let thudValue = 0;
    if (c >= 0) {
      thud += (32 + 70 * Math.exp(-c / 0.03)) / sr;
      thudFilter.process(white(), 900 * Math.exp(-c / 0.08) + 120, 0.7);
      thudValue =
        (Math.sin(TWO_PI * thud) * 0.7 + thudFilter.low * 0.8) * rise(c, 0.003) * Math.exp(-c / 0.22) * 0.8;
    }
    const value = Math.tanh((groan + thudValue) * 1.4);
    mix.addStereo(i, value, value);
  }
}

/** A shard of metal ringing: inharmonic partials of a struck plate. */
function ping(mix: Mix, at: number, base: number, level: number, pan: number): void {
  const { sampleRate: sr } = mix;
  const first = Math.floor(at * sr);
  const damping = 0.6 + Math.random() * 0.8;
  const partials = [
    [1, 1, 0.09],
    [2.76, 0.55, 0.05],
    [5.4, 0.3, 0.03],
    [8.93, 0.15, 0.02],
  ] as const;
  const length = Math.min(mix.length - first, Math.floor(0.45 * sr));
  for (let n = 0; n < length; n++) {
    const t = n / sr;
    let value = 0;
    for (const [ratio, amplitude, decay] of partials) {
      value += amplitude * Math.exp(-t / (decay * damping)) * Math.sin(TWO_PI * base * ratio * t);
    }
    mix.add(first + n, value * level * rise(t, 0.0005), pan);
  }
}

// ---------------------------------------------------------------------------------------------------------
// alarm and warp

/** Battle stations: a cinematic impact, then three rising whoops of a horn klaxon, overdriven. */
function waveAlarm(mix: Mix): void {
  const { sampleRate: sr } = mix;
  const voiceHz = [41.2, 41.45, 61.7, 61.35, 82.4];
  const voices = voiceHz.map(() => new Saw(sr));
  const braam = new Svf(sr);
  const crackFilter = new OnePole(sr);
  const hit = new Svf(sr);
  const klaxon = new Square(sr);
  const klaxonSaw = new Saw(sr);
  const horn = new Svf(sr);
  const hornLow = new OnePole(sr);
  const whoops = [0.2, 0.92, 1.64];
  const whoopSeconds = 0.62;
  /** Haas delay of the right channel for the klaxon: wide without a second source. */
  const delay = Math.floor(0.009 * sr);
  let sub = 0;
  for (let i = 0; i < mix.length; i++) {
    const t = i / sr;
    // the impact: detuned low saws behind a lowpass that blooms and closes, a sub drop and a crack
    let saws = 0;
    voices.forEach((voice, v) => (saws += voice.next(voiceHz[v] ?? 41.2)));
    const bloom = t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) / 0.35);
    braam.process(saws * 0.3, 180 + 1600 * bloom, 1.1);
    const braamValue = braam.low * rise(t, 0.015) * Math.exp(-t / 0.9) * 0.7;
    sub += (30 + 55 * Math.exp(-t / 0.05)) / sr;
    const subValue = Math.sin(TWO_PI * sub) * rise(t, 0.003) * Math.exp(-t / 0.45) * 0.8;
    hit.process(white(), 1500, 0.7);
    const hitValue =
      (t < 0.03 ? crackFilter.highpass(white(), 400) * Math.exp(-t / 0.004) * 0.7 : 0) +
      hit.low * Math.exp(-t / 0.12) * 0.4;
    const impact = Math.tanh((braamValue + subValue + hitValue) * 1.3);
    mix.addStereo(i, impact, impact);

    // the klaxon
    const whoop = whoops.find((at) => t >= at && t < at + whoopSeconds);
    if (whoop === undefined) continue;
    const u = (t - whoop) / whoopSeconds;
    const hz = 330 * 2 ** ((1.15 * (1 - Math.exp(-u * 3))) / (1 - Math.exp(-3)));
    const raw = klaxon.next(hz) + 0.35 * klaxonSaw.next(hz);
    horn.process(raw, 1100, 1.6);
    const shaped = Math.tanh((horn.band * 0.65 + hornLow.lowpass(raw, 2600) * 0.4) * 2.2);
    const level = rise(t - whoop, 0.012) * (u > 0.92 ? Math.max(0, (1 - u) / 0.08) : 1) * 0.42;
    mix.add(i, shaped * level, -1);
    mix.add(i + delay, shaped * level, 1);
  }
}

/** Spooling up for the jump: a rising swell of air and engine, then the jump itself. */
function warpIn(mix: Mix): void {
  const { sampleRate: sr } = mix;
  const pink = new Pink();
  const swell = new Svf(sr);
  const engine = new Saw(sr);
  const engineFilter = new OnePole(sr);
  const crackFilter = new OnePole(sr);
  const bright = new Svf(sr);
  const jump = 2.12;
  let thump = 0;
  for (let i = 0; i < mix.length; i++) {
    const t = i / sr;
    const build = Math.min(1, t / jump);
    const cut = t < jump + 0.02 ? 1 : Math.exp(-(t - jump - 0.02) / 0.05);
    swell.process(pink.next() * 3, 150 * 30 ** (build ** 1.6), 2.2);
    const swellValue = swell.band * build ** 2.2 * cut;
    const engineValue =
      engineFilter.lowpass(engine.next(45 + 140 * build ** 2), 600) * build ** 2 * cut * 0.25;
    let jumpValue = 0;
    if (t >= jump) {
      const j = t - jump;
      thump += (35 + 120 * Math.exp(-j / 0.03)) / sr;
      bright.process(white(), 3000, 1);
      jumpValue =
        Math.sin(TWO_PI * thump) * rise(j, 0.003) * Math.exp(-j / 0.3) +
        crackFilter.highpass(white(), 600) * Math.exp(-j / 0.006) * 0.8 +
        bright.band * Math.exp(-j / 0.15) * 0.3;
    }
    const value = Math.tanh((swellValue + engineValue + jumpValue) * 1.3);
    mix.addStereo(i, value, value);
  }
}

/** Dropping out of the jump: a bright rush falling away, a deep thump and a rumble. */
function warpOut(mix: Mix): void {
  const { sampleRate: sr } = mix;
  const rushLeft = new Svf(sr);
  const rushRight = new Svf(sr);
  const brownLeft = new Brown();
  const brownRight = new Brown();
  const rumbleLeft = new OnePole(sr);
  const rumbleRight = new OnePole(sr);
  let thump = 0;
  for (let i = 0; i < mix.length; i++) {
    const t = i / sr;
    const rushHz = 150 + 5000 * Math.exp(-t / 0.18);
    rushLeft.process(white(), rushHz, 1.4);
    rushRight.process(white(), rushHz * 1.08, 1.4);
    const rushLevel = rise(t, 0.01) * Math.exp(-t / 0.35) * 0.9;
    thump += (30 + 70 * Math.exp(-t / 0.04)) / sr;
    const thumpValue = Math.tanh(Math.sin(TWO_PI * thump) * rise(t, 0.004) * Math.exp(-t / 0.5) * 1.2);
    const rumbleLevel = rise(t, 0.05) * Math.exp(-t / 0.6) * 0.5;
    mix.addStereo(
      i,
      thumpValue + rushLeft.band * rushLevel + rumbleLeft.lowpass(brownLeft.next(), 200) * rumbleLevel,
      thumpValue + rushRight.band * rushLevel + rumbleRight.lowpass(brownRight.next(), 200) * rumbleLevel,
    );
  }
}

// ---------------------------------------------------------------------------------------------------------
// building blocks

/** The stereo buffer a sound is rendered into. */
class Mix {
  readonly sampleRate: number;
  readonly length: number;
  readonly left: Float32Array<ArrayBuffer>;
  readonly right: Float32Array<ArrayBuffer>;

  constructor(sampleRate: number, seconds: number) {
    this.sampleRate = sampleRate;
    this.length = Math.ceil(sampleRate * seconds);
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
  }

  addStereo(i: number, left: number, right: number): void {
    if (i < 0 || i >= this.length) return;
    this.left[i] = (this.left[i] ?? 0) + left;
    this.right[i] = (this.right[i] ?? 0) + right;
  }

  /** pan: -1 (left) to 1 (right), equal power; 0 adds the full value to both sides. */
  add(i: number, value: number, pan: number): void {
    const angle = ((pan + 1) * Math.PI) / 4;
    this.addStereo(i, value * Math.cos(angle) * Math.SQRT2, value * Math.sin(angle) * Math.SQRT2);
  }

  /** Normalizes to `peak` and fades the last few milliseconds out, so nothing clicks. */
  finish(peak: number): void {
    let max = 0;
    for (let i = 0; i < this.length; i++) {
      max = Math.max(max, Math.abs(this.left[i] ?? 0), Math.abs(this.right[i] ?? 0));
    }
    const gain = max > 0 ? peak / max : 0;
    const fade = Math.floor(this.sampleRate * 0.03);
    for (let i = 0; i < this.length; i++) {
      const edge = Math.min(1, (this.length - 1 - i) / fade);
      this.left[i] = (this.left[i] ?? 0) * gain * edge;
      this.right[i] = (this.right[i] ?? 0) * gain * edge;
    }
  }
}

function white(): number {
  return Math.random() * 2 - 1;
}

/** 0 to 1 over `seconds`: an attack without a click. */
function rise(t: number, seconds: number): number {
  return t <= 0 ? 0 : Math.min(1, t / seconds);
}

/** A random factor around 1: vary(0.2) is between 0.9 and 1.1. */
function vary(amount: number): number {
  return 1 + (Math.random() - 0.5) * amount;
}

/** Pink noise (Paul Kellet's economy filter): the spectrum of wind, fire and roaring engines. */
class Pink {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;

  next(): number {
    const w = white();
    this.b0 = 0.99765 * this.b0 + w * 0.099046;
    this.b1 = 0.963 * this.b1 + w * 0.2965164;
    this.b2 = 0.57 * this.b2 + w * 1.0526913;
    return (this.b0 + this.b1 + this.b2 + w * 0.1848) * 0.25;
  }
}

/** Brown noise: deep rumble. */
class Brown {
  private y = 0;

  next(): number {
    this.y = (this.y + 0.02 * white()) / 1.02;
    return this.y * 3.5;
  }
}

/** Random values changing smoothly about `hz` times a second, 0 to 1. */
class SmoothNoise {
  private readonly hold: number;
  private count = 0;
  private target = Math.random();
  private value = this.target;
  private readonly coefficient: number;

  constructor(sampleRate: number, hz: number) {
    this.hold = Math.max(1, Math.floor(sampleRate / hz));
    this.coefficient = 1 - Math.exp((-TWO_PI * hz) / sampleRate);
  }

  next(): number {
    if (++this.count >= this.hold) {
      this.count = 0;
      this.target = Math.random();
    }
    this.value += this.coefficient * (this.target - this.value);
    return this.value;
  }
}

class OnePole {
  private y = 0;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  lowpass(x: number, cutoff: number): number {
    this.y += (1 - Math.exp((-TWO_PI * cutoff) / this.sampleRate)) * (x - this.y);
    return this.y;
  }

  highpass(x: number, cutoff: number): number {
    return x - this.lowpass(x, cutoff);
  }
}

/** A state variable filter (topology-preserving transform), stable under fast cutoff sweeps. */
class Svf {
  low = 0;
  /** Bandpass with unity gain at the center. */
  band = 0;
  high = 0;
  private ic1 = 0;
  private ic2 = 0;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  process(x: number, cutoff: number, q: number): void {
    const g = Math.tan((Math.PI * Math.min(cutoff, this.sampleRate * 0.45)) / this.sampleRate);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1 * k;
    this.high = x - k * v1 - v2;
  }
}

/** The PolyBLEP correction that keeps a hard edge of an oscillator from aliasing. */
function polyBlep(phase: number, step: number): number {
  if (phase < step) {
    const x = phase / step;
    return x + x - x * x - 1;
  }
  if (phase > 1 - step) {
    const x = (phase - 1) / step;
    return x * x + x + x + 1;
  }
  return 0;
}

class Saw {
  private phase = Math.random();
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  next(hz: number): number {
    const step = hz / this.sampleRate;
    this.phase = (this.phase + step) % 1;
    return 2 * this.phase - 1 - polyBlep(this.phase, step);
  }
}

class Square {
  private phase = 0;
  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  next(hz: number): number {
    const step = hz / this.sampleRate;
    this.phase = (this.phase + step) % 1;
    return (this.phase < 0.5 ? 1 : -1) + polyBlep(this.phase, step) - polyBlep((this.phase + 0.5) % 1, step);
  }
}

/** Short grains of noise popping up at a given rate, each somewhere in the stereo field. */
class Crackle {
  left = 0;
  right = 0;
  private readonly grains: { amplitude: number; decay: number; pan: number }[] = [];
  private readonly sampleRate: number;
  private readonly highLeft: OnePole;
  private readonly highRight: OnePole;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.highLeft = new OnePole(sampleRate);
    this.highRight = new OnePole(sampleRate);
  }

  /** rate: grains per second. */
  next(rate: number): void {
    if (this.grains.length < 12 && Math.random() < rate / this.sampleRate) {
      this.grains.push({
        amplitude: 0.15 + Math.random() ** 2 * 0.85,
        decay: Math.exp(-1 / (this.sampleRate * (0.0006 + Math.random() * 0.004))),
        pan: Math.random() * 2 - 1,
      });
    }
    let left = 0;
    let right = 0;
    for (let g = this.grains.length - 1; g >= 0; g--) {
      const grain = this.grains[g];
      if (!grain) continue;
      const value = white() * grain.amplitude;
      left += value * (1 - grain.pan) * 0.5;
      right += value * (1 + grain.pan) * 0.5;
      grain.amplitude *= grain.decay;
      if (grain.amplitude < 0.001) this.grains.splice(g, 1);
    }
    this.left = this.highLeft.highpass(left, 900);
    this.right = this.highRight.highpass(right, 900);
  }
}
