<script setup lang="ts">
import type { BuildingType, EntityId, LevelConfig } from '@space-miner/sim';
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { AudioEngine } from '../audio/AudioEngine';
import { GameAudio } from '../audio/GameAudio';
import { EventBus, type AlertKind, type GameEvents } from '../events';
import { AlertMonitor } from '../game/AlertMonitor';
import { GameSession } from '../game/GameSession';
import { selectHud, selectSelection } from '../game/views';
import { createPhaserGame } from '../phaser/createPhaserGame';
import BuildBar from './BuildBar.vue';
import AlertStack from './AlertStack.vue';
import AsteroidPanel from './AsteroidPanel.vue';
import BuildingPanel from './BuildingPanel.vue';
import GameOverlay from './GameOverlay.vue';
import HudBar from './HudBar.vue';

const props = defineProps<{
  level: LevelConfig;
  seed: number;
  playerId: string;
  hasNextLevel: boolean;
  audio: AudioEngine;
}>();
const emit = defineEmits<{
  won: [level: LevelConfig];
  restart: [level: LevelConfig];
  next: [level: LevelConfig];
  exit: [];
}>();

/** How long alerts stay on screen (ms), and how many at most. */
const ALERT_MS: Readonly<Record<AlertKind, number>> = {
  info: 5000,
  warning: 6000,
  danger: 4000,
  error: 2500,
};
const MAX_ALERTS = 4;

const bus = new EventBus<GameEvents>();
const session = new GameSession(props.level, props.seed, props.playerId, bus);
const gameAudio = new GameAudio(props.audio, session, bus);
const alertMonitor = new AlertMonitor(session, bus);
const host = useTemplateRef('host');

const hud = shallowRef(selectHud(session.state, props.playerId));
const selectedId = shallowRef<EntityId | null>(null);
const selected = shallowRef(selectSelection(session.state, props.playerId, null));
const placing = shallowRef<BuildingType | null>(null);
const result = shallowRef<'won' | 'lost' | null>(null);
const alerts = shallowRef<readonly { id: number; kind: AlertKind; text: string }[]>([]);
const alertTimers = new Set<number>();
let alertsShown = 0;

function refresh(): void {
  hud.value = selectHud(session.state, props.playerId);
  selected.value = selectSelection(session.state, props.playerId, selectedId.value);
}

function showAlert(kind: AlertKind, text: string): void {
  const id = ++alertsShown;
  alerts.value = [...alerts.value, { id, kind, text }].slice(-MAX_ALERTS);
  const timer = window.setTimeout(() => {
    alertTimers.delete(timer);
    alerts.value = alerts.value.filter((alert) => alert.id !== id);
  }, ALERT_MS[kind]);
  alertTimers.add(timer);
}

const unsubscribers = [
  bus.on('tick', refresh),
  bus.on('selection:change', (id) => {
    selectedId.value = id;
    refresh();
  }),
  bus.on('placement:select', (type) => {
    placing.value = type;
  }),
  bus.on('alert', ({ kind, text }) => {
    showAlert(kind, text);
  }),
  bus.on('game:over', (status) => {
    result.value = status;
    if (status === 'won') emit('won', props.level);
  }),
];

let game: ReturnType<typeof createPhaserGame> | undefined;

onMounted(() => {
  if (host.value) game = createPhaserGame(host.value, session, bus);
});

onBeforeUnmount(() => {
  for (const timer of alertTimers) window.clearTimeout(timer);
  for (const unsubscribe of unsubscribers) unsubscribe();
  alertMonitor.dispose();
  gameAudio.dispose();
  session.dispose();
  game?.destroy(true);
});

function selectPlacement(type: BuildingType | null): void {
  bus.emit('placement:select', type);
}

function upgradeSelected(): void {
  if (selectedId.value === null) return;
  bus.emit('command', { type: 'upgradeBuilding', playerId: props.playerId, buildingId: selectedId.value });
}

function sellSelected(): void {
  if (selectedId.value === null) return;
  bus.emit('command', { type: 'sellBuilding', playerId: props.playerId, buildingId: selectedId.value });
}
</script>

<template>
  <div class="game-view">
    <HudBar :hud="hud" :level-name="level.name" @exit="emit('exit')" />
    <div class="field">
      <div ref="host" class="canvas-host" />
      <BuildingPanel
        v-if="selected?.kind === 'building'"
        :building="selected"
        @upgrade="upgradeSelected"
        @sell="sellSelected"
      />
      <AsteroidPanel v-else-if="selected?.kind === 'asteroid'" :asteroid="selected" />
      <AlertStack :alerts="alerts" />
      <GameOverlay
        v-if="result"
        :status="result"
        :has-next-level="hasNextLevel"
        @restart="emit('restart', level)"
        @next="emit('next', level)"
        @exit="emit('exit')"
      />
    </div>
    <BuildBar :ore="hud.ore" :placing="placing" @select="selectPlacement" />
  </div>
</template>
