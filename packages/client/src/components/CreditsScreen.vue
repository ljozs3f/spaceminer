<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { CREDITS } from '../credits';
import MenuBackdrop from './MenuBackdrop.vue';
import UiIcon from './UiIcon.vue';

/** Who made what: the music, the art, the tools. Esc or the back button returns to the menu. */
const emit = defineEmits<{ back: [] }>();

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('back');
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <main class="menu-screen credits-screen">
    <MenuBackdrop />
    <div class="menu-shade" aria-hidden="true" />
    <div class="credits-layout">
      <header class="credits-header">
        <button type="button" class="hud-back" title="Back to the menu (Esc)" @click="emit('back')">
          <UiIcon name="back" />
        </button>
        <div>
          <p class="menu-kicker">Space Miner</p>
          <h1 class="credits-title">Credits</h1>
        </div>
      </header>

      <section v-for="section in CREDITS" :key="section.heading" class="credits-section">
        <h2 class="menu-heading">{{ section.heading }}</h2>
        <ul class="credits-list">
          <li v-for="credit in section.credits" :key="credit.role" class="credit">
            <small class="credit-role">{{ credit.role }}</small>
            <strong class="credit-title">{{ credit.title }}</strong>
            <span v-for="line in credit.by" :key="line" class="credit-by">{{ line }}</span>
            <span v-if="credit.license" class="credit-license">{{ credit.license }}</span>
            <span v-if="credit.links" class="credit-links">
              <a v-for="link in credit.links" :key="link.url" :href="link.url" target="_blank" rel="noopener">
                {{ link.label }} ↗
              </a>
            </span>
          </li>
        </ul>
        <p v-if="section.note" class="credits-note">{{ section.note }}</p>
      </section>
    </div>
  </main>
</template>
