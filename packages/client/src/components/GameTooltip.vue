<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watchPostEffect } from 'vue';
import { elementTip, type TipContent } from '../game/tooltip';

/**
 * The one tooltip of the game: the one of the UI element under the pointer (v-tip) next to that element,
 * otherwise the one of the object under the pointer on the map (mapTip), next to the pointer. It is placed
 * by hand on every pointer move, so following the pointer does not render anything.
 */
const props = defineProps<{ mapTip: TipContent | null }>();

/** Room between the tooltip and what it points at, and to the window's edge (pixels). */
const GAP = 10;
const EDGE = 8;
/** The tooltip of the map sits this far right of and below the pointer. */
const POINTER_OFFSET = { x: 18, y: 20 } as const;

const box = useTemplateRef('box');
const pointer = { x: 0, y: 0 };

const shown = computed(() => {
  const element = elementTip.value;
  if (element) return { content: element.content, rect: element.rect };
  return props.mapTip ? { content: props.mapTip, rect: null } : null;
});

function place(): void {
  const el = box.value;
  const tip = shown.value;
  if (!el || !tip) return;
  const { width, height } = el.getBoundingClientRect();
  const { innerWidth, innerHeight } = window;
  let x: number;
  let y: number;
  if (tip.rect) {
    // above an element in the lower half of the window (the build bar), below one in the upper half (the HUD)
    const { left, top, bottom } = tip.rect;
    x = left + tip.rect.width / 2 - width / 2;
    y = top > innerHeight / 2 ? top - GAP - height : bottom + GAP;
  } else {
    x = pointer.x + POINTER_OFFSET.x;
    y = pointer.y + POINTER_OFFSET.y;
    if (x + width > innerWidth - EDGE) x = pointer.x - POINTER_OFFSET.x - width;
    if (y + height > innerHeight - EDGE) y = pointer.y - GAP - height;
  }
  x = Math.min(Math.max(EDGE, x), innerWidth - width - EDGE);
  y = Math.min(Math.max(EDGE, y), innerHeight - height - EDGE);
  el.style.transform = `translate(${String(Math.round(x))}px, ${String(Math.round(y))}px)`;
}

function onPointerMove(event: PointerEvent): void {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (shown.value && !shown.value.rect) place();
}

// after every change of the content, once its size is known
watchPostEffect(place);

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove);
  elementTip.value = null;
});
</script>

<template>
  <div
    v-if="shown"
    ref="box"
    class="game-tip"
    role="tooltip"
    :style="{ '--tip-color': shown.content.color ?? 'var(--accent)' }"
  >
    <header class="tip-head">
      <strong>{{ shown.content.title }}</strong>
      <small v-if="shown.content.subtitle">{{ shown.content.subtitle }}</small>
    </header>
    <p v-if="shown.content.text" class="tip-text">{{ shown.content.text }}</p>
    <dl v-if="shown.content.stats?.length" class="tip-stats">
      <div v-for="stat in shown.content.stats" :key="stat.label">
        <dt>{{ stat.label }}</dt>
        <dd :class="stat.tone">{{ stat.value }}</dd>
      </div>
    </dl>
    <p v-if="shown.content.warning" class="tip-warning">{{ shown.content.warning }}</p>
    <p v-if="shown.content.hint" class="tip-hint">{{ shown.content.hint }}</p>
  </div>
</template>
