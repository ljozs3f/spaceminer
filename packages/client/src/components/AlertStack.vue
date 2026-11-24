<script setup lang="ts">
import type { AlertKind } from '../events';

/** The latest alerts, newest at the bottom; they disappear on their own. */
defineProps<{
  alerts: readonly { readonly id: number; readonly kind: AlertKind; readonly text: string }[];
}>();
</script>

<template>
  <TransitionGroup name="alert" tag="ul" class="alerts" aria-live="polite">
    <li v-for="alert in alerts" :key="alert.id" class="alert" :class="alert.kind">{{ alert.text }}</li>
  </TransitionGroup>
</template>
