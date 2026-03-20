/**
 * פונקציות עזר אחידות לחישוב והצגת זמנים
 * ============================================
 * 
 * כל העמודים ישתמשו בפונקציות האלה במקום לחשב בעצמם
 * זה מבטיח אחידות בכל המערכת
 */

/**
 * קבלת זמן שבוצע על משימה (כולל session נוכחית)
 * 
 * @param {Object} task - המשימה
 * @param {number} elapsedSeconds - שניות שעברו ב-session הנוכחי (אופציונלי)
 * @returns {number} - זמן שבוצע בדקות
 */
export function getTimeSpent(task, elapsedSeconds = 0) {
  if (!task) return 0;
  
  // זמן שבוצע מהדאטאבייס
  const timeSpent = task.time_spent ? parseInt(task.time_spent) : 0;
  
  // זמן מה-session הנוכחי
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  
  return timeSpent + currentSessionMinutes;
}

/**
 * קבלת זמן שנותר למשימה
 * 
 * @param {Object} task - המשימה
 * @param {number} elapsedSeconds - שניות שעברו ב-session הנוכחי (אופציונלי)
 * @returns {number} - זמן שנותר בדקות
 */
export function getRemainingTime(task, elapsedSeconds = 0) {
  if (!task) return 0;
  
  const estimated = task.estimated_duration ? parseInt(task.estimated_duration) : 0;
  const totalSpent = getTimeSpent(task, elapsedSeconds);
  
  return Math.max(0, estimated - totalSpent);
}

/**
 * קבלת סה"כ זמן שבוצע (כולל session נוכחית)
 * 
 * @param {Object} task - המשימה
 * @param {number} elapsedSeconds - שניות שעברו ב-session הנוכחי (אופציונלי)
 * @returns {number} - סה"כ זמן שבוצע בדקות
 */
export function getTotalSpent(task, elapsedSeconds = 0) {
  return getTimeSpent(task, elapsedSeconds);
}

/**
 * בדיקה אם המשימה עברה את הזמן המשוער
 * 
 * @param {Object} task - המשימה
 * @param {number} elapsedSeconds - שניות שעברו ב-session הנוכחי (אופציונלי)
 * @returns {boolean} - true אם עברה את הזמן
 */
export function isOverTime(task, elapsedSeconds = 0) {
  if (!task) return false;
  
  const estimated = task.estimated_duration ? parseInt(task.estimated_duration) : 0;
  if (estimated <= 0) return false;
  
  const totalSpent = getTimeSpent(task, elapsedSeconds);
  return totalSpent > estimated;
}

/**
 * חישוב אחוז התקדמות
 * 
 * @param {Object} task - המשימה
 * @param {number} elapsedSeconds - שניות שעברו ב-session הנוכחי (אופציונלי)
 * @returns {number} - אחוז התקדמות (0-100)
 */
export function getProgress(task, elapsedSeconds = 0) {
  if (!task) return 0;
  
  const estimated = task.estimated_duration ? parseInt(task.estimated_duration) : 0;
  if (estimated <= 0) return 0;
  
  const totalSpent = getTimeSpent(task, elapsedSeconds);
  return Math.min(100, Math.round((totalSpent / estimated) * 100));
}

/**
 * פורמט זמן לדקות ושעות
 * 
 * @param {number} minutes - זמן בדקות
 * @returns {string} - פורמט "X שעות Y דקות" או "Y דקות"
 */
export function formatTimeMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דקות';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} דקות`;
  }
  
  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  }
  
  return `${hours} ${hours === 1 ? 'שעה' : 'שעות'} ${mins} דקות`;
}

/**
 * פורמט זמן לשניות
 * 
 * @param {number} seconds - זמן בשניות
 * @returns {string} - פורמט "HH:MM:SS"
 */
export function formatTimeSeconds(seconds) {
  if (!seconds || seconds < 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * פורמט זמן קצר לדקות
 * 
 * @param {number} seconds - זמן בשניות
 * @returns {string} - פורמט "MM:SS"
 */
export function formatTimeShort(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * חישוב זמן שנותר עד deadline
 * 
 * @param {string} dueDate - תאריך יעד (YYYY-MM-DD)
 * @param {string} dueTime - שעה יעד (HH:MM)
 * @returns {number} - זמן שנותר בדקות (שלילי אם עבר)
 */
export function getMinutesUntilDeadline(dueDate, dueTime) {
  if (!dueDate) return null;
  
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // יצירת תאריך deadline
    const [year, month, day] = dueDate.split('-').map(Number);
    const deadlineDate = new Date(year, month - 1, day);
    
    // הוספת שעה אם יש
    if (dueTime) {
      const [hours, minutes] = dueTime.split(':').map(Number);
      deadlineDate.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      deadlineDate.setHours(23, 59, 59, 999); // סוף היום אם אין שעה
    }
    
    // חישוב הפרש בדקות
    const diffMs = deadlineDate - now;
    return Math.floor(diffMs / (1000 * 60));
  } catch (err) {
    console.error('❌ שגיאה בחישוב זמן עד deadline:', err);
    return null;
  }
}

/**
 * בדיקה אם deadline עבר
 * 
 * @param {string} dueDate - תאריך יעד
 * @param {string} dueTime - שעה יעד
 * @returns {boolean} - true אם עבר
 */
export function isDeadlinePassed(dueDate, dueTime) {
  const minutesUntil = getMinutesUntilDeadline(dueDate, dueTime);
  return minutesUntil !== null && minutesUntil < 0;
}

export default {
  getTimeSpent,
  getRemainingTime,
  getTotalSpent,
  isOverTime,
  getProgress,
  formatTimeMinutes,
  formatTimeSeconds,
  formatTimeShort,
  getMinutesUntilDeadline,
  isDeadlinePassed
};

