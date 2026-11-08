export const SUPPORTED_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(paise) {
  const num = Number(paise || 0);
  return inrFormatter.format(num / 100);
}

/**
 * Converts a rupee string/number (e.g. "1250.75") into exact integer paise (125075).
 * Returns null if invalid.
 */
export function rupeesToPaise(value) {
  const str = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return null;
  }
  const [whole, frac = ''] = str.split('.');
  const paddedFrac = frac.padEnd(2, '0');
  return Number(whole) * 100 + Number(paddedFrac);
}

export function paiseToRupeesInput(paise) {
  if (paise === null || paise === undefined) return '';
  return (Number(paise) / 100).toFixed(2);
}

export function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDate(isoOrDate, timeZone = 'Asia/Kolkata') {
  if (!isoOrDate) return '—';
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateRange(start, end, timeZone = 'Asia/Kolkata') {
  if (!start || !end) return '—';
  return `${formatDate(start, timeZone)} – ${formatDate(end, timeZone)}`;
}

export function formatTime(isoOrDate, timeZone = 'Asia/Kolkata') {
  if (!isoOrDate) return '—';
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDateTime(isoOrDate, timeZone = 'Asia/Kolkata') {
  if (!isoOrDate) return '—';
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function getLocalDateKey(isoOrDate, timeZone = 'Asia/Kolkata') {
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Formats a UTC ISO timestamp as "YYYY-MM-DDTHH:mm" in the specified IANA timezone
 * for populating <input type="datetime-local"> accurately.
 */
export function utcIsoToZonedInput(isoOrDate, timeZone = 'Asia/Kolkata') {
  if (!isoOrDate) return '';
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '';
  const p = getZonedParts(date, timeZone);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" wall-clock value interpreted in `timeZone`
 * into an exact UTC ISO-8601 string, independent of the user's browser timezone.
 */
export function zonedDateTimeToUtcIso(localDateTimeStr, timeZone = 'Asia/Kolkata') {
  if (!localDateTimeStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(
    localDateTimeStr.trim()
  );
  if (!match) return null;

  const [, y, m, d, hh, mm] = match.map(Number);
  const desiredUtcWallMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  let guessMs = desiredUtcWallMs;
  for (let i = 0; i < 3; i += 1) {
    const p = getZonedParts(new Date(guessMs), timeZone);
    const renderedUtcWallMs = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      0
    );
    const diff = desiredUtcWallMs - renderedUtcWallMs;
    if (diff === 0) break;
    guessMs += diff;
  }

  return new Date(guessMs).toISOString();
}

