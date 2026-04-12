import { db } from './db.js';

/* ============================================ */
/* STORAGE - CONSTANTS & STATE                   */
/* ============================================ */

const MIGRATION_FLAG = 'cultiva_migrated_to_idb_v2';
const SESSION_KEY = 'cultiva_current_session';

let _habitsCache = [];
let _settingsCache = {};
let _isInitialized = false;
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
    habit.progress = parseInt(habit.progress) || 0;
  }
  return true;
}

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return false;
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
  

  if (migrated.userId && migrated.userId.includes('@')) {
    migrated.userId = null;
  }
  

  delete migrated.streak;
  

  migrated.updatedAt = Date.now();
  
  return migrated;
}

/* ============================================ */
/* STORAGE API                                  */
/* ============================================ */

export const storage = {
  async init() {
    if (_isInitialized) {
      console.log('[Storage] Already initialized');
      return;
    }

    console.log('[Storage] Initializing...');
    
    try {
        const session = await db.get('sessions', SESSION_KEY);
        if (session && session.email) {
            _currentUserId = session.email;
            console.log('[Storage] Restored session for:', _currentUserId);
        } else {
            _currentUserId = null;
            console.log('[Storage] No active session, running as guest');
        }
    } catch (e) {
        console.error('[Storage] Session check failed:', e);
        _currentUserId = null;
    }

    await this._loadFromDB();
    

    let needsSave = false;
    _habitsCache = _habitsCache.map(h => {
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
        console.log('[Storage] Restored', _habitsCache.length, 'habits from localStorage backup');
        await this._forceSaveHabits(_habitsCache);
      } catch (e) {
        console.error('[Storage] Failed to restore from localStorage:', e);
      }
    }
    
    _isInitialized = true;
    console.log('[Storage] System ready,', _habitsCache.length, 'habits loaded');
  },

  async _loadFromDB() {
    try {
      const allHabits = await db.getAll('habits');
      console.log('[Storage] Raw habits from DB:', allHabits.length);
      

      _habitsCache = allHabits.filter(h => {

        if (_currentUserId === null) {
          return h.userId === null || h.userId === undefined;
        }

        return h.userId === _currentUserId;
      });
      
      const settingsRecord = await db.get('settings', 'cultiva-settings');
      _settingsCache = settingsRecord ? settingsRecord.value : {};
      
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
          _settingsCache = JSON.parse(s);
        } catch (parseErr) {
          _settingsCache = {};
        }
      }
    }
  },

  async _forceSaveHabits(habits) {
    const validHabits = habits.filter(h => {
      validateHabit(h);
      return true;
    });
    
    try {
      const dbInstance = await db.open();
      
      await new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('habits', 'readwrite');
        const store = tx.objectStore('habits');
        

        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {

          validHabits.forEach(habit => {
            store.put(habit);
          });
        };
        
        tx.oncomplete = () => {
          console.log('[Storage] Force saved', validHabits.length, 'habits to IndexedDB');
          resolve();
        };
        
        tx.onerror = () => {
          console.error('[Storage] Force save transaction failed:', tx.error);
          reject(tx.error);
        };
      });
      

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
    return _settingsCache[key] || null; 
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
    
    const validHabits = habits.filter(h => {
      validateHabit(h);
      return true;
    });
    
    const myHabits = validHabits.map(h => {
      const migrated = migrateHabit(h);
      return {
        ...migrated,
        userId: _currentUserId || null,
        updatedAt: Date.now()
      };
    });
    
    _habitsCache = myHabits;

    try {
      const dbInstance = await db.open();
      
      await new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('habits', 'readwrite');
        const store = tx.objectStore('habits');
        
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {

          myHabits.forEach(habit => {
            store.put(habit);
          });
        };
        
        tx.oncomplete = () => {
          console.log('[Storage] Saved', myHabits.length, 'habits to IndexedDB');
          resolve();
        };
        
        tx.onerror = () => {
          console.error('[Storage] Transaction failed:', tx.error);
          reject(tx.error);
        };
      });
      

      localStorage.setItem('cultiva-habits', JSON.stringify(myHabits));
      console.log('[Storage] Backup saved to localStorage');
      
    } catch (e) {
      console.error('[Storage] IndexedDB save failed, using localStorage only:', e);

      localStorage.setItem('cultiva-habits', JSON.stringify(myHabits));
      _habitsCache = myHabits;
    }
  },

  async set(key, value) {
    validateSettings({ [key]: value });
    _settingsCache[key] = value;
    
    try {
      await db.put('settings', { key, value });
    } catch (e) {
      console.error('[Storage] Settings IDB write failed:', e);
    }
    localStorage.setItem('cultiva-settings', JSON.stringify(_settingsCache));
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