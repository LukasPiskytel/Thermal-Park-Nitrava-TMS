import { apiUrls, fetchJson } from './shared/api';
import { buildDetailChart } from './detail-chart';
import { formatDateTime, formatTemperature } from './shared/formatters';

const root = document.querySelector('#detail-root');
const params = new URLSearchParams(window.location.search);
const poolId = Number(params.get('poolId') || 6);

const state = {
  loading: true,
  refreshing: false,
  error: '',
  detail: null,
};

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fetchTypeLabel(fetchType) {
  return fetchType === 'manual' ? 'Manual' : 'Auto';
}

function trendLabel(trend) {
  if (trend === 'up') return 'Stupa';
  if (trend === 'down') return 'Klesa';
  return 'Stabilna';
}

function trendArrow(trend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function renderSummary(detail) {
  return `
    <section class="summary-grid">
      <article class="summary-item">
        <span class="summary-label">Aktualna teplota</span>
        <span class="summary-value">${formatTemperature(detail.temperature)} °C</span>
      </article>
      <article class="summary-item">
        <span class="summary-label">Trend</span>
        <span class="summary-value">${trendArrow(detail.trend)} ${trendLabel(detail.trend)}</span>
      </article>
      <article class="summary-item">
        <span class="summary-label">Min 24h</span>
        <span class="summary-value">${formatTemperature(detail.minTemp24h)} °C</span>
      </article>
      <article class="summary-item">
        <span class="summary-label">Max 24h</span>
        <span class="summary-value">${formatTemperature(detail.maxTemp24h)} °C</span>
      </article>
      <article class="summary-item">
        <span class="summary-label">Priemer 24h</span>
        <span class="summary-value">${formatTemperature(detail.avgTemp24h)} °C</span>
      </article>
      <article class="summary-item">
        <span class="summary-label">Zdroj</span>
        <span class="summary-value">${escapeHtml(detail.source || '-')}</span>
      </article>
    </section>
  `;
}

function renderLogTable(fetchLog) {
  if (!fetchLog.length) {
    return '<p class="status">Zatial nie su ziadne ulozene fetch data.</p>';
  }

  const rows = [...fetchLog]
    .reverse()
    .map((entry) => {
      return `
        <tr>
          <td>${escapeHtml(formatDateTime(entry.timestamp))}</td>
          <td>${escapeHtml(fetchTypeLabel(entry.fetchType))}</td>
          <td>${formatTemperature(entry.temperature)} °C</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Datum a cas</th>
            <th>Typ fetchu</th>
            <th>Teplota</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function render() {
  if (!root) {
    return;
  }

  if (state.loading) {
    root.innerHTML = '<main class="detail-page"><p class="status">Nacitavam detail bazena...</p></main>';
    return;
  }

  if (state.error) {
    root.innerHTML = `<main class="detail-page"><p class="error">${escapeHtml(state.error)}</p></main>`;
    return;
  }

  const detail = state.detail;

  if (!detail) {
    root.innerHTML = '<main class="detail-page"><p class="error">Detail bazena nie je dostupny.</p></main>';
    return;
  }

  const fetchLog = Array.isArray(detail.fetchLog) ? detail.fetchLog : [];

  root.innerHTML = `
    <main class="detail-page">
      <header class="topbar">
        <a href="/" class="back-link">← Spat na prehlad</a>
        <button class="refresh-button" data-action="refresh" ${state.refreshing ? 'disabled' : ''}>Aktualizovat data</button>
      </header>

      <h1 class="header-title">${escapeHtml(detail.name)} - detail</h1>

      ${renderSummary(detail)}

      <section class="panel">
        <h2>Graf teploty</h2>
        ${buildDetailChart(fetchLog, escapeHtml)}
      </section>

      <section class="panel">
        <h2>Vsetky nacitane teploty</h2>
        ${renderLogTable(fetchLog)}
      </section>
    </main>
  `;

  const refreshButton = root.querySelector('[data-action="refresh"]');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      void handleRefresh();
    });
  }
}

async function fetchPoolDetails() {
  const data = await fetchJson(
    apiUrls.poolDetails(poolId),
    {},
    'Nepodarilo sa nacitat detail bazena.',
  );
  return data.pool;
}

async function loadDetail() {
  state.loading = true;
  state.error = '';
  render();

  if (!Number.isInteger(poolId) || poolId <= 0) {
    state.loading = false;
    state.error = 'Neplatne ID bazena v URL.';
    render();
    return;
  }

  try {
    state.detail = await fetchPoolDetails();
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Neznama chyba.';
  } finally {
    state.loading = false;
    render();
  }
}

async function handleRefresh() {
  if (state.refreshing) {
    return;
  }

  state.refreshing = true;
  state.error = '';
  render();

  try {
    await fetchJson(
      apiUrls.refresh,
      { method: 'POST' },
      'Nepodarilo sa vykonat manualny refresh.',
    );

    state.detail = await fetchPoolDetails();
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Neznama chyba.';
  } finally {
    state.refreshing = false;
    render();
  }
}

void loadDetail();
