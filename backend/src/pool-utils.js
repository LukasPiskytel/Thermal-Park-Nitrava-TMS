const { STATS_WINDOW_MS } = require('./config');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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

function buildPoolSummary(pool) {
  return {
    id: pool.id,
    name: pool.name,
    deviceId: pool.deviceId,
    temperature: pool.currentTemp,
    trend: getTrend(pool.history),
    history: [...pool.history],
    source: pool.source,
    ...get24hStats(pool),
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

module.exports = {
  getTrend,
  generateSimulatedTemperature,
  updatePoolTemperature,
  buildPoolSummary,
  buildPoolDetails,
};
