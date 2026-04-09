const { POOL_DEFINITIONS, STATS_WINDOW_MS } = require('./config');
const { loadAsekoConfig, fetchAsekoTemperature } = require('./aseko-client');
const { readPersistedState, writePersistedState, appendExpiredDataBackups } = require('./state-store');
const {
  generateSimulatedTemperature,
  updatePoolTemperature,
  buildPoolSummary,
  buildPoolDetails,
} = require('./pool-utils');

const pools = POOL_DEFINITIONS.map((pool) => ({
  id: pool.id,
  name: pool.name,
  deviceIdKey: pool.deviceIdKey ?? null,
  deviceId: pool.defaultDeviceId ?? null,
  currentTemp: 0,
  history: [],
  statsHistory24h: [],
  fetchLog: [],
  source: pool.deviceIdKey ? 'aseko' : 'simulated',
}));

let asekoToken = process.env.ASEKO_API_TOKEN || '';
let lastFetchAt = null;
let currentFetchPromise = null;

function getLastFetchAt() {
  return lastFetchAt;
}

function getPoolById(poolId) {
  return pools.find((pool) => pool.id === poolId) || null;
}

function getPoolsSummary() {
  return pools.map((pool) => buildPoolSummary(pool));
}

function getPoolDetails(poolId) {
  const pool = getPoolById(poolId);
  return pool ? buildPoolDetails(pool) : null;
}

function normalizeSample(rawSample) {
  if (!rawSample || typeof rawSample !== 'object') {
    return null;
  }

  const temperatureValue = Number(rawSample.temperature);
  const fetchedAtMsValue = Number(rawSample.fetchedAtMs);

  if (!Number.isFinite(temperatureValue) || !Number.isFinite(fetchedAtMsValue)) {
    return null;
  }

  return {
    temperature: Number(temperatureValue.toFixed(1)),
    fetchedAtMs: Math.trunc(fetchedAtMsValue),
    fetchType: rawSample.fetchType === 'manual' ? 'manual' : 'auto',
    source: rawSample.source === 'aseko' ? 'aseko' : 'simulated',
  };
}

function restorePoolFromSnapshot(pool, snapshotPool, statsThresholdMs) {
  if (!snapshotPool || typeof snapshotPool !== 'object') {
    return;
  }

  const currentTempValue = Number(snapshotPool.currentTemp);

  if (Number.isFinite(currentTempValue)) {
    pool.currentTemp = Number(currentTempValue.toFixed(1));
  }

  if (typeof snapshotPool.deviceId === 'string' && snapshotPool.deviceId.trim()) {
    pool.deviceId = snapshotPool.deviceId.trim();
  }

  if (snapshotPool.source === 'aseko' || snapshotPool.source === 'simulated') {
    pool.source = snapshotPool.source;
  }

  if (Array.isArray(snapshotPool.history)) {
    pool.history = snapshotPool.history
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .map((value) => Number(value.toFixed(1)))
      .slice(-3);
  }

  if (Array.isArray(snapshotPool.statsHistory24h)) {
    pool.statsHistory24h = snapshotPool.statsHistory24h
      .map((sample) => normalizeSample(sample))
      .filter((sample) => sample && sample.fetchedAtMs >= statsThresholdMs);
  }

  if (Array.isArray(snapshotPool.fetchLog)) {
    pool.fetchLog = snapshotPool.fetchLog.map((sample) => normalizeSample(sample)).filter(Boolean);
  }
}

async function loadPersistedPoolsState() {
  const persistedState = await readPersistedState();

  if (!persistedState) {
    return false;
  }

  const statsThresholdMs = Date.now() - STATS_WINDOW_MS;

  if (Array.isArray(persistedState.pools)) {
    const poolById = new Map(
      persistedState.pools
        .map((pool) => [Number(pool?.id), pool])
        .filter(([id]) => Number.isInteger(id)),
    );

    pools.forEach((pool) => {
      restorePoolFromSnapshot(pool, poolById.get(pool.id), statsThresholdMs);
    });
  }

  if (typeof persistedState.lastFetchAt === 'string') {
    const parsedDate = new Date(persistedState.lastFetchAt);

    if (!Number.isNaN(parsedDate.getTime())) {
      lastFetchAt = parsedDate;
    }
  }

  return true;
}

function buildStatePayload() {
  return {
    version: 1,
    lastFetchAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    pools: pools.map((pool) => ({
      id: pool.id,
      currentTemp: pool.currentTemp,
      history: [...pool.history],
      statsHistory24h: pool.statsHistory24h.map((sample) => ({ ...sample })),
      fetchLog: pool.fetchLog.map((sample) => ({ ...sample })),
      source: pool.source,
      deviceId: pool.deviceId,
    })),
  };
}

