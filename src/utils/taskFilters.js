/**
 * פילטרים אחידים למשימות
 * ========================
 * פונקציות סינון משותפות לכל התצוגות
 */

/**
 * קבלת תאריך היום בפורמט ISO
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * סינון משימות של יום ספציפי
 * @param {Array} tasks - כל המשימות
 * @param {string} dateISO - תאריך בפורמט YYYY-MM-DD
 * @param {boolean} includeNoDate - האם לכלול משימות ללא תאריך (ברירת מחדל: לא)
 */
export function getTasksForDate(tasks, dateISO, includeNoDate = false) {
  if (!tasks || !Array.isArray(tasks)) return [];
  
  return tasks.filter(task => {
    if (task.is_completed) return false;
    if (task.deleted_at) return false;
    
    // משימה עם תאריך מוגדר
    if (task.due_date === dateISO) return true;
    
    // משימה ללא תאריך - רק אם מבקשים
    if (includeNoDate && !task.due_date && !task.start_date) return true;
    
    return false;
  });
}

/**
 * סינון משימות של היום
 */
export function getTodayTasks(tasks, includeNoDate = false) {
  return getTasksForDate(tasks, getTodayISO(), includeNoDate);
}

/**
 * מיון משימות לפי שעה
 */
export function sortTasksByTime(tasks) {
  return [...tasks].sort((a, b) => {
    // משימות עם שעה קודמות
    if (a.due_time && b.due_time) {
      return a.due_time.localeCompare(b.due_time);
    }
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    
    // לפי עדיפות
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // לפי משך (קצרות קודם)
    return (a.estimated_duration || 30) - (b.estimated_duration || 30);
  });
}

/**
 * קבלת משימות להיום, ממוינות
 */
export function getSortedTodayTasks(tasks, includeNoDate = false) {
  const todayTasks = getTodayTasks(tasks, includeNoDate);
  return sortTasksByTime(todayTasks);
}

/**
 * קבלת משימות לשבוע
 */
export function getWeekTasks(tasks, weekStart) {
  if (!tasks || !Array.isArray(tasks)) return [];
  
  const weekStartDate = new Date(weekStart);
  weekStartDate.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const weekStartISO = weekStartDate.toISOString().split('T')[0];
  const weekEndISO = weekEnd.toISOString().split('T')[0];
  
  return tasks.filter(task => {
    if (task.is_completed) return false;
    if (task.deleted_at) return false;
    
    if (task.due_date) {
      return task.due_date >= weekStartISO && task.due_date <= weekEndISO;
    }
    
    return false;
  });
}

/**
 * חישוב סטטיסטיקות יומיות
 */
export function getDayStats(tasks, dateISO = null) {
  const targetDate = dateISO || getTodayISO();
  const dayTasks = getTasksForDate(tasks, targetDate);
  const completedToday = tasks.filter(t => 
    t.is_completed && 
    t.completed_at && 
    t.completed_at.startsWith(targetDate)
  );
  
  return {
    pending: dayTasks.length,
    completed: completedToday.length,
    total: dayTasks.length + completedToday.length,
    plannedMinutes: dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0),
    completedMinutes: completedToday.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 0), 0)
  };
}

export default {
  getTodayISO,
  getTasksForDate,
  getTodayTasks,
  sortTasksByTime,
  getSortedTodayTasks,
  getWeekTasks,
  getDayStats
};
