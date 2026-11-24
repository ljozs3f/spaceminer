<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { AudioSettings } from '../persistence/SaveRepository';

const props = defineProps<{ settings: AudioSettings }>();
const emit = defineEmits<{ change: [settings: AudioSettings] }>();

const open = shallowRef(false);
const root = useTemplateRef('root');

function setMuted(event: Event): void {
  emit('change', { ...props.settings, muted: (event.target as HTMLInputElement).checked });
}

function setVolume(key: 'musicVolume' | 'effectsVolume', event: Event): void {
  emit('change', { ...props.settings, [key]: Number((event.target as HTMLInputElement).value) / 100 });
}

// a click anywhere else (the map, a building, another panel) closes the settings
function closeOutside(event: PointerEvent): void {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOutside, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOutside, true);
});
</script>

<template>
  <div ref="root" class="sound-settings">
    <button
      type="button"
      class="icon-button"
      :aria-label="settings.muted ? 'Sound (muted)' : 'Sound'"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        <path v-if="settings.muted" d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" />
        <path
          v-else
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
        />
      </svg>
    </button>
    <div v-if="open" class="sound-popover">
      <label class="row">
        <input type="checkbox" :checked="settings.muted" @change="setMuted" />
        Mute <kbd>M</kbd>
      </label>
      <label>
        Music
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(settings.musicVolume * 100)"
          @input="setVolume('musicVolume', $event)"
        />
      </label>
      <label>
        Effects
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(settings.effectsVolume * 100)"
          @input="setVolume('effectsVolume', $event)"
        />
      </label>
    </div>
  </div>
</template>
