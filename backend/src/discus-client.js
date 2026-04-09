const { DISCUS_SALTY_POOL_CSV_URL } = require('./config');

function parseLatestTemperature(csvContent) {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [timestampRaw, temperatureRaw] = line.split(',');

    if (!timestampRaw || !temperatureRaw) {
      continue;
    }

    const timestamp = new Date(timestampRaw.trim());

    if (Number.isNaN(timestamp.getTime())) {
      continue;
    }

    const temperature = Number(temperatureRaw.trim().replace(',', '.'));

    if (!Number.isFinite(temperature)) {
      continue;
    }

    return Number(temperature.toFixed(1));
  }

  return null;
}

async function fetchDiscusTemperature(csvUrl = DISCUS_SALTY_POOL_CSV_URL) {
  const response = await fetch(csvUrl, {
    method: 'GET',
    headers: {
      accept: 'text/csv,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`DISCUS požiadavka zlyhala so stavovým kódom ${response.status}`);
  }

  const csvContent = await response.text();
  const latestTemperature = parseLatestTemperature(csvContent);

  if (latestTemperature === null) {
    throw new Error('V CSV odpovedi DISCUS sa nepodarilo nájsť platnú teplotu');
  }

  return latestTemperature;
}

module.exports = {
  fetchDiscusTemperature,
};
