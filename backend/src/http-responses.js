const { FETCH_INTERVAL_MS } = require('./config');

function buildPoolsResponse(lastFetchAt, poolsSummary) {
  return {
    fetchedAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    nextFetchInMs: FETCH_INTERVAL_MS,
    pools: poolsSummary,
  };
}

function buildPoolDetailsResponse(lastFetchAt, poolDetails) {
  return {
    fetchedAt: lastFetchAt ? lastFetchAt.toISOString() : null,
    pool: poolDetails,
  };
}

module.exports = {
  buildPoolsResponse,
  buildPoolDetailsResponse,
};
