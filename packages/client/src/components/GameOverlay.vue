<script setup lang="ts">
defineProps<{ status: 'won' | 'lost'; hasNextLevel: boolean }>();
defineEmits<{ restart: []; next: []; exit: [] }>();
</script>

<template>
  <div class="overlay">
    <div class="card">
      <h2>{{ status === 'won' ? 'Level complete' : 'Base destroyed' }}</h2>
      <p>
        {{ status === 'won' ? 'The ore quota has been mined.' : 'The pirates destroyed every building.' }}
      </p>
      <div class="actions">
        <button v-if="status === 'won' && hasNextLevel" type="button" class="primary" @click="$emit('next')">
          Next level
        </button>
        <button type="button" @click="$emit('restart')">
          {{ status === 'won' ? 'Play again' : 'Retry' }}
        </button>
        <button type="button" @click="$emit('exit')">Menu</button>
      </div>
    </div>
  </div>
</template>
