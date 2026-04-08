const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const FETCH_INTERVAL_MS = 5 * 60 * 1000;

const poolNames = [
  'Thermal Lagoon',
  'Family Relax Pool',
  'Mineral Healing Pool',
  'Aroma Wellness Pool',
  'Kids Adventure Pool',
  'Hydro Massage Pool',
  'Outdoor Panorama Pool',
];

const pools = poolNames.map((name, index) => ({
  id: index + 1,
  name,
  currentTemp: 0,
  history: [],
}));

let lastFetchAt = null;

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

function fetchTemperatureData() {
  pools.forEach((pool) => {
    const baseline = pool.history.length === 0 ? 30 + Math.random() * 8 : pool.currentTemp;
    const variation = (Math.random() - 0.5) * 1.4;
    const nextTemp = clamp(baseline + variation, 27, 41);

    pool.currentTemp = Number(nextTemp.toFixed(1));
    pool.history.push(pool.currentTemp);

    if (pool.history.length > 3) {
      pool.history.shift();
    }
  });

  lastFetchAt = new Date();
}

fetchTemperatureData();
setInterval(fetchTemperatureData, FETCH_INTERVAL_MS);

app.use(cors());
app.use(express.json());

app.get('/api/pools', (_req, res) => {
  res.json({
    fetchedAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    nextFetchInMs: FETCH_INTERVAL_MS,
    pools: pools.map((pool) => ({
      id: pool.id,
      name: pool.name,
      temperature: pool.currentTemp,
      trend: getTrend(pool.history),
      history: [...pool.history],
    })),
  });
});

app.listen(PORT, () => {
  console.log(`Temperature API running on http://localhost:${PORT}`);
});
