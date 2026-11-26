<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';

/**
 * Over a paused game: the pause menu, or the question before something that throws the running game away
 * (leaving the sector, restarting it). The safe choice has the focus, so Enter or Esc keeps the game.
 */
const props = defineProps<{ mode: 'pause' | 'leave' | 'restart'; levelName: string; sector: string }>();
const emit = defineEmits<{
  resume: [];
  restart: [];
  leave: [];
  confirm: [];
  cancel: [];
}>();

const safe = useTemplateRef<HTMLButtonElement>('safe');

onMounted(() => {
  safe.value?.focus();
});

const title = props.mode === 'leave' ? 'Leave this sector?' : 'Restart this sector?';
</script>

<template>
  <div class="overlay game-menu" role="dialog" aria-modal="true" aria-labelledby="game-menu-title">
    <div v-if="mode === 'pause'" class="card menu-card">
      <p class="menu-kicker">Paused</p>
      <h2 id="game-menu-title">Sector {{ sector }} · {{ levelName }}</h2>
      <div class="menu-actions">
        <button ref="safe" type="button" class="primary" @click="emit('resume')">
          Resume <kbd>Esc</kbd>
        </button>
        <button type="button" @click="emit('restart')">Restart sector</button>
        <button type="button" class="danger" @click="emit('leave')">Leave to the menu</button>
      </div>
      <p class="menu-note">The pirates wait while the game is paused.</p>
    </div>
    <div v-else class="card menu-card warning">
      <span class="warn-mark" aria-hidden="true">!</span>
      <h2 id="game-menu-title">{{ title }}</h2>
      <p>
        <strong>This game session will be lost:</strong> your buildings, your ore and the waves you held off
        are gone for good.
        {{
          mode === 'leave'
            ? `To play Sector ${sector} again you will have to start it from the beginning.`
            : `Sector ${sector} starts over from the beginning.`
        }}
      </p>
      <div class="menu-actions row">
        <button ref="safe" type="button" class="primary" @click="emit('cancel')">Keep playing</button>
        <button type="button" class="danger" @click="emit('confirm')">
          {{ mode === 'leave' ? 'Leave and lose it' : 'Restart from scratch' }}
        </button>
      </div>
    </div>
  </div>
</template>
