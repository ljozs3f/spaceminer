<script setup lang="ts">
import { ULTRA_INSTINCT_CONFIG } from '@space-miner/sim';
import { computed } from 'vue';
import type { UltraInstinctView } from '../game/views';

/** The Ultra Instinct button of the build bar: its state, and a ring that drains while on and fills up while it recharges. */
const props = defineProps<{ view: UltraInstinctView }>();
const emit = defineEmits<{ activate: [] }>();

const { multiplier, durationSeconds } = ULTRA_INSTINCT_CONFIG;

const clock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

const state = computed(() => {
  if (props.view.active) return `×${String(multiplier)} · ${String(props.view.secondsLeft)} s`;
  if (!props.view.ready) return `Recharging ${clock(props.view.secondsLeft)}`;
  return `×${String(multiplier)} for ${String(durationSeconds)} s`;
});

const title = `Ultra Instinct (I): everything works ${String(multiplier)} times better for ${String(durationSeconds)} seconds`;

function onClick(): void {
  if (props.view.ready) emit('activate');
}
</script>

<template>
  <button
    type="button"
    class="ultra-button"
    :class="{ active: view.active, ready: view.ready }"
    :aria-disabled="!view.ready"
    :style="{ '--fraction': view.fraction }"
    :title="title"
    @click="onClick"
  >
    <kbd class="hotkey">I</kbd>
    <span class="ultra-emblem" aria-hidden="true"><span /></span>
    <span class="ultra-text">
      <span class="ultra-name">Ultra Instinct</span>
      <span class="ultra-state">{{ state }}</span>
    </span>
  </button>
</template>
