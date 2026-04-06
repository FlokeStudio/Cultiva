import { db } from './db.js';

const MIGRATION_FLAG = 'cultiva_migrated_to_idb_v1';
const SESSION_KEY = 'cultiva_current_session';

let _habitsCache = [];
let _settingsCache = {};
let _isInitialized = false;
let _currentUserId = null;

function validateHabit(habit) {
  if (!habit || typeof habit !== 'object') {
    throw new Error('Invalid habit: must be an object');
  }
  if (!habit.id || typeof habit.id !== 'string') {
    throw new Error('Invalid habit: id must be a non-empty string');
  }
  if (!habit.name || typeof habit.name !== 'string' || habit.name.length > 100) {
    throw new Error('Invalid habit: name must be a string (1-100 chars)');
  }
  if (habit.progress !== undefined && (typeof habit.progress !== 'number' || habit.progress < 0)) {
    throw new Error('Invalid habit: progress must be a non-negative number');
  }
  return true;
}

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Invalid settings: must be an object');
  }
  return true;
}

export const storage = {
  async init() {
    if (_isInitialized) return;

    if (!localStorage.getItem(MIGRATION_FLAG)) {
      console.log('[Storage] Migrating localStorage -> IndexedDB...');
      try {
        const habitsJson = localStorage.getItem('cultiva-habits');
        if (habitsJson) {
          const habits = JSON.parse(habitsJson);
          for (const h of habits) {
            validateHabit(h); 
            await db.put('habits', h);
          }
          localStorage.removeItem('cultiva-habits');
        }
        const settingsJson = localStorage.getItem('cultiva-settings');
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          validateSettings(settings);
          await db.put('settings', { key: 'cultiva-settings', value: settings });
          localStorage.removeItem('cultiva-settings');
        }
        localStorage.setItem(MIGRATION_FLAG, 'true');
        console.log('[Storage] Migration complete');
      } catch (e) {
        console.error('[Storage] Migration failed:', e);
      }
    }

    try {
        const session = await db.get('sessions', SESSION_KEY);
        if (session) {
            _currentUserId = session.email;
            console.log('[Storage] Restored session for:', _currentUserId);
        }
    } catch (e) {
        console.error('[Storage] Session check failed:', e);
    }

    await this._loadFromDB();
    _isInitialized = true;
    console.log('[Storage] System ready');
  },

  async _loadFromDB() {
    try {
      const userId = _currentUserId || null;
      
      const userHabits = await db.getByIndex('habits', 'userId', userId);
      const settingsRecord = await db.get('settings', 'cultiva-settings');
      
      _settingsCache = settingsRecord ? settingsRecord.value : {};
      _habitsCache = userHabits || [];
    } catch (e) {
      console.error('[Storage] Failed to load from IndexedDB:', e);

      const h = localStorage.getItem('cultiva-habits');
      if (h) _habitsCache = JSON.parse(h);
      const s = localStorage.getItem('cultiva-settings');
      if (s) _settingsCache = JSON.parse(s);
    }
  },

  getHabits() { return _habitsCache; },
  get(key) { return _settingsCache[key] || null; },
  getCurrentUserId() { return _currentUserId; },

  async setCurrentUser(userId) {
    _currentUserId = userId;
    await this._loadFromDB();
  },

  async saveHabits(habits) {

    for (const h of habits) {
      validateHabit(h);
    }

    const myHabits = habits.map(h => ({ 
      ...h, 
      userId: _currentUserId || null, 
      updatedAt: Date.now() 
    }));
    
    _habitsCache = myHabits;

    try {
      const dbInstance = await db.open();
      
      await new Promise((resolve, reject) => {
        const tx = dbInstance.transaction('habits', 'readwrite');
        const store = tx.objectStore('habits');
        
        if (_currentUserId && store.indexNames.contains('userId')) {
          const index = store.index('userId');
          const cursorRequest = index.openCursor(IDBKeyRange.only(_currentUserId));
          
          cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
        }
        
        myHabits.forEach(habit => store.put(habit));
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      
      localStorage.setItem('cultiva-habits', JSON.stringify(myHabits));
      
    } catch (e) {
      console.error('[Storage] Transaction failed, falling back to localStorage:', e);
      localStorage.setItem('cultiva-habits', JSON.stringify(myHabits));
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
  }
};