import { useEffect, useRef, useCallback } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useNotifications } from '../../hooks/useNotifications';

/**
 * ✅ תאריך מקומי בפורמט ISO
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ✅ בדיקה אם יש טיימר פעיל (רץ או מושהה) על משימה ספציפית
 * תומך בשני סוגי טיימרים:
 * - MiniTimer: משתמש ב-isPaused
 * - TaskTimerWithInterruptions: משתמש ב-isInterrupted
 */
function isTimerActive(taskId) {
  if (!taskId) return false;
  try {
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      // פעיל = רץ, או מושהה (isPaused), או בהפרעה (isInterrupted)
      // כל עוד יש startTime - המשימה פעילה
      if (data.isRunning === true) return true;
      if (data.isPaused === true) return true;
      if (data.isInterrupted === true && data.startTime) return true;
      // אם יש startTime ואין סימון שהטיימר נעצר לגמרי
      if (data.startTime && (data.isRunning !== false || data.isPaused || data.isInterrupted)) return true;
    }
  } catch (e) {
    console.error('שגיאה בבדיקת טיימר:', e);
  }
  return false;
}

/**
 * ✅ בדיקה אם יש טיימר רץ (לא מושהה/מופרע) על משימה ספציפית
 */
function isTimerRunning(taskId) {
  if (!taskId) return false;
  try {
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      // רץ = isRunning=true ולא מושהה ולא מופרע
      return data.isRunning === true && 
             data.isPaused !== true && 
             data.isInterrupted !== true;
    }
  } catch (e) {
    console.error('שגיאה בבדיקת טיימר:', e);
  }
  return false;
}

/**
 * ✅ בדיקה אם יש טיימר פעיל (רץ או מושהה) על משימה כלשהי
 */
function getActiveTaskId() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('timer_v2_')) {
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          // פעיל = רץ, או מושהה, או בהפרעה
          const isActive = data.isRunning === true || 
                           data.isPaused === true || 
                           (data.isInterrupted === true && data.startTime);
          if (isActive) {
            return key.replace('timer_v2_', '');
          }
        }
      }
    }
  } catch (e) {
    console.error('שגיאה בחיפוש טיימר פעיל:', e);
  }
  return null;
}

/**
 * ✅ חישוב כמה זמן עבד על המשימה (בדקות)
 */
function getElapsedMinutes(taskId, baseTimeSpent = 0) {
  if (!taskId) return baseTimeSpent;
  try {
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.isRunning && data.startTime && !data.isInterrupted) {
        const startTime = new Date(data.startTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000) - (data.totalInterruptionSeconds || 0);
        const elapsedMinutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
        return baseTimeSpent + elapsedMinutes;
      }
    }
  } catch (e) {
    console.error('שגיאה בחישוב זמן:', e);
  }
  return baseTimeSpent;
}

/**
 * ✅ המרת שעה מפורמט "HH:MM" לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(mins)) return null;
  return hours * 60 + mins;
}

/**
 * ✅ רכיב בדיקת התראות - גרסה מתוקנת!
 * 
 * עקרונות התיקון:
 * 1. משתמש ב-due_time המקורי של המשימה - לא מחשב לו"ז דינמי
 * 2. לא שולח התראות אם יש טיימר רץ (על כל משימה)
 * 3. לא שולח התראות על משימות שהושלמו
 * 4. שולח התראה "הזמן נגמר" כשטיימר עובר את הזמן המוקצב
 */
