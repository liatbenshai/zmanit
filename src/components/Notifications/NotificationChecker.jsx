import { useEffect, useRef, useCallback } from 'react';
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
      return data.isRunning && !data.isInterrupted;
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
      return task.id;
    }
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
 * רכיב שבודק התראות - חייב להיות ב-App.jsx!
 * בודק כל 30 שניות אם יש משימות שצריך להתריע עליהן
 * 
 * ✅ תיקון: שימוש ב-toLocalISODate במקום toISOString
 * ✅ תיקון חדש: לא שולח התראות "הגיע הזמן להתחיל" כשעובדים על משימה אחרת
 * ✅ תיקון: בדיקה מחודשת של is_completed
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
      
      // === התראות על זמן התחלה - רק למשימות עם תאריך ושעה ===
      // דלג על משימות בלי תאריך או שעה
      if (!task.due_date || !task.due_time) return;
      
      // רק משימות של היום
      if (task.due_date !== today) return;

      // ✅ תיקון: דלג על "פרויקטים" גדולים - הם מחולקים לבלוקים
      // אם משימה היא יותר מ-3 שעות, היא לא באמת מתוכננת לשעה הזו
      const taskDuration = task.estimated_duration || 30;
      if (taskDuration > 180) {
        console.log(`⏭️ דילוג על "${task.title}" - פרויקט גדול (${taskDuration} דק')`);
        return;
      }

      // חישוב הפרש זמנים
      const [hour, min] = task.due_time.split(':').map(Number);
      const taskMinutes = hour * 60 + (min || 0);
      const diff = taskMinutes - currentMinutes; // חיובי = עתידי, שלילי = עבר

      // ✅ תיקון: אם המשימה מתוכננת ליותר משעה מעכשיו - לא מתריעים
      if (diff > 60) {
        return; // המשימה רחוקה, לא צריך התראות עכשיו
      }

      // === התראה לפני המשימה ===
      // ✅ תיקון: לא מתריעים אם עובדים על משימה אחרת
      if (diff > 0 && diff <= reminderMinutes) {
        // אם יש משימה פעילה אחרת - לא מתריעים
        if (activeTaskId && activeTaskId !== task.id) {
          console.log(`⏭️ דילוג על התראה מקדימה ל"${task.title}" - עובדים על משימה אחרת`);
          return;
        }
        
        if (canNotify(task.id, 'before', reminderMinutes)) {
          console.log(`⏰ התראה לפני: ${task.title} (בעוד ${diff} דק')`);
          sendNotification(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${diff} דקות!`,
            tag: `task-before-${task.id}`
          });
          markNotified(task.id, 'before');
          notificationsSent++;
        }
      }

      // === התראה בדיוק בזמן ===
      // ✅ תיקון: לא מתריעים אם עובדים על משימה אחרת
      if (notifyOnTime && diff >= -1 && diff <= 0) {
        // אם יש משימה פעילה אחרת - לא מתריעים
        if (activeTaskId && activeTaskId !== task.id) {
          console.log(`⏭️ דילוג על התראת "הגיע הזמן" ל"${task.title}" - עובדים על משימה אחרת`);
          return;
        }
        
        if (canNotify(task.id, 'onTime', 5)) {
          console.log(`🔔 התראה בזמן: ${task.title}`);
          sendNotification(`🔔 ${task.title}`, {
            body: 'הגיע הזמן להתחיל!',
            tag: `task-ontime-${task.id}`
          });
          markNotified(task.id, 'onTime');
          notificationsSent++;
        }
      }

      // === התראה על איחור ===
      // ✅ תיקון: לא מתריעים על משימות שכבר עובדים עליהן
      // ✅ תיקון חדש: לא מתריעים אם עובדים על משימה אחרת
      // ✅ תיקון: לא מתריעים על משימות שעברו יותר מ-2 שעות - כנראה נדחו
      if (diff < -1 && diff > -120) { // בין 1 דקה ל-2 שעות באיחור
        // אם יש משימה פעילה (כולל אם זו המשימה הזו או אחרת) - לא מתריעים על איחור
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
        
        if (canNotify(task.id, 'overdue', repeatEveryMinutes)) {
          const overdueMinutes = Math.abs(diff);
          let overdueText;
          if (overdueMinutes >= 60) {
            const hours = Math.floor(overdueMinutes / 60);
            const mins = overdueMinutes % 60;
            overdueText = mins > 0 ? `${hours} שעות ו-${mins} דקות` : `${hours} שעות`;
          } else {
            overdueText = `${overdueMinutes} דקות`;
          }
          
          console.log(`🔴 נדחה: ${task.title} (${overdueText})`);
          sendNotification(`🔄 נדחה: ${task.title}`, {
            body: `היה אמור להתחיל לפני ${overdueText}`,
            tag: `task-overdue-${task.id}`
          });
          markNotified(task.id, 'overdue');
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
