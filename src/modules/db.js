const DB_NAME = 'cultiva_v2_db';
const DB_VERSION = 5;

export const db = {
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject(e.target.error);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        const oldVersion = e.oldVersion || 0;

        if (!db.objectStoreNames.contains('habits')) {
          const store = db.createObjectStore('habits', { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        } else if (oldVersion < 5) {
          const tx = db.transaction('habits', 'readwrite');
          const habitsStore = tx.objectStore('habits');
          if (!habitsStore.indexNames.contains('userId')) { habitsStore.createIndex('userId', 'userId', { unique: false }); }
          if (!habitsStore.indexNames.contains('updatedAt')) { habitsStore.createIndex('updatedAt', 'updatedAt', { unique: false }); }
        }

        if (!db.objectStoreNames.contains('settings')) { db.createObjectStore('settings', { keyPath: 'key' }); }
        if (!db.objectStoreNames.contains('users')) { db.createObjectStore('users', { keyPath: 'email' }); }
        if (!db.objectStoreNames.contains('sessions')) { db.createObjectStore('sessions', { keyPath: 'key' }); }

        console.log(`[DB] Upgraded from v${oldVersion} to v${DB_VERSION} safely`);
      };
      
      request.onsuccess = (e) => resolve(e.target.result);
    });
  },

  async delete(storeName, key) {
    if (key === undefined || key === null) {
      return Promise.resolve();
    }
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async put(storeName, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(data);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async get(storeName, key) {
    if (!key) { return null; }
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      if (!store.indexNames.contains(indexName)) {
        store.getAll().onsuccess = (e) => resolve(e.target.result || []);
        return;
      }

      const index = store.index(indexName);

      if (value === null || value === undefined) {
        index.getAll().onsuccess = (e) => {
          const all = e.target.result || [];
          resolve(all.filter(item => item[indexName] === null || item[indexName] === undefined));
        };
        return;
      }

      const request = index.getAll(IDBKeyRange.only(value));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async deleteByIndex(storeName, indexName, value) {
    if (value === null || value === undefined) { return Promise.resolve(); }
    
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      if (!store.indexNames.contains(indexName)) { 
        reject(new Error('Index not found')); 
        return; 
      }
      
      const cursorReq = store.index(indexName).openCursor(IDBKeyRange.only(value));
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { 
          cursor.delete(); 
          cursor.continue(); 
        } else { 
          resolve(); 
        }
      };
      cursorReq.onerror = (e) => reject(e.target.error);
    });
  }
};