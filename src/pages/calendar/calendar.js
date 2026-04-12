/* ============================================ */
/* CULTIVA CALENDAR - CORE ENGINE               */
/* ============================================ */

import { TRANSLATIONS } from '../../main.js';
import { storage } from '../../modules/storage.js';
import { habits } from '../../modules/habits.js';

window.TRANSLATIONS = TRANSLATIONS;
window.__CALENDAR_PAGE = true;

const DEBUG = true;
const STORAGE_KEY = 'cultiva_calendar_events';

const EVENT_COLORS = [
    '#FF3B30', '#FF9500', '#FFCC00', '#34C759', 
    '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
    '#00C7BE', '#64D2FF', '#FF9F0A', '#BF5AF2'
];

let currentDate = new Date();
let selectedDate = new Date();
let currentView = 'month';
let events = {};
let editingEventId = null;
let editingEventDate = null;

let currentLang = 'en';
let currentT = TRANSLATIONS.en;

const GROWTH_STAGES = {
    SEED: { name: 'Seed', emoji: '🌱', min: 0, max: 6 },
    SPROUT: { name: 'Sprout', emoji: '🌿', min: 7, max: 20 },
    PLANT: { name: 'Plant', emoji: '🪴', min: 21, max: 49 },
    TREE: { name: 'Tree', emoji: '🌳', min: 50, max: 364 },
    LEGACY: { name: 'Legacy', emoji: '🌟', min: 365, max: Infinity }
};

/* ============================================ */
/* DEBUG                                        */
/* ============================================ */

function log(...args) {
    if (DEBUG) console.log('[Calendar]', ...args);
}

function error(...args) {
    console.error('[Calendar]', ...args);
}

/* ============================================ */
/* THEME & BACKGROUND SYNC                      */
/* ============================================ */

function syncTheme() {
    const theme = localStorage.getItem('cultiva-theme') || 'auto';
    document.body.classList.remove(
        'theme-light', 'theme-dark', 'theme-pink', 'theme-moon',
        'theme-evergreen', 'theme-blossom', 'theme-ocean', 'theme-sunset'
    );
    
    let appliedTheme = theme;
    if (appliedTheme === 'auto') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        appliedTheme = isDark ? 'dark' : 'light';
    }
    
    document.body.classList.add(`theme-${appliedTheme}`);
    log('Theme synced:', appliedTheme);
}

function syncBackground() {
    const bg = localStorage.getItem('cultiva-background') || 'none';
    
    ['aurora', 'rainfall', 'starlight'].forEach(id => {
        const el = document.getElementById(`bg-${id}`);
        if (el) el.style.display = 'none';
    });
    
    document.body.classList.remove('with-bg-aurora', 'with-bg-rainfall', 'with-bg-starlight');
    
    if (bg === 'none') return;
    
    const container = document.getElementById(`bg-${bg}`);
    if (container) {
        container.style.display = 'block';
        document.body.classList.add(`with-bg-${bg}`);
        
        if (bg === 'rainfall') {
            generateRaindrops(container);
        }
        
        if (bg === 'starlight') {
            generateStars(container);
        }
    }
    
    log('Background synced:', bg);
}

function generateRaindrops(container) {
    container.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        drop.style.animationDuration = `${1 + Math.random() * 1}s`;
        container.appendChild(drop);
    }
}

