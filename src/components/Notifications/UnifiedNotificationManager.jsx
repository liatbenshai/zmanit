/**
 * מנהל התראות מאוחד - UnifiedNotificationManager v3.1
 * =====================================================
 * 
 * מערכת התראות יחידה ומרכזית!
 * 
 * ✅ תיקונים בגרסה 3.1:
 * 1. מניעת התראות כפולות לאינטרוולים של אותה משימה
 * 2. לא שולח התראות כשיש טיימר פעיל על משימה כלשהי
 * 3. שיפור בדיקת משימות הוריות (is_project)
 * 4. מניעת התראות על משימות שונות בזמן עבודה
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import OverdueTaskPopup from './OverdueTaskPopup';
import toast from 'react-hot-toast';

// ============================================
// קבועים והגדרות
// ============================================

const CONFIG = {
  // כש-IdleDetector פעיל (פופאפ המזכירה), נמנעים מפופאפ no-timer כפול
  // הוחזר ל-false כדי לשמור fallback כשהפופאפ הישן לא קופץ
  USE_LEGACY_IDLE_POPUP: false,

  // מרווחי בדיקה
  CHECK_INTERVAL_MS: 30 * 1000,        // בדיקה כל 30 שניות
  GRACE_PERIOD_MS: 30 * 1000,           // 30 שניות חסד בתחילת סשן (מספיק לטעינת נתונים)
  
  // מרווחים בין התראות (בדקות)
  MIN_INTERVAL: {
    TASK_STARTING: 5,
    TASK_OVERDUE: 10,
    NO_TIMER: 10,
    PAUSED_TIMER: 10,
    IDLE: 8,
    CALENDAR: 15,
  },
  
  // סף זמן להתראות (בדקות)
  THRESHOLD: {
    TASK_STARTING_SOON: 5,    // התראה 5 דק' לפני התחלה
    TASK_LATE_MIN: 2,         // משימה באיחור אחרי 2 דק'
    TASK_LATE_MAX: 30,        // לא מתריעים על יותר מ-30 דק' איחור
    PAUSED_TIMER: 5,         // טיימר מושהה יותר מ-5 דק'
    TIME_ENDING: 5,           // 5 דק' לפני סיום זמן מוקצב
    IDLE_MINUTES: 5,          // זמן מת אחרי 5 דק'
  },
  
  // שעות עבודה ברירת מחדל
  DEFAULT_WORK_HOURS: {
    startMinutes: 8.5 * 60,   // 08:30
    endMinutes: 16.25 * 60,   // 16:15
    workDays: [0, 1, 2, 3, 4] // ראשון עד חמישי
  }
};

// ============================================
// פונקציות עזר
// ============================================

/**
 * המרת תאריך לפורמט ISO מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * נרמול תאריך לשמירה על תאריך מקומי נכון גם כשמגיע YYYY-MM-DD
 */
function normalizeTaskDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  return toLocalISODate(dateValue);
}

/**
 * קריאת הגדרות שעות עבודה מ-localStorage
 */
function getWorkHoursSettings(userId) {
  try {
    const userSettings = localStorage.getItem(`work_settings_${userId}`);
    if (userSettings) {
      const parsed = JSON.parse(userSettings);
      if (parsed.workHours) {
        const { startHour, startMinute, endHour, endMinute, workDays } = parsed.workHours;
        return {
          startMinutes: (startHour || 8) * 60 + (startMinute || 0),
          endMinutes: (endHour || 16) * 60 + (endMinute || 0),
          workDays: workDays || CONFIG.DEFAULT_WORK_HOURS.workDays
        };
      }
    }
    
    const generalSettings = localStorage.getItem('zmanit_work_settings');
    if (generalSettings) {
      const parsed = JSON.parse(generalSettings);
      return {
        startMinutes: parsed.startMinutes || CONFIG.DEFAULT_WORK_HOURS.startMinutes,
        endMinutes: parsed.endMinutes || CONFIG.DEFAULT_WORK_HOURS.endMinutes,
        workDays: parsed.workDays || CONFIG.DEFAULT_WORK_HOURS.workDays
      };
    }
  } catch (e) {
    console.warn('[Notifications] שגיאה בקריאת הגדרות:', e);
  }
  
  return CONFIG.DEFAULT_WORK_HOURS;
}

