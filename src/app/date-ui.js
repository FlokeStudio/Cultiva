import { getTodayInTZ } from '../core/timezone.js';

/** @returns {string} YYYY-MM-DD in Cultiva timezone (same as habits calendar day). */
export function getTodayStr() {
  return getTodayInTZ();
}
