<script setup lang="ts">
import { computed } from 'vue';
import { asteroidSprite } from '../game/sprites';
import type { AsteroidView } from '../game/views';
import SpriteIcon from './SpriteIcon.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ asteroid: AsteroidView }>();
defineEmits<{ close: [] }>();

const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large' } as const;

const remainingPercent = computed(() => Math.ceil(props.asteroid.remainingFraction * 100));
</script>

<template>
  <div class="popup-card" :style="{ '--accent-color': asteroid.color }">
    <header class="popup-header">
      <span class="popup-icon">
        <SpriteIcon :sprite="asteroidSprite(asteroid.size, asteroid.id)" :color="asteroid.color" large />
      </span>
      <span class="popup-title">
        <strong>{{ SIZE_NAMES[asteroid.size] }} asteroid</strong>
        <small>{{ remainingPercent }}% of its ore left</small>
      </span>
      <button type="button" class="popup-close" aria-label="Close" @click="$emit('close')">
        <UiIcon name="close" />
      </button>
    </header>
    <div class="popup-ore">
      <UiIcon name="ore" />
      <span class="meter"><span class="fill" :style="{ width: `${remainingPercent}%` }" /></span>
      <span class="value">{{ Math.ceil(asteroid.ore) }} / {{ asteroid.initialOre }}</span>
    </div>
    <p class="popup-note">Its color fades as it is mined. Build a mine in range to mine it.</p>
  </div>
</template>
