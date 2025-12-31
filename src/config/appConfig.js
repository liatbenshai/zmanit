/**
 * קונפיגורציה מרכזית של האפליקציה
 * ==========================================
 * 
 * כל ההגדרות במקום אחד!
 * נטען מ-Supabase, עם fallback ל-localStorage וברירות מחדל
 */

import { supabase } from '../services/supabase';

// =====================================
// ברירות מחדל
// =====================================

export const DEFAULT_CONFIG = {
  // שעות עבודה
  workHours: {
    start: '08:30',
    end: '16:15',
    startMinutes: 8 * 60 + 30,  // 510
    endMinutes: 16 * 60 + 15,   // 975
    totalMinutes: 465           // 7:45 שעות
  },
  
  // ימי עבודה (0=ראשון, 6=שבת)
  workDays: [0, 1, 2, 3, 4], // א'-ה'
  
  // שישי
  friday: {
    enabled: true,
    start: '08:30',
    end: '12:00',
    startMinutes: 8 * 60 + 30,
    endMinutes: 12 * 60
  },
  
  // הפסקות
  breaks: {
    enabled: false,
    start: '12:00',
    end: '12:30',
    betweenTasks: 5  // דקות בין משימות
  },
  
  // הגדרות טיימר
  timer: {
    defaultDuration: 30,
    minBlockSize: 15,
    maxBlockSize: 90
  },
  
  // הגדרות התראות
  notifications: {
    reminderMinutes: 5,
    notifyOnTime: true,
    notifyOnEnd: true,
    repeatEveryMinutes: 10
  }
};

// =====================================
// Cache
// =====================================

let configCache = null;
let configLoadPromise = null;
const CONFIG_STORAGE_KEY = 'zmanit_app_config';
const TASK_TYPES_STORAGE_KEY = 'zmanit_custom_task_types';

// =====================================
// פונקציות עזר
// =====================================

/**
 * המרת שעה (string) לדקות
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + (mins || 0);
}

/**
 * המרת דקות לשעה (string)
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * חישוב שעות עבודה מ-config
 */
function calculateWorkHours(config) {
  const startMinutes = timeToMinutes(config.workHours?.start || '08:30');
  const endMinutes = timeToMinutes(config.workHours?.end || '16:15');
  
  return {
    start: config.workHours?.start || '08:30',
    end: config.workHours?.end || '16:15',
    startMinutes,
    endMinutes,
    totalMinutes: endMinutes - startMinutes,
    // תאימות לאחור
    startDecimal: startMinutes / 60,
    endDecimal: endMinutes / 60
  };
}

// =====================================
// טעינה ושמירה
// =====================================

/**
 * טעינת קונפיגורציה מ-Supabase
 */
export async function loadConfigFromSupabase(userId) {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // אין הגדרות - יצירת ברירות מחדל
        console.log('📝 יוצר הגדרות ברירת מחדל למשתמש');
        return await createDefaultConfig(userId);
      }
      throw error;
    }
    
    return transformFromDb(data);
  } catch (err) {
    console.error('❌ שגיאה בטעינת קונפיגורציה:', err);
    return null;
  }
}

/**
 * יצירת קונפיגורציה ברירת מחדל
 */
async function createDefaultConfig(userId) {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .insert({
        user_id: userId,
        work_start_time: '08:30:00',
        work_end_time: '16:15:00',
        work_days: [0, 1, 2, 3, 4],
        friday_enabled: true,
        friday_start_time: '08:30:00',
        friday_end_time: '12:00:00'
      })
      .select()
      .single();
    
    if (error) throw error;
    return transformFromDb(data);
  } catch (err) {
    console.error('❌ שגיאה ביצירת קונפיגורציה:', err);
    return null;
  }
}

/**
 * שמירת קונפיגורציה ב-Supabase
 */
export async function saveConfigToSupabase(userId, config) {
  if (!userId) return false;
  
  try {
    const dbData = transformToDb(config);
    
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        user_id: userId,
        ...dbData
      });
    
    if (error) throw error;
    
    // עדכון cache
    configCache = config;
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    
    return true;
  } catch (err) {
    console.error('❌ שגיאה בשמירת קונפיגורציה:', err);
    return false;
  }
}

/**
 * המרה מפורמט DB לפורמט אפליקציה
 */
function transformFromDb(data) {
  if (!data) return null;
  
  // המרת TIME מ-Postgres לstring פשוט
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    // '08:30:00' -> '08:30'
    return timeStr.substring(0, 5);
  };
  
  const config = {
    workHours: {
      start: parseTime(data.work_start_time) || '08:30',
      end: parseTime(data.work_end_time) || '16:15'
    },
    workDays: data.work_days || [0, 1, 2, 3, 4],
    friday: {
      enabled: data.friday_enabled ?? true,
      start: parseTime(data.friday_start_time) || '08:30',
      end: parseTime(data.friday_end_time) || '12:00'
    },
    breaks: {
      enabled: data.break_enabled ?? false,
      start: parseTime(data.break_start_time) || '12:00',
      end: parseTime(data.break_end_time) || '12:30',
      betweenTasks: data.break_between_tasks || 5
    },
    timer: {
      defaultDuration: data.default_task_duration || 30,
      minBlockSize: data.min_block_size || 15,
      maxBlockSize: data.max_block_size || 90
    },
    notifications: {
      reminderMinutes: data.reminder_minutes || 5,
      notifyOnTime: data.notify_on_time ?? true,
      notifyOnEnd: data.notify_on_end ?? true,
      repeatEveryMinutes: data.repeat_every_minutes || 10
    }
  };
  
  // חישוב ערכים נגזרים
  config.workHours = calculateWorkHours(config);
  
  return config;
}

