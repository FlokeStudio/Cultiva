import { storage } from '../modules/storage.js';
import { BRANDING } from './branding.js';
import { PluginSandboxHost } from './plugin-sandbox-host.js';

/** Public plugin store; install copies files into userData/cultiva-plugins via Electron (never from a local repo plugins/ path). */
const REGISTRY_URL = 'https://raw.githubusercontent.com/krwg/CultivaPlugins/main/registry.json';

function stripUtf8Bom(s) {
  return String(s ?? '').replace(/^\uFEFF/, '');
}

/**
 * Small HTTPS GET as UTF-8 text. In Electron the main process performs the request (avoids renderer CSP blocking `fetch` to GitHub in packaged builds).
 * Falls back to `fetch` if IPC fails (e.g. old preload without pluginHttpGet).
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchPluginHttpText(url) {
  const w = typeof window !== 'undefined' ? window : null;
  let text = '';
  let ipcError = null;

  if (w?.electron?.pluginHttpGet) {
    try {
      const r = await w.electron.pluginHttpGet(url);
      if (r && r.ok && typeof r.body === 'string') {
        text = stripUtf8Bom(r.body);
      } else {
        ipcError = new Error(r?.error || 'pluginHttpGet failed');
      }
    } catch (e) {
      ipcError = e;
    }
  }

  if (!text) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      text = stripUtf8Bom(await res.text());
    } catch (e) {
      throw ipcError || e;
    }
  }

  return text.trimStart();
}

async function getInstalledPluginIdsNormalized() {
  let raw = await storage.get('cultiva-installed-plugins');
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

const plugins = new Map();

/** Set when loadPlugin returns false so installPlugin can show a specific reason. */
let _lastPluginLoadFailure = null;
function notePluginLoadFailure(message) {
  _lastPluginLoadFailure = message ? String(message) : null;
}
function takePluginLoadFailure() {
  const m = _lastPluginLoadFailure;
  _lastPluginLoadFailure = null;
  return m;
}

/** @type {Record<string, string[]>} hookName -> pluginIds that subscribed (deduped) */
const pluginHooks = {
  onHabitComplete: [],
  onAppStart: [],
  onSettingsChange: [],
  renderHeaderItem: [],
  renderGardenWidget: []
};

let _initPromise = null;
let _isInitialized = false;

function _syncHookList(hookName, pluginId) {
  const list = pluginHooks[hookName];
  if (!list) {
    return;
  }
  if (list.includes(pluginId)) {
    return;
  }
  list.push(pluginId);
}

function _wireSandboxHost(host, pluginId, manifest) {
  host.setHandler('onRpc', async (method, args) => {
    const prefix = `plugin_${manifest.id}_`;
    if (method === 'storage.get') {
      return storage.get(prefix + args[0]);
    }
    if (method === 'storage.set') {
      return storage.set(prefix + args[0], args[1]);
    }
    if (method === 'ui.showNotification') {
      const icon = args[0] ?? '🔌';
      const text = args[1] ?? '';
      if (typeof window.showNotification === 'function') {
        window.showNotification(icon, text);
      } else {
        console.warn('[Plugin] showNotification not available');
      }
      return undefined;
    }
  });

  host.setHandler('onHookRegister', (hookName) => {
    if (pluginHooks[hookName]) {
      _syncHookList(hookName, pluginId);
    }
  });

  host.setHandler('onUiRegisterHeader', (data) => {
    pluginManager._registerHeaderFromSandbox(pluginId, data);
  });

  host.setHandler('onGardenRegister', (data) => {
    const plugin = plugins.get(pluginId);
    if (!plugin) {
      return;
    }
    plugin.gardenWidget = {
      id: `${pluginId}-garden-widget`,
      position: data.position || 'top',
      render() {}
    };
    pluginManager.triggerHook('renderGardenWidget', plugin.gardenWidget);
  });

  host.setHandler('onGardenHtml', (data) => {
    const container = document.getElementById('garden-container');
    if (!container) {
      return;
    }
    const oldWidget = document.getElementById(`${pluginId}-garden-widget`);
    if (oldWidget) {
      oldWidget.remove();
    }
    const wrap = document.createElement('div');
    wrap.id = `${pluginId}-garden-widget`;
    wrap.innerHTML = data.html;
    container.appendChild(wrap);
  });
}

