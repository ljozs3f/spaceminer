<script setup lang="ts">
import { computed } from 'vue';
import { cssColor, ENEMIES } from '../game/presentation';
import { shipSprite } from '../game/sprites';
import type { HudView } from '../game/views';
import SpriteIcon from './SpriteIcon.vue';

const props = defineProps<{ hud: HudView; levelName: string }>();
defineEmits<{ exit: [] }>();

const percent = (fraction: number): number => Math.floor(fraction * 100);
const energy = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const shortOnEnergy = computed(() => props.hud.efficiency < 1);
</script>

<template>
  <header class="hud">
    <button type="button" class="link" @click="$emit('exit')">← Levels</button>
    <span class="level-name">{{ levelName }}</span>
    <span class="stat"><span class="label">Ore</span> {{ Math.floor(hud.ore) }}</span>
    <span class="stat" :class="{ warning: shortOnEnergy }">
      <span class="label">Energy</span>
      {{ energy(hud.energyProduced) }} / {{ energy(hud.energyConsumed) }}
      <small v-if="shortOnEnergy">{{ percent(hud.efficiency) }}% power</small>
    </span>
    <span class="stat progress">
      <span class="label">Mined</span>
      <span class="bar">
        <span class="fill" :style="{ width: `${hud.minedFraction * 100}%` }" />
        <span class="goal" :style="{ left: `${hud.goalFraction * 100}%` }" />
      </span>
      {{ percent(hud.minedFraction) }}% / {{ percent(hud.goalFraction) }}%
    </span>
    <span class="stat next-wave">
      <span class="label">Wave {{ hud.wavesSpawned + 1 }} in</span> {{ hud.secondsToNextWave }}s
      <span
        v-for="group in hud.nextWave"
        :key="group.type"
        class="enemy-count"
        :title="`${group.count} × ${ENEMIES[group.type].name}, ${Math.round(group.maxHp)} hit points each`"
      >
        <SpriteIcon :sprite="shipSprite(group.type)" :color="cssColor(ENEMIES[group.type].color)" />
        {{ group.count }} {{ ENEMIES[group.type].name }}
      </span>
    </span>
  </header>
</template>
