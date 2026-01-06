/**
 * מערכת התראות חכמה משופרת - גרסה 2
 * =====================================
 * 
 * 🆕 שיפורים:
 * 1. מודעות למצב המשימה (התחילה, בתהליך, הסתיימה)
 * 2. התראות מעבר בין משימות
 * 3. פופאפ שדורש תגובה
 * 4. זיהוי "עיגול פינות" (procrastination)
 * 5. תזכורות להפסקות
 */

// ============================================
// סוגי התראות
// ============================================

export const ALERT_TYPES = {
  TASK_STARTING_SOON: 'task_starting_soon',      // משימה מתחילה בקרוב
  TASK_STARTED: 'task_started',                   // משימה התחילה
  TASK_ENDING_SOON: 'task_ending_soon',           // משימה מסתיימת בקרוב
  TASK_OVERTIME: 'task_overtime',                 // משימה עברה את הזמן
  TRANSITION_NEEDED: 'transition_needed',         // צריך לעבור למשימה הבאה
  TASK_OVERDUE: 'task_overdue',                   // משימה באיחור (לא התחילה)
  IDLE_DETECTED: 'idle_detected',                 // זוהה חוסר פעילות
  BREAK_REMINDER: 'break_reminder',               // תזכורת להפסקה
  DAILY_SUMMARY: 'daily_summary',                 // סיכום יומי
  PROCRASTINATION_WARNING: 'procrastination'      // אזהרת עיגול פינות
};

export const ALERT_PRIORITY = {
  CRITICAL: 'critical',   // דורש תגובה מיידית - פופאפ חוסם
  HIGH: 'high',           // חשוב - פופאפ רגיל
  MEDIUM: 'medium',       // בינוני - הודעה בפינה
  LOW: 'low'              // נמוך - רק בלוג
};

// ============================================
// מצבי משימה
// ============================================

export const TASK_STATES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  OVERDUE: 'overdue'
};

// ============================================
// מחלקת מנהל התראות
// ============================================

export class SmartAlertManager {
  constructor() {
    this.activeTaskId = null;
    this.taskStartTime = null;
    this.lastActivityTime = Date.now();
    this.idleThreshold = 5 * 60 * 1000;  // 5 דקות ללא פעילות
    this.alertHistory = [];
    this.callbacks = {
      onAlert: null,
      onPopup: null,
      onTransition: null
    };
    
    // מעקב אחר עבודה רציפה
    this.continuousWorkStart = null;
    this.breakRemindersEnabled = true;
    this.breakInterval = 90 * 60 * 1000;  // 90 דקות
    
    // מעקב אחר עיגול פינות
    this.taskSwitchCount = 0;
    this.lastTaskSwitch = null;
    this.procrastinationThreshold = 5;  // 5 החלפות ב-30 דקות = עיגול פינות
  }
  
  // ============================================
  // אתחול
  // ============================================
  
  init(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    
    // התחלת מעקב
    this.startMonitoring();
    
    // בקשת הרשאה להתראות
    if ('Notification' in window) {
      Notification.requestPermission();
    }
    
    return this;
  }
  
