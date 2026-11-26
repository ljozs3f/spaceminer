<script setup lang="ts">
import { BUILDING_TYPES, getBuildingEnergy, getBuildingStats, type BuildingType } from '@space-miner/sim';
import { computed } from 'vue';
import { BUILDINGS, cssColor } from '../game/presentation';
import { buildingSprite } from '../game/sprites';
import SpriteIcon from './SpriteIcon.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ ore: number; placing: BuildingType | null }>();
const emit = defineEmits<{ select: [type: BuildingType | null] }>();

const items = BUILDING_TYPES.map((type, index) => {
  const energy = getBuildingEnergy(type, 1);
  return {
    type,
    key: index + 1,
    name: BUILDINGS[type].name,
    description: BUILDINGS[type].description,
    color: cssColor(BUILDINGS[type].color),
    sprite: buildingSprite(type, 1),
    cost: getBuildingStats(type, 1).cost,
    energy: energy.produced > 0 ? `+${String(energy.produced)}` : `−${String(energy.consumed)}`,
    producesEnergy: energy.produced > 0,
  };
});

const placingName = computed(() => (props.placing === null ? null : BUILDINGS[props.placing].name));

function toggle(type: BuildingType): void {
  emit('select', props.placing === type ? null : type);
}
</script>

<template>
  <nav class="build-bar">
    <div class="build-items">
      <button
        v-for="item in items"
        :key="item.type"
        type="button"
        class="build-card"
        :class="{ active: placing === item.type, unaffordable: ore < item.cost }"
        :style="{ '--build-color': item.color }"
        :aria-pressed="placing === item.type"
        @click="toggle(item.type)"
      >
        <kbd class="hotkey">{{ item.key }}</kbd>
        <span class="build-icon"><SpriteIcon :sprite="item.sprite" :color="item.color" large /></span>
        <span class="build-text">
          <span class="build-name">{{ item.name }}</span>
          <span class="build-desc">{{ item.description }}</span>
        </span>
        <span class="build-meta">
          <span class="build-cost"><UiIcon name="ore" />{{ item.cost }}</span>
          <span class="build-energy" :class="{ plus: item.producesEnergy }">
            <UiIcon name="energy" />{{ item.energy }}
          </span>
        </span>
        <span v-if="ore < item.cost" class="afford" aria-hidden="true">
          <span class="fill" :style="{ width: `${(ore / item.cost) * 100}%` }" />
        </span>
      </button>
    </div>
    <slot />
    <p class="build-hint" :class="{ placing: placingName !== null }">
      <template v-if="placingName">
        <span>
          Click a free cell to build the <b>{{ placingName }}</b>
        </span>
        <span class="hint-keys"><kbd>Esc</kbd> or right click to cancel</span>
      </template>
      <template v-else>
        <span>
          Pick a building <kbd>1</kbd>–<kbd>{{ items.length }}</kbd>
        </span>
        <span class="hint-keys">Click your buildings to upgrade them</span>
      </template>
    </p>
  </nav>
</template>
