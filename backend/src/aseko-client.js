const fs = require('fs/promises');
const {
  ASEKO_API_BASE_URL,
  ASEKO_KEY_FILE_PATH,
  ASEKO_CLIENT_HEADERS,
} = require('./config');

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

async function loadAsekoConfig() {
  const content = await fs.readFile(ASEKO_KEY_FILE_PATH, 'utf8');
  return parseAsekoConfig(content);
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
