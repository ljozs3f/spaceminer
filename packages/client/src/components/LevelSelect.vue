<script setup lang="ts">
import { LEVELS, type LevelConfig } from '@space-miner/sim';
import { computed } from 'vue';
import { isLevelUnlocked } from '../persistence/progress';
import type { SaveData } from '../persistence/SaveRepository';

const props = defineProps<{ save: SaveData }>();
defineEmits<{ play: [level: LevelConfig]; back: [] }>();

const entries = computed(() =>
  LEVELS.map((level, index) => ({
    level,
    number: index + 1,
    unlocked: isLevelUnlocked(props.save, level.id),
    completed: props.save.completedLevelIds.includes(level.id),
  })),
);
</script>

<template>
  <main class="menu">
    <h1>Select a level</h1>
    <ol class="levels">
      <li v-for="entry in entries" :key="entry.level.id">
        <button type="button" :disabled="!entry.unlocked" @click="$emit('play', entry.level)">
          <span class="number">{{ entry.number }}</span>
          <span class="name">{{ entry.level.name }}</span>
          <span class="state">{{ entry.completed ? 'Completed' : entry.unlocked ? 'Open' : 'Locked' }}</span>
        </button>
      </li>
    </ol>
    <button type="button" class="link" @click="$emit('back')">← Back</button>
  </main>
</template>
