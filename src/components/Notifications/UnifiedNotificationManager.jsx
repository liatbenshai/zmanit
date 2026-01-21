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
 */
function getActiveTaskId() {
  try {
    // בדיקה פשוטה - אם יש zmanit_active_timer, יש טיימר פעיל
    const activeTimer = localStorage.getItem('zmanit_active_timer');
    if (activeTimer && activeTimer !== 'null' && activeTimer !== 'undefined') {
      console.log('🔔 [Notifications] טיימר פעיל נמצא:', activeTimer);
      return activeTimer;
    }
  } catch (e) {
    console.error('🔔 [Notifications] שגיאה בבדיקת טיימר:', e);
  }
  return null;
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
  
  // ✅ בדיקת משימות ושליחת התראות מתואמות
  const checkAndNotify = useCallback(() => {
    if (!tasks || tasks.length === 0) {
      console.log('🔔 [Notifications] אין משימות לבדיקה');
      return;
    }
    
    const hasPushPermission = permission === 'granted';
    console.log('🔔 [Notifications] בודק התראות...', { 
      tasksCount: tasks.length, 
      hasPushPermission 
    });
    
    const now = new Date();
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // בדיקה אם יש טיימר פעיל (רץ, לא בהשהיה)
    const activeTaskId = getActiveTaskId();
    
    // בדיקת משימות של היום
    const todayTasks = tasks.filter(task => {
      if (task.is_completed) return false;
      const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
      return taskDate === today && task.due_time;
    });
    
    console.log('🔔 [Notifications] משימות היום:', todayTasks.length, 
      todayTasks.map(t => ({ title: t.title, time: t.due_time }))
    );
    
    // ✅ בדיקה אם יש טיימר פעיל - לפני הכל!
    if (activeTaskId) {
      const activeTask = tasks.find(t => t.id === activeTaskId);
      if (activeTask) {
        // רק בודקים התראות על המשימה הפעילה (כמו "הזמן עומד להיגמר")
        checkActiveTaskAlerts(activeTask, currentMinutes, hasPushPermission);
      }
      // ✅ יוצאים! לא מטרידים כשעובדים - גם לא קוראים ל-alertManager
      console.log('🔔 [Notifications] טיימר פעיל - לא שולחים התראות על משימות אחרות');
      return;
    }
    
    // ✅ יצירת בלוקים מתוזמנים עבור alertManager (רק אם אין טיימר פעיל)
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
    
    // ✅ קריאה ל-alertManager לבדיקת התראות חכמות (רק אם אין טיימר!)
    alertManager.checkScheduledTasks(tasks, scheduledBlocks);
    
    // ✅ בדיקת כל משימות היום
    todayTasks.forEach(task => {
      // דילוג על המשימה הפעילה (כבר בדקנו אותה)
      if (task.id === activeTaskId) return;
      
      checkTaskAlerts(task, currentMinutes, today, hasPushPermission);
    });
    
  }, [tasks, permission, canNotify, markNotified, sendNotification]);
  
  // ✅ בדיקת התראות למשימה פעילה (עם טיימר)
  const checkActiveTaskAlerts = useCallback((task, currentMinutes, hasPushPermission = false) => {
    const estimated = task.estimated_duration || 0;
    const timeSpent = task.time_spent || 0;
    
    if (estimated <= 0) return;
    
    const remaining = estimated - timeSpent;
    
    // 5 דקות לסיום
    if (remaining > 0 && remaining <= 5 && remaining > 2) {
      if (canNotify(task.id, 'endingSoon', 5)) {
        // 🔧 שולח Push רק אם יש הרשאה
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
    if (remaining <= 0 && remaining > -2) {
      if (canNotify(task.id, 'timeUp', 60)) { // פעם בשעה
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
    const taskMinutes = hour * 60 + (min || 0);
    const diff = taskMinutes - currentMinutes;
    
    console.log('🔔 [Notifications] בודק משימה:', {
      title: task.title,
      time: task.due_time,
      taskMinutes,
      currentMinutes,
      diff,
      hasPushPermission
    });
    
    // 5 דקות לפני
    if (diff > 0 && diff <= 5) {
      if (canNotify(task.id, 'before', 5)) {
        console.log('🔔 [Notifications] שולח התראה - 5 דקות לפני:', task.title);
        if (hasPushPermission) {
          sendNotification(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${diff} דקות (${task.due_time})`,
            tag: `task-before-${task.id}`
          });
        }
        markNotified(task.id, 'before');
        
        toast(`⏰ ${task.title} מתחיל בעוד ${diff} דקות`, {
          duration: 5000
        });
      }
    }
    
    // בדיוק בזמן (חלון של 2 דקות)
    if (diff >= -1 && diff <= 1) {
      if (canNotify(task.id, 'onTime', 5)) {
        console.log('🔔 [Notifications] שולח התראה - בדיוק בזמן:', task.title);
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
    
    // באיחור (עד 30 דקות)
    if (diff < -2 && diff > -30) {
      // לא מתריעים אם כבר עבדו על המשימה
      if (task.time_spent && task.time_spent > 0) return;
      
      if (canNotify(task.id, 'late', 10)) {
        const lateMinutes = Math.abs(Math.round(diff));
        console.log('🔔 [Notifications] שולח התראה - באיחור:', task.title, lateMinutes, 'דקות');
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
  
  // פופאפ חוסם להתראות קריטיות
  if (isAlertVisible && activeAlert?.blockingPopup) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 text-center animate-bounce-in">
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
