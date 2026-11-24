<script setup lang="ts">
import { computed } from 'vue';
import { BUILDINGS, cssColor } from '../game/presentation';
import { buildingSprite } from '../game/sprites';
import type { BuildingView } from '../game/views';
import SpriteIcon from './SpriteIcon.vue';

const props = defineProps<{ building: BuildingView }>();
defineEmits<{ upgrade: []; sell: [] }>();

const info = computed(() => BUILDINGS[props.building.type]);
</script>

<template>
  <aside class="side-panel">
    <h2>
      <SpriteIcon
        :sprite="buildingSprite(building.type, building.level)"
        :color="cssColor(info.color)"
        large
      />
      {{ info.name }} <small>level {{ building.level }}</small>
    </h2>
    <dl>
      <div>
        <dt>Hit points</dt>
        <dd>{{ Math.ceil(building.hp) }} / {{ building.maxHp }}</dd>
      </div>
      <div v-for="line in building.stats" :key="line.label">
        <dt>{{ line.label }}</dt>
        <dd>{{ line.value }}</dd>
      </div>
    </dl>
    <div class="panel-actions">
      <button
        v-if="building.upgrade"
        type="button"
        class="primary"
        :disabled="!building.upgrade.affordable"
        @click="$emit('upgrade')"
      >
        Upgrade to level {{ building.upgrade.level }} · {{ building.upgrade.cost }} ore
      </button>
      <p v-else class="muted">Highest level</p>
      <button
        type="button"
        class="danger"
        :disabled="!building.sellable"
        :title="building.sellable ? undefined : 'Your last building cannot be sold'"
        @click="$emit('sell')"
      >
        Sell · +{{ building.sellValue }} ore
      </button>
    </div>
  </aside>
</template>
