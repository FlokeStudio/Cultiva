const { writeFile } = require('fs/promises');

function registerCoreIpc(ipcMain, {
  getMainWindow,
  app,
  path,
  fs,
  dialog,
  safeStorage,
  Notification,
  resolveAppIconPath
}) {
  ipcMain.handle('save-file', async (event, data, fileName) => {
    const mainWindow = getMainWindow();
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save backup',
      defaultPath: fileName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePath) {
      await writeFile(filePath, data);
      return { success: true, path: filePath };
    }
    return { success: false };
  });

  ipcMain.handle('navigate-to', (event, page) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return { success: false };
    }

    const pagePath = path.join(__dirname, '../../dist', page);
    console.log('[Electron] Navigating to:', pagePath);

    if (fs.existsSync(pagePath)) {
      mainWindow.loadFile(pagePath);
      return { success: true };
    }

    console.error('[Electron] Page not found:', pagePath);
    return { success: false, error: 'Page not found' };
  });

  ipcMain.on('open-calendar-window', () => {
    const { BrowserWindow } = require('electron');
    const mainWindow = getMainWindow();
    const calendarWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      parent: mainWindow,
      modal: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      },
      icon: resolveAppIconPath()
    });

    const calendarPath = path.join(__dirname, '../../dist/pages/calendar/index.html');
    if (fs.existsSync(calendarPath)) {
      calendarWindow.loadFile(calendarPath);
    } else {
      console.error('[Electron] Calendar page not found:', calendarPath);
      calendarWindow.close();
    }
  });

  ipcMain.handle('get-app-path', () => {
    return {
      dist: path.join(__dirname, '../../dist'),
      userData: app.getPath('userData')
    };
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
}

module.exports = {
  registerCoreIpc
};
