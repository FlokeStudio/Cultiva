const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  encryptAuthSecret: (plainText) => ipcRenderer.invoke('auth:encrypt-secret', plainText),
  decryptAuthSecret: (b64) => ipcRenderer.invoke('auth:decrypt-secret', b64),
  navigateTo: (page) => ipcRenderer.invoke('navigate-to', page),
  openCalendarWindow: () => ipcRenderer.send('open-calendar-window'),
  onUpdateMessage: (callback) => ipcRenderer.on('update-message', (_event, message) => callback(message)),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartApp: () => ipcRenderer.send('restart-app'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  saveFile: (data, fileName) => ipcRenderer.invoke('save-file', data, fileName),
  isElectron: true,
  readPluginFile: (filePath) => ipcRenderer.invoke('plugin:read-file', filePath),
  /** @param {{ title?: string, body?: string, silent?: boolean }} payload */
  showNativeNotification: (payload) => ipcRenderer.invoke('native-notification:show', payload),
  /** Main-process HTTPS GET (allowed GitHub/raw hosts). Use for registry/manifest when renderer fetch is blocked. */
  pluginHttpGet: (url) => ipcRenderer.invoke('plugin:http-get', url),
  installPlugin: (pluginId, files) => ipcRenderer.invoke('plugin:install', pluginId, files),
  uninstallPlugin: (pluginId) => ipcRenderer.invoke('plugin:uninstall', pluginId),
  getPluginResourcePath: (pluginId, resourcePath) => ipcRenderer.invoke('plugin:get-resource-path', pluginId, resourcePath),
});

let discordEnabled = true;

contextBridge.exposeInMainWorld('discord', {
  updateActivity: (data) => {
    if (!discordEnabled) {return;}
    ipcRenderer.invoke('discord:update-activity', data);
  },
  getStatus: () => ipcRenderer.invoke('discord:status'),
  enable: () => {
    discordEnabled = true;
    return ipcRenderer.invoke('discord:enable');
  },
  disable: () => {
    discordEnabled = false;
    return ipcRenderer.invoke('discord:disable');
  }
});