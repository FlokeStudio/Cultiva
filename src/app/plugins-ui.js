import { TRANSLATIONS } from '../core/i18n.js';
import { pluginManager } from '../core/plugin-manager.js';
import { settings } from './renderer-bootstrap.js';
import { saveSettings } from './settings-controller.js';
import { showNotification } from './ui-shell.js';

function tStrings() {
  return TRANSLATIONS[settings.lang] || TRANSLATIONS.en;
}

export async function renderPluginsSection() {
  const pluginsToggle = document.getElementById('toggle-plugins');
  if (pluginsToggle) {
    pluginsToggle.checked = settings.pluginsEnabled;
  }
  if (pluginsToggle && !pluginsToggle.dataset.bound) {
    pluginsToggle.dataset.bound = '1';
    pluginsToggle.addEventListener('change', (e) => {
      settings.pluginsEnabled = e.target.checked;
      saveSettings();

      if (settings.pluginsEnabled) {
        pluginManager.init();
        renderPluginHeaderItems();
      } else {
        document.querySelectorAll('.header-plugin-item').forEach((el) => el.remove());
      }
    });
  }

  await loadInstalledPlugins();
  await loadAvailablePlugins();
}

async function loadInstalledPlugins() {
  const container = document.getElementById('installed-plugins-list');
  if (!container) {
    return;
  }

  const plugins = await pluginManager.getInstalledPluginsForUI();
  const t = tStrings();

  container.replaceChildren();

  if (plugins.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'plugins-empty';
    empty.dataset.i18n = 'noPluginsInstalled';
    empty.textContent = t.noPluginsInstalled;
    container.appendChild(empty);
    return;
  }

  for (const p of plugins) {
    const card = document.createElement('div');
    card.className = 'plugin-card';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'plugin-icon';
    iconWrap.textContent = p.icon || '🔌';

    const info = document.createElement('div');
    info.className = 'plugin-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'plugin-name';
    nameEl.textContent = p.name || '';

    const descEl = document.createElement('div');
    descEl.className = 'plugin-description';
    const baseDesc = p.description || '';
    descEl.textContent = p.loaded
      ? baseDesc
      : `${baseDesc ? `${baseDesc} — ` : ''}${t.pluginNotLoadedHint || 'Not loaded.'}`;

    const meta = document.createElement('div');
    meta.className = 'plugin-meta';
    const ver = document.createElement('span');
    ver.className = 'plugin-version';
    ver.textContent = p.version ? `v${p.version}` : '';
    meta.appendChild(ver);

    info.appendChild(nameEl);
    info.appendChild(descEl);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'plugin-actions';

    const btnSettings = document.createElement('button');
    btnSettings.type = 'button';
    btnSettings.className = 'plugin-btn plugin-btn-settings';
    btnSettings.title = t.pluginSettings;
    btnSettings.textContent = '⚙️';
    btnSettings.disabled = !p.loaded;
    btnSettings.addEventListener('click', () => window.openPluginSettings(p.id));

    const btnUninstall = document.createElement('button');
    btnUninstall.type = 'button';
    btnUninstall.className = 'plugin-btn plugin-btn-uninstall';
    btnUninstall.title = t.uninstall;
    btnUninstall.textContent = '🗑️';
    btnUninstall.addEventListener('click', () => window.uninstallPlugin(p.id));

    actions.appendChild(btnSettings);
    actions.appendChild(btnUninstall);

    card.appendChild(iconWrap);
    card.appendChild(info);
    card.appendChild(actions);
    container.appendChild(card);
  }
}