function generateStars(container) {
    container.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 3}s`;
        star.style.animationDuration = `${2 + Math.random() * 4}s`;
        container.appendChild(star);
    }
}

/* ============================================ */
/* UTILITIES                                    */
/* ============================================ */

function getTZ() {
    const tz = localStorage.getItem('cultiva-timezone') || 'auto';
    return tz === 'auto' ? undefined : tz;
}

function getTodayInTZ() {
    const now = new Date();
    const tz = getTZ();
    
    log('getTodayInTZ: now =', now, 'tz =', tz);
    
    if (!tz) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        log('getTodayInTZ: returning local', today);
        return today;
    }
    
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        const parts = formatter.formatToParts(now);
        const year = parseInt(parts.find(p => p.type === 'year').value);
        const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
        const day = parseInt(parts.find(p => p.type === 'day').value);
        
        const today = new Date(year, month, day);
        log('getTodayInTZ: returning', today);
        return today;
    } catch (e) {
        error('getTodayInTZ failed:', e);
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
}

function getTodayStr() {
    const tz = getTZ();
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: tz });
}

function formatDateKey(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        error('formatDateKey: invalid date', date);
        return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

function formatDateTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        return '';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTime(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
}

function formatMonth(date) {
    if (!date || isNaN(date)) return '';
    return date.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { 
        month: 'long', 
        year: 'numeric' 
    });
}

function formatFullDate(date) {
    if (!date || isNaN(date)) return '';
    return date.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
}

/* ============================================ */
/* EVENT STORAGE                                */
/* ============================================ */

function loadEvents() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            events = JSON.parse(stored);
            log('Events loaded:', Object.keys(events).length, 'days');
        }
    } catch (e) {
        error('Failed to load events:', e);
    }
}

function saveEvents() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    log('Events saved');
}

function addEvent(date, event) {
    const key = formatDateKey(date);
    if (!key) return null;
    
    if (!events[key]) events[key] = [];
    event.id = crypto.randomUUID?.() || Date.now().toString() + Math.random();
    events[key].push(event);
    events[key].sort((a, b) => a.start.localeCompare(b.start));
    saveEvents();
    log('Event added:', key, event.title);
    return event;
}

function updateEvent(date, eventId, updates) {
    const key = formatDateKey(date);
    if (!key || !events[key]) return false;
    
    const event = events[key].find(e => e.id === eventId);
    if (!event) return false;
    
    Object.assign(event, updates);
    events[key].sort((a, b) => a.start.localeCompare(b.start));
    saveEvents();
    log('Event updated:', key, updates.title);
    return true;
}

function deleteEvent(date, eventId) {
    const key = formatDateKey(date);
    if (!key || !events[key]) return false;
    
    events[key] = events[key].filter(e => e.id !== eventId);
    if (events[key].length === 0) delete events[key];
    saveEvents();
    log('Event deleted:', key);
    return true;
}

/* ============================================ */
/* HABIT INTEGRATION                            */
/* ============================================ */

function getHabitsForDate(date) {
    try {
        const allHabits = habits.getAll();
        const dateStr = formatDateKey(date);
        
        return allHabits
            .filter(h => {
                if (h.trackType === 'binary') {
                    return h.lastCompleted === dateStr;
                } else {
                    return (h.dailyProgress?.[dateStr] || 0) >= h.target;
                }
            })
            .map(h => {
                let stageEmoji = '🌱';
                if (h.progress >= 365) stageEmoji = '🌟';
                else if (h.progress >= 50) stageEmoji = '🌳';
                else if (h.progress >= 21) stageEmoji = '🪴';
                else if (h.progress >= 7) stageEmoji = '🌿';
                
                return {
                    id: `habit-${h.id}`,
                    title: `${stageEmoji} ${h.name}`,
                    color: '#34C759',
                    isHabit: true,
                    habit: h
                };
            });
    } catch (e) {
        error('getHabitsForDate failed:', e);
        return [];
    }
}

/* ============================================ */
/* RENDER MONTH                                 */
/* ============================================ */

function renderMonthView() {
    log('renderMonthView');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const titleEl = document.getElementById('calendar-title');
    if (titleEl) titleEl.textContent = formatMonth(currentDate);
    
    const firstDay = new Date(year, month, 1);
    let firstDayOfWeek = firstDay.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const container = document.getElementById('month-days');
    if (!container) {
        error('month-days container not found');
        return;
    }
    
    container.innerHTML = '';
    
    const todayStr = getTodayStr();
    const selectedStr = formatDateKey(selectedDate);
    
    log('Month params:', { year, month, startOffset, daysInMonth, todayStr });
    
    for (let i = startOffset - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        const date = new Date(year, month - 1, day);
        container.appendChild(createMonthDayElement(day, true, date));
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateKey(date);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedStr;
        
        const cell = createMonthDayElement(day, false, date);
        if (isToday) cell.classList.add('today');
        if (isSelected) cell.classList.add('selected');
        
        const dayEvents = events[dateStr] || [];
        const habitEvents = getHabitsForDate(date);
        const allEvents = [...dayEvents, ...habitEvents];
        
        if (allEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'month-events';
            
            const colors = [...new Set(allEvents.map(e => e.color))].slice(0, 3);
            colors.forEach(color => {
                const dot = document.createElement('div');
                dot.className = 'month-event-dot';
                dot.style.background = color;
                eventsContainer.appendChild(dot);
            });
            
            cell.appendChild(eventsContainer);
        }
        
        container.appendChild(cell);
    }
    
    const totalCells = startOffset + daysInMonth;
    const remaining = 42 - totalCells;
    for (let day = 1; day <= remaining; day++) {
        const date = new Date(year, month + 1, day);
        container.appendChild(createMonthDayElement(day, true, date));
    }
    
    log('Month rendered:', container.children.length, 'cells');
}

function createMonthDayElement(day, isOther, date) {
    const cell = document.createElement('div');
    cell.className = `month-day ${isOther ? 'other-month' : ''}`;
    cell.textContent = day;
    cell.addEventListener('click', () => {
        selectedDate = new Date(date);
        log('Day clicked:', formatDateKey(selectedDate));
        if (currentView === 'month') {
            switchView('day');
        } else {
            renderCurrentView();
        }
    });
    return cell;
}

/* ============================================ */
/* RENDER WEEK                                  */
/* ============================================ */

function renderWeekView() {
    log('renderWeekView');
    
    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const titleEl = document.getElementById('calendar-title');
    if (titleEl) {
        titleEl.textContent = `${startOfWeek.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    
    renderWeekHeader(startOfWeek);
    renderWeekTimeline(startOfWeek);
}

