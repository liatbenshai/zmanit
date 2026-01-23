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
  const { permission, sendNotification } = useNotifications();
  
  // מצב התראות
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertQueue, setAlertQueue] = useState([]);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  
  // refs למניעת התראות כפולות
  const lastNotifiedRef = useRef({});
  const checkIntervalRef = useRef(null);
  
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
  }, []);
  
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
        console.log('🔔 [Notifications] זמן משימה השתנה:', task.title, prev.due_time, '->', task.due_time);
      }
      prevTasksRef.current[task.id] = { due_time: task.due_time };
    });
  }, [tasks, clearNotificationsForTask]);
  
  // ✅ בדיקת משימות ושליחת התראות מתואמות
  const checkAndNotify = useCallback(() => {
    if (!tasks || tasks.length === 0) {
      return;
    }
    
    const hasPushPermission = permission === 'granted';
    
    const now = new Date();
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // בדיקה אם יש טיימר פעיל (רץ, לא בהשהיה)
    const activeTaskId = getActiveTaskId();
    
    // ✅ חדש: בדיקת שעות עבודה (08:30-16:15, ימים א-ה)
    const isWorkDay = dayOfWeek >= 0 && dayOfWeek <= 4; // ראשון עד חמישי
    const workStart = 8.5 * 60;  // 08:30
    const workEnd = 16.25 * 60;  // 16:15
    const isWorkHours = isWorkDay && currentMinutes >= workStart && currentMinutes <= workEnd;
    
    // ✅ חדש: פופאפ אם אנחנו בשעות עבודה ואין טיימר רץ
    if (isWorkHours && !activeTaskId) {
      // בדיקה שלא נשלחה התראה ב-10 דקות האחרונות
      if (canNotify('work-hours', 'no-timer', 10)) {
        console.log('🔔 [Notifications] בשעות עבודה ללא טיימר פעיל!');
        
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
              return (h * 60 + (m || 0)) >= currentMinutes - 30; // משימות מלפני חצי שעה ומעלה
            });
          
          if (nextTask) {
            if (hasPushPermission) {
              sendNotification('⏰ את בשעות העבודה!', {
                body: `המשימה הבאה: ${nextTask.title} (${nextTask.due_time})`,
                tag: 'no-timer-warning',
                requireInteraction: true
              });
            }
            
            toast(`⏰ את בשעות העבודה! המשימה הבאה: ${nextTask.title}`, {
              duration: 8000,
              icon: '🎯'
            });
            
            markNotified('work-hours', 'no-timer');
          }
        }
      }
    }
    
    // ✅ חדש: בדיקת משימה מושהית יותר מידי זמן
    const pausedTimerData = localStorage.getItem('zmanit_focus_paused');
    if (pausedTimerData && isWorkHours) {
      try {
        const pausedData = JSON.parse(pausedTimerData);
        const pausedAt = new Date(pausedData.pausedAt).getTime();
        const pausedMinutes = Math.floor((Date.now() - pausedAt) / 60000);
        
        if (pausedMinutes >= 10 && canNotify('paused-timer', 'too-long', 10)) {
          const pausedTask = tasks.find(t => t.id === pausedData.taskId);
          const taskTitle = pausedTask?.title || 'משימה';
          
          if (hasPushPermission) {
            sendNotification(`⏸️ ${taskTitle} מושהית`, {
              body: `המשימה מושהית כבר ${pausedMinutes} דקות. להמשיך לעבוד?`,
              tag: 'paused-too-long',
              requireInteraction: true
            });
          }
          
          toast.error(`⏸️ "${taskTitle}" מושהית כבר ${pausedMinutes} דקות!`, {
            duration: 8000
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
    
  }, [tasks, permission, canNotify, markNotified, sendNotification, checkActiveTaskAlerts, checkTaskAlerts]);
  
  // ✅ בדיקת התראות למשימה פעילה (עם טיימר)
  // 🔧 תיקון: קורא את הזמן מהטיימר ב-localStorage, לא מה-DB
  const checkActiveTaskAlerts = useCallback((task, currentMinutes, hasPushPermission = false) => {
    const estimated = task.estimated_duration || 0;
    
    if (estimated <= 0) {
      console.log('🔔 [Notifications] משימה בלי זמן מוגדר:', task.title);
      return;
    }
    
    // 🔧 קורא את הזמן שעבר מהטיימר (לא מה-DB!)
    const timeSpentMinutes = getElapsedTimeFromTimer(task.id);
    const remaining = estimated - timeSpentMinutes;
    
    console.log('🔔 [Notifications] בדיקת משימה פעילה:', {
      title: task.title,
      estimated,
      timeSpentMinutes,
      remaining,
      hasPushPermission
    });
    
    // 5 דקות לסיום
    if (remaining > 0 && remaining <= 5) {
      if (canNotify(task.id, 'endingSoon', 3)) { // כל 3 דקות
        console.log('🔔 [Notifications] שולח התראה - 5 דקות לסיום:', task.title);
        if (hasPushPermission) {
          sendNotification(`⏳ ${task.title}`, {
            body: `נשארו ${remaining} דקות לסיום הזמן המוקצב!`,
            tag: `task-ending-${task.id}`
          });
        }
        // 🔧 תמיד מציג toast
        toast(`⏳ נשארו ${remaining} דקות ל-${task.title}`, {
          duration: 5000,
          icon: '⏰'
        });
        markNotified(task.id, 'endingSoon');
      }
    }
    
    // הזמן נגמר
    if (remaining <= 0) {
      if (canNotify(task.id, 'timeUp', 5)) { // כל 5 דקות
        console.log('🔔 [Notifications] שולח התראה - הזמן נגמר:', task.title);
        if (hasPushPermission) {
          sendNotification(`🔔 הזמן נגמר: ${task.title}`, {
            body: 'הזמן המוקצב הסתיים',
            tag: `task-timeup-${task.id}`,
            requireInteraction: true
          });
        }
        markNotified(task.id, 'timeUp');
        
        // 🔧 תמיד מציג toast בתוך האפליקציה
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
    
    // ✅ לא להתריע על משימות שנדחו בגלל בלת"מ
    if (task.was_deferred) return;
    
    // ✅ וידוא שהמשימה באמת מתוכננת להיום
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
    
    // בדיוק בזמן ההתחלה (חלון של 2 דקות)
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
    
    // באיחור - התחלה עברה (עד 30 דקות)
    if (diffFromStart < -2 && diffFromStart > -30) {
      // לא מתריעים אם כבר עבדו על המשימה
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
    
    // ✅ חדש: משימה שעבר זמן הסיום שלה ולא סומנה כהושלמה
    if (diffFromEnd < 0 && diffFromEnd > -60) {
      // לא עבדו עליה בכלל או עבדו רק חלקית
      const timeSpent = task.time_spent || 0;
      const completionRatio = timeSpent / taskDuration;
      
      // אם לא עבדו בכלל או פחות מ-50%
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
    checkAndNotify
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
  const { activeAlert, isAlertVisible, handleAlertAction, dismissAlert } = useUnifiedNotifications();
  const { sendNotification, permission } = useNotifications();
  
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
