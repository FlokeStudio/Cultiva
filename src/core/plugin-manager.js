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

/** Resolve which modal opener exists on the plugin instance (header click wiring). */
function resolveHeaderModalMethod(instance) {
  if (!instance) {
    return null;
  }
  if (typeof instance.openWeatherModal === 'function') {
    return 'openWeatherModal';
  }
  if (typeof instance.openSettingsModal === 'function') {
    return 'openSettingsModal';
  }
  if (typeof instance.openRadioModal === 'function') {
    return 'openRadioModal';
  }
  if (typeof instance.openModal === 'function') {
    return 'openModal';
  }
  return null;
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

function _escapeSelectorSegment(id) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(id);
  }
  return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function _closePluginMainSheet(pluginId) {
  document.querySelectorAll('[data-cultiva-plugin-sheet]').forEach((el) => {
    if (el.getAttribute('data-cultiva-plugin-sheet') !== pluginId) {
      return;
    }
    const kh = el._cultivaSheetKeyHandler;
    if (typeof kh === 'function') {
      document.removeEventListener('keydown', kh);
    }
    el.remove();
  });
}

function _readCultivaPayloadFromEl(t) {
  const raw = t.getAttribute('data-cultiva-payload');
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function _readDatasetGeoPayload(t) {
  const p = {};
  if (t.dataset.lat !== undefined && t.dataset.lat !== '') {
    p.lat = parseFloat(t.dataset.lat);
  }
  if (t.dataset.lon !== undefined && t.dataset.lon !== '') {
    p.lon = parseFloat(t.dataset.lon);
  }
  if (t.dataset.city !== undefined) {
    p.city = t.dataset.city;
  }
  return p;
}

function _mountPluginMainSheet(pluginId, html) {
  _closePluginMainSheet(pluginId);
  const wrap = document.createElement('div');
  wrap.setAttribute('data-cultiva-plugin-sheet', pluginId);
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.className = 'cultiva-plugin-sheet-root';
  wrap.innerHTML = String(html || '');
  document.body.appendChild(wrap);

  const sandbox = plugins.get(pluginId)?.sandbox;
  if (!sandbox) {
    return;
  }

  const forward = (action, payload) => {
    sandbox.postToSandbox({
      type: 'MODAL_ACTION',
      action,
      payload: payload === undefined ? null : payload
    });
  };

  wrap.addEventListener('click', (e) => {
    const closeHit = e.target.closest('[data-cultiva-act="close"]');
    if (closeHit) {
      _closePluginMainSheet(pluginId);
      return;
    }
    const t = e.target.closest('[data-cultiva-act]');
    if (!t) {
      return;
    }
    const act = t.getAttribute('data-cultiva-act');
    if (act === 'close') {
      _closePluginMainSheet(pluginId);
      return;
    }
    let payload = { ..._readDatasetGeoPayload(t), ...(_readCultivaPayloadFromEl(t) || {}) };
    if (t.dataset.tz) {
      payload.tz = t.dataset.tz;
    }
    if (t.dataset.station) {
      payload.stationId = t.dataset.station;
    }
    if (t.dataset.minutes !== undefined && t.dataset.minutes !== '') {
      const m = parseInt(t.dataset.minutes, 10);
      if (!Number.isNaN(m)) {
        payload.minutes = m;
      }
    }
    if (t.getAttribute('data-cultiva-collect') === '1') {
      const root = t.closest('.cultiva-sheet-card') || wrap;
      const formPayload = {};
      root.querySelectorAll('[name]').forEach((el) => {
        if (!el.name) {
          return;
        }
        if (el.type === 'checkbox') {
          formPayload[el.name] = el.checked;
        } else if (el.type === 'radio') {
          if (el.checked) {
            formPayload[el.name] = el.value;
          }
        } else {
          formPayload[el.name] = el.value;
        }
      });
      payload = { ...formPayload, ...payload };
    }
    forward(act, payload);
  });

  wrap.addEventListener('change', (e) => {
    const t = e.target.closest('[data-cultiva-change-act]');
    if (!t) {
      return;
    }
    const act = t.getAttribute('data-cultiva-change-act');
    const payload = { ..._readDatasetGeoPayload(t), value: t.value };
    forward(act, payload);
  });

  wrap.addEventListener('input', (e) => {
    const t = e.target.closest('[data-cultiva-input-act]');
    if (!t) {
      return;
    }
    const act = t.getAttribute('data-cultiva-input-act');
    forward('input:' + act, { value: t.value });
  });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      _closePluginMainSheet(pluginId);
      document.removeEventListener('keydown', onKey);
    }
  };
  wrap._cultivaSheetKeyHandler = onKey;
  document.addEventListener('keydown', onKey);
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
    const method = typeof data.gardenClickMethod === 'string' ? data.gardenClickMethod : null;
    if (method) {
      wrap.addEventListener('click', () => {
        const p = plugins.get(pluginId);
        if (p?.instance && typeof p.instance[method] === 'function') {
          p.instance[method]();
        }
      });
    }
  });

  host.setHandler('onUiMainSheet', (data) => {
    _mountPluginMainSheet(pluginId, data.html);
  });

  host.setHandler('onUiCloseMainSheet', () => {
    _closePluginMainSheet(pluginId);
  });

  host.setHandler('onUiUpdateHeader', (data) => {
    const plugin = plugins.get(pluginId);
    if (plugin?.headerItem) {
      if (data.label !== null && data.label !== undefined) {
        plugin.headerItem.label = data.label;
      }
      if (data.icon !== null && data.icon !== undefined) {
        plugin.headerItem.icon = data.icon;
      }
      if (data.labelColor !== null && data.labelColor !== undefined) {
        plugin.headerItem.labelColor = data.labelColor;
      }
    }
    const el = document.querySelector(
      `.header-plugin-item[data-plugin-id="${_escapeSelectorSegment(pluginId)}"]`
    );
    if (!el) {
      if (plugin) {
        const prev = plugin._pendingHeaderUi || {};
        plugin._pendingHeaderUi = { ...prev };
        if (data.label !== null && data.label !== undefined) {
          plugin._pendingHeaderUi.label = data.label;
        }
        if (data.icon !== null && data.icon !== undefined) {
          plugin._pendingHeaderUi.icon = data.icon;
        }
        if (data.labelColor !== null && data.labelColor !== undefined) {
          plugin._pendingHeaderUi.labelColor = data.labelColor;
        }
      }
      return;
    }
    const iconEl = el.querySelector('.header-plugin-icon');
    const labelEl = el.querySelector('.header-plugin-label');
    if (iconEl && data.icon !== null && data.icon !== undefined) {
      iconEl.textContent = data.icon;
    }
    if (labelEl && data.label !== null && data.label !== undefined) {
      labelEl.textContent = data.label;
    }
    if (labelEl && data.labelColor !== null && data.labelColor !== undefined) {
      labelEl.style.color = data.labelColor || '';
    }
    if (plugin?.headerItem && data.labelColor !== null && data.labelColor !== undefined) {
      plugin.headerItem.labelColor = data.labelColor;
    }
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

      // Register before sandbox load: onEnable may post UI_REGISTER_HEADER / GARDEN_REGISTER
      // before SANDBOX_READY; handlers use plugins.get(pluginId) and must not no-op.
      plugins.set(pluginId, {
        id: pluginId,
        manifest,
        sandbox: sandboxHost,
        instance: null,
        enabled: true,
        headerItem: null,
        gardenWidget: null
      });

      let loadResult;
      try {
        loadResult = await sandboxHost.load(pluginCode);
      } catch (e) {
        console.error('[PluginManager] Sandbox failed:', pluginId, e);
        sandboxHost.destroy();
        plugins.delete(pluginId);
        notePluginLoadFailure(e && e.message ? e.message : String(e));
        return false;
      }

      const instanceProxy = loadResult.instanceProxy;

      const existing = plugins.get(pluginId);
      plugins.set(pluginId, {
        ...existing,
        id: pluginId,
        manifest,
        sandbox: sandboxHost,
        instance: instanceProxy,
        enabled: true
      });

      const pluginAfterLoad = plugins.get(pluginId);
      if (pluginAfterLoad?.headerItem) {
        pluginAfterLoad.headerItem.instance = instanceProxy;
        pluginAfterLoad.headerItem.modalMethod = resolveHeaderModalMethod(instanceProxy);
      }

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
    const modalMethod = resolveHeaderModalMethod(instance);

    plugin.headerItem = {
      id: `${pluginId}-header`,
      label: typeof data.label === 'string' ? data.label : plugin.manifest.name,
      icon: typeof data.icon === 'string' ? data.icon : (plugin.manifest.icon || '🔌'),
      labelColor: undefined,
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
