/**
 * Shared timezone helpers (cultiva-timezone in localStorage).
 */

export function getCultivaTimezone() {
  const tz = localStorage.getItem('cultiva-timezone') || 'auto';
  return tz === 'auto' ? undefined : tz;
}

/** @returns {string} YYYY-MM-DD in configured timezone */
export function getTodayInTZ() {
  const now = new Date();
  const tz = getCultivaTimezone();

  if (!tz) {
    return now.toISOString().split('T')[0];
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;

    return `${year}-${month}-${day}`;
  } catch (e) {
    console.warn('[Timezone] Failed to get date with timezone, using local:', e);
    return now.toISOString().split('T')[0];
  }
}

/** @returns {string} YYYY-MM-DD for the given Date in configured timezone */
export function getDateInTZ(date) {
  const tz = getCultivaTimezone();
  if (!tz) {
    return date.toISOString().split('T')[0];
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;

    return `${year}-${month}-${day}`;
  } catch {
    return date.toISOString().split('T')[0];
  }
}
