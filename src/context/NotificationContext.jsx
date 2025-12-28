import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { 
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  scheduleNotification,
  cancelScheduledNotification,
  sendLocalNotification
} from '../services/pushNotifications';

// יצירת קונטקסט
export const NotificationContext = createContext(null);

// הגדרות ברירת מחדל
const DEFAULT_SETTINGS = {
  pushEnabled: false,
  emailEnabled: false,
  reminderMinutes: 15,
  dailySummaryEnabled: false,
  dailySummaryTime: '08:00'
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

  // טעינת הגדרות מהשרת
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setSettings({
            pushEnabled: data.push_enabled,
            emailEnabled: data.email_enabled,
            reminderMinutes: data.reminder_minutes,
            dailySummaryEnabled: data.daily_summary_enabled,
            dailySummaryTime: data.daily_summary_time
          });
        }
      } catch (err) {
        console.log('אין הגדרות קיימות, משתמש בברירת מחדל');
      }
    };

    loadSettings();
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

  // שמירת הגדרות
  const saveSettings = async (newSettings) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          push_enabled: newSettings.pushEnabled,
          email_enabled: newSettings.emailEnabled,
          reminder_minutes: newSettings.reminderMinutes,
          daily_summary_enabled: newSettings.dailySummaryEnabled,
          daily_summary_time: newSettings.dailySummaryTime,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('שגיאה בשמירת הגדרות:', err);
      throw new Error('שגיאה בשמירת הגדרות');
    }
  };

  // תזמון התראה למשימה
  const scheduleTaskNotification = useCallback((task) => {
    // בדיקת תנאים בסיסיים
    if (permission !== 'granted') {
      console.log('⚠️ אין הרשאה להתראות');
      return;
    }
    
    if (!task.due_date) {
      return; // אין תאריך - אין מה לתזמן
    }

    // ביטול התראה קיימת אם יש
    if (scheduledNotificationsRef.current[task.id]) {
      cancelScheduledNotification(scheduledNotificationsRef.current[task.id]);
      delete scheduledNotificationsRef.current[task.id];
    }

    // תזמון התראה חדשה
    const reminderMinutes = task.reminder_minutes || settings.reminderMinutes || 15;
    const timeoutId = scheduleNotification(task, reminderMinutes);
    
    if (timeoutId) {
      scheduledNotificationsRef.current[task.id] = timeoutId;
      console.log(`✅ תוזמנה התראה למשימה "${task.title}"`);
    }
  }, [permission, settings.reminderMinutes]);

  // תזמון התראות לרשימת משימות
  const scheduleTasksNotifications = useCallback((tasks) => {
    if (permission !== 'granted') return;
    
    const today = new Date().toISOString().split('T')[0];
    const tasksToSchedule = tasks.filter(task => 
      !task.is_completed && 
      task.due_date && 
      task.due_date >= today
    );

    console.log(`🔔 מתזמן התראות ל-${tasksToSchedule.length} משימות`);
    
    tasksToSchedule.forEach(task => {
      scheduleTaskNotification(task);
    });
  }, [permission, scheduleTaskNotification]);

  // ביטול התראה למשימה
  const cancelTaskNotification = useCallback((taskId) => {
    if (scheduledNotificationsRef.current[taskId]) {
      cancelScheduledNotification(scheduledNotificationsRef.current[taskId]);
      delete scheduledNotificationsRef.current[taskId];
      console.log(`❌ בוטלה התראה למשימה ${taskId}`);
    }
  }, []);

  // ביטול כל ההתראות
  const cancelAllNotifications = useCallback(() => {
    Object.keys(scheduledNotificationsRef.current).forEach(taskId => {
      cancelScheduledNotification(scheduledNotificationsRef.current[taskId]);
    });
    scheduledNotificationsRef.current = {};
    console.log('❌ בוטלו כל ההתראות');
  }, []);

  // שליחת התראה מיידית
  const sendNotification = useCallback((title, options = {}) => {
    if (permission !== 'granted') {
      console.warn('אין הרשאה להתראות');
      return null;
    }
    return sendLocalNotification(title, options);
  }, [permission]);

  // ניקוי בעת יציאה
  useEffect(() => {
    return () => {
      // ביטול כל ההתראות המתוזמנות בעת unmount
      Object.values(scheduledNotificationsRef.current).forEach(timeoutId => {
        cancelScheduledNotification(timeoutId);
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
    sendNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
