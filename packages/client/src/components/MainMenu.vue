<script setup lang="ts">
import { MINING_MODE_CONFIG } from '@space-miner/sim';

defineEmits<{ play: [] }>();

const goalPercent = Math.round(MINING_MODE_CONFIG.winMinedOreFraction * 100);
</script>

<template>
  <main class="menu">
    <h1>Space Miner</h1>
    <p class="tagline">Mine the asteroid belt. Keep the pirates off your base.</p>
    <button type="button" class="primary" @click="$emit('play')">Play</button>
    <section class="how-to">
      <h2>How to play</h2>
      <ul>
        <li><strong>Mines</strong> pull ore from the asteroids in their range. Ore pays for everything.</li>
        <li>
          <strong>Solar</strong> panels power mines and turrets. When energy runs short, everything slows
          down.
        </li>
        <li><strong>Lasers</strong> and <strong>missiles</strong> shoot the pirates that attack in waves.</li>
        <li>Mine {{ goalPercent }}% of the ore to win. Lose every building and the level is lost.</li>
        <li>
          Keys 1–4 pick a building, Esc or right click cancels. Click a building to upgrade or sell it, an
          asteroid to see its ore. M mutes the sound.
        </li>
      </ul>
    </section>
  </main>
</template>