function renderWeekHeader(startOfWeek) {
    const header = document.getElementById('week-header');
    if (!header) return;
    
    header.innerHTML = '';
    const todayStr = getTodayStr();
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDateKey(day);
        const isToday = dateStr === todayStr;
        
        const dayEl = document.createElement('div');
        dayEl.className = `week-day ${isToday ? 'today' : ''}`;
        dayEl.innerHTML = `
            <div class="week-day-name">${day.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' })}</div>
            <div class="week-day-date">${day.getDate()}</div>
        `;
        dayEl.addEventListener('click', () => {
            selectedDate = new Date(day);
            switchView('day');
        });
        header.appendChild(dayEl);
    }
}

function renderWeekTimeline(startOfWeek) {
    const timeline = document.getElementById('week-timeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    const weekEvents = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDateKey(day);
        
        if (events[dateStr]) {
            events[dateStr].forEach(event => {
                weekEvents.push({ ...event, date: day, dateStr });
            });
        }
        
        getHabitsForDate(day).forEach(habit => {
            weekEvents.push({ ...habit, date: day, dateStr });
        });
    }
    
    for (let hour = 0; hour < 24; hour++) {
        const hourEl = document.createElement('div');
        hourEl.className = 'timeline-hour';
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'timeline-time';
        timeLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
        hourEl.appendChild(timeLabel);
        
        const slots = document.createElement('div');
        slots.className = 'timeline-slots';
        slots.style.position = 'relative';
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + i);
            
            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            slot.dataset.date = formatDateKey(day);
            slot.dataset.hour = hour;
            
            slot.addEventListener('click', () => {
                const clickDate = new Date(day);
                clickDate.setHours(hour, 0, 0);
                openEventPanel(clickDate);
            });
            
            slots.appendChild(slot);
        }
        
        hourEl.appendChild(slots);
        timeline.appendChild(hourEl);
    }
    
    weekEvents.forEach(event => {
        if (event.isHabit) {
            renderWeekHabitEvent(event, startOfWeek);
        } else {
            renderWeekEvent(event, startOfWeek);
        }
    });
}

