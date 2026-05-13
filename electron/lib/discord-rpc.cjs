const { Client } = require('discord-rpc');

const DISCORD_CLIENT_ID = '1492849856832606329';

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

let rpc = null;
let rpcReady = false;
let discordEnabled = true;
let currentLocale = 'en';
let currentPage = 'garden';

function initDiscordRPC() {
  if (rpc) {
    return;
  }

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

  rpc.login({ clientId: DISCORD_CLIENT_ID }).catch((err) => {
    console.warn('[Discord] Failed to connect:', err.message);
    rpc = null;
  });
}

function updateDiscordActivity(activityData = {}) {
  if (!rpcReady || !rpc || !discordEnabled) {
    return;
  }

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
    partyMax: activityData.partyMax
  };

  rpc.setActivity(activity).catch((err) => {
    console.warn('[Discord] Failed to update activity:', err.message);
  });
}

function clearDiscordActivity() {
  if (!rpcReady || !rpc) {
    return;
  }

  rpc.clearActivity().catch((err) => {
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
  if (url.includes('/calendar')) {
    return 'calendar';
  }
  if (url.includes('/pages/')) {
    return 'pages';
  }
  if (url.includes('settings') || url.includes('settings-modal')) {
    return 'settings';
  }
  if (url.includes('stats')) {
    return 'stats';
  }
  if (url.includes('trophy')) {
    return 'trophy';
  }
  if (url.includes('focus')) {
    return 'focus';
  }
  return 'garden';
}

function onMainWindowNavigation(url) {
  currentPage = detectPageFromUrl(url);
  if (discordEnabled) {
    updateDiscordActivity({ page: currentPage });
  }
}

function onMainWindowReadyShow() {
  currentPage = 'garden';
  if (discordEnabled) {
    updateDiscordActivity({ page: 'garden' });
  }
}

function onMainWindowClosed() {
  if (discordEnabled) {
    clearDiscordActivity();
  }
}

function registerDiscordIpc(ipcMain) {
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
}

module.exports = {
  initDiscordRPC,
  updateDiscordActivity,
  clearDiscordActivity,
  shutdownDiscordRPC,
  detectPageFromUrl,
  registerDiscordIpc,
  onMainWindowNavigation,
  onMainWindowReadyShow,
  onMainWindowClosed
};
