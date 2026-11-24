import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../persistence/SaveRepository';
import { EFFECTS, type SoundEffect } from './effects';
import { MusicPlayer, type MusicScene } from './MusicPlayer';

/** Seconds for volume changes, so sliders and muting do not click. */
const VOLUME_SECONDS = 0.05;

interface Output {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly music: GainNode;
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
      const effects = ctx.createGain();
      music.connect(master);
      effects.connect(master);
      // a limiter: loud moments (music and several explosions at full volume) are held below clipping
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      master.connect(limiter).connect(ctx.destination);
      this.output = { ctx, master, music, effects, musicPlayer: new MusicPlayer(ctx, music) };
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