/**
 * דקות עבודה שנותרו להיום לפי הגדרות
 */
function getRemainingWorkMinutesToday(workSettings, now = new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();
  const isWorkDay = workSettings.workDays.includes(dayOfWeek);

  if (!isWorkDay) return 0;
  if (currentMinutes >= workSettings.endMinutes) return 0;
  if (currentMinutes <= workSettings.startMinutes) {
    return workSettings.endMinutes - workSettings.startMinutes;
  }

  return workSettings.endMinutes - currentMinutes;
}

/**
 * ✅ תיקון v3.1: בדיקה משופרת אם יש טיימר פעיל
 * בודקת את כל המקומות האפשריים לטיימר פעיל
 */
function getActiveTimerInfo() {
  try {
    // בדיקה 1: המפתח הראשי
    const activeTimerId = localStorage.getItem('zmanit_active_timer');
    
    if (activeTimerId && activeTimerId !== 'null' && activeTimerId !== 'undefined') {
      const timerData = localStorage.getItem(`timer_v2_${activeTimerId}`);
      if (timerData) {
        const data = JSON.parse(timerData);
        
        // טיימר רץ
        if (data.isRunning === true && data.startTime) {
          return { taskId: activeTimerId, isRunning: true, isPaused: false, isInterrupted: false };
        }
        
        // טיימר מושהה
        if (data.isPaused === true) {
          // ✅ תיקון: אם אין pausedAt ב-timer_v2_, מנסים למצוא ב-zmanit_focus_paused
          let pausedAt = data.pausedAt;
          if (!pausedAt) {
            try {
              const focusPaused = JSON.parse(localStorage.getItem('zmanit_focus_paused') || '{}');
              if (focusPaused.isPaused && focusPaused.taskId === activeTimerId) {
                pausedAt = focusPaused.pausedAt;
              }
            } catch (e) {}
          }
          return { taskId: activeTimerId, isRunning: false, isPaused: true, pausedAt };
        }
        
        // טיימר במצב הפרעה נחשב פעיל
        if (data.isInterrupted === true && data.startTime) {
          return { taskId: activeTimerId, isRunning: false, isPaused: false, isInterrupted: true };
        }
      } else {
        // מפתח יתום - מנקים כדי לא לחסום מנגנון התראות
        localStorage.removeItem('zmanit_active_timer');
      }
      
      // ✅ תיקון: בדיקת מפתח ישן של TaskTimer (timer_{id}_startTime)
      const oldTimerKey = `timer_${activeTimerId}_startTime`;
      const oldStartTime = localStorage.getItem(oldTimerKey);
      if (oldStartTime) {
        return { taskId: activeTimerId, isRunning: true, isPaused: false, isInterrupted: false };
      }
    }
    
    // בדיקה 2: סריקת כל הטיימרים timer_v2_
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          const taskId = key.replace('timer_v2_', '');
          
          if (data.isRunning === true && data.startTime) {
            localStorage.setItem('zmanit_active_timer', taskId);
            return { taskId, isRunning: true, isPaused: false, isInterrupted: false };
          }
          
          if (data.isPaused === true) {
            let pausedAt = data.pausedAt;
            if (!pausedAt) {
              try {
                const focusPaused = JSON.parse(localStorage.getItem('zmanit_focus_paused') || '{}');
                if (focusPaused.isPaused && focusPaused.taskId === taskId) {
                  pausedAt = focusPaused.pausedAt;
                }
              } catch (e) {}
            }
            return { taskId, isRunning: false, isPaused: true, pausedAt };
          }
          
          if (data.isInterrupted === true && data.startTime) {
            return { taskId, isRunning: false, isPaused: false, isInterrupted: true };
          }
        } catch (e) {
          // התעלם משגיאות parsing
        }
      }
    }
    
    // בדיקה 3: סריקת מפתחות ישנים timer_{id}_startTime
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_') && key?.endsWith('_startTime') && !key.startsWith('timer_v2_')) {
        const taskId = key.replace('timer_', '').replace('_startTime', '');
        if (taskId && taskId.length > 10) { // UUID is long enough
          localStorage.setItem('zmanit_active_timer', taskId);
          return { taskId, isRunning: true, isPaused: false, isInterrupted: false };
        }
      }
    }
    
    // בדיקה 4: מצב focus מושהה
    const pausedData = localStorage.getItem('zmanit_focus_paused');
    if (pausedData) {
      try {
        const data = JSON.parse(pausedData);
        if (data.isPaused && data.taskId) {
          return { taskId: data.taskId, isRunning: false, isPaused: true, pausedAt: data.pausedAt };
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('[Notifications] שגיאה בבדיקת טיימר:', e);
  }
  
  return null;
}

/**
 * קריאת הזמן שעבר מהטיימר
 */
function getElapsedTimeFromTimer(taskId) {
  try {
    // נסה קודם את הפורמט החדש
    const timerData = localStorage.getItem(`timer_v2_${taskId}`);
    if (timerData) {
      const data = JSON.parse(timerData);
      let totalMs = data.accumulatedTime || data.elapsed || 0;
      
      if (data.isRunning && data.startTime) {
        const startTime = new Date(data.startTime).getTime();
        totalMs += (Date.now() - startTime);
      }
      
      return Math.floor(totalMs / 60000);
    }
    
    // נסה את הפורמט הישן (timer_{id}_startTime)
    const oldStartTime = localStorage.getItem(`timer_${taskId}_startTime`);
    if (oldStartTime) {
      const startTime = new Date(oldStartTime).getTime();
      return Math.floor((Date.now() - startTime) / 60000);
    }
    
    return 0;
  } catch (e) {
    return 0;
  }
}

/**
 * שמירת התראה להיסטוריה
 */
function logNotificationToHistory(type, title, message) {
  try {
    const history = JSON.parse(localStorage.getItem('zmanit_notification_history') || '[]');
    history.unshift({ id: Date.now(), type, title, message, timestamp: Date.now() });
    localStorage.setItem('zmanit_notification_history', JSON.stringify(history.slice(0, 100)));
  } catch (e) {}
}

/**
 * ✅ תיקון v3.1: קבלת מזהה המשימה ההורית (אם יש)
 * אם זה אינטרוול, מחזיר את ה-parent_task_id
 * אחרת מחזיר את ה-id של המשימה עצמה
 */
function getParentTaskId(task) {
  if (!task) return null;
  return task.parent_task_id || task.id;
}

// ============================================
// הוק ניהול התראות
// ============================================

export function useUnifiedNotifications() {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const { permission, sendNotification, playSound } = useNotifications();
  
  // מצבים
  const [overdueTaskPopup, setOverdueTaskPopup] = useState(null);
  const [procrastinationPopup, setProcrastinationPopup] = useState(null);
  
  // refs
  const lastNotifiedRef = useRef({});
  const checkIntervalRef = useRef(null);
  const sessionStartRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const prevTimerStateRef = useRef(null);
  const tasksRef = useRef(tasks);
  
  // ✅ תיקון v3.1: מעקב אחרי התראות למשימות הוריות (לא רק ID בודדים)
  const notifiedParentTasksRef = useRef(new Set());
  
  // עדכון ref של משימות
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  
  // מעקב פעילות
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, []);
  
  /**
   * בדיקה אם ניתן לשלוח התראה (מניעת כפילויות)
   */
  const canNotify = useCallback((key, minIntervalMinutes) => {
    const now = Date.now();
    
    // grace period
    if (now - sessionStartRef.current < CONFIG.GRACE_PERIOD_MS) {
      return false;
    }
    
    const lastNotified = lastNotifiedRef.current[key];
    if (!lastNotified) return true;
    
    const minutesSince = (now - lastNotified) / (1000 * 60);
    return minutesSince >= minIntervalMinutes;
  }, []);
  
  /**
   * סימון שנשלחה התראה
   */
  const markNotified = useCallback((key) => {
    lastNotifiedRef.current[key] = Date.now();
  }, []);
  
  /**
   * ✅ תיקון v3.1: בדיקה אם כבר שלחנו התראה למשימה הורית זו
   * מונע התראות כפולות לאינטרוולים של אותה משימה
   */
  const canNotifyForTask = useCallback((task, notificationType, minIntervalMinutes) => {
    const parentId = getParentTaskId(task);
    const key = `${parentId}-${notificationType}`;
    return canNotify(key, minIntervalMinutes);
  }, [canNotify]);
  
  /**
   * ✅ תיקון v3.1: סימון שנשלחה התראה למשימה (כולל אינטרוולים)
   */
  const markNotifiedForTask = useCallback((task, notificationType) => {
    const parentId = getParentTaskId(task);
    const key = `${parentId}-${notificationType}`;
    markNotified(key);
  }, [markNotified]);
  
  /**
   * ניקוי התראות למשימה
   */
  const clearNotificationsForTask = useCallback((taskId) => {
    Object.keys(lastNotifiedRef.current)
      .filter(key => key.startsWith(`${taskId}-`))
      .forEach(key => delete lastNotifiedRef.current[key]);
  }, []);
  
  /**
   * בדיקת משימות ושליחת התראות
   */
  const checkAndNotify = useCallback(() => {
    if (!tasks || tasks.length === 0) return;
    
    const hasPushPermission = permission === 'granted';
    const now = new Date();
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // הגדרות שעות עבודה
    const workSettings = getWorkHoursSettings(user?.id);
    const isWorkDay = workSettings.workDays.includes(dayOfWeek);
    const isWorkHours = isWorkDay && 
                        currentMinutes >= workSettings.startMinutes && 
                        currentMinutes <= workSettings.endMinutes;
    
    // ✅ תיקון v3.1: בדיקה משופרת של מצב טיימר
    const timerInfo = getActiveTimerInfo();
    const hasActiveTimer = timerInfo !== null;
    const hasRunningTimer = timerInfo?.isRunning === true;
    const hasInterruptedTimer = timerInfo?.isInterrupted === true;
    
    // איפוס grace period כשטיימר נעצר
    if (prevTimerStateRef.current !== null && prevTimerStateRef.current !== hasActiveTimer && !hasActiveTimer) {
      sessionStartRef.current = Date.now();
    }
    prevTimerStateRef.current = hasActiveTimer;
    
    // ========================================
    // ✅ תיקון v3.1: אם יש טיימר רץ או במצב הפרעה - 
    // לא שולחים התראות על משימות אחרות!
    // ========================================
    if (hasRunningTimer || hasInterruptedTimer) {
      const activeTaskId = timerInfo.taskId;
      const activeTask = tasks.find(t => t.id === activeTaskId);
      
      // בודקים רק את המשימה הפעילה (אזהרת סיום זמן)
      if (activeTask?.estimated_duration) {
        // ✅ תיקון: כולל את time_spent מהDB + זמן הסשן הנוכחי מהטיימר
        const timerElapsed = getElapsedTimeFromTimer(activeTask.id);
        const dbTimeSpent = parseInt(activeTask.time_spent) || 0;
        const totalTimeSpent = dbTimeSpent + timerElapsed;
        const remaining = activeTask.estimated_duration - totalTimeSpent;
        
        // 5 דקות לסיום
        if (remaining > 0 && remaining <= CONFIG.THRESHOLD.TIME_ENDING) {
          if (canNotifyForTask(activeTask, 'ending-soon', 3)) {
            if (hasPushPermission) {
              sendNotification(`⏳ ${activeTask.title}`, {
                body: `נשארו ${remaining} דקות`,
                tag: `task-ending-${activeTask.id}`,
                taskId: activeTask.id
              });
            }
            toast(`⏳ נשארו ${remaining} דקות ל-${activeTask.title}`, { duration: 5000, icon: '⏰' });
            markNotifiedForTask(activeTask, 'ending-soon');
          }
        }
        
        // הזמן נגמר
        if (remaining <= 0) {
          if (canNotifyForTask(activeTask, 'time-up', 5)) {
            if (hasPushPermission) {
              sendNotification(`🔔 הזמן נגמר: ${activeTask.title}`, {
                body: 'הזמן המוקצב הסתיים',
                tag: `task-timeup-${activeTask.id}`,
                taskId: activeTask.id
              });
            }
            toast.error(`🔔 הזמן נגמר: ${activeTask.title}`, { duration: 8000 });
            markNotifiedForTask(activeTask, 'time-up');
          }
        }
      }
      
      // ✅ תיקון v3.1: לא ממשיכים לבדוק משימות אחרות כשיש טיימר פעיל!
      return;
    }
    
    // ========================================
    // 1. בדיקת טיימר מושהה יותר מדי זמן
    // ========================================
    if (timerInfo?.isPaused && isWorkHours) {
      const pausedAt = timerInfo.pausedAt ? new Date(timerInfo.pausedAt).getTime() : 0;
      const pausedMinutes = pausedAt ? Math.floor((Date.now() - pausedAt) / 60000) : 0;
      
      if (pausedMinutes >= CONFIG.THRESHOLD.PAUSED_TIMER) {
        if (canNotify('paused-timer-too-long', CONFIG.MIN_INTERVAL.PAUSED_TIMER)) {
          const pausedTask = tasks.find(t => t.id === timerInfo.taskId);
          const taskTitle = pausedTask?.title || 'משימה';
          
          playSound?.('warning');
          logNotificationToHistory('paused', taskTitle, `מושהית ${pausedMinutes} דקות`);
          toast(`⏸️ ${taskTitle} מושהית כבר ${pausedMinutes} דקות`, { duration: 10000, icon: '⏸️' });
          
          if (hasPushPermission) {
            sendNotification(`⏸️ ${taskTitle} מושהית`, {
              body: `המשימה מושהית כבר ${pausedMinutes} דקות`,
              tag: 'paused-too-long',
              taskId: timerInfo.taskId
            });
          }
          
          setProcrastinationPopup({
            type: 'paused-too-long',
            title: `⏸️ ${taskTitle} מושהית`,
            message: `המשימה מושהית כבר ${pausedMinutes} דקות. להמשיך לעבוד?`,
            taskId: timerInfo.taskId,
            taskTitle,
            actions: [
              { id: 'resume_task', label: '▶️ המשך עבודה', primary: true },
              { id: 'switch_task', label: '🔄 עבור למשימה אחרת' },
              { id: 'snooze_10', label: '⏱️ הזכר בעוד 10 דק׳' }
            ]
          });
          
          markNotified('paused-timer-too-long');
        }
      }
      // ✅ תיקון: לא עושים return כאן! ממשיכים לבדוק התראות אחרות
    }
    
    // ========================================
    // 2. בשעות עבודה ללא טיימר פעיל (לא רץ ולא מושהה) - תזכורת
    // ========================================
    // ✅ תיקון: hasActiveTimer כולל גם מושהה, אז צריך לבדוק ספציפית
    const hasNoWorkingTimer = !hasRunningTimer && !timerInfo?.isPaused && !hasInterruptedTimer;
    
    if (isWorkHours && hasNoWorkingTimer && !CONFIG.USE_LEGACY_IDLE_POPUP) {
      if (canNotify('work-hours-no-timer', CONFIG.MIN_INTERVAL.NO_TIMER)) {
        // ✅ תיקון v3.1: מסננים משימות הוריות!
        const pendingTasks = tasks.filter(t => 
          t.due_date === today && 
          !t.is_completed && 
          !t.is_project  // לא כוללים משימות הוריות
        );
        
        if (pendingTasks.length > 0) {
          const timedTasks = pendingTasks.filter(t => t.due_time);
          const untimedTasks = pendingTasks.filter(t => !t.due_time);

          // ✅ מחפשים קודם משימות עם שעה שכבר הגיע זמנן/מתחילות ממש בקרוב
          let relevantTask = timedTasks
            .sort((a, b) => a.due_time.localeCompare(b.due_time))
            .find(t => {
              const [h, m] = t.due_time.split(':').map(Number);
              const taskMinutes = h * 60 + (m || 0);
              return taskMinutes <= currentMinutes + 5 && taskMinutes >= currentMinutes - 30;
            });

          // אם אין משימה עם שעה רלוונטית - לוקחים משימה לא מתוזמנת לפי עדיפות
          if (!relevantTask && untimedTasks.length > 0) {
            const priorityOrder = { urgent: 0, high: 1, normal: 2 };
            relevantTask = [...untimedTasks].sort((a, b) => {
              const aScore = priorityOrder[a.priority] ?? 2;
              const bScore = priorityOrder[b.priority] ?? 2;
              if (aScore !== bScore) return aScore - bScore;
              return (a.created_at || '').localeCompare(b.created_at || '');
            })[0];
          }
          
          if (relevantTask) {
            playSound?.('warning');
            logNotificationToHistory('no_timer', 'את בשעות העבודה!', relevantTask.title);
            
            if (hasPushPermission) {
              sendNotification('⏰ את בשעות העבודה!', {
                body: relevantTask.due_time
                  ? `המשימה הבאה: ${relevantTask.title} (${relevantTask.due_time})`
                  : `יש משימה פתוחה שדורשת התחלה: ${relevantTask.title}`,
                tag: 'no-timer-warning',
                taskId: relevantTask.id
              });
            }
            
            setProcrastinationPopup({
              type: 'no-timer',
              title: '⏰ את בשעות העבודה!',
              message: relevantTask.due_time
                ? `אין טיימר פעיל. המשימה הבאה: "${relevantTask.title}" (${relevantTask.due_time})`
                : `אין טיימר פעיל. אפשר להתחיל עכשיו עם "${relevantTask.title}".`,
              taskId: relevantTask.id,
              taskTitle: relevantTask.title,
              actions: [
                { id: 'start_task', label: '▶️ התחל משימה', primary: true },
                { id: 'snooze_10', label: '⏱️ הזכר בעוד 10 דק׳' },
                { id: 'dismiss', label: '❌ סגור' }
              ]
            });
            
            markNotified('work-hours-no-timer');
          }
        }
      }
    }
    
    // ========================================
    // 3. בדיקת משימות היום (רק אם אין טיימר רץ!)
    // ========================================
    if (hasNoWorkingTimer) {
      // ✅ תיקון v3.1: מסננים משימות הוריות!
      const todayTasks = tasks.filter(task => {
        if (task.is_completed || task.is_project || task.was_deferred) return false;
        const taskDate = normalizeTaskDate(task.due_date);
        return taskDate === today && task.due_time;
      });
      
      // ✅ תיקון v3.1: מעקב אחרי משימות הוריות שכבר קיבלו התראה
      const notifiedParentIds = new Set();
      
      todayTasks.forEach(task => {
        // ✅ תיקון v3.1: אם זה אינטרוול, בודקים אם ההורה כבר קיבל התראה
        const parentId = getParentTaskId(task);
        if (notifiedParentIds.has(parentId)) {
          return; // כבר שלחנו התראה למשימה הזו (או לאינטרוול אחר שלה)
        }
        
        const [hour, min] = task.due_time.split(':').map(Number);
        const taskStartMinutes = hour * 60 + (min || 0);
        const diffFromStart = taskStartMinutes - currentMinutes;
        
        // 5 דקות לפני התחלה
        if (diffFromStart > 0 && diffFromStart <= CONFIG.THRESHOLD.TASK_STARTING_SOON) {
          if (canNotifyForTask(task, 'before', CONFIG.MIN_INTERVAL.TASK_STARTING)) {
            if (hasPushPermission) {
              sendNotification(`⏰ ${task.title}`, {
                body: `מתחיל בעוד ${diffFromStart} דקות`,
                tag: `task-before-${parentId}`,
                taskId: task.id
              });
            }
            playSound?.('default');
            toast(`⏰ ${task.title} מתחיל בעוד ${diffFromStart} דקות`, { duration: 8000 });
            markNotifiedForTask(task, 'before');
            notifiedParentIds.add(parentId);
          }
        }
        
        // בדיוק בזמן
        if (diffFromStart >= -1 && diffFromStart <= 1) {
          if (canNotifyForTask(task, 'ontime', CONFIG.MIN_INTERVAL.TASK_STARTING)) {
            if (hasPushPermission) {
              sendNotification(`🔔 ${task.title}`, {
                body: 'הגיע הזמן להתחיל!',
                tag: `task-ontime-${parentId}`,
                taskId: task.id
              });
            }
            playSound?.('warning');
            toast.success(`🔔 הגיע הזמן להתחיל: ${task.title}`, { duration: 10000 });
            markNotifiedForTask(task, 'ontime');
            notifiedParentIds.add(parentId);
          }
        }
        
        // באיחור
        if (diffFromStart < -CONFIG.THRESHOLD.TASK_LATE_MIN && 
            diffFromStart > -CONFIG.THRESHOLD.TASK_LATE_MAX) {
          if (!task.time_spent || task.time_spent === 0) {
            if (canNotifyForTask(task, 'late', CONFIG.MIN_INTERVAL.TASK_OVERDUE)) {
              const lateMinutes = Math.abs(Math.round(diffFromStart));
              
              playSound?.('warning');
              logNotificationToHistory('overdue', task.title, `באיחור ${lateMinutes} דקות`);
              
              if (hasPushPermission) {
                sendNotification(`🔴 ${task.title}`, {
                  body: `היית אמורה להתחיל לפני ${lateMinutes} דקות`,
                  tag: `task-late-${parentId}`,
                  taskId: task.id
                });
              }
              
              // פופאפ משימה באיחור
              setOverdueTaskPopup(task);
              markNotifiedForTask(task, 'late');
              notifiedParentIds.add(parentId);
            }
          }
        }
      });
    }
    
    // ========================================
    // 4. בדיקת אירועי Google Calendar
    // ========================================
    try {
      const calendarEventsData = localStorage.getItem('zmanit_calendar_events_today');
      if (calendarEventsData) {
        const events = JSON.parse(calendarEventsData);
        
        events.forEach(event => {
          if (!event.start?.dateTime) return;
          
          const startTime = new Date(event.start.dateTime);
          const eventMinutes = startTime.getHours() * 60 + startTime.getMinutes();
          const diff = eventMinutes - currentMinutes;
          
          // 10 דקות לפני
          if (diff > 0 && diff <= 10) {
            if (canNotify(`calendar-${event.id}-before`, CONFIG.MIN_INTERVAL.CALENDAR)) {
              const eventTitle = event.summary || 'אירוע';
              const timeStr = startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
              
              playSound?.('default');
              
              if (hasPushPermission) {
                sendNotification(`📅 ${eventTitle}`, {
                  body: `מתחיל בעוד ${diff} דקות (${timeStr})`,
                  tag: `calendar-${event.id}`
                });
              }
              
              toast(`📅 ${eventTitle} - בעוד ${diff} דקות`, { duration: 8000, icon: '📅' });
              markNotified(`calendar-${event.id}-before`);
            }
          }
        });
      }
    } catch (e) {}

    // ========================================
    // 5. התראת פיגור יומי מול קיבולת היום
    // ========================================
    if (hasNoWorkingTimer && isWorkHours) {
      const todayPending = tasks.filter(t =>
        !t.is_completed &&
        !t.is_project &&
        !t.was_deferred &&
        t.due_date === today
      );

      if (todayPending.length > 0) {
        const remainingWorkMinutes = getRemainingWorkMinutesToday(workSettings, now);
        const pendingMinutes = todayPending.reduce(
          (sum, t) => sum + (parseInt(t.estimated_duration, 10) || 30),
          0
        );
        const overloadMinutes = pendingMinutes - remainingWorkMinutes;
        const urgentCount = todayPending.filter(t => t.priority === 'urgent' || t.quadrant === 1).length;

        if (overloadMinutes > 20 && canNotify('daily-overload', 20)) {
          const body = urgentCount > 0
            ? `חסר זמן של כ-${overloadMinutes} דק׳ היום. ${urgentCount} משימות דחופות ממתינות.`
            : `חסר זמן של כ-${overloadMinutes} דק׳ היום ביחס למשימות שנשארו.`;

          if (hasPushPermission) {
            sendNotification('📉 את בפיגור מול תכנון היום', {
              body,
              tag: 'daily-overload'
            });
          }

          toast.error(`📉 פיגור יומי של כ-${overloadMinutes} דק׳`, { duration: 9000 });
          markNotified('daily-overload');
        }
      }
    }
    
  }, [tasks, permission, user?.id, canNotify, canNotifyForTask, markNotified, markNotifiedForTask, sendNotification, playSound]);
  
  // הפעלת בדיקה תקופתית
  useEffect(() => {
    checkAndNotify();
    checkIntervalRef.current = setInterval(checkAndNotify, CONFIG.CHECK_INTERVAL_MS);
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkAndNotify]);
  
  // סגירת פופאפ דחיינות
  const dismissProcrastinationPopup = useCallback(() => {
    setProcrastinationPopup(null);
  }, []);
  
  // טיפול בפעולה על פופאפ דחיינות
  const handleProcrastinationAction = useCallback((actionId) => {
    const popup = procrastinationPopup;
    
    switch (actionId) {
      case 'start_task':
      case 'resume_task':
        if (popup?.taskId) {
          localStorage.setItem('start_task_id', popup.taskId);
        }
        window.location.href = '/daily';
        break;
        
      case 'switch_task':
        window.location.href = '/daily';
        break;
        
      case 'snooze_10':
        toast('⏱️ נזכיר בעוד 10 דקות', { duration: 2000 });
        // איפוס ה-canNotify
        if (popup?.type === 'no-timer') {
          lastNotifiedRef.current['work-hours-no-timer'] = Date.now() - (5 * 60 * 1000);
        } else if (popup?.type === 'paused-too-long') {
          lastNotifiedRef.current['paused-timer-too-long'] = Date.now() - (5 * 60 * 1000);
        }
        break;
        
      case 'dismiss':
      default:
        break;
    }
    
    dismissProcrastinationPopup();
  }, [procrastinationPopup, dismissProcrastinationPopup]);
  
  return {
    overdueTaskPopup,
    setOverdueTaskPopup,
    procrastinationPopup,
    dismissProcrastinationPopup,
    handleProcrastinationAction,
    checkAndNotify,
    clearNotificationsForTask
  };
}

