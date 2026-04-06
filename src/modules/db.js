const DB_NAME = 'cultiva_v2_db';
const DB_VERSION = 5;

export const db = {
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject(e.target.error);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        const stores = ['habits', 'settings', 'users', 'sessions'];
        stores.forEach(name => {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        });

        const habitsStore = db.createObjectStore('habits', { keyPath: 'id' });
        habitsStore.createIndex('userId', 'userId', { unique: false });
        habitsStore.createIndex('updatedAt', 'updatedAt', { unique: false });

        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('users', { keyPath: 'email' });
        db.createObjectStore('sessions', { keyPath: 'key' });
      };
      
      request.onsuccess = (e) => resolve(e.target.result);
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
    if (!key) return null;
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

      if (value == null) {
        index.getAll().onsuccess = (e) => {
          const all = e.target.result || [];
          resolve(all.filter(item => item[indexName] == null));
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
    if (value == null) return Promise.resolve();
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      if (!store.indexNames.contains(indexName)) { reject(new Error('Index not found')); return; }
      
      const cursorReq = store.index(indexName).openCursor(IDBKeyRange.only(value));
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
        else resolve();
      };
      cursorReq.onerror = (e) => reject(e.target.error);
    });
  }
};