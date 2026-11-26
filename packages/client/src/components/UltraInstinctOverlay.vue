<script setup lang="ts">
import { ULTRA_INSTINCT_CONFIG } from '@space-miner/sim';
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import type { AudioEngine } from '../audio/AudioEngine';
import { ULTRA_INSTINCT_TRACK, UltraInstinctMusic } from '../audio/UltraInstinctMusic';
import type { UltraInstinctView } from '../game/views';

/**
 * Ultra Instinct on the map: a silver-blue aura at the edges, a banner with the time left, and its music
 * (from YouTube, with the credit beside the player). The music pauses with the game.
 */
const props = defineProps<{
  view: UltraInstinctView;
  audio: AudioEngine;
  /** The game runs: not paused, not over. */
  running: boolean;
}>();

const { multiplier } = ULTRA_INSTINCT_CONFIG;

const host = useTemplateRef('host');
/** The YouTube player is playing. */
const playing = shallowRef(false);
let music: UltraInstinctMusic | null = null;
/** The music has started in this Ultra Instinct. */
let started = false;
let volume = props.audio.musicLevel;

onMounted(() => {
  if (host.value) {
    music = new UltraInstinctMusic(host.value, (value) => {
      playing.value = value;
    });
  }
});

watch(
  () => [props.view.active, props.running] as const,
  ([active, running]) => {
    if (!active) {
      if (started) music?.stop();
      started = false;
    } else if (!running) {
      music?.pause();
    } else if (started) {
      music?.resume();
    } else {
      started = true;
      volume = props.audio.musicLevel;
      music?.play(volume);
    }
  },
);

// the soundtrack makes way while this music plays, and comes back as it fades out
watch(
  () => playing.value && props.view.active && props.running,
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
    music?.setVolume(level);
  },
);

onBeforeUnmount(() => {
  props.audio.holdMusic(false);
  music?.dispose();
});
</script>

<template>
  <div class="ultra-overlay" :class="{ on: view.active }">
    <div class="ultra-aura" aria-hidden="true" />
    <div v-if="view.active" class="ultra-banner" role="status">
      <span class="ultra-banner-title">Ultra Instinct</span>
      <span class="ultra-banner-boost">×{{ multiplier }}</span>
      <span class="ultra-banner-time">{{ view.secondsLeft }} s</span>
      <span class="ultra-banner-meter">
        <span class="fill" :style="{ width: `${view.fraction * 100}%` }" />
      </span>
    </div>
    <aside class="ultra-music" :class="{ on: view.active }" :aria-hidden="!view.active">
      <div ref="host" class="ultra-player" />
      <p class="ultra-credit">
        <strong>♪ {{ ULTRA_INSTINCT_TRACK.title }}</strong>
        <span>Cover: {{ ULTRA_INSTINCT_TRACK.coverBy }} · Original: {{ ULTRA_INSTINCT_TRACK.original }}</span>
      </p>
    </aside>
  </div>
</template>
