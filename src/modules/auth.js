import { db } from './db.js';

const SESSION_KEY = 'cultiva_current_session';
let _currentUser = null;

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 },
    keyMaterial, 256
  );
  
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export const auth = {
  init: async function() {
    if (_currentUser) { return; }
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
    if (!email || typeof email !== 'string') { throw new Error('Invalid email'); }
    if (password.length < 6) { throw new Error('Password must be at least 6 characters'); }
    
    const existing = await db.get('users', email);
    if (existing) { throw new Error('User already exists'); }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const user = {
      email,
      passwordHash,
      salt,
      name: name || email.split('@')[0],
      dob: dob || null,
      avatar: { background: 'green', emoji: '🌱', photo: null },
      habits: [],
      createdAt: new Date().toISOString()
    };

    await db.put('users', user);
    return this.login({ email, password });
  },

  login: async function({ email, password }) {
    const user = await db.get('users', email);
    if (!user) { throw new Error('User not found'); }

    const passwordHash = await hashPassword(password, user.salt);
    if (user.passwordHash !== passwordHash) { throw new Error('Incorrect password'); }

    const session = {
      key: SESSION_KEY,
      email: user.email,
      loginAt: new Date().toISOString(),
      device: navigator.userAgent.slice(0, 50)
    };

    await db.put('sessions', session);
    _currentUser = user;

    if (typeof storage !== 'undefined' && storage.setCurrentUser) {
      await storage.setCurrentUser(user.email);
    }

    return { success: true, user: this._sanitizeUser(user) };
  },

  logout: async function() {
    try {
      await db.clear('sessions');
    } catch (e) {
      console.warn('[Auth] Session cleanup failed:', e);
    }
    _currentUser = null;
    if (typeof storage !== 'undefined' && storage.setCurrentUser) {
      await storage.setCurrentUser(null);
    }
  },

  isAuthenticated: function() {
    return !!_currentUser;
  },

  getCurrentUser: function() {
    return _currentUser ? this._sanitizeUser(_currentUser) : null;
  },

  updateProfile: async function(updates) {
    if (!_currentUser) { throw new Error('Not authenticated'); }
    _currentUser = { ..._currentUser, ...updates };
    await db.put('users', _currentUser);

    if (updates.avatar && typeof storage !== 'undefined') {
      const currentSettings = (await storage.get('cultiva-settings')) || {};
      currentSettings.avatar = updates.avatar;
      await storage.set('cultiva-settings', currentSettings);
    }

    return this._sanitizeUser(_currentUser);
  },

  /**
   * Never expose passwordHash / salt to UI or IPC — only use full user in-memory for verification.
   */
  _sanitizeUser: function(user) {
    if (!user) { return null; }

    const { passwordHash: _passwordHash, salt: _salt, ...safeUser } = user;
    return safeUser;
  }
};