const fs = require('fs/promises');
const path = require('path');
const { POOLS_STATE_FILE_PATH, POOLS_BACKUP_DIR_PATH } = require('./config');

function formatBackupDateKey(msValue) {
  const date = new Date(msValue);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

function parseBackupRecords(rawParsed) {
  if (Array.isArray(rawParsed)) {
    return rawParsed;
  }

  if (rawParsed && typeof rawParsed === 'object' && Array.isArray(rawParsed.records)) {
    return rawParsed.records;
  }

  return [];
}

function normalizeBackupRecord(rawEntry) {
  if (!rawEntry || typeof rawEntry !== 'object') {
    return null;
  }

  const poolId = Number(rawEntry.poolId);
  const temperature = Number(rawEntry.temperature);
  const fetchedAtMs = Number(rawEntry.fetchedAtMs);

  if (!Number.isInteger(poolId) || !Number.isFinite(temperature) || !Number.isFinite(fetchedAtMs)) {
    return null;
  }

  return {
    poolId,
    poolName: typeof rawEntry.poolName === 'string' ? rawEntry.poolName : '',
    fetchedAtMs: Math.trunc(fetchedAtMs),
    timestamp: new Date(fetchedAtMs).toISOString(),
    temperature: Number(temperature.toFixed(1)),
    fetchType: rawEntry.fetchType === 'manual' ? 'manual' : 'auto',
    source: rawEntry.source === 'aseko' ? 'aseko' : 'simulated',
  };
}

async function readPersistedState() {
  try {
    const rawContent = await fs.readFile(POOLS_STATE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(rawContent);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    console.warn(`[WARN] Nepodarilo sa načítať uložený stav: ${error.message}`);
    return null;
  }
}

async function writePersistedState(statePayload) {
  try {
    await fs.mkdir(path.dirname(POOLS_STATE_FILE_PATH), { recursive: true });
    await fs.writeFile(POOLS_STATE_FILE_PATH, `${JSON.stringify(statePayload)}\n`, 'utf8');
  } catch (error) {
    console.warn(`[WARN] Nepodarilo sa uložiť stav: ${error.message}`);
  }
}

async function appendExpiredDataBackups(expiredEntries) {
  if (!Array.isArray(expiredEntries) || expiredEntries.length === 0) {
    return;
  }

  const normalizedEntries = expiredEntries.map((entry) => normalizeBackupRecord(entry)).filter(Boolean);

  if (normalizedEntries.length === 0) {
    return;
  }

  const groupedByDate = new Map();

  normalizedEntries.forEach((entry) => {
    const dateKey = formatBackupDateKey(entry.fetchedAtMs);

    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, []);
    }

    groupedByDate.get(dateKey).push(entry);
  });

  try {
    await fs.mkdir(POOLS_BACKUP_DIR_PATH, { recursive: true });

    for (const [dateKey, entriesForDate] of groupedByDate.entries()) {
      const backupFilePath = path.join(POOLS_BACKUP_DIR_PATH, `${dateKey}.json`);
      let createdAt = new Date().toISOString();
      let existingRecords = [];

      try {
        const rawExisting = await fs.readFile(backupFilePath, 'utf8');
        const parsedExisting = JSON.parse(rawExisting);
        existingRecords = parseBackupRecords(parsedExisting)
          .map((entry) => normalizeBackupRecord(entry))
          .filter(Boolean);

        if (parsedExisting && typeof parsedExisting === 'object' && parsedExisting.createdAt) {
          createdAt = parsedExisting.createdAt;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`[WARN] Nepodarilo sa načítať zálohu ${backupFilePath}: ${error.message}`);
        }
      }

      const dedupe = new Map();
      [...existingRecords, ...entriesForDate].forEach((entry) => {
        const key = `${entry.poolId}|${entry.fetchedAtMs}|${entry.temperature}|${entry.fetchType}|${entry.source}`;

        if (!dedupe.has(key)) {
          dedupe.set(key, entry);
        }
      });

      const mergedRecords = [...dedupe.values()].sort((a, b) => a.fetchedAtMs - b.fetchedAtMs);
      const payload = {
        backupDate: dateKey,
        createdAt,
        updatedAt: new Date().toISOString(),
        records: mergedRecords,
      };

      await fs.writeFile(backupFilePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
  } catch (error) {
    console.warn(`[WARN] Nepodarilo sa zapísať zálohu starších dát: ${error.message}`);
  }
}

module.exports = {
  readPersistedState,
  writePersistedState,
  appendExpiredDataBackups,
};
