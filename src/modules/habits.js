import { storage } from './storage.js';
import { GROWTH_STAGES, LEGACY_THRESHOLD, MAX_ACTIVE_HABITS } from '../core/config.js';

/* ============================================ */
/* TIMEZONE UTILS                               */
/* ============================================ */

function getCultivaTimezone() {
    const tz = localStorage.getItem('cultiva-timezone') || 'auto';
    return tz === 'auto' ? undefined : tz;
}

function getTodayInTZ() {
    const now = new Date();
    const tz = getCultivaTimezone();
    
    if (!tz) {
        return now.toISOString().split('T')[0];
    }
    
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn('[Habits] Failed to get date with timezone, using local:', e);
        return now.toISOString().split('T')[0];
    }
}

function getDateInTZ(date) {
    const tz = getCultivaTimezone();
    if (!tz) return date.toISOString().split('T')[0];
    
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        const parts = formatter.formatToParts(date);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        
        return `${year}-${month}-${day}`;
    } catch (e) {
        return date.toISOString().split('T')[0];
    }
}

/* ============================================ */
/* HABITS CORE                                  */
/* ============================================ */

export const habits = {
  getAll() {
    return storage.getHabits();
  },

  add(data) {
    const allHabits = this.getAll();
    const active = allHabits.filter(h => h.progress < LEGACY_THRESHOLD);
    if (active.length >= MAX_ACTIVE_HABITS) {
      throw new Error('Garden is full');
    }

    const userId = storage.getCurrentUserId();
    const today = getTodayInTZ();

    const newHabit = {
      id: crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36),
      userId: userId || null,
      name: data.name,
      description: data.description || '',
      category: data.category || 'other',
      trackType: data.trackType || 'binary',
      target: data.target || 1,
      unit: data.unit || '',
      startDate: data.startDate || today,
      progress: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastCompleted: null,
      history: [],
      dailyProgress: {},
      treeName: null,
      createdAt: new Date().toISOString()
    };
    
    allHabits.push(newHabit);
    storage.saveHabits(allHabits);
    return newHabit;
  },

  toggle(id, amount = null) {
    const allHabits = this.getAll();
    const habit = allHabits.find(h => h.id === id);
    if (!habit) return null;
    
    const today = getTodayInTZ();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateInTZ(yesterday);

    if (habit.trackType === 'quantity') {
      const current = habit.dailyProgress?.[today] || 0;
      const newAmount = amount !== null ? amount : (current + 1);
      habit.dailyProgress = habit.dailyProgress || {};
      habit.dailyProgress[today] = newAmount;
      
      const wasCompleted = current >= habit.target;
      const isCompleted = newAmount >= habit.target;
      
      if (isCompleted && !wasCompleted) {
        habit.progress++;
        habit.lastCompleted = today;
        if (!habit.history.includes(today)) habit.history.push(today);
      } else if (!isCompleted && wasCompleted) {
        habit.progress = Math.max(0, habit.progress - 1);
        habit.lastCompleted = null;
        habit.history = habit.history.filter(d => d !== today);
      }
      
      this._recalculateStreaks(habit);
    } else {
      if (habit.lastCompleted === today) {
        habit.lastCompleted = null;
        habit.progress = Math.max(0, habit.progress - 1);
        habit.history = habit.history.filter(d => d !== today);
      } else {
        habit.progress++;
        habit.lastCompleted = today;
        if (!habit.history.includes(today)) habit.history.push(today);
      }
      
      this._recalculateStreaks(habit);
    }
    
    storage.saveHabits(allHabits);
    return habit;
  },

  _recalculateStreaks(habit) {
    const today = getTodayInTZ();
    const history = habit.history || [];
    const sortedHistory = [...new Set(history)].sort();
    
    let currentStreak = 0;
    let checkDate = new Date();
    const tz = getCultivaTimezone();
    
    while (true) {
      const dateStr = getDateInTZ(checkDate);
      
      if (sortedHistory.includes(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dateStr === today) {
        break;
      } else {
        break;
      }
    }
    
    let bestStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < sortedHistory.length; i++) {
      const currentDate = sortedHistory[i];
      
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = sortedHistory[i - 1];
        const curr = new Date(currentDate);
        const prev = new Date(prevDate);
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      
      bestStreak = Math.max(bestStreak, tempStreak);
    }
    
    if (habit.lastCompleted !== today) {
      const lastDate = sortedHistory[sortedHistory.length - 1];
      if (lastDate) {
        const last = new Date(lastDate);
        const now = new Date();
        const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          currentStreak = 0;
        }
      }
    }
    
    habit.currentStreak = currentStreak;
    habit.bestStreak = Math.max(habit.bestStreak || 0, bestStreak, currentStreak);
  },

  remove(id) {
    const allHabits = this.getAll().filter(h => h.id !== id);
    storage.saveHabits(allHabits);
  },

  getStage(progress) {
    for (let key in GROWTH_STAGES) {
      const stage = GROWTH_STAGES[key];
      if (progress >= stage.min && progress <= stage.max) return stage;
    }
    return GROWTH_STAGES.SEED;
  },

  getStats(id) {
    const h = this.getAll().find(x => x.id === id);
    if (!h) return null;

    const today = getTodayInTZ();
    const startDate = h.startDate || today;
    
    const totalDays = Math.max(1, Math.floor((new Date(today) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1);
    const completedDays = h.history?.length || 0;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    return {
      name: h.name,
      stage: this.getStage(h.progress),
      currentStreak: h.currentStreak || 0,
      bestStreak: h.bestStreak || 0,
      completionRate,
      totalDays: completedDays,
      trackType: h.trackType,
      target: h.target,
      unit: h.unit
    };
  },

  getCalendarData(id) {
    const h = this.getAll().find(x => x.id === id);
    if (!h) return [];
    
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 364);
    
    const days = [];
    const historySet = new Set(h.history || []);
    
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = getDateInTZ(d);
      let level = 0;
      
      if (historySet.has(ds)) {
        if (h.trackType === 'quantity') {
          const pct = (h.dailyProgress?.[ds] || 0) / (h.target || 1);
          level = Math.min(4, Math.floor(pct * 4));
        } else {
          level = 4;
        }
      }
      
      days.push({ date: ds, level });
    }
    
    return days;
  }
};