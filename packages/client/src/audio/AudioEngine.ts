import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../persistence/SaveRepository';
import { EFFECTS, type SoundEffect } from './effects';
import { MusicPlayer, type MusicScene } from './MusicPlayer';

/** Seconds for volume changes, so sliders and muting do not click. */
const VOLUME_SECONDS = 0.05;
/** A short, dark space reverb under the effects: they sound like they happen somewhere, not in a box. */
const EFFECTS_REVERB = { seconds: 1.3, falloff: 3.2, send: 0.2, cutoff: 3500 } as const;

interface Output {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly music: GainNode;
  /** Under the music volume: pulled down while an alarm sounds. */
  readonly duck: GainNode;
  /** Under the duck: silences the soundtrack while other music plays (Ultra Instinct). */
  readonly hold: GainNode;
  readonly effects: GainNode;
  readonly musicPlayer: MusicPlayer;
}

/**
 * All sound of the game: a music bus and an effects bus under a master volume. Browsers only allow audio
 * after a user gesture, so nothing is created before unlock(); settings and the music scene given before
 * that are applied then.
 */
export class AudioEngine {
  private output: Output | null = null;
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
  private scene: MusicScene | null = null;
  private intensity = 0;
  private readonly voices = new Map<SoundEffect, { active: number; lastStartMs: number }>();

  unlock(): void {
    if (!this.output) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      const music = ctx.createGain();
      const duck = ctx.createGain();
      const hold = ctx.createGain();
      const effects = ctx.createGain();
      music.connect(duck).connect(hold).connect(master);
      effects.connect(master);
      connectEffectsReverb(ctx, effects, master);
      // a limiter: loud moments (music and several explosions at full volume) are held below clipping
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      master.connect(limiter).connect(ctx.destination);
      this.output = {
        ctx,
        master,
        music,
        duck,
        hold,
        effects,
        musicPlayer: new MusicPlayer(ctx, music),
      };
      this.applySettings(this.settings);
      this.output.musicPlayer.setScene(this.scene);
      this.output.musicPlayer.setIntensity(this.intensity);
    }
    if (this.output.ctx.state === 'suspended') void this.output.ctx.resume();
  }

  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.output) return;
    const { ctx, master, music, effects } = this.output;
    master.gain.setTargetAtTime(settings.muted ? 0 : 1, ctx.currentTime, VOLUME_SECONDS);
    music.gain.setTargetAtTime(settings.musicVolume, ctx.currentTime, VOLUME_SECONDS);
    effects.gain.setTargetAtTime(settings.effectsVolume, ctx.currentTime, VOLUME_SECONDS);
  }

  setMusicScene(scene: MusicScene | null): void {
    this.scene = scene;
    this.output?.musicPlayer.setScene(scene);
  }

  /** Pulls the music down to `level` (0 to 1) for `seconds`, then lets it back up: an alarm cuts through. */
  duckMusic(level: number, seconds: number): void {
    if (!this.output) return;
    const { ctx, duck } = this.output;
    const now = ctx.currentTime;
    duck.gain.cancelScheduledValues(now);
    duck.gain.setTargetAtTime(level, now, 0.04);
    duck.gain.setTargetAtTime(1, now + seconds, 0.5);
  }

  /** Fades the soundtrack out while other music plays (true), and back in (false). */
  holdMusic(held: boolean): void {
    if (!this.output) return;
    const { ctx, hold } = this.output;
    const now = ctx.currentTime;
    hold.gain.cancelScheduledValues(now);
    hold.gain.setTargetAtTime(held ? 0 : 1, now, held ? 0.15 : 0.6);
  }

  /** The volume music should play at, 0 to 1: the music volume, 0 when muted. For music outside the engine. */
  get musicLevel(): number {
    return this.settings.muted ? 0 : this.settings.musicVolume;
  }

  /** 0: calm, 1: battle. */
  setIntensity(intensity: number): void {
    if (intensity === this.intensity) return;
    this.intensity = intensity;
    this.output?.musicPlayer.setIntensity(intensity);
  }

  /** pan: -1 (left) to 1 (right). */
  play(effect: SoundEffect, pan = 0): void {
    if (!this.output || this.settings.muted || this.settings.effectsVolume === 0) return;
    const definition = EFFECTS[effect];
    const voices = this.voices.get(effect) ?? { active: 0, lastStartMs: Number.NEGATIVE_INFINITY };
    const now = performance.now();
    if (voices.active >= definition.maxVoices || now - voices.lastStartMs < definition.minIntervalMs) return;

    const { ctx, effects } = this.output;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.min(1, Math.max(-1, pan));
    panner.connect(effects);
    const seconds = definition.play(ctx, panner, ctx.currentTime);

    voices.active += 1;
    voices.lastStartMs = now;
    this.voices.set(effect, voices);
    window.setTimeout(
      () => {
        voices.active -= 1;
        panner.disconnect();
      },
      (seconds + 0.1) * 1000,
    );
  }
}

/** The effects' reverb send, from `from` to `to`: a dark synthetic impulse response (stereo noise that decays). */
function connectEffectsReverb(ctx: AudioContext, from: AudioNode, to: AudioNode): void {
  const { seconds, falloff, send, cutoff } = EFFECTS_REVERB;
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** falloff;
  }
  const input = ctx.createGain();
  input.gain.value = send;
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  const dark = ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = cutoff;
  from.connect(input).connect(convolver).connect(dark).connect(to);
}
