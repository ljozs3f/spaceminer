<script setup lang="ts">
import type { EnemyType } from '@space-miner/sim';
import { cssColor, ENEMIES } from '../game/presentation';
import { shipSprite } from '../game/sprites';
import SpriteIcon from './SpriteIcon.vue';

export interface WaveNotice {
  /** 1-based. */
  readonly number: number;
  readonly ships: readonly { readonly type: EnemyType; readonly count: number }[];
  /** Where they come from, in words. */
  readonly from: string;
}

/** The alarm when a wave arrives: a banner across the map and the screen edges pulsing red. */
defineProps<{ wave: WaveNotice | null }>();
</script>

<template>
  <Transition name="wave-banner">
    <div v-if="wave" :key="wave.number" class="wave-alarm" role="alert">
      <div class="wave-vignette" aria-hidden="true" />
      <div class="wave-banner">
        <p class="wave-kicker">Incoming · from {{ wave.from }}</p>
        <h2 class="wave-title">Wave {{ wave.number }}</h2>
        <ul class="wave-roster">
          <li v-for="ship in wave.ships" :key="ship.type">
            <SpriteIcon :sprite="shipSprite(ship.type)" :color="cssColor(ENEMIES[ship.type].color)" large />
            <span>{{ ship.count }} × {{ ENEMIES[ship.type].name }}</span>
          </li>
        </ul>
      </div>
    </div>
  </Transition>
</template>
