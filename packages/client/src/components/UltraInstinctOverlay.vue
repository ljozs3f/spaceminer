<script setup lang="ts">
import { ULTRA_INSTINCT_CONFIG } from '@space-miner/sim';
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch, type ShallowRef } from 'vue';
import type { AudioEngine } from '../audio/AudioEngine';
import { BURNOUT_TRACK, ULTRA_INSTINCT_TRACK, YouTubeMusic, type YouTubeTrack } from '../audio/YouTubeMusic';
import type { UltraInstinctView } from '../game/views';

/**
 * Ultra Instinct on the map: a silver-blue aura at the edges, a banner with the time left, and its music
 * (from YouTube, with the credit beside the player). In the burnout right after it the edges smoulder dark
 * red, under a red banner with its time left, and the Ultra Instinct music breaks off into the burnout's
 * own. The music pauses with the game.
 */
const props = defineProps<{
  view: UltraInstinctView;
  audio: AudioEngine;
  /** The game runs: not paused, not over. */
  running: boolean;
}>();

const { multiplier, burnoutDivisor } = ULTRA_INSTINCT_CONFIG;

/**
 * The Ultra Instinct music breaks off this fast as the burnout starts (s). The burnout's rings out a little
 * past its end, as YouTube takes a moment to start it.
 */
const BREAK_OFF_SECONDS = 0.2;
const BURNOUT_FADE_SECONDS = 1;

/** A track and its player: whether it is playing, and whether it has started in this Ultra Instinct. */
interface Clip {
  readonly track: YouTubeTrack;
  readonly playing: ShallowRef<boolean>;
  music: YouTubeMusic | null;
  started: boolean;
}

const clip = (track: YouTubeTrack): Clip => ({
  track,
  playing: shallowRef(false),
  music: null,
  started: false,
});
const ultra = clip(ULTRA_INSTINCT_TRACK);
const burnout = clip(BURNOUT_TRACK);

const ultraHost = useTemplateRef('ultraHost');
const burnoutHost = useTemplateRef('burnoutHost');
let volume = props.audio.musicLevel;

onMounted(() => {
  for (const [target, host] of [
    [ultra, ultraHost.value],
    [burnout, burnoutHost.value],
  ] as const) {
    if (!host) continue;
    target.music = new YouTubeMusic(host, target.track, (value) => {
      target.playing.value = value;
    });
  }
});

/** Starts, pauses, resumes or stops a clip as its part of Ultra Instinct comes and goes. */
function follow(target: Clip, on: boolean, running: boolean, fadeSeconds?: number): void {
  if (!on) {
    if (target.started) target.music?.stop(fadeSeconds);
    target.started = false;
  } else if (!running) {
    target.music?.pause();
  } else if (target.started) {
    target.music?.resume();
  } else {
    target.started = true;
    volume = props.audio.musicLevel;
    target.music?.play(volume);
  }
}

// a source each, so that it runs only when one of them changes: a getter of a new array would run it on
// every tick (the view is new every tick), and ask the player to play and set its volume every tick
watch(
  [() => props.view.active, () => props.view.burnout, () => props.running],
  ([active, burntOut, running]) => {
    follow(ultra, active, running, burntOut ? BREAK_OFF_SECONDS : undefined);
    follow(burnout, burntOut, running, BURNOUT_FADE_SECONDS);
  },
);

// the soundtrack makes way while this music plays (all through the burnout, if its music can play, so the
// soundtrack does not come back for a moment as one track takes over from the other), and comes back after
watch(
  () =>
    props.running &&
    ((props.view.active && ultra.playing.value) ||
      (props.view.burnout && (burnout.playing.value || (burnout.music?.ready ?? false)))),
  (held) => {
    props.audio.holdMusic(held);
  },
);

// the music volume and muting follow the sound settings
watch(
  () => props.view,
  () => {
    const level = props.audio.musicLevel;
    if (level === volume) return;
    volume = level;
    ultra.music?.setVolume(level);
    burnout.music?.setVolume(level);
  },
);

onBeforeUnmount(() => {
  props.audio.holdMusic(false);
  ultra.music?.dispose();
  burnout.music?.dispose();
});
</script>

<template>
  <div class="ultra-overlay" :class="{ on: view.active, burnout: view.burnout }">
    <div class="ultra-aura" aria-hidden="true" />
    <div v-if="view.active" class="ultra-banner" role="status">
      <span class="ultra-banner-title">Ultra Instinct</span>
      <span class="ultra-banner-boost">×{{ multiplier }}</span>
      <span class="ultra-banner-time">{{ view.secondsLeft }} s</span>
      <span class="ultra-banner-meter">
        <span class="fill" :style="{ width: `${view.fraction * 100}%` }" />
      </span>
    </div>
    <div v-else-if="view.burnout" class="ultra-banner burnout" role="status">
      <span class="ultra-banner-title">Burnout</span>
      <span class="ultra-banner-boost">÷{{ burnoutDivisor }}</span>
      <span class="ultra-banner-time">{{ view.secondsLeft }} s</span>
      <span class="ultra-banner-note">Every building works {{ burnoutDivisor }} times worse</span>
      <span class="ultra-banner-meter">
        <span class="fill" :style="{ width: `${view.fraction * 100}%` }" />
      </span>
    </div>
    <aside class="ultra-music" :class="{ on: view.active }" :aria-hidden="!view.active">
      <div ref="ultraHost" class="ultra-player" />
      <p class="ultra-credit">
        <strong>♪ {{ ULTRA_INSTINCT_TRACK.title }}</strong>
        <span>Cover: {{ ULTRA_INSTINCT_TRACK.coverBy }} · Original: {{ ULTRA_INSTINCT_TRACK.original }}</span>
      </p>
    </aside>
    <aside class="ultra-music burnout" :class="{ on: view.burnout }" :aria-hidden="!view.burnout">
      <div ref="burnoutHost" class="ultra-player" />
      <p class="ultra-credit">
        <strong>♪ {{ BURNOUT_TRACK.title }}</strong>
        <span>Cover: {{ BURNOUT_TRACK.coverBy }} · Original: {{ BURNOUT_TRACK.original }}</span>
      </p>
    </aside>
  </div>
</template>
