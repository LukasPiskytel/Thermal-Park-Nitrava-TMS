import { formatAxisTime, formatTemperature } from './shared/formatters';

export function buildDetailChart(fetchLog, escapeHtml) {
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
        <text class="axis-label" x="${(width / 2).toFixed(2)}" y="${(height - 10).toFixed(2)}" text-anchor="middle">Čas</text>

        <polyline class="line" points="${points}" />
        ${circles}
      </svg>
    </div>
  `;
}
