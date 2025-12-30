/**
 * מערכת גרירה ושחרור למשימות
 * ============================
 * 
 * תומך ב:
 * 1. שינוי סדר משימות בתוך יום
 * 2. העברת משימות בין ימים
 * 3. שמירת הסדר הידני
 */

const STORAGE_KEY = 'zmanit_task_order';

/**
 * מבנה הנתונים:
 * {
 *   "2024-12-30": ["task-id-1", "task-id-2", "task-id-3"],
 *   "2024-12-31": ["task-id-4", "task-id-5"],
 *   ...
 * }
 */

/**
 * טעינת סדר משימות מ-localStorage
 */
export function loadTaskOrder() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('❌ שגיאה בטעינת סדר משימות:', e);
  }
  return {};
}

/**
 * שמירת סדר משימות
 */
function saveTaskOrder(order) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    console.error('❌ שגיאה בשמירת סדר משימות:', e);
  }
}

/**
 * עדכון סדר משימות ליום מסוים
 * 
 * @param {string} date - תאריך בפורמט YYYY-MM-DD
 * @param {string[]} taskIds - רשימת מזהי משימות בסדר הרצוי
 */
export function setDayTaskOrder(date, taskIds) {
  const order = loadTaskOrder();
  order[date] = taskIds;
  saveTaskOrder(order);
  console.log(`📋 סדר משימות עודכן ל-${date}:`, taskIds.length, 'משימות');
}

/**
 * קבלת סדר משימות ליום מסוים
 * 
 * @param {string} date - תאריך בפורמט YYYY-MM-DD
 * @returns {string[]} רשימת מזהי משימות
 */
export function getDayTaskOrder(date) {
  const order = loadTaskOrder();
  return order[date] || [];
}

/**
 * מיון משימות לפי סדר שמור
 * 
 * @param {Array} tasks - רשימת משימות
 * @param {string} date - תאריך
 * @returns {Array} משימות ממוינות
 */
export function sortTasksByOrder(tasks, date) {
  const order = getDayTaskOrder(date);
  
  if (order.length === 0) {
    // אין סדר שמור - מחזירים כמו שהגיע
    return tasks;
  }
  
  // מיון לפי הסדר השמור
  const sorted = [...tasks].sort((a, b) => {
    const aIndex = order.indexOf(a.id || a.taskId);
    const bIndex = order.indexOf(b.id || b.taskId);
    
    // אם שניהם בסדר השמור
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // אם רק אחד בסדר השמור - הוא קודם
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // שניהם לא בסדר - לפי ברירת מחדל
    return 0;
  });
  
  return sorted;
}

/**
 * העברת משימה למיקום חדש (בתוך אותו יום)
 * 
 * @param {string} date - תאריך
 * @param {string} taskId - מזהה המשימה
 * @param {number} fromIndex - מיקום נוכחי
 * @param {number} toIndex - מיקום חדש
 */
export function reorderTask(date, taskId, fromIndex, toIndex) {
  const order = getDayTaskOrder(date);
  
  // אם אין סדר - צריך ליצור
  if (order.length === 0) {
    console.log('⚠️ אין סדר שמור - צריך לקבל רשימת משימות מלאה');
    return;
  }
  
  // הסרה מהמיקום הישן
  order.splice(fromIndex, 1);
  // הוספה למיקום החדש
  order.splice(toIndex, 0, taskId);
  
  setDayTaskOrder(date, order);
}

/**
 * העברת משימה ליום אחר
 * 
 * @param {string} taskId - מזהה המשימה
 * @param {string} fromDate - תאריך מקור
 * @param {string} toDate - תאריך יעד
 * @param {number} toIndex - מיקום ביום היעד (אופציונלי, ברירת מחדל: סוף)
 */
export function moveTaskToDay(taskId, fromDate, toDate, toIndex = -1) {
  // הסרה מיום המקור
  const fromOrder = getDayTaskOrder(fromDate);
  const fromIdx = fromOrder.indexOf(taskId);
  if (fromIdx !== -1) {
    fromOrder.splice(fromIdx, 1);
    setDayTaskOrder(fromDate, fromOrder);
  }
  
  // הוספה ליום היעד
  const toOrder = getDayTaskOrder(toDate);
  if (toIndex === -1 || toIndex >= toOrder.length) {
    toOrder.push(taskId);
  } else {
    toOrder.splice(toIndex, 0, taskId);
  }
  setDayTaskOrder(toDate, toOrder);
  
  console.log(`📦 משימה ${taskId} הועברה מ-${fromDate} ל-${toDate}`);
}

/**
 * אתחול סדר משימות ליום (כשאין סדר שמור)
 * 
 * @param {string} date - תאריך
 * @param {Array} tasks - רשימת משימות
 */
export function initializeDayOrder(date, tasks) {
  const order = getDayTaskOrder(date);
  
  // אם כבר יש סדר - לא דורסים
  if (order.length > 0) {
    return order;
  }
  
  // יצירת סדר לפי המשימות שהתקבלו
  const taskIds = tasks.map(t => t.id || t.taskId).filter(Boolean);
  setDayTaskOrder(date, taskIds);
  return taskIds;
}

/**
 * ניקוי סדרים ישנים (מעל שבוע)
 */
export function cleanupOldOrders() {
  const order = loadTaskOrder();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoISO = weekAgo.toISOString().split('T')[0];
  
  let cleaned = 0;
  for (const date of Object.keys(order)) {
    if (date < weekAgoISO) {
      delete order[date];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    saveTaskOrder(order);
    console.log(`🧹 נוקו ${cleaned} סדרים ישנים`);
  }
}

/**
 * Hook state לניהול גרירה
 */
export function createDragState() {
  return {
    draggedItem: null,
    draggedFrom: null,
    dragOverIndex: null,
    dragOverDay: null
  };
}

export default {
  loadTaskOrder,
  setDayTaskOrder,
  getDayTaskOrder,
  sortTasksByOrder,
  reorderTask,
  moveTaskToDay,
  initializeDayOrder,
  cleanupOldOrders,
  createDragState
};
