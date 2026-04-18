<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiUrls, fetchJson } from './shared/api';
import { formatDateTimeHMS, formatTemperature } from './shared/formatters';

const ASEKO_LOGO_URL = '/aseko-logo-black.svg';
const FIVE_MINUTES = 5 * 60 * 1000;

const pools = ref([]);
const isLoading = ref(true);
const isRefreshing = ref(false);
const errorMessage = ref('');
const fetchedAt = ref('');
const nextFetchInMs = ref(FIVE_MINUTES);
const nowMs = ref(Date.now());
let timerId = null;
let countdownTimerId = null;

function trendIcon(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendText(trend) {
  if (trend === 'up') return 'Stúpa';
  if (trend === 'down') return 'Klesá';
  return 'Stabilný';
}

function openPoolDetails(pool) {
  window.location.href = `/detail.html?poolId=${encodeURIComponent(String(pool.id))}`;
}

function applyPoolsData(data) {
  pools.value = data.pools ?? [];
  fetchedAt.value = data.fetchedAt ?? '';

  const interval = Number(data.nextFetchInMs);
  nextFetchInMs.value = Number.isFinite(interval) && interval > 0 ? interval : FIVE_MINUTES;
  nowMs.value = Date.now();
}

function shouldForceRefresh(data) {
  if (!data || !data.fetchedAt) {
    return true;
  }

  const fetchedAtMs = new Date(data.fetchedAt).getTime();

  if (Number.isNaN(fetchedAtMs)) {
    return true;
  }

  const interval = Number(data.nextFetchInMs);
  const expectedIntervalMs = Number.isFinite(interval) && interval > 0 ? interval : FIVE_MINUTES;
  const maxAgeMs = expectedIntervalMs + 60 * 1000;

  return Date.now() - fetchedAtMs > maxAgeMs;
}

function formatCountdownHMS(durationMs) {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function loadData() {
  try {
    const data = await fetchJson(
      `${apiUrls.pools}?t=${Date.now()}`,
      {},
      'Nepodarilo sa načítať teplotné údaje',
    );
    applyPoolsData(data);
    errorMessage.value = '';

    if (shouldForceRefresh(data)) {
      try {
        const refreshed = await fetchJson(
          `${apiUrls.refresh}?t=${Date.now()}`,
          { method: 'POST' },
          'Nepodarilo sa aktualizovať teploty',
        );
        applyPoolsData(refreshed);
      } catch (error) {
        console.warn('[WARN] Automaticka aktualizacia zlyhala:', error);
      }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Neznáma chyba';
  } finally {
    isLoading.value = false;
  }
}

async function refreshNow() {
  isRefreshing.value = true;

  try {
    const data = await fetchJson(
      `${apiUrls.refresh}?t=${Date.now()}`,
      { method: 'POST' },
      'Nepodarilo sa aktualizovať teploty',
    );
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

  return `Posledná aktualizácia: ${formatDateTimeHMS(fetchedAt.value)}`;
});

const nextFetchLabel = computed(() => {
  if (!fetchedAt.value) {
    return 'Ďalšia aktualizácia o: --:--:--';
  }

  const fetchedAtMs = new Date(fetchedAt.value).getTime();

  if (Number.isNaN(fetchedAtMs)) {
    return 'Ďalšia aktualizácia o: --:--:--';
  }

  const remainingMs = fetchedAtMs + nextFetchInMs.value - nowMs.value;
  return `Ďalšia aktualizácia o: ${formatCountdownHMS(remainingMs)}`;
});

onMounted(async () => {
  await loadData();
  timerId = window.setInterval(loadData, FIVE_MINUTES);
  countdownTimerId = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timerId) {
    window.clearInterval(timerId);
  }

  if (countdownTimerId) {
    window.clearInterval(countdownTimerId);
  }
});
</script>

<template>
  <main class="dashboard">
    <header class="hero">
      <p class="eyebrow">Thermal Park Nitrava</p>
      <h1>Monitorovanie teplôt bazénov (Zimná časť)</h1>
      <div class="header-row">
        <div class="status-stack">
          <p class="status">{{ fetchedAtLabel }}</p>
          <p class="status next-fetch">{{ nextFetchLabel }}</p>
        </div>
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
      <article
        v-for="pool in pools"
        :key="pool.id"
        class="pool-card"
        :class="['pool-card-clickable', `card-${pool.trend}`]"
        @click="openPoolDetails(pool)"
      >
        <div class="pool-card-header">
          <h2>{{ pool.name }}</h2>
          <div class="source-slot">
            <img
              v-if="pool.source === 'aseko'"
              class="aseko-logo"
              :src="ASEKO_LOGO_URL"
              alt="ASEKO"
              loading="lazy"
            />
            <span v-else-if="pool.source === 'discus'" class="sim-badge discus-badge">DISCUS</span>
            <span v-else class="sim-badge">SIM</span>
          </div>
        </div>
        <p class="temperature" :class="`temp-${pool.trend}`">
          <span class="temp-value">{{ formatTemperature(pool.temperature) }}</span>
          <span class="temp-unit">°C</span>
        </p>
        <p class="trend" :class="`trend-${pool.trend}`">
          <span class="trend-arrow" :class="`arrow-${pool.trend}`">{{ trendIcon(pool.trend) }}</span>
          <span>{{ trendText(pool.trend) }}</span>
        </p>
        <div class="stats-24h">
          <div class="stat-item">
            <span class="stat-label">Min 24h</span>
            <span class="stat-value">{{ formatTemperature(pool.minTemp24h) }} °C</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Max 24h</span>
            <span class="stat-value">{{ formatTemperature(pool.maxTemp24h) }} °C</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Priemer 24h</span>
            <span class="stat-value">{{ formatTemperature(pool.avgTemp24h) }} °C</span>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>
