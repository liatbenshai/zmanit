/**
 * שירות טיימרים מאוחד - המקור היחיד לכל הטיימרים במערכת
 * ===========================================================
 * 
 * זה המקור היחיד לטיימרים - כל הטיימרים שומרים וקוראים דרך זה
 * השירות מנהל את כל הטיימרים בפורמט אחיד
 */

// מימוש פשוט של EventEmitter לדפדפן
class SimpleEventEmitter {
  constructor() { this._events = {}; }
  on(event, listener) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(listener);
    return this;
  }
  off(event, listener) {
    if (!this._events[event]) return this;
    this._events[event] = this._events[event].filter(l => l !== listener);
    return this;
  }
  emit(event, ...args) {
    if (!this._events[event]) return false;
    this._events[event].forEach(listener => {
      try { listener(...args); } catch (e) { console.error('Event listener error:', e); }
    });
    return true;
  }
  removeAllListeners(event) {
    if (event) delete this._events[event];
    else this._events = {};
    return this;
  }
}

/**
 * מחלקת שירות טיימרים
 */
class TimerService extends SimpleEventEmitter {
  constructor() {
    super();
    
    // מפתח אחיד לשמירה
    this.STORAGE_KEY_PREFIX = 'timer_v2_';
    this.ACTIVE_TIMER_KEY = 'zmanit_active_timer';
    
    // Cache של טיימרים פעילים
    this.activeTimers = new Map();
    
    // בדיקת טיימרים כל 5 שניות
    this.checkInterval = null;
    this.startChecking();
    
    // האזנה לשינויים ב-localStorage (לסינכרון בין טאבים)
    this.setupStorageListener();
  }
  
  /**
   * התחלת מעקב אחר טיימרים
   */
  startChecking() {
    if (this.checkInterval) return;
    
    // בדיקה ראשונית
    this.checkActiveTimers();
    
    // בדיקה כל 5 שניות
    this.checkInterval = setInterval(() => {
      this.checkActiveTimers();
    }, 5000);
  }
  
