<script setup lang="ts">
import { BUILDING_TYPES, getBuildingStats, type BuildingType } from '@space-miner/sim';
import { BUILDINGS, cssColor } from '../game/presentation';
import { buildingSprite } from '../game/sprites';
import SpriteIcon from './SpriteIcon.vue';

const props = defineProps<{ ore: number; placing: BuildingType | null }>();
const emit = defineEmits<{ select: [type: BuildingType | null] }>();

const items = BUILDING_TYPES.map((type, index) => ({
  type,
  key: index + 1,
  name: BUILDINGS[type].name,
  color: cssColor(BUILDINGS[type].color),
  sprite: buildingSprite(type, 1),
  cost: getBuildingStats(type, 1).cost,
}));

function toggle(type: BuildingType): void {
  emit('select', props.placing === type ? null : type);
}
</script>

<template>
  <nav class="build-bar">
    <button
      v-for="item in items"
      :key="item.type"
      type="button"
      class="build-button"
      :class="{ active: placing === item.type, unaffordable: ore < item.cost }"
      @click="toggle(item.type)"
    >
      <SpriteIcon :sprite="item.sprite" :color="item.color" />
      <span class="name">{{ item.name }}</span>
      <span class="cost">{{ item.cost }} ore</span>
      <kbd>{{ item.key }}</kbd>
    </button>
    <span class="hint">Esc or right click: cancel</span>
  </nav>
</template>
