import { db } from './db.js';

/* ============================================ */
/* STORAGE - CONSTANTS & STATE                   */
/* ============================================ */

const SESSION_KEY = 'cultiva_current_session';

let _habitsCache = [];
let _settingsCache = {};
let _isInitialized = false;
let _initPromise = null;
let _currentUserId = null;

/* ============================================ */
/* VALIDATION                                   */
/* ============================================ */

function validateHabit(habit) {
  if (!habit || typeof habit !== 'object') {
    console.warn('[Storage] Invalid habit: must be an object, fixing');
    return false;
  }
  if (!habit.id || typeof habit.id !== 'string') {
    habit.id = crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36);
  }
  if (!habit.name || typeof habit.name !== 'string') {
    habit.name = 'Unnamed Habit';
  }
  if (habit.progress !== undefined && typeof habit.progress !== 'number') {
    habit.progress = parseInt(habit.progress, 10) || 0;
  }
  return true;
}

/* ============================================ */
/* MIGRATION                                    */
/* ============================================ */

function migrateHabit(habit) {
  const migrated = { ...habit };

  if (migrated.streak !== undefined && migrated.currentStreak === undefined) {
    migrated.currentStreak = migrated.streak;
  }
  if (migrated.currentStreak === undefined) {
    migrated.currentStreak = 0;
  }

  if (migrated.bestStreak === undefined) {
    migrated.bestStreak = migrated.currentStreak || 0;
  }

  if (!migrated.history || !Array.isArray(migrated.history)) {
    migrated.history = [];
  }

  if (!migrated.dailyProgress || typeof migrated.dailyProgress !== 'object') {
    migrated.dailyProgress = {};
  }

  const tt = String(migrated.trackType || 'binary').toLowerCase();
  migrated.trackType = tt === 'quantity' ? 'quantity' : 'binary';
  const tgtNum = Number(migrated.target);
  if (migrated.trackType === 'quantity') {
    migrated.target = Number.isFinite(tgtNum) && tgtNum > 0 ? tgtNum : 1;
  } else {
    migrated.target = 1;
  }

  if (migrated.userId && migrated.userId.includes('@')) {
    migrated.userId = null;
  }

  delete migrated.streak;

  migrated.updatedAt = Date.now();

  return migrated;
}

/* ============================================ */
/* HABITS PERSIST (no clear-before-write)       */
/* ============================================ */

