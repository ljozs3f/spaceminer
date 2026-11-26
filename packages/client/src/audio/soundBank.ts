import { RENDERED_SOUNDS, renderSound, type Render, type RenderedSound } from './rendered';
import type { RenderRequest, RenderResponse } from './renderWorker';

/**
 * The rendered sounds (rendered.ts), computed in a worker while the game loads, before there is an audio
 * context: they are rendered at 48 kHz and the browser resamples them if the context runs at another rate.
 * A sound asked for before its renders arrive is rendered on the spot.
 */

const SAMPLE_RATE = 48000;
/** Sounds heard many times a second get more variants. */
const VARIANTS: Readonly<Partial<Record<RenderedSound, number>>> = { laser: 5, pirateShot: 5 };
const DEFAULT_VARIANTS = 3;

const renders = new Map<RenderedSound, Render[]>();
const buffers = new WeakMap<BaseAudioContext, Map<RenderedSound, AudioBuffer[]>>();
const lastVariant = new Map<RenderedSound, number>();
let loading: Promise<void> | null = null;

/** Renders every sound in a worker; onProgress gets 0 to 1. Safe to call more than once. */
export function loadSoundBank(onProgress: (fraction: number) => void = () => undefined): Promise<void> {
  loading ??= new Promise<void>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      // without a worker the sounds are rendered when first played
      console.warn('Cannot start the sound worker', error);
      resolve();
      return;
    }
    let done = 0;
    const finish = (): void => {
      worker.terminate();
      resolve();
    };
    worker.addEventListener('message', (event: MessageEvent<RenderResponse>) => {
      const { sound } = event.data;
      if ((renders.get(sound)?.length ?? 0) < event.data.renders.length) {
        renders.set(sound, [...event.data.renders]);
      }
      onProgress(++done / RENDERED_SOUNDS.length);
      if (done === RENDERED_SOUNDS.length) finish();
    });
    worker.addEventListener('error', (event) => {
      console.warn('The sound worker failed', event.message);
      finish();
    });
    for (const sound of RENDERED_SOUNDS) {
      const request: RenderRequest = {
        sound,
        variants: VARIANTS[sound] ?? DEFAULT_VARIANTS,
        sampleRate: SAMPLE_RATE,
      };
      worker.postMessage(request);
    }
  });
  return loading;
}

/**
 * Plays a variant of a rendered sound into `out` (never the same one twice in a row), at a slightly random
 * pitch times `rate`. Returns its length in seconds.
 */
export function playRendered(
  ctx: AudioContext,
  out: AudioNode,
  start: number,
  sound: RenderedSound,
  rate = 1,
): number {
  const variants = buffersOf(ctx, sound);
  let index = Math.floor(Math.random() * variants.length);
  if (variants.length > 1 && index === lastVariant.get(sound)) index = (index + 1) % variants.length;
  lastVariant.set(sound, index);
  const buffer = variants[index];
  if (!buffer) return 0;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
  source.connect(out);
  source.start(start);
  return buffer.duration / source.playbackRate.value;
}

function buffersOf(ctx: AudioContext, sound: RenderedSound): AudioBuffer[] {
  let byContext = buffers.get(ctx);
  if (!byContext) {
    byContext = new Map();
    buffers.set(ctx, byContext);
  }
  let list = byContext.get(sound);
  // renders that arrived later replace the one rendered on the spot
  const sources = renders.get(sound);
  if (!list || (sources && list.length < sources.length)) {
    const available = sources ?? [renderSound(sound, SAMPLE_RATE)];
    if (!sources) renders.set(sound, available);
    list = available.map((render) => {
      const buffer = ctx.createBuffer(2, render.left.length, render.sampleRate);
      buffer.copyToChannel(render.left, 0);
      buffer.copyToChannel(render.right, 1);
      return buffer;
    });
    byContext.set(sound, list);
  }
  return list;
}
