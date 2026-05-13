const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

function setupAutoUpdater(getMainWindow) {
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

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://github.com/krwg/Cultiva/releases/latest/download/'
  });
  autoUpdater.allowPrerelease = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    const mainWindow = getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', 'Checking for updates...');
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    const mainWindow = getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', `Update ${info.version} found. Downloading...`);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No update available');
    const mainWindow = getMainWindow();
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
    const mainWindow = getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-message', `Update error: ${msg}`);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log('[Updater] Download progress:', progressObj.percent, '%');
    const mainWindow = getMainWindow();
    if (mainWindow && mainWindow.webContents) {
      const logMessage = `Downloaded ${progressObj.percent}%`;
      mainWindow.webContents.send('update-message', logMessage);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    const mainWindow = getMainWindow();
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

function registerUpdaterIpc(ipcMain) {
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
}

module.exports = {
  setupAutoUpdater,
  registerUpdaterIpc
};
