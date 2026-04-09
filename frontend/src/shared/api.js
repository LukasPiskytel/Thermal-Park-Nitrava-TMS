const API_BASE_URL = '/api/pools';

export const apiUrls = {
  pools: API_BASE_URL,
  refresh: `${API_BASE_URL}/refresh`,
  poolDetails: (poolId) => `${API_BASE_URL}/${poolId}/details`,
};

export async function fetchJson(url, options = {}, defaultErrorMessage = 'Požiadavka zlyhala') {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(defaultErrorMessage);
  }

  return response.json();
}
