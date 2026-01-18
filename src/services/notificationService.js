/**
 * שירות התראות מאוחד - המקור היחיד לכל ההתראות במערכת
 * ===========================================================
 * 
 * זה המקור היחיד להתראות - כל המערכות האחרות שולחות דרך זה
 * השירות מחליט מתי לשלוח, איזה סוג, ומה התור
 */

import toast from 'react-hot-toast';

// סוגי התראות
export const NOTIFICATION_TYPES = {
  TOAST: 'toast',
  PUSH: 'push',
  POPUP: 'popup',
  BLOCKING_POPUP: 'blocking_popup',
  BANNER: 'banner'
};

// דחיפות
export const PRIORITY = {
  CRITICAL: 'critical',   // פופאפ חוסם
  HIGH: 'high',           // פופאפ רגיל
  MEDIUM: 'medium',       // Toast ארוך
  LOW: 'low'              // Toast קצר
};

// סוגי התראות לפי תוכן
export const ALERT_TYPES = {
  TASK_STARTING_SOON: 'task_starting_soon',
  TASK_STARTED: 'task_started',
  TASK_ENDING_SOON: 'task_ending_soon',
  TASK_OVERTIME: 'task_overtime',
  TASK_OVERDUE: 'task_overdue',
  TRANSITION_NEEDED: 'transition_needed',
  BREAK_REMINDER: 'break_reminder',
  DEADLINE_CONFLICT: 'deadline_conflict'
};

/**
 * מחלקת שירות התראות
 */
class NotificationService {
  constructor() {
    // תור התראות
    this.queue = [];
    
    // היסטוריית התראות (למניעת כפילויות)
    this.history = [];
    
    // callbacks
    this.callbacks = {
      onPopup: null,
      onBanner: null
    };
    
    // מפתחות ששלחו התראות לאחרונה (למניעת כפילויות)
    this.lastSent = {};
    
    // הגדרות
    this.settings = {
      enabled: true,
      pushEnabled: false,
      minIntervalMinutes: 5, // מרווח מינימלי בין התראות זהות
      maxHistorySize: 100
    };
    
    // בדיקת הרשאות Push
    this.permission = 'default';
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }
  
