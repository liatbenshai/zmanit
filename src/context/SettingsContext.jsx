import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

// =============================================
// ברירות מחדל
// =============================================

export const DEFAULT_SETTINGS = {
  // שעות עבודה (בדקות מחצות)
  work_hours: {
    dayStart: 510,      // 08:30
    dayEnd: 975,        // 16:15
    morningStart: 480,  // 08:00
    morningEnd: 720,    // 12:00
    afternoonStart: 720, // 12:00
    afternoonEnd: 960,  // 16:00
    blockDuration: 45,
    breakDuration: 5
  },
  
  // ימי עבודה
  work_days: {
    0: { enabled: true, name: 'ראשון', hours: { start: 510, end: 975 } },
    1: { enabled: true, name: 'שני', hours: { start: 510, end: 975 } },
    2: { enabled: true, name: 'שלישי', hours: { start: 510, end: 975 } },
    3: { enabled: true, name: 'רביעי', hours: { start: 510, end: 975 } },
    4: { enabled: true, name: 'חמישי', hours: { start: 510, end: 975 } },
    5: { enabled: false, name: 'שישי', hours: { start: 480, end: 780 } },
    6: { enabled: false, name: 'שבת', hours: null }
  },
  
  // סוגי משימות
  task_types: {
    transcription: { id: 'transcription', name: 'תמלול', icon: '🎙️', color: '#3B82F6', defaultDuration: 60, category: 'work', order: 1 },
    proofreading: { id: 'proofreading', name: 'הגהה', icon: '📝', color: '#10B981', defaultDuration: 45, category: 'work', order: 2 },
    email: { id: 'email', name: 'מיילים', icon: '📧', color: '#F59E0B', defaultDuration: 25, category: 'work', order: 3 },
    course: { id: 'course', name: 'קורס התמלול', icon: '📚', color: '#8B5CF6', defaultDuration: 90, category: 'venture', order: 4 },
    client_communication: { id: 'client_communication', name: 'לקוחות', icon: '💬', color: '#EC4899', defaultDuration: 30, category: 'work', order: 5 },
    management: { id: 'management', name: 'ניהול', icon: '👔', color: '#6366F1', defaultDuration: 45, category: 'work', order: 6 },
    family: { id: 'family', name: 'משפחה', icon: '👨‍👩‍👧‍👦', color: '#F97316', defaultDuration: 60, category: 'family', order: 7 },
    kids: { id: 'kids', name: 'ילדים', icon: '🧒', color: '#14B8A6', defaultDuration: 30, category: 'family', order: 8 },
    personal: { id: 'personal', name: 'זמן אישי', icon: '🧘', color: '#A855F7', defaultDuration: 30, category: 'personal', order: 9 },
    unexpected: { id: 'unexpected', name: 'בלת"מים', icon: '⚡', color: '#EF4444', defaultDuration: 30, category: 'work', order: 10 },
    other: { id: 'other', name: 'אחר', icon: '📋', color: '#6B7280', defaultDuration: 30, category: 'work', order: 99 }
  },
  
  // קטגוריות
  categories: {
    work: { id: 'work', name: 'עבודה', icon: '💼', color: '#3B82F6', order: 1 },
    venture: { id: 'venture', name: 'מיזם', icon: '🚀', color: '#8B5CF6', order: 2 },
    family: { id: 'family', name: 'משפחה', icon: '👨‍👩‍👧‍👦', color: '#F97316', order: 3 },
    personal: { id: 'personal', name: 'אישי', icon: '🧘', color: '#10B981', order: 4 }
  },
  
  // התראות
  notifications: {
    enabled: true,
    taskReminder: { enabled: true, minutesBefore: 5 },
    dailySummary: { enabled: true, time: '08:00' },
    breakReminder: { enabled: true, afterMinutes: 45 },
    endOfDay: { enabled: true, time: '16:00' },
    weeklyReport: { enabled: false, day: 0, time: '09:00' },
    sound: true,
    vibrate: true
  },
  
  // תצוגה
  display: {
    theme: 'system',
    language: 'he',
    defaultView: 'daily',
    showCompletedTasks: true,
    compactMode: false,
    showTimeEstimates: true,
    showProgressBars: true
  },
  
  // טיימר
  timer: {
    autoStart: false,
    autoComplete: false,
    showInTitle: true,
    tickSound: false,
    pomodoroMode: false,
    pomodoroDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakAfter: 4
  }
};

