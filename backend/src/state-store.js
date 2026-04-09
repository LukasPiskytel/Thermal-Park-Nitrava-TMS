const fs = require('fs/promises');
const path = require('path');
const { POOLS_STATE_FILE_PATH } = require('./config');

async function readPersistedState() {
  try {
    const rawContent = await fs.readFile(POOLS_STATE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(rawContent);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    console.warn(`[WARN] Failed to load persisted state: ${error.message}`);
    return null;
  }
}

async function writePersistedState(statePayload) {
  try {
    await fs.mkdir(path.dirname(POOLS_STATE_FILE_PATH), { recursive: true });
    await fs.writeFile(POOLS_STATE_FILE_PATH, `${JSON.stringify(statePayload)}\n`, 'utf8');
  } catch (error) {
    console.warn(`[WARN] Failed to persist state: ${error.message}`);
  }
}

module.exports = {
  readPersistedState,
  writePersistedState,
};
