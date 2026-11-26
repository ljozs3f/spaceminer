import { shallowRef, type Directive } from 'vue';

/** What a tooltip says (game/tips.ts builds them). */
export interface TipContent {
  readonly title: string;
  /** Next to the title: a level, a kind, a state. */
  readonly subtitle?: string;
  readonly text?: string;
  readonly stats?: readonly TipStat[];
  /** Something that holds it back: not enough ore, low power. */
  readonly warning?: string;
  /** What can be done with it: a click, a key. */
  readonly hint?: string;
  /** The accent color (CSS). */
  readonly color?: string;
}

export interface TipStat {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'good' | 'bad';
}

/** The tooltip of the UI element under the pointer; GameTooltip.vue shows it next to the element's box. */
export const elementTip = shallowRef<{
  readonly content: TipContent;
  readonly rect: DOMRect;
  readonly owner: HTMLElement;
} | null>(null);

/** The pointer rests this long on an element before its tooltip shows. */
const SHOW_DELAY_MS = 250;
/** Moving on to the next element within this time after a tooltip closed shows its tooltip at once. */
const SWITCH_MS = 300;
let lastHiddenMs = Number.NEGATIVE_INFINITY;

interface TipState {
  content: TipContent | null;
  timer: number;
  readonly enter: () => void;
  readonly leave: () => void;
}

const states = new WeakMap<HTMLElement, TipState>();

function show(el: HTMLElement, content: TipContent | null): void {
  if (content) elementTip.value = { content, rect: el.getBoundingClientRect(), owner: el };
  else if (elementTip.value?.owner === el) elementTip.value = null;
}

/**
 * v-tip="content": the element gets a tooltip while the pointer is over it. The content may change while it
 * shows (live values); null: no tooltip.
 */
export const vTip: Directive<HTMLElement, TipContent | null | undefined> = {
  mounted(el, binding) {
    const state: TipState = {
      content: binding.value ?? null,
      timer: 0,
      enter: () => {
        window.clearTimeout(state.timer);
        if (elementTip.value || performance.now() - lastHiddenMs < SWITCH_MS) show(el, state.content);
        else
          state.timer = window.setTimeout(() => {
            show(el, state.content);
          }, SHOW_DELAY_MS);
      },
      leave: () => {
        window.clearTimeout(state.timer);
        if (elementTip.value?.owner !== el) return;
        elementTip.value = null;
        lastHiddenMs = performance.now();
      },
    };
    states.set(el, state);
    el.addEventListener('pointerenter', state.enter);
    el.addEventListener('pointerleave', state.leave);
  },
  updated(el, binding) {
    const state = states.get(el);
    if (!state) return;
    state.content = binding.value ?? null;
    if (elementTip.value?.owner === el) show(el, state.content);
  },
  beforeUnmount(el) {
    const state = states.get(el);
    if (!state) return;
    state.leave();
    el.removeEventListener('pointerenter', state.enter);
    el.removeEventListener('pointerleave', state.leave);
    states.delete(el);
  },
};
