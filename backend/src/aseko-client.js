const fs = require('fs/promises');
const {
  ASEKO_API_BASE_URL,
  ASEKO_CONFIG_JSON_PATH,
  ASEKO_KEY_FILE_PATH,
  ASEKO_CLIENT_HEADERS,
} = require('./config');

function parseAsekoTextConfig(rawContent) {
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

function parseAsekoJsonConfig(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('ASEKO JSON konfiguracia musi byt objekt');
  }

  const parsedToken = typeof payload.token === 'string' ? payload.token.trim() : '';
  const idMap = {};
  const deviceIds = payload.deviceIds && typeof payload.deviceIds === 'object' ? payload.deviceIds : null;

  if (deviceIds) {
    Object.entries(deviceIds).forEach(([key, value]) => {
      if (typeof key !== 'string' || !key.trim()) {
        return;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        idMap[key.trim().toLowerCase()] = String(Math.trunc(value));
        return;
      }

      if (typeof value === 'string' && value.trim()) {
        idMap[key.trim().toLowerCase()] = value.trim();
      }
    });
  }

  return { parsedToken, idMap };
}

function parseEnvDeviceIdMap(rawMap) {
  const idMap = {};

  if (!rawMap || typeof rawMap !== 'object') {
    return idMap;
  }

  Object.entries(rawMap).forEach(([key, value]) => {
    if (typeof key !== 'string' || !key.trim()) {
      return;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      idMap[key.trim().toLowerCase()] = String(Math.trunc(value));
      return;
    }

    if (typeof value === 'string' && value.trim()) {
      idMap[key.trim().toLowerCase()] = value.trim();
    }
  });

  return idMap;
}

function getEnvDeviceIdMap() {
  const idMap = {};
  const rawJson = process.env.ASEKO_DEVICE_IDS_JSON;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      Object.assign(idMap, parseEnvDeviceIdMap(parsed));
    } catch (error) {
      throw new Error('ASEKO_DEVICE_IDS_JSON nie je platny JSON');
    }
  }

  Object.entries(process.env).forEach(([key, value]) => {
    if (!key.startsWith('ASEKO_DEVICE_ID_')) {
      return;
    }

    if (typeof value !== 'string' || !value.trim()) {
      return;
    }

    const suffix = key.slice('ASEKO_DEVICE_ID_'.length).trim();
    if (!suffix) {
      return;
    }

    const normalizedKey = suffix.toLowerCase().replace(/_/g, '-');
    idMap[normalizedKey] = value.trim();
  });

  return idMap;
}

async function loadAsekoJsonConfig() {
  try {
    const rawContent = await fs.readFile(ASEKO_CONFIG_JSON_PATH, 'utf8');
    const payload = JSON.parse(rawContent);
    return parseAsekoJsonConfig(payload);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function loadAsekoConfig() {
  const jsonConfig = await loadAsekoJsonConfig();
  const envIdMap = getEnvDeviceIdMap();

  if (jsonConfig) {
    return { parsedToken: jsonConfig.parsedToken, idMap: { ...jsonConfig.idMap, ...envIdMap } };
  }

  const content = await fs.readFile(ASEKO_KEY_FILE_PATH, 'utf8');
  const textConfig = parseAsekoTextConfig(content);
  return { parsedToken: textConfig.parsedToken, idMap: { ...textConfig.idMap, ...envIdMap } };
}

function extractTemperature(payload) {
  const value = payload?.statusValues?.waterTemperature;

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(1));
}

async function fetchAsekoTemperature(deviceId, token) {
  if (!token) {
    throw new Error('ASEKO API token nie je nakonfigurovaný');
  }

  const url = `${ASEKO_API_BASE_URL}/${encodeURIComponent(deviceId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...ASEKO_CLIENT_HEADERS,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ASEKO požiadavka zlyhala so stavovým kódom ${response.status}`);
  }

  const payload = await response.json();
  const temperature = extractTemperature(payload);

  if (temperature === null) {
    throw new Error('V odpovedi ASEKO chýba hodnota statusValues.waterTemperature');
  }

  return temperature;
}

module.exports = {
  loadAsekoConfig,
  fetchAsekoTemperature,
};
