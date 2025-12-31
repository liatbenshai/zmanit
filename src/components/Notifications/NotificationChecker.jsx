import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useNotifications } from '../../hooks/useNotifications';

/**
 * ✅ פונקציית עזר: תאריך מקומי בפורמט ISO
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ✅ פונקציית עזר: בדיקה אם יש טיימר רץ על משימה (ב-localStorage)
 */
function isTimerRunning(taskId) {
  try {
    // הפורמט מ-DailyTaskCard: timer_v2_${taskId}
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      const running = data.isRunning && !data.isInterrupted;
      if (running) {
        console.log(`✅ טיימר רץ על משימה ${taskId}`);
      }
      return running;
    }
  } catch (e) {
    // התעלם משגיאות
  }
  return false;
}

/**
 * ✅ פונקציית עזר חדשה: בדיקה אם יש טיימר רץ על משימה כלשהי
 * מחזירה את ה-taskId של המשימה הפעילה, או null
 */
function getActiveTaskId(tasks) {
  if (!tasks || tasks.length === 0) return null;
  
  for (const task of tasks) {
    if (isTimerRunning(task.id)) {
      console.log(`🏃 משימה פעילה נמצאה: ${task.id} - ${task.title}`);
      return task.id;
    }
  }
  
  // בדיקה נוספת: חיפוש ישיר ב-localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('timer_v2_')) {
        const data = JSON.parse(localStorage.getItem(key));
        if (data.isRunning && !data.isInterrupted) {
          const taskId = key.replace('timer_v2_', '');
          console.log(`🔍 נמצא טיימר רץ ב-localStorage: ${taskId}`);
          return taskId;
        }
      }
    }
  } catch (e) {
    console.error('שגיאה בחיפוש טיימר:', e);
  }
  
  return null;
}

/**
 * ✅ פונקציית עזר: חישוב כמה זמן עבד על המשימה (בדקות)
 */
function getElapsedMinutes(taskId, baseTimeSpent = 0) {
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
    // התעלם משגיאות
  }
  return baseTimeSpent;
}

/**
 * ✅ חדש: חישוב לו"ז דינמי - כמו DailyView
 * מחזיר מפה של taskId -> { startTime, endTime } בדקות
 */
function calculateDynamicSchedule(tasks, currentMinutes) {
  const schedule = new Map();
  
  // סנן רק משימות של היום שלא הושלמו
  const today = toLocalISODate(new Date());
  const todayTasks = tasks.filter(t => 
    !t.is_completed && 
    (t.due_date === today || t.start_date === today)
  );
  
  // מיין לפי עדיפות ואז לפי שעה
  const sortedTasks = [...todayTasks].sort((a, b) => {
    // משימה עם טיימר רץ קודם
    if (isTimerRunning(a.id) && !isTimerRunning(b.id)) return -1;
    if (isTimerRunning(b.id) && !isTimerRunning(a.id)) return 1;
    
    // דחופים קודם
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // לפי שעה מקורית
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    
    return 0;
  });
  
  // חישוב זמני התחלה דינמיים
  let nextStartMinutes = currentMinutes;
  
  sortedTasks.forEach(task => {
    const duration = task.estimated_duration || 30;
    
    // דלג על פרויקטים גדולים (מעל 3 שעות)
    if (duration > 180) return;
    
    const startMinutes = nextStartMinutes;
    const endMinutes = startMinutes + duration;
    
    schedule.set(task.id, {
      startMinutes,
      endMinutes,
      duration,
      task
    });
    
    nextStartMinutes = endMinutes + 5; // 5 דקות הפסקה בין משימות
  });
  
  return schedule;
}

/**
 * ✅ המרה דקות לשעה (לתצוגה)
 */
