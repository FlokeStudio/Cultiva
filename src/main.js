import { auth } from './modules/auth.js'; 
import { TRANSLATIONS } from './core/i18n.js';
import './styles/main.css';
import { GROWTH_STAGES, LEGACY_THRESHOLD, MAX_ACTIVE_HABITS } from './core/config.js';
import { storage } from './modules/storage.js';
import { BRANDING } from './core/branding.js';
import { habits } from './modules/habits.js';
import { renderPluginsSection, renderPluginHeaderItems } from './app/plugins-ui.js';
import { initNativeNotificationsScheduler } from './core/native-notifications.js';
import { getCultivaTimezone } from './core/timezone.js';
import {
  applyAmbientBackground,
  saveCustomBackgroundFromFile,
  clearCustomBackground,
  readCustomBackgroundDataUrl
} from './core/ambient-bg.js';
import { settings, ensureAppReady } from './app/renderer-bootstrap.js';
import { getTodayStr } from './app/date-ui.js';
import {
  configureModals,
  openModal,
  closeModal,
  openQuantityLogModal,
  completeQuantityLogWithValue
} from './app/modals.js';
import { applyBranding, showNotification } from './app/ui-shell.js';
import { applyTranslations } from './app/i18n-dom.js';
import {
  configureSettingsController,
  loadSettings,
  saveSettings,
  applySettings,
  updateNotificationsDesktopBanner
} from './app/settings-controller.js';

let currentLang = 'en';
let currentT = TRANSLATIONS.en;

/* ============================================ */
/* DOM ELEMENTS                                 */
/* ============================================ */
const gardenEl = document.getElementById('garden-container');
const trophyEl = document.getElementById('trophy-container');
const countEl = document.getElementById('habit-count');
const trophyCountEl = document.getElementById('trophy-count');
const addModal = document.getElementById('add-modal');
const statsModal = document.getElementById('stats-modal');
const settingsModal = document.getElementById('settings-modal');
const habitForm = document.getElementById('habit-form');
const targetContainer = document.getElementById('target-container');
const loadingScreen = document.getElementById('loading-screen');
const userMenuBtn = document.getElementById('user-menu-btn');
const userDropdown = document.getElementById('user-dropdown');
const langSelect = document.getElementById('lang-select');
const themeSelect = document.getElementById('theme-select');
const trophyToggle = document.getElementById('toggle-trophies');
const focusToggle = document.getElementById('toggle-focus');
const quantityLogModal = document.getElementById('quantity-log-modal');
const quantityLogInput = document.getElementById('quantity-log-input');
const quantityLogTitle = document.getElementById('quantity-log-title');
const quantityLogDesc = document.getElementById('quantity-log-desc');
const quantityLogLabel = document.getElementById('quantity-log-label');

configureModals({
  quantityLogModal,
  quantityLogInput,
  quantityLogTitle,
  quantityLogDesc,
  quantityLogLabel
});

configureSettingsController({
  langSelect,
  themeSelect,
  trophyToggle,
  focusToggle,
  setLangAndT(lang) {
    currentLang = lang;
    currentT = TRANSLATIONS[lang] || TRANSLATIONS.en;
  },
  renderHeaderAvatar,
  renderGarden
});

