<script setup lang="ts">
import { getWaveComposition, type BuildingType, type EntityId, type LevelConfig } from '@space-miner/sim';
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import type { AudioEngine } from '../audio/AudioEngine';
import { GameAudio } from '../audio/GameAudio';
import { EventBus, type AlertKind, type GameEvents, type MapTarget } from '../events';
import { AlertMonitor } from '../game/AlertMonitor';
import { GameSession } from '../game/GameSession';
import { describeSpawnEdges } from '../game/presentation';
import { buttonTip, mapTip } from '../game/tips';
import { vTip, type TipContent } from '../game/tooltip';
import { selectHud, selectSelection, type MapSpot } from '../game/views';
import { createPhaserGame } from '../phaser/createPhaserGame';
import type { MapView } from '../phaser/CameraController';
import { CELL_SIZE } from '../phaser/GameScene';
import BuildBar from './BuildBar.vue';
import AlertStack from './AlertStack.vue';
import AsteroidPanel from './AsteroidPanel.vue';
import BuildingPanel from './BuildingPanel.vue';
import GameMenu from './GameMenu.vue';
import GameOverlay from './GameOverlay.vue';
import GameTooltip from './GameTooltip.vue';
import HudBar from './HudBar.vue';
import MapPopup from './MapPopup.vue';
import UltraInstinctButton from './UltraInstinctButton.vue';
import UltraInstinctOverlay from './UltraInstinctOverlay.vue';
import WaveBanner, { type WaveNotice } from './WaveBanner.vue';

const props = defineProps<{
  level: LevelConfig;
  /** The sector's number as shown ("04"). */
  sector: string;
  seed: number;
  playerId: string;
  hasNextLevel: boolean;
  audio: AudioEngine;
  /** Arriving from the jump of the loading screen: the game fades in from its white flash. */
  arrival: boolean;
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
/** How long the wave alarm banner stays (ms). */
const WAVE_BANNER_MS = 3200;
/** The arrival flash (ms), as in the CSS. */
const ARRIVAL_MS = 900;

const bus = new EventBus<GameEvents>();
const session = new GameSession(props.level, props.seed, props.playerId, bus);
const gameAudio = new GameAudio(props.audio, session, bus);
const alertMonitor = new AlertMonitor(session, bus);
const host = useTemplateRef('host');
const field = useTemplateRef('field');

const hud = shallowRef(selectHud(session.state, props.playerId));
const selectedId = shallowRef<EntityId | null>(null);
const selected = shallowRef(selectSelection(session.state, props.playerId, null));
const placing = shallowRef<BuildingType | null>(null);
const result = shallowRef<'won' | 'lost' | null>(null);
const alerts = shallowRef<readonly { id: number; kind: AlertKind; text: string }[]>([]);
const alertTimers = new Set<number>();
let alertsShown = 0;
/** The pause menu, or the question before leaving or restarting; the game is paused while it is open. */
const menu = shallowRef<'pause' | 'leave' | 'restart' | null>(null);
/** The question was asked from the pause menu: "keep playing" goes back to it. */
let askedFromPause = false;
const wave = shallowRef<WaveNotice | null>(null);
let waveTimer = 0;
const arriving = shallowRef(props.arrival);
/** What the pointer is over on the map, and its tooltip. */
const hovered = shallowRef<MapTarget | null>(null);
const hoverTip = shallowRef<TipContent | null>(null);
const piratesFrom = describeSpawnEdges(props.level.waves);

const ZOOM_TIPS = {
  in: buttonTip('Zoom in', '+ or the mouse wheel'),
  reset: buttonTip('Show the whole map', '0'),
  out: buttonTip('Zoom out', '−'),
} as const;

watch(menu, (open) => {
  session.setPaused(open !== null);
  refreshHoverTip();
});
/** The game runs: not paused and not over. */
const running = computed(() => menu.value === null && result.value === null);

function refresh(): void {
  hud.value = selectHud(session.state, props.playerId);
  selected.value = selectSelection(session.state, props.playerId, selectedId.value);
  refreshHoverTip();
}

/** The selected object shows its popup instead; nothing while a menu is open or the game is over. */
function refreshHoverTip(): void {
  const target = hovered.value;
  const quiet = !target || target.id === selectedId.value || menu.value !== null || result.value !== null;
  hoverTip.value = quiet ? null : mapTip(session.state, props.playerId, target);
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
  bus.on('hover:change', (target) => {
    hovered.value = target;
    refreshHoverTip();
  }),
  bus.on('alert', ({ kind, text }) => {
    showAlert(kind, text);
  }),
  bus.on('game:over', (status) => {
    result.value = status;
    refreshHoverTip();
    if (status === 'won') emit('won', props.level);
  }),
  bus.on('view:change', (next) => {
    view.value = next;
  }),
  bus.on('sim:events', (events) => {
    for (const event of events) {
      if (event.type !== 'waveStarted') continue;
      wave.value = {
        number: event.index + 1,
        ships: getWaveComposition(props.level.waves, event.index).map(({ type, count }) => ({ type, count })),
        from: describeSpawnEdges(props.level.waves),
      };
      window.clearTimeout(waveTimer);
      waveTimer = window.setTimeout(() => {
        wave.value = null;
      }, WAVE_BANNER_MS);
    }
  }),
];

/**
 * Anything that leaves the running game asks first: the session cannot be continued later, the sector
 * starts over. After the game is over nothing is lost, so it just leaves. App calls this for the browser's
 * back button too.
 */
function requestExit(): void {
  if (result.value) emit('exit');
  else ask('leave', false);
}

function ask(question: 'leave' | 'restart', fromPause: boolean): void {
  askedFromPause = fromPause;
  menu.value = question;
}

function openPause(): void {
  if (!result.value) menu.value = 'pause';
}

function resume(): void {
  menu.value = null;
}

function cancelQuestion(): void {
  menu.value = askedFromPause ? 'pause' : null;
}

function confirmQuestion(): void {
  const question = menu.value;
  menu.value = null;
  if (question === 'leave') emit('exit');
  else if (question === 'restart') emit('restart', props.level);
}

/** Closing the tab, reloading or typing another address: the browser asks (it shows its own words). */
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!result.value) event.preventDefault();
}