function NotificationChecker() {
  const { tasks } = useTasks();
  const { permission, settings, sendNotification } = useNotifications();
  
  // מעקב אחרי התראות שנשלחו
  const lastNotifiedRef = useRef({});
  const checkIntervalRef = useRef(null);
  // מעקב אחרי משימות שהושלמו
  const completedTasksRef = useRef(new Set());
  // מעקב אחרי התראות "הזמן נגמר" שנשלחו
  const timeUpNotifiedRef = useRef(new Set());

  // ✅ ניקוי refs כשמשימות נמחקות
  useEffect(() => {
    if (tasks) {
      const currentTaskIds = new Set(tasks.map(t => t.id));
      
      // נקה completed tasks שנמחקו
      const validCompleted = new Set(
        [...completedTasksRef.current].filter(id => currentTaskIds.has(id))
      );
      completedTasksRef.current = validCompleted;
      
      // נקה timeUp notifications שנמחקו
      const validTimeUp = new Set(
        [...timeUpNotifiedRef.current].filter(id => currentTaskIds.has(id))
      );
      timeUpNotifiedRef.current = validTimeUp;
      
      // נקה lastNotified של משימות שנמחקו
      const newLastNotified = {};
      Object.keys(lastNotifiedRef.current).forEach(key => {
        const taskId = key.split('-')[0];
        if (currentTaskIds.has(taskId)) {
          newLastNotified[key] = lastNotifiedRef.current[key];
        }
      });
      lastNotifiedRef.current = newLastNotified;
    }
  }, [tasks]);

  // בדיקה אם עבר מספיק זמן מההתראה האחרונה
  const canNotify = useCallback((taskId, type, minIntervalMinutes) => {
    const now = Date.now();
    const key = `${taskId}-${type}`;
    const lastNotified = lastNotifiedRef.current[key];
    
    if (!lastNotified) return true;
    
    const minutesSinceLastNotification = (now - lastNotified) / (1000 * 60);
    return minutesSinceLastNotification >= minIntervalMinutes;
  }, []);

  // סימון שנשלחה התראה
  const markNotified = useCallback((taskId, type) => {
    const key = `${taskId}-${type}`;
    lastNotifiedRef.current[key] = Date.now();
  }, []);

  // בדיקת משימות ושליחת התראות
  const checkAndNotify = useCallback(() => {
    // אם אין הרשאה - לא עושים כלום
    if (permission !== 'granted') {
      return;
    }
    
    if (!tasks || tasks.length === 0) {
      return;
    }

    const now = new Date();
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const reminderMinutes = settings?.reminderMinutes || 5;
    const repeatEveryMinutes = settings?.repeatEveryMinutes || 10;
    const notifyOnTime = settings?.notifyOnTime !== false;
    
    // מצא משימות להיום עם שעה מוגדרת
    // ✅ תיקון: וידוא שהתאריך מנורמל לפורמט אחיד
    const todayTasksWithTime = tasks.filter(task => {
      if (task.is_completed) return false;
      if (!task.due_time) return false;
      
      // נרמול התאריך של המשימה
      const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
      
      // ✅ רק משימות של היום!
      return taskDate === today;
    });

    // ✅ עדכון רשימת המשימות שהושלמו
    tasks.forEach(task => {
      if (task.is_completed) {
        completedTasksRef.current.add(task.id);
      }
    });

    // ✅ בדיקה אם יש משימה פעילה עכשיו (טיימר רץ)
    const activeTaskId = getActiveTaskId();

    tasks.forEach(task => {
      // ✅ דלג על משימות שהושלמו
      if (task.is_completed || completedTasksRef.current.has(task.id)) {
        return;
      }
      
      // ✅ תיקון: נרמול תאריך המשימה ובדיקה מדויקת
      const taskDate = task.due_date ? toLocalISODate(new Date(task.due_date)) : null;
      
      // ✅ דלג על משימות שאינן להיום (כולל משימות של מחר!)
      if (taskDate && taskDate !== today) {
        return;
      }
      
      // ✅ אם אין תאריך - גם לא שולחים התראות
      if (!taskDate) {
        return;
      }

      // =============================================
      // סוג 1: התראות על טיימר פעיל (רץ או מושהה)
      // =============================================
      if (isTimerActive(task.id)) {
        // רק אם הטיימר רץ (לא מושהה) - שלח התראות על זמן
        if (isTimerRunning(task.id)) {
          const estimated = task.estimated_duration || 0;
          if (estimated > 0) {
            const elapsed = getElapsedMinutes(task.id, task.time_spent || 0);
            const remaining = estimated - elapsed;
            
            // התראה 5 דקות לפני סיום הזמן
            if (remaining > 0 && remaining <= 5 && remaining > 2) {
              if (canNotify(task.id, 'endingSoon', 5)) {
                sendNotification(`⏳ ${task.title}`, {
                  body: `נשארו ${remaining} דקות לסיום הזמן המוקצב!`,
                  tag: `task-ending-${task.id}`
                });
                markNotified(task.id, 'endingSoon');
              }
            }
            
            // ✅ התראה כשהזמן נגמר - פעם אחת בלבד!
            if (remaining <= 0 && remaining > -2) {
              if (!timeUpNotifiedRef.current.has(task.id)) {
                sendNotification(`🔔 הזמן נגמר: ${task.title}`, {
                  body: 'הזמן המוקצב הסתיים. מה עושים? 🤔',
                  tag: `task-timeup-${task.id}`,
                  requireInteraction: true // נשאר עד שלוחצים
                });
                timeUpNotifiedRef.current.add(task.id);
              }
            }
            
            // התראה על חריגה - כל 15 דקות (לא כל 10)
            if (remaining < -5) {
              if (canNotify(task.id, 'overtime', 15)) {
                const overtimeMinutes = Math.abs(Math.round(remaining));
                sendNotification(`⚠️ חריגה: ${task.title}`, {
                  body: `חרגת ב-${overtimeMinutes} דקות מהזמן המוקצב. אולי להעביר משימות?`,
                  tag: `task-overtime-${task.id}`
                });
                markNotified(task.id, 'overtime');
              }
            }
          }
        }
        
        return; // אם הטיימר פעיל (גם מושהה!) - לא צריך התראות נוספות
      }

      // =============================================
      // סוג 2: התראות על זמן התחלה (רק אם אין טיימר רץ על המשימה הזו!)
      // =============================================
      
      // 🔧 תיקון: אם הטיימר רץ על המשימה הזו - לא שולחים התראה
      // אבל אם הטיימר רץ על משימה אחרת - כן שולחים!
      // (כבר בדקנו למעלה isTimerActive(task.id))
      
      // ✅ משתמש ב-due_time המקורי - לא מחשב דינמית!
      const taskTime = task.due_time;
      if (!taskTime) {
        return; // אין שעה מוגדרת
      }
      
      const taskMinutes = timeToMinutes(taskTime);
      if (taskMinutes === null) {
        return;
      }
      
      const diff = taskMinutes - currentMinutes; // חיובי = עתידי

      // התראה לפני המשימה (5 דקות לפני)
      if (diff > 0 && diff <= reminderMinutes) {
        if (canNotify(task.id, 'before', reminderMinutes)) {
          sendNotification(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${diff} דקות (${taskTime})`,
            tag: `task-before-${task.id}`
          });
          markNotified(task.id, 'before');
        }
      }

      // התראה בדיוק בזמן
      if (notifyOnTime && diff >= -1 && diff <= 1) {
        if (canNotify(task.id, 'onTime', 5)) {
          const duration = task.estimated_duration || 30;
          sendNotification(`🔔 ${task.title}`, {
            body: `הגיע הזמן להתחיל! (${duration} דק')`,
            tag: `task-ontime-${task.id}`
          });
          markNotified(task.id, 'onTime');
        }
      }

      // התראה על איחור - רק אם לא התחילו לעבוד!
      if (diff < -2 && diff > -30) {
        // אם כבר עבדו על המשימה - לא מתריעים
        if (task.time_spent && task.time_spent > 0) {
          return;
        }
        
        if (canNotify(task.id, 'late', repeatEveryMinutes)) {
          const lateMinutes = Math.abs(Math.round(diff));
          sendNotification(`⏰ ${task.title}`, {
            body: `היית אמורה להתחיל לפני ${lateMinutes} דקות`,
            tag: `task-late-${task.id}`
          });
          markNotified(task.id, 'late');
        }
      }
    });
  }, [tasks, permission, settings, canNotify, markNotified, sendNotification]);

  // הפעלת בדיקה תקופתית
  useEffect(() => {
    if (permission !== 'granted') {
      return;
    }

    // בדיקה ראשונית מיידית
    checkAndNotify();

    // בדיקה כל 30 שניות
    checkIntervalRef.current = setInterval(() => {
      checkAndNotify();
    }, 30 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [permission, checkAndNotify]);

  // ניקוי יומי של הרשימות
  useEffect(() => {
    const clearDaily = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() < 5) {
        // חצות - מנקים הכל
        lastNotifiedRef.current = {};
        completedTasksRef.current.clear();
        timeUpNotifiedRef.current.clear();
      }
    };
    
    const interval = setInterval(clearDaily, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // לא מציג כלום - רק עובד ברקע
  return null;
}

export default NotificationChecker;