/* ============================================ */
/* AVATAR DATA                                  */
/* ============================================ */
const AVATAR_DATA = {
  backgrounds: [
    { id: 'none', name: 'None', css: 'var(--bg-tertiary)' },
    { id: 'solid-black', css: '#000000' },
    { id: 'solid-white', css: '#ffffff' },
    { id: 'solid-grey', css: '#8e8e93' },
    { id: 'sunset-1', css: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
    { id: 'sunset-2', css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
    { id: 'sunset-3', css: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { id: 'sunset-4', css: 'linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)' },
    { id: 'sunset-5', css: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)' },
    { id: 'ocean-1', css: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
    { id: 'ocean-2', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { id: 'ocean-3', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'ocean-4', css: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
    { id: 'ocean-5', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { id: 'nature-1', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
    { id: 'nature-2', css: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { id: 'nature-3', css: 'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)' },
    { id: 'nature-4', css: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)' },
    { id: 'nature-5', css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
    { id: 'dark-1', css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
    { id: 'dark-2', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
    { id: 'dark-3', css: 'linear-gradient(135deg, #000000 0%, #434343 100%)' },
    { id: 'neon-1', css: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
    { id: 'neon-2', css: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)' },
    { id: 'pastel-1', css: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)' },
    { id: 'pastel-2', css: 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)' },
    { id: 'pastel-3', css: 'linear-gradient(135deg, #c1dfc4 0%, #deecdd 100%)' },
    { id: 'pastel-4', css: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
    { id: 'pastel-5', css: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' },
    { id: 'gold-1', css: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' },
    { id: 'gold-2', css: 'linear-gradient(135deg, #e6b980 0%, #eacda3 100%)' },
    { id: 'slate-1', css: 'linear-gradient(135deg, #667db6 0%, #0082c8 50%, #667db6 100%)' }
  ],
  emojis: [
    '🌱', '🌿', '🍀', '😊', '😋', '😶‍🌫️', '🌴', '🌵', '🌾', '🤪', '🌸', '🌺', '🌷', '🥳', '🍄', '🍉', '🍋', '👻', '🍏', '🍑',
    '🦊', '🐶', '🐼', '🐨', '🐯', '🐵', '🐝', '🐋',
    '⚽', '🎮', '💻', '⌨️', '📷', '🎸', '🧑‍🚀', '🧘', '🧠', '💡', '⏰', '👾', '🚀', '🛸', '🌍', '🧊', '💍', '🎁',
    '✨', '⭐', '🌟', '🌙', '☀️', '🌊', '⚡', '🔥', '💫', '🥇', '🍃', '☮️', '🕊️',
    '😎', '🤠', '🧐', '🤓', '😴', '👽', '💀', '👻', '😈', '🤡', '👹', '🫢',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '❤️‍🔥'
  ]
};

let tempAvatar = { ...settings.avatar };

/* ============================================ */
/* SETTINGS EVENTS                              */
/* ============================================ */

langSelect?.addEventListener('change', (e) => { settings.lang = e.target.value; saveSettings(); });
themeSelect?.addEventListener('change', (e) => { settings.theme = e.target.value; saveSettings(); });
trophyToggle?.addEventListener('change', (e) => { settings.showTrophies = e.target.checked; saveSettings(); });
focusToggle?.addEventListener('change', (e) => { settings.focusMode = e.target.checked; saveSettings(); });

/* ============================================ */
/* TIMEZONE SETTING                             */
/* ============================================ */

const tzSelect = document.getElementById('tz-select');
if (tzSelect) {
  tzSelect.value = localStorage.getItem('cultiva-timezone') || 'auto';
  tzSelect.addEventListener('change', (e) => {
    localStorage.setItem('cultiva-timezone', e.target.value);
    if (typeof renderGarden === 'function') { renderGarden(); } 
  });
}

const timeFormatSelect = document.getElementById('time-format-select');
if (timeFormatSelect) {
  timeFormatSelect.value = localStorage.getItem('cultiva-time-format') || 'auto';
  timeFormatSelect.addEventListener('change', (e) => {
    localStorage.setItem('cultiva-time-format', e.target.value);
  });
}

const nativeHabitsHourSelect = document.getElementById('native-notify-habits-hour');
if (nativeHabitsHourSelect && nativeHabitsHourSelect.options.length === 0) {
  for (let h = 0; h < 24; h += 1) {
    const o = document.createElement('option');
    o.value = String(h);
    o.textContent = `${String(h).padStart(2, '0')}:00`;
    nativeHabitsHourSelect.appendChild(o);
  }
}

document.getElementById('toggle-native-notify-habits')?.addEventListener('change', (e) => {
  settings.nativeNotifyHabits = e.target.checked;
  saveSettings();
});
nativeHabitsHourSelect?.addEventListener('change', (e) => {
  const h = parseInt(e.target.value, 10);
  settings.nativeNotifyHabitsHour = Number.isNaN(h) ? 9 : Math.max(0, Math.min(23, h));
  saveSettings();
});
document.getElementById('toggle-native-notify-calendar')?.addEventListener('change', (e) => {
  settings.nativeNotifyCalendar = e.target.checked;
  saveSettings();
});
document.getElementById('native-notify-calendar-lead')?.addEventListener('change', (e) => {
  const m = parseInt(e.target.value, 10);
  settings.nativeNotifyCalendarLeadMinutes = Number.isNaN(m) ? 30 : Math.max(5, Math.min(120, m));
  saveSettings();
});
document.getElementById('toggle-native-notify-master')?.addEventListener('change', (e) => {
  settings.nativeNotifyEnabled = e.target.checked;
  saveSettings();
});

function updateCultivaDatePreview() {
  const preview = document.getElementById('cultiva-date-preview');
  if (!preview) { return; }
    
  const tz = getCultivaTimezone();
  const now = new Date();
  const formatted = new Intl.DateTimeFormat(navigator.language, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: tz
  }).format(now);
    
  preview.textContent = formatted + (tz ? ` (${tz})` : ' (System)');
}

if (tzSelect) {
  tzSelect.addEventListener('change', () => {
    localStorage.setItem('cultiva-timezone', tzSelect.value);
    updateCultivaDatePreview();
    if (typeof renderGarden === 'function') { renderGarden(); }
  });
}

/* ============================================ */
/* BACKGROUND LOGIC                             */
/* ============================================ */

const bgSelect = document.getElementById('bg-select');
const customBgInput = document.getElementById('custom-bg-input');
const customBgChoose = document.getElementById('custom-bg-choose');
const customBgClear = document.getElementById('custom-bg-clear');

let lastBgSelectValue = 'none';
let pendingCustomPicker = false;

function commitBackground(bg) {
  lastBgSelectValue = bg;
  try {
    localStorage.setItem('cultiva-background', bg);
  } catch (e) {
    console.warn('[Background] Could not persist selection', e);
  }
  applyBackground(bg);
}

function applyBackground(bg) {
  let choice = bg;
  if (choice === 'custom' && !readCustomBackgroundDataUrl()) {
    choice = 'none';
  }
  applyAmbientBackground(document, document.body, choice);
}

let savedBg = localStorage.getItem('cultiva-background') || 'none';
if (savedBg === 'custom' && !readCustomBackgroundDataUrl()) {
  savedBg = 'none';
  localStorage.setItem('cultiva-background', 'none');
}
lastBgSelectValue = savedBg;
if (bgSelect) { bgSelect.value = savedBg; }
applyBackground(savedBg);

bgSelect?.addEventListener('change', (e) => {
  const bg = e.target.value;
  if (bg === 'custom' && !readCustomBackgroundDataUrl()) {
    pendingCustomPicker = true;
    customBgInput?.click();
    return;
  }
  commitBackground(bg);
});

customBgChoose?.addEventListener('click', () => {
  customBgInput?.click();
});

customBgInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) {
    if (pendingCustomPicker) {
      if (bgSelect) { bgSelect.value = lastBgSelectValue; }
      pendingCustomPicker = false;
    }
    return;
  }
  try {
    await saveCustomBackgroundFromFile(file);
    pendingCustomPicker = false;
    if (bgSelect) { bgSelect.value = 'custom'; }
    commitBackground('custom');
  } catch (err) {
    const msg = err && err.message ? err.message : 'Could not use image';
    showNotification('', msg);
    if (pendingCustomPicker) {
      if (bgSelect) { bgSelect.value = lastBgSelectValue; }
      pendingCustomPicker = false;
    }
  }
});

customBgClear?.addEventListener('click', () => {
  clearCustomBackground();
  if (bgSelect?.value === 'custom') {
    if (bgSelect) { bgSelect.value = 'none'; }
    commitBackground('none');
    return;
  }
  applyBackground(bgSelect?.value || lastBgSelectValue);
});

/* ============================================ */
/* SETTINGS NAVIGATION                          */
/* ============================================ */

function initSettingsNavigation() {
  const sidebarItems = document.querySelectorAll('.settings-sidebar-item[data-section]');
  const emptyState = document.getElementById('settings-empty');
    
  if (!sidebarItems.length) { return; }
    
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
            
      if (item.classList.contains('settings-sidebar-disabled')) {
        showNotification(currentT.comingSoon || 'Coming soon...');
        return;
      }
            
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
            
      if (emptyState) { emptyState.style.display = 'none'; }
            
      document.querySelectorAll('.settings-section-content').forEach(content => {
        content.classList.remove('active');
      });
            
      const targetSection = document.getElementById(`section-${section}`);
      if (targetSection) { targetSection.classList.add('active'); }
            
      if (section === 'profile') { updateProfileSection(); }
      if (section === 'plugins') { renderPluginsSection(); }
      if (section === 'notifications') { updateNotificationsDesktopBanner(); }
    });
  });
    
  document.getElementById('settings-open-avatar-picker')?.addEventListener('click', () => {
    closeModal(settingsModal);
    setTimeout(() => openModal(document.getElementById('avatar-modal')), 300);
  });

  document.querySelector('[data-section="updates"]')?.addEventListener('click', () => {
    updateUpdatesSection();
  });
    
  document.getElementById('close-settings')?.addEventListener('click', () => {
    setTimeout(() => {
      const firstItem = document.querySelector('.settings-sidebar-item[data-section="profile"]');
      if (firstItem) {
        sidebarItems.forEach(i => i.classList.remove('active'));
        firstItem.classList.add('active');
                
        document.querySelectorAll('.settings-section-content').forEach(c => c.classList.remove('active'));
        document.getElementById('section-profile')?.classList.add('active');
                
        if (emptyState) { emptyState.style.display = 'none'; }
      }
    }, 300);
  });
    
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal?.classList.contains('active')) {
      document.getElementById('close-settings')?.click();
    }
  });
}

/* ============================================ */
/* PROFILE MANAGEMENT                           */
/* ============================================ */

function updateProfileSection() {
  const isLoggedIn = auth.isAuthenticated();
  const user = auth.getCurrentUser();
  const t = currentT;
    
  const avatarEmoji = document.getElementById('settings-avatar-emoji');
  const avatarImg = document.getElementById('settings-avatar-img');
  const avatarContainer = document.getElementById('settings-profile-avatar');
    
  if (avatarContainer) {
    if (settings.avatar?.photo) {
      if (avatarImg) { avatarImg.src = settings.avatar.photo; avatarImg.style.display = 'block'; }
      if (avatarEmoji) { avatarEmoji.style.display = 'none'; }
      avatarContainer.style.background = 'transparent';
    } else {
      if (avatarImg) { avatarImg.style.display = 'none'; }
      if (avatarEmoji) { avatarEmoji.style.display = 'flex'; avatarEmoji.textContent = settings.avatar?.emoji || '🌱'; }
            
      const bg = AVATAR_DATA.backgrounds.find(b => b.id === settings.avatar?.background);
      avatarContainer.style.background = (bg && bg.id !== 'none') ? bg.css : 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))';
    }
  }
    
  const profileName = document.getElementById('settings-profile-name');
  const profileEmail = document.getElementById('settings-profile-email');
    
  if (isLoggedIn && user) {
    if (profileName) { profileName.textContent = user.name || user.email?.split('@')[0] || 'User'; }
    if (profileEmail) { profileEmail.textContent = user.email || ''; }
  } else {
    if (profileName) { profileName.textContent = t.guestUser || 'Guest User'; }
    if (profileEmail) { profileEmail.textContent = t.localStorage || 'Local Storage'; }
  }
    
  const accountStatus = document.getElementById('profile-account-status');
  const statusBadge = document.getElementById('profile-status-badge');
    
  if (isLoggedIn) {
    if (accountStatus) { accountStatus.textContent = t.accountActive || 'Account Active'; }
    if (statusBadge) { statusBadge.textContent = t.active || 'Active'; statusBadge.classList.add('online'); }
  } else {
    if (accountStatus) { accountStatus.textContent = t.localStorageMode || 'Local Storage Mode'; }
    if (statusBadge) { statusBadge.textContent = t.guest || 'Guest'; statusBadge.classList.remove('online'); }
  }
    
  const editProfileBtn = document.getElementById('settings-edit-profile');
  if (editProfileBtn) { editProfileBtn.style.display = isLoggedIn ? 'flex' : 'none'; }
    
  const memberSinceRow = document.getElementById('profile-member-since');
  const memberDate = document.getElementById('profile-member-date');
    
  if (isLoggedIn && user?.createdAt) {
    if (memberSinceRow) { memberSinceRow.style.display = 'flex'; }
    if (memberDate) {
      const date = new Date(user.createdAt);
      memberDate.textContent = date.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } else {
    if (memberSinceRow) { memberSinceRow.style.display = 'none'; }
  }
}

const editProfileModal = document.getElementById('edit-profile-modal');
const editProfileForm = document.getElementById('edit-profile-form');
const editProfileError = document.getElementById('edit-profile-error');

function initProfileManagement() {
  document.getElementById('settings-edit-profile')?.addEventListener('click', () => {
    const user = auth.getCurrentUser();
    if (!user) { return; }
        
    document.getElementById('edit-display-name').value = user.name || '';
    document.getElementById('edit-email').value = user.email || '';
    document.getElementById('edit-dob').value = user.dob || '';
    document.getElementById('edit-new-password').value = '';
    document.getElementById('edit-confirm-password').value = '';
    if (editProfileError) { editProfileError.style.display = 'none'; }
        
    closeModal(settingsModal);
    setTimeout(() => openModal(editProfileModal), 300);
  });
    
  document.getElementById('edit-profile-cancel')?.addEventListener('click', () => {
    closeModal(editProfileModal);
    setTimeout(() => openModal(settingsModal), 300);
  });
    
  editProfileModal?.querySelector('.modal-close')?.addEventListener('click', () => {
    closeModal(editProfileModal);
    setTimeout(() => openModal(settingsModal), 300);
  });
    
  editProfileModal?.querySelector('.modal-overlay')?.addEventListener('click', () => {
    closeModal(editProfileModal);
    setTimeout(() => openModal(settingsModal), 300);
  });
    
  editProfileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editProfileError) { editProfileError.style.display = 'none'; }
        
    const displayName = document.getElementById('edit-display-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const dob = document.getElementById('edit-dob').value;
    const newPassword = document.getElementById('edit-new-password').value;
    const confirmPassword = document.getElementById('edit-confirm-password').value;
        
    if (!displayName) { editProfileError.textContent = currentT.nameRequired || 'Display name is required'; editProfileError.style.display = 'block'; return; }
    if (!email) { editProfileError.textContent = currentT.emailRequired || 'Email is required'; editProfileError.style.display = 'block'; return; }
    if (newPassword && newPassword !== confirmPassword) { editProfileError.textContent = currentT.passwordsMismatch || 'Passwords do not match'; editProfileError.style.display = 'block'; return; }
    if (newPassword && newPassword.length < 6) { editProfileError.textContent = currentT.passwordTooShort || 'Password must be at least 6 characters'; editProfileError.style.display = 'block'; return; }
        
    try {
      const updates = { name: displayName, email: email, dob: dob || null };
      if (newPassword) { updates.password = newPassword; }
            
      await auth.updateProfile(updates);
      await updateAuthUI();
      updateProfileSection();
            
      closeModal(editProfileModal);
      setTimeout(() => openModal(settingsModal), 300);
            
      showNotification(currentT.profileUpdated || 'Profile updated successfully');
    } catch (err) {
      if (editProfileError) { editProfileError.textContent = err.message || 'Failed to update profile'; editProfileError.style.display = 'block'; }
    }
  });
    
  document.getElementById('sign-out-from-profile')?.addEventListener('click', async () => {
    if (confirm(currentT.confirmSignOut || 'Sign out of your account?')) {
      await auth.logout();
      await updateAuthUI();
      updateProfileSection();
      renderGarden();
      closeModal(editProfileModal);
      showNotification(currentT.signedOut || 'Signed out successfully');
    }
  });
}

/* ============================================ */
/* USER MENU                                    */
/* ============================================ */

function toggleUserMenu() {
  const isActive = userDropdown.classList.toggle('active');
  userMenuBtn.setAttribute('aria-expanded', isActive);
}

function closeUserMenu() {
  userDropdown.classList.remove('active');
  userMenuBtn.setAttribute('aria-expanded', 'false');
}

userMenuBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleUserMenu(); });
document.addEventListener('click', (e) => {
  if (userDropdown && !userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) { closeUserMenu(); }
});
document.getElementById('open-settings')?.addEventListener('click', () => { openModal(settingsModal); closeUserMenu(); });

