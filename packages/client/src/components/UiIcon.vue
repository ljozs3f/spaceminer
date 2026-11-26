<script setup lang="ts">
/** Small line icons for the HUD, drawn in the current text color. */
defineProps<{
  name: 'ore' | 'energy' | 'target' | 'wave' | 'back' | 'close' | 'upgrade' | 'sell' | 'heart' | 'pause';
}>();
</script>

<template>
  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="name === 'ore'">
      <path d="M12 2.5 19.5 8 16.5 20h-9L4.5 8z" fill="currentColor" opacity="0.25" />
      <path
        d="M12 2.5 19.5 8 16.5 20h-9L4.5 8zM4.5 8h15M12 2.5 9 8l3 12 3-12z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </template>
    <path v-else-if="name === 'energy'" d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor" />
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </template>
    <template v-else-if="name === 'wave'">
      <path d="M12 3 20 20 12 15.5 4 20z" fill="currentColor" opacity="0.25" />
      <path
        d="M12 3 20 20 12 15.5 4 20z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </template>
    <path
      v-else-if="name === 'back'"
      d="M14.5 5 7.5 12l7 7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'close'"
      d="M6 6l12 12M18 6 6 18"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path v-else-if="name === 'pause'" d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" fill="currentColor" />
    <path v-else-if="name === 'upgrade'" d="M12 4 5 11h4.5v9h5v-9H19z" fill="currentColor" />
    <path v-else-if="name === 'sell'" d="M12 20 5 13h4.5V4h5v9H19z" fill="currentColor" opacity="0.85" />
    <path
      v-else
      d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
      fill="currentColor"
    />
  </svg>
</template>
