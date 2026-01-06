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
  repeatEveryMinutes: 10
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
 * שליחת התראה מקומית
 */
function sendLocalNotification(title, options = {}) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

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

  // השמעת צליל
  const playSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
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
    }
  }, [settings.soundEnabled]);

  // שליחת התראה עם צליל
  const sendNotification = useCallback((title, options = {}) => {
    if (permission !== 'granted') return null;
    
    playSound();
    return sendLocalNotification(title, options);
  }, [permission, playSound]);

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
    testNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