/* ============================================ */
/* AVATAR LOGIC                                 */
/* ============================================ */

function renderHeaderAvatar() {
  const headerAvatar = document.getElementById('header-avatar');
  const headerEmoji = document.getElementById('header-avatar-emoji');
  if (!headerAvatar) { return; }
  const existingImg = headerAvatar.querySelector('img');
  if (existingImg) { existingImg.remove(); }
  if (settings.avatar.photo) {
    const img = document.createElement('img');
    img.src = settings.avatar.photo;
    img.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:50%;';
    headerAvatar.appendChild(img);
    headerAvatar.classList.add('has-photo');
    if (headerEmoji) { headerEmoji.style.display = 'none'; }
    headerAvatar.style.backgroundImage = 'none';
    headerAvatar.style.backgroundColor = 'transparent';
    return;
  }
  headerAvatar.classList.remove('has-photo');
  if (headerEmoji) { headerEmoji.style.display = ''; }
  const bg = AVATAR_DATA.backgrounds.find(b => b.id === settings.avatar.background);
  if (bg && bg.id !== 'none') {
    headerAvatar.style.backgroundImage = bg.css;
    headerAvatar.style.backgroundColor = 'transparent';
  } else {
    headerAvatar.style.backgroundImage = 'none';
    headerAvatar.style.backgroundColor = 'var(--bg-tertiary)';
  }
  if (headerEmoji) { headerEmoji.textContent = settings.avatar.emoji; }
}

