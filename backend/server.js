const express = require('express');
const cors = require('cors');
const { PORT, FETCH_INTERVAL_MS } = require('./src/config');
const {
  initializeTemperatureService,
  runFetchCycle,
  getLastFetchAt,
  getPoolsSummary,
  getPoolById,
  getPoolDetails,
} = require('./src/temperature-service');
const { buildPoolsResponse, buildPoolDetailsResponse } = require('./src/http-responses');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }

  next();
});

app.get('/api/pools', (_req, res) => {
  res.json(buildPoolsResponse(getLastFetchAt(), getPoolsSummary()));
});

app.get('/api/pools/:poolId/details', (req, res) => {
  const poolId = Number(req.params.poolId);

  if (!Number.isInteger(poolId)) {
    res.status(400).json({ message: 'Neplatné ID bazéna.' });
    return;
  }

  const pool = getPoolById(poolId);

  if (!pool) {
    res.status(404).json({ message: 'Bazén nebol nájdený.' });
    return;
  }

  res.json(buildPoolDetailsResponse(getLastFetchAt(), getPoolDetails(poolId)));
});

// Pôvodné POST-only obnovenie (ponechané pre porovnanie):
// app.post('/api/pools/refresh', async (_req, res) => {
//   try {
//     await runFetchCycle('manual');
//     res.json(buildPoolsResponse(getLastFetchAt(), getPoolsSummary()));
//   } catch (error) {
//     console.error(`[ERROR] Manuálna aktualizácia zlyhala: ${error.message}`);
//     res.status(500).json({ message: 'Nepodarilo sa aktualizovať teploty.' });
//   }
// });

async function handleRefreshRequest(_req, res) {
  try {
    await runFetchCycle('manual');
    res.json(buildPoolsResponse(getLastFetchAt(), getPoolsSummary()));
  } catch (error) {
    console.error(`[ERROR] Manuálna aktualizácia zlyhala: ${error.message}`);
    res.status(500).json({ message: 'Nepodarilo sa aktualizovať teploty.' });
  }
}

app.post('/api/pools/refresh', handleRefreshRequest);
app.get('/api/pools/refresh', handleRefreshRequest);

async function startServer() {
  await initializeTemperatureService();

  app.listen(PORT, () => {
    console.log(`API teplôt je spustené na adrese http://localhost:${PORT}`);
  });

  runFetchCycle('auto');
  setInterval(() => {
    runFetchCycle('auto');
  }, FETCH_INTERVAL_MS);
}

startServer().catch((error) => {
  console.error(`[ERROR] Nepodarilo sa spustiť server: ${error.message}`);
  process.exit(1);
});
