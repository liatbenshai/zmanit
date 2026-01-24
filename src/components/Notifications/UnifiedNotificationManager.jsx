/**
 * מנהל התראות מאוחד - UnifiedNotificationManager
 * ================================================
 * 
 * מתאם בין כל מערכות ההתראה:
 * 1. NotificationChecker - התראות דפדפן
 * 2. smartAlertManager - התראות בתוך האפליקציה
 * 3. OverdueTaskManager - פופאפים למשימות באיחור
 * 
 * פותר את בעיית ההתראות הכפולות והלא מתואמות!
 * 
 * ✅ שיפורים:
 * - פופאפ חוסם לדחיינות (לא רק toast)
 * - התראות קוליות
 * - בדיקת Push notifications
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useNotifications } from '../../hooks/useNotifications';
import alertManager, { ALERT_TYPES, ALERT_PRIORITY } from '../../utils/smartAlertManager';
import toast from 'react-hot-toast';

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
 * בדיקה אם יש טיימר פעיל על משימה כלשהי
 * 🔧 תיקון: בודקים גם אם הטיימר באמת רץ, לא רק אם יש ID
 */
function getActiveTaskId() {
  try {
    const activeTimer = localStorage.getItem('zmanit_active_timer');
    if (activeTimer && activeTimer !== 'null' && activeTimer !== 'undefined') {
      // 🔧 חשוב: בודקים אם הטיימר באמת רץ!
      const timerData = localStorage.getItem(`timer_v2_${activeTimer}`);
      if (timerData) {
        try {
          const data = JSON.parse(timerData);
          // רק אם הטיימר באמת רץ (לא מושהה, לא נעצר)
          if (data.isRunning === true && data.startTime) {
            console.log('🔔 [Notifications] טיימר פעיל ורץ:', activeTimer);
            return activeTimer;
          }
        } catch (e) {}
      }
      // אין נתוני טיימר או הטיימר לא רץ - מנקים
      console.log('🔔 [Notifications] יש ID אבל הטיימר לא רץ');
    }
  } catch (e) {
    console.error('🔔 [Notifications] שגיאה בבדיקת טיימר:', e);
  }
  return null;
}

/**
 * 🔧 חדש: קריאת הזמן שעבר מהטיימר (מ-localStorage)
 * מחזיר את הזמן בדקות
 */
function getElapsedTimeFromTimer(taskId) {
  try {
    const timerData = localStorage.getItem(`timer_v2_${taskId}`);
    if (!timerData) return 0;
    
    const data = JSON.parse(timerData);
    let totalMs = data.accumulatedTime || data.elapsed || 0;
    
    // אם הטיימר רץ עכשיו, מוסיפים את הזמן מאז startTime
    if (data.isRunning && data.startTime) {
      const startTime = new Date(data.startTime).getTime();
      const now = Date.now();
      totalMs += (now - startTime);
    }
    
    // המרה לדקות
    return Math.floor(totalMs / 60000);
  } catch (e) {
    console.error('🔔 [Notifications] שגיאה בקריאת זמן טיימר:', e);
    return 0;
  }
}

/**
 * Hook מאוחד לניהול התראות
 */
