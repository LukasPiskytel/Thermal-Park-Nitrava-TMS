const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/pools';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const apiUrls = {
  pools: API_BASE_URL,
  refresh: `${API_BASE_URL}/refresh`,
  poolDetails: (poolId) => `${API_BASE_URL}/${poolId}/details`,
};

export async function fetchJson(url, options = {}, defaultErrorMessage = 'Požiadavka zlyhala') {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
  });

  if (!response.ok) {
    throw new Error(defaultErrorMessage);
  }

  return response.json();
}
