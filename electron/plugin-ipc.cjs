const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { app } = require('electron');

const PLUGIN_FILES_DIR = path.join(app.getPath('userData'), 'cultiva-plugins');

/** Hostnames allowed for plugin file downloads and redirects (HTTPS only). */
const PLUGIN_DOWNLOAD_HOSTS = new Set([
  'raw.githubusercontent.com',
  'github.com',
  'objects.githubusercontent.com'
]);

const MAX_REDIRECTS = 8;

const SAFE_PLUGIN_ID = /^[a-zA-Z0-9_-]{1,128}$/;

if (!fs.existsSync(PLUGIN_FILES_DIR)) {
  fs.mkdirSync(PLUGIN_FILES_DIR, { recursive: true });
}

function assertAllowedDownloadUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error('Invalid download URL');
  }
  if (u.protocol !== 'https:') {
    throw new Error('Only HTTPS plugin downloads are allowed');
  }
  if (!PLUGIN_DOWNLOAD_HOSTS.has(u.hostname)) {
    throw new Error(`Blocked plugin download host: ${u.hostname}`);
  }
}

/**
 * Ensures resolved path is inside rootDir (zip-slip / path traversal safe).
 * @param {string} rootDir
 * @param {string} resolvedPath from path.resolve(rootDir, ...)
 * @returns {boolean}
 */
function isPathInsideDir(rootDir, resolvedPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(resolvedPath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return resolved === root || resolved.startsWith(prefix);
}

function resolveUnderPluginRoot(relativePath) {
  const cleanPath = String(relativePath).replace(/^cultiva-plugins[\\/]/, '').replace(/^[/\\]+/, '');
  const resolved = path.resolve(PLUGIN_FILES_DIR, cleanPath);
  if (!isPathInsideDir(PLUGIN_FILES_DIR, resolved)) {
    console.error('[Plugin IPC] Path traversal attempt blocked:', relativePath);
    return null;
  }
  return resolved;
}

function sha256HexOfFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assertSafeRelativeFileName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid file name');
  }
  const norm = path.normalize(name);
  if (path.isAbsolute(norm)) {
    throw new Error(`Blocked absolute plugin file path: ${name}`);
  }
  for (const seg of norm.split(/[/\\]/)) {
    if (seg === '..') {
      throw new Error(`Blocked path in plugin file name: ${name}`);
    }
  }
}

function downloadFile(urlString, destPath) {
  assertAllowedDownloadUrl(urlString);

  return new Promise((resolve, reject) => {
    const run = (currentUrl, redirectCount) => {
      if (redirectCount > MAX_REDIRECTS) {
        reject(new Error('Too many redirects'));
        return;
      }

      assertAllowedDownloadUrl(currentUrl);

      https.get(currentUrl, (response) => {
        const status = response.statusCode || 0;
        if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
          response.resume();
          const loc = response.headers.location;
          if (!loc) {
            reject(new Error('Redirect without Location header'));
            return;
          }
          let nextUrl;
          try {
            nextUrl = new URL(loc, currentUrl).href;
          } catch {
            reject(new Error('Invalid redirect URL'));
            return;
          }
          try {
            assertAllowedDownloadUrl(nextUrl);
          } catch (e) {
            reject(e);
            return;
          }
          run(nextUrl, redirectCount + 1);
          return;
        }

        if (status !== 200) {
          response.resume();
          reject(new Error(`Download failed: HTTP ${status}`));
          return;
        }

        const file = fs.createWriteStream(destPath);
        response.pipe(file);
        response.on('error', (err) => {
          file.destroy();
          fs.unlink(destPath, () => reject(err));
        });
        file.on('finish', () => {
          file.close(resolve);
        });
        file.on('error', (err) => {
          file.close(() => fs.unlink(destPath, () => reject(err)));
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    };

    run(urlString, 0);
  });
}

function setupPluginIPC() {
  ipcMain.handle('plugin:read-file', async (event, filePath) => {
    try {
      const fullPath = resolveUnderPluginRoot(filePath);
      if (!fullPath) {
        return null;
      }

      console.log('[Plugin IPC] Reading file:', fullPath);

      if (!fs.existsSync(fullPath)) {
        console.error('[Plugin IPC] File not found:', fullPath);
        return null;
      }

      return fs.readFileSync(fullPath, 'utf-8');
    } catch (e) {
      console.error('[Plugin IPC] Failed to read file:', filePath, e);
      return null;
    }
  });

  ipcMain.handle('plugin:install', async (event, pluginId, files) => {
    try {
      if (!SAFE_PLUGIN_ID.test(pluginId)) {
        throw new Error('Invalid plugin id');
      }

      const pluginDir = path.join(PLUGIN_FILES_DIR, pluginId);
      const pluginRootResolved = path.resolve(pluginDir);

      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
      fs.mkdirSync(pluginDir, { recursive: true });

      console.log('[Plugin IPC] Installing plugin to:', pluginDir);

      for (const file of files) {
        assertSafeRelativeFileName(file.name);
        const destPath = path.resolve(pluginDir, file.name);
        if (!isPathInsideDir(pluginRootResolved, destPath)) {
          throw new Error(`Blocked destination path for plugin file: ${file.name}`);
        }
        console.log('[Plugin IPC] Downloading:', file.url);
        await downloadFile(file.url, destPath);
        if (file.sha256 && typeof file.sha256 === 'string') {
          const expected = file.sha256.trim().toLowerCase();
          const actual = sha256HexOfFile(destPath);
          if (actual !== expected) {
            throw new Error(`Integrity check failed for ${file.name}`);
          }
        }
      }

      const manifestPath = path.join(pluginDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Invalid plugin: manifest.json not found');
      }

      console.log('[Plugin IPC] Plugin installed successfully:', pluginId);
      return true;
    } catch (e) {
      console.error('[Plugin IPC] Installation failed:', e);
      throw e;
    }
  });

  ipcMain.handle('plugin:uninstall', async (event, pluginId) => {
    try {
      if (!SAFE_PLUGIN_ID.test(pluginId)) {
        return false;
      }
      const pluginDir = path.join(PLUGIN_FILES_DIR, pluginId);
      if (!isPathInsideDir(PLUGIN_FILES_DIR, path.resolve(pluginDir))) {
        return false;
      }
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
      return true;
    } catch (e) {
      console.error('[Plugin IPC] Failed to uninstall:', e);
      return false;
    }
  });

  ipcMain.handle('plugin:get-resource-path', async (event, pluginId, resourcePath) => {
    if (!SAFE_PLUGIN_ID.test(pluginId)) {
      return null;
    }
    const cleanResource = String(resourcePath || '').replace(/^[/\\]+/, '');
    if (!cleanResource) {
      return null;
    }
    assertSafeRelativeFileName(cleanResource);
    const pluginDir = path.join(PLUGIN_FILES_DIR, pluginId);
    const resolved = path.resolve(pluginDir, cleanResource);
    if (!isPathInsideDir(path.resolve(pluginDir), resolved)) {
      console.error('[Plugin IPC] get-resource-path traversal blocked:', pluginId, resourcePath);
      return null;
    }
    return resolved;
  });
}

module.exports = { setupPluginIPC };