function renderAvatarPicker() {
  const bgGrid = document.getElementById('avatar-bg-grid');
  const emojiGrid = document.getElementById('avatar-emoji-grid');
  const preview = document.getElementById('avatar-preview');
  const previewEmoji = document.getElementById('preview-emoji');
  const previewImage = document.getElementById('preview-image');
  const clearPhotoBtn = document.getElementById('avatar-clear-photo');
  if (!bgGrid || !emojiGrid) { return; }
  if (tempAvatar.photo) {
    preview.classList.add('has-photo');
    previewImage.src = tempAvatar.photo;
    previewImage.style.display = 'block';
    previewEmoji.style.display = 'none';
    if (clearPhotoBtn) { clearPhotoBtn.style.display = 'inline-block'; }
  } else {
    preview.classList.remove('has-photo');
    if (previewImage) { previewImage.style.display = 'none'; }
    if (previewEmoji) { previewEmoji.style.display = ''; }
    if (clearPhotoBtn) { clearPhotoBtn.style.display = 'none'; }
    const bg = AVATAR_DATA.backgrounds.find(b => b.id === tempAvatar.background);
    if (bg && bg.id !== 'none') {
      preview.style.backgroundImage = bg.css;
      preview.style.backgroundColor = 'transparent';
    } else {
      preview.style.backgroundImage = 'none';
      preview.style.backgroundColor = 'var(--bg-tertiary)';
    }
    if (previewEmoji) { previewEmoji.textContent = tempAvatar.emoji; }
  }
  bgGrid.innerHTML = AVATAR_DATA.backgrounds.map(bg => `
        <button class="avatar-option ${tempAvatar.background === bg.id && !tempAvatar.photo ? 'selected' : ''} ${bg.id === 'none' ? 'bg-none' : ''}" 
                data-bg="${bg.id}" style="${bg.id !== 'none' ? `background: ${bg.css};` : ''}" title="${bg.name || bg.id}"></button>
    `).join('');
  emojiGrid.innerHTML = AVATAR_DATA.emojis.map(emoji => `
        <button class="avatar-option ${tempAvatar.emoji === emoji && !tempAvatar.photo ? 'selected' : ''}" data-emoji="${emoji}">${emoji}</button>
    `).join('');
}

function initAvatarPicker() {
  const modal = document.getElementById('avatar-modal');
  const openBtn = document.getElementById('open-avatar-picker');
  const saveBtn = document.getElementById('avatar-save');
  const resetBtn = document.getElementById('avatar-reset');
  const uploadInput = document.getElementById('avatar-upload');
  const clearPhotoBtn = document.getElementById('avatar-clear-photo');

  if (!modal || !openBtn) { return; }

  openBtn.addEventListener('click', () => {
    tempAvatar = { ...settings.avatar };
    renderAvatarPicker();
    openModal(modal);
    closeUserMenu();
  });

  modal.addEventListener('click', (e) => {
    const bgBtn = e.target.closest('[data-bg]');
    const emojiBtn = e.target.closest('[data-emoji]');
    if (bgBtn) { tempAvatar.background = bgBtn.dataset.bg; tempAvatar.photo = null; renderAvatarPicker(); }
    if (emojiBtn) { tempAvatar.emoji = emojiBtn.dataset.emoji; tempAvatar.photo = null; renderAvatarPicker(); }
  });

  uploadInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) { return; }
    if (file.size > 2 * 1024 * 1024) { alert('Image is too large. Max 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { tempAvatar.photo = ev.target.result; tempAvatar.background = 'none'; renderAvatarPicker(); };
    reader.readAsDataURL(file);
  });

  clearPhotoBtn?.addEventListener('click', () => {
    tempAvatar.photo = null; tempAvatar.background = 'green';
    uploadInput.value = '';
    renderAvatarPicker();
  });

  saveBtn?.addEventListener('click', async () => {
    const newAvatar = { 
      background: tempAvatar.background, 
      emoji: tempAvatar.emoji,
      photo: tempAvatar.photo || null 
    };
        
    if (await auth.isAuthenticated()) {
      await auth.updateProfile({ avatar: newAvatar });
    } else {
      settings.avatar = newAvatar;
      storage.set('cultiva-settings', settings);
    }
        
    settings.avatar = newAvatar;
    applySettings();
    closeModal(modal);
    showNotification('Avatar updated!');
  });

  resetBtn?.addEventListener('click', () => {
    tempAvatar = { background: 'green', emoji: '🌱', photo: null };
    uploadInput.value = '';
    renderAvatarPicker();
  });

  modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal));
  modal.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(modal));
}

/* ============================================ */
/* RENDER                                       */
/* ============================================ */

