import { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

// יצירת קונטקסט
export const NotificationContext = createContext(null);

// הגדרות ברירת מחדל
const DEFAULT_SETTINGS = {
  pushEnabled: true,
  reminderMinutes: 5,
  notifyOnTime: true,
  soundEnabled: true,
  repeatEveryMinutes: 10,
  dailySummaryEnabled: true,
  dailySummaryTime: '17:00'
};

// סוגי צלילים
const SOUND_TYPES = {
  default: { freq1: 800, freq2: 1000, duration: 0.3 },
  success: { freq1: 523, freq2: 659, freq3: 784, duration: 0.2 },  // C-E-G chord
  warning: { freq1: 440, freq2: 440, duration: 0.4 },  // A note repeated
  error: { freq1: 200, freq2: 150, duration: 0.5 },  // Low descending
  complete: { freq1: 392, freq2: 523, freq3: 659, freq4: 784, duration: 0.15 }  // Victory fanfare
};

/**
 * בדיקה אם הדפדפן תומך בהתראות
 */
function isNotificationSupported() {
  return 'Notification' in window;
}

/**
 * בקשת הרשאה להתראות
 */
async function requestNotificationPermission() {
  if (!isNotificationSupported()) return false;
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('שגיאה בבקשת הרשאה:', err);
    return false;
  }
}

/**
 * ✅ תיקון v3.1: בדיקה משופרת אם יש טיימר פעיל
 * מאוחדת עם UnifiedNotificationManager
 */
function isTimerActiveForOtherTask(taskId) {
  try {
    const activeTimerId = localStorage.getItem('zmanit_active_timer');
    
    // אם אין טיימר פעיל בכלל - מותר לשלוח
    if (!activeTimerId || activeTimerId === 'null' || activeTimerId === 'undefined') {
      return false;
    }
    
    // אם זו אותה משימה - מותר לשלוח (התראה על המשימה הפעילה)
    if (taskId && activeTimerId === taskId) {
      return false;
    }
    
    // בודקים אם הטיימר באמת פעיל
    const timerData = localStorage.getItem(`timer_v2_${activeTimerId}`);
    if (timerData) {
      const data = JSON.parse(timerData);
      // טיימר נחשב פעיל אם הוא רץ, מושהה, או במצב הפרעה
      if (data.isRunning === true || data.isPaused === true || data.isInterrupted === true) {
        // יש טיימר פעיל על משימה אחרת - לא לשלוח התראה
        return true;
      }
    }
    
    // בדיקה נוספת: סריקת כל הטיימרים
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        const timerId = key.replace('timer_v2_', '');
        
        // אם זו אותה משימה - ממשיכים
        if (taskId && timerId === taskId) continue;
        
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.isRunning === true || data.isPaused === true || data.isInterrupted === true) {
            return true; // יש טיימר פעיל על משימה אחרת
          }
        } catch (e) {}
      }
    }
    
    return false;
  } catch (e) {
    console.error('[NotificationContext] שגיאה בבדיקת טיימר:', e);
    return false;
  }
}

/**
 * שליחת התראה מקומית
 * ✅ תיקון v3.1: בדיקה משופרת של טיימר פעיל
 */
function sendLocalNotification(title, options = {}) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;
  
  // ✅ תיקון v3.1: אם יש טיימר רץ על משימה אחרת - לא לשלוח התראה
  const taskId = options.taskId || options.data?.taskId;
  if (isTimerActiveForOtherTask(taskId)) {
    console.log('🔇 NotificationContext: יש טיימר פעיל - לא שולח התראה על משימה אחרת');
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      requireInteraction: true,
      ...options
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (err) {
    console.error('שגיאה בשליחת התראה:', err);
    return null;
  }
}

/**
 * ספק התראות
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [permission, setPermission] = useState('default');

  // בדיקת הרשאות בעליה
  useEffect(() => {
    if (isNotificationSupported()) {
      setPermission(Notification.permission);
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

  // שמירת הגדרות
  const saveSettings = async (newSettings) => {
    if (!user?.id) return;

    try {
      localStorage.setItem(`notification_settings_${user.id}`, JSON.stringify(newSettings));
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('שגיאה בשמירת הגדרות:', err);
      throw err;
    }
  };

  // השמעת צליל לפי סוג
  const playSound = useCallback((type = 'default') => {
    if (!settings.soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const soundConfig = SOUND_TYPES[type] || SOUND_TYPES.default;
      
      const playTone = (freq, startTime, duration, volume = 0.3) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      const { duration } = soundConfig;
      
      if (type === 'success' || type === 'complete') {
        // צליל הצלחה - אקורד עולה
        playTone(soundConfig.freq1, now, duration, 0.25);
        playTone(soundConfig.freq2, now + duration, duration, 0.25);
        if (soundConfig.freq3) playTone(soundConfig.freq3, now + duration * 2, duration, 0.25);
        if (soundConfig.freq4) playTone(soundConfig.freq4, now + duration * 3, duration * 1.5, 0.3);
      } else if (type === 'warning') {
        // צליל אזהרה - צליל חוזר
        playTone(soundConfig.freq1, now, duration, 0.3);
        playTone(soundConfig.freq2, now + duration * 1.5, duration, 0.3);
      } else if (type === 'error') {
        // צליל שגיאה - יורד
        playTone(soundConfig.freq1, now, duration, 0.35);
        playTone(soundConfig.freq2, now + duration, duration * 1.2, 0.3);
      } else {
        // צליל רגיל
        playTone(soundConfig.freq1, now, duration, 0.3);
        playTone(soundConfig.freq2, now + duration + 0.1, duration, 0.3);
      }
    } catch (e) {
      // שגיאה בהשמעת צליל - לא קריטי
    }
  }, [settings.soundEnabled]);

  // שליחת התראה עם צליל
  const sendNotification = useCallback((title, options = {}) => {
    if (permission !== 'granted') return null;
    
    const soundType = options.soundType || 'default';
    playSound(soundType);
    
    return sendLocalNotification(title, options);
  }, [permission, playSound]);

  // התראת הצלחה (השלמת משימה)
  const notifySuccess = useCallback((title, body) => {
    return sendNotification(title, {
      body,
      tag: 'success-' + Date.now(),
      soundType: 'success'
    });
  }, [sendNotification]);

  // התראת אזהרה
  const notifyWarning = useCallback((title, body) => {
    return sendNotification(title, {
      body,
      tag: 'warning-' + Date.now(),
      soundType: 'warning'
    });
  }, [sendNotification]);

  // התראת השלמת משימה (fanfare!)
  const notifyComplete = useCallback((taskTitle) => {
    playSound('complete');
    return sendNotification('🎉 כל הכבוד!', {
      body: `"${taskTitle}" הושלמה בהצלחה!`,
      tag: 'complete-' + Date.now()
    });
  }, [sendNotification, playSound]);

  // בדיקת התראות
  const testNotification = useCallback(() => {
    sendNotification('🧪 בדיקת התראות', {
      body: 'ההתראות עובדות!',
      tag: 'test-notification'
    });
  }, [sendNotification]);

  const value = {
    settings,
    permission,
    isSupported: isNotificationSupported(),
    requestPermission,
    saveSettings,
    sendNotification,
    notifySuccess,
    notifyWarning,
    notifyComplete,
    playSound,
    testNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
