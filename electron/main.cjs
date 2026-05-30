const { app, BrowserWindow, ipcMain, shell, session, dialog, safeStorage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');
const isDev = process.env.NODE_ENV === 'development';
const { setupPluginIPC } = require('./plugin-ipc.cjs');
const discord = require('./lib/discord-rpc.cjs');
const { setupAutoUpdater, registerUpdaterIpc } = require('./lib/auto-updater.cjs');
const mainWindowMod = require('./lib/main-window.cjs');
const { registerCoreIpc } = require('./lib/ipc-main-handlers.cjs');
const { registerBackupIpc } = require('./lib/backup.cjs');

let mainWindow = null;
const getMainWindow = () => mainWindow;
const setMainWindow = (w) => {
  mainWindow = w;
};

function openMainWindow() {
  return mainWindowMod.createMainWindow({
    shell,
    BrowserWindow,
    pkg,
    isDev,
    setMainWindow,
    discord,
    setupAutoUpdater: () => setupAutoUpdater(getMainWindow)
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(pkg.build && pkg.build.appId ? pkg.build.appId : 'com.cultiva.app');
  }
  mainWindowMod.attachSessionContentSecurityPolicy({ isDev, session });
  discord.initDiscordRPC();
  setupPluginIPC();
  openMainWindow();
  discord.registerDiscordIpc(ipcMain);
  registerUpdaterIpc(ipcMain);
  registerCoreIpc(ipcMain, {
    getMainWindow,
    app,
    path,
    fs,
    dialog,
    safeStorage,
    Notification,
    resolveAppIconPath: mainWindowMod.resolveAppIconPath
  });
  registerBackupIpc(ipcMain, { getMainWindow, dialog });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  discord.shutdownDiscordRPC();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  discord.clearDiscordActivity();
  discord.shutdownDiscordRPC();
});
