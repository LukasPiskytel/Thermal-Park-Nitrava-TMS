<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const API_URL = 'http://localhost:3001/api/pools';
const FIVE_MINUTES = 5 * 60 * 1000;

const pools = ref([]);
const isLoading = ref(true);
const errorMessage = ref('');
const fetchedAt = ref('');
let timerId = null;

function trendIcon(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendText(trend) {
  if (trend === 'up') return 'Rising';
  if (trend === 'down') return 'Falling';
  return 'Stable';
}

async function loadData() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error('Failed to fetch temperature data');
    }

    const data = await response.json();
    pools.value = data.pools ?? [];
    fetchedAt.value = data.fetchedAt ?? '';
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    isLoading.value = false;
  }
}

const fetchedAtLabel = computed(() => {
  if (!fetchedAt.value) {
    return 'Waiting for first fetch...';
  }

  return `Last fetched: ${new Date(fetchedAt.value).toLocaleString()}`;
});

onMounted(async () => {
  await loadData();
  timerId = window.setInterval(loadData, FIVE_MINUTES);
});

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId);
  }
});
</script>

<template>
  <main class="dashboard">
    <header class="hero">
      <p class="eyebrow">Thermal Park Nitrava</p>
      <h1>Monitorovanie teplôt bazénov (Zimná časť)</h1>
      <p class="status">{{ fetchedAtLabel }}</p>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="status">Loading data...</p>

    <section v-else class="pool-grid">
      <article v-for="pool in pools" :key="pool.id" class="pool-card">
        <h2>{{ pool.name }}</h2>
        <p class="temperature">{{ pool.temperature.toFixed(1) }} °C</p>
        <p class="trend" :class="`trend-${pool.trend}`">
          <span>{{ trendIcon(pool.trend) }}</span>
        </p>
      </article>
    </section>
  </main>
</template>