async function _persistHabitsUpsert(myHabits) {
  const dbInstance = await db.open();
  const uid = myHabits.length > 0 ? myHabits[0].userId : (_currentUserId ?? null);
  const existing = await db.getByIndex('habits', 'userId', uid);

  await new Promise((resolve, reject) => {
    const tx = dbInstance.transaction('habits', 'readwrite');
    const store = tx.objectStore('habits');
    const newIds = new Set(myHabits.map((h) => h.id));

    for (const h of existing) {
      if (!newIds.has(h.id)) {
        store.delete(h.id);
      }
    }
    for (const habit of myHabits) {
      store.put(habit);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const storage = {
  async init() {
    if (_isInitialized) {
      console.log('[Storage] Already initialized');
      return _initPromise;
    }

    if (_initPromise) {
      console.log('[Storage] Init in progress, waiting...');
      return _initPromise;
    }

    _initPromise = this._doInit();
    return _initPromise;
  },

  async _doInit() {
    console.log('[Storage] Initializing...');

    try {
      const session = await db.get('sessions', SESSION_KEY);
      if (session && session.email) {
        _currentUserId = session.email;
      } else {
        _currentUserId = null;
      }
    } catch (e) {
      console.error('[Storage] Session check failed:', e);
      _currentUserId = null;
    }

    await this._loadFromDB();

    if (Object.keys(_settingsCache).length === 0) {
      const lsBundle = localStorage.getItem('cultiva-settings');
      if (lsBundle) {
        try {
          const parsed = JSON.parse(lsBundle);
          if (parsed && typeof parsed === 'object') {
            const flatKeys = new Set(['lang', 'theme', 'showTrophies', 'focusMode', 'holidayRegion', 'avatar', 'pluginsEnabled', 'nativeNotifyEnabled', 'nativeNotifyHabits', 'nativeNotifyHabitsHour', 'nativeNotifyCalendar', 'nativeNotifyCalendarLeadMinutes']);
            const keys = Object.keys(parsed);
            const looksLikeFlatAppSettings = keys.some((k) => flatKeys.has(k)) && !keys.includes('cultiva-settings');
            if (looksLikeFlatAppSettings) {
              _settingsCache['cultiva-settings'] = parsed;
              await db.put('settings', { key: 'cultiva-settings', value: parsed });
            } else {
              for (const [k, v] of Object.entries(parsed)) {
                _settingsCache[k] = v;
                await db.put('settings', { key: k, value: v });
              }
            }
            console.log('[Storage] Migrated settings from localStorage to IndexedDB (one-time)');
          }
        } catch (e) {
          console.warn('[Storage] Settings bundle migration failed:', e);
        }
      }
    }

    const legacyPlugins = localStorage.getItem('cultiva-installed-plugins');
    if (legacyPlugins && (_settingsCache['cultiva-installed-plugins'] === undefined || _settingsCache['cultiva-installed-plugins'] === null)) {
      try {
        const arr = JSON.parse(legacyPlugins);
        if (Array.isArray(arr)) {
          _settingsCache['cultiva-installed-plugins'] = arr;
          await db.put('settings', { key: 'cultiva-installed-plugins', value: arr });
          console.log('[Storage] Migrated cultiva-installed-plugins from localStorage to IndexedDB');
        }
      } catch (e) {
        console.warn('[Storage] Legacy plugin list migration failed:', e);
      }
    }

    let needsSave = false;
    _habitsCache = _habitsCache.map((h) => {
      const migrated = migrateHabit(h);
      if (JSON.stringify(h) !== JSON.stringify(migrated)) {
        needsSave = true;
      }
      return migrated;
    });

    if (needsSave) {
      console.log('[Storage] Applying habit migration...');
      await this._forceSaveHabits(_habitsCache);
    }

    const localHabits = localStorage.getItem('cultiva-habits');
    if (localHabits && _habitsCache.length === 0) {
      try {
        const parsed = JSON.parse(localHabits);
        _habitsCache = parsed.map(migrateHabit);
        await this._forceSaveHabits(_habitsCache);
      } catch (e) {
        console.error('[Storage] Failed to restore habits from localStorage:', e);
      }
    }

    _isInitialized = true;
    console.log('[Storage] System ready,', _habitsCache.length, 'habits loaded');
    return _habitsCache;
  },

  isReady() {
    return _isInitialized;
  },

  async _loadFromDB() {
    try {
      const allHabits = await db.getAll('habits');
      console.log('[Storage] Raw habits from DB:', allHabits.length);

      _habitsCache = allHabits.filter((h) => {
        if (_currentUserId === null) {
          return h.userId === null || h.userId === undefined;
        }
        return h.userId === _currentUserId;
      });

      const settingsRows = await db.getAll('settings');
      _settingsCache = {};
      for (const row of settingsRows) {
        if (row && row.key !== undefined) {
          _settingsCache[row.key] = row.value;
        }
      }

      console.log('[Storage] Loaded', _habitsCache.length, 'habits for user:', _currentUserId || 'guest');

      if (_habitsCache.length > 0) {
        localStorage.setItem('cultiva-habits', JSON.stringify(_habitsCache));
      }
    } catch (e) {
      console.error('[Storage] Failed to load from IndexedDB:', e);

      const h = localStorage.getItem('cultiva-habits');
      if (h) {
        try {
          const parsed = JSON.parse(h);
          _habitsCache = parsed.map(migrateHabit);
          console.log('[Storage] Loaded', _habitsCache.length, 'habits from localStorage fallback');
        } catch (parseErr) {
          console.error('[Storage] Failed to parse localStorage habits:', parseErr);
          _habitsCache = [];
        }
      }

      const s = localStorage.getItem('cultiva-settings');
      if (s) {
        try {
          const parsed = JSON.parse(s);
          if (parsed && typeof parsed === 'object') {
            _settingsCache = { ...parsed };
          }
        } catch (parseErr) {
          _settingsCache = {};
        }
      }
    }
  },

  async _forceSaveHabits(habits) {
    const validHabits = habits.filter((h) => {
      validateHabit(h);
      return true;
    });

    try {
      await _persistHabitsUpsert(validHabits);
      localStorage.setItem('cultiva-habits', JSON.stringify(validHabits));
    } catch (e) {
      console.error('[Storage] Force save failed:', e);
      localStorage.setItem('cultiva-habits', JSON.stringify(validHabits));
    }
  },

  getHabits() {
    console.log('[Storage] getHabits called, returning', _habitsCache.length, 'habits');
    return _habitsCache;
  },

  async get(key) {
    if (!_isInitialized) {
      await this.init();
    }
    return _settingsCache[key] ?? null;
  },

  getCurrentUserId() {
    return _currentUserId;
  },

  async setCurrentUser(userId) {
    console.log('[Storage] Setting current user:', userId);
    _currentUserId = userId;
    await this._loadFromDB();
  },

  async saveHabits(habits) {
    console.log('[Storage] saveHabits called with', habits.length, 'habits');

    const validHabits = habits.filter((h) => {
      validateHabit(h);
      return true;
    });

    const myHabits = validHabits.map((h) => {
      const migrated = migrateHabit(h);
      return {
        ...migrated,
        userId: _currentUserId || null,
        updatedAt: Date.now()
      };
    });

    _habitsCache = myHabits;

    try {
      await _persistHabitsUpsert(myHabits);
      localStorage.setItem('cultiva-habits', JSON.stringify(myHabits));
      console.log('[Storage] Saved', myHabits.length, 'habits to IndexedDB');
    } catch (e) {
      console.error('[Storage] IndexedDB save failed, using localStorage only:', e);
      localStorage.setItem('cultiva-habits', JSON.stringify(myHabits));
      _habitsCache = myHabits;
    }
  },

  async set(key, value) {
    _settingsCache[key] = value;

    try {
      await db.put('settings', { key, value });
    } catch (e) {
      console.warn('[Storage] IDB write failed, using localStorage fallback');
    }

    try {
      localStorage.setItem('cultiva-settings', JSON.stringify(_settingsCache));
    } catch (e) {
      console.error('[Storage] Failed to sync localStorage:', e);
    }
  },

  async clearAll() {
    console.log('[Storage] Clearing all data...');
    _habitsCache = [];
    _settingsCache = {};

    try {
      const dbInstance = await db.open();
      await new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(['habits', 'settings', 'sessions'], 'readwrite');
        tx.objectStore('habits').clear();
        tx.objectStore('settings').clear();
        tx.objectStore('sessions').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error('[Storage] Clear failed:', e);
    }

    localStorage.removeItem('cultiva-habits');
    localStorage.removeItem('cultiva-settings');
    console.log('[Storage] All data cleared');
  }
};
