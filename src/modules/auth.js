import { db } from './db.js';
import { storage } from './storage.js';

const SESSION_KEY = 'cultiva_current_session';
let _currentUser = null;

function electronAuth() {
  if (typeof window === 'undefined') {
    return null;
  }
  const e = window.electron;
  if (e && typeof e.encryptAuthSecret === 'function' && typeof e.decryptAuthSecret === 'function') {
    return e;
  }
  return null;
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 },
    keyMaterial, 256
  );

  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readStoredCredentials(user) {
  if (user.credentialsEnc) {
    const el = electronAuth();
    if (!el) {
      throw new Error('Encrypted credentials require the Cultiva desktop app');
    }
    const res = await el.decryptAuthSecret(user.credentialsEnc);
    if (!res || !res.ok) {
      throw new Error(res.error || 'Failed to decrypt credentials');
    }
    return JSON.parse(res.data);
  }
  return { passwordHash: user.passwordHash, salt: user.salt };
}

async function migrateLegacyCredentialsToEncrypted(user) {
  if (!user || user.credentialsEnc || !user.passwordHash || !user.salt) {
    return;
  }
  const el = electronAuth();
  if (!el) {
    return;
  }
  const res = await el.encryptAuthSecret(JSON.stringify({ passwordHash: user.passwordHash, salt: user.salt }));
  if (!res || !res.ok) {
    return;
  }
  const updated = { ...user };
  delete updated.passwordHash;
  delete updated.salt;
  updated.credentialsEnc = res.data;
  await db.put('users', updated);
  _currentUser = updated;
}

export const auth = {
  init: async function() {
    if (_currentUser) {
      return;
    }
    try {
      const session = await db.get('sessions', SESSION_KEY);
      if (session && session.email) {
        _currentUser = await db.get('users', session.email);
      }
    } catch (e) {
      console.warn('[Auth] Session init failed:', e);
    }
  },

  register: async function({ email, password, name, dob }) {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const existing = await db.get('users', email);
    if (existing) {
      throw new Error('User already exists');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const base = {
      email,
      name: name || email.split('@')[0],
      dob: dob || null,
      avatar: { background: 'green', emoji: '🌱', photo: null },
      habits: [],
      createdAt: new Date().toISOString()
    };

    let user;
    const el = electronAuth();
    if (el) {
      const res = await el.encryptAuthSecret(JSON.stringify({ passwordHash, salt }));
      if (res && res.ok) {
        user = { ...base, credentialsEnc: res.data };
      }
    }
    if (!user) {
      user = { ...base, passwordHash, salt };
    }

    await db.put('users', user);
    return this.login({ email, password });
  },

  login: async function({ email, password }) {
    const user = await db.get('users', email);
    if (!user) {
      throw new Error('User not found');
    }

    const derived = await readStoredCredentials(user);
    if (!derived || typeof derived.salt !== 'string' || typeof derived.passwordHash !== 'string') {
      throw new Error('Invalid stored credentials');
    }

    const passwordHash = await hashPassword(password, derived.salt);
    if (derived.passwordHash !== passwordHash) {
      throw new Error('Incorrect password');
    }

    const session = {
      key: SESSION_KEY,
      email: user.email,
      loginAt: new Date().toISOString(),
      device: navigator.userAgent.slice(0, 50)
    };

    await db.put('sessions', session);
    _currentUser = user;

    await storage.setCurrentUser(user.email);

    await migrateLegacyCredentialsToEncrypted(user);

    return { success: true, user: this._sanitizeUser(_currentUser) };
  },

  logout: async function() {
    try {
      await db.clear('sessions');
    } catch (e) {
      console.warn('[Auth] Session cleanup failed:', e);
    }
    _currentUser = null;
    await storage.setCurrentUser(null);
  },

  isAuthenticated: function() {
    return !!_currentUser;
  },

  getCurrentUser: function() {
    return _currentUser ? this._sanitizeUser(_currentUser) : null;
  },

  updateProfile: async function(updates) {
    if (!_currentUser) {
      throw new Error('Not authenticated');
    }
    const safe = { ...updates };
    delete safe.passwordHash;
    delete safe.salt;
    delete safe.credentialsEnc;

    _currentUser = { ..._currentUser, ...safe };
    await db.put('users', _currentUser);

    if (updates.avatar) {
      const currentSettings = (await storage.get('cultiva-settings')) || {};
      currentSettings.avatar = updates.avatar;
      await storage.set('cultiva-settings', currentSettings);
    }

    return this._sanitizeUser(_currentUser);
  },

  /**
   * Never expose passwordHash / salt / credentialsEnc to UI — full user only in-memory for verification.
   */
  _sanitizeUser: function(user) {
    if (!user) {
      return null;
    }

    const { passwordHash: _ph, salt: _salt, credentialsEnc: _enc, ...safeUser } = user;
    return safeUser;
  }
};
