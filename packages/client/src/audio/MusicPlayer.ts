import type { Song } from './song';
import { BUILT_IN_SOUNDTRACK } from './songs';
import { SongPlayer } from './SongPlayer';

/** menu: the intro, the loading screens and the menu; game: in a sector. */
export type MusicScene = 'menu' | 'game';
type Track = 'loading' | 'game';

const SCENE_TRACKS: Readonly<Record<MusicScene, Track>> = { menu: 'loading', game: 'game' };

/**
 * The soundtrack is fixed: loading.* plays in the intro, the loading screens and the menu, game.* in game
 * (files in src/assets/music, picked up at build time; see the README there). Where a file is missing the
 * built-in soundtrack (songs/) plays instead.
 */
const FILES = import.meta.glob<string>('../assets/music/*.{ogg,mp3,m4a,flac,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function trackUrl(track: Track): string | undefined {
  const entry = Object.entries(FILES).find(([path]) => path.split('/').pop()?.split('.')[0] === track);
  return entry?.[1];
}

/** The bytes of the music files, fetched while the game loads (decoding needs the audio context). */
const prefetched = new Map<string, Promise<ArrayBuffer | null>>();

/** Fetches the music files ahead of time; resolves when they are in (or failed). */
export async function prefetchMusic(): Promise<void> {
  const urls = (['loading', 'game'] as const).map(trackUrl).filter((url): url is string => url !== undefined);
  await Promise.all(urls.map(fetchBytes));
}

function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  let bytes = prefetched.get(url);
  if (!bytes) {
    bytes = fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    prefetched.set(url, bytes);
  }
  return bytes;
}

/** In game the music opens up as the pirates come: calm, a little softer and darker (Hz at intensity 0). */
const CALM_CUTOFF = 5000;
const BATTLE_CUTOFF = 20000;

/** Seconds for fades between scenes and for following the intensity. */
const FADE_SECONDS = 1.5;
const INTENSITY_SECONDS = 2.5;

/** One part of the music, faded by its own gain. */
interface Layer {
  readonly gain: GainNode;
  /** Volume at a music intensity (0: calm, 1: battle). */
  readonly volume: (intensity: number) => number;
  /** A lowpass following the intensity. */
  readonly tone?: { readonly filter: BiquadFilterNode; readonly cutoff: (intensity: number) => number };
  readonly stop: (time: number) => void;
}

/**
 * Plays the music of the current scene. In game the intensity (0 to 1) follows the battle: the game track
 * opens up and gets a little louder, the built-in soundtrack adds its battle layer.
 */
export class MusicPlayer {
  private scene: MusicScene | null = null;
  private intensity = 0;
  private layers: Layer[] = [];
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** The mix bus every layer goes through, into `out`. */
  private readonly bus: AudioNode;

  constructor(
    private readonly ctx: AudioContext,
    out: AudioNode,
  ) {
    this.bus = mixBus(ctx, out);
  }

