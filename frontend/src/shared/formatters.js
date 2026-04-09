export function formatTemperature(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--.-';
  }

  return value.toFixed(1);
}

function toValidDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateDMY(value) {
  const date = toValidDate(value);

  if (!date) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  return `${day}.${month}.${year}`;
}

export function formatTimeHM(value) {
  const date = toValidDate(value);

  if (!date) {
    return '--:--';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return `${formatDateDMY(value)} ${formatTimeHM(value)}`;
}

export function formatAxisTime(msValue) {
  return new Date(msValue).toLocaleTimeString('sk-SK', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
