/**
 * ניהול סדר משימות - שמירה וטעינה
 * נשמר ב-localStorage לפי תאריך
 */

const ORDER_KEY_PREFIX = 'zmanit_task_order_';

/**
 * קבלת מפתח לפי תאריך
 */
function getOrderKey(dateISO) {
  return `${ORDER_KEY_PREFIX}${dateISO}`;
}

/**
 * טעינת סדר משימות ליום מסוים
 * @returns {string[]} מערך של task IDs בסדר הנכון
 */
export function loadTaskOrder(dateISO) {
  try {
    const key = getOrderKey(dateISO);
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('שגיאה בטעינת סדר משימות:', e);
  }
  return [];
}

/**
 * שמירת סדר משימות ליום מסוים
 * @param {string} dateISO - תאריך בפורמט ISO
 * @param {string[]} orderArray - מערך של task IDs
 */
export function saveTaskOrder(dateISO, orderArray) {
  try {
    const key = getOrderKey(dateISO);
    localStorage.setItem(key, JSON.stringify(orderArray));
  } catch (e) {
    console.error('שגיאה בשמירת סדר משימות:', e);
  }
}

/**
 * מיון משימות לפי סדר שמור
 * @param {Array} tasks - מערך משימות
 * @param {string} dateISO - תאריך
 * @returns {Array} משימות ממוינות
 */
export function sortTasksByOrder(tasks, dateISO) {
  const savedOrder = loadTaskOrder(dateISO);
  
  if (savedOrder.length === 0) {
    // אם אין סדר שמור, מיון לפי עדיפות ואז שעה
    return [...tasks].sort((a, b) => {
      // דחופים קודם
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // לפי שעה
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      if (b.due_time) return 1;
      
      return 0;
    });
  }
  
  // מיון לפי הסדר השמור
  const orderMap = new Map(savedOrder.map((id, index) => [id, index]));
  
  return [...tasks].sort((a, b) => {
    const aIndex = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
    const bIndex = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
    return aIndex - bIndex;
  });
}

/**
 * החלפת מיקום בין שתי משימות
 * @param {string} dateISO - תאריך
 * @param {string[]} currentOrder - הסדר הנוכחי
 * @param {number} fromIndex - מיקום מקור
 * @param {number} toIndex - מיקום יעד
 * @returns {string[]} הסדר החדש
 */
export function reorderTasks(dateISO, currentOrder, fromIndex, toIndex) {
  const newOrder = [...currentOrder];
  const [movedItem] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, movedItem);
  
  saveTaskOrder(dateISO, newOrder);
  return newOrder;
}

/**
 * ניקוי סדרים ישנים (מעל 30 יום)
 */
export function cleanOldOrders() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const keys = Object.keys(localStorage).filter(k => k.startsWith(ORDER_KEY_PREFIX));
    
    keys.forEach(key => {
      const dateStr = key.replace(ORDER_KEY_PREFIX, '');
      const date = new Date(dateStr);
      if (date < thirtyDaysAgo) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // התעלם משגיאות
  }
}

// ניקוי אוטומטי
cleanOldOrders();

export default {
  loadTaskOrder,
  saveTaskOrder,
  sortTasksByOrder,
  reorderTasks
};