function renderWeekEvent(event, startOfWeek) {
    const eventDate = new Date(event.date);
    const dayIndex = Math.floor((eventDate - startOfWeek) / (1000 * 60 * 60 * 24));
    
    if (dayIndex < 0 || dayIndex > 6) return;
    
    const [startHour, startMin] = event.start.split(':').map(Number);
    const [endHour, endMin] = event.end.split(':').map(Number);
    
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const height = Math.max(24, (duration / 60) * 60);
    
    const timeline = document.getElementById('week-timeline');
    const hourElements = timeline.querySelectorAll('.timeline-hour');
    
    const startHourEl = hourElements[startHour];
    if (!startHourEl) return;
    
    const slots = startHourEl.querySelector('.timeline-slots');
    const slot = slots.children[dayIndex];
    
    if (!slot) return;
    
    const eventEl = document.createElement('div');
    eventEl.className = 'week-event';
    eventEl.style.background = event.color || EVENT_COLORS[0];
    eventEl.style.top = `${(startMin)}px`;
    eventEl.style.height = `${height}px`;
    eventEl.style.zIndex = 10 + dayIndex;
    
    eventEl.innerHTML = `
        <div class="week-event-title">${event.title}</div>
        <div class="week-event-time">${event.start} – ${event.end}</div>
    `;
    
    eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openEventPanel(eventDate, event);
    });
    
    slot.style.position = 'relative';
    slot.appendChild(eventEl);
}

function renderWeekHabitEvent(habit, startOfWeek) {
    const habitDate = new Date(habit.date);
    const dayIndex = Math.floor((habitDate - startOfWeek) / (1000 * 60 * 60 * 24));
    
    if (dayIndex < 0 || dayIndex > 6) return;
    
    const timeline = document.getElementById('week-timeline');
    const hourElements = timeline.querySelectorAll('.timeline-hour');
    
    const hourEl = hourElements[0];
    if (!hourEl) return;
    
    const slots = hourEl.querySelector('.timeline-slots');
    const slot = slots.children[dayIndex];
    
    if (!slot) return;
    
    const habitEl = document.createElement('div');
    habitEl.className = 'week-event habit-event';
    habitEl.style.background = habit.color;
    habitEl.style.top = '2px';
    habitEl.style.height = '20px';
    habitEl.style.zIndex = 5;
    
    habitEl.innerHTML = `<div class="week-event-title">${habit.title}</div>`;
    
    slot.style.position = 'relative';
    slot.appendChild(habitEl);
}

/* ============================================ */
/* RENDER DAY                                   */
/* ============================================ */

function renderDayView() {
    log('renderDayView');
    
    const titleEl = document.getElementById('calendar-title');
    if (titleEl) titleEl.textContent = formatMonth(currentDate);
    
    const dateEl = document.getElementById('day-view-date');
    if (dateEl) dateEl.textContent = selectedDate.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
    
    const weekdayEl = document.getElementById('day-view-weekday');
    if (weekdayEl) weekdayEl.textContent = selectedDate.toLocaleString(currentLang === 'ru' ? 'ru-RU' : 'en-US', {
        weekday: 'long'
    });
    
    const timeline = document.getElementById('day-timeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    const dateStr = formatDateKey(selectedDate);
    const dayEvents = events[dateStr] || [];
    const habitEvents = getHabitsForDate(selectedDate);
    
    if (habitEvents.length > 0) {
        const allDaySection = document.createElement('div');
        allDaySection.className = 'all-day-section';
        
        habitEvents.forEach(habit => {
            const habitEl = document.createElement('div');
            habitEl.className = 'all-day-event';
            habitEl.style.background = habit.color;
            habitEl.textContent = habit.title;
            allDaySection.appendChild(habitEl);
        });
        
        timeline.appendChild(allDaySection);
    }
    
    for (let hour = 0; hour < 24; hour++) {
        const hourEl = document.createElement('div');
        hourEl.className = 'day-hour';
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'day-time';
        timeLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
        hourEl.appendChild(timeLabel);
        
        const slot = document.createElement('div');
        slot.className = 'day-slot';
        slot.dataset.hour = hour;
        
        slot.addEventListener('click', () => {
            const clickDate = new Date(selectedDate);
            clickDate.setHours(hour, 0, 0);
            openEventPanel(clickDate);
        });
        
        hourEl.appendChild(slot);
        timeline.appendChild(hourEl);
    }
    
    dayEvents.forEach(event => {
        renderDayEvent(event);
    });
}

function renderDayEvent(event) {
    const [startHour, startMin] = event.start.split(':').map(Number);
    
    const timeline = document.getElementById('day-timeline');
    const hourElements = timeline.querySelectorAll('.day-hour');
    
    const startHourEl = hourElements[startHour];
    if (!startHourEl) return;
    
    const slot = startHourEl.querySelector('.day-slot');
    if (!slot) return;
    
    const eventEl = document.createElement('div');
    eventEl.className = 'day-event';
    eventEl.style.background = event.color || EVENT_COLORS[0];
    
    eventEl.innerHTML = `
        <div class="day-event-title">${event.title}</div>
        <div class="day-event-time">${event.start} – ${event.end}</div>
        ${event.notes ? `<div class="day-event-notes">${event.notes}</div>` : ''}
    `;
    
    eventEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openEventPanel(selectedDate, event);
    });
    
    slot.appendChild(eventEl);
}

