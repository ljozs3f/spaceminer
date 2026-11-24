<script setup lang="ts">
import { computed } from 'vue';
import { spriteUrl } from '../game/sprites';

/** The sprite as an icon, or a color swatch when there is no sprite. */
const props = defineProps<{ sprite: string | undefined; color: string; large?: boolean }>();

const url = computed(() => spriteUrl(props.sprite));
</script>

<template>
  <img v-if="url" :src="url" class="sprite-icon" :class="{ large }" alt="" />
  <span v-else class="swatch" :style="{ background: color }" />
</template>
