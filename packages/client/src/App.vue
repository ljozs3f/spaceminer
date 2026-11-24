<script setup lang="ts">
import { LEVELS, type LevelConfig } from '@space-miner/sim';
import { onBeforeUnmount, onMounted, shallowRef, watchEffect } from 'vue';
import type { AudioEngine } from './audio/AudioEngine';
import GameView from './components/GameView.vue';
import LevelSelect from './components/LevelSelect.vue';
import MainMenu from './components/MainMenu.vue';
import SoundSettings from './components/SoundSettings.vue';
import { withLevelCompleted } from './persistence/progress';
import type { AudioSettings, SaveData, SaveRepository } from './persistence/SaveRepository';

const props = defineProps<{ saves: SaveRepository; audio: AudioEngine }>();

type Screen =
  | { readonly name: 'menu' }
  | { readonly name: 'levels' }
  | { readonly name: 'game'; readonly id: number; readonly level: LevelConfig; readonly seed: number };

const screen = shallowRef<Screen>({ name: 'menu' });
const save = shallowRef<SaveData | null>(null);
let gamesStarted = 0;

watchEffect(() => {
  props.audio.setMusicScene(screen.value.name === 'game' ? 'game' : 'menu');
});

// browsers start audio only after a user gesture
function unlockAudio(): void {
  props.audio.unlock();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key.toLowerCase() === 'm' && !event.ctrlKey && !event.metaKey && !event.altKey && save.value) {
    void updateAudio({ ...save.value.audio, muted: !save.value.audio.muted });
  }
}

onMounted(async () => {
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('keydown', onKeyDown);
  save.value = await props.saves.load();
  props.audio.applySettings(save.value.audio);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('keydown', onKeyDown);
});

async function updateAudio(settings: AudioSettings): Promise<void> {
  if (!save.value) return;
  save.value = { ...save.value, audio: settings };
  props.audio.applySettings(settings);
  await props.saves.save(save.value);
}

function play(level: LevelConfig): void {
  const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
  screen.value = { name: 'game', id: ++gamesStarted, level, seed };
}

function nextLevel(level: LevelConfig): LevelConfig | undefined {
  return LEVELS[LEVELS.findIndex((candidate) => candidate.id === level.id) + 1];
}

async function onWon(level: LevelConfig): Promise<void> {
  if (!save.value) return;
  save.value = withLevelCompleted(save.value, level.id);
  await props.saves.save(save.value);
}

function onNext(level: LevelConfig): void {
  const next = nextLevel(level);
  if (next) play(next);
}
</script>

<template>
  <p v-if="!save" class="loading">Loading…</p>
  <template v-else>
    <MainMenu v-if="screen.name === 'menu'" @play="screen = { name: 'levels' }" />
    <LevelSelect
      v-else-if="screen.name === 'levels'"
      :save="save"
      @play="play"
      @back="screen = { name: 'menu' }"
    />
    <GameView
      v-else
      :key="screen.id"
      :level="screen.level"
      :seed="screen.seed"
      :player-id="save.playerId"
      :has-next-level="nextLevel(screen.level) !== undefined"
      :audio="audio"
      @won="onWon"
      @restart="play"
      @next="onNext"
      @exit="screen = { name: 'levels' }"
    />
    <SoundSettings :settings="save.audio" @change="updateAudio" />
  </template>
</template>
