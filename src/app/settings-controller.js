import { getThemeBodyClassList, resolveThemeBodyId } from '../core/theme-config.js';
import { storage } from '../modules/storage.js';
import { settings, ensureAppReady } from './renderer-bootstrap.js';
import { applyTranslations } from './i18n-dom.js';

/**
 * @typedef {object} SettingsControllerContext
 * @property {HTMLSelectElement | null} langSelect
 * @property {HTMLSelectElement | null} themeSelect
 * @property {HTMLInputElement | null} trophyToggle
 * @property {HTMLInputElement | null} focusToggle
 * @property {(lang: string) => void} setLangAndT
 * @property {() => void} renderHeaderAvatar
 * @property {() => void} renderGarden
 */

/** @type {SettingsControllerContext | null} */
let ctx = null;

/**
 * @param {SettingsControllerContext} c
 */
export function configureSettingsController(c) {
  ctx = c;
}

function requireCtx() {
  if (!ctx) {
    throw new Error('[settings-controller] configureSettingsController() was not called before using settings APIs');
  }
  return ctx;
}

export async function loadSettings() {
  try {
    await ensureAppReady();

    let saved = await storage.get('cultiva-settings');

    if (!saved) {
      const ls = localStorage.getItem('cultiva-settings');
      if (ls) {
        saved = JSON.parse(ls);
        await storage.set('cultiva-settings', saved);
      }
    }

    if (saved && typeof saved === 'object') {
      if (saved.lang) {
        settings.lang = saved.lang;
      }
      if (saved.theme) {
        settings.theme = saved.theme;
      }
      if (typeof saved.showTrophies === 'boolean') {
        settings.showTrophies = saved.showTrophies;
      }
      if (typeof saved.focusMode === 'boolean') {
        settings.focusMode = saved.focusMode;
      }
      if (saved.holidayRegion) {
        settings.holidayRegion = saved.holidayRegion;
      }
      if (saved.avatar) {
        settings.avatar = { ...settings.avatar, ...saved.avatar };
      }
      if (typeof saved.pluginsEnabled === 'boolean') {
        settings.pluginsEnabled = saved.pluginsEnabled;
      }
      if (typeof saved.nativeNotifyEnabled === 'boolean') {
        settings.nativeNotifyEnabled = saved.nativeNotifyEnabled;
      }
      if (typeof saved.nativeNotifyHabits === 'boolean') {
        settings.nativeNotifyHabits = saved.nativeNotifyHabits;
      }
      if (saved.nativeNotifyHabitsHour !== undefined && saved.nativeNotifyHabitsHour !== null) {
        const h = parseInt(String(saved.nativeNotifyHabitsHour), 10);
        if (!Number.isNaN(h)) {
          settings.nativeNotifyHabitsHour = Math.max(0, Math.min(23, h));
        }
      }
      if (typeof saved.nativeNotifyCalendar === 'boolean') {
        settings.nativeNotifyCalendar = saved.nativeNotifyCalendar;
      }
      if (saved.nativeNotifyCalendarLeadMinutes !== undefined && saved.nativeNotifyCalendarLeadMinutes !== null) {
        const m = parseInt(String(saved.nativeNotifyCalendarLeadMinutes), 10);
        if (!Number.isNaN(m)) {
          settings.nativeNotifyCalendarLeadMinutes = Math.max(5, Math.min(120, m));
        }
      }
    }

    requireCtx().setLangAndT(settings.lang);
    return settings;
  } catch (err) {
    console.warn('Failed to load settings:', err);
    return settings;
  }
}

export function refreshNativeNotificationControlsState() {
  const masterOn = settings.nativeNotifyEnabled !== false;
  ['toggle-native-notify-habits', 'toggle-native-notify-calendar'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !masterOn;
    }
  });
  ['native-notify-habits-hour', 'native-notify-calendar-lead'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !masterOn;
    }
  });
}

export function updateNotificationsDesktopBanner() {
  const b = document.getElementById('notifications-desktop-banner');
  if (b) {
    b.style.display = window.electron?.showNativeNotification ? 'none' : 'flex';
  }
}

export function saveSettings() {
  const c = requireCtx();
  storage.set('cultiva-settings', settings);
  c.setLangAndT(settings.lang);
  applySettings();
  c.renderGarden();
}

export function handleHolidayChange(e) {
  settings.holidayRegion = e.target.value;
  localStorage.setItem('cultiva-holiday-region', e.target.value);
  saveSettings();
}

export function applySettings() {
  const c = requireCtx();
  if (c.langSelect) {
    c.langSelect.value = settings.lang;
    if (c.langSelect.value !== settings.lang) {
      c.langSelect.value = settings.lang;
    }
  }
  applyTranslations(settings.lang);

  document.body.classList.remove(...getThemeBodyClassList());

  const appliedTheme = resolveThemeBodyId(settings.theme);

  document.body.classList.add(`theme-${appliedTheme}`);

  if (c.themeSelect) {
    c.themeSelect.value = settings.theme;
  }

  const trophySection = document.getElementById('trophy-section');
  if (trophySection) {
    trophySection.classList.toggle('hidden', !settings.showTrophies);
  }
  if (c.trophyToggle) {
    c.trophyToggle.checked = settings.showTrophies;
  }
  document.body.classList.toggle('focus-mode', settings.focusMode);
  if (c.focusToggle) {
    c.focusToggle.checked = settings.focusMode;
  }

  const holidaySelect = document.getElementById('holiday-select');
  if (holidaySelect) {
    holidaySelect.value = settings.holidayRegion || 'us';
    holidaySelect.removeEventListener('change', handleHolidayChange);
    holidaySelect.addEventListener('change', handleHolidayChange);
  }

  const pluginsToggle = document.getElementById('toggle-plugins');
  if (pluginsToggle) {
    pluginsToggle.checked = settings.pluginsEnabled;
  }

  const toggleNativeMaster = document.getElementById('toggle-native-notify-master');
  if (toggleNativeMaster) {
    toggleNativeMaster.checked = settings.nativeNotifyEnabled !== false;
  }

  const toggleNativeHabits = document.getElementById('toggle-native-notify-habits');
  if (toggleNativeHabits) {
    toggleNativeHabits.checked = settings.nativeNotifyHabits !== false;
  }
  const nativeHabitsHour = document.getElementById('native-notify-habits-hour');
  if (nativeHabitsHour) {
    nativeHabitsHour.value = String(Math.max(0, Math.min(23, settings.nativeNotifyHabitsHour ?? 9)));
  }
  const toggleNativeCal = document.getElementById('toggle-native-notify-calendar');
  if (toggleNativeCal) {
    toggleNativeCal.checked = settings.nativeNotifyCalendar !== false;
  }
  const nativeCalLead = document.getElementById('native-notify-calendar-lead');
  if (nativeCalLead) {
    const lm = Math.max(5, Math.min(120, settings.nativeNotifyCalendarLeadMinutes ?? 30));
    nativeCalLead.value = String([5, 10, 15, 30, 45, 60, 90, 120].includes(lm) ? lm : 30);
  }

  refreshNativeNotificationControlsState();
  updateNotificationsDesktopBanner();

  c.renderHeaderAvatar();

  localStorage.setItem('cultiva-theme', settings.theme);
  localStorage.setItem('cultiva-lang', settings.lang);
  console.log('[Settings] Applied theme:', appliedTheme);
}