/* ============================================ */
/* EVENT PANEL                                  */
/* ============================================ */

function initColorSelector() {
    const selector = document.getElementById('event-color-selector');
    if (!selector) return;
    
    selector.innerHTML = '';
    
    EVENT_COLORS.forEach(color => {
        const option = document.createElement('div');
        option.className = 'color-option';
        option.style.background = color;
        option.dataset.color = color;
        
        option.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
        });
        
        selector.appendChild(option);
    });
    
    selector.children[0]?.classList.add('selected');
}

function openEventPanel(date, existingEvent = null) {
    log('openEventPanel', formatDateKey(date), existingEvent?.title);
    
    editingEventDate = date;
    editingEventId = existingEvent?.id || null;
    
    const title = document.getElementById('event-panel-title');
    const titleInput = document.getElementById('event-title');
    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    const notesInput = document.getElementById('event-notes');
    const deleteBtn = document.getElementById('event-delete');
    
    const startDateTime = new Date(date);
    const endDateTime = new Date(date);
    endDateTime.setHours(endDateTime.getHours() + 1);
    
    if (title) {
        title.textContent = existingEvent ? (currentT.editEvent || 'Edit Event') : (currentT.newEvent || 'New Event');
    }
    
    if (existingEvent) {
        if (titleInput) titleInput.value = existingEvent.title || '';
        if (startInput) startInput.value = formatDateTime(parseDateTime(formatDateKey(date), existingEvent.start));
        if (endInput) endInput.value = formatDateTime(parseDateTime(formatDateKey(date), existingEvent.end));
        if (notesInput) notesInput.value = existingEvent.notes || '';
        if (deleteBtn) deleteBtn.style.display = 'block';
        
        const colorOpts = document.querySelectorAll('.color-option');
        colorOpts.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === existingEvent.color);
        });
    } else {
        if (titleInput) titleInput.value = '';
        if (startInput) startInput.value = formatDateTime(startDateTime);
        if (endInput) endInput.value = formatDateTime(endDateTime);
        if (notesInput) notesInput.value = '';
        if (deleteBtn) deleteBtn.style.display = 'none';
        
        document.querySelectorAll('.color-option').forEach((opt, i) => {
            opt.classList.toggle('selected', i === 0);
        });
    }
    
    const panel = document.getElementById('event-panel');
    if (panel) panel.classList.add('active');
    if (titleInput) titleInput.focus();
}

function closeEventPanel() {
    const panel = document.getElementById('event-panel');
    if (panel) panel.classList.remove('active');
    editingEventId = null;
    editingEventDate = null;
}

function saveEvent() {
    const titleInput = document.getElementById('event-title');
    const title = titleInput?.value.trim();
    
    if (!title) {
        alert(currentT.enterTitle || 'Please enter a title');
        return;
    }
    
    const selectedColor = document.querySelector('.color-option.selected')?.dataset.color || EVENT_COLORS[0];
    
    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    const notesInput = document.getElementById('event-notes');
    
    const startDateTime = startInput ? new Date(startInput.value) : new Date();
    const endDateTime = endInput ? new Date(endInput.value) : new Date();
    
    const eventData = {
        title,
        start: startDateTime.toTimeString().slice(0, 5),
        end: endDateTime.toTimeString().slice(0, 5),
        notes: notesInput?.value.trim() || '',
        color: selectedColor
    };
    
    if (editingEventId) {
        updateEvent(editingEventDate, editingEventId, eventData);
    } else {
        addEvent(editingEventDate, eventData);
    }
    
    closeEventPanel();
    renderCurrentView();
}

/* ============================================ */
/* VIEW SWITCHING                               */
/* ============================================ */

