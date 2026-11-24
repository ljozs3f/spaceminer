<script setup lang="ts">
import { computed } from 'vue';
import { asteroidSprite } from '../game/sprites';
import type { AsteroidView } from '../game/views';
import SpriteIcon from './SpriteIcon.vue';

const props = defineProps<{ asteroid: AsteroidView }>();

const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large' } as const;

const remainingPercent = computed(() => Math.ceil(props.asteroid.remainingFraction * 100));
</script>

<template>
  <aside class="side-panel">
    <h2>
      <SpriteIcon :sprite="asteroidSprite(asteroid.size, asteroid.id)" color="#8a6a4a" large />
      {{ SIZE_NAMES[asteroid.size] }} asteroid
    </h2>
    <dl>
      <div>
        <dt>Ore left</dt>
        <dd>{{ Math.ceil(asteroid.ore) }} / {{ asteroid.initialOre }}</dd>
      </div>
      <div>
        <dt>Remaining</dt>
        <dd>{{ remainingPercent }}%</dd>
      </div>
    </dl>
    <span class="meter"><span class="fill" :style="{ width: `${remainingPercent}%` }" /></span>
  </aside>
</template>
