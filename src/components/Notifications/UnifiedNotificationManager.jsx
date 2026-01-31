/**
 * מנהל התראות מאוחד - UnifiedNotificationManager v3.0
 * =====================================================
 * 
 * מערכת התראות יחידה ומרכזית!
 * מחליפה את כל המערכות הקודמות:
 * - smartAlertManager (נמחק)
 * - notificationService (נמחק)
 * - WhyNotStartedDetector (הועבר לכאן)
 * - IdleDetector (הועבר לכאן)
 * 
 * ✅ עקרונות:
 * 1. מקור אחד לכל ההתראות
 * 2. מניעת כפילויות מובנית
 * 3. תור התראות עם עדיפויות
 * 4. למידה מהתנהגות המשתמש
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
  // מרווחי בדיקה
  CHECK_INTERVAL_MS: 30 * 1000,        // בדיקה כל 30 שניות
  GRACE_PERIOD_MS: 2 * 60 * 1000,      // 2 דקות חסד בתחילת סשן
  
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
    PAUSED_TIMER: 10,         // טיימר מושהה יותר מ-10 דק'
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
 * בדיקה אם יש טיימר פעיל (רץ או מושהה)
 */
function getActiveTimerInfo() {
  try {
    const activeTimerId = localStorage.getItem('zmanit_active_timer');
    
    if (activeTimerId && activeTimerId !== 'null' && activeTimerId !== 'undefined') {
      const timerData = localStorage.getItem(`timer_v2_${activeTimerId}`);
      if (timerData) {
        const data = JSON.parse(timerData);
        
        if (data.isRunning === true && data.startTime) {
          return { taskId: activeTimerId, isRunning: true, isPaused: false };
        }
        
        if (data.isPaused === true) {
          return { taskId: activeTimerId, isRunning: false, isPaused: true, pausedAt: data.pausedAt };
        }
      }
    }
    
    // סריקת כל הטיימרים
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const taskId = key.replace('timer_v2_', '');
        
        if (data.isRunning === true && data.startTime) {
          localStorage.setItem('zmanit_active_timer', taskId);
          return { taskId, isRunning: true, isPaused: false };
        }
        
        if (data.isPaused === true) {
          return { taskId, isRunning: false, isPaused: true, pausedAt: data.pausedAt };
        }
      }
    }
    
    // בדיקת zmanit_focus_paused
    const pausedData = localStorage.getItem('zmanit_focus_paused');
    if (pausedData) {
      const data = JSON.parse(pausedData);
      if (data.isPaused && data.taskId) {
        return { taskId: data.taskId, isRunning: false, isPaused: true, pausedAt: data.pausedAt };
      }
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
    const timerData = localStorage.getItem(`timer_v2_${taskId}`);
    if (!timerData) return 0;
    
    const data = JSON.parse(timerData);
    let totalMs = data.accumulatedTime || data.elapsed || 0;
    
    if (data.isRunning && data.startTime) {
      const startTime = new Date(data.startTime).getTime();
      totalMs += (Date.now() - startTime);
    }
    
    return Math.floor(totalMs / 60000);
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
    
    // מצב טיימר
    const timerInfo = getActiveTimerInfo();
    const hasActiveTimer = timerInfo !== null;
    const hasRunningTimer = timerInfo?.isRunning === true;
    
    // איפוס grace period כשטיימר נעצר
    if (prevTimerStateRef.current !== null && prevTimerStateRef.current !== hasActiveTimer && !hasActiveTimer) {
      sessionStartRef.current = Date.now();
    }
    prevTimerStateRef.current = hasActiveTimer;
    
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
          
          if (hasPushPermission) {
            sendNotification(`⏸️ ${taskTitle} מושהית`, {
              body: `המשימה מושהית כבר ${pausedMinutes} דקות`,
              tag: 'paused-too-long'
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
      return; // יש טיימר מושהה - לא בודקים דברים אחרים
    }
    
    // ========================================
    // 2. אם יש טיימר רץ - בדיקות רק למשימה הפעילה
    // ========================================
    if (hasRunningTimer && timerInfo?.taskId) {
      const activeTask = tasks.find(t => t.id === timerInfo.taskId);
      if (activeTask?.estimated_duration) {
        const timeSpent = getElapsedTimeFromTimer(activeTask.id);
        const remaining = activeTask.estimated_duration - timeSpent;
        
        // 5 דקות לסיום
        if (remaining > 0 && remaining <= CONFIG.THRESHOLD.TIME_ENDING) {
          if (canNotify(`${activeTask.id}-ending-soon`, 3)) {
            if (hasPushPermission) {
              sendNotification(`⏳ ${activeTask.title}`, {
                body: `נשארו ${remaining} דקות`,
                tag: `task-ending-${activeTask.id}`
              });
            }
            toast(`⏳ נשארו ${remaining} דקות ל-${activeTask.title}`, { duration: 5000, icon: '⏰' });
            markNotified(`${activeTask.id}-ending-soon`);
          }
        }
        
        // הזמן נגמר
        if (remaining <= 0) {
          if (canNotify(`${activeTask.id}-time-up`, 5)) {
            if (hasPushPermission) {
              sendNotification(`🔔 הזמן נגמר: ${activeTask.title}`, {
                body: 'הזמן המוקצב הסתיים',
                tag: `task-timeup-${activeTask.id}`
              });
            }
            toast.error(`🔔 הזמן נגמר: ${activeTask.title}`, { duration: 8000 });
            markNotified(`${activeTask.id}-time-up`);
          }
        }
      }
      return; // יש טיימר רץ - לא בודקים משימות אחרות
    }
    
    // ========================================
    // 3. בשעות עבודה ללא טיימר - תזכורת
    // ========================================
    if (isWorkHours && !hasActiveTimer) {
      if (canNotify('work-hours-no-timer', CONFIG.MIN_INTERVAL.NO_TIMER)) {
        const pendingTasks = tasks.filter(t => 
          t.due_date === today && 
          !t.is_completed && 
          t.due_time &&
          !t.is_project
        );
        
        if (pendingTasks.length > 0) {
          const nextTask = pendingTasks
            .sort((a, b) => a.due_time.localeCompare(b.due_time))
            .find(t => {
              const [h, m] = t.due_time.split(':').map(Number);
              return (h * 60 + (m || 0)) >= currentMinutes - 30;
            });
          
          if (nextTask) {
            playSound?.('warning');
            logNotificationToHistory('no_timer', 'את בשעות העבודה!', nextTask.title);
            
            if (hasPushPermission) {
              sendNotification('⏰ את בשעות העבודה!', {
                body: `המשימה הבאה: ${nextTask.title} (${nextTask.due_time})`,
                tag: 'no-timer-warning'
              });
            }
            
            setProcrastinationPopup({
              type: 'no-timer',
              title: '⏰ את בשעות העבודה!',
              message: `אין טיימר פעיל. המשימה הבאה: "${nextTask.title}" (${nextTask.due_time})`,
              taskId: nextTask.id,
              taskTitle: nextTask.title,
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
    // 4. בדיקת משימות היום (רק אם אין טיימר)
    // ========================================
    if (!hasActiveTimer) {
      const todayTasks = tasks.filter(task => {
        if (task.is_completed || task.is_project || task.was_deferred) return false;
        const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
        return taskDate === today && task.due_time;
      });
      
      todayTasks.forEach(task => {
        const [hour, min] = task.due_time.split(':').map(Number);
        const taskStartMinutes = hour * 60 + (min || 0);
        const diffFromStart = taskStartMinutes - currentMinutes;
        
        // 5 דקות לפני התחלה
        if (diffFromStart > 0 && diffFromStart <= CONFIG.THRESHOLD.TASK_STARTING_SOON) {
          if (canNotify(`${task.id}-before`, CONFIG.MIN_INTERVAL.TASK_STARTING)) {
            if (hasPushPermission) {
              sendNotification(`⏰ ${task.title}`, {
                body: `מתחיל בעוד ${diffFromStart} דקות`,
                tag: `task-before-${task.id}`
              });
            }
            toast(`⏰ ${task.title} מתחיל בעוד ${diffFromStart} דקות`, { duration: 5000 });
            markNotified(`${task.id}-before`);
          }
        }
        
        // בדיוק בזמן
        if (diffFromStart >= -1 && diffFromStart <= 1) {
          if (canNotify(`${task.id}-ontime`, CONFIG.MIN_INTERVAL.TASK_STARTING)) {
            if (hasPushPermission) {
              sendNotification(`🔔 ${task.title}`, {
                body: 'הגיע הזמן להתחיל!',
                tag: `task-ontime-${task.id}`
              });
            }
            toast.success(`🔔 הגיע הזמן להתחיל: ${task.title}`, { duration: 8000 });
            markNotified(`${task.id}-ontime`);
          }
        }
        
        // באיחור
        if (diffFromStart < -CONFIG.THRESHOLD.TASK_LATE_MIN && 
            diffFromStart > -CONFIG.THRESHOLD.TASK_LATE_MAX) {
          if (!task.time_spent || task.time_spent === 0) {
            if (canNotify(`${task.id}-late`, CONFIG.MIN_INTERVAL.TASK_OVERDUE)) {
              const lateMinutes = Math.abs(Math.round(diffFromStart));
              
              playSound?.('warning');
              logNotificationToHistory('overdue', task.title, `באיחור ${lateMinutes} דקות`);
              
              if (hasPushPermission) {
                sendNotification(`🔴 ${task.title}`, {
                  body: `היית אמורה להתחיל לפני ${lateMinutes} דקות`,
                  tag: `task-late-${task.id}`
                });
              }
              
              // פופאפ משימה באיחור
              setOverdueTaskPopup(task);
              markNotified(`${task.id}-late`);
            }
          }
        }
      });
    }
    
    // ========================================
    // 5. בדיקת אירועי Google Calendar
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
    
  }, [tasks, permission, user?.id, canNotify, markNotified, sendNotification, playSound]);
  
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
