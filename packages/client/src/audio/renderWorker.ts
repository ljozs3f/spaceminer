import { renderSound, type Render, type RenderedSound } from './rendered';

/** Asks the worker for `variants` renders of `sound` at `sampleRate`. */
export interface RenderRequest {
  readonly sound: RenderedSound;
  readonly variants: number;
  readonly sampleRate: number;
}

export interface RenderResponse {
  readonly sound: RenderedSound;
  readonly renders: readonly Render[];
}

// renders sounds off the main thread: a big explosion takes about a tenth of a second to compute
self.addEventListener('message', (event: MessageEvent<RenderRequest>) => {
  const { sound, variants, sampleRate } = event.data;
  const renders = Array.from({ length: variants }, () => renderSound(sound, sampleRate));
  const response: RenderResponse = { sound, renders };
  self.postMessage(response, {
    transfer: renders.flatMap((render) => [render.left.buffer, render.right.buffer]),
  });
});
