<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { AudioEngine } from '../audio/AudioEngine';
import { prefetchMusic } from '../audio/MusicPlayer';
import { loadSoundBank } from '../audio/soundBank';
import { BACKGROUND_SPRITE, shipSprite, SPRITE_URLS } from '../game/sprites';
import { INTRO, IntroScene, type IntroPhase } from '../intro/IntroScene';
import { WarpField } from '../intro/WarpField';

/**
 * What the game opens with: a loading screen over drifting stars while the sprites, the rendered sounds and
 * the music load, then (after a click, which browsers need before any sound) the intro. A click or a key
 * skips it; with reduced motion it is skipped.
 */
const props = defineProps<{ audio: AudioEngine }>();
const emit = defineEmits<{ done: [] }>();

/** The loading screen stays at least this long, so it does not just flicker. */
const MIN_LOADING_MS = 1800;
/** The fade to the menu (ms), as in the CSS. */
const LEAVE_MS = 450;

type Stage = 'loading' | 'ready' | 'intro' | 'leaving';

const canvas = useTemplateRef('canvas');
const stage = shallowRef<Stage>('loading');
const progress = shallowRef(0);
const phase = shallowRef<IntroPhase>('spool');
const percent = computed(() => Math.floor(progress.value * 100));
const status = computed(() => {
  if (progress.value >= 1) return 'All systems online';
  if (progress.value < 0.3) return 'Charting the asteroid belt';
  if (progress.value < 0.8) return 'Calibrating weapon acoustics';
  return 'Tuning the comms';
});
const HUD_TEXT: Readonly<Record<IntroPhase, string>> = {
  spool: 'FTL drive charging',
  tunnel: 'In transit',
  belt: 'Arrived: Kessler belt · pirate contacts',
  title: '',
};

let field: WarpField | null = null;
let scene: IntroScene | null = null;
let frame = 0;
let lastMs = 0;
let introStartMs = 0;

function draw(nowMs: number): void {
  frame = requestAnimationFrame(draw);
  const seconds = Math.min(0.1, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  if (scene && stage.value === 'intro') {
    const t = (nowMs - introStartMs) / 1000;
    phase.value = scene.phase(t);
    scene.draw(t, seconds);
    if (t >= INTRO.end) finish();
  } else {
    field?.draw(seconds);
  }
}

function image(url: string | undefined): HTMLImageElement | null {
  if (!url) return null;
  const element = new Image();
  element.src = url;
  return element;
}

async function preload(): Promise<void> {
  const started = performance.now();
  const parts = { images: 0, sounds: 0, music: 0 };
  const update = (): void => {
    progress.value = parts.images * 0.3 + parts.sounds * 0.5 + parts.music * 0.2;
  };
  const urls = [...SPRITE_URLS.values()];
  let loaded = 0;
  await Promise.all([
    ...urls.map(async (url) => {
      await image(url)
        ?.decode()
        .catch(() => undefined);
      parts.images = ++loaded / urls.length;
      update();
    }),
    loadSoundBank((fraction) => {
      parts.sounds = fraction;
      update();
    }),
    prefetchMusic().then(() => {
      parts.music = 1;
      update();
    }),
  ]);
  parts.images = parts.sounds = parts.music = 1;
  update();
  const wait = MIN_LOADING_MS - (performance.now() - started);
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  if (stage.value === 'loading') stage.value = 'ready';
}

function launch(): void {
  props.audio.unlock();
  if (!field || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return;
  }
  scene = new IntroScene(
    field,
    {
      background: image(SPRITE_URLS.get(BACKGROUND_SPRITE)),
      asteroids: [...SPRITE_URLS.entries()]
        .filter(([name]) => name.startsWith('asteroid-'))
        .map(([, url]) => image(url))
        .filter((element): element is HTMLImageElement => element !== null),
      raider: image(SPRITE_URLS.get(shipSprite('raider') ?? '')),
    },
    (sound, pan) => {
      props.audio.play(sound, pan);
    },
  );
  introStartMs = performance.now();
  stage.value = 'intro';
}

function finish(): void {
  if (stage.value === 'leaving') return;
  stage.value = 'leaving';
  window.setTimeout(() => {
    emit('done');
  }, LEAVE_MS);
}

/** In the ready stage any click or key launches; in the intro it skips. */
function onInput(): void {
  if (stage.value === 'ready') launch();
  else if (stage.value === 'intro') finish();
}

function onKeyDown(event: KeyboardEvent): void {
  // M mutes (App), modifier combinations belong to the browser
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() === 'm') return;
  if (event.repeat) return;
  onInput();
}

function onResize(): void {
  field?.resize();
}

onMounted(() => {
  if (canvas.value) field = new WarpField(canvas.value);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  lastMs = performance.now();
  frame = requestAnimationFrame(draw);
  void preload();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="boot" :class="[stage, `phase-${phase}`]" @pointerdown="onInput">
    <canvas ref="canvas" class="boot-canvas" aria-hidden="true" />

    <div v-if="stage === 'loading' || stage === 'ready'" class="boot-loader">
      <p class="menu-kicker">Space Miner</p>
      <div class="loader-ring" :class="{ done: stage === 'ready' }" :style="{ '--progress': progress }">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="52" />
          <circle class="ring-ticks" cx="60" cy="60" r="44" />
          <circle class="ring-fill" cx="60" cy="60" r="52" pathLength="100" />
        </svg>
        <span class="ring-value">{{ percent }}<small>%</small></span>
      </div>
      <p class="loader-status" role="status">{{ status }}</p>
      <template v-if="stage === 'ready'">
        <button type="button" class="cta launch">
          <span class="cta-play" aria-hidden="true" />
          <span class="cta-text"><strong>Launch</strong><small>Sound on: best with headphones</small></span>
        </button>
        <p class="boot-hint">Click anywhere or press any key</p>
      </template>
    </div>

    <template v-else>
      <p v-if="HUD_TEXT[phase]" :key="phase" class="intro-hud">{{ HUD_TEXT[phase] }}</p>
      <div v-if="phase === 'title'" class="intro-title">
        <h1 class="logo"><span>Space</span>Miner</h1>
        <p class="tagline">Mine the belt. Hold the line.</p>
      </div>
      <button type="button" class="intro-skip" @pointerdown.stop="finish">Skip ›</button>
    </template>
  </div>
</template>
