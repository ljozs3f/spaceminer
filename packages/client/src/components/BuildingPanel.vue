<script setup lang="ts">
import { computed } from 'vue';
import { BUILDINGS, cssColor } from '../game/presentation';
import { buildingSprite } from '../game/sprites';
import type { BuildingView } from '../game/views';
import SpriteIcon from './SpriteIcon.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ building: BuildingView }>();
defineEmits<{ upgrade: []; sell: []; close: [] }>();

const MAX_LEVEL = 3;

const info = computed(() => BUILDINGS[props.building.type]);
const color = computed(() => cssColor(info.value.color));
const hpFraction = computed(() => Math.max(0, props.building.hp / props.building.maxHp));
/** The stats with what the next level would change. */
const rows = computed(() =>
  props.building.stats.map((line, index) => {
    const next = props.building.upgrade?.stats[index];
    return { ...line, next: next && next.value !== line.value ? next.value : null };
  }),
);
</script>

<template>
  <div class="popup-card" :style="{ '--accent-color': color }">
    <header class="popup-header">
      <span class="popup-icon">
        <SpriteIcon :sprite="buildingSprite(building.type, building.level)" :color="color" large />
      </span>
      <span class="popup-title">
        <strong>{{ info.name }}</strong>
        <span class="level-pips" :aria-label="`Level ${building.level} of ${MAX_LEVEL}`">
          <span
            v-for="level in MAX_LEVEL"
            :key="level"
            class="pip"
            :class="{ on: level <= building.level }"
          />
          <small>Level {{ building.level }}</small>
        </span>
      </span>
      <button type="button" class="popup-close" aria-label="Close" @click="$emit('close')">
        <UiIcon name="close" />
      </button>
    </header>

    <div class="popup-hp" :class="{ low: hpFraction < 0.35 }">
      <UiIcon name="heart" />
      <span class="meter"><span class="fill" :style="{ width: `${hpFraction * 100}%` }" /></span>
      <span class="value">{{ Math.ceil(building.hp) }} / {{ building.maxHp }}</span>
    </div>

    <dl class="popup-stats">
      <div v-for="row in rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>
          {{ row.value }}
          <span v-if="row.next" class="next">→ {{ row.next }}</span>
        </dd>
      </div>
    </dl>

    <div class="popup-actions">
      <button
        v-if="building.upgrade"
        type="button"
        class="upgrade-button"
        :class="{ ready: building.upgrade.affordable }"
        :disabled="!building.upgrade.affordable"
        @click="$emit('upgrade')"
      >
        <UiIcon name="upgrade" />
        <span class="label">Upgrade to level {{ building.upgrade.level }}</span>
        <span class="cost"><UiIcon name="ore" />{{ building.upgrade.cost }}</span>
        <kbd>U</kbd>
      </button>
      <p v-if="building.upgrade && !building.upgrade.affordable" class="missing">
        {{ building.upgrade.missing }} more ore needed
      </p>
      <p v-if="!building.upgrade" class="maxed">Fully upgraded</p>
      <button
        type="button"
        class="sell-button"
        :disabled="!building.sellable"
        :title="building.sellable ? undefined : 'Your last building cannot be sold'"
        @click="$emit('sell')"
      >
        <UiIcon name="sell" />
        Sell
        <span class="cost">+{{ building.sellValue }}</span>
      </button>
    </div>
  </div>
</template>
