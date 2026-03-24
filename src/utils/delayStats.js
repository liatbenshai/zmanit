/**
 * סטטיסטיקות איחורים ולמידה
 * ============================
 * 
 * פונקציות לניתוח דפוסי איחור ולמידה
 * מידע זה משמש ליצירת תובנות ולשיפור התזמון
 */

const DELAY_REASONS_KEY = 'zmanit_delay_reasons';

/**
 * חישוב זמן בלת"מים ממוצע (לומד מההיסטוריה)
 * @returns {number} דקות ממוצעות ליום של בלת"מים
 */
export function getAverageBufferTime() {
  try {
    const data = JSON.parse(localStorage.getItem(DELAY_REASONS_KEY) || '[]');
    const bufferReasons = data.filter(d => d.isBuffer);
    
    if (bufferReasons.length < 5) {
      return 30; // ברירת מחדל: 30 דקות ביום
    }
    
    // חישוב ממוצע לפי יום
    const byDate = {};
    bufferReasons.forEach(d => {
      if (!byDate[d.date]) byDate[d.date] = 0;
      byDate[d.date] += d.delayMinutes || 10;
    });
    
    const dailyAverages = Object.values(byDate);
    const avgPerDay = dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length;
    
    return Math.round(avgPerDay);
  } catch (e) {
    return 30;
  }
}

/**
 * סטטיסטיקות איחורים ב-30 ימים אחרונים
 * @returns {object|null} אובייקט עם סטטיסטיקות או null אם אין נתונים
 */
export function getDelayStats() {
  try {
    const data = JSON.parse(localStorage.getItem(DELAY_REASONS_KEY) || '[]');
    if (data.length === 0) return null;
    
    const last30Days = data.filter(d => {
      const date = new Date(d.timestamp);
      const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    });
    
    const reasons = {};
    last30Days.forEach(d => {
      reasons[d.reason] = (reasons[d.reason] || 0) + 1;
    });
    
    return {
      total: last30Days.length,
      reasons,
      mostCommon: Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0],
      bufferTotal: last30Days.filter(d => d.isBuffer).reduce((sum, d) => sum + (d.delayMinutes || 0), 0),
      avgBufferPerDay: getAverageBufferTime()
    };
  } catch (e) {
    return null;
  }
}

/**
 * שמירת סיבת איחור ללמידה
 * @param {string} taskId - מזהה המשימה
 * @param {string} reasonId - מזהה הסיבה
 * @param {number} delayMinutes - כמה דקות איחור
 * @param {boolean} isBuffer - האם זה בלת"ם
 */
export function saveDelayReason(taskId, reasonId, delayMinutes, isBuffer = false) {
  try {
    const data = JSON.parse(localStorage.getItem(DELAY_REASONS_KEY) || '[]');
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    data.push({
      taskId,
      reason: reasonId,
      isBuffer,
      delayMinutes,
      timestamp: new Date().toISOString(),
      date: dateStr
    });
    
    // שומרים רק 200 אחרונים
    if (data.length > 200) data.shift();
    localStorage.setItem(DELAY_REASONS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('שגיאה בשמירת סיבת איחור:', e);
  }
}

/**
 * ניקוי היסטוריית איחורים
 */
export function clearDelayHistory() {
  localStorage.removeItem(DELAY_REASONS_KEY);
}

export default {
  getAverageBufferTime,
  getDelayStats,
  saveDelayReason,
  clearDelayHistory
};