defineExpose({ requestExit });

let game: ReturnType<typeof createPhaserGame> | undefined;

/** The part of the map in view (zoom and pan). */
const view = shallowRef<MapView>({ left: 0, top: 0, zoom: 1 });
/** Where the selected object is on screen (pixels within the map area), for the popup next to it. */
const anchor = shallowRef<{ x: number; y: number; radius: number } | null>(null);

function updateAnchor(): void {
  const spot: MapSpot | undefined = selected.value?.spot;
  const canvas = game?.canvas;
  if (!spot || !canvas || !field.value) {
    anchor.value = null;
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const fieldRect = field.value.getBoundingClientRect();
  // map pixels to game-canvas pixels (zoom and pan), then to CSS pixels (the canvas is scaled to fit)
  const scale = (canvasRect.width / (props.level.width * CELL_SIZE)) * view.value.zoom;
  const x = (spot.x * CELL_SIZE - view.value.left) * scale;
  const y = (spot.y * CELL_SIZE - view.value.top) * scale;
  // an object panned out of view has no popup
  if (x < 0 || y < 0 || x > canvasRect.width || y > canvasRect.height) {
    anchor.value = null;
    return;
  }
  const next = {
    x: canvasRect.left - fieldRect.left + x,
    y: canvasRect.top - fieldRect.top + y,
    radius: spot.radius * CELL_SIZE * scale,
  };
  const current = anchor.value;
  if (current?.x !== next.x || current.y !== next.y || current.radius !== next.radius) anchor.value = next;
}

watch(() => selected.value?.id, updateAnchor);
watch(view, updateAnchor);
const zoomPercent = computed(() => Math.round(view.value.zoom * 100));

function zoom(action: 'in' | 'out' | 'reset'): void {
  bus.emit('view:zoom', action);
}
const resizeObserver = new ResizeObserver(updateAnchor);

/**
 * Listens before the map (capture phase): Esc first cancels placing and the selection (the map does that),
 * and with nothing to cancel it pauses; P pauses too. While the menu is open the map gets no keys.
 */
function onKeyDown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (menu.value !== null) {
    if (key === 'escape' || key === 'p') {
      event.preventDefault();
      event.stopPropagation();
      if (menu.value === 'pause') resume();
      else cancelQuestion();
    } else if (!['m', 'enter', ' ', 'tab'].includes(key)) {
      event.stopPropagation();
    }
    return;
  }
  if (result.value) return;
  if (key === 'p' || (key === 'escape' && placing.value === null && selectedId.value === null)) {
    event.stopPropagation();
    openPause();
    return;
  }
  if (key === 'u' && selected.value?.kind === 'building') upgradeSelected();
  if (key === 'i' && !event.repeat) ultraInstinct();
}

