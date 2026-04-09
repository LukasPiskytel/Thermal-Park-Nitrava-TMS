const API_BASE_URL = 'http://localhost:3001/api/pools';
const REFRESH_API_URL = 'http://localhost:3001/api/pools/refresh';

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

function formatTemperature(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--.-';
  }

  return value.toFixed(1);
}

function formatDateDMY(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return `${day}.${month}.${year}`;
}

function formatTimeHM(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return `${formatDateDMY(value)} ${formatTimeHM(value)}`;
}

function formatAxisTime(msValue) {
  return new Date(msValue).toLocaleTimeString('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

function buildChart(fetchLog) {
  if (!Array.isArray(fetchLog) || fetchLog.length === 0) {
    return '<p class="status">Nedostatok dat pre graf.</p>';
  }

  const width = 920;
  const height = 360;
  const margin = { top: 24, right: 24, bottom: 64, left: 74 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const temperatures = fetchLog.map((entry) => entry.temperature);
  const times = fetchLog.map((entry) => new Date(entry.timestamp).getTime());

  const rawMinTemp = Math.min(...temperatures);
  const rawMaxTemp = Math.max(...temperatures);
  const tempPadding = rawMinTemp === rawMaxTemp ? 0.6 : Math.max((rawMaxTemp - rawMinTemp) * 0.08, 0.2);
  const minTemp = rawMinTemp - tempPadding;
  const maxTemp = rawMaxTemp + tempPadding;
  const tempRange = maxTemp - minTemp || 1;

  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  const toX = (timeMs) => margin.left + ((timeMs - minTime) / timeRange) * innerWidth;
  const toY = (temp) => margin.top + (1 - (temp - minTemp) / tempRange) * innerHeight;

  const points = fetchLog
    .map((entry) => `${toX(new Date(entry.timestamp).getTime()).toFixed(2)},${toY(entry.temperature).toFixed(2)}`)
    .join(' ');

  const circles = fetchLog
    .map((entry) => {
      const cx = toX(new Date(entry.timestamp).getTime()).toFixed(2);
      const cy = toY(entry.temperature).toFixed(2);
      return `<circle class="point" cx="${cx}" cy="${cy}" r="3.2" />`;
    })
    .join('');

  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, index) => {
    const ratio = index / (yTickCount - 1);
    return maxTemp - ratio * tempRange;
  });

  const yTickLines = yTicks
    .map((tick) => {
      const y = toY(tick).toFixed(2);
      return `<line class="axis-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" />`;
    })
    .join('');

  const yTickLabels = yTicks
    .map((tick) => {
      const y = toY(tick).toFixed(2);
      return `<text class="tick-label" x="${(margin.left - 10).toFixed(2)}" y="${y}" text-anchor="end" dominant-baseline="middle">${formatTemperature(tick)}</text>`;
    })
    .join('');

  const xTickCount = Math.min(6, Math.max(2, fetchLog.length));
  const xTicks =
    minTime === maxTime
      ? [minTime]
      : Array.from({ length: xTickCount }, (_, index) => {
          const ratio = index / (xTickCount - 1);
          return minTime + ratio * timeRange;
        });

  const xTickLines = xTicks
    .map((tick) => {
      const x = toX(tick).toFixed(2);
      return `<line class="axis-grid" x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" />`;
    })
    .join('');

  const xTickLabels = xTicks
    .map((tick, index) => {
      const x = toX(tick).toFixed(2);
      const label = escapeHtml(formatAxisTime(tick));
      const anchor = index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle';
      return `<text class="tick-label" x="${x}" y="${(height - margin.bottom + 18).toFixed(2)}" text-anchor="${anchor}">${label}</text>`;
    })
    .join('');

  return `
    <div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <line class="axis-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" />
        <line class="axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" />

        ${yTickLines}
        ${xTickLines}
        ${yTickLabels}
        ${xTickLabels}

        <text class="axis-label" x="20" y="${(height / 2).toFixed(2)}" transform="rotate(-90, 20, ${
          height / 2
        })">Teplota (°C)</text>
        <text class="axis-label" x="${(width / 2).toFixed(2)}" y="${(height - 10).toFixed(2)}" text-anchor="middle">Cas</text>

        <polyline class="line" points="${points}" />
        ${circles}
      </svg>
    </div>
  `;
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
      <p class="header-subtitle">Zobrazene su vsetky zaznamenane teploty, typ fetchu a grafovy priebeh.</p>

      ${renderSummary(detail)}

      <section class="panel">
        <h2>Graf teploty (os Y: teplota, os X: cas)</h2>
        ${buildChart(fetchLog)}
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
  const response = await fetch(`${API_BASE_URL}/${poolId}/details`);

  if (!response.ok) {
    throw new Error('Nepodarilo sa nacitat detail bazena.');
  }

  const data = await response.json();
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
    const response = await fetch(REFRESH_API_URL, { method: 'POST' });

    if (!response.ok) {
      throw new Error('Nepodarilo sa vykonat manualny refresh.');
    }

    state.detail = await fetchPoolDetails();
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Neznama chyba.';
  } finally {
    state.refreshing = false;
    render();
  }
}

void loadDetail();
