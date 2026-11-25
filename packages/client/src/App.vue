<script setup lang="ts">
import { LEVELS, type LevelConfig } from '@space-miner/sim';
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watchEffect } from 'vue';
import type { AudioEngine } from './audio/AudioEngine';
import BootScreen from './components/BootScreen.vue';
import GameView from './components/GameView.vue';
import MainMenu from './components/MainMenu.vue';
import SectorLoading from './components/SectorLoading.vue';
import SoundSettings from './components/SoundSettings.vue';
import { withLevelCompleted } from './persistence/progress';
import type { AudioSettings, SaveData, SaveRepository } from './persistence/SaveRepository';

const props = defineProps<{ saves: SaveRepository; audio: AudioEngine }>();

interface Sortie {
  readonly id: number;
  readonly level: LevelConfig;
  readonly seed: number;
}

type Screen =
  | { readonly name: 'boot' }
  | { readonly name: 'menu' }
  | ({ readonly name: 'loading' } & Sortie)
  /** arrival: came from the loading screen's jump (a restart starts right away). */
  | ({ readonly name: 'game'; readonly arrival: boolean } & Sortie);

const screen = shallowRef<Screen>({ name: 'boot' });
const save = shallowRef<SaveData | null>(null);
const gameView = useTemplateRef('gameView');
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

/**
 * The browser's back button must not throw a running game away unasked: while a sector is on, the history
 * holds one extra entry. Going back lands on the entry before it; the game puts its entry back and asks.
 */
const HISTORY_MARK = 'space-miner-sector';
/** The next popstate is our own history.back() on the way to the menu. */
let leavingHistory = false;

function inSectorHistory(): boolean {
  return (history.state as Record<string, unknown> | null)?.[HISTORY_MARK] === true;
}

function enterSectorHistory(): void {
  if (!inSectorHistory()) history.pushState({ [HISTORY_MARK]: true }, '');
}

function leaveSectorHistory(): void {
  if (!inSectorHistory()) return;
  leavingHistory = true;
  history.back();
}

function onPopState(): void {
  if (leavingHistory) {
    leavingHistory = false;
    return;
  }
  const current = screen.value;
  if (current.name === 'loading') {
    // nothing is lost yet
    screen.value = { name: 'menu' };
  } else if (current.name === 'game') {
    history.pushState({ [HISTORY_MARK]: true }, '');
    gameView.value?.requestExit();
  }
}

onMounted(async () => {
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('popstate', onPopState);
  save.value = await props.saves.load();
  props.audio.applySettings(save.value.audio);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('popstate', onPopState);
});

async function updateAudio(settings: AudioSettings): Promise<void> {
  if (!save.value) return;
  save.value = { ...save.value, audio: settings };
  props.audio.applySettings(settings);
  await props.saves.save(save.value);
}

function sortie(level: LevelConfig): Sortie {
  const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
  return { id: ++gamesStarted, level, seed };
}

/** From the menu or to the next level: the jump with the sector's briefing first. */
function play(level: LevelConfig): void {
  enterSectorHistory();
  screen.value = { name: 'loading', ...sortie(level) };
}

function restart(level: LevelConfig): void {
  enterSectorHistory();
  screen.value = { name: 'game', arrival: false, ...sortie(level) };
}

function deploy(): void {
  const current = screen.value;
  if (current.name === 'loading') screen.value = { ...current, name: 'game', arrival: true };
}

function toMenu(): void {
  leaveSectorHistory();
  screen.value = { name: 'menu' };
}

function sectorNumber(level: LevelConfig): string {
  return String(LEVELS.findIndex((candidate) => candidate.id === level.id) + 1).padStart(2, '0');
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
  <BootScreen v-if="screen.name === 'boot' || !save" :audio="audio" @done="screen = { name: 'menu' }" />
  <template v-else>
    <MainMenu v-if="screen.name === 'menu'" :save="save" @play="play" />
    <SectorLoading
      v-else-if="screen.name === 'loading'"
      :key="`loading-${screen.id}`"
      :level="screen.level"
      :audio="audio"
      @done="deploy"
    />
    <GameView
      v-else
      ref="gameView"
      :key="screen.id"
      :level="screen.level"
      :sector="sectorNumber(screen.level)"
      :seed="screen.seed"
      :player-id="save.playerId"
      :has-next-level="nextLevel(screen.level) !== undefined"
      :audio="audio"
      :arrival="screen.arrival"
      @won="onWon"
      @restart="restart"
      @next="onNext"
      @exit="toMenu"
    />
  </template>
  <SoundSettings v-if="save" :settings="save.audio" @change="updateAudio" />
</template>