export function useUnifiedNotifications() {
  const { tasks } = useTasks();
  const { permission, sendNotification, playSound, requestPermission } = useNotifications();
  
  // מצב התראות
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertQueue, setAlertQueue] = useState([]);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  
  // ✅ חדש: מצב פופאפ דחיינות
  const [procrastinationPopup, setProcrastinationPopup] = useState(null);
  
  // refs למניעת התראות כפולות
  const lastNotifiedRef = useRef({});
  const checkIntervalRef = useRef(null);
  
  // ✅ חדש: קריאת הגדרות מותאמות
  const getNotificationSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('zmanit_notification_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    // ברירות מחדל
    return {
      noTimerReminder: { enabled: true, intervalMinutes: 10 },
      pausedTaskReminder: { enabled: true, afterMinutes: 10 },
      overdueTaskReminder: { enabled: true, intervalMinutes: 15 },
      calendarReminder: { enabled: true, minutesBefore: 10 }
    };
  }, []);
  
  // ✅ חדש: שמירת התראה להיסטוריה
  const logNotificationToHistory = useCallback((type, title, message) => {
    try {
      const history = JSON.parse(localStorage.getItem('zmanit_notification_history') || '[]');
      history.unshift({
        id: Date.now(),
        type,
        title,
        message,
        timestamp: Date.now()
      });
      // שומר רק 100 אחרונות
      localStorage.setItem('zmanit_notification_history', JSON.stringify(history.slice(0, 100)));
    } catch (e) {}
  }, []);
  
  // ✅ אתחול מנהל ההתראות
  useEffect(() => {
    console.log('🔔 UnifiedNotificationManager: מאתחל...');
    
    alertManager.init({
      onAlert: (alert) => {
        console.log('🔔 התראה חדשה:', alert.type, alert.title);
        
        // הוספה לתור
        setAlertQueue(prev => [...prev, alert]);
      },
      onPopup: (alert) => {
        console.log('🔔 פופאפ חדש:', alert.type, alert.title);
        
        // ✅ השמעת צליל להתראות קריטיות
        if (alert.priority === ALERT_PRIORITY.CRITICAL) {
          playSound('warning');
        } else if (alert.priority === ALERT_PRIORITY.HIGH) {
          playSound('default');
        }
        
        // ✅ שמירה להיסטוריה
        logNotificationToHistory(alert.type, alert.title, alert.message);
        
        // הצגת פופאפ
        if (alert.blockingPopup) {
          setActiveAlert(alert);
          setIsAlertVisible(true);
        } else {
          // toast רגיל
          showToastAlert(alert);
        }
      }
    });
    
    return () => {
      alertManager.stopMonitoring();
    };
  }, [playSound, logNotificationToHistory]);
  
  // ✅ הצגת התראה כ-toast
  const showToastAlert = useCallback((alert) => {
    const toastOptions = {
      duration: alert.priority === ALERT_PRIORITY.CRITICAL ? 10000 : 5000,
      icon: getAlertIcon(alert.type)
    };
    
    if (alert.priority === ALERT_PRIORITY.CRITICAL) {
      toast.error(alert.message, toastOptions);
    } else if (alert.priority === ALERT_PRIORITY.HIGH) {
      toast(alert.message, { ...toastOptions, icon: '⚠️' });
    } else {
      toast(alert.message, toastOptions);
    }
  }, []);
  
  // ✅ בדיקה אם ניתן לשלוח התראה (מניעת כפילויות)
  // 🔧 תיקון: כשמשימה מתעדכנת (זמן חדש), מאפשרים התראה חדשה
  const canNotify = useCallback((taskId, type, minIntervalMinutes) => {
    const now = Date.now();
    const key = `${taskId}-${type}`;
    const lastNotified = lastNotifiedRef.current[key];
    
    if (!lastNotified) return true;
    
    const minutesSinceLastNotification = (now - lastNotified) / (1000 * 60);
    return minutesSinceLastNotification >= minIntervalMinutes;
  }, []);
  
  // ✅ סימון שנשלחה התראה
  const markNotified = useCallback((taskId, type) => {
    const key = `${taskId}-${type}`;
    lastNotifiedRef.current[key] = Date.now();
  }, []);
  
  // 🔧 חדש: ניקוי התראות למשימה כשהיא מתעדכנת
  const clearNotificationsForTask = useCallback((taskId) => {
    const keysToDelete = Object.keys(lastNotifiedRef.current).filter(key => 
      key.startsWith(`${taskId}-`)
    );
    keysToDelete.forEach(key => delete lastNotifiedRef.current[key]);
    console.log('🔔 [Notifications] ניקוי התראות למשימה:', taskId);
  }, []);
  
  // 🔧 מאזינים לשינויים ב-tasks ומנקים התראות למשימות שהשתנו
  const prevTasksRef = useRef({});
  useEffect(() => {
    if (!tasks) return;
    
    tasks.forEach(task => {
      const prev = prevTasksRef.current[task.id];
      // אם הזמן השתנה - מנקים את ההתראות
      if (prev && prev.due_time !== task.due_time) {
        clearNotificationsForTask(task.id);
      }
      prevTasksRef.current[task.id] = { due_time: task.due_time };
    });
  }, [tasks, clearNotificationsForTask]);
  
  // ✅ בדיקת התראות למשימה פעילה (עם טיימר)
  const checkActiveTaskAlerts = useCallback((task, currentMinutes, hasPushPermission = false) => {
    const estimated = task.estimated_duration || 0;
    
    if (estimated <= 0) return;
    
    const timeSpentMinutes = getElapsedTimeFromTimer(task.id);
    const remaining = estimated - timeSpentMinutes;
    
    // 5 דקות לסיום
    if (remaining > 0 && remaining <= 5) {
      if (canNotify(task.id, 'endingSoon', 3)) {
        if (hasPushPermission) {
          sendNotification(`⏳ ${task.title}`, {
            body: `נשארו ${remaining} דקות לסיום הזמן המוקצב!`,
            tag: `task-ending-${task.id}`
          });
        }
        toast(`⏳ נשארו ${remaining} דקות ל-${task.title}`, {
          duration: 5000,
          icon: '⏰'
        });
        markNotified(task.id, 'endingSoon');
      }
    }
    
    // הזמן נגמר
    if (remaining <= 0) {
      if (canNotify(task.id, 'timeUp', 5)) {
        if (hasPushPermission) {
          sendNotification(`🔔 הזמן נגמר: ${task.title}`, {
            body: 'הזמן המוקצב הסתיים',
            tag: `task-timeup-${task.id}`,
            requireInteraction: true
          });
        }
        markNotified(task.id, 'timeUp');
        
        toast.error(`🔔 הזמן נגמר: ${task.title}`, {
          duration: 8000,
          icon: '⏰'
        });
      }
    }
  }, [canNotify, markNotified, sendNotification]);
  
  // ✅ בדיקת התראות למשימה (ללא טיימר)
  const checkTaskAlerts = useCallback((task, currentMinutes, today, hasPushPermission = false) => {
    if (!task.due_time) return;
    if (task.was_deferred) return;
    
    const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
    if (taskDate !== today) return;
    
    const [hour, min] = task.due_time.split(':').map(Number);
    const taskStartMinutes = hour * 60 + (min || 0);
    const taskDuration = task.estimated_duration || 30;
    const taskEndMinutes = taskStartMinutes + taskDuration;
    
    const diffFromStart = taskStartMinutes - currentMinutes;
    const diffFromEnd = taskEndMinutes - currentMinutes;
    
    // 5 דקות לפני התחלה
    if (diffFromStart > 0 && diffFromStart <= 5) {
      if (canNotify(task.id, 'before', 5)) {
        if (hasPushPermission) {
          sendNotification(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${diffFromStart} דקות (${task.due_time})`,
            tag: `task-before-${task.id}`
          });
        }
        markNotified(task.id, 'before');
        
        toast(`⏰ ${task.title} מתחיל בעוד ${diffFromStart} דקות`, {
          duration: 5000
        });
      }
    }
    
    // בדיוק בזמן ההתחלה
    if (diffFromStart >= -1 && diffFromStart <= 1) {
      if (canNotify(task.id, 'onTime', 5)) {
        if (hasPushPermission) {
          sendNotification(`🔔 ${task.title}`, {
            body: `הגיע הזמן להתחיל!`,
            tag: `task-ontime-${task.id}`
          });
        }
        markNotified(task.id, 'onTime');
        
        toast.success(`🔔 הגיע הזמן להתחיל: ${task.title}`, {
          duration: 8000
        });
      }
    }
    
    // באיחור - התחלה עברה
    if (diffFromStart < -2 && diffFromStart > -30) {
      if (task.time_spent && task.time_spent > 0) return;
      
      if (canNotify(task.id, 'late', 10)) {
        const lateMinutes = Math.abs(Math.round(diffFromStart));
        if (hasPushPermission) {
          sendNotification(`⏰ ${task.title}`, {
            body: `היית אמורה להתחיל לפני ${lateMinutes} דקות`,
            tag: `task-late-${task.id}`
          });
        }
        markNotified(task.id, 'late');
        
        toast(`⏰ ${task.title} - באיחור של ${lateMinutes} דקות`, {
          duration: 5000,
          icon: '⚠️'
        });
      }
    }
    
    // משימה שעבר זמן הסיום שלה ולא סומנה כהושלמה
    if (diffFromEnd < 0 && diffFromEnd > -60) {
      const timeSpent = task.time_spent || 0;
      const completionRatio = timeSpent / taskDuration;
      
      if (completionRatio < 0.5) {
        if (canNotify(task.id, 'overdue-end', 15)) {
          const overdueMinutes = Math.abs(Math.round(diffFromEnd));
          
          if (hasPushPermission) {
            sendNotification(`🔴 ${task.title} - מה קורה?`, {
              body: `המשימה הייתה אמורה להסתיים לפני ${overdueMinutes} דקות`,
              tag: `task-overdue-end-${task.id}`,
              requireInteraction: true
            });
          }
          markNotified(task.id, 'overdue-end');
          
          toast.error(`🔴 "${task.title}" הייתה אמורה להסתיים לפני ${overdueMinutes} דקות`, {
            duration: 10000
          });
        }
      }
    }
  }, [canNotify, markNotified, sendNotification]);

  // ✅ חדש: בדיקת אירועי יומן גוגל
  const checkGoogleCalendarEvents = useCallback((minutesBefore, hasPushPermission) => {
    try {
      // קריאת אירועי יומן מ-localStorage (נשמרים ע"י useGoogleCalendar)
      const calendarEventsData = localStorage.getItem('zmanit_calendar_events_today');
      if (!calendarEventsData) return;
      
      const events = JSON.parse(calendarEventsData);
      if (!Array.isArray(events) || events.length === 0) return;
      
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      events.forEach(event => {
        if (!event.start?.dateTime) return;
        
        const startTime = new Date(event.start.dateTime);
        const eventMinutes = startTime.getHours() * 60 + startTime.getMinutes();
        const diff = eventMinutes - currentMinutes;
        
        // התראה X דקות לפני האירוע
        if (diff > 0 && diff <= minutesBefore) {
          if (canNotify(`calendar-${event.id}`, 'before', 15)) {
            const eventTitle = event.summary || 'אירוע';
            const timeStr = startTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            
            playSound('default');
            logNotificationToHistory('calendar', eventTitle, `מתחיל בעוד ${diff} דקות`);
            
            if (hasPushPermission) {
              sendNotification(`📅 ${eventTitle}`, {
                body: `מתחיל בעוד ${diff} דקות (${timeStr})`,
                tag: `calendar-${event.id}`,
                requireInteraction: true
              });
            }
            
            toast(`📅 ${eventTitle} - בעוד ${diff} דקות (${timeStr})`, {
              duration: 8000,
              icon: '📅'
            });
            
            markNotified(`calendar-${event.id}`, 'before');
          }
        }
        
        // התראה בזמן האירוע
        if (diff >= -1 && diff <= 1) {
          if (canNotify(`calendar-${event.id}`, 'start', 5)) {
            const eventTitle = event.summary || 'אירוע';
            
            playSound('warning');
            logNotificationToHistory('calendar', eventTitle, 'מתחיל עכשיו!');
            
            if (hasPushPermission) {
              sendNotification(`📅 ${eventTitle} מתחיל!`, {
                body: 'האירוע מתחיל עכשיו',
                tag: `calendar-start-${event.id}`,
                requireInteraction: true
              });
            }
            
            toast.success(`📅 ${eventTitle} - מתחיל עכשיו!`, {
              duration: 10000
            });
            
            markNotified(`calendar-${event.id}`, 'start');
          }
        }
      });
    } catch (e) {
      // שגיאה בקריאת אירועי יומן - לא קריטי
    }
  }, [canNotify, markNotified, sendNotification, playSound, logNotificationToHistory]);

  // ✅ בדיקת משימות ושליחת התראות מתואמות
  const checkAndNotify = useCallback(() => {
    if (!tasks || tasks.length === 0) {
      return;
    }
    
    const hasPushPermission = permission === 'granted';
    
    // ✅ קריאת הגדרות מותאמות אישית
    const settings = getNotificationSettings();
    
    const now = new Date();
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // בדיקה אם יש טיימר פעיל (רץ, לא בהשהיה)
    const activeTaskId = getActiveTaskId();
    
    // ✅ בדיקת שעות עבודה (08:30-16:15, ימים א-ה)
    const isWorkDay = dayOfWeek >= 0 && dayOfWeek <= 4; // ראשון עד חמישי
    const workStart = 8.5 * 60;  // 08:30
    const workEnd = 16.25 * 60;  // 16:15
    const isWorkHours = isWorkDay && currentMinutes >= workStart && currentMinutes <= workEnd;
    
    // ✅ בדיקת אירועי יומן גוגל
    if (settings.calendarReminder?.enabled) {
      checkGoogleCalendarEvents(settings.calendarReminder.minutesBefore || 10, hasPushPermission);
    }
    
    // ✅ פופאפ חוסם אם אנחנו בשעות עבודה ואין טיימר רץ
    if (isWorkHours && !activeTaskId && settings.noTimerReminder?.enabled) {
      const interval = settings.noTimerReminder.intervalMinutes || 10;
      if (canNotify('work-hours', 'no-timer', interval)) {
        
        // בדיקה אם יש משימות מתוכננות היום שעדיין לא הושלמו
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
            // ✅ השמעת צליל אזהרה
            playSound('warning');
            
            // ✅ שמירה להיסטוריה
            logNotificationToHistory('no_timer', 'את בשעות העבודה!', `המשימה הבאה: ${nextTask.title}`);
            
            // ✅ Push notification
            if (hasPushPermission) {
              sendNotification('⏰ את בשעות העבודה!', {
                body: `המשימה הבאה: ${nextTask.title} (${nextTask.due_time})`,
                tag: 'no-timer-warning',
                requireInteraction: true
              });
            }
            
            // ✅ פופאפ חוסם במקום toast
            setProcrastinationPopup({
              type: 'no-timer',
              title: '⏰ את בשעות העבודה!',
              message: `אין טיימר פעיל. המשימה הבאה: "${nextTask.title}" (${nextTask.due_time})`,
              taskId: nextTask.id,
              taskTitle: nextTask.title,
              actions: [
                { id: 'start_task', label: '▶️ התחל משימה', primary: true },
                { id: 'snooze_10', label: `⏱️ הזכר בעוד ${interval} דק׳` },
                { id: 'dismiss', label: '❌ סגור' }
              ]
            });
            
            markNotified('work-hours', 'no-timer');
          }
        }
      }
    }
    
    // ✅ בדיקת משימה מושהית יותר מידי זמן
    const pausedTimerData = localStorage.getItem('zmanit_focus_paused');
    if (pausedTimerData && isWorkHours && settings.pausedTaskReminder?.enabled) {
      try {
        const pausedData = JSON.parse(pausedTimerData);
        const pausedAt = new Date(pausedData.pausedAt).getTime();
        const pausedMinutes = Math.floor((Date.now() - pausedAt) / 60000);
        const threshold = settings.pausedTaskReminder.afterMinutes || 10;
        
        if (pausedMinutes >= threshold && canNotify('paused-timer', 'too-long', threshold)) {
          const pausedTask = tasks.find(t => t.id === pausedData.taskId);
          const taskTitle = pausedTask?.title || 'משימה';
          
          // ✅ השמעת צליל אזהרה
          playSound('warning');
          
          // ✅ שמירה להיסטוריה
          logNotificationToHistory('paused', `${taskTitle} מושהית`, `מושהית ${pausedMinutes} דקות`);
          
          if (hasPushPermission) {
            sendNotification(`⏸️ ${taskTitle} מושהית`, {
              body: `המשימה מושהית כבר ${pausedMinutes} דקות. להמשיך לעבוד?`,
              tag: 'paused-too-long',
              requireInteraction: true
            });
          }
          
          // ✅ פופאפ חוסם במקום toast
          setProcrastinationPopup({
            type: 'paused-too-long',
            title: `⏸️ ${taskTitle} מושהית`,
            message: `המשימה מושהית כבר ${pausedMinutes} דקות. להמשיך לעבוד?`,
            taskId: pausedData.taskId,
            taskTitle: taskTitle,
            actions: [
              { id: 'resume_task', label: '▶️ המשך עבודה', primary: true },
              { id: 'switch_task', label: '🔄 עבור למשימה אחרת' },
              { id: 'snooze_10', label: `⏱️ הזכר בעוד ${threshold} דק׳` }
            ]
          });
          
          markNotified('paused-timer', 'too-long');
        }
      } catch (e) {
        // ignore
      }
    }
    
    // בדיקת משימות של היום
    const todayTasks = tasks.filter(task => {
      if (task.is_completed) return false;
      if (task.is_project) return false; // לא כולל משימות הוריות
      const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
      return taskDate === today && task.due_time;
    });
    
    // ✅ יצירת בלוקים מתוזמנים עבור alertManager
    const scheduledBlocks = todayTasks.map(task => {
      const [h, m] = (task.due_time || '09:00').split(':').map(Number);
      const startMinute = h * 60 + (m || 0);
      const duration = task.estimated_duration || 30;
      return {
        taskId: task.id,
        title: task.title,
        dayDate: today,
        startMinute,
        endMinute: startMinute + duration,
        startTime: task.due_time,
        isCompleted: task.is_completed
      };
    });
    
    // ✅ תמיד קוראים ל-alertManager - הוא יודע לבדוק:
    // - התראות למשימה הפעילה (endingSoon, transition)
    // - הוא לא שולח התראות על משימות אחרות כשיש טיימר פעיל
    alertManager.checkScheduledTasks(tasks, scheduledBlocks);
    
    // ✅ אם יש טיימר פעיל - בודקים גם לפי time_spent (לא רק לפי לוח זמנים)
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        // בדיקת התראות לפי time_spent vs estimated_duration
        checkActiveTaskAlerts(activeTask, currentMinutes, hasPushPermission);
      }
      // לא בודקים התראות על משימות אחרות כשעובדים
      return;
    }
    
    // ✅ בדיקת כל משימות היום (רק אם אין טיימר פעיל)
    todayTasks.forEach(task => {
      checkTaskAlerts(task, currentMinutes, today, hasPushPermission);
    });
    
  }, [tasks, permission, canNotify, markNotified, sendNotification, playSound, logNotificationToHistory, getNotificationSettings, checkActiveTaskAlerts, checkTaskAlerts, checkGoogleCalendarEvents]);
  
  // ✅ הפעלת בדיקה תקופתית
  useEffect(() => {
    // 🔧 תיקון: לא עוצרים אם אין הרשאה - פשוט מציגים toast במקום Push
    
    // בדיקה ראשונית
    checkAndNotify();
    
    // בדיקה כל 30 שניות
    checkIntervalRef.current = setInterval(checkAndNotify, 30 * 1000);
    
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkAndNotify]);
  
  // ✅ סגירת התראה פעילה
  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
    setIsAlertVisible(false);
    
    // עבור להתראה הבאה בתור
    if (alertQueue.length > 0) {
      const [next, ...rest] = alertQueue;
      setAlertQueue(rest);
      if (next.blockingPopup) {
        setActiveAlert(next);
        setIsAlertVisible(true);
      } else {
        showToastAlert(next);
      }
    }
  }, [alertQueue, showToastAlert]);
  
  // ✅ סגירת פופאפ דחיינות
  const dismissProcrastinationPopup = useCallback(() => {
    setProcrastinationPopup(null);
  }, []);
  
  // ✅ טיפול בפעולה על פופאפ דחיינות
  const handleProcrastinationAction = useCallback((actionId) => {
    const popup = procrastinationPopup;
    
    switch (actionId) {
      case 'start_task':
      case 'resume_task':
        // שמור את ה-taskId ב-localStorage לפתיחה ב-DailyView
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
        // איפוס ה-canNotify כך שההתראה תופיע שוב בעוד 10 דקות
        if (popup?.type === 'no-timer') {
          lastNotifiedRef.current['work-hours-no-timer'] = Date.now() - (5 * 60 * 1000); // 5 דק' במקום 10
        } else if (popup?.type === 'paused-too-long') {
          lastNotifiedRef.current['paused-timer-too-long'] = Date.now() - (5 * 60 * 1000);
        }
        break;
        
      case 'dismiss':
        // סתם סגירה
        break;
        
      default:
        break;
    }
    
    dismissProcrastinationPopup();
  }, [procrastinationPopup, dismissProcrastinationPopup]);
  
  // ✅ טיפול בפעולה על התראה
  const handleAlertAction = useCallback((actionId) => {
    console.log('🔔 פעולה על התראה:', actionId);
    
    switch (actionId) {
      case 'start_now':
        // שמור את ה-taskId ב-localStorage לפתיחה ב-DailyView
        if (activeAlert?.taskId) {
          localStorage.setItem('start_task_id', activeAlert.taskId);
        }
        window.location.href = '/daily';
        break;
        
      case 'snooze_5':
        toast('⏱ נזכיר בעוד 5 דקות', { duration: 2000 });
        setTimeout(() => {
          if (activeAlert) {
            sendNotification(activeAlert.title, {
              body: activeAlert.message,
              tag: `snooze-${activeAlert.id}`
            });
          }
        }, 5 * 60 * 1000);
        break;
        
      case 'reschedule':
        toast('📅 יש להעביר את המשימה בתצוגה היומית', { duration: 3000 });
        break;
        
      case 'skip':
        toast('⏭ המשימה נדחתה', { duration: 2000 });
        break;
        
      case 'take_break':
        alertManager.takeBreak();
        toast('☕ הפסקה טובה!', { duration: 2000 });
        break;
        
      case 'focus_mode':
        toast('🎯 מצב ריכוז הופעל ל-45 דקות', { duration: 3000 });
        break;
        
      default:
        break;
    }
    
    dismissAlert();
  }, [activeAlert, dismissAlert, sendNotification]);
  
  return {
    activeAlert,
    isAlertVisible,
    alertQueue,
    dismissAlert,
    handleAlertAction,
    checkAndNotify,
    // ✅ חדש: פופאפ דחיינות
    procrastinationPopup,
    dismissProcrastinationPopup,
    handleProcrastinationAction
  };
}

/**
 * קבלת אייקון לפי סוג התראה
 */
function getAlertIcon(type) {
  switch (type) {
    case ALERT_TYPES.TASK_STARTING_SOON:
      return '⏰';
    case ALERT_TYPES.TASK_OVERDUE:
      return '🔴';
    case ALERT_TYPES.TASK_ENDING_SOON:
      return '⏳';
    case ALERT_TYPES.BREAK_REMINDER:
      return '☕';
    case ALERT_TYPES.PROCRASTINATION_WARNING:
      return '🎯';
    default:
      return '🔔';
  }
}

/**
 * קומפוננטת מנהל התראות מאוחד
 * יש להוסיף ל-App.jsx במקום NotificationChecker
 */
export function UnifiedNotificationManager() {
  const { 
    activeAlert, 
    isAlertVisible, 
    handleAlertAction, 
    dismissAlert,
    procrastinationPopup,
    dismissProcrastinationPopup,
    handleProcrastinationAction
  } = useUnifiedNotifications();
  const { sendNotification, permission, playSound, requestPermission } = useNotifications();
  
  // 🔧 שליחת push notification כשפופאפ קופץ
  useEffect(() => {
    if (isAlertVisible && activeAlert && permission === 'granted') {
      sendNotification(activeAlert.title, {
        body: activeAlert.message,
        tag: `alert-${activeAlert.id}`,
        requireInteraction: true
      });
    }
  }, [isAlertVisible, activeAlert, sendNotification, permission]);
  
  // ✅ פופאפ דחיינות (בשעות עבודה ללא טיימר / משימה מושהית)
  if (procrastinationPopup) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-bounce-in relative border-4 border-orange-400">
          
          {/* אייקון */}
          <div className="text-5xl mb-4 animate-pulse">
            {procrastinationPopup.type === 'no-timer' ? '⏰' : '⏸️'}
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {procrastinationPopup.title}
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            {procrastinationPopup.message}
          </p>
          
          {/* כפתורי פעולה */}
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
          
          {/* הודעת עידוד */}
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            💪 את יכולה לעשות את זה!
          </p>
        </div>
      </div>
    );
  }
  
  // פופאפ חוסם להתראות קריטיות
  if (isAlertVisible && activeAlert?.blockingPopup) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 text-center animate-bounce-in relative">
          
          {/* 🔧 כפתור X לסגירה */}
          <button
            onClick={dismissAlert}
            className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
            title="סגור"
          >
            ✕
          </button>
          
          {/* כותרת */}
          <div className="text-4xl mb-4">
            {getAlertIcon(activeAlert.type)}
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {activeAlert.title}
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {activeAlert.message}
          </p>
          
          {/* כפתורי פעולה */}
          <div className="flex flex-col gap-3">
            {activeAlert.actions?.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleAlertAction(action.id)}
                className={`
                  w-full py-3 px-4 rounded-xl font-medium transition-all
                  ${action.primary 
                    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}

export default UnifiedNotificationManager;