export const pluginManager = {
  async init() {
    if (_isInitialized) {
      console.log('[PluginManager] Already initialized');
      return _initPromise;
    }

    if (_initPromise) {
      console.log('[PluginManager] Init in progress, waiting...');
      return _initPromise;
    }

    _initPromise = this._doInit();
    return _initPromise;
  },

  async _doInit() {
    console.log('[PluginManager] Initializing...');

    await storage.init();

    const installedIds = await getInstalledPluginIdsNormalized();
    console.log('[PluginManager] Installed plugins:', installedIds);

    const failedIds = [];
    for (const pluginId of installedIds) {
      console.log('[PluginManager] Loading plugin:', pluginId);
      const success = await this.loadPlugin(pluginId);
      console.log('[PluginManager] Load result for', pluginId, ':', success);
      if (!success) {
        failedIds.push(pluginId);
      }
    }

    if (failedIds.length) {
      const next = installedIds.filter((id) => !failedIds.includes(id));
      await storage.set('cultiva-installed-plugins', next);
      try {
        localStorage.setItem('cultiva-installed-plugins', JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      console.warn('[PluginManager] Removed unloadable plugin ids from install list:', failedIds);
    }

    await this.triggerHook('onAppStart');

    _isInitialized = true;
    console.log('[PluginManager] Initialized with', plugins.size, 'plugins');
  },

  async _injectPluginStyles(pluginId, manifest) {
    if (!manifest || !Array.isArray(manifest.styles) || !window.electron?.readPluginFile) {
      return;
    }
    const chunks = [];
    for (const rel of manifest.styles) {
      if (typeof rel !== 'string' || !rel.trim()) {
        continue;
      }
      const name = rel.replace(/^[/\\]+/, '');
      const css = await window.electron.readPluginFile(`${pluginId}/${name}`);
      if (css) {
        chunks.push(css);
      }
    }
    if (!chunks.length) {
      return;
    }
    const id = `cultiva-plugin-style-${pluginId}`;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = chunks.join('\n');
  },

  _removePluginStyles(pluginId) {
    document.getElementById(`cultiva-plugin-style-${pluginId}`)?.remove();
    document.getElementById('weather-plugin-styles')?.remove();
  },

  async loadPlugin(pluginId) {
    notePluginLoadFailure(null);
    try {
      console.log('[PluginManager] Loading plugin from disk:', pluginId);

      if (!window.electron?.readPluginFile) {
        console.warn('[PluginManager] Plugin files API unavailable (not running in Electron?)');
        notePluginLoadFailure('readPluginFile API missing');
        return false;
      }

      const manifestJson = await window.electron.readPluginFile(`${pluginId}/manifest.json`);

      if (!manifestJson) {
        console.warn('[PluginManager] Plugin manifest not found:', pluginId);
        notePluginLoadFailure('manifest.json missing on disk');
        return false;
      }

      const manifest = JSON.parse(stripUtf8Bom(manifestJson).trim());
      console.log('[PluginManager] Manifest loaded:', manifest.name, 'v' + manifest.version);

      if (manifest.minAppVersion) {
        const appVersion = BRANDING.VERSION;
        if (!this.checkVersion(appVersion, manifest.minAppVersion)) {
          console.warn('[PluginManager] Plugin requires newer app version:', manifest.minAppVersion);
          notePluginLoadFailure(`app ${appVersion} < required ${manifest.minAppVersion}`);
          return false;
        }
      }

      const entryRel =
        typeof manifest.entry === 'string' && manifest.entry.trim()
          ? manifest.entry.trim().replace(/^[/\\]+/, '')
          : 'index.js';
      manifest.entry = entryRel;

      const pluginCode = await window.electron.readPluginFile(`${pluginId}/${entryRel}`);

      if (!pluginCode) {
        console.warn('[PluginManager] Plugin code not found:', entryRel);
        notePluginLoadFailure(`entry file missing: ${entryRel}`);
        return false;
      }

      const sandboxHost = new PluginSandboxHost(pluginId, manifest);
      _wireSandboxHost(sandboxHost, pluginId, manifest);

      let loadResult;
      try {
        loadResult = await sandboxHost.load(pluginCode);
      } catch (e) {
        console.error('[PluginManager] Sandbox failed:', pluginId, e);
        sandboxHost.destroy();
        notePluginLoadFailure(e && e.message ? e.message : String(e));
        return false;
      }

      const instanceProxy = loadResult.instanceProxy;

      plugins.set(pluginId, {
        id: pluginId,
        manifest,
        sandbox: sandboxHost,
        instance: instanceProxy,
        enabled: true
      });

      try {
        await this._injectPluginStyles(pluginId, manifest);
      } catch (err) {
        console.warn('[PluginManager] Style inject failed:', pluginId, err);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const plugin = plugins.get(pluginId);

      if (plugin?.gardenWidget && plugin.sandbox) {
        setTimeout(() => {
          const container = document.getElementById('garden-container');
          if (container) {
            plugin.sandbox.runGardenRender();
          }
        }, 200);
      }

      console.log('[PluginManager] Loaded plugin:', manifest.name, 'v' + manifest.version);

      if (typeof window.renderPluginHeaderItems === 'function') {
        setTimeout(() => window.renderPluginHeaderItems(), 100);
      }

      return true;
    } catch (e) {
      console.error('[PluginManager] Failed to load plugin:', pluginId, e);
      notePluginLoadFailure(e && e.message ? e.message : String(e));
      return false;
    }
  },

  get plugins() {
    return plugins;
  },

  _registerHeaderFromSandbox(pluginId, data) {
    const plugin = plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    const instance = plugin.instance;
    let modalMethod = null;

    if (instance && typeof instance.openWeatherModal === 'function') {
      modalMethod = 'openWeatherModal';
    } else if (instance && typeof instance.openSettingsModal === 'function') {
      modalMethod = 'openSettingsModal';
    } else if (instance && typeof instance.openRadioModal === 'function') {
      modalMethod = 'openRadioModal';
    } else if (instance && typeof instance.openModal === 'function') {
      modalMethod = 'openModal';
    }

    plugin.headerItem = {
      id: `${pluginId}-header`,
      label: data.label || plugin.manifest.name,
      icon: data.icon || plugin.manifest.icon || '🔌',
      instance,
      modalMethod,
      onClick: data.hasOnClick ? () => plugin.sandbox.invokeHeaderOnClick() : null
    };

    this.triggerHook('renderHeaderItem', plugin.headerItem);

    if (typeof window.renderPluginHeaderItems === 'function') {
      setTimeout(() => window.renderPluginHeaderItems(), 50);
    }
  },

  registerHeaderItem(pluginId, config) {
    this._registerHeaderFromSandbox(pluginId, {
      label: config?.label,
      icon: config?.icon,
      hasOnClick: typeof config?.onClick === 'function'
    });
  },

  registerGardenWidget(pluginId, config) {
    const plugin = plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    plugin.gardenWidget = {
      id: `${pluginId}-garden-widget`,
      render: config.render,
      position: config.position || 'top'
    };

    this.triggerHook('renderGardenWidget', plugin.gardenWidget);

    if (config.render && typeof config.render === 'function') {
      const container = document.getElementById('garden-container');
      if (container) {
        config.render(container);
      }
    }
  },

  async triggerHook(hookName, ...args) {
    const pluginIds = pluginHooks[hookName] || [];
    for (const pluginId of pluginIds) {
      const plugin = plugins.get(pluginId);
      if (plugin && plugin.enabled && plugin.sandbox && plugin.sandbox.hasHook(hookName)) {
        try {
          plugin.sandbox.invokeHook(hookName, args);
        } catch (e) {
          console.error('[PluginManager] Hook error:', pluginId, hookName, e);
        }
      }
    }
  },

  async installPlugin(pluginId) {
    console.log('[PluginManager] Installing plugin:', pluginId);

    if (!window.electron?.installPlugin) {
      throw new Error('Plugin install is only available in the desktop app');
    }

    const registryText = await fetchPluginHttpText(REGISTRY_URL);
    const registry = JSON.parse(stripUtf8Bom(registryText).trim());
    const pluginList = Array.isArray(registry.plugins) ? registry.plugins : [];

    const pluginInfo = pluginList.find((p) => p.id === pluginId);
    if (!pluginInfo) {
      throw new Error('Plugin not found in registry');
    }

    const sh = pluginInfo.sha256 && typeof pluginInfo.sha256 === 'object' ? pluginInfo.sha256 : {};
    const base = String(pluginInfo.baseUrl).replace(/\/$/, '');

    const manifestText = await fetchPluginHttpText(`${base}/manifest.json`);
    const manifest = JSON.parse(stripUtf8Bom(manifestText).trim());
    const entryFileRaw =
      typeof manifest.entry === 'string' && manifest.entry.trim() ? manifest.entry.trim() : 'index.js';
    const entryFile = entryFileRaw.replace(/^[/\\]+/, '');

    const files = [
      { name: 'manifest.json', url: `${base}/manifest.json`, sha256: sh['manifest.json'] },
      { name: entryFile, url: `${base}/${entryFile}`, sha256: sh[entryFile] }
    ];

    if (Array.isArray(manifest.styles)) {
      for (const rel of manifest.styles) {
        if (typeof rel !== 'string' || !rel.trim()) {
          continue;
        }
        const name = rel.replace(/^[/\\]+/, '');
        files.push({ name, url: `${base}/${name}`, sha256: sh[name] });
      }
    }

    const success = await window.electron.installPlugin(pluginId, files);
    if (!success) {
      return false;
    }

    const loadOk = await this.loadPlugin(pluginId);
    if (!loadOk) {
      const detail = takePluginLoadFailure();
      try {
        await window.electron.uninstallPlugin(pluginId);
      } catch (e) {
        console.warn('[PluginManager] Rollback uninstall failed:', e);
      }
      const detailSentence = detail ? ` (${detail})` : '';
      throw new Error(
        `Plugin files were saved but the plugin did not start.${detailSentence} ` +
        'Use the desktop app (Electron) for install, or check DevTools console for sandbox errors.'
      );
    }

    const installed = await getInstalledPluginIdsNormalized();
    if (!installed.includes(pluginId)) {
      installed.push(pluginId);
      await storage.set('cultiva-installed-plugins', installed);
      try {
        localStorage.setItem('cultiva-installed-plugins', JSON.stringify(installed));
      } catch {
        /* ignore */
      }
    }

    return true;
  },

  async uninstallPlugin(pluginId) {
    console.log('[PluginManager] Uninstalling plugin:', pluginId);

    const plugin = plugins.get(pluginId);
    if (plugin?.sandbox) {
      try {
        plugin.sandbox.runLifecycle('onDisable');
      } catch (e) {
        console.warn('[PluginManager] onDisable:', e);
      }
      await new Promise((r) => setTimeout(r, 80));
      plugin.sandbox.destroy();
    }

    plugins.delete(pluginId);

    for (const list of Object.values(pluginHooks)) {
      const idx = list.indexOf(pluginId);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }

    await window.electron.uninstallPlugin(pluginId);

    const installed = await getInstalledPluginIdsNormalized();
    const index = installed.indexOf(pluginId);
    if (index > -1) {
      installed.splice(index, 1);
      await storage.set('cultiva-installed-plugins', installed);
      localStorage.setItem('cultiva-installed-plugins', JSON.stringify(installed));
    }

    const widget = document.getElementById(`${pluginId}-garden-widget`);
    if (widget) {
      widget.remove();
    }

    this._removePluginStyles(pluginId);

    if (typeof window.renderPluginHeaderItems === 'function') {
      window.renderPluginHeaderItems();
    }
  },

  async getAvailablePlugins() {
    try {
      const registryText = await fetchPluginHttpText(REGISTRY_URL);
      const registry = JSON.parse(stripUtf8Bom(registryText).trim());
      const list = (Array.isArray(registry.plugins) ? registry.plugins : []).filter(
        (p) => p && typeof p.id === 'string' && p.id.trim()
      );

      const installed = await getInstalledPluginIdsNormalized();

      return list.map((p) => ({
        ...p,
        installed: installed.includes(p.id)
      }));
    } catch (e) {
      console.error('[PluginManager] Failed to fetch registry:', e);
      throw e;
    }
  },

  getInstalledPlugins() {
    return Array.from(plugins.values()).map((p) => ({
      id: p.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      icon: p.manifest.icon,
      enabled: p.enabled,
      loaded: true
    }));
  },

  /**
   * All plugin ids marked installed in storage, merged with in-memory state.
   * Used by Settings so rows appear even when load failed (e.g. browser-only dev).
   */
  async getInstalledPluginsForUI() {
    const ids = await getInstalledPluginIdsNormalized();
    const rows = [];
    for (const id of ids) {
      const p = plugins.get(id);
      if (p) {
        rows.push({
          id: p.id,
          name: p.manifest.name,
          version: p.manifest.version,
          description: p.manifest.description,
          icon: p.manifest.icon,
          enabled: p.enabled,
          loaded: true
        });
        continue;
      }
      let name = id;
      let version = '';
      let description = '';
      let icon = '⚠️';
      if (window.electron?.readPluginFile) {
        try {
          const mj = await window.electron.readPluginFile(`${id}/manifest.json`);
          if (mj) {
            const m = JSON.parse(stripUtf8Bom(mj).trim());
            name = m.name || id;
            version = m.version || '';
            description = m.description || '';
            icon = m.icon || '🔌';
          }
        } catch (e) {
          console.warn('[PluginManager] Could not read manifest for', id, e);
        }
      }
      rows.push({
        id,
        name,
        version,
        description,
        icon,
        enabled: false,
        loaded: false
      });
    }
    return rows;
  },

  checkVersion(current, required) {
    const strip = (v) => String(v || '').split(/[-+]/)[0];
    const currentParts = strip(current).split('.').map((x) => parseInt(x, 10) || 0);
    const requiredParts = strip(required).split('.').map((x) => parseInt(x, 10) || 0);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const c = currentParts[i] || 0;
      const r = requiredParts[i] || 0;
      if (c < r) {
        return false;
      }
      if (c > r) {
        return true;
      }
    }
    return true;
  }
};
