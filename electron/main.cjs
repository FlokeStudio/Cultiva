const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, Notification, session } = require('electron');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');
const isDev = process.env.NODE_ENV === 'development';
const { Client } = require('discord-rpc');
const { autoUpdater } = require('electron-updater');
const { setupPluginIPC } = require('./plugin-ipc.cjs');

const DISCORD_CLIENT_ID = '1492849856832606329';
let rpc = null;
let rpcReady = false;
let discordEnabled = true;
let mainWindow = null;
let currentLocale = 'en';
let currentPage = 'garden';

/* ============================================ */
/* DISCORD RICH PRESENCE                        */
/* ============================================ */

const DISCORD_STRINGS = {
  en: {
    garden: { details: 'In the garden', state: 'Growing habits' },
    calendar: { details: 'Planning habits', state: 'Browsing calendar' },
    stats: { details: 'Reviewing progress', state: 'Checking statistics' },
    settings: { details: 'Customizing', state: 'Adjusting settings' },
    trophy: { details: 'Trophy Garden', state: 'Admiring legacy trees' },
    focus: { details: 'Focus Mode', state: 'Deep work session' },
    pages: { details: 'Exploring Cultiva', state: 'Reading documentation' }
  },
  ru: {
    garden: { details: 'В саду', state: 'Выращивает привычки' },
    calendar: { details: 'Планирует', state: 'Смотрит календарь' },
    stats: { details: 'Анализирует', state: 'Проверяет статистику' },
    settings: { details: 'Настраивает', state: 'Меняет параметры' },
    trophy: { details: 'Сад трофеев', state: 'Любуется деревьями' },
    focus: { details: 'Режим фокуса', state: 'Глубокая работа' },
    pages: { details: 'Изучает Cultiva', state: 'Читает документацию' }
  }
};

function initDiscordRPC() {
  if (rpc) { return; }
  
  rpc = new Client({ transport: 'ipc' });
  
  rpc.on('ready', () => {
    console.log('[Discord] Rich Presence connected');
    rpcReady = true;
    if (discordEnabled) {
      updateDiscordActivity();
    }
    
    setInterval(() => {
      if (rpcReady && discordEnabled) {
        updateDiscordActivity();
      }
    }, 15000);
  });
  
  rpc.on('disconnected', () => {
    console.log('[Discord] Rich Presence disconnected');
    rpcReady = false;
  });
  
  rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(err => {
    console.warn('[Discord] Failed to connect:', err.message);
    rpc = null;
  });
}

function updateDiscordActivity(activityData = {}) {
  if (!rpcReady || !rpc || !discordEnabled) { return; }
  
  const locale = activityData.locale || currentLocale;
  const strings = DISCORD_STRINGS[locale] || DISCORD_STRINGS.en;
  const page = activityData.page || currentPage;
  const pageStrings = strings[page] || strings.garden;
  
  const activity = {
    details: activityData.details || pageStrings.details,
    state: activityData.state || pageStrings.state,
    startTimestamp: activityData.startTimestamp || new Date(),
    largeImageKey: activityData.largeImageKey || 'garden',
    largeImageText: activityData.largeImageText || 'Cultiva',
    smallImageKey: activityData.smallImageKey,
    smallImageText: activityData.smallImageText,
    partySize: activityData.partySize,
    partyMax: activityData.partyMax,
  };
  
  rpc.setActivity(activity).catch(err => {
    console.warn('[Discord] Failed to update activity:', err.message);
  });
}

function clearDiscordActivity() {
  if (!rpcReady || !rpc) { return; }
  
  rpc.clearActivity().catch(err => {
    console.warn('[Discord] Failed to clear activity:', err.message);
  });
}

function shutdownDiscordRPC() {
  if (rpc) {
    if (rpcReady) {
      clearDiscordActivity();
    }
    setTimeout(() => {
      rpc.destroy().catch(() => {});
      rpc = null;
      rpcReady = false;
    }, 500);
  }
}

function detectPageFromUrl(url) {
  if (url.includes('/calendar')) { return 'calendar'; }
  if (url.includes('/pages/')) { return 'pages'; }
  if (url.includes('settings') || url.includes('settings-modal')) { return 'settings'; }
  if (url.includes('stats')) { return 'stats'; }
  if (url.includes('trophy')) { return 'trophy'; }
  if (url.includes('focus')) { return 'focus'; }
  return 'garden';
}

/* ============================================ */
/* AUTO UPDATER                                 */
/* ============================================ */