function switchView(view) {
    log('switchView:', view);
    currentView = view;
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    document.getElementById('month-view')?.classList.toggle('active', view === 'month');
    document.getElementById('week-view')?.classList.toggle('active', view === 'week');
    document.getElementById('day-view')?.classList.toggle('active', view === 'day');
    
    renderCurrentView();
}

function renderCurrentView() {
    log('renderCurrentView:', currentView);
    
    if (currentView === 'month') renderMonthView();
    else if (currentView === 'week') renderWeekView();
    else if (currentView === 'day') renderDayView();
}

/* ============================================ */
/* NAVIGATION                                   */
/* ============================================ */

function goToToday() {
    log('goToToday');
    currentDate = getTodayInTZ();
    selectedDate = getTodayInTZ();
    renderCurrentView();
}

function goPrevious() {
    log('goPrevious');
    
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() - 7);
    } else {
        currentDate.setDate(currentDate.getDate() - 1);
        selectedDate = new Date(currentDate);
    }
    renderCurrentView();
}

function goNext() {
    log('goNext');
    
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + 7);
    } else {
        currentDate.setDate(currentDate.getDate() + 1);
        selectedDate = new Date(currentDate);
    }
    renderCurrentView();
}

/* ============================================ */
/* I18N                                         */
/* ============================================ */

function updateTranslations() {
    currentLang = localStorage.getItem('cultiva-lang') || 'en';
    currentT = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    log('Translations updated:', currentLang);
}

function applyI18n() {
    updateTranslations();
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (currentT[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = currentT[key];
            } else {
                el.textContent = currentT[key];
            }
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (currentT[key]) {
            el.placeholder = currentT[key];
        }
    });
    
    const weekdayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    document.querySelectorAll('.weekday[data-i18n]').forEach((el, index) => {
        const key = weekdayOrder[index];
        if (currentT[key]) el.textContent = currentT[key];
    });
    
    const panelTitle = document.getElementById('event-panel-title');
    if (panelTitle) {
        const isEditing = editingEventId !== null;
        panelTitle.textContent = isEditing ? (currentT.editEvent || 'Edit Event') : (currentT.newEvent || 'New Event');
    }
    
    log('I18n applied');
}

/* ============================================ */
/* INITIALIZATION                               */
/* ============================================ */

function init() {
    log('Calendar initializing...');
    
    updateTranslations();
    loadEvents();
    initColorSelector();

    syncTheme();
    syncBackground();
    
    const todayDate = getTodayInTZ();
    currentDate = todayDate;
    selectedDate = todayDate;
    
    log('Initial dates:', { currentDate, selectedDate });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    
    document.getElementById('prev-period')?.addEventListener('click', goPrevious);
    document.getElementById('next-period')?.addEventListener('click', goNext);
    document.getElementById('today-btn')?.addEventListener('click', goToToday);
    
    document.getElementById('event-panel-close')?.addEventListener('click', closeEventPanel);
    document.getElementById('event-cancel')?.addEventListener('click', closeEventPanel);
    document.getElementById('event-save')?.addEventListener('click', saveEvent);
    document.getElementById('event-delete')?.addEventListener('click', () => {
        if (editingEventId && editingEventDate && confirm(currentT.confirmDelete || 'Delete this event?')) {
            deleteEvent(editingEventDate, editingEventId);
            closeEventPanel();
            renderCurrentView();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('event-panel')?.classList.contains('active')) {
            closeEventPanel();
        }
    });
    
    document.getElementById('event-panel')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('event-panel')) {
            closeEventPanel();
        }
    });
    
    document.getElementById('event-title')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            saveEvent();
        }
    });
    
    renderMonthView();
    applyI18n();
    
    log('Calendar initialized');
}

init();

window.addEventListener('storage', (e) => {
    log('Storage event:', e.key);
    
    if (e.key === 'cultiva-lang') {
        applyI18n();
        renderCurrentView();
    }

    if (e.key === 'cultiva-theme') {
        syncTheme();
    }
    
    if (e.key === 'cultiva-background') {
        syncBackground();
    }
    
    if (e.key === STORAGE_KEY) {
        loadEvents();
        renderCurrentView();
    }
    
    if (e.key === 'cultiva-timezone') {
        goToToday();
    }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);