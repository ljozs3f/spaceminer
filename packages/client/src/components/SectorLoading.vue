<script setup lang="ts">
import { ENEMY_TYPES, LEVELS, type LevelConfig } from '@space-miner/sim';
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { AudioEngine } from '../audio/AudioEngine';
import {
  cssColor,
  describeSpawnEdges,
  ENEMIES,
  LEVEL_INFO,
  MAX_DIFFICULTY,
  TIPS,
} from '../game/presentation';
import { shipSprite } from '../game/sprites';
import { WarpField } from '../intro/WarpField';
import SpriteIcon from './SpriteIcon.vue';
import UiIcon from './UiIcon.vue';

/**
 * The jump to a sector: the briefing of the sector over a warp field that spools up, then the jump (a white
 * flash the game view fades in from). A click or Space, Enter or Esc jumps at once.
 */
const props = defineProps<{ level: LevelConfig; audio: AudioEngine }>();
const emit = defineEmits<{ done: [] }>();

/** Seconds: the jump, and when the warpIn sound starts so that its own jump (at 2.12 s) lands on it. */
const JUMP = 3.4;
const SOUND_AT = JUMP - 2.12;

const canvas = useTemplateRef('canvas');
const elapsed = shallowRef(0);
const index = LEVELS.findIndex((level) => level.id === props.level.id);
const number = String(index + 1).padStart(2, '0');
const info = LEVEL_INFO[props.level.id];
const tip = TIPS[Math.floor(Math.random() * TIPS.length)] ?? '';
const firstWave = `0:${String(props.level.waves.firstWaveSeconds).padStart(2, '0')}`;
const threats = ENEMY_TYPES.flatMap((type) => {
  const group = props.level.waves.groups.find((candidate) => candidate.type === type);
  return group
    ? [{ type, name: ENEMIES[type].name, color: cssColor(ENEMIES[type].color), wave: group.fromWave + 1 }]
    : [];
});
const status = computed(() => {
  if (elapsed.value < SOUND_AT) return 'Plotting the jump';
  if (elapsed.value < JUMP - 0.5) return 'Charging the drive';
  return 'Jump';
});

let field: WarpField | null = null;
let frame = 0;
let startMs = 0;
let lastMs = 0;
let soundPlayed = false;
let jumped = false;

function draw(nowMs: number): void {
  frame = requestAnimationFrame(draw);
  const seconds = Math.min(0.1, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  const t = (nowMs - startMs) / 1000;
  elapsed.value = t;
  if (field) {
    field.target = t < SOUND_AT ? 0.1 : 0.1 + 0.7 * ((t - SOUND_AT) / (JUMP - SOUND_AT)) ** 2;
    field.draw(seconds);
  }
  if (!soundPlayed && t >= SOUND_AT) {
    soundPlayed = true;
    props.audio.play('warpIn');
  }
  if (t >= JUMP) jump();
}

function jump(): void {
  if (jumped) return;
  jumped = true;
  field?.flash(1);
  emit('done');
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    jump();
  }
}

function onResize(): void {
  field?.resize();
}

onMounted(() => {
  if (canvas.value) field = new WarpField(canvas.value);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  startMs = lastMs = performance.now();
  frame = requestAnimationFrame(draw);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="sector-loading" @pointerdown="jump">
    <canvas ref="canvas" class="boot-canvas" aria-hidden="true" />
    <section class="jump-card" aria-live="polite">
      <p class="menu-kicker">Sector {{ number }} / {{ String(LEVELS.length).padStart(2, '0') }}</p>
      <h1 class="jump-name">{{ level.name }}</h1>
      <p class="jump-blurb">{{ info?.blurb }}</p>
      <span class="difficulty large" :aria-label="`Difficulty ${info?.difficulty ?? 1} of ${MAX_DIFFICULTY}`">
        <span v-for="pip in MAX_DIFFICULTY" :key="pip" :class="{ on: pip <= (info?.difficulty ?? 1) }" />
      </span>
      <dl class="jump-facts">
        <div>
          <dt>First wave</dt>
          <dd>{{ firstWave }}</dd>
        </div>
        <div>
          <dt>Then every</dt>
          <dd>{{ level.waves.intervalSeconds }} s</dd>
        </div>
        <div>
          <dt>Pirates from</dt>
          <dd>{{ describeSpawnEdges(level.waves) }}</dd>
        </div>
        <div>
          <dt>Starting ore</dt>
          <dd><UiIcon name="ore" />{{ level.startingOre }}</dd>
        </div>
      </dl>
      <ul class="jump-threats">
        <li v-for="threat in threats" :key="threat.type">
          <SpriteIcon :sprite="shipSprite(threat.type)" :color="threat.color" />
          <span>
            <strong>{{ threat.name }}</strong>
            <small>{{ threat.wave === 1 ? 'from the first wave' : `from wave ${threat.wave}` }}</small>
          </span>
        </li>
      </ul>
      <p class="jump-tip"><b>Tip</b> {{ tip }}</p>
      <div class="jump-progress">
        <span class="fill" :style="{ width: `${Math.min(100, (elapsed / JUMP) * 100)}%` }" />
      </div>
      <p class="jump-status">
        <span>{{ status }}…</span>
        <span class="boot-hint">Click or <kbd>Space</kbd> to jump now</span>
      </p>
    </section>
  </div>
</template>
