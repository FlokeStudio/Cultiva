const path = require('path');
const fs = require('fs');

/**
 * Apply CSP on the default session so file:// and all windows (including plugin sandbox) get one policy.
 * Strips any existing Content-Security-Policy headers to avoid merging with a stricter duplicate.
 */
function attachSessionContentSecurityPolicy({ isDev, session }) {
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

function resolveAppIconPath() {
  const packaged = path.join(__dirname, '../app-icon.ico');
  if (fs.existsSync(packaged)) {
    return packaged;
  }
  const distIco = path.join(__dirname, '../../dist/favicon.ico');
  if (fs.existsSync(distIco)) {
    return distIco;
  }
  return undefined;
}

function createMainWindow({
  shell,
  BrowserWindow,
  pkg,
  isDev,
  setMainWindow,
  discord,
  setupAutoUpdater
}) {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: `${pkg.productName || pkg.name} v${pkg.version}`,
    minWidth: 360,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webviewTag: false,
      sandbox: true
    },
    icon: resolveAppIconPath(),
    backgroundColor: '#1c1c1e',
    show: false
  });

  setMainWindow(mainWindow);

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

        const distPath = path.join(__dirname, '../../dist');
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
    discord.onMainWindowNavigation(url);
  });

  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('[Electron] In-page navigation:', url);
    discord.onMainWindowNavigation(url);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    console.log('[Electron] Loading:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    discord.onMainWindowReadyShow();
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
    discord.onMainWindowClosed();
    setMainWindow(null);
  });

  return mainWindow;
}

module.exports = {
  attachSessionContentSecurityPolicy,
  resolveAppIconPath,
  createMainWindow
};