function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[Updater] Skipped (development / unpackaged)');
    return;
  }
  if (process.env.DISABLE_AUTO_UPDATER === '1') {
    console.log('[Updater] Skipped (DISABLE_AUTO_UPDATER=1)');
    return;
  }

  autoUpdater.logger = console;

  if (autoUpdater.logger && autoUpdater.logger.transports && autoUpdater.logger.transports.file) {
    autoUpdater.logger.transports.file.level = 'info';
  }

  /**
   * Use GitHub "latest release" asset URL so we do not depend on per-version tags like …/download/0.3.5/latest.yml.
   * Publish Windows builds with electron-builder (uploads latest.yml next to the installer on that release).
   */
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://github.com/krwg/Cultiva/releases/latest/download/'
  });
  autoUpdater.allowPrerelease = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', 'Checking for updates...');
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', `Update ${info.version} found. Downloading...`);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No update available');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', 'You are using the latest version.');
    }
  });

  autoUpdater.on('error', (err) => {
    const msg = err && err.message ? err.message : String(err);
    const isMissingFeed = /404/.test(msg) && (/latest\.yml|RELEASES|blockmap/i.test(msg) || /Not Found/i.test(msg));
    if (isMissingFeed) {
      console.warn('[Updater] No update metadata on GitHub latest release (publish a Windows build with electron-builder to attach latest.yml).');
      return;
    }
    console.error('[Updater] Error:', msg);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', `Update error: ${msg}`);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('[Updater] Download progress:', progressObj.percent, '%');
    if (mainWindow && mainWindow.webContents) {
      const logMessage = `Downloaded ${progressObj.percent}%`;
      mainWindow.webContents.send('update-message', logMessage);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', 'Update downloaded. It will be installed on restart.');
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} is downloaded. Restart now to install?`,
      buttons: ['Restart', 'Later']
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((e) => {
      console.warn('[Updater] checkForUpdatesAndNotify:', e && e.message ? e.message : e);
    });
  }, 4000);
}

/* ============================================ */
/* WINDOW CREATION                              */
/* ============================================ */

function resolveAppIconPath() {
  const packaged = path.join(__dirname, 'app-icon.ico');
  if (fs.existsSync(packaged)) {
    return packaged;
  }
  const distIco = path.join(__dirname, '../dist/favicon.ico');
  if (fs.existsSync(distIco)) {
    return distIco;
  }
  return undefined;
}

/**
 * Apply CSP on the default session so file:// and all windows (including plugin sandbox) get one policy.
 * Strips any existing Content-Security-Policy headers to avoid merging with a stricter duplicate.
 */
function attachSessionContentSecurityPolicy() {
  if (attachSessionContentSecurityPolicy._done) {
    return;
  }
  attachSessionContentSecurityPolicy._done = true;

  const cspProduction =
    "default-src 'self' file: data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: blob: data:; " +
    "img-src 'self' data: blob: file: https:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self' file: data: blob: https: https://raw.githubusercontent.com https://api.github.com https://github.com https://objects.githubusercontent.com https://api.open-meteo.com https://geocoding-api.open-meteo.com; " +
    "font-src 'self' data:;";

  const cspDev =
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: http: https: ws: wss:; " +
    "img-src 'self' data: blob: file: https: http:; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: blob: data: http: https:; " +
    "connect-src 'self' https: http: ws: wss: https://raw.githubusercontent.com https://api.github.com https://github.com https://objects.githubusercontent.com https://api.open-meteo.com https://geocoding-api.open-meteo.com; " +
    "font-src 'self' data:;";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const useDevCsp = isDev && Boolean(process.env.VITE_DEV_SERVER_URL);
    const policy = useDevCsp ? cspDev : cspProduction;
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      const lower = key.toLowerCase();
      if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
        delete responseHeaders[key];
      }
    }
    responseHeaders['Content-Security-Policy'] = [policy];
    callback({ responseHeaders });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: `${pkg.productName || pkg.name} v${pkg.version}`,
    minWidth: 360,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: false,
      sandbox: true
    },
    icon: resolveAppIconPath(),
    backgroundColor: '#1c1c1e',
    show: false
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
        return;
      }
      
      if (parsedUrl.protocol === 'file:') {
        const requestedPath = decodeURIComponent(parsedUrl.pathname);
        
        if (fs.existsSync(requestedPath)) {
          return;
        }
        
        const distPath = path.join(__dirname, '../dist');
        const relativePath = requestedPath.replace(/^.*[\\/]dist[\\/]?/, '');
        const alternativePath = path.join(distPath, relativePath);
        
        if (fs.existsSync(alternativePath)) {
          event.preventDefault();
          mainWindow.loadFile(alternativePath);
          return;
        }
        
        console.warn('[Electron] File not found:', requestedPath);
      }
    } catch (error) {
      console.error('[Electron] Navigation error:', error);
    }
  });

  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[Electron] Navigated to:', url);
    currentPage = detectPageFromUrl(url);
    
    if (discordEnabled) {
      updateDiscordActivity({ page: currentPage });
    }
  });

  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('[Electron] In-page navigation:', url);
    currentPage = detectPageFromUrl(url);
    
    if (discordEnabled) {
      updateDiscordActivity({ page: currentPage });
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('[Electron] Loading:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (discordEnabled) {
      updateDiscordActivity({ page: 'garden' });
    }
    
    setupAutoUpdater();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL) => {
    console.error('[Electron] Failed to load:', errorCode, errorDesc);
    console.error('[Electron] URL:', validatedURL);
    
    if (!isDev) {
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = \`
          <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#ff3b30;">
            <div style="text-align:center;">
              <h2>Failed to load page</h2>
              <p>Error: \${errorDesc}</p>
              <button onclick="location.reload()" style="padding:10px 20px;margin-top:20px;cursor:pointer;">Reload</button>
            </div>
          </div>
        \`;
      `);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Electron] Render process gone:', details);
  });

  mainWindow.on('closed', () => {
    if (discordEnabled) {
      clearDiscordActivity();
    }
    mainWindow = null;
  });
}

