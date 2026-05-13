import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createMemoryStorage(initial) {
  const store = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    }
  };
}

describe('timezone', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', createMemoryStorage({}));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns UTC calendar date when timezone is auto', async () => {
    vi.setSystemTime(new Date('2024-07-10T15:00:00.000Z'));
    const { getTodayInTZ } = await import('./timezone.js');
    expect(getTodayInTZ()).toBe('2024-07-10');
  });

  it('formats today in a fixed IANA timezone', async () => {
    localStorage.setItem('cultiva-timezone', 'America/New_York');
    vi.setSystemTime(new Date('2024-07-10T02:00:00.000Z'));
    const { getTodayInTZ } = await import('./timezone.js');
    expect(getTodayInTZ()).toBe('2024-07-09');
  });

  it('getDateInTZ respects configured timezone', async () => {
    localStorage.setItem('cultiva-timezone', 'America/New_York');
    const { getDateInTZ } = await import('./timezone.js');
    const d = new Date('2024-12-25T05:00:00.000Z');
    expect(getDateInTZ(d)).toBe('2024-12-25');
  });
});