function minutesToTimeString(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * רכיב שבודק התראות - חייב להיות ב-App.jsx!
 * בודק כל 30 שניות אם יש משימות שצריך להתריע עליהן
 * 
 * ✅ תיקון: שימוש בלו"ז דינמי במקום due_time המקורי
 * ✅ תיקון: התראות על סיום משימה (לא רק התחלה)
 */
function NotificationChecker() {
  const { tasks, loadTasks } = useTasks();
  const { permission, settings, sendNotification } = useNotifications();
  
  // מעקב אחרי התראות שנשלחו
  const lastNotifiedRef = useRef({});
  const checkIntervalRef = useRef(null);
  // ✅ מעקב אחרי משימות שהושלמו (לא לשלוח עליהן התראות יותר)
  const completedTasksRef = useRef(new Set());

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

  // ✅ סימון משימה כהושלמה - לא לשלוח עליה התראות יותר
  const markCompleted = useCallback((taskId) => {
    completedTasksRef.current.add(taskId);
    // נקה את כל ההתראות הקודמות של המשימה
    Object.keys(lastNotifiedRef.current).forEach(key => {
      if (key.startsWith(taskId)) {
        delete lastNotifiedRef.current[key];
      }
    });
  }, []);

  // בדיקת משימות ושליחת התראות
  const checkAndNotify = useCallback(() => {
    if (permission !== 'granted') {
      console.log('⚠️ NotificationChecker: אין הרשאה להתראות');
      return;
    }
    
    if (!tasks || tasks.length === 0) {
      return;
    }

    const now = new Date();
    // ✅ תיקון: שימוש בתאריך מקומי במקום UTC
    const today = toLocalISODate(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const reminderMinutes = settings?.reminderMinutes || 5;
    const repeatEveryMinutes = settings?.repeatEveryMinutes || 10;
    const notifyOnTime = settings?.notifyOnTime !== false;

    console.log(`🔔 בודק ${tasks.length} משימות (${now.toLocaleTimeString('he-IL')}) | תאריך: ${today}`);

    // ✅ עדכון רשימת המשימות שהושלמו
    tasks.forEach(task => {
      if (task.is_completed) {
        completedTasksRef.current.add(task.id);
      }
    });

    // ✅ תיקון חדש: בדיקה אם יש משימה פעילה עכשיו
    const activeTaskId = getActiveTaskId(tasks);
    if (activeTaskId) {
      console.log(`⏱️ יש משימה פעילה: ${activeTaskId} - לא נשלח התראות "הגיע הזמן" למשימות אחרות`);
    }

    // ✅ חישוב לו"ז דינמי פעם אחת (מחוץ ל-loop)
    const dynamicSchedule = calculateDynamicSchedule(tasks, currentMinutes);
    console.log(`📅 לו"ז דינמי: ${dynamicSchedule.size} משימות`);

    let notificationsSent = 0;

    tasks.forEach(task => {
      // ✅ תיקון משופר: דלג על משימות שהושלמו (גם מה-ref וגם מה-task)
      if (task.is_completed || completedTasksRef.current.has(task.id)) {
        return;
      }
      
      // === התראה על סיום זמן המשימה ===
      // זה צריך לעבוד על כל משימה עם טיימר רץ, גם בלי due_date/due_time
      if (task.estimated_duration && isTimerRunning(task.id)) {
        const elapsed = getElapsedMinutes(task.id, task.time_spent || 0);
        const remaining = task.estimated_duration - elapsed;
        
        // התראה 5 דקות לפני סיום
        if (remaining > 0 && remaining <= 5) {
          if (canNotify(task.id, 'endingSoon', 5)) {
            console.log(`⏳ הזמן עומד להיגמר: ${task.title} (נשארו ${remaining} דק')`);
            sendNotification(`⏳ ${task.title}`, {
              body: `נשארו ${remaining} דקות לסיום הזמן המוקצב!`,
              tag: `task-ending-${task.id}`
            });
            markNotified(task.id, 'endingSoon');
            notificationsSent++;
          }
        }
        
        // התראה כשהזמן נגמר (אבל עדיין עובדים)
        if (remaining <= 0 && remaining > -2) {
          if (canNotify(task.id, 'timeUp', 5)) {
            console.log(`🔔 הזמן נגמר: ${task.title}`);
            sendNotification(`🔔 הזמן נגמר: ${task.title}`, {
              body: 'הזמן המוקצב הסתיים. לסיים או להמשיך?',
              tag: `task-timeup-${task.id}`
            });
            markNotified(task.id, 'timeUp');
            notificationsSent++;
          }
        }
        
        // התראה על חריגה מהזמן (כל 10 דקות)
        if (remaining < -2) {
          if (canNotify(task.id, 'overtime', repeatEveryMinutes)) {
            const overtimeMinutes = Math.abs(remaining);
            console.log(`⚠️ חריגה מהזמן: ${task.title} (+${overtimeMinutes} דק')`);
            sendNotification(`⚠️ חריגה: ${task.title}`, {
              body: `חרגת ב-${overtimeMinutes} דקות מהזמן המוקצב`,
              tag: `task-overtime-${task.id}`
            });
            markNotified(task.id, 'overtime');
            notificationsSent++;
          }
        }
      }
      
      // === התראות על זמן התחלה - לפי לו"ז דינמי! ===
      // ✅ תיקון: אם המשימה הזו היא המשימה הפעילה - לא צריך התראות "הגיע הזמן"
      if (activeTaskId === task.id) {
        console.log(`⏭️ דילוג על התראות התחלה ל"${task.title}" - זו המשימה הפעילה!`);
        return; // עוברים למשימה הבאה
      }
      
      // ✅ שימוש בלו"ז הדינמי שחושב מראש
      const taskSchedule = dynamicSchedule.get(task.id);
      
      // אם המשימה לא בלו"ז הדינמי (פרויקט גדול / לא להיום) - דלג
      if (!taskSchedule) {
        return;
      }
      
      // חישוב הפרש זמנים לפי הלו"ז הדינמי
      const diff = taskSchedule.startMinutes - currentMinutes; // חיובי = עתידי
      const endDiff = taskSchedule.endMinutes - currentMinutes; // מתי המשימה אמורה להסתיים
      
      console.log(`📋 ${task.title}: מתוכנן ${minutesToTimeString(taskSchedule.startMinutes)}-${minutesToTimeString(taskSchedule.endMinutes)} | diff=${diff} דק'`);

      // === התראה לפני המשימה ===
      if (diff > 0 && diff <= reminderMinutes) {
        // אם יש משימה פעילה אחרת - לא מתריעים
        if (activeTaskId && activeTaskId !== task.id) {
          console.log(`⏭️ דילוג על התראה מקדימה ל"${task.title}" - עובדים על משימה אחרת`);
          return;
        }
        
        if (canNotify(task.id, 'before', reminderMinutes)) {
          console.log(`⏰ התראה לפני: ${task.title} (בעוד ${diff} דק')`);
          sendNotification(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${diff} דקות (${minutesToTimeString(taskSchedule.startMinutes)})`,
            tag: `task-before-${task.id}`
          });
          markNotified(task.id, 'before');
          notificationsSent++;
        }
      }

      // === התראה בדיוק בזמן ===
      if (notifyOnTime && diff >= -1 && diff <= 1) {
        // אם יש משימה פעילה אחרת - לא מתריעים
        if (activeTaskId && activeTaskId !== task.id) {
          console.log(`⏭️ דילוג על התראת "הגיע הזמן" ל"${task.title}" - עובדים על משימה אחרת`);
          return;
        }
        
        if (canNotify(task.id, 'onTime', 5)) {
          console.log(`🔔 התראה בזמן: ${task.title}`);
          sendNotification(`🔔 ${task.title}`, {
            body: `הגיע הזמן להתחיל! (${taskSchedule.duration} דק')`,
            tag: `task-ontime-${task.id}`
          });
          markNotified(task.id, 'onTime');
          notificationsSent++;
        }
      }

      // === התראה על סיום משימה (לא רק התחלה!) ===
      // אם המשימה אמורה להסתיים בעוד 5 דקות (לפי הלו"ז)
      if (!isTimerRunning(task.id) && endDiff > 0 && endDiff <= 5) {
        if (canNotify(task.id, 'shouldEnd', 5)) {
          console.log(`⏳ המשימה אמורה להסתיים בקרוב: ${task.title} (בעוד ${endDiff} דק')`);
          sendNotification(`⏳ ${task.title}`, {
            body: `לפי הלו"ז, המשימה אמורה להסתיים ב-${minutesToTimeString(taskSchedule.endMinutes)}`,
            tag: `task-shouldend-${task.id}`
          });
          markNotified(task.id, 'shouldEnd');
          notificationsSent++;
        }
      }

      // === התראה על איחור ===
      // אם הזמן המתוכנן עבר ולא התחילו לעבוד
      if (diff < -1 && diff > -30) { // בין 1 דקה ל-30 דקות באיחור
        // אם יש משימה פעילה - לא מתריעים על איחור
        if (activeTaskId) {
          console.log(`⏭️ דילוג על התראת איחור ל"${task.title}" - יש משימה פעילה`);
          return;
        }
        
        // אם כבר עבדו על המשימה - לא מתריעים
        if (task.time_spent && task.time_spent > 0) {
          console.log(`⏭️ דילוג על "${task.title}" - כבר עבדו עליה (${task.time_spent} דקות)`);
          return;
        }
        
        // בדיקה אם הטיימר רץ (ב-localStorage)
        if (isTimerRunning(task.id)) {
          console.log(`⏭️ דילוג על "${task.title}" - טיימר פעיל`);
          return;
        }
        
        if (canNotify(task.id, 'late', repeatEveryMinutes)) {
          const lateMinutes = Math.abs(Math.round(diff));
          console.log(`⏰ התראה על איחור: ${task.title} (${lateMinutes} דק' באיחור)`);
          sendNotification(`⏰ ${task.title}`, {
            body: `היית אמור להתחיל לפני ${lateMinutes} דקות`,
            tag: `task-late-${task.id}`
          });
          markNotified(task.id, 'late');
          notificationsSent++;
        }
      }
    });

    if (notificationsSent > 0) {
      console.log(`📤 נשלחו ${notificationsSent} התראות`);
    }
  }, [tasks, permission, settings, canNotify, markNotified, sendNotification]);

  // הפעלת בדיקה תקופתית
  useEffect(() => {
    if (permission !== 'granted') {
      console.log('⚠️ NotificationChecker: ממתין להרשאת התראות');
      return;
    }

    console.log('🚀 NotificationChecker: מתחיל בדיקת התראות תקופתית');

    // בדיקה ראשונית מיידית
    checkAndNotify();

    // בדיקה כל 30 שניות
    checkIntervalRef.current = setInterval(() => {
      checkAndNotify();
    }, 30 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        console.log('⏹️ NotificationChecker: הופסקה בדיקת התראות');
      }
    };
  }, [permission, checkAndNotify]);

  // לא מציג כלום - רק עובד ברקע
  return null;
}

export default NotificationChecker;
