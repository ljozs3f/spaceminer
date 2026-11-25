<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';

/**
 * A card next to an object on the map, with a pointer towards it. It sits to the right of the object, or to
 * its left when there is no room, and stays inside its container (the map area).
 */
const props = defineProps<{
  /** The object's center and radius, in pixels within the container. */
  anchor: { readonly x: number; readonly y: number; readonly radius: number };
}>();

/** Room between the object and the card, and between the card and the container's edges. */
const GAP = 14;
const MARGIN = 8;
/** The pointer stays this far from the card's corners. */
const POINTER_INSET = 18;

const root = useTemplateRef('root');
const size = shallowRef({ width: 0, height: 0 });
const bounds = shallowRef({ width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY });
let observer: ResizeObserver | undefined;

function measure(): void {
  const element = root.value;
  if (!element) return;
  size.value = { width: element.offsetWidth, height: element.offsetHeight };
  const container = element.offsetParent;
  if (container) bounds.value = { width: container.clientWidth, height: container.clientHeight };
}

onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (root.value) observer.observe(root.value);
  if (root.value?.offsetParent) observer.observe(root.value.offsetParent);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

const placement = computed(() => {
  const { x, y, radius } = props.anchor;
  const { width, height } = size.value;
  const rightEdge = x + radius + GAP;
  const side =
    rightEdge + width <= bounds.value.width - MARGIN || x - radius - GAP - width < MARGIN ? 'right' : 'left';
  const left = side === 'right' ? rightEdge : x - radius - GAP - width;
  const top = Math.max(MARGIN, Math.min(y - height / 2, bounds.value.height - height - MARGIN));
  const pointer = Math.max(POINTER_INSET, Math.min(y - top, height - POINTER_INSET));
  return { side, left, top, pointer };
});
</script>

<template>
  <aside
    ref="root"
    class="map-popup"
    :class="placement.side"
    :style="{
      left: `${placement.left}px`,
      top: `${placement.top}px`,
      '--pointer-y': `${placement.pointer}px`,
    }"
    @contextmenu.prevent
  >
    <slot />
  </aside>
</template>