async function loadAvailablePlugins() {
  const container = document.getElementById('available-plugins-list');
  if (!container) {
    return;
  }

  const t = tStrings();
  container.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'plugins-loading';
  loading.dataset.i18n = 'checkingPlugins';
  loading.textContent = t.checkingPlugins;
  container.appendChild(loading);

  try {
    const plugins = await pluginManager.getAvailablePlugins();

    container.replaceChildren();

    if (plugins.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'plugins-empty';
      empty.dataset.i18n = 'noPluginsAvailable';
      empty.textContent = t.noPluginsAvailable;
      container.appendChild(empty);
      return;
    }

    for (const p of plugins) {
      const card = document.createElement('div');
      card.className = 'plugin-card';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'plugin-icon';
      iconWrap.textContent = p.icon || '🔌';

      const info = document.createElement('div');
      info.className = 'plugin-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'plugin-name';
      nameEl.textContent = p.name || '';

      const descEl = document.createElement('div');
      descEl.className = 'plugin-description';
      descEl.textContent = p.description || '';

      const meta = document.createElement('div');
      meta.className = 'plugin-meta';
      const ver = document.createElement('span');
      ver.className = 'plugin-version';
      ver.textContent = `v${p.version || ''}`;
      const author = document.createElement('span');
      author.className = 'plugin-author';
      author.textContent = p.author !== null && p.author !== undefined ? String(p.author) : '';
      meta.appendChild(ver);
      meta.appendChild(author);

      info.appendChild(nameEl);
      info.appendChild(descEl);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'plugin-actions';
      const btnInstall = document.createElement('button');
      btnInstall.type = 'button';
      const pid = p.id;
      const canInstall = Boolean(typeof window !== 'undefined' && window.electron?.installPlugin);
      if (p.installed) {
        btnInstall.className = 'plugin-btn plugin-btn-installed';
        btnInstall.disabled = true;
        btnInstall.textContent = t.pluginInstalledButton || 'Installed';
      } else if (!canInstall) {
        btnInstall.className = 'plugin-btn plugin-btn-installed';
        btnInstall.disabled = true;
        btnInstall.textContent = t.install;
        btnInstall.title = t.pluginInstallDesktopOnly || '';
      } else {
        btnInstall.className = 'plugin-btn plugin-btn-install';
        btnInstall.textContent = t.install;
        btnInstall.addEventListener('click', () => window.installPlugin(pid));
      }
      actions.appendChild(btnInstall);

      card.appendChild(iconWrap);
      card.appendChild(info);
      card.appendChild(actions);
      container.appendChild(card);
    }
  } catch (e) {
    console.error('[Plugins UI] loadAvailablePlugins:', e);
    container.replaceChildren();
    const err = document.createElement('div');
    err.className = 'plugins-empty';
    const base = t.pluginsRegistryError || 'Could not load the plugin catalog.';
    err.textContent = e && e.message ? `${base} (${e.message})` : base;
    container.appendChild(err);
  }
}

window.installPlugin = async (pluginId) => {
  try {
    showNotification('', 'Installing plugin...');
    await pluginManager.installPlugin(pluginId);
    showNotification('', 'Plugin installed successfully!');
    await renderPluginsSection();
    renderPluginHeaderItems();
  } catch (e) {
    showNotification('', `Failed to install plugin: ${e.message}`);
  }
};

window.uninstallPlugin = async (pluginId) => {
  const t = tStrings();
  if (confirm(t.pluginUninstallConfirm)) {
    await pluginManager.uninstallPlugin(pluginId);
    showNotification('', t.pluginUninstallSuccess);
    await renderPluginsSection();
    renderPluginHeaderItems();
  }
};

window.openPluginSettings = (pluginId) => {
  console.log('[Plugins] Open settings for:', pluginId);
  showNotification('', 'Plugin settings coming soon');
};

export function renderPluginHeaderItems() {
  if (!settings.pluginsEnabled) {
    return;
  }

  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) {
    return;
  }

  document.querySelectorAll('.header-plugin-item').forEach((el) => el.remove());

  const installedPlugins = pluginManager.getInstalledPlugins();

  installedPlugins.forEach((plugin) => {
    const pluginData = pluginManager.plugins.get(plugin.id);

    if (pluginData?.headerItem) {
      const item = document.createElement('div');
      item.className = 'header-plugin-item';
      item.dataset.pluginId = plugin.id;
      const iconSpan = document.createElement('span');
      iconSpan.className = 'header-plugin-icon';
      iconSpan.textContent = pluginData.headerItem.icon || '';
      if (!(pluginData.headerItem.icon || '').toString().trim()) {
        iconSpan.classList.add('header-plugin-icon--empty');
      }
      const labelSpan = document.createElement('span');
      labelSpan.className = 'header-plugin-label';
      labelSpan.textContent = pluginData.headerItem.label || '';
      labelSpan.style.color = pluginData.headerItem.labelColor || '';
      const pend = pluginData._pendingHeaderUi;
      if (pend) {
        if (pend.icon !== null && pend.icon !== undefined) {
          iconSpan.textContent = pend.icon;
        }
        if (pend.label !== null && pend.label !== undefined) {
          labelSpan.textContent = pend.label;
        }
        if (pend.labelColor !== null && pend.labelColor !== undefined) {
          labelSpan.style.color = pend.labelColor || '';
        }
        if (!(iconSpan.textContent || '').trim()) {
          iconSpan.classList.add('header-plugin-icon--empty');
        } else {
          iconSpan.classList.remove('header-plugin-icon--empty');
        }
        delete pluginData._pendingHeaderUi;
      }
      item.appendChild(iconSpan);
      item.appendChild(labelSpan);

      item.onclick = () => {
        const hi = pluginData.headerItem;

        if (hi.instance && hi.modalMethod && typeof hi.instance[hi.modalMethod] === 'function') {
          hi.instance[hi.modalMethod]();
        } else if (hi.onClick) {
          hi.onClick();
        } else {
          console.warn('[Click] No method found for', plugin.id);
        }
      };

      const addBtn = document.getElementById('open-add-modal');
      headerActions.insertBefore(item, addBtn);
    }
  });
}

window.renderPluginHeaderItems = renderPluginHeaderItems;
window.pluginManager = pluginManager;