function createHabitCard(habit, isTrophy = false) {
  const stage = isTrophy ? GROWTH_STAGES.LEGACY : habits.getStage(habit.progress);
  const today = getTodayStr();
  const isCompleted = habit.trackType === 'binary' 
    ? habit.lastCompleted === today 
    : habits.quantityDayProgress(habit, today) >= habits.quantityTarget(habit);
    
  let progressBar = '';
  if (habit.trackType === 'quantity') {
    const cur = habits.quantityDayProgress(habit, today);
    const tgt = habits.quantityTarget(habit);
    const pct = Math.min(100, (cur / tgt) * 100);
    progressBar = `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  }
    
  const t = TRANSLATIONS[settings.lang];
  const categoryName = habit.category ? (t.categories?.[habit.category] || habit.category) : '';
  const categoryBadge = categoryName ? `<span class="category-badge" data-i18n-category="${habit.category}">${categoryName}</span>` : '';
  const streakText = habit.currentStreak > 0 ? ` • 🔥 ${habit.currentStreak}` : '';
    
  const card = document.createElement('article');
  card.className = 'habit-card';
  card.dataset.id = habit.id;
  card.dataset.category = habit.category || 'none';
  card.innerHTML = `
        <div class="card-header">
            <div class="plant-visual">${stage.emoji}</div>
            <div class="card-info">
                <div class="card-title">${habit.treeName || habit.name}</div>
                ${habit.description ? `<div class="card-description">${habit.description}</div>` : ''}
                <div class="card-subtitle">${stage.name} • ${habit.progress}d${streakText}</div>
                ${categoryBadge}
            </div>
        </div>
        ${progressBar}
        <div class="card-actions">
            <button class="btn-card btn-card-primary${isCompleted ? ' completed' : ''}">${isCompleted ? (t.done || 'Done') : (habit.trackType === 'quantity' ? (t.log || 'Log') : (t.complete || 'Complete'))}</button>
            <button class="btn-card btn-card-danger">✕</button>
        </div>
    `;
  return card;
}

function renderGarden() {
  const all = habits.getAll();
  const active = all.filter(h => h.progress < LEGACY_THRESHOLD);
  const trophies = all.filter(h => h.progress >= LEGACY_THRESHOLD);
  const t = TRANSLATIONS[settings.lang];
    
  if (gardenEl) {
    gardenEl.innerHTML = '';
    if (active.length === 0) {
      gardenEl.innerHTML = `<div class="empty-state"><p style="font-size:40px">🌱</p><p data-i18n="emptyGarden">${t.emptyGarden}</p><button class="btn-primary" id="add-first" style="width:auto;padding:10px 20px;margin-top:16px" data-i18n="plantFirst">${t.plantFirst}</button></div>`;
      document.getElementById('add-first')?.addEventListener('click', () => openModal(addModal));
    } else {
      active.forEach(h => gardenEl.appendChild(createHabitCard(h)));
    }
  }
  if (trophyEl) {
    trophyEl.innerHTML = '';
    trophies.forEach(h => trophyEl.appendChild(createHabitCard(h, true)));
  }
  if (countEl) { countEl.textContent = `${active.length}/${MAX_ACTIVE_HABITS}`; }
  if (trophyCountEl) { trophyCountEl.textContent = trophies.length; }
  applyTranslations(settings.lang);
}

function openStats(id) {
  const s = habits.getStats(id);
  if (!s) { return; }
  document.getElementById('stats-title').textContent = s.name;
  const t = TRANSLATIONS[settings.lang];
  document.getElementById('stats-content').innerHTML = `
        <div class="stat-card"><div class="stat-label">${t.currentStreak}</div><div class="stat-value">${s.currentStreak}</div><div class="stat-subvalue">${t.days}</div></div>
        <div class="stat-card"><div class="stat-label">${t.bestStreak}</div><div class="stat-value">${s.bestStreak}</div><div class="stat-subvalue">${t.days}</div></div>
        <div class="stat-card"><div class="stat-label">${t.completion}</div><div class="stat-value">${s.completionRate}%</div><div class="stat-subvalue">${s.totalDays} ${t.days}</div></div>
        <div class="stat-card"><div class="stat-label">${t.stage}</div><div class="stat-value">${s.stage.name}</div><div class="stat-subvalue">${habits.getAll().find(x => x.id === id)?.progress} ${s.trackType === 'quantity' ? t.completions : t.days}</div></div>
    `;
  const cal = document.getElementById('contribution-calendar');
  if (cal) {
    cal.innerHTML = '';
    habits.getCalendarData(id).forEach(d => {
      const el = document.createElement('div');
      el.className = 'calendar-day';
      el.style.background = `var(--calendar-${d.level})`;
      el.title = d.date;
      cal.appendChild(el);
    });
  }
  openModal(statsModal);
}

/* ============================================ */
/* EXPORT / IMPORT                              */
/* ============================================ */

function exportData() {
  const t = TRANSLATIONS[settings.lang];
  const data = { habits: habits.getAll(), exportedAt: new Date().toISOString(), version: BRANDING.VERSION };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${BRANDING.BACKUP_PREFIX}-${getTodayStr()}.json`;
  a.click(); URL.revokeObjectURL(url);
  showNotification(t.exported);    
}

function importData(file) {
  const t = TRANSLATIONS[settings.lang];
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.habits && Array.isArray(data.habits)) { storage.saveHabits(data.habits); resolve(true); }
        else { reject(new Error('Invalid format')); }
      } catch (err) { reject(err); }
    };
    reader.readAsText(file);
  }).then(() => { renderGarden(); showNotification(t.imported); })
    .catch(err => alert(err.message));
}

/* ============================================ */
/* UPDATES SECTION                              */
/* ============================================ */

const updateStatus = {
  state: 'checking',
  message: '',
  progress: 0,
  version: null
};

function updateUpdatesSection() {
  const isElectron = typeof window.electron !== 'undefined';
    
  const versionDisplay = document.getElementById('current-version-display');
  const codenameDisplay = document.getElementById('current-codename-display');
    
  if (versionDisplay) {
    versionDisplay.textContent = BRANDING?.VERSION || '0.0.0';
  }
  if (codenameDisplay) {
    codenameDisplay.textContent = BRANDING?.CODENAME || 'Sequoia';
  }
    
  if (!isElectron) {
    updateStatusCard('browser', 'Browser mode', 'Updates only available in desktop app');
    document.getElementById('check-updates-btn')?.setAttribute('disabled', 'disabled');
    return;
  }
    
  if (window.electron.onUpdateMessage) {
    window.electron.onUpdateMessage((message) => {
      console.log('[Updater]', message);
            
      if (message.includes('Checking for updates')) {
        updateStatusCard('checking', 'Checking...', message);
      } else if (message.includes('Update') && message.includes('found')) {
        const versionMatch = message.match(/(\d+\.\d+\.\d+)/);
        updateStatus.version = versionMatch ? versionMatch[1] : null;
        updateStatusCard('available', 'Update available', message);
      } else if (message.includes('Downloading')) {
        updateStatusCard('downloading', 'Downloading update', message);
      } else if (message.includes('Download progress')) {
        const percentMatch = message.match(/Downloaded (\d+)%/);
        if (percentMatch) {
          updateStatus.progress = parseInt(percentMatch[1]);
          updateDownloadProgress(updateStatus.progress, message);
        }
      } else if (message.includes('downloaded')) {
        updateStatusCard('downloaded', 'Update ready', message);
        document.getElementById('check-updates-btn').innerHTML = `
                    <span class="btn-icon">🔄</span>
                    <span>Restart to Update</span>
                `;
      } else if (message.includes('latest version')) {
        updateStatusCard('uptodate', 'Up to date', message);
      } else if (message.includes('error')) {
        updateStatusCard('error', 'Update error', message);
      } else {
        updateStatusCard('info', 'Update status', message);
      }
    });
  }
    
  fetchReleaseInfo();
    
  document.getElementById('check-updates-btn')?.addEventListener('click', () => {
    if (updateStatus.state === 'downloaded') {
      window.electron.restartApp?.();
    } else {
      window.electron.checkForUpdates?.();
      updateStatusCard('checking', 'Checking for updates...', 'Contacting GitHub...');
    }
  });
    
  document.getElementById('view-releases-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://github.com/krwg/Cultiva/releases', '_blank');
  });
}

function updateStatusCard(state, title, message) {
  updateStatus.state = state;
    
  const card = document.getElementById('update-status-card');
  const icon = document.getElementById('update-status-icon');
  const titleEl = document.getElementById('update-status-title');
  const messageEl = document.getElementById('update-status-message');
    
  if (card) {
    card.className = 'update-status-card ' + state;
  }
    
  if (icon) {
    const icons = {
      checking: '🔍',
      available: '⬇️',
      downloading: '⬇️',
      downloaded: '✅',
      uptodate: '✓',
      error: '❌',
      browser: '🌐'
    };
    icon.textContent = icons[state] || 'ℹ️';
  }
    
  if (titleEl) { titleEl.textContent = title; }
  if (messageEl) { messageEl.textContent = message; }
    
  const progressEl = document.getElementById('update-progress');
  if (progressEl) {
    progressEl.style.display = state === 'downloading' ? 'block' : 'none';
  }
}

