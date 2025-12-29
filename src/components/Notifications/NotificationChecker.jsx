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
 * רכיב שבודק התראות - חייב להיות ב-App.jsx!
 * בודק כל 30 שניות אם יש משימות שצריך להתריע עליהן
 * 
 * ✅ תיקון: שימוש ב-toLocalISODate במקום toISOString
 */
function NotificationChecker() {
  const { tasks } = useTasks();
  const { permission, settings, sendNotification } = useNotifications();
  
  // מעקב אחרי התראות שנשלחו
  const lastNotifiedRef = useRef({});
  const checkIntervalRef = useRef(null);

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

    let notificationsSent = 0;

    tasks.forEach(task => {
      // דלג על משימות שהושלמו
      if (task.is_completed) return;
      
      // דלג על משימות בלי תאריך או שעה
      if (!task.due_date || !task.due_time) return;
      
      // רק משימות של היום
      if (task.due_date !== today) return;

      // חישוב הפרש זמנים
      const [hour, min] = task.due_time.split(':').map(Number);
      const taskMinutes = hour * 60 + (min || 0);
      const diff = taskMinutes - currentMinutes; // חיובי = עתידי, שלילי = עבר

      // === התראה לפני המשימה ===
      if (diff > 0 && diff <= reminderMinutes) {
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
      if (notifyOnTime && diff >= -1 && diff <= 0) {
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
      if (diff < -1) {
        // אם כבר עבדו על המשימה או שהטיימר רץ - לא מתריעים
        if (task.time_spent && task.time_spent > 0) {
          console.log(`⏭️ דילוג על "${task.title}" - כבר עבדו עליה (${task.time_spent} דקות)`);
          return; // דלג - המשימה בעבודה
        }
        
        // בדיקה אם הטיימר רץ (ב-localStorage)
        if (isTimerRunning(task.id)) {
          console.log(`⏭️ דילוג על "${task.title}" - טיימר פעיל`);
          return; // דלג - המשימה בעבודה עכשיו
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
