<script setup lang="ts">
import {
  BUILDING_TYPES,
  getBuildingStats,
  LEVELS,
  MINING_MODE_CONFIG,
  ULTRA_INSTINCT_CONFIG,
  type LevelConfig,
} from '@space-miner/sim';
import { computed } from 'vue';
import { BUILDINGS, cssColor, LEVEL_INFO, MAX_DIFFICULTY } from '../game/presentation';
import { buildingSprite } from '../game/sprites';
import { isLevelUnlocked } from '../persistence/progress';
import type { SaveData } from '../persistence/SaveRepository';
import MenuBackdrop from './MenuBackdrop.vue';
import SpriteIcon from './SpriteIcon.vue';
import UiIcon from './UiIcon.vue';

const props = defineProps<{ save: SaveData }>();
const emit = defineEmits<{ play: [level: LevelConfig]; credits: [] }>();

const goalPercent = Math.round(MINING_MODE_CONFIG.winMinedOreFraction * 100);

const ultra = ULTRA_INSTINCT_CONFIG;
const ultraLine =
  `everything ×${String(ultra.multiplier)} for ${String(ultra.durationSeconds)} s, ` +
  `then ÷${String(ultra.burnoutDivisor)} for ${String(ultra.burnoutSeconds)} s`;

const sectors = computed(() =>
  LEVELS.map((level, index) => ({
    level,
    number: String(index + 1).padStart(2, '0'),
    blurb: LEVEL_INFO[level.id]?.blurb ?? '',
    difficulty: LEVEL_INFO[level.id]?.difficulty ?? 1,
    unlocked: isLevelUnlocked(props.save, level.id),
    completed: props.save.completedLevelIds.includes(level.id),
  })),
);

/** The first open level not yet won, or the last open one: what the big button plays. */
const next = computed(() => {
  const open = sectors.value.filter((sector) => sector.unlocked);
  return open.find((sector) => !sector.completed) ?? open[open.length - 1];
});
const started = computed(() => props.save.completedLevelIds.length > 0);

const roster = BUILDING_TYPES.map((type, index) => ({
  type,
  key: index + 1,
  name: BUILDINGS[type].name,
  description: BUILDINGS[type].description,
  color: cssColor(BUILDINGS[type].color),
  sprite: buildingSprite(type, 1),
  cost: getBuildingStats(type, 1).cost,
}));

const steps = [
  {
    title: 'Mine',
    text: 'Build mines next to asteroids. Their glow fades as they run dry; ore pays for everything.',
  },
  {
    title: 'Power',
    text: 'Solar panels power mines, turrets and hives. Short on energy, everything slows down.',
  },
  { title: 'Defend', text: 'Pirates attack in waves. Lasers and missiles shoot, Mender Hive drones repair.' },
  {
    title: 'Win',
    text: `Mine ${String(goalPercent)}% of the sector's ore. Lose every building and it is lost.`,
  },
] as const;
</script>

<template>
  <main class="menu-screen">
    <MenuBackdrop />
    <div class="menu-shade" aria-hidden="true" />
    <div class="menu-layout">
      <section class="menu-hero">
        <p class="menu-kicker">Asteroid mining · Base defense</p>
        <h1 class="logo"><span>Space</span>Miner</h1>
        <p class="tagline">Mine the belt. Hold the line.</p>

        <button v-if="next" type="button" class="cta" @click="emit('play', next.level)">
          <span class="cta-play" aria-hidden="true" />
          <span class="cta-text">
            <strong>{{ started ? 'Continue' : 'Start' }}</strong>
            <small>Sector {{ next.number }} · {{ next.level.name }}</small>
          </span>
        </button>

        <h2 class="menu-heading">
          Sectors <small>{{ save.completedLevelIds.length }} / {{ sectors.length }} cleared</small>
        </h2>
        <ol class="sectors">
          <li v-for="sector in sectors" :key="sector.level.id">
            <button
              type="button"
              class="sector"
              :class="{ completed: sector.completed, current: sector === next }"
              :disabled="!sector.unlocked"
              :title="sector.blurb"
              @click="emit('play', sector.level)"
            >
              <span class="sector-number">{{ sector.number }}</span>
              <span class="sector-body">
                <strong>{{ sector.level.name }}</strong>
                <small>{{ sector.blurb }}</small>
              </span>
              <span class="sector-meta">
                <span class="difficulty" :aria-label="`Difficulty ${sector.difficulty} of ${MAX_DIFFICULTY}`">
                  <span v-for="pip in MAX_DIFFICULTY" :key="pip" :class="{ on: pip <= sector.difficulty }" />
                </span>
                <span class="sector-state">
                  {{ sector.completed ? 'Cleared' : sector.unlocked ? 'Open' : 'Locked' }}
                </span>
              </span>
            </button>
          </li>
        </ol>

        <button type="button" class="menu-link" @click="emit('credits')">Credits</button>
      </section>

      <aside class="briefing">
        <h2 class="menu-heading">Briefing</h2>
        <ol class="steps">
          <li v-for="(step, index) in steps" :key="step.title">
            <span class="step-number">{{ index + 1 }}</span>
            <span>
              <strong>{{ step.title }}</strong>
              {{ step.text }}
            </span>
          </li>
        </ol>

        <h2 class="menu-heading">Your buildings</h2>
        <ul class="roster">
          <li v-for="item in roster" :key="item.type" :style="{ '--build-color': item.color }">
            <span class="roster-icon"><SpriteIcon :sprite="item.sprite" :color="item.color" large /></span>
            <span class="roster-text">
              <strong>{{ item.name }}</strong>
              <small>{{ item.description }}</small>
            </span>
            <span class="roster-cost"><UiIcon name="ore" />{{ item.cost }}</span>
          </li>
        </ul>

        <h2 class="menu-heading">Controls</h2>
        <ul class="controls">
          <li>
            <kbd>1</kbd>–<kbd>{{ roster.length }}</kbd> pick a building, click to place
          </li>
          <li>Click a building to upgrade <kbd>U</kbd> or sell it</li>
          <li><kbd>I</kbd> Ultra Instinct: {{ ultraLine }}</li>
          <li><kbd>Wheel</kbd> zoom · drag or <kbd>WASD</kbd> pan</li>
          <li>
            <kbd>Esc</kbd> / right click cancel · <kbd>Esc</kbd> / <kbd>P</kbd> pause · <kbd>M</kbd> mute
          </li>
        </ul>
      </aside>
    </div>
  </main>
</template>