  /**
   * עצירת מעקב
   */
  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  /**
   * בדיקת כל הטיימרים הפעילים
   */
  checkActiveTimers() {
    const timers = {};
    let activeTaskId = null;
    
    // סריקת כל מפתחות הטיימר
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const data = JSON.parse(saved);
            const taskId = key.replace(this.STORAGE_KEY_PREFIX, '');
            
            // בדיקה אם הטיימר פעיל
            const isActive = this.isTimerActive(data);
            
            if (isActive) {
              timers[taskId] = data;
              
              // אם הטיימר רץ (לא מושהה/מופרע) - זה הטיימר הפעיל
              if (data.isRunning === true && !data.isPaused && !data.isInterrupted) {
                activeTaskId = taskId;
              }
            }
          }
        } catch (e) {
          // התעלם משגיאות parsing
        }
      }
    }
    
    // עדכון מפתח הטיימר הפעיל
    if (activeTaskId) {
      localStorage.setItem(this.ACTIVE_TIMER_KEY, activeTaskId);
    } else {
      localStorage.removeItem(this.ACTIVE_TIMER_KEY);
    }
    
    // עדכון cache
    const previousActive = new Set(this.activeTimers.keys());
    const currentActive = new Set(Object.keys(timers));
    
    // בדיקה אם יש שינויים
    const hasChanges = 
      previousActive.size !== currentActive.size ||
      [...previousActive].some(id => !currentActive.has(id)) ||
      [...currentActive].some(id => !previousActive.has(id));
    
    if (hasChanges) {
      this.activeTimers.clear();
      Object.entries(timers).forEach(([taskId, data]) => {
        this.activeTimers.set(taskId, data);
      });
      
      // שליחת אירוע שינוי
      this.emit('timersChanged', {
        activeTimers: { ...timers },
        activeTaskId
      });
    }
  }
  
  /**
   * בדיקה אם טיימר פעיל
   */
  isTimerActive(timerData) {
    if (!timerData) return false;
    
    // טיימר רץ
    if (timerData.isRunning === true) return true;
    
    // טיימר מושהה
    if (timerData.isPaused === true && timerData.startTime) return true;
    
    // טיימר מופרע (יש startTime אבל מופרע)
    if (timerData.isInterrupted === true && timerData.startTime) return true;
    
    return false;
  }
  
  /**
   * שמירת טיימר
   */
  saveTimer(taskId, timerData) {
    if (!taskId) return false;
    
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${taskId}`;
      const data = {
        ...timerData,
        taskId,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      
      // עדכון cache
      if (this.isTimerActive(data)) {
        this.activeTimers.set(taskId, data);
        
        // אם זה הטיימר הפעיל - עדכן את המפתח
        if (data.isRunning === true && !data.isPaused && !data.isInterrupted) {
          localStorage.setItem(this.ACTIVE_TIMER_KEY, taskId);
        }
      } else {
        this.activeTimers.delete(taskId);
      }
      
      // שליחת אירוע
      this.emit('timerChanged', { taskId, timerData: data });
      this.checkActiveTimers();
      
      return true;
    } catch (err) {
      console.error('❌ שגיאה בשמירת טיימר:', err);
      return false;
    }
  }
  
  /**
   * קריאת טיימר
   */
  getTimer(taskId) {
    if (!taskId) return null;
    
    // בדיקה ב-cache
    if (this.activeTimers.has(taskId)) {
      return this.activeTimers.get(taskId);
    }
    
    // קריאה מ-localStorage
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${taskId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
        const data = JSON.parse(saved);
        
        // עדכון cache אם פעיל
        if (this.isTimerActive(data)) {
          this.activeTimers.set(taskId, data);
        }
        
        return data;
      }
    } catch (e) {
      // התעלם משגיאות
    }
    
    return null;
  }
  
  /**
   * מחיקת טיימר
   */
  removeTimer(taskId) {
    if (!taskId) return false;
    
    try {
      const key = `${this.STORAGE_KEY_PREFIX}${taskId}`;
      localStorage.removeItem(key);
      
      // הסרה מ-cache
      this.activeTimers.delete(taskId);
      
      // אם זה היה הטיימר הפעיל - נקה את המפתח
      const activeTimerId = localStorage.getItem(this.ACTIVE_TIMER_KEY);
      if (activeTimerId === taskId) {
        localStorage.removeItem(this.ACTIVE_TIMER_KEY);
      }
      
      // שליחת אירוע
      this.emit('timerRemoved', { taskId });
      this.checkActiveTimers();
      
      return true;
    } catch (err) {
      console.error('❌ שגיאה במחיקת טיימר:', err);
      return false;
    }
  }
  
  /**
   * קבלת כל הטיימרים הפעילים
   */
  getActiveTimers() {
    return Object.fromEntries(this.activeTimers);
  }
  
  /**
   * קבלת הטיימר הפעיל (רץ)
   */
  getActiveTimer() {
    const activeTaskId = localStorage.getItem(this.ACTIVE_TIMER_KEY);
    if (!activeTaskId) return null;
    
    return this.getTimer(activeTaskId);
  }
  
  /**
   * בדיקה אם יש טיימר פעיל על משימה מסוימת
   */
  isTaskTimerActive(taskId) {
    if (!taskId) return false;
    
    const timer = this.getTimer(taskId);
    return this.isTimerActive(timer);
  }
  
  /**
   * בדיקה אם יש טיימר רץ (לא מושהה/מופרע) על משימה מסוימת
   */
  isTaskTimerRunning(taskId) {
    if (!taskId) return false;
    
    const timer = this.getTimer(taskId);
    if (!timer) return false;
    
    return timer.isRunning === true && !timer.isPaused && !timer.isInterrupted;
  }
  
  /**
   * קבלת ID של המשימה עם טיימר פעיל
   */
  getActiveTaskId() {
    return localStorage.getItem(this.ACTIVE_TIMER_KEY);
  }
  
  /**
   * התקנת האזנה לשינויים ב-localStorage (סינכרון בין טאבים)
   */
  setupStorageListener() {
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith(this.STORAGE_KEY_PREFIX) || e.key === this.ACTIVE_TIMER_KEY) {
        // עדכון cache
        this.checkActiveTimers();
      }
    });
  }
  
  /**
   * ניקוי כל הטיימרים
   */
  clearAll() {
    // מחיקת כל המפתחות
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(this.ACTIVE_TIMER_KEY);
    
    // ניקוי cache
    this.activeTimers.clear();
    
    // שליחת אירוע
    this.emit('timersCleared');
  }
}

// Singleton instance
export const timerService = new TimerService();

export default timerService;