onMounted(() => {
  if (host.value) game = createPhaserGame(host.value, session, bus);
  if (field.value) resizeObserver.observe(field.value);
  // the canvas is scaled to fit the map area, a little after the area itself changes size
  if (game?.canvas) resizeObserver.observe(game.canvas);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('beforeunload', onBeforeUnload);
  if (props.arrival) {
    props.audio.play('warpOut');
    alertTimers.add(
      window.setTimeout(() => {
        arriving.value = false;
      }, ARRIVAL_MS),
    );
  }
});

onBeforeUnmount(() => {
  resizeObserver.disconnect();
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('beforeunload', onBeforeUnload);
  window.clearTimeout(waveTimer);
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

function ultraInstinct(): void {
  bus.emit('command', { type: 'ultraInstinct', playerId: props.playerId });
}

function sellSelected(): void {
  if (selectedId.value === null) return;
  bus.emit('command', { type: 'sellBuilding', playerId: props.playerId, buildingId: selectedId.value });
}

function closeSelection(): void {
  bus.emit('selection:change', null);
}
</script>

<template>
  <div class="game-view">
    <HudBar
      :hud="hud"
      :level-name="level.name"
      :pirates-from="piratesFrom"
      @exit="requestExit"
      @pause="openPause"
    />
    <div ref="field" class="field">
      <div ref="host" class="canvas-host" />
      <MapPopup v-if="selected && anchor" :key="selected.id" :anchor="anchor">
        <BuildingPanel
          v-if="selected.kind === 'building'"
          :building="selected"
          @upgrade="upgradeSelected"
          @sell="sellSelected"
          @close="closeSelection"
        />
        <AsteroidPanel v-else :asteroid="selected" @close="closeSelection" />
      </MapPopup>
      <UltraInstinctOverlay :view="hud.ultraInstinct" :audio="audio" :running="running" />
      <WaveBanner :wave="wave" />
      <AlertStack :alerts="alerts" />
      <div class="zoom-controls" role="group" aria-label="Zoom">
        <button v-tip="ZOOM_TIPS.in" type="button" aria-label="Zoom in" @click="zoom('in')">+</button>
        <button
          v-tip="ZOOM_TIPS.reset"
          type="button"
          class="zoom-level"
          aria-label="Show the whole map"
          @click="zoom('reset')"
        >
          {{ zoomPercent }}%
        </button>
        <button v-tip="ZOOM_TIPS.out" type="button" aria-label="Zoom out" @click="zoom('out')">−</button>
        <span v-if="view.zoom > 1" class="zoom-hint">Drag or WASD to pan</span>
      </div>
      <UltraInstinctButton v-if="!result" :view="hud.ultraInstinct" @activate="ultraInstinct" />
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
    <GameMenu
      v-if="menu && !result"
      :key="menu"
      :mode="menu"
      :level-name="level.name"
      :sector="sector"
      @resume="resume"
      @restart="ask('restart', true)"
      @leave="ask('leave', true)"
      @confirm="confirmQuestion"
      @cancel="cancelQuestion"
    />
    <GameTooltip :map-tip="hoverTip" />
    <div v-if="arriving" class="arrival-flash" aria-hidden="true" />
  </div>
</template>
