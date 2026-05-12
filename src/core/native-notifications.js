/**
 * Schedules OS-level (Electron main process) notifications for habits and calendar.
 * Only runs when `window.electron.showNativeNotification` exists (desktop build).
 */

import { habits } from '../modules/habits.js';
import { LEGACY_THRESHOLD } from './config.js';
import { getCultivaTimezone } from './timezone.js';
import { TRANSLATIONS } from './i18n.js';

const LS_HABIT_DAY = 'cultiva-native-notify-habits-sent';
const LS_CAL_PREFIX = 'cultiva-native-notify-cal-';

function todayKeyInTz() {
  const tz = getCultivaTimezone();
  return new Date().toLocaleDateString('en-CA', tz ? { timeZone: tz } : {});
}

function nowMinutesInTz() {
  const tz = getCultivaTimezone();
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(tz ? { timeZone: tz } : {})
  });
  const parts = fmt.formatToParts(d);
  const H = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const M = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  return H * 60 + M;
}

function countOpenHabits(todayStr) {
  let n = 0;
  const names = [];
  for (const h of habits.getAll()) {
    if ((h.progress ?? 0) >= LEGACY_THRESHOLD) {
      continue;
    }
    const open =
      h.trackType === 'quantity'
        ? habits.quantityDayProgress(h, todayStr) < habits.quantityTarget(h)
        : h.lastCompleted !== todayStr;
    if (open) {
      n += 1;
      if (names.length < 5) {
        names.push(h.name);
      }
    }
  }
  return { n, names };
}

function parseHM(startStr) {
  if (!startStr || typeof startStr !== 'string') {
    return null;
  }
  const m = startStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return null;
  }
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function loadCalendarToday(todayStr) {
  try {
    const raw = localStorage.getItem('cultiva_calendar_events');
    if (!raw) {
      return [];
    }
    const o = JSON.parse(raw);
    return Array.isArray(o[todayStr]) ? o[todayStr] : [];
  } catch {
    return [];
  }
}

function calNotifiedKey(todayStr, id) {
  return `${LS_CAL_PREFIX}${todayStr}_${id}`;
}

function tFor(settings) {
  return TRANSLATIONS[settings.lang] || TRANSLATIONS.en;
}

async function maybeNotifyHabits(settings) {
  if (!settings.nativeNotifyHabits) {
    return;
  }
  const hour = Math.max(0, Math.min(23, parseInt(String(settings.nativeNotifyHabitsHour ?? 9), 10) || 9));
  const todayStr = todayKeyInTz();
  const mins = nowMinutesInTz();
  if (Math.floor(mins / 60) !== hour || mins % 60 > 5) {
    return;
  }
  if (localStorage.getItem(LS_HABIT_DAY) === todayStr) {
    return;
  }
  const { n, names } = countOpenHabits(todayStr);
  if (n === 0) {
    localStorage.setItem(LS_HABIT_DAY, todayStr);
    return;
  }
  const t = tFor(settings);
  const preview = names.length ? names.join(', ') : String(n);
  const body =
    n === 1
      ? (t.nativeNotifyHabitsBodyOne || '1 habit still open: {names}').replace('{names}', preview)
      : (t.nativeNotifyHabitsBodyMany || '{n} habits still open — e.g. {names}')
        .replace('{n}', String(n))
        .replace('{names}', preview + (n > names.length ? '…' : ''));
  const title = t.nativeNotifyHabitsTitle || 'Cultiva';
  const r = await window.electron.showNativeNotification({ title, body });
  if (r && r.ok) {
    localStorage.setItem(LS_HABIT_DAY, todayStr);
  }
}

async function maybeNotifyCalendar(settings) {
  if (!settings.nativeNotifyCalendar) {
    return;
  }
  const lead = Math.max(5, Math.min(120, parseInt(String(settings.nativeNotifyCalendarLeadMinutes ?? 30), 10) || 30));
  const todayStr = todayKeyInTz();
  const nowM = nowMinutesInTz();
  const list = loadCalendarToday(todayStr);
  const t = tFor(settings);
  for (const ev of list) {
    if (!ev || !ev.id || !ev.title) {
      continue;
    }
    const startM = parseHM(ev.start);
    if (startM === null) {
      continue;
    }
    const delta = startM - nowM;
    if (delta < 0 || delta > lead) {
      continue;
    }
    const key = calNotifiedKey(todayStr, ev.id);
    if (localStorage.getItem(key)) {
      continue;
    }
    const body = (t.nativeNotifyCalendarBody || '{title} — {time}')
      .replace('{title}', String(ev.title))
      .replace('{time}', String(ev.start));
    const title = t.nativeNotifyCalendarTitle || 'Cultiva · Calendar';
    const r = await window.electron.showNativeNotification({ title, body });
    if (r && r.ok) {
      localStorage.setItem(key, '1');
    }
  }
}

/**
 * @param {() => object} getSettings
 * @returns {() => void} disposer
 */
export function initNativeNotificationsScheduler(getSettings) {
  if (typeof window === 'undefined' || !window.electron?.showNativeNotification) {
    return () => {};
  }
  const tick = () => {
    const s = getSettings();
    if (!s || s.nativeNotifyEnabled === false) {
      return;
    }
    Promise.all([maybeNotifyHabits(s), maybeNotifyCalendar(s)]).catch(() => {});
  };
  const id = setInterval(tick, 60 * 1000);
  setTimeout(tick, 5000);
  return () => clearInterval(id);
}