function collectAndPruneExpiredData(referenceMs = Date.now()) {
  const thresholdMs = referenceMs - STATS_WINDOW_MS;
  const expiredEntries = [];

  pools.forEach((pool) => {
    pool.statsHistory24h = pool.statsHistory24h.filter((sample) => sample.fetchedAtMs >= thresholdMs);

    const keptLogEntries = [];

    pool.fetchLog.forEach((sample) => {
      if (sample.fetchedAtMs < thresholdMs) {
        expiredEntries.push({
          poolId: pool.id,
          poolName: pool.name,
          fetchedAtMs: sample.fetchedAtMs,
          temperature: sample.temperature,
          fetchType: sample.fetchType,
          source: sample.source,
        });
        return;
      }

      keptLogEntries.push(sample);
    });

    pool.fetchLog = keptLogEntries;
  });

  return expiredEntries;
}

async function persistPoolsState() {
  await writePersistedState(buildStatePayload());
}

async function initializeTemperatureService() {
  const restored = await loadPersistedPoolsState();

  const expiredEntries = collectAndPruneExpiredData(Date.now());

  if (expiredEntries.length > 0) {
    await appendExpiredDataBackups(expiredEntries);
    await persistPoolsState();
    console.log(`[INFO] Archivovaných ${expiredEntries.length} starších záznamov do denných JSON záloh.`);
  }

  if (restored) {
    console.log('[INFO] Uložené údaje bazénov boli načítané z disku.');
  }

  await applyAsekoConfig();
}

async function applyAsekoConfig() {
  try {
    const { parsedToken, idMap } = await loadAsekoConfig();

    if (!asekoToken && parsedToken) {
      asekoToken = parsedToken;
    }

    pools.forEach((pool) => {
      if (!pool.deviceIdKey) {
        return;
      }

      const mappedDeviceId = idMap[pool.deviceIdKey.toLowerCase()];

      if (mappedDeviceId) {
        pool.deviceId = mappedDeviceId;
      }

      if (!pool.deviceId) {
        console.warn(`[WARN] Chýba ASEKO device ID pre bazén ${pool.name} (${pool.deviceIdKey}).`);
      }
    });
  } catch (error) {
    console.warn(`[WARN] Nepodarilo sa načítať konfiguračný súbor ASEKO: ${error.message}`);
  }
}

async function refreshPoolTemperature(pool, sampleAtMs, fetchType) {
  const isAsekoPool = Boolean(pool.deviceIdKey);

  if (isAsekoPool) {
    if (!pool.deviceId) {
      pool.source = 'aseko';
      console.warn(`[WARN] Chýba device ID pre ASEKO bazén ${pool.name}.`);
      return;
    }

    try {
      const asekoTemperature = await fetchAsekoTemperature(pool.deviceId, asekoToken);
      updatePoolTemperature(pool, asekoTemperature, 'aseko', sampleAtMs, fetchType);
      return;
    } catch (error) {
      pool.source = 'aseko';
      console.warn(`[WARN] Načítanie z ASEKO zlyhalo pre ${pool.name} (${pool.deviceId}): ${error.message}`);
      return;
    }
  }

  const simulatedTemperature = generateSimulatedTemperature(pool);
  updatePoolTemperature(pool, simulatedTemperature, 'simulated', sampleAtMs, fetchType);
}

async function fetchTemperatureData(fetchType = 'auto') {
  const sampleAtMs = Date.now();
  await Promise.all(pools.map((pool) => refreshPoolTemperature(pool, sampleAtMs, fetchType)));
  lastFetchAt = new Date();

  const expiredEntries = collectAndPruneExpiredData(sampleAtMs);

  if (expiredEntries.length > 0) {
    await appendExpiredDataBackups(expiredEntries);
  }

  await persistPoolsState();
}

async function runFetchCycle(fetchType = 'auto') {
  if (currentFetchPromise) {
    return currentFetchPromise;
  }

  currentFetchPromise = (async () => {
    await fetchTemperatureData(fetchType);
  })();

  try {
    await currentFetchPromise;
  } finally {
    currentFetchPromise = null;
  }
}

module.exports = {
  initializeTemperatureService,
  applyAsekoConfig,
  runFetchCycle,
  getLastFetchAt,
  getPoolsSummary,
  getPoolById,
  getPoolDetails,
};
