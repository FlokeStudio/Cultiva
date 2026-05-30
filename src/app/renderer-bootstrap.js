import { storage } from '../modules/storage.js';
import { auth } from '../modules/auth.js';
import { pluginManager } from '../core/plugin-manager.js';
import { resolveThemeBodyId } from '../core/theme-config.js';

export const settings = {
  lang: 'en',
  theme: 'auto',
  showTrophies: false,
  focusMode: false,
  holidayRegion: 'us',
  avatar: { background: 'green', emoji: '🌱' },
  pluginsEnabled: true,
  nativeNotifyEnabled: true,
  nativeNotifyHabits: true,
  nativeNotifyHabitsHour: 9,
  nativeNotifyCalendar: true,
  nativeNotifyCalendarLeadMinutes: 30,
  accentColor: '',
  ambientIntensity: 100
};

const _preInitSettings = localStorage.getItem('cultiva-settings');
if (_preInitSettings) {
  try {
    const parsed = JSON.parse(_preInitSettings);
    if (parsed && typeof parsed === 'object') {
      if ('lang' in parsed || 'theme' in parsed) {
        Object.assign(settings, parsed);
      } else if (parsed['cultiva-settings'] && typeof parsed['cultiva-settings'] === 'object') {
        Object.assign(settings, parsed['cultiva-settings']);
      }
    }
  } catch {
    console.warn('[Pre-init] Invalid settings JSON');
  }
}

(function applyInitialTheme() {
  const t = settings.theme || 'auto';
  const resolved = resolveThemeBodyId(t);
  document.body.className = `theme-${resolved}`;
})();

let _appReady = null;

export async function ensureAppReady() {
  if (_appReady) {
    return _appReady;
  }

  _appReady = (async () => {
    await storage.init();
    await auth.init();
    if (settings.pluginsEnabled) {
      await pluginManager.init();
    }
  })();

  return _appReady;
}
