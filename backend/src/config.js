const path = require('path');

const PORT = Number(process.env.PORT) || 3001;
const FETCH_INTERVAL_MS = 5 * 60 * 1000;
const STATS_WINDOW_MS = 24 * 60 * 60 * 1000;

const ASEKO_API_BASE_URL = 'https://api.aseko.cloud/api/v1/paired-units';
const ASEKO_KEY_FILE_PATH =
  process.env.ASEKO_KEY_FILE_PATH || path.resolve(__dirname, '..', 'data', 'aseko-api-key.txt');
const DISCUS_SALTY_POOL_ID = 3;
const DISCUS_SALTY_POOL_CSV_URL =
  process.env.DISCUS_SALTY_POOL_CSV_URL || 'https://teplomer.discus.sk/CBMHG191/data_001.csv';
const POOLS_STATE_FILE_PATH =
  process.env.POOLS_STATE_FILE_PATH || path.resolve(__dirname, '..', 'data', 'pools-state.json');
const POOLS_BACKUP_DIR_PATH =
  process.env.POOLS_BACKUP_DIR_PATH || path.resolve(__dirname, '..', 'data', 'backups');

const ASEKO_CLIENT_HEADERS = {
  'X-Client-Name': 'Thermal Park Nitrava Temperature Monitoring System',
  'X-Client-Version': '1',
  'Accept-Language': 'SK',
};

const POOL_DEFINITIONS = [
  { id: 1, name: 'Zážitkový bazén', deviceIdKey: 'zazitkovy-bazen-id', defaultDeviceId: '110181513' },
  { id: 2, name: 'Výplavový bazén', deviceIdKey: 'vyplavovy-bazen-id', defaultDeviceId: '110181534' },
  { id: 3, name: 'Slaný bazén' },
  { id: 4, name: 'Hypertermálny bazén' },
  { id: 5, name: 'Vírivka', deviceIdKey: 'virivka-id', defaultDeviceId: '110178320' },
  {
    id: 6,
    name: 'Detský bazén',
    deviceIdKey: 'detsky-bazen-id',
    defaultDeviceId: '110178006',
  },
  { id: 7, name: 'Bazén pri jazere' },
];

module.exports = {
  PORT,
  FETCH_INTERVAL_MS,
  STATS_WINDOW_MS,
  ASEKO_API_BASE_URL,
  ASEKO_KEY_FILE_PATH,
  DISCUS_SALTY_POOL_ID,
  DISCUS_SALTY_POOL_CSV_URL,
  POOLS_STATE_FILE_PATH,
  POOLS_BACKUP_DIR_PATH,
  ASEKO_CLIENT_HEADERS,
  POOL_DEFINITIONS,
};
