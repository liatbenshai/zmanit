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

// הגדרות ברירת מחדל - 5 דקות לפני
const DEFAULT_SETTINGS = {
  pushEnabled: true,
  reminderMinutes: 5,
  notifyOnTime: true,
  soundEnabled: true
};

/**
 * ספק התראות
 */
export function NotificationProvider({ children }) {
  console.log('🔔 NotificationProvider rendering...');
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState('default');
  const scheduledNotificationsRef = useRef({});

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
      // שמירת ההגדרה
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
      // יצירת צליל באמצעות Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      // צליל שני אחרי רבע שנייה
      setTimeout(() => {
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
      }, 250);
      
    } catch (e) {
      console.log('לא ניתן להשמיע צליל:', e);
    }
  }, [settings.soundEnabled]);

  // שליחת התראה עם צליל
  const sendNotificationWithSound = useCallback((title, options = {}) => {
    if (permission !== 'granted') return null;
    
    // השמעת צליל
    playNotificationSound();
    
    // שליחת התראה
    return sendLocalNotification(title, {
      ...options,
      requireInteraction: true
    });
  }, [permission, playNotificationSound]);

  // תזמון התראות למשימה (5 דקות לפני + בזמן)
  const scheduleTaskNotification = useCallback((task) => {
    if (permission !== 'granted') {
      console.log('⚠️ אין הרשאה להתראות');
      return;
    }
    
    if (!task.due_date || !task.due_time) {
      return;
    }

    // ביטול התראות קיימות למשימה זו
    if (scheduledNotificationsRef.current[task.id]) {
      scheduledNotificationsRef.current[task.id].forEach(id => clearTimeout(id));
      delete scheduledNotificationsRef.current[task.id];
    }

    const dueDateTime = new Date(`${task.due_date}T${task.due_time}`);
    const now = new Date();
    
    if (dueDateTime <= now) return; // המשימה כבר עברה

    const timeoutIds = [];
    const reminderMinutes = settings.reminderMinutes || 5;

    // התראה X דקות לפני
    const reminderTime = new Date(dueDateTime.getTime() - reminderMinutes * 60 * 1000);
    if (reminderTime > now) {
      const delay = reminderTime.getTime() - now.getTime();
      
      // הגבלה ל-24 שעות
      if (delay < 24 * 60 * 60 * 1000) {
        const timeoutId = setTimeout(() => {
          sendNotificationWithSound(`⏰ ${task.title}`, {
            body: `מתחיל בעוד ${reminderMinutes} דקות!`,
            tag: `task-reminder-${task.id}`,
            icon: '/icon-192.png'
          });
        }, delay);
        timeoutIds.push(timeoutId);
        console.log(`⏰ תוזמנה התראה ל-"${task.title}" בעוד ${Math.round(delay / 60000)} דקות`);
      }
    }

    // התראה בזמן המשימה
    if (settings.notifyOnTime) {
      const onTimeDelay = dueDateTime.getTime() - now.getTime();
      
      if (onTimeDelay > 0 && onTimeDelay < 24 * 60 * 60 * 1000) {
        const timeoutId = setTimeout(() => {
          sendNotificationWithSound(`🔔 ${task.title}`, {
            body: 'הגיע הזמן להתחיל!',
            tag: `task-ontime-${task.id}`,
            icon: '/icon-192.png'
          });
        }, onTimeDelay);
        timeoutIds.push(timeoutId);
        console.log(`🔔 תוזמנה התראה ל-"${task.title}" בזמן המשימה`);
      }
    }

    if (timeoutIds.length > 0) {
      scheduledNotificationsRef.current[task.id] = timeoutIds;
    }
  }, [permission, settings.reminderMinutes, settings.notifyOnTime, sendNotificationWithSound]);

  // תזמון התראות לרשימת משימות
  const scheduleTasksNotifications = useCallback((tasks) => {
    if (permission !== 'granted') return;
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const tasksToSchedule = tasks.filter(task => 
      !task.is_completed && 
      task.due_date && 
      task.due_time &&
      (task.due_date === today || task.due_date === tomorrow)
    );

    console.log(`🔔 מתזמן התראות ל-${tasksToSchedule.length} משימות`);
    
    tasksToSchedule.forEach(task => {
      scheduleTaskNotification(task);
    });
  }, [permission, scheduleTaskNotification]);

  // ביטול התראה למשימה
  const cancelTaskNotification = useCallback((taskId) => {
    if (scheduledNotificationsRef.current[taskId]) {
      scheduledNotificationsRef.current[taskId].forEach(id => clearTimeout(id));
      delete scheduledNotificationsRef.current[taskId];
      console.log(`❌ בוטלו התראות למשימה ${taskId}`);
    }
  }, []);

  // ביטול כל ההתראות
  const cancelAllNotifications = useCallback(() => {
    Object.keys(scheduledNotificationsRef.current).forEach(taskId => {
      scheduledNotificationsRef.current[taskId].forEach(id => clearTimeout(id));
    });
    scheduledNotificationsRef.current = {};
    console.log('❌ בוטלו כל ההתראות');
  }, []);

  // בדיקת התראות - לדיבוג
  const testNotification = useCallback(() => {
    sendNotificationWithSound('🧪 בדיקת התראות', {
      body: 'ההתראות עובדות!',
      tag: 'test-notification'
    });
  }, [sendNotificationWithSound]);

  // ניקוי בעת יציאה
  useEffect(() => {
    return () => {
      Object.values(scheduledNotificationsRef.current).forEach(timeoutIds => {
        timeoutIds.forEach(id => clearTimeout(id));
      });
    };
  }, []);

  const value = {
    settings,
    permission,
    isSupported: isNotificationSupported(),
    requestPermission,
    saveSettings,
    scheduleTaskNotification,
    scheduleTasksNotifications,
    cancelTaskNotification,
    cancelAllNotifications,
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