/**
 * המרה מפורמט אפליקציה לפורמט DB
 */
function transformToDb(config) {
  return {
    work_start_time: config.workHours?.start + ':00',
    work_end_time: config.workHours?.end + ':00',
    work_days: config.workDays,
    friday_enabled: config.friday?.enabled,
    friday_start_time: config.friday?.start + ':00',
    friday_end_time: config.friday?.end + ':00',
    break_enabled: config.breaks?.enabled,
    break_start_time: config.breaks?.start + ':00',
    break_end_time: config.breaks?.end + ':00',
    break_between_tasks: config.breaks?.betweenTasks,
    default_task_duration: config.timer?.defaultDuration,
    min_block_size: config.timer?.minBlockSize,
    max_block_size: config.timer?.maxBlockSize,
    reminder_minutes: config.notifications?.reminderMinutes,
    notify_on_time: config.notifications?.notifyOnTime,
    notify_on_end: config.notifications?.notifyOnEnd,
    repeat_every_minutes: config.notifications?.repeatEveryMinutes
  };
}

// =====================================
// API ראשי
// =====================================

/**
 * טעינת קונפיגורציה (עם cache)
 */
export async function getConfig(userId) {
  // אם יש cache - החזר אותו
  if (configCache) {
    return configCache;
  }
  
  // אם כבר טוענים - חכה
  if (configLoadPromise) {
    return configLoadPromise;
  }
  
  // נסה לטעון מ-localStorage קודם (מהיר יותר)
  try {
    const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (cached) {
      configCache = JSON.parse(cached);
      // חישוב ערכים נגזרים
      configCache.workHours = calculateWorkHours(configCache);
    }
  } catch (e) {}
  
  // טען מ-Supabase ברקע
  if (userId) {
    configLoadPromise = loadConfigFromSupabase(userId).then(config => {
      if (config) {
        configCache = config;
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      }
      configLoadPromise = null;
      return configCache || DEFAULT_CONFIG;
    });
    
    return configLoadPromise;
  }
  
  return configCache || DEFAULT_CONFIG;
}

/**
 * קבלת קונפיגורציה סינכרונית (מ-cache בלבד)
 */
export function getConfigSync() {
  if (configCache) {
    return configCache;
  }
  
  // נסה מ-localStorage
  try {
    const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (cached) {
      configCache = JSON.parse(cached);
      configCache.workHours = calculateWorkHours(configCache);
      return configCache;
    }
  } catch (e) {}
  
  return DEFAULT_CONFIG;
}

/**
 * עדכון קונפיגורציה
 */
export async function updateConfig(userId, updates) {
  const current = await getConfig(userId);
  const newConfig = { ...current, ...updates };
  
  // חישוב מחדש של ערכים נגזרים
  if (updates.workHours) {
    newConfig.workHours = calculateWorkHours(newConfig);
  }
  
  // שמירה
  const success = await saveConfigToSupabase(userId, newConfig);
  
  if (success) {
    configCache = newConfig;
    
    // שליחת event לעדכון קומפוננטים
    window.dispatchEvent(new CustomEvent('configUpdated', { detail: newConfig }));
  }
  
  return success;
}

/**
 * איפוס cache (לשימוש ב-logout)
 */
export function clearConfigCache() {
  configCache = null;
  configLoadPromise = null;
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

// =====================================
// קבועים לתאימות לאחור
// =====================================

/**
 * WORK_HOURS - לתאימות לאחור עם קוד קיים
 * משתמש ב-Proxy כדי לקרוא תמיד מה-config העדכני
 */
export const WORK_HOURS = new Proxy({}, {
  get(target, prop) {
    const config = getConfigSync();
    const wh = config.workHours;
    
    switch (prop) {
      case 'start': return wh.startDecimal;
      case 'end': return wh.endDecimal;
      case 'startMinutes': return wh.startMinutes;
      case 'endMinutes': return wh.endMinutes;
      case 'totalMinutes': return wh.totalMinutes;
      case 'startTime': return wh.start;
      case 'endTime': return wh.end;
      default: return undefined;
    }
  }
});

/**
 * WORK_DAYS - לתאימות לאחור
 */
export const WORK_DAYS = new Proxy([], {
  get(target, prop) {
    const config = getConfigSync();
    if (prop === 'length') return config.workDays.length;
    if (!isNaN(prop)) return config.workDays[prop];
    if (prop === Symbol.iterator) return config.workDays[Symbol.iterator].bind(config.workDays);
    if (typeof Array.prototype[prop] === 'function') {
      return Array.prototype[prop].bind(config.workDays);
    }
    return config.workDays[prop];
  }
});

// =====================================
// Exports
// =====================================

export default {
  DEFAULT_CONFIG,
  getConfig,
  getConfigSync,
  updateConfig,
  clearConfigCache,
  loadConfigFromSupabase,
  saveConfigToSupabase,
  timeToMinutes,
  minutesToTime,
  WORK_HOURS,
  WORK_DAYS
};