  startMonitoring() {
    // מעקב כל דקה
    this.monitorInterval = setInterval(() => {
      this.checkAndNotify();
    }, 60 * 1000);
    
    // מעקב אחר פעילות
    this.trackActivity();
  }
  
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }
  
  trackActivity() {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const updateActivity = () => {
      this.lastActivityTime = Date.now();
    };
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
  }
  
  // ============================================
  // בדיקות והתראות
  // ============================================
  
  checkAndNotify() {
    const now = Date.now();
    const alerts = [];
    
    // בדיקת חוסר פעילות
    if (this.activeTaskId && now - this.lastActivityTime > this.idleThreshold) {
      alerts.push(this.createIdleAlert());
    }
    
    // בדיקת תזכורת להפסקה
    if (this.breakRemindersEnabled && this.continuousWorkStart) {
      const workDuration = now - this.continuousWorkStart;
      if (workDuration > this.breakInterval) {
        alerts.push(this.createBreakReminder(workDuration));
      }
    }
    
    // בדיקת עיגול פינות
    if (this.checkProcrastination()) {
      alerts.push(this.createProcrastinationAlert());
    }
    
    // שליחת התראות
    alerts.forEach(alert => this.dispatchAlert(alert));
  }
  
  // ============================================
  // בדיקת משימות מתוזמנות
  // ============================================
  
  checkScheduledTasks(tasks, scheduledBlocks) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayISO = toLocalISODate(now);
    const alerts = [];
    
    // סינון בלוקים של היום
    const todayBlocks = scheduledBlocks.filter(b => b.dayDate === todayISO && !b.isCompleted);
    
    for (const block of todayBlocks) {
      const timeDiff = block.startMinute - currentMinutes;
      
      // משימה מתחילה בעוד 5 דקות
      if (timeDiff > 0 && timeDiff <= 5 && !this.wasAlertSent(block.taskId, ALERT_TYPES.TASK_STARTING_SOON)) {
        alerts.push(this.createTaskStartingSoonAlert(block));
      }
      
      // משימה הייתה צריכה להתחיל אבל לא התחילה
      if (timeDiff < 0 && timeDiff >= -15 && this.activeTaskId !== block.taskId) {
        if (!this.wasAlertSent(block.taskId, ALERT_TYPES.TASK_OVERDUE)) {
          alerts.push(this.createTaskOverdueAlert(block));
        }
      }
      
      // משימה צריכה להסתיים - צריך לעבור למשימה הבאה
      if (this.activeTaskId === block.taskId) {
        const timeToEnd = block.endMinute - currentMinutes;
        
        // 5 דקות לסיום
        if (timeToEnd > 0 && timeToEnd <= 5) {
          if (!this.wasAlertSent(block.taskId, ALERT_TYPES.TASK_ENDING_SOON)) {
            alerts.push(this.createTaskEndingSoonAlert(block));
          }
        }
        
        // עברנו את הזמן
        if (timeToEnd < 0) {
          const nextBlock = this.findNextBlock(todayBlocks, block.endMinute);
          alerts.push(this.createTransitionAlert(block, nextBlock));
        }
      }
    }
    
    // שליחת התראות
    alerts.forEach(alert => this.dispatchAlert(alert));
    
    return alerts;
  }
  
  // ============================================
  // יצירת התראות
  // ============================================
  
  createTaskStartingSoonAlert(block) {
    return {
      id: `${block.taskId}-${ALERT_TYPES.TASK_STARTING_SOON}-${Date.now()}`,
      type: ALERT_TYPES.TASK_STARTING_SOON,
      priority: ALERT_PRIORITY.HIGH,
      taskId: block.taskId,
      title: '⏰ משימה מתחילה בקרוב',
      message: `"${block.title}" מתחילה בעוד 5 דקות`,
      time: block.startTime,
      requiresResponse: false,
      showPopup: true,
      sound: true,
      actions: [
        { id: 'start_now', label: '▶ התחל עכשיו', primary: true },
        { id: 'snooze_5', label: '⏱ עוד 5 דקות' }
      ]
    };
  }
  
  createTaskOverdueAlert(block) {
    return {
      id: `${block.taskId}-${ALERT_TYPES.TASK_OVERDUE}-${Date.now()}`,
      type: ALERT_TYPES.TASK_OVERDUE,
      priority: ALERT_PRIORITY.CRITICAL,
      taskId: block.taskId,
      title: '🔴 משימה באיחור!',
      message: `"${block.title}" הייתה צריכה להתחיל ב-${block.startTime}`,
      requiresResponse: true,
      showPopup: true,
      blockingPopup: true,  // פופאפ חוסם!
      sound: true,
      vibrate: true,
      actions: [
        { id: 'start_now', label: '▶ התחל עכשיו', primary: true },
        { id: 'reschedule', label: '📅 דחה לאחר כך' },
        { id: 'skip', label: '⏭ דלג' }
      ]
    };
  }
  
  createTaskEndingSoonAlert(block) {
    return {
      id: `${block.taskId}-${ALERT_TYPES.TASK_ENDING_SOON}-${Date.now()}`,
      type: ALERT_TYPES.TASK_ENDING_SOON,
      priority: ALERT_PRIORITY.MEDIUM,
      taskId: block.taskId,
      title: '⏱ משימה מסתיימת בקרוב',
      message: `"${block.title}" צריכה להסתיים בעוד 5 דקות`,
      requiresResponse: false,
      showPopup: true,
      actions: [
        { id: 'complete', label: '✅ סיים', primary: true },
        { id: 'extend_15', label: '⏱ עוד 15 דקות' }
      ]
    };
  }
  
  createTransitionAlert(currentBlock, nextBlock) {
    const message = nextBlock 
      ? `הגיע הזמן לעבור מ"${currentBlock.title}" ל"${nextBlock.title}"`
      : `"${currentBlock.title}" הסתיימה - מה עכשיו?`;
    
    return {
      id: `transition-${currentBlock.taskId}-${Date.now()}`,
      type: ALERT_TYPES.TRANSITION_NEEDED,
      priority: ALERT_PRIORITY.CRITICAL,
      taskId: currentBlock.taskId,
      nextTaskId: nextBlock?.taskId,
      title: '🔄 הגיע הזמן להחליף משימה',
      message,
      requiresResponse: true,
      showPopup: true,
      blockingPopup: true,  // פופאפ חוסם!
      sound: true,
      vibrate: true,
      actions: nextBlock ? [
        { id: 'transition', label: `▶ התחל "${nextBlock.title}"`, primary: true },
        { id: 'extend_15', label: '⏱ עוד 15 דקות' },
        { id: 'complete_current', label: '✅ סיים והמשך' }
      ] : [
        { id: 'complete', label: '✅ סיים משימה', primary: true },
        { id: 'break', label: '☕ קח הפסקה' }
      ]
    };
  }
  
  createIdleAlert() {
    return {
      id: `idle-${Date.now()}`,
      type: ALERT_TYPES.IDLE_DETECTED,
      priority: ALERT_PRIORITY.HIGH,
      title: '😴 נראה שיש הפסקה...',
      message: this.activeTaskId 
        ? 'זיהינו חוסר פעילות. האם את עדיין עובדת על המשימה?'
        : 'מה עושים עכשיו?',
      requiresResponse: true,
      showPopup: true,
      actions: [
        { id: 'continue', label: '▶ ממשיכה לעבוד', primary: true },
        { id: 'pause', label: '⏸ בהפסקה' },
        { id: 'complete', label: '✅ סיימתי' }
      ]
    };
  }
  
  createBreakReminder(workDuration) {
    const hours = Math.floor(workDuration / (60 * 60 * 1000));
    const minutes = Math.floor((workDuration % (60 * 60 * 1000)) / (60 * 1000));
    
    return {
      id: `break-${Date.now()}`,
      type: ALERT_TYPES.BREAK_REMINDER,
      priority: ALERT_PRIORITY.MEDIUM,
      title: '☕ הגיע הזמן להפסקה!',
      message: `עבדת ${hours > 0 ? `${hours} שעות ו-` : ''}${minutes} דקות ברציפות. הגיע הזמן לנשום.`,
      requiresResponse: false,
      showPopup: true,
      actions: [
        { id: 'take_break', label: '☕ לוקחת הפסקה', primary: true },
        { id: 'snooze_15', label: '⏱ עוד 15 דקות' },
        { id: 'dismiss', label: '👍 בסדר' }
      ]
    };
  }
  
  createProcrastinationAlert() {
    return {
      id: `procrastination-${Date.now()}`,
      type: ALERT_TYPES.PROCRASTINATION_WARNING,
      priority: ALERT_PRIORITY.HIGH,
      title: '🎯 נראה שיש קצת עיגול פינות...',
      message: `החלפת משימות ${this.taskSwitchCount} פעמים ב-30 הדקות האחרונות. בואי נתמקד!`,
      requiresResponse: true,
      showPopup: true,
      actions: [
        { id: 'focus_mode', label: '🎯 מצב ריכוז', primary: true },
        { id: 'choose_task', label: '📋 בחרי משימה אחת' },
        { id: 'dismiss', label: '👍 הבנתי' }
      ]
    };
  }
  
  // ============================================
  // ניהול מצב משימה
  // ============================================
  
  startTask(taskId, taskTitle) {
    // בדיקת עיגול פינות
    if (this.activeTaskId && this.activeTaskId !== taskId) {
      this.recordTaskSwitch();
    }
    
    this.activeTaskId = taskId;
    this.taskStartTime = Date.now();
    
    // התחלת מעקב עבודה רציפה
    if (!this.continuousWorkStart) {
      this.continuousWorkStart = Date.now();
    }
    
    this.dispatchAlert({
      id: `started-${taskId}-${Date.now()}`,
      type: ALERT_TYPES.TASK_STARTED,
      priority: ALERT_PRIORITY.LOW,
      taskId,
      title: '▶ משימה התחילה',
      message: `התחלת לעבוד על "${taskTitle}"`,
      showPopup: false
    });
  }
  
  pauseTask(taskId) {
    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
      this.taskStartTime = null;
      this.continuousWorkStart = null;
    }
  }
  
  completeTask(taskId) {
    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
      this.taskStartTime = null;
    }
  }
  
  takeBreak() {
    this.pauseTask(this.activeTaskId);
    this.continuousWorkStart = null;
  }
  
  // ============================================
  // בדיקת עיגול פינות
  // ============================================
  
  recordTaskSwitch() {
    const now = Date.now();
    
    // איפוס אם עבר יותר מ-30 דקות
    if (this.lastTaskSwitch && now - this.lastTaskSwitch > 30 * 60 * 1000) {
      this.taskSwitchCount = 0;
    }
    
    this.taskSwitchCount++;
    this.lastTaskSwitch = now;
  }
  
  checkProcrastination() {
    if (!this.lastTaskSwitch) return false;
    
    const now = Date.now();
    const timeSinceFirstSwitch = now - this.lastTaskSwitch;
    
    // אם יותר מ-5 החלפות ב-30 דקות = עיגול פינות
    return this.taskSwitchCount >= this.procrastinationThreshold && 
           timeSinceFirstSwitch <= 30 * 60 * 1000;
  }
  
  // ============================================
  // שליחת התראות
  // ============================================
  
  dispatchAlert(alert) {
    // שמירה בהיסטוריה
    this.alertHistory.push({
      ...alert,
      timestamp: Date.now()
    });
    
    // קריאה לקולבק
    if (this.callbacks.onAlert) {
      this.callbacks.onAlert(alert);
    }
    
    // פופאפ
    if (alert.showPopup && this.callbacks.onPopup) {
      this.callbacks.onPopup(alert);
    }
    
    // התראת מערכת
    if (alert.priority === ALERT_PRIORITY.CRITICAL || alert.priority === ALERT_PRIORITY.HIGH) {
      this.sendSystemNotification(alert);
    }
  }
  
  sendSystemNotification(alert) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(alert.title, {
        body: alert.message,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: alert.id,
        requireInteraction: alert.requiresResponse,
        vibrate: alert.vibrate ? [200, 100, 200] : undefined,
        dir: 'rtl',
        lang: 'he'
      });
      
      notification.onclick = () => {
        window.focus();
        if (this.callbacks.onPopup) {
          this.callbacks.onPopup(alert);
        }
      };
    }
  }
  
  // ============================================
  // עזר
  // ============================================
  
  wasAlertSent(taskId, alertType) {
    const recentCutoff = Date.now() - 15 * 60 * 1000;  // 15 דקות
    return this.alertHistory.some(a => 
      a.taskId === taskId && 
      a.type === alertType && 
      a.timestamp > recentCutoff
    );
  }
  
  findNextBlock(blocks, afterMinute) {
    return blocks
      .filter(b => b.startMinute > afterMinute && !b.isCompleted)
      .sort((a, b) => a.startMinute - b.startMinute)[0];
  }
  
  clearHistory() {
    this.alertHistory = [];
    this.taskSwitchCount = 0;
    this.lastTaskSwitch = null;
  }
}

// ============================================
// פונקציות עזר
// ============================================

function toLocalISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================
// Singleton instance
// ============================================

export const alertManager = new SmartAlertManager();

export default alertManager;