// ============================================
// קומפוננטת UI
// ============================================

export function UnifiedNotificationManager() {
  const { 
    overdueTaskPopup,
    setOverdueTaskPopup,
    procrastinationPopup,
    dismissProcrastinationPopup,
    handleProcrastinationAction
  } = useUnifiedNotifications();
  
  // פופאפ משימה באיחור
  if (overdueTaskPopup) {
    return (
      <OverdueTaskPopup
        isOpen={true}
        task={overdueTaskPopup}
        onClose={() => setOverdueTaskPopup(null)}
        onStartTask={(taskId) => {
          console.log('התחלת עבודה על משימה:', taskId);
        }}
      />
    );
  }
  
  // פופאפ דחיינות
  if (procrastinationPopup) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-bounce-in relative border-4 border-orange-400">
          
          <div className="text-5xl mb-4 animate-pulse">
            {procrastinationPopup.type === 'no-timer' ? '⏰' : '⏸️'}
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {procrastinationPopup.title}
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            {procrastinationPopup.message}
          </p>
          
          <div className="flex flex-col gap-3">
            {procrastinationPopup.actions?.map((action) => (
              <button
                key={action.id}
                onClick={() => handleProcrastinationAction(action.id)}
                className={`
                  w-full py-3 px-4 rounded-xl font-medium transition-all text-lg
                  ${action.primary 
                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
          
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            💪 את יכולה לעשות את זה!
          </p>
        </div>
      </div>
    );
  }
  
  return null;
}

export default UnifiedNotificationManager;