function updateDownloadProgress(percent, _message) {
  const progressBar = document.getElementById('update-progress-bar');
  const progressText = document.getElementById('update-progress-text');
    
  if (progressBar) {
    progressBar.style.width = percent + '%';
  }
  if (progressText) {
    progressText.textContent = `Downloading... ${percent}%`;
  }
}

async function fetchReleaseInfo() {
  const releaseInfo = document.getElementById('release-info');
  if (!releaseInfo) { return; }

  const cached = localStorage.getItem('cultiva-releases-cache');
  const cacheTime = localStorage.getItem('cultiva-releases-cache-time');
    
  if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 3600000) {
    renderReleases(JSON.parse(cached));
    return;
  }
    
  try {
    const response = await fetch('https://api.github.com/repos/krwg/Cultiva/releases');
        
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
        
    const releases = await response.json();
        
    if (!Array.isArray(releases) || releases.length === 0) {
      releaseInfo.innerHTML = '<div class="release-loading">No releases found</div>';
      return;
    }
        
    localStorage.setItem('cultiva-releases-cache', JSON.stringify(releases));
    localStorage.setItem('cultiva-releases-cache-time', Date.now().toString());
        
    renderReleases(releases);
        
  } catch (error) {
    console.error('Failed to fetch releases:', error);
        
    if (cached) {
      renderReleases(JSON.parse(cached));
      return;
    }
        
    releaseInfo.innerHTML = `
            <div class="release-loading">
                Failed to load releases<br>
                <a href="#" onclick="window.open('https://github.com/krwg/Cultiva/releases', '_blank'); return false;" style="color: var(--accent-blue);">
                    View on GitHub →
                </a>
            </div>
        `;
  }
}

function renderReleases(releases) {
  const releaseInfo = document.getElementById('release-info');
  if (!releaseInfo) { return; }
    
  const latestReleases = releases.slice(0, 3);
    
  releaseInfo.innerHTML = latestReleases.map((release, index) => {
    const date = new Date(release.published_at).toLocaleDateString(
      currentLang === 'ru' ? 'ru-RU' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
        
    const isLatest = index === 0 && !release.prerelease;
    const badge = isLatest ? '<span class="release-badge latest">Latest</span>' :
      release.prerelease ? '<span class="release-badge prerelease">Pre-release</span>' : '';
        
    let body = release.body || 'No description';
    body = body.replace(/[#*`]/g, '').substring(0, 200);
        
    return `
            <div class="release-item">
                <div class="release-header">
                    <span class="release-tag">${release.name || release.tag_name}</span>
                    ${badge}
                    <span class="release-date">${date}</span>
                </div>
                <div class="release-body">
                    ${body}...
                </div>
                <button class="release-expand" onclick="window.open('${release.html_url}', '_blank')">
                    View on GitHub →
                </button>
            </div>
        `;
  }).join('');
}

/* ============================================ */
/* AUTH UI LOGIC                                */
/* ============================================ */

const authModal = document.getElementById('auth-modal');
const authTrigger = document.getElementById('auth-trigger');
const signOutBtn = document.getElementById('sign-out-btn');
const authError = document.getElementById('auth-error');

async function updateAuthUI() {
  const isLoggedIn = auth.isAuthenticated();
  const user = auth.getCurrentUser();
    
  const authTriggerEl = document.getElementById('auth-trigger');
  const signOutBtnEl = document.getElementById('sign-out-btn');
    
  if (authTriggerEl) { authTriggerEl.style.display = isLoggedIn ? 'none' : 'flex'; }
  if (signOutBtnEl) { signOutBtnEl.style.display = isLoggedIn ? 'flex' : 'none'; }
    
  const statusText = document.getElementById('user-status-text');
  if (statusText) { statusText.textContent = isLoggedIn ? 'Signed In' : 'Local Storage'; }
    
  let displayName = 'Guest';
  let dropdownDisplay = 'Guest User';
    
  if (isLoggedIn && user) {
    if (user.name && user.name.trim() !== '') { displayName = user.name; }
    else if (user.email) { displayName = user.email.split('@')[0]; }
    dropdownDisplay = user.email || 'User';
  }
    
  const headerName = document.getElementById('user-name-display');
  const dropdownName = document.getElementById('dropdown-user-name');
    
  if (headerName) { headerName.textContent = displayName; }
  if (dropdownName) { dropdownName.textContent = dropdownDisplay; }

  if (isLoggedIn && user?.avatar) {
    settings.avatar = { ...user.avatar };
  }
    
  const dropAvatarEmoji = document.getElementById('dropdown-avatar-emoji');
  const dropAvatarImg = document.getElementById('dropdown-avatar-img');
  const dropAvatarLarge = document.getElementById('dropdown-avatar-large');
    
  if (dropAvatarLarge && dropAvatarEmoji && dropAvatarImg) {
    if (settings.avatar?.photo) {
      dropAvatarImg.src = settings.avatar.photo;
      dropAvatarImg.style.display = 'block';
      dropAvatarEmoji.style.display = 'none';
      dropAvatarLarge.style.background = 'transparent';
    } else {
      dropAvatarImg.style.display = 'none';
      dropAvatarEmoji.style.display = 'flex';
      dropAvatarEmoji.textContent = settings.avatar?.emoji || '🌱';
      const bg = AVATAR_DATA.backgrounds.find(b => b.id === settings.avatar?.background);
      dropAvatarLarge.style.background = (bg && bg.id !== 'none') ? bg.css : 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))';
    }
  }
  if (isLoggedIn) { document.body.classList.add('authenticated'); }
  else { document.body.classList.remove('authenticated'); }

  renderHeaderAvatar();
  updateProfileSection();
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === `${tab}-form`));
  document.getElementById('auth-modal-title').textContent = tab === 'login' ? 'Sign In' : 'Sign Up';
  if (authError) { authError.style.display = 'none'; }
}

async function handleAuthSubmit(e, type) {
  e.preventDefault();
  if (authError) { authError.style.display = 'none'; }
    
  const emailInput = document.getElementById(type === 'login' ? 'login-email' : 'reg-email');
  const passInput = document.getElementById(type === 'login' ? 'login-password' : 'reg-password');
    
  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    if (authError) { authError.textContent = 'Email and password are required'; authError.style.display = 'block'; }
    return;
  }

  try {
    if (type === 'login') { await auth.login({ email, password }); }
    else {
      const nameInput = document.getElementById('reg-name');
      const dobInput = document.getElementById('reg-dob');
      await auth.register({
        email, password,
        name: nameInput ? nameInput.value.trim() : '',
        dob: dobInput ? dobInput.value : null
      });
    }
        
    await updateAuthUI();
    closeModal(authModal);
    showNotification(type === 'login' ? 'Welcome back!' : 'Account created!');
        
    emailInput.value = ''; passInput.value = '';
    const nameInput = document.getElementById('reg-name');
    const dobInput = document.getElementById('reg-dob');
    if (nameInput) { nameInput.value = ''; }
    if (dobInput) { dobInput.value = ''; }
  } catch (err) {
    if (authError) { authError.textContent = err.message; authError.style.display = 'block'; }
  }
}

