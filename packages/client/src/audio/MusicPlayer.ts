import type { Song } from './song';
import { SOUNDTRACK } from './songs';
import { SongPlayer } from './SongPlayer';

export type MusicScene = 'menu' | 'game';
type Track = 'menu' | 'calm' | 'battle';

/**
 * Music files are optional: files in src/assets/music named menu.*, calm.* or battle.* are picked up at
 * build time (see the README there) and replace the built-in soundtrack (songs/).
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

/** Seconds for fades between scenes and for following the intensity. */
const FADE_SECONDS = 1.5;
const INTENSITY_SECONDS = 2.5;

/** One part of the music, faded by its own gain. */
interface Layer {
  readonly gain: GainNode;
  /** Volume at a music intensity (0: calm, 1: battle). */
  readonly volume: (intensity: number) => number;
  readonly stop: (time: number) => void;
}

/**
 * Plays the music of the current scene. In game the intensity (0 to 1) brings in the battle music: with
 * files it crossfades from calm.* to battle.*, with the built-in soundtrack it adds the battle layer.
 */
export class MusicPlayer {
  private scene: MusicScene | null = null;
  private intensity = 0;
  private layers: Layer[] = [];
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  setScene(scene: MusicScene | null): void {
    if (scene === this.scene) return;
    this.scene = scene;
    const now = this.ctx.currentTime;
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(0, now, FADE_SECONDS / 3);
      layer.stop(now + FADE_SECONDS * 2);
    }
    this.layers = scene === null ? [] : this.createLayers(scene);
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(layer.volume(this.intensity), now, FADE_SECONDS / 3);
    }
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.min(1, Math.max(0, intensity));
    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(
        layer.volume(this.intensity),
        this.ctx.currentTime,
        INTENSITY_SECONDS / 3,
      );
    }
  }

  private createLayers(scene: MusicScene): Layer[] {
    if (scene === 'menu') {
      const menuUrl = trackUrl('menu');
      return menuUrl === undefined ? this.songLayers(SOUNDTRACK.menu) : [this.fileLayer(menuUrl, () => 1)];
    }
    const calmUrl = trackUrl('calm');
    if (calmUrl === undefined) return this.songLayers(SOUNDTRACK.game);
    const battleUrl = trackUrl('battle');
    if (battleUrl === undefined) return [this.fileLayer(calmUrl, () => 1)];
    // equal-power crossfade, so the overall loudness stays the same
    return [
      this.fileLayer(calmUrl, (intensity) => Math.cos((intensity * Math.PI) / 2)),
      this.fileLayer(battleUrl, (intensity) => Math.sin((intensity * Math.PI) / 2)),
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

  /** A looping music file; it starts once it is loaded, unless the scene has changed by then. */
  private fileLayer(url: string, volume: (intensity: number) => number): Layer {
    const gain = this.layerGain();
    let source: AudioBufferSourceNode | null = null;
    let stopped = false;
    void this.load(url).then((buffer) => {
      if (!buffer || stopped) return;
      source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
    });
    return {
      gain,
      volume,
      stop: (time) => {
        stopped = true;
        source?.stop(time);
      },
    };
  }

  private layerGain(): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.out);
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
      const response = await fetch(url);
      return await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.warn(`Cannot play the music file ${url}`, error);
      return null;
    }
  }
}
