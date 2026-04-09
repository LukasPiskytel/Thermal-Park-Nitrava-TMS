<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const API_URL = 'http://localhost:3001/api/pools';
const REFRESH_API_URL = 'http://localhost:3001/api/pools/refresh';
const FIVE_MINUTES = 5 * 60 * 1000;

const pools = ref([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const errorMessage = ref('');
const fetchedAt = ref('');
let timerId = null;

function trendIcon(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendText(trend) {
  if (trend === 'up') return 'Stúpa';
  if (trend === 'down') return 'Klesá';
  return 'Stabilná';
}

function applyPoolsData(data) {
  pools.value = data.pools ?? [];
  fetchedAt.value = data.fetchedAt ?? '';
}

async function loadData() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error('Nepodarilo sa načítať teplotné údaje');
    }

    const data = await response.json();
    applyPoolsData(data);
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Neznáma chyba';
  } finally {
    isLoading.value = false;
  }
}

async function refreshNow() {
  isRefreshing.value = true;

  try {
    const response = await fetch(REFRESH_API_URL, { method: 'POST' });

    if (!response.ok) {
      throw new Error('Nepodarilo sa aktualizovať teploty');
    }

    const data = await response.json();
    applyPoolsData(data);
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Neznáma chyba';
  } finally {
    isRefreshing.value = false;
    isLoading.value = false;
  }
}

const fetchedAtLabel = computed(() => {
  if (!fetchedAt.value) {
    return 'Čaká sa na načítanie dát...';
  }

  return `Posledné načítanie: ${new Date(fetchedAt.value).toLocaleString()}`;
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
      <div class="header-row">
        <p class="status">{{ fetchedAtLabel }}</p>
        <button
          type="button"
          class="refresh-button"
          :disabled="isRefreshing"
          @click="refreshNow"
        >
          Aktualizovať
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="status">Načítavanie dát...</p>

    <section v-else class="pool-grid">
      <article v-for="pool in pools" :key="pool.id" class="pool-card">
        <h2>{{ pool.name }}</h2>
        <p class="temperature" :class="`temp-${pool.trend}`">{{ pool.temperature.toFixed(1) }} °C</p>
        <p class="trend" :class="`trend-${pool.trend}`">
          <span class="trend-arrow" :class="`arrow-${pool.trend}`">{{ trendIcon(pool.trend) }}</span>
          <span>{{ trendText(pool.trend) }}</span>
        </p>
      </article>
    </section>
  </main>
</template>
