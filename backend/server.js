const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const FETCH_INTERVAL_MS = 5 * 60 * 1000;
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
  source: 'simulated',
}));

let lastFetchAt = null;
let asekoToken = process.env.ASEKO_API_TOKEN || '';
let isFetchingInProgress = false;

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

function updatePoolTemperature(pool, temperature, source) {
  pool.currentTemp = Number(temperature.toFixed(1));
  pool.history.push(pool.currentTemp);

  if (pool.history.length > 3) {
    pool.history.shift();
  }

  pool.source = source;
}

async function refreshPoolTemperature(pool) {
  if (pool.deviceId) {
    try {
      const asekoTemperature = await fetchAsekoTemperature(pool.deviceId);
      updatePoolTemperature(pool, asekoTemperature, 'aseko');
      return;
    } catch (error) {
      console.warn(
        `[WARN] Falling back to simulation for ${pool.name} (${pool.deviceId}): ${error.message}`,
      );
    }
  }

  const simulatedTemperature = generateSimulatedTemperature(pool);
  updatePoolTemperature(pool, simulatedTemperature, 'simulated');
}

async function fetchTemperatureData() {
  await Promise.all(pools.map((pool) => refreshPoolTemperature(pool)));
  lastFetchAt = new Date();
}

async function runFetchCycle() {
  if (isFetchingInProgress) {
    return;
  }

  isFetchingInProgress = true;

  try {
    await fetchTemperatureData();
  } finally {
    isFetchingInProgress = false;
  }
}

loadAsekoConfigFromFile().finally(() => {
  runFetchCycle();
  setInterval(runFetchCycle, FETCH_INTERVAL_MS);
});

app.use(cors());
app.use(express.json());

app.get('/api/pools', (_req, res) => {
  res.json({
    fetchedAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    nextFetchInMs: FETCH_INTERVAL_MS,
    pools: pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      deviceId: pool.deviceId,
      temperature: pool.currentTemp,
      trend: getTrend(pool.history),
      history: [...pool.history],
      source: pool.source,
    })),
  });
});

app.listen(PORT, () => {
  console.log(`Temperature API running on http://localhost:${PORT}`);
});
