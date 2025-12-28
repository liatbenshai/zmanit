import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  sendLocalNotification
} from '../services/pushNotifications';

// יצירת קונטקסט
export const NotificationContext = createContext(null);

// הגדרות ברירת מחדל
const DEFAULT_SETTINGS = {
  pushEnabled: true,
  reminderMinutes: 5,
  notifyOnTime: true,
  soundEnabled: true,
  repeatEveryMinutes: 10 // תזכורת חוזרת כל 10 דקות למשימות באיחור
};

/**
 * ספק התראות
 */
export function NotificationProvider({ children }) {
  console.log('🔔 NotificationProvider rendering...');
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState('default');
  
  // מעקב אחרי התראות שנשלחו (למניעת ספאם)
  const lastNotifiedRef = useRef({}); // { taskId: { before: timestamp, onTime: timestamp, overdue: timestamp } }
  const checkIntervalRef = useRef(null);
  const tasksRef = useRef([]); // המשימות הנוכחיות

  // בדיקת הרשאות בעליה
  useEffect(() => {
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
  }, []);

  // טעינת הגדרות מ-localStorage
  useEffect(() => {
    if (!user?.id) return;

    try {
      const saved = localStorage.getItem(`notification_settings_${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      console.log('משתמש בהגדרות ברירת מחדל');
    }
  }, [user?.id]);

  // בקשת הרשאה להתראות
  const requestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    
    if (granted) {
      await saveSettings({ ...settings, pushEnabled: true });
    }
    
    return granted;
  };

  // שמירת הגדרות ב-localStorage
  const saveSettings = async (newSettings) => {
    if (!user?.id) return;

    try {
      localStorage.setItem(`notification_settings_${user.id}`, JSON.stringify(newSettings));
      setSettings(newSettings);
      console.log('✅ הגדרות התראות נשמרו');
      return true;
    } catch (err) {
      console.error('שגיאה בשמירת הגדרות:', err);
      throw new Error('שגיאה בשמירת הגדרות');
    }
  };

  // השמעת צליל התראה
  const playNotificationSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // צליל ראשון
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 800;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.5);
      
      // צליל שני
      setTimeout(() => {
        try {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1000;
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.5);
        } catch (e) {}
      }, 250);
      
    } catch (e) {
      console.log('לא ניתן להשמיע צליל');
    }
  }, [settings.soundEnabled]);

  // שליחת התראה עם צליל
  const sendNotificationWithSound = useCallback((title, options = {}) => {
    if (permission !== 'granted') return null;
    
    playNotificationSound();
    
    return sendLocalNotification(title, {
      ...options,
      requireInteraction: true
    });
  }, [permission, playNotificationSound]);

  // בדיקה אם עבר מספיק זמן מההתראה האחרונה
  const canNotify = useCallback((taskId, type, minIntervalMinutes = 10) => {
    const now = Date.now();
    const lastNotified = lastNotifiedRef.current[taskId]?.[type];
    
    if (!lastNotified) return true;
    
    const minutesSinceLastNotification = (now - lastNotified) / (1000 * 60);
    return minutesSinceLastNotification >= minIntervalMinutes;
  }, []);

  // סימון שנשלחה התראה
  const markNotified = useCallback((taskId, type) => {
    if (!lastNotifiedRef.current[taskId]) {
      lastNotifiedRef.current[taskId] = {};
    }
    lastNotifiedRef.current[taskId][type] = Date.now();
  }, []);

  // בדיקת משימות ושליחת התראות
  const checkTasksAndNotify = useCallback(() => {
    if (permission !== 'granted') return;
    
    const tasks = tasksRef.current;
    if (!tasks || tasks.length === 0) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    console.log(`🔍 בודק ${tasks.length} משימות...`);

    tasks.forEach(task => {
      if (task.is_completed) return;
      if (!task.due_date || !task.due_time) return;
      if (task.due_date !== today) return; // רק משימות של היום

      const [hour, min] = task.due_time.split(':').map(Number);
      const taskMinutes = hour * 60 + (min || 0);
      const diff = taskMinutes - currentMinutes; // חיובי = עתידי, שלילי = עבר

      // התראה X דקות לפני
      const reminderMinutes = settings.reminderMinutes || 5;
      if (diff > 0 && diff <= reminderMinutes) {
        if (canNotify(task.id, 'before', reminderMinutes)) {
          console.log(`⏰ התראה לפני: ${task.title} (בעוד ${diff} דקות)`);
          sendNotificationWithSound(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${diff} דקות!`,
            tag: `task-before-${task.id}`
          });
          markNotified(task.id, 'before');
        }
      }

      // התראה בדיוק בזמן (0-1 דקות)
      if (settings.notifyOnTime && diff >= -1 && diff <= 0) {
        if (canNotify(task.id, 'onTime', 5)) {
          console.log(`🔔 התראה בזמן: ${task.title}`);
          sendNotificationWithSound(`🔔 ${task.title}`, {
            body: 'הגיע הזמן להתחיל!',
            tag: `task-ontime-${task.id}`
          });
          markNotified(task.id, 'onTime');
        }
      }

      // התראה על איחור (כל X דקות)
      const repeatEvery = settings.repeatEveryMinutes || 10;
      if (diff < -1) {
        if (canNotify(task.id, 'overdue', repeatEvery)) {
          const overdueMinutes = Math.abs(diff);
          let overdueText;
          if (overdueMinutes >= 60) {
            const hours = Math.floor(overdueMinutes / 60);
            const mins = overdueMinutes % 60;
            overdueText = mins > 0 ? `${hours} שעות ו-${mins} דקות` : `${hours} שעות`;
          } else {
            overdueText = `${overdueMinutes} דקות`;
          }
          
          console.log(`🔴 התראה על איחור: ${task.title} (${overdueText})`);
          sendNotificationWithSound(`🔴 באיחור: ${task.title}`, {
            body: `היה אמור להתחיל לפני ${overdueText}!`,
            tag: `task-overdue-${task.id}`
          });
          markNotified(task.id, 'overdue');
        }
      }
    });
  }, [permission, settings, canNotify, markNotified, sendNotificationWithSound]);

  // עדכון רשימת המשימות (נקרא מבחוץ)
  const updateTasks = useCallback((tasks) => {
    tasksRef.current = tasks;
  }, []);

  // הפעלת בדיקה תקופתית
  useEffect(() => {
    if (permission !== 'granted') return;

    // בדיקה ראשונית
    checkTasksAndNotify();

    // בדיקה כל 30 שניות
    checkIntervalRef.current = setInterval(() => {
      checkTasksAndNotify();
    }, 30 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [permission, checkTasksAndNotify]);

  // בדיקת התראות - לדיבוג
  const testNotification = useCallback(() => {
    sendNotificationWithSound('🧪 בדיקת התראות', {
      body: 'ההתראות עובדות!',
      tag: 'test-notification'
    });
  }, [sendNotificationWithSound]);

  // ניקוי התראות ישנות (משימות שהושלמו)
  const clearTaskNotifications = useCallback((taskId) => {
    delete lastNotifiedRef.current[taskId];
  }, []);

  const value = {
    settings,
    permission,
    isSupported: isNotificationSupported(),
    requestPermission,
    saveSettings,
    updateTasks,
    checkTasksAndNotify,
    clearTaskNotifications,
    sendNotification: sendNotificationWithSound,
    testNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