/* ============================================ */
/* EVENTS INIT                                  */
/* ============================================ */

function initEvents() {
  document.getElementById('open-add-modal')?.addEventListener('click', () => openModal(addModal));
    
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target === btn || btn.classList.contains('modal-close')) {
        closeModal(addModal); closeModal(statsModal); closeModal(settingsModal); closeModal(authModal);
        closeModal(quantityLogModal);
      }
    });
  });
    
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (settings.focusMode) { toggleFocusMode(false); showNotification('Focus Mode Disabled'); }
      closeModal(addModal); closeModal(statsModal); closeModal(settingsModal); closeModal(authModal);
      closeModal(quantityLogModal);
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) {
        return;
      }
      e.preventDefault();
      openModal(addModal);
    }
  });
    
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !document.activeElement.matches('input, textarea')) {
      e.preventDefault();
      window.location.href = './pages/keyboard.html';
    }
  });

  document.querySelectorAll('input[name="track-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (targetContainer) { targetContainer.classList.toggle('visible', e.target.value === 'quantity'); }
    });
  });
    
  document.getElementById('quantity-log-save')?.addEventListener('click', () => {
    const t = TRANSLATIONS[settings.lang];
    const raw = quantityLogInput?.value;
    const parsed = Number(String(raw ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      showNotification(t.invalidQuantity || 'Enter a valid number (0 or greater)');
      return;
    }
    completeQuantityLogWithValue(parsed);
  });
  document.getElementById('quantity-log-cancel')?.addEventListener('click', () => {
    closeModal(quantityLogModal);
  });
  quantityLogInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('quantity-log-save')?.click();
    }
  });

  habitForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('habit-name')?.value.trim();
    if (!name) { return; }
    const trackType = document.querySelector('input[name="track-type"]:checked')?.value === 'quantity' ? 'quantity' : 'binary';
    try {
      habits.add({
        name,
        description: document.getElementById('habit-desc')?.value.trim() || '',
        category: document.getElementById('habit-category')?.value || '',
        trackType,
        target: trackType === 'quantity' ? parseInt(document.getElementById('habit-target')?.value) || 1 : 1,
        unit: trackType === 'quantity' ? document.getElementById('habit-unit')?.value.trim() || '' : ''
      });
      habitForm.reset();
      if (targetContainer) { targetContainer.classList.remove('visible'); }
      document.querySelector('input[name="track-type"][value="binary"]').checked = true;
      closeModal(addModal); renderGarden();
      showNotification(TRANSLATIONS[settings.lang].habitPlanted);
    } catch (err) { alert(err.message); }
  });
    
  const handleCardClick = (e) => {
    const card = e.target.closest('.habit-card');
    if (!card) { return; }
    const id = card.dataset.id;
    if (e.target.closest('.btn-card-primary')) {
      e.stopPropagation();
      const h = habits.getAll().find(x => x.id === id);
      if (!h) { return; }
            
      const today = getTodayStr();
      const isCompleted = h.trackType === 'binary' 
        ? h.lastCompleted === today 
        : habits.quantityDayProgress(h, today) >= habits.quantityTarget(h);
                
      if (isCompleted) { return; }
            
      if (h.trackType === 'quantity') {
        const cur = habits.quantityDayProgress(h, today);
        const t = TRANSLATIONS[settings.lang];
        openQuantityLogModal(h, cur, t).then((parsed) => {
          if (parsed === null) { return; }
          if (!Number.isFinite(parsed) || parsed < 0) {
            showNotification(t.invalidQuantity || 'Enter a valid number (0 or greater)');
            return;
          }
          habits.toggle(id, parsed);
          renderGarden();
          const c = document.querySelector(`.habit-card[data-id="${id}"]`);
          c?.querySelector('.plant-visual')?.classList.add('growing');
          setTimeout(() => c?.querySelector('.plant-visual')?.classList.remove('growing'), 250);
          showNotification(TRANSLATIONS[settings.lang].progressSaved);
        });
        return;
      }
      habits.toggle(id);
            
      renderGarden();
      card.querySelector('.plant-visual')?.classList.add('growing');
      setTimeout(() => card.querySelector('.plant-visual')?.classList.remove('growing'), 250);
      showNotification(TRANSLATIONS[settings.lang].progressSaved);
    } else if (e.target.closest('.btn-card-danger')) {
      e.stopPropagation();
      if (confirm('Remove habit?')) { habits.remove(id); renderGarden(); showNotification(TRANSLATIONS[settings.lang].removed); }
    } else { openStats(id); }
  };
    
  gardenEl?.addEventListener('click', handleCardClick);
  trophyEl?.addEventListener('click', handleCardClick);
    
  document.getElementById('close-settings')?.addEventListener('click', () => closeModal(settingsModal));
  document.getElementById('close-stats')?.addEventListener('click', () => closeModal(statsModal));
  document.getElementById('settings-export')?.addEventListener('click', exportData);
  document.getElementById('settings-import')?.addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => { if (e.target.files?.[0]) { importData(e.target.files[0]); } };
    input.click();
  });
  document.getElementById('settings-reset')?.addEventListener('click', () => {
    const t = TRANSLATIONS[settings.lang];
    if (confirm(t.reset + '?') && confirm('Are you absolutely sure?')) { storage.saveHabits([]); renderGarden(); showNotification(t.resetDone); }
  });

  authTrigger?.addEventListener('click', () => { openModal(authModal); closeUserMenu(); });
  signOutBtn?.addEventListener('click', async () => { 
    await auth.logout(); await updateAuthUI(); renderGarden(); closeUserMenu(); showNotification('Signed out'); 
  });
  authModal?.querySelector('.modal-close')?.addEventListener('click', () => closeModal(authModal));
  authModal?.querySelector('.modal-overlay')?.addEventListener('click', () => closeModal(authModal));
  document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab)));
  document.getElementById('login-form')?.addEventListener('submit', (e) => handleAuthSubmit(e, 'login'));
  document.getElementById('register-form')?.addEventListener('submit', (e) => handleAuthSubmit(e, 'register'));
}

/* ============================================ */
/* FOCUS MODE                                   */
/* ============================================ */

function toggleFocusMode(enabled) {
  settings.focusMode = enabled;
  document.body.classList.toggle('focus-mode', enabled);
  if (focusToggle) { focusToggle.checked = enabled; }
  storage.set('cultiva-settings', settings);
  renderGarden();
}

/* ============================================ */
/* DISCORD SETTINGS UI (DESKTOP ONLY)           */
/* ============================================ */

