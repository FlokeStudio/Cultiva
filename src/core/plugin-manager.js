import { storage } from '../modules/storage.js';
import { BRANDING } from './branding.js';
import { PluginSandboxHost } from './plugin-sandbox-host.js';

const REGISTRY_URL = 'https://raw.githubusercontent.com/krwg/CultivaPlugins/main/registry.json';

const plugins = new Map();
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
      const text = args[0];
      const icon = args[1] ?? '🔌';
      if (typeof window.showNotification === 'function') {
        window.showNotification(icon, text);
      } else {
        console.warn('[Plugin] showNotification not available');
      }
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

    const installed = (await storage.get('cultiva-installed-plugins')) || [];
    console.log('[PluginManager] Installed plugins:', installed);

    for (const pluginId of installed) {
      console.log('[PluginManager] Loading plugin:', pluginId);
      const success = await this.loadPlugin(pluginId);
      console.log('[PluginManager] Load result for', pluginId, ':', success);
    }

    await this.triggerHook('onAppStart');

    _isInitialized = true;
    console.log('[PluginManager] Initialized with', plugins.size, 'plugins');
  },

  async loadPlugin(pluginId) {
    try {
      console.log('[PluginManager] Loading plugin from disk:', pluginId);

      const manifestJson = await window.electron.readPluginFile(`${pluginId}/manifest.json`);

      if (!manifestJson) {
        console.warn('[PluginManager] Plugin manifest not found:', pluginId);
        return false;
      }

      const manifest = JSON.parse(manifestJson);
      console.log('[PluginManager] Manifest loaded:', manifest.name, 'v' + manifest.version);

      if (manifest.minAppVersion) {
        const appVersion = BRANDING.VERSION;
        if (!this.checkVersion(appVersion, manifest.minAppVersion)) {
          console.warn('[PluginManager] Plugin requires newer app version:', manifest.minAppVersion);
          return false;
        }
      }

      const pluginCode = await window.electron.readPluginFile(`${pluginId}/${manifest.entry}`);

      if (!pluginCode) {
        console.warn('[PluginManager] Plugin code not found:', manifest.entry);
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

    const response = await fetch(REGISTRY_URL);
    const registry = await response.json();

    const pluginInfo = registry.plugins.find((p) => p.id === pluginId);
    if (!pluginInfo) {
      throw new Error('Plugin not found in registry');
    }

    const sh = pluginInfo.sha256 && typeof pluginInfo.sha256 === 'object' ? pluginInfo.sha256 : {};
    const base = pluginInfo.baseUrl;
    const files = [
      { name: 'manifest.json', url: `${base}/manifest.json`, sha256: sh['manifest.json'] },
      { name: 'index.js', url: `${base}/index.js`, sha256: sh['index.js'] },
      { name: 'styles.css', url: `${base}/styles.css`, sha256: sh['styles.css'] }
    ];

    const success = await window.electron.installPlugin(pluginId, files);

    if (success) {
      const installed = (await storage.get('cultiva-installed-plugins')) || [];
      if (!installed.includes(pluginId)) {
        installed.push(pluginId);
        await storage.set('cultiva-installed-plugins', installed);
        localStorage.setItem('cultiva-installed-plugins', JSON.stringify(installed));
      }
      await this.loadPlugin(pluginId);
    }

    return success;
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

    const installed = (await storage.get('cultiva-installed-plugins')) || [];
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

    if (typeof window.renderPluginHeaderItems === 'function') {
      window.renderPluginHeaderItems();
    }
  },

  async getAvailablePlugins() {
    try {
      const response = await fetch(REGISTRY_URL);
      const registry = await response.json();

      const installed = (await storage.get('cultiva-installed-plugins')) || [];

      return registry.plugins.map((p) => ({
        ...p,
        installed: installed.includes(p.id)
      }));
    } catch (e) {
      console.error('[PluginManager] Failed to fetch registry:', e);
      return [];
    }
  },

  getInstalledPlugins() {
    return Array.from(plugins.values()).map((p) => ({
      id: p.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      icon: p.manifest.icon,
      enabled: p.enabled
    }));
  },

  checkVersion(current, required) {
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);

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