/* ============================================ */
/* IPC HANDLERS                                 */
/* ============================================ */

ipcMain.on('check-for-updates', () => {
  if (!app.isPackaged) {
    console.log('[Updater] Manual check ignored (unpackaged)');
    return;
  }
  console.log('[Updater] Manual check triggered');
  autoUpdater.checkForUpdatesAndNotify().catch((e) => {
    console.warn('[Updater] Manual check failed:', e && e.message ? e.message : e);
  });
});

ipcMain.on('restart-app', () => {
  if (app.isPackaged) {
    try {
      autoUpdater.quitAndInstall();
    } catch (e) {
      console.warn('[Updater] quitAndInstall:', e);
      app.relaunch();
      app.exit(0);
    }
  } else {
    app.relaunch();
    app.exit(0);
  }
});

ipcMain.handle('save-file', async (event, data, fileName) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save backup',
    defaultPath: fileName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (filePath) {
    const { writeFile } = require('fs/promises');
    await writeFile(filePath, data);
    return { success: true, path: filePath };
  }
  return { success: false };
});

ipcMain.handle('navigate-to', (event, page) => {
  if (!mainWindow) { return { success: false }; }
  
  const pagePath = path.join(__dirname, '../dist', page);
  console.log('[Electron] Navigating to:', pagePath);
  
  if (fs.existsSync(pagePath)) {
    mainWindow.loadFile(pagePath);
    return { success: true };
  }
  
  console.error('[Electron] Page not found:', pagePath);
  return { success: false, error: 'Page not found' };
});

ipcMain.on('open-calendar-window', () => {
  const calendarWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: resolveAppIconPath(),
  });
  
  const calendarPath = path.join(__dirname, '../dist/pages/calendar/index.html');
  if (fs.existsSync(calendarPath)) {
    calendarWindow.loadFile(calendarPath);
  } else {
    console.error('[Electron] Calendar page not found:', calendarPath);
    calendarWindow.close();
  }
});

ipcMain.handle('get-app-path', () => {
  return {
    dist: path.join(__dirname, '../dist'),
    userData: app.getPath('userData'),
  };
});

ipcMain.handle('discord:update-activity', (event, activityData) => {
  if (activityData.locale) {
    currentLocale = activityData.locale;
  }
  if (activityData.page) {
    currentPage = activityData.page;
  }
  
  if (rpcReady && discordEnabled) {
    updateDiscordActivity(activityData);
    return { success: true };
  }
  return { success: false, error: 'Discord RPC not ready or disabled' };
});

ipcMain.handle('discord:status', () => {
  return { 
    connected: rpcReady, 
    enabled: discordEnabled 
  };
});

ipcMain.handle('discord:enable', () => {
  discordEnabled = true;
  if (rpcReady) {
    updateDiscordActivity({ page: currentPage, locale: currentLocale });
  }
  return { success: true };
});

ipcMain.handle('discord:disable', () => {
  discordEnabled = false;
  if (rpcReady) {
    clearDiscordActivity();
  }
  return { success: true };
});

ipcMain.handle('discord:set-locale', (event, locale) => {
  currentLocale = locale || 'en';
  if (rpcReady && discordEnabled) {
    updateDiscordActivity({ locale: currentLocale });
  }
  return { success: true };
});

ipcMain.handle('auth:encrypt-secret', (event, plainText) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: 'OS encryption is not available for safeStorage' };
    }
    const buf = safeStorage.encryptString(String(plainText));
    return { ok: true, data: Buffer.from(buf).toString('base64') };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('native-notification:show', (event, payload) => {
  try {
    if (!Notification.isSupported()) {
      return { ok: false, error: 'Notifications not supported' };
    }
    const title = String((payload && payload.title) || 'Cultiva').slice(0, 256);
    const body = String((payload && payload.body) || '').slice(0, 2000);
    const silent = Boolean(payload && payload.silent);
    const iconPath = resolveAppIconPath();
    const n = new Notification({
      title,
      body,
      silent,
      icon: iconPath
    });
    n.show();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

ipcMain.handle('auth:decrypt-secret', (event, b64) => {
  try {
    const buf = Buffer.from(String(b64), 'base64');
    const data = safeStorage.decryptString(buf);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
});

/* ============================================ */
/* APP LIFECYCLE                                */
/* ============================================ */

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(pkg.build && pkg.build.appId ? pkg.build.appId : 'com.cultiva.app');
  }
  attachSessionContentSecurityPolicy();
  initDiscordRPC();
  setupPluginIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  shutdownDiscordRPC();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  clearDiscordActivity();
  shutdownDiscordRPC();
});