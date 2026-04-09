const express = require('express');
const cors = require('cors');
const { PORT, FETCH_INTERVAL_MS } = require('./src/config');
const {
  applyAsekoConfig,
  runFetchCycle,
  getLastFetchAt,
  getPoolsSummary,
  getPoolById,
  getPoolDetails,
} = require('./src/temperature-service');
const { buildPoolsResponse, buildPoolDetailsResponse } = require('./src/http-responses');

const app = express();
applyAsekoConfig().finally(() => {
  runFetchCycle('auto');
  setInterval(() => {
    runFetchCycle('auto');
  }, FETCH_INTERVAL_MS);
});

app.use(cors());
app.use(express.json());

app.get('/api/pools', (_req, res) => {
  res.json(buildPoolsResponse(getLastFetchAt(), getPoolsSummary()));
});

app.get('/api/pools/:poolId/details', (req, res) => {
  const poolId = Number(req.params.poolId);

  if (!Number.isInteger(poolId)) {
    res.status(400).json({ message: 'Neplatne ID bazena.' });
    return;
  }

  const pool = getPoolById(poolId);

  if (!pool) {
    res.status(404).json({ message: 'Bazen nebol najdeny.' });
    return;
  }

  res.json(buildPoolDetailsResponse(getLastFetchAt(), getPoolDetails(poolId)));
});

app.post('/api/pools/refresh', async (_req, res) => {
  try {
    await runFetchCycle('manual');
    res.json(buildPoolsResponse(getLastFetchAt(), getPoolsSummary()));
  } catch (error) {
    console.error(`[ERROR] Manual refresh failed: ${error.message}`);
    res.status(500).json({ message: 'Nepodarilo sa aktualizovat teploty.' });
  }
});

app.listen(PORT, () => {
  console.log(`Temperature API running on http://localhost:${PORT}`);
});
