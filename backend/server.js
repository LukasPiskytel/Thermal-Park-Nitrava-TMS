const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const FETCH_INTERVAL_MS = 5 * 60 * 1000;
const STATS_WINDOW_MS = 24 * 60 * 60 * 1000;
const ASEKO_API_BASE_URL = 'https://api.aseko.cloud/api/v1/paired-units';
const ASEKO_KEY_FILE_PATH =
  process.env.ASEKO_KEY_FILE_PATH || path.resolve(__dirname, '..', 'aseko-api-key.txt');
const ASEKO_CLIENT_NAME = 'Thermal Park Nitrava Temperature Monitoring System';
const ASEKO_CLIENT_VERSION = '1';
const ASEKO_LANGUAGE = 'SK';

const poolDefinitions = [
  { id: 1, name: 'Zážitkový bazén', deviceIdKey: 'zazitkovy-bazen-id' },
  { id: 2, name: 'Výplavový bazén', deviceIdKey: 'vyplavovy-bazen-id' },
  { id: 3, name: 'Slaný bazén' },
  { id: 4, name: 'Hypertermálny bazén' },
  { id: 5, name: 'Vírivka', deviceIdKey: 'virivka-id' },
  {
    id: 6,
    name: 'Detský bazén',
    deviceIdKey: 'detsky-bazen-id',
    defaultDeviceId: '110178006',
  },
  { id: 7, name: 'Bazén pri jazere' },
];

const pools = poolDefinitions.map((pool) => ({
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

let lastFetchAt = null;
let asekoToken = process.env.ASEKO_API_TOKEN || '';
let currentFetchPromise = null;

function getTrend(history) {
  if (history.length < 3) {
    return 'stable';
  }

  const diff = history[history.length - 1] - history[0];

  if (diff > 0.2) {
    return 'up';
  }

  if (diff < -0.2) {
    return 'down';
  }

  return 'stable';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseAsekoConfig(rawContent) {
  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let parsedToken = '';
  const idMap = {};

  lines.forEach((line) => {
    if (!line.includes('=') && !parsedToken) {
      parsedToken = line;
      return;
    }

    const idMatch = line.match(/^([a-z0-9-]+)\s*=\s*([0-9]+)$/i);

    if (idMatch) {
      idMap[idMatch[1].toLowerCase()] = idMatch[2];
    }
  });

  return { parsedToken, idMap };
}

async function loadAsekoConfigFromFile() {
  try {
    const content = await fs.readFile(ASEKO_KEY_FILE_PATH, 'utf8');
    const { parsedToken, idMap } = parseAsekoConfig(content);

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
    });
  } catch (error) {
    console.warn(`[WARN] Unable to read ASEKO config file: ${error.message}`);
  }
}

function extractTemperatureFromAsekoResponse(payload) {
  const value = payload?.statusValues?.waterTemperature;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(1));
}

async function fetchAsekoTemperature(deviceId) {
  if (!asekoToken) {
    throw new Error('ASEKO API token is not configured');
  }

  const url = `${ASEKO_API_BASE_URL}/${encodeURIComponent(deviceId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-Client-Name': ASEKO_CLIENT_NAME,
      'X-Client-Version': ASEKO_CLIENT_VERSION,
      'Accept-Language': ASEKO_LANGUAGE,
      Authorization: `Bearer ${asekoToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ASEKO request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const temperature = extractTemperatureFromAsekoResponse(payload);

  if (temperature === null) {
    throw new Error('Missing statusValues.waterTemperature in ASEKO response');
  }

  return temperature;
}

function generateSimulatedTemperature(pool) {
  const baseline = pool.history.length === 0 ? 30 + Math.random() * 8 : pool.currentTemp;
  const variation = (Math.random() - 0.5) * 1.4;
  return clamp(baseline + variation, 27, 41);
}

function updatePoolTemperature(pool, temperature, source, sampleAtMs = Date.now(), fetchType = 'auto') {
  pool.currentTemp = Number(temperature.toFixed(1));
  pool.history.push(pool.currentTemp);

  if (pool.history.length > 3) {
    pool.history.shift();
  }

  const sample = {
    temperature: pool.currentTemp,
    fetchedAtMs: sampleAtMs,
    fetchType,
    source,
  };

  pool.statsHistory24h.push(sample);
  pool.fetchLog.push(sample);

  const thresholdMs = sampleAtMs - STATS_WINDOW_MS;
  pool.statsHistory24h = pool.statsHistory24h.filter((item) => item.fetchedAtMs >= thresholdMs);

  pool.source = source;
}

function get24hStats(pool) {
  if (pool.statsHistory24h.length === 0) {
    return {
      minTemp24h: null,
      maxTemp24h: null,
      avgTemp24h: null,
    };
  }

  const values = pool.statsHistory24h.map((sample) => sample.temperature);
  const minTemp = Math.min(...values);
  const maxTemp = Math.max(...values);
  const avgTemp = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    minTemp24h: Number(minTemp.toFixed(1)),
    maxTemp24h: Number(maxTemp.toFixed(1)),
    avgTemp24h: Number(avgTemp.toFixed(1)),
  };
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
      const asekoTemperature = await fetchAsekoTemperature(pool.deviceId);
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

function buildPoolSummary(pool) {
  const stats24h = get24hStats(pool);

  return {
    id: pool.id,
    name: pool.name,
    deviceId: pool.deviceId,
    temperature: pool.currentTemp,
    trend: getTrend(pool.history),
    history: [...pool.history],
    source: pool.source,
    ...stats24h,
  };
}

function buildPoolDetails(pool) {
  return {
    ...buildPoolSummary(pool),
    fetchLog: pool.fetchLog.map((sample) => ({
      timestamp: new Date(sample.fetchedAtMs).toISOString(),
      fetchType: sample.fetchType,
      temperature: sample.temperature,
      source: sample.source,
    })),
  };
}

function buildPoolsResponse() {
  return {
    fetchedAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    nextFetchInMs: FETCH_INTERVAL_MS,
    pools: pools.map((pool) => buildPoolSummary(pool)),
  };
}

loadAsekoConfigFromFile().finally(() => {
  runFetchCycle('auto');
  setInterval(() => {
    runFetchCycle('auto');
  }, FETCH_INTERVAL_MS);
});

app.use(cors());
app.use(express.json());

app.get('/api/pools', (_req, res) => {
  res.json(buildPoolsResponse());
});

app.get('/api/pools/:poolId/details', (req, res) => {
  const poolId = Number(req.params.poolId);

  if (!Number.isInteger(poolId)) {
    res.status(400).json({ message: 'Neplatne ID bazena.' });
    return;
  }

  const pool = pools.find((item) => item.id === poolId);

  if (!pool) {
    res.status(404).json({ message: 'Bazen nebol najdeny.' });
    return;
  }

  res.json({
    fetchedAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    pool: buildPoolDetails(pool),
  });
});

app.post('/api/pools/refresh', async (_req, res) => {
  try {
    await runFetchCycle('manual');
    res.json(buildPoolsResponse());
  } catch (error) {
    console.error(`[ERROR] Manual refresh failed: ${error.message}`);
    res.status(500).json({ message: 'Nepodarilo sa aktualizovat teploty.' });
  }
});

app.listen(PORT, () => {
  console.log(`Temperature API running on http://localhost:${PORT}`);
});