// =============================================
// Context
// =============================================

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // טעינת הגדרות
  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        // אם אין רשומה - ניצור אחת
        if (fetchError.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('user_settings')
            .insert({ user_id: user.id })
            .select()
            .single();

          if (insertError) throw insertError;
          
          setSettings(mergeSettings(DEFAULT_SETTINGS, newData));
        } else {
          throw fetchError;
        }
      } else {
        setSettings(mergeSettings(DEFAULT_SETTINGS, data));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err.message);
      // נשתמש בברירות מחדל
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // מיזוג הגדרות מהשרת עם ברירות מחדל
  function mergeSettings(defaults, serverData) {
    if (!serverData) return defaults;
    
    return {
      work_hours: { ...defaults.work_hours, ...(serverData.work_hours || {}) },
      work_days: { ...defaults.work_days, ...(serverData.work_days || {}) },
      task_types: { ...defaults.task_types, ...(serverData.task_types || {}) },
      categories: { ...defaults.categories, ...(serverData.categories || {}) },
      notifications: { ...defaults.notifications, ...(serverData.notifications || {}) },
      display: { ...defaults.display, ...(serverData.display || {}) },
      timer: { ...defaults.timer, ...(serverData.timer || {}) }
    };
  }

  // שמירת הגדרות
  const saveSettings = useCallback(async (newSettings) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...newSettings
        }, {
          onConflict: 'user_id'
        });

      if (updateError) throw updateError;

      setSettings(prev => {
        const updated = { ...prev, ...newSettings };
        
        // ✅ תיקון: סנכרון שעות עבודה ל-localStorage למנהל ההתראות
        try {
          const workHours = updated.work_hours;
          const workDays = updated.work_days;
          const enabledDays = Object.entries(workDays || {})
            .filter(([_, v]) => v?.enabled)
            .map(([k]) => parseInt(k));
          
          localStorage.setItem(`work_settings_${user.id}`, JSON.stringify({
            workHours: {
              startHour: Math.floor((workHours?.dayStart || 510) / 60),
              startMinute: (workHours?.dayStart || 510) % 60,
              endHour: Math.floor((workHours?.dayEnd || 975) / 60),
              endMinute: (workHours?.dayEnd || 975) % 60,
              workDays: enabledDays.length > 0 ? enabledDays : [0, 1, 2, 3, 4]
            }
          }));
        } catch (e) {
          console.warn('שגיאה בסנכרון הגדרות ל-localStorage:', e);
        }
        
        return updated;
      });
      toast.success('ההגדרות נשמרו');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message);
      toast.error('שגיאה בשמירת הגדרות');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  // עדכון חלק מההגדרות
  const updateSettings = useCallback(async (key, value) => {
    const newSettings = { [key]: value };
    await saveSettings(newSettings);
  }, [saveSettings]);

  // =============================================
  // פונקציות עזר לסוגי משימות
  // =============================================

  const addTaskType = useCallback(async (taskType) => {
    const newTaskTypes = {
      ...settings.task_types,
      [taskType.id]: taskType
    };
    await updateSettings('task_types', newTaskTypes);
  }, [settings.task_types, updateSettings]);

  const updateTaskType = useCallback(async (id, updates) => {
    if (!settings.task_types[id]) return;
    
    const newTaskTypes = {
      ...settings.task_types,
      [id]: { ...settings.task_types[id], ...updates }
    };
    await updateSettings('task_types', newTaskTypes);
  }, [settings.task_types, updateSettings]);

  const deleteTaskType = useCallback(async (id) => {
    if (id === 'other') {
      toast.error('לא ניתן למחוק את סוג "אחר"');
      return;
    }
    
    const newTaskTypes = { ...settings.task_types };
    delete newTaskTypes[id];
    await updateSettings('task_types', newTaskTypes);
  }, [settings.task_types, updateSettings]);

  // =============================================
  // פונקציות עזר לקטגוריות
  // =============================================

  const addCategory = useCallback(async (category) => {
    const newCategories = {
      ...settings.categories,
      [category.id]: category
    };
    await updateSettings('categories', newCategories);
  }, [settings.categories, updateSettings]);

  const updateCategory = useCallback(async (id, updates) => {
    if (!settings.categories[id]) return;
    
    const newCategories = {
      ...settings.categories,
      [id]: { ...settings.categories[id], ...updates }
    };
    await updateSettings('categories', newCategories);
  }, [settings.categories, updateSettings]);

  const deleteCategory = useCallback(async (id) => {
    if (['work', 'personal'].includes(id)) {
      toast.error('לא ניתן למחוק קטגוריות בסיסיות');
      return;
    }
    
    const newCategories = { ...settings.categories };
    delete newCategories[id];
    await updateSettings('categories', newCategories);
  }, [settings.categories, updateSettings]);

  // =============================================
  // פונקציות עזר לימי עבודה
  // =============================================

  const updateWorkDay = useCallback(async (dayIndex, updates) => {
    const newWorkDays = {
      ...settings.work_days,
      [dayIndex]: { ...settings.work_days[dayIndex], ...updates }
    };
    await updateSettings('work_days', newWorkDays);
  }, [settings.work_days, updateSettings]);

  // =============================================
  // פונקציות המרה
  // =============================================

  // המרת דקות לשעה (למשל 510 -> "08:30")
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // המרת שעה לדקות (למשל "08:30" -> 510)
  const timeToMinutes = (time) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };

  // קבלת סוג משימה
  const getTaskType = (typeId) => {
    return settings.task_types[typeId] || settings.task_types.other;
  };

  // קבלת כל סוגי המשימות (ממוינים)
  const getTaskTypes = () => {
    return Object.values(settings.task_types).sort((a, b) => a.order - b.order);
  };

  // קבלת קטגוריה
  const getCategory = (categoryId) => {
    return settings.categories[categoryId] || settings.categories.work;
  };

  // קבלת כל הקטגוריות (ממוינות)
  const getCategories = () => {
    return Object.values(settings.categories).sort((a, b) => a.order - b.order);
  };

  // בדיקה אם יום עבודה
  const isWorkDay = (dayIndex) => {
    return settings.work_days[dayIndex]?.enabled || false;
  };

  // טעינה ראשונית
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  
  // ✅ סנכרון שעות עבודה ל-localStorage בכל שינוי הגדרות
  useEffect(() => {
    if (!user?.id || loading) return;
    try {
      const workHours = settings.work_hours;
      const workDays = settings.work_days;
      const enabledDays = Object.entries(workDays || {})
        .filter(([_, v]) => v?.enabled)
        .map(([k]) => parseInt(k));
      
      localStorage.setItem(`work_settings_${user.id}`, JSON.stringify({
        workHours: {
          startHour: Math.floor((workHours?.dayStart || 510) / 60),
          startMinute: (workHours?.dayStart || 510) % 60,
          endHour: Math.floor((workHours?.dayEnd || 975) / 60),
          endMinute: (workHours?.dayEnd || 975) % 60,
          workDays: enabledDays.length > 0 ? enabledDays : [0, 1, 2, 3, 4]
        }
      }));
    } catch (e) {
      // לא קריטי
    }
  }, [settings.work_hours, settings.work_days, user?.id, loading]);

  const value = {
    // מצב
    settings,
    loading,
    saving,
    error,
    
    // פעולות כלליות
    loadSettings,
    saveSettings,
    updateSettings,
    
    // סוגי משימות
    addTaskType,
    updateTaskType,
    deleteTaskType,
    getTaskType,
    getTaskTypes,
    
    // קטגוריות
    addCategory,
    updateCategory,
    deleteCategory,
    getCategory,
    getCategories,
    
    // ימי עבודה
    updateWorkDay,
    isWorkDay,
    
    // עזר
    minutesToTime,
    timeToMinutes,
    
    // קיצורי דרך
    taskTypes: settings.task_types,
    categories: settings.categories,
    workDays: settings.work_days,
    workHours: settings.work_hours,
    notifications: settings.notifications,
    display: settings.display,
    timerSettings: settings.timer
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// Hook לשימוש בהגדרות
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

export default SettingsContext;
