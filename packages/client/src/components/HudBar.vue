<script setup lang="ts">
import { TICK_RATE } from '@space-miner/sim';
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { cssColor, ENEMIES } from '../game/presentation';
import { shipSprite } from '../game/sprites';
import type { HudView } from '../game/views';
import SpriteIcon from './SpriteIcon.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ hud: HudView; levelName: string }>();
defineEmits<{ exit: []; pause: [] }>();

/** Seconds before a wave when its timer turns red. */
const WAVE_SOON_SECONDS = 10;
/** Changes of the ore beyond what the mines bring in, from this size on, float up from the ore counter. */
const FLOAT_MIN_ORE = 1;
const FLOAT_MS = 1400;

const percent = (fraction: number): number => Math.floor(fraction * 100);
const number = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const shortOnEnergy = computed(() => props.hud.efficiency < 1);
const energyLoad = computed(() =>
  props.hud.energyProduced === 0 ? 1 : Math.min(1, props.hud.energyConsumed / props.hud.energyProduced),
);
const waveSoon = computed(() => props.hud.secondsToNextWave <= WAVE_SOON_SECONDS);
const waveClock = computed(() => {
  const seconds = props.hud.secondsToNextWave;
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
});
const goalReached = computed(() => props.hud.minedFraction >= props.hud.goalFraction);

// the ore counter rolls towards the real value instead of jumping
const shownOre = shallowRef(Math.floor(props.hud.ore));
let rolledOre = props.hud.ore;
let frame = 0;
let lastFrameMs = 0;
function roll(nowMs: number): void {
  const seconds = Math.min(0.1, (nowMs - lastFrameMs) / 1000);
  lastFrameMs = nowMs;
  const difference = props.hud.ore - rolledOre;
  rolledOre = Math.abs(difference) < 0.5 ? props.hud.ore : rolledOre + difference * Math.min(1, seconds * 9);
  shownOre.value = Math.floor(rolledOre);
  frame = requestAnimationFrame(roll);
}
onMounted(() => {
  lastFrameMs = performance.now();
  frame = requestAnimationFrame(roll);
});

// spending, bounties and sales float up from the counter (the steady trickle of the mines does not)
const floats = shallowRef<readonly { id: number; text: string; gain: boolean }[]>([]);
const ticker = shallowRef<'gain' | 'spend' | null>(null);
const timers = new Set<number>();
let floatsShown = 0;
let tickerTimer = 0;
let previousHud: HudView | null = props.hud;
watch(
  () => props.hud.tick,
  (tick, previousTick) => {
    const previous = previousHud;
    previousHud = props.hud;
    if (!previous) return;
    const mined = (previous.oreRate * (tick - previousTick)) / TICK_RATE;
    const change = props.hud.ore - previous.ore - mined;
    if (Math.abs(change) < FLOAT_MIN_ORE) return;
    const gain = change > 0;
    const id = ++floatsShown;
    floats.value = [
      ...floats.value,
      { id, gain, text: `${gain ? '+' : '−'}${String(Math.round(Math.abs(change)))}` },
    ];
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      floats.value = floats.value.filter((float) => float.id !== id);
    }, FLOAT_MS);
    timers.add(timer);
    ticker.value = gain ? 'gain' : 'spend';
    window.clearTimeout(tickerTimer);
    tickerTimer = window.setTimeout(() => {
      ticker.value = null;
    }, 450);
  },
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.clearTimeout(tickerTimer);
  for (const timer of timers) window.clearTimeout(timer);
});
</script>

<template>
  <header class="hud">
    <div class="hud-title">
      <button
        type="button"
        class="hud-back"
        title="Back to the menu"
        aria-label="Back to the menu"
        @click="$emit('exit')"
      >
        <UiIcon name="back" />
      </button>
      <button
        type="button"
        class="hud-back"
        title="Pause (Esc or P)"
        aria-label="Pause"
        @click="$emit('pause')"
      >
        <UiIcon name="pause" />
      </button>
      <span class="hud-level">
        <small>Sector</small>
        <strong>{{ levelName }}</strong>
      </span>
    </div>

    <div class="hud-chip ore" :class="ticker">
      <span class="chip-icon"><UiIcon name="ore" /></span>
      <span class="chip-body">
        <span class="chip-label">Ore</span>
        <span class="chip-value">{{ shownOre }}</span>
      </span>
      <span class="chip-rate" :class="{ idle: hud.oreRate === 0 }" title="Ore per second from your mines">
        +{{ number(hud.oreRate) }}/s
      </span>
      <span class="floats" aria-hidden="true">
        <span v-for="float in floats" :key="float.id" class="float" :class="{ gain: float.gain }">
          {{ float.text }}
        </span>
      </span>
    </div>

    <div
      class="hud-chip energy"
      :class="{ short: shortOnEnergy }"
      :title="`Your buildings use ${number(hud.energyConsumed)} of the ${number(hud.energyProduced)} energy your solar panels make`"
    >
      <span class="chip-icon"><UiIcon name="energy" /></span>
      <span class="chip-body">
        <span class="chip-label">
          Energy
          <b v-if="shortOnEnergy" class="chip-alert">{{ percent(hud.efficiency) }}% power</b>
        </span>
        <span class="chip-value">
          {{ number(hud.energyConsumed) }}<small> / {{ number(hud.energyProduced) }}</small>
        </span>
        <span class="chip-meter"><span class="fill" :style="{ width: `${energyLoad * 100}%` }" /></span>
      </span>
    </div>

    <div class="hud-chip mined" :class="{ done: goalReached }">
      <span class="chip-icon"><UiIcon name="target" /></span>
      <span class="chip-body wide">
        <span class="chip-label">
          Mined <b>{{ percent(hud.minedFraction) }}%</b>
          <span class="goal-label">goal {{ percent(hud.goalFraction) }}%</span>
        </span>
        <span class="progress">
          <span class="fill" :style="{ width: `${hud.minedFraction * 100}%` }" />
          <span class="goal" :style="{ left: `${hud.goalFraction * 100}%` }" />
        </span>
      </span>
    </div>

    <div class="hud-chip wave" :class="{ soon: waveSoon }">
      <span class="chip-icon"><UiIcon name="wave" /></span>
      <span class="chip-body">
        <span class="chip-label">Wave {{ hud.wavesSpawned + 1 }} in</span>
        <span class="chip-value">{{ waveClock }}</span>
        <span class="chip-meter"><span class="fill" :style="{ width: `${hud.waveProgress * 100}%` }" /></span>
      </span>
      <span class="wave-ships">
        <span
          v-for="group in hud.nextWave"
          :key="group.type"
          class="wave-ship"
          :title="`${group.count} × ${ENEMIES[group.type].name}, ${Math.round(group.maxHp)} hit points each`"
        >
          <SpriteIcon :sprite="shipSprite(group.type)" :color="cssColor(ENEMIES[group.type].color)" />
          <span>{{ group.count }}</span>
        </span>
      </span>
    </div>

    <Transition name="attack">
      <div v-if="hud.enemies > 0" class="hud-attack" role="status">
        <span class="attack-dot" />
        {{ hud.enemies }} {{ hud.enemies === 1 ? 'pirate' : 'pirates' }} attacking
      </div>
    </Transition>
  </header>
</template>
