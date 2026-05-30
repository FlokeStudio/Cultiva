import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createMemoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; }
  };
}

const store = { habits: [] };

vi.mock('./storage.js', () => ({
  storage: {
    getHabits: () => store.habits,
    saveHabits: (list) => { store.habits = list; },
    getCurrentUserId: () => null
  }
}));

describe('habits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', createMemoryStorage({}));
    vi.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
    store.habits = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('coerces quantity progress from strings', async () => {
    const { habits } = await import('./habits.js');
    expect(habits.quantityDayProgress({ dailyProgress: { '2026-05-30': '3' } }, '2026-05-30')).toBe(3);
    expect(habits.quantityDayProgress({ dailyProgress: {} }, '2026-05-30')).toBe(0);
  });

  it('defaults quantity target to at least 1', async () => {
    const { habits } = await import('./habits.js');
    expect(habits.quantityTarget({ target: 0 })).toBe(1);
    expect(habits.quantityTarget({ target: 5 })).toBe(5);
  });

  it('toggles binary completion for today', async () => {
    const { habits } = await import('./habits.js');
    const h = habits.add({ name: 'Meditate', trackType: 'binary' });
    habits.toggle(h.id);
    const done = habits.getAll().find((x) => x.id === h.id);
    expect(done.lastCompleted).toBe('2026-05-30');
    expect(done.progress).toBe(1);
    habits.toggle(h.id);
    const undone = habits.getAll().find((x) => x.id === h.id);
    expect(undone.lastCompleted).toBeNull();
    expect(undone.progress).toBe(0);
  });

  it('increments quantity habits until target is met', async () => {
    const { habits } = await import('./habits.js');
    const h = habits.add({ name: 'Water', trackType: 'quantity', target: 2 });
    habits.toggle(h.id);
    let cur = habits.getAll().find((x) => x.id === h.id);
    expect(cur.dailyProgress['2026-05-30']).toBe(1);
    expect(cur.progress).toBe(0);
    habits.toggle(h.id);
    cur = habits.getAll().find((x) => x.id === h.id);
    expect(cur.dailyProgress['2026-05-30']).toBe(2);
    expect(cur.progress).toBe(1);
  });
});
