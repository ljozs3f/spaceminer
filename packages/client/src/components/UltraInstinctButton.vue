<script setup lang="ts">
import { ULTRA_INSTINCT_CONFIG } from '@space-miner/sim';
import { computed } from 'vue';
import { ultraInstinctTip } from '../game/tips';
import { vTip } from '../game/tooltip';
import type { UltraInstinctView } from '../game/views';

/**
 * The Ultra Instinct button: a glowing orb in the bottom right corner of the map, like the ultimate of an
 * action game. A ring around it fills up while it recharges (with the time left in the orb) and drains while
 * it is on; when it is ready the orb swirls, pulses and gives off sparks, and it flares up the moment it
 * becomes ready.
 */
const props = defineProps<{ view: UltraInstinctView }>();
const emit = defineEmits<{ activate: [] }>();

const { multiplier, durationSeconds, rechargeSeconds } = ULTRA_INSTINCT_CONFIG;

/** The ring's radius in the SVG's 100 × 100 box. */
const RING_RADIUS = 46;
const SPARKS = 7;

const clock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

const state = computed(() => {
  if (props.view.active) return 'active';
  return props.view.ready ? 'ready' : 'charging';
});

const title =
  `Ultra Instinct (I): every building works ${String(multiplier)} times better for ` +
  `${String(durationSeconds)} seconds, then it recharges for ${clock(rechargeSeconds)}`;

function onClick(): void {
  if (props.view.ready) emit('activate');
}
</script>

<template>
  <button
    v-tip="ultraInstinctTip(view)"
    type="button"
    class="ultra-orb"
    :class="state"
    :aria-disabled="!view.ready"
    :aria-label="title"
    :style="{ '--fraction': view.fraction }"
    @click="onClick"
  >
    <span class="ultra-halo" aria-hidden="true" />
    <svg class="ultra-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" :r="RING_RADIUS" />
      <circle class="progress" cx="50" cy="50" :r="RING_RADIUS" pathLength="1" />
    </svg>
    <span class="ultra-core" aria-hidden="true">
      <span class="ultra-swirl" />
      <span class="ultra-readout">
        <template v-if="state === 'active'">
          <b>{{ view.secondsLeft }}</b>
          <small>×{{ multiplier }}</small>
        </template>
        <template v-else-if="state === 'charging'">
          <b class="clock">{{ clock(view.secondsLeft) }}</b>
          <small>charging</small>
        </template>
        <template v-else>
          <b>×{{ multiplier }}</b>
          <small>ready</small>
        </template>
      </span>
    </span>
    <span v-if="state === 'ready'" class="ultra-sparks" aria-hidden="true">
      <span v-for="i in SPARKS" :key="i" :style="{ '--i': i - 1, '--n': SPARKS }" />
    </span>
    <!-- mounted the moment it becomes ready, so its flare plays once -->
    <span v-if="state === 'ready'" class="ultra-burst" aria-hidden="true" />
    <kbd class="hotkey">I</kbd>
    <span class="ultra-label">Ultra Instinct</span>
  </button>
</template>
