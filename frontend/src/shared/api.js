const API_BASE_URL = 'http://localhost:3001/api/pools';

export const apiUrls = {
  pools: API_BASE_URL,
  refresh: `${API_BASE_URL}/refresh`,
  poolDetails: (poolId) => `${API_BASE_URL}/${poolId}/details`,
};

export async function fetchJson(url, options = {}, defaultErrorMessage = 'Request failed') {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(defaultErrorMessage);
  }

  return response.json();
}