function initDiscordSettings() {
  const isElectron = typeof window.discord !== 'undefined';
  const discordSection = document.querySelector('[data-section="discord"]');
  const discordContent = document.getElementById('section-discord');
  
  if (!isElectron) {
    if (discordSection) { discordSection.style.display = 'none'; }
    if (discordContent) { discordContent.style.display = 'none'; }
    return;
  }
  
  const discordToggle = document.getElementById('toggle-discord');
  const discordStatusBadge = document.getElementById('discord-status-badge');
  const discordStatusText = document.getElementById('discord-status-text');
  const previewDetails = document.getElementById('discord-preview-details');
  const previewState = document.getElementById('discord-preview-state');
  const previewTime = document.getElementById('discord-preview-time');
  
  let sessionStartTime = null;
  
  const savedEnabled = localStorage.getItem('cultiva-discord-enabled') !== 'false';
  if (discordToggle) { discordToggle.checked = savedEnabled; }
  
  async function checkDiscordStatus() {
    if (!window.discord) { return; }
    try {
      const status = await window.discord.getStatus();
      const enabled = discordToggle?.checked || false;
      const t = currentT;
      
      if (status.connected && enabled) {
        discordStatusBadge.textContent = '●';
        discordStatusBadge.style.color = '#4caf50';
        discordStatusText.textContent = t.discordConnected || 'Connected';
        if (!sessionStartTime) { sessionStartTime = new Date(); }
      } else if (status.connected && !enabled) {
        discordStatusBadge.textContent = '○';
        discordStatusBadge.style.color = '#ff9500';
        discordStatusText.textContent = t.discordDisabled || 'Disabled';
        sessionStartTime = null;
      } else {
        discordStatusBadge.textContent = '○';
        discordStatusBadge.style.color = 'var(--text-tertiary)';
        discordStatusText.textContent = t.discordDisconnected || 'Disconnected';
        sessionStartTime = null;
      }
    } catch (err) {
      console.warn('[Discord] Status check failed:', err);
      discordStatusBadge.textContent = '○';
      discordStatusBadge.style.color = 'var(--text-tertiary)';
      discordStatusText.textContent = 'Unavailable';
      sessionStartTime = null;
    }
  }
  
  function updatePreviewTime() {
    if (!previewTime || !sessionStartTime) { return; }
    const elapsed = Math.floor((new Date() - sessionStartTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    if (hours > 0) { previewTime.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} elapsed`; }
    else { previewTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} elapsed`; }
  }
  
  function updatePreviewText(details, state) {
    if (previewDetails) { previewDetails.textContent = details || 'In the garden'; }
    if (previewState) { previewState.textContent = state || 'Growing habits'; }
  }
  
  function detectCurrentPage() {
    const url = window.location.href;
    if (url.includes('/calendar')) { return 'calendar'; }
    if (url.includes('/pages/')) { return 'pages'; }
    if (url.includes('settings')) { return 'settings'; }
    if (url.includes('stats')) { return 'stats'; }
    if (url.includes('trophy')) { return 'trophy'; }
    return 'garden';
  }
  
  if (discordToggle) {
    discordToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('cultiva-discord-enabled', enabled);
      
      if (window.discord) {
        if (enabled) {
          await window.discord.enable();
          sessionStartTime = new Date();
          const page = detectCurrentPage();
          const locale = settings.lang || 'en';
          await window.discord.updateActivity({ page, locale });
          updatePreviewText(getPageDetails(page, locale), getPageState(page, locale));
        } else {
          await window.discord.disable();
          sessionStartTime = null;
          updatePreviewText('Rich Presence', 'Disabled');
          if (previewTime) { previewTime.textContent = '--:--'; }
        }
        await checkDiscordStatus();
      }
    });
  }
  
  setInterval(() => {
    if (discordContent?.classList.contains('active')) {
      checkDiscordStatus();
      updatePreviewTime();
    }
  }, 2000);
  
  const discordSidebarItem = document.querySelector('[data-section="discord"]');
  if (discordSidebarItem) {
    discordSidebarItem.addEventListener('click', () => {
      checkDiscordStatus();
      if (discordToggle?.checked) {
        sessionStartTime = new Date();
        const page = detectCurrentPage();
        const locale = settings.lang || 'en';
        updatePreviewText(getPageDetails(page, locale), getPageState(page, locale));
      }
    });
  }
  
  window.updateDiscordPreview = updatePreviewText;
  window.checkDiscordStatus = checkDiscordStatus;
}

function getPageDetails(page, locale) {
  const strings = {
    en: { garden: 'In the garden', calendar: 'Planning habits', stats: 'Reviewing progress', settings: 'Customizing', trophy: 'Trophy Garden', focus: 'Focus Mode', pages: 'Exploring Cultiva' },
    ru: { garden: 'В саду', calendar: 'Планирует', stats: 'Анализирует', settings: 'Настраивает', trophy: 'Сад трофеев', focus: 'Режим фокуса', pages: 'Изучает Cultiva' }
  };
  return strings[locale]?.[page] || strings.en[page] || 'In the garden';
}

function getPageState(page, locale) {
  const strings = {
    en: { garden: 'Growing habits', calendar: 'Browsing calendar', stats: 'Checking statistics', settings: 'Adjusting settings', trophy: 'Admiring legacy trees', focus: 'Deep work session', pages: 'Reading documentation' },
    ru: { garden: 'Выращивает привычки', calendar: 'Смотрит календарь', stats: 'Проверяет статистику', settings: 'Меняет параметры', trophy: 'Любуется деревьями', focus: 'Глубокая работа', pages: 'Читает документацию' }
  };
  return strings[locale]?.[page] || strings.en[page] || 'Growing habits';
}


window.showNotification = showNotification;

/* ============================================ */
/* INITIALIZATION                               */
/* ============================================ */

const loadingTimeout = setTimeout(() => {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
    loadingScreen.innerHTML = '<div style="text-align:center; padding:20px;"><div style="font-size:40px; margin-bottom:16px;">⏳</div><p style="font-size:16px; color:var(--text-primary);">Loading taking longer than expected...</p><button onclick="location.reload()" class="btn-primary" style="margin-top:20px; width:auto; padding:10px 20px;">Reload</button></div>';
  }
}, 15000);

const hideLoading = () => {
  clearTimeout(loadingTimeout);
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => { loadingScreen.style.display = 'none'; loadingScreen.style.visibility = 'hidden'; }, 600);
  }
};

if (typeof window.electron !== 'undefined' && window.electron.onUpdateMessage) {
  window.electron.onUpdateMessage((message) => {
    console.log('[Updater]', message);
    showNotification('', message);
  });
}

async function init() {
  try {

    await ensureAppReady();

    await loadSettings();
    
    applyBranding();
    applySettings();
    renderGarden();
    
    initEvents();
    initAvatarPicker();
    initSettingsNavigation();
    initProfileManagement();
    initDiscordSettings();
    
    await updateAuthUI();
    updateCultivaDatePreview();
    updateProfileSection();
    
    renderPluginHeaderItems();

    initNativeNotificationsScheduler(() => settings);
    
    console.log(`[App] Cultiva [${BRANDING.VERSION}] initialized successfully`);
  } catch (err) {
    console.error('[App] Init failed:', err);
    showNotification('', 'Failed to load app data. Try reloading.');
  } finally {
    hideLoading();
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => { init(); hideLoading(); }, 100);
} else {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { init(); hideLoading(); }, 100);
  });
}

export { TRANSLATIONS };