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
  return fetchType === 'manual' ? 'Manuálne' : 'Automatické';
}

function trendLabel(trend) {
  if (trend === 'up') return 'Stúpa';
  if (trend === 'down') return 'Klesá';
  return 'Stabilný';
}

function sourceLabel(source) {
  if (source === 'aseko') {
    return 'ASEKO';
  }

  if (source === 'discus') {
    return 'DISCUS';
  }

  if (source === 'simulated') {
    return 'Simulované';
  }

  return '-';
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
        <span class="summary-label">Aktuálna teplota</span>
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
        <span class="summary-value">${escapeHtml(sourceLabel(detail.source))}</span>
      </article>
    </section>
  `;
}

function renderLogTable(fetchLog) {
  if (!fetchLog.length) {
    return '<p class="status">Zatiaľ nie sú uložené žiadne údaje o načítaní.</p>';
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
            <th>Dátum a čas</th>
            <th>Typ načítania</th>
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
    root.innerHTML = '<main class="detail-page"><p class="status">Načítavam detail bazéna...</p></main>';
    return;
  }

  if (state.error) {
    root.innerHTML = `<main class="detail-page"><p class="error">${escapeHtml(state.error)}</p></main>`;
    return;
  }

  const detail = state.detail;

  if (!detail) {
    root.innerHTML = '<main class="detail-page"><p class="error">Detail bazéna nie je dostupný.</p></main>';
    return;
  }

  const fetchLog = Array.isArray(detail.fetchLog) ? detail.fetchLog : [];

  root.innerHTML = `
    <main class="detail-page">
      <header class="topbar">
        <a href="/" class="back-link">← Späť na prehľad</a>
        <button class="refresh-button" data-action="refresh" ${state.refreshing ? 'disabled' : ''}>Aktualizovať dáta</button>
      </header>

      <h1 class="header-title">Detail bazéna: ${escapeHtml(detail.name)}</h1>

      ${renderSummary(detail)}

      <section class="panel">
        <h2>Graf teploty</h2>
        ${buildDetailChart(fetchLog, escapeHtml)}
      </section>

      <section class="panel">
        <h2>Všetky načítané teploty</h2>
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
    `${apiUrls.poolDetails(poolId)}?t=${Date.now()}`,
    {},
    'Nepodarilo sa načítať detail bazéna.',
  );
  return data.pool;
}

async function loadDetail() {
  state.loading = true;
  state.error = '';
  render();

  if (!Number.isInteger(poolId) || poolId <= 0) {
    state.loading = false;
    state.error = 'Neplatné ID bazéna v URL.';
    render();
    return;
  }

  try {
    state.detail = await fetchPoolDetails();
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Neznáma chyba.';
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
      `${apiUrls.refresh}?t=${Date.now()}`,
      { method: 'POST' },
      'Nepodarilo sa vykonať manuálnu aktualizáciu.',
    );

    state.detail = await fetchPoolDetails();
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Neznáma chyba.';
  } finally {
    state.refreshing = false;
    render();
  }
}

void loadDetail();