  setScene(scene: MusicScene | null): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.restart();
  }

  private restart(): void {
    const { scene } = this;
    const now = this.ctx.currentTime;
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(0, now, FADE_SECONDS / 3);
      layer.stop(now + FADE_SECONDS * 2);
    }
    this.layers = scene === null ? [] : this.createLayers(scene);
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(layer.volume(this.intensity), now, FADE_SECONDS / 3);
      layer.tone?.filter.frequency.setValueAtTime(layer.tone.cutoff(this.intensity), now);
    }
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.min(1, Math.max(0, intensity));
    const now = this.ctx.currentTime;
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(layer.volume(this.intensity), now, INTENSITY_SECONDS / 3);
      layer.tone?.filter.frequency.setTargetAtTime(
        layer.tone.cutoff(this.intensity),
        now,
        INTENSITY_SECONDS / 3,
      );
    }
  }

  private createLayers(scene: MusicScene): Layer[] {
    const url = trackUrl(SCENE_TRACKS[scene]);
    if (url === undefined) return this.songLayers(BUILT_IN_SOUNDTRACK[scene]);
    if (scene === 'menu') return [this.fileLayer(url, () => 1)];
    return [
      this.fileLayer(
        url,
        (intensity) => 0.85 + 0.15 * intensity,
        (intensity) => CALM_CUTOFF * (BATTLE_CUTOFF / CALM_CUTOFF) ** intensity,
      ),
    ];
  }

  /** The built-in soundtrack; the battle layer plays on top of the calm one, in time with it. */
  private songLayers(song: Song): Layer[] {
    const player = new SongPlayer(this.ctx, song);
    const stop = (): void => {
      player.stop();
    };
    const calm = this.layerGain();
    player.calm.connect(calm);
    const layers: Layer[] = [{ gain: calm, volume: (intensity) => 1 - 0.15 * intensity, stop }];
    if (song.battle) {
      const battle = this.layerGain();
      player.battle.connect(battle);
      layers.push({ gain: battle, volume: (intensity) => intensity, stop });
    }
    player.start();
    return layers;
  }

  /**
   * A looping music file; it starts once it is loaded, unless the scene has changed by then. The silence an
   * encoder leaves at both ends is cut from the loop, so it loops without a gap.
   */
  private fileLayer(
    url: string,
    volume: (intensity: number) => number,
    cutoff?: (intensity: number) => number,
  ): Layer {
    const gain = this.layerGain();
    let input: AudioNode = gain;
    let tone: Layer['tone'];
    if (cutoff) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.5;
      filter.frequency.value = cutoff(this.intensity);
      filter.connect(gain);
      input = filter;
      tone = { filter, cutoff };
    }
    let source: AudioBufferSourceNode | null = null;
    let stopped = false;
    void this.load(url).then((buffer) => {
      if (!buffer || stopped) return;
      const { start, end } = audibleRange(buffer);
      source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = start;
      source.loopEnd = end;
      source.connect(input);
      source.start(this.ctx.currentTime, start);
    });
    return {
      gain,
      volume,
      ...(tone && { tone }),
      stop: (time) => {
        stopped = true;
        source?.stop(time);
      },
    };
  }

  private layerGain(): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.bus);
    return gain;
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let buffer = this.buffers.get(url);
    if (!buffer) {
      buffer = this.decode(url);
      this.buffers.set(url, buffer);
    }
    return buffer;
  }

  private async decode(url: string): Promise<AudioBuffer | null> {
    try {
      const bytes = await fetchBytes(url);
      if (!bytes) throw new Error('not found');
      // decoding takes the bytes over: a copy, so a second context could decode them again
      return await this.ctx.decodeAudioData(bytes.slice(0));
    } catch (error) {
      console.warn(`Cannot play the music file ${url}`, error);
      return null;
    }
  }
}

/** Seconds where the music starts and ends, without the near silence around it. */
function audibleRange(buffer: AudioBuffer): { start: number; end: number } {
  const THRESHOLD = 0.002;
  const data = buffer.getChannelData(0);
  let first = 0;
  while (first < data.length && Math.abs(data[first] ?? 0) < THRESHOLD) first++;
  let last = data.length - 1;
  while (last > first && Math.abs(data[last] ?? 0) < THRESHOLD) last--;
  // a track that is (nearly) silent loops as it is
  if (last - first < buffer.sampleRate) return { start: 0, end: buffer.duration };
  return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
}

/**
 * The music's mix bus: rumble cut, a gentle cut of the harsh highs, a slow glue compressor and a soft
 * saturation that rounds off the peaks. Returns its input.
 */
function mixBus(ctx: AudioContext, out: AudioNode): AudioNode {
  const input = ctx.createGain();
  const rumble = ctx.createBiquadFilter();
  rumble.type = 'highpass';
  rumble.frequency.value = 32;
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 7000;
  air.gain.value = -4;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3200;
  presence.Q.value = 0.8;
  presence.gain.value = -2.5;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -18;
  glue.knee.value = 8;
  glue.ratio.value = 2.5;
  glue.attack.value = 0.015;
  glue.release.value = 0.22;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.35;
  const warmth = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
  }
  warmth.curve = curve;
  warmth.oversample = '2x';
  input
    .connect(rumble)
    .connect(air)
    .connect(presence)
    .connect(glue)
    .connect(makeup)
    .connect(warmth)
    .connect(out);
  return input;
}