  /**
   * אתחול השירות
   */
  init(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    
    // בקשת הרשאה אם צריך
    if (this.permission === 'default' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        this.permission = permission;
        this.settings.pushEnabled = permission === 'granted';
      });
    }
    
    // ניקוי היסטוריה ישנה
    this.cleanHistory();
    
    return this;
  }
  
  /**
   * שליחת התראה
   */
  async send(alert) {
    if (!this.settings.enabled) return;
    
    // בדיקת כפילויות
    if (!this.canSend(alert)) {
      console.log('🔇 [NotificationService] התראה כפולה נחסמה:', alert.id);
      return;
    }
    
    // שמירה בהיסטוריה
    this.recordSent(alert);
    
    // הוספה לתור
    if (alert.priority === PRIORITY.CRITICAL) {
      // התראות קריטיות קודמות
      this.queue.unshift(alert);
    } else {
      this.queue.push(alert);
    }
    
    // עיבוד התור
    await this.processQueue();
  }
  
  /**
   * עיבוד תור ההתראות
   */
  async processQueue() {
    if (this.queue.length === 0) return;
    
    const alert = this.queue.shift();
    
    // שליחה לפי סוג ודחיפות
    switch (alert.priority) {
      case PRIORITY.CRITICAL:
        await this.sendCritical(alert);
        break;
      case PRIORITY.HIGH:
        await this.sendHigh(alert);
        break;
      case PRIORITY.MEDIUM:
        await this.sendMedium(alert);
        break;
      case PRIORITY.LOW:
        await this.sendLow(alert);
        break;
      default:
        await this.sendLow(alert);
    }
  }
  
  /**
   * שליחת התראה קריטית - פופאפ חוסם
   */
  async sendCritical(alert) {
    // Push notification
    if (this.settings.pushEnabled && this.permission === 'granted') {
      this.sendPushNotification(alert);
    }
    
    // Toast ארוך
    toast.error(alert.message || alert.title, {
      duration: 10000,
      icon: this.getIcon(alert.type)
    });
    
    // פופאפ חוסם
    if (this.callbacks.onPopup) {
      this.callbacks.onPopup({ ...alert, blockingPopup: true });
    }
  }
  
  /**
   * שליחת התראה גבוהה - פופאפ רגיל
   */
  async sendHigh(alert) {
    // Push notification
    if (this.settings.pushEnabled && this.permission === 'granted') {
      this.sendPushNotification(alert);
    }
    
    // Toast ארוך
    toast(alert.message || alert.title, {
      duration: 8000,
      icon: this.getIcon(alert.type)
    });
    
    // פופאפ (אם צריך)
    if (alert.showPopup && this.callbacks.onPopup) {
      this.callbacks.onPopup({ ...alert, blockingPopup: false });
    }
  }
  
  /**
   * שליחת התראה בינונית - Toast ארוך
   */
  async sendMedium(alert) {
    // Push notification (אופציונלי)
    if (alert.sendPush && this.settings.pushEnabled && this.permission === 'granted') {
      this.sendPushNotification(alert);
    }
    
    // Toast
    toast(alert.message || alert.title, {
      duration: 6000,
      icon: this.getIcon(alert.type)
    });
  }
  
  /**
   * שליחת התראה נמוכה - Toast קצר
   */
  async sendLow(alert) {
    // Toast קצר
    toast(alert.message || alert.title, {
      duration: 4000,
      icon: this.getIcon(alert.type)
    });
  }
  
  /**
   * שליחת Push Notification
   */
  sendPushNotification(alert) {
    if (!('Notification' in window) || this.permission !== 'granted') {
      return;
    }
    
    try {
      const notification = new Notification(alert.title, {
        body: alert.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        dir: 'rtl',
        lang: 'he',
        tag: alert.id || `alert-${Date.now()}`,
        requireInteraction: alert.priority === PRIORITY.CRITICAL,
        vibrate: alert.vibrate ? [200, 100, 200] : undefined
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (alert.onClick) alert.onClick();
      };
      
      // סגירה אוטומטית אחרי 10 שניות
      setTimeout(() => {
        notification.close();
      }, 10000);
    } catch (err) {
      console.error('❌ שגיאה בשליחת Push Notification:', err);
    }
  }
  
  /**
   * בדיקה אם אפשר לשלוח התראה (מניעת כפילויות)
   */
  canSend(alert) {
    if (!alert.id && !alert.key) return true;
    
    const key = alert.key || `${alert.type}-${alert.taskId || ''}`;
    const lastSent = this.lastSent[key];
    
    if (!lastSent) return true;
    
    // בדיקת מרווח זמן
    const now = Date.now();
    const minutesSinceLastNotification = (now - lastSent) / (1000 * 60);
    const minInterval = alert.minIntervalMinutes || this.settings.minIntervalMinutes;
    
    return minutesSinceLastNotification >= minInterval;
  }
  
  /**
   * רישום שנשלחה התראה
   */
  recordSent(alert) {
    const key = alert.key || `${alert.type}-${alert.taskId || ''}`;
    this.lastSent[key] = Date.now();
    
    // שמירה בהיסטוריה
    this.history.push({
      ...alert,
      timestamp: Date.now()
    });
    
    // ניקוי היסטוריה ישנה
    if (this.history.length > this.settings.maxHistorySize) {
      this.history = this.history.slice(-this.settings.maxHistorySize);
    }
  }
  
  /**
   * ניקוי היסטוריה ישנה (יותר מ-24 שעות)
   */
  cleanHistory() {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);
    
    this.history = this.history.filter(alert => alert.timestamp > dayAgo);
    
    // ניקוי lastSent ישן
    Object.keys(this.lastSent).forEach(key => {
      if (this.lastSent[key] < dayAgo) {
        delete this.lastSent[key];
      }
    });
  }
  
  /**
   * קבלת אייקון לפי סוג התראה
   */
  getIcon(type) {
    const icons = {
      [ALERT_TYPES.TASK_STARTING_SOON]: '⏰',
      [ALERT_TYPES.TASK_STARTED]: '▶️',
      [ALERT_TYPES.TASK_ENDING_SOON]: '⏳',
      [ALERT_TYPES.TASK_OVERTIME]: '🔔',
      [ALERT_TYPES.TASK_OVERDUE]: '🔴',
      [ALERT_TYPES.TRANSITION_NEEDED]: '🔄',
      [ALERT_TYPES.BREAK_REMINDER]: '☕',
      [ALERT_TYPES.DEADLINE_CONFLICT]: '🚨'
    };
    
    return icons[type] || '🔔';
  }
  
  /**
   * עדכון הגדרות
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
  
  /**
   * בקשת הרשאה להתראות Push
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      this.settings.pushEnabled = permission === 'granted';
      return permission === 'granted';
    } catch (err) {
      console.error('❌ שגיאה בבקשת הרשאה:', err);
      return false;
    }
  }
  
  /**
   * ביטול כל ההתראות בתור
   */
  clearQueue() {
    this.queue = [];
  }
  
  /**
   * ניקוי מלא
   */
  reset() {
    this.queue = [];
    this.history = [];
    this.lastSent = {};
  }
}

// Singleton instance
export const notificationService = new NotificationService();

export default notificationService;

