const { POOL_DEFINITIONS } = require('./config');
const { loadAsekoConfig, fetchAsekoTemperature } = require('./aseko-client');
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
        console.warn(`[WARN] Missing ASEKO device ID for pool ${pool.name} (${pool.deviceIdKey}).`);
      }
    });
  } catch (error) {
    console.warn(`[WARN] Unable to read ASEKO config file: ${error.message}`);
  }
}

async function refreshPoolTemperature(pool, sampleAtMs, fetchType) {
  const isAsekoPool = Boolean(pool.deviceIdKey);

  if (isAsekoPool) {
    if (!pool.deviceId) {
      pool.source = 'aseko';
      console.warn(`[WARN] Missing device ID for ASEKO pool ${pool.name}.`);
      return;
    }

    try {
      const asekoTemperature = await fetchAsekoTemperature(pool.deviceId, asekoToken);
      updatePoolTemperature(pool, asekoTemperature, 'aseko', sampleAtMs, fetchType);
      return;
    } catch (error) {
      pool.source = 'aseko';
      console.warn(`[WARN] ASEKO fetch failed for ${pool.name} (${pool.deviceId}): ${error.message}`);
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
  applyAsekoConfig,
  runFetchCycle,
  getLastFetchAt,
  getPoolsSummary,
  getPoolById,
  getPoolDetails,
};
