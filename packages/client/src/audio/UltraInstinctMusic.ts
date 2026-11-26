/**
 * The music of Ultra Instinct: "Ultra Instinct Rush (HQ Cover)" by PokéMixr92 (original theme by Norihito
 * Sumitomo), played from YouTube with its official embedded player, so nothing is downloaded or hosted
 * here (the cover's author asks not to re-upload it). The player stays on screen while it plays, with the
 * credit beside it (UltraInstinctOverlay.vue), and the credits page names it too (src/credits.ts).
 *
 * The player is created when a game starts, paused, so that it is loaded by the time the button is pressed.
 * Without YouTube (offline, blocked) the game goes on without this music.
 */

export const ULTRA_INSTINCT_TRACK = {
  videoId: 'oGUGQRKygp4',
  title: 'Ultra Instinct Rush (HQ Cover)',
  coverBy: 'PokéMixr92',
  coverByUrl: 'https://www.youtube.com/@PokeMixr92',
  original: 'Norihito Sumitomo',
  url: 'https://www.youtube.com/watch?v=oGUGQRKygp4',
  /**
   * The essence: where the most replayed part of the video starts (YouTube's "most replayed" graph of the
   * video peaks from 2:28 to 2:40), a second early so that its first beat lands with the aura.
   */
  startSeconds: 147,
} as const;

/** Seconds the music fades out over when Ultra Instinct ends. */
const FADE_OUT_SECONDS = 1.2;
/** The YouTube volume (0 to 100) at full music volume: the video is mastered louder than the soundtrack. */
const FULL_VOLUME = 85;

/** The parts of the YouTube IFrame Player API used here. */
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YouTubePlayerOptions {
  readonly videoId: string;
  readonly width: string;
  readonly height: string;
  readonly playerVars: Readonly<Record<string, string | number>>;
  readonly events: {
    readonly onReady: (event: { readonly target: YouTubePlayer }) => void;
    readonly onStateChange: (event: { readonly data: number }) => void;
    readonly onError: (event: { readonly data: number }) => void;
  };
}

interface YouTubeApi {
  readonly Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

type YouTubeWindow = Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };

/** YT.PlayerState: PLAYING, and BUFFERING (a stall while playing, which does not count as a stop). */
const PLAYING = 1;
const BUFFERING = 3;

let api: Promise<YouTubeApi> | null = null;

/** Loads YouTube's IFrame Player API once; a failed load is tried again next time. */
function loadApi(): Promise<YouTubeApi> {
  api ??= new Promise<YouTubeApi>((resolve, reject) => {
    const win = window as YouTubeWindow;
    if (win.YT?.Player) {
      resolve(win.YT);
      return;
    }
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (win.YT) resolve(win.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.addEventListener('error', () => {
      script.remove();
      api = null;
      reject(new Error('Cannot load the YouTube player'));
    });
    document.head.append(script);
  });
  return api;
}

export class UltraInstinctMusic {
  private player: YouTubePlayer | null = null;
  private wanted = false;
  private volume = 1;
  private fadeTimer = 0;
  private disposed = false;

  /**
   * @param host the element the player's iframe goes into.
   * @param onPlaying called with true when the music starts playing, false when it stops.
   */
  constructor(
    host: HTMLElement,
    private readonly onPlaying: (playing: boolean) => void,
  ) {
    loadApi()
      .then((youtube) => {
        if (this.disposed) return;
        // the API replaces the element it gets with its iframe: an element of its own, not the host
        const target = document.createElement('div');
        host.append(target);
        // the player answers through these events; until onReady it cannot be used
        const player = new youtube.Player(target, {
          videoId: ULTRA_INSTINCT_TRACK.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: ULTRA_INSTINCT_TRACK.startSeconds,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (this.disposed) return;
              this.player = player;
              if (this.wanted) this.start();
            },
            onStateChange: ({ data }) => {
              if (data !== BUFFERING) this.onPlaying(data === PLAYING);
            },
            onError: ({ data }) => {
              console.warn(`The Ultra Instinct music cannot play (YouTube error ${String(data)})`);
              this.onPlaying(false);
            },
          },
        });
      })
      .catch((error: unknown) => {
        console.warn('The Ultra Instinct music is not available', error);
      });
  }

  /** Plays from the essence of the track, at `volume` (0 to 1, the game's music volume). */
  play(volume: number): void {
    this.wanted = true;
    this.volume = volume;
    this.start();
  }

  /** Fades out and pauses; the next play starts from the essence again. */
  stop(): void {
    this.wanted = false;
    const player = this.player;
    if (!player) return;
    window.clearInterval(this.fadeTimer);
    const steps = 12;
    let step = 0;
    this.fadeTimer = window.setInterval(
      () => {
        step++;
        player.setVolume(this.youtubeVolume() * (1 - step / steps));
        if (step < steps) return;
        window.clearInterval(this.fadeTimer);
        player.pauseVideo();
        player.seekTo(ULTRA_INSTINCT_TRACK.startSeconds, true);
      },
      (FADE_OUT_SECONDS * 1000) / steps,
    );
  }

  /** Pauses where it is (the game is paused); resume() goes on from there. */
  pause(): void {
    window.clearInterval(this.fadeTimer);
    this.player?.pauseVideo();
  }

  resume(): void {
    if (!this.wanted || !this.player) return;
    this.player.setVolume(this.youtubeVolume());
    this.player.playVideo();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.wanted) this.player?.setVolume(this.youtubeVolume());
  }

  dispose(): void {
    this.disposed = true;
    window.clearInterval(this.fadeTimer);
    this.player?.destroy();
    this.player = null;
  }

  private start(): void {
    const player = this.player;
    if (!player) return;
    window.clearInterval(this.fadeTimer);
    player.setVolume(this.youtubeVolume());
    player.seekTo(ULTRA_INSTINCT_TRACK.startSeconds, true);
    player.playVideo();
  }

  private youtubeVolume(): number {
    return Math.round(Math.min(1, Math.max(0, this.volume)) * FULL_VOLUME);
  }
}
