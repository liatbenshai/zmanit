/**
 * מערכת דחייה אוטומטית של משימות
 * 
 * כשאין מספיק זמן להיום - מעביר משימות אוטומטית למחר
 * כשמתפנה זמן - מושך משימות ממחר להיום
 */

// שעות עבודה
const WORK_HOURS = {
  start: 8.5,   // 08:30
  end: 16.25,   // 16:15
  totalMinutes: 465 // 7:45 שעות
};

/**
 * חישוב תאריך מקומי בפורמט ISO
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * חישוב יום העבודה הבא (דילוג על שישי-שבת אם צריך)
 */
function getNextWorkday(fromDate) {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + 1);
  
  // דילוג על שבת (6) - עובר ליום ראשון
  // אפשר להוסיף דילוג על שישי אם צריך
  while (date.getDay() === 6) { // שבת
    date.setDate(date.getDate() + 1);
  }
  
  return date;
}

/**
 * חישוב כמה דקות נשארו להיום
 */
function getRemainingMinutesToday() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = WORK_HOURS.end * 60; // 16:15 = 976.5
  
  return Math.max(0, endMinutes - currentMinutes);
}

/**
 * בדיקה אם טיימר רץ על משימה
 */
function isTimerRunning(taskId) {
  try {
    const key = `timer_v2_${taskId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      return data.isRunning && !data.isInterrupted;
    }
  } catch (e) {}
  return false;
}

/**
 * חישוב זמן שנותר למשימה
 */
function getRemainingTaskTime(task) {
  const estimated = task.estimated_duration || 30;
  const spent = task.time_spent || 0;
  return Math.max(0, estimated - spent);
}

/**
 * בדיקה אם משימה היא "פרויקט" גדול שמחולק לבלוקים
 * משימות מעל 3 שעות נחשבות פרויקטים - הן מטופלות ע"י smartScheduler
 */
function isProjectTask(task) {
  const duration = task.estimated_duration || 0;
  return duration > 180; // יותר מ-3 שעות = פרויקט
}

/**
 * ✅ חדש: בדיקה אם משימה היא "הורה" שיש לה אינטרוולים
 * אם יש ילדים עם parent_task_id שמצביע על המשימה - היא הורה
 */
function isParentWithIntervals(task, allTasks) {
  return allTasks.some(t => t.parent_task_id === task.id);
}

/**
 * ✅ פונקציה ראשית: חישוב דחיות אוטומטיות
 * 
 * מחזירה רשימת משימות לעדכון:
 * - משימות שצריך להעביר למחר (אין מקום להיום)
 * - משימות שאפשר למשוך ממחר להיום (יש מקום)
 * 
 * ⚠️ לא מטפל בפרויקטים גדולים (מעל 3 שעות) - הם מחולקים לבלוקים ע"י smartScheduler
 * ⚠️ לא סופר משימות הורה שיש להן אינטרוולים - כדי לא לספור כפול!
 */
export function calculateAutoReschedule(tasks, editTask) {
  const now = new Date();
  const today = toLocalISODate(now);
  const tomorrow = toLocalISODate(getNextWorkday(now));
  
  // סינון משימות - רק משימות "רגילות", לא פרויקטים גדולים, לא הורים עם אינטרוולים
  const todayTasks = tasks.filter(t => 
    !t.is_completed && 
    !isProjectTask(t) && // ✅ לא פרויקטים
    !isParentWithIntervals(t, tasks) && // ✅ חדש: לא הורים שיש להם ילדים
    (t.due_date === today || t.start_date === today)
  );
  
  const tomorrowTasks = tasks.filter(t => 
    !t.is_completed && 
    !isProjectTask(t) && // ✅ לא פרויקטים
    !isParentWithIntervals(t, tasks) && // ✅ חדש: לא הורים שיש להם ילדים
    (t.due_date === tomorrow || t.start_date === tomorrow)
  );
  
  // חישוב זמן פנוי להיום
  const remainingToday = getRemainingMinutesToday();
  
  // חישוב זמן נדרש להיום (לא כולל משימות עם טיימר פעיל)
  let timeNeededToday = 0;
  const sortedTodayTasks = [...todayTasks].sort((a, b) => {
    // עדיפות: urgent > high > normal
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // לפי שעה אם יש
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    
    return 0;
  });
  
  const tasksToMoveToTomorrow = [];
  const tasksToKeepToday = [];
  
  sortedTodayTasks.forEach(task => {
    const taskTime = getRemainingTaskTime(task);
    
    // משימות עם טיימר פעיל - תמיד נשארות
    if (isTimerRunning(task.id)) {
      tasksToKeepToday.push(task);
      timeNeededToday += taskTime;
      return;
    }
    
    // בדיקה אם יש מקום
    if (timeNeededToday + taskTime <= remainingToday) {
      tasksToKeepToday.push(task);
      timeNeededToday += taskTime;
    } else {
      // אין מקום - להעביר למחר
      tasksToMoveToTomorrow.push(task);
    }
  });
  
  // חישוב זמן פנוי שנשאר אחרי המשימות שנשארו
  const freeTimeToday = remainingToday - timeNeededToday;
  
  // האם אפשר למשוך משימות ממחר?
  const tasksToMoveToToday = [];
  
  if (freeTimeToday > 15) { // לפחות 15 דקות פנויות
    let usedFreeTime = 0;
    
    // מיון משימות מחר לפי עדיפות
    const sortedTomorrowTasks = [...tomorrowTasks].sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });
    
    for (const task of sortedTomorrowTasks) {
      const taskTime = getRemainingTaskTime(task);
      
      // בדיקה אם נכנס בזמן הפנוי
      if (usedFreeTime + taskTime <= freeTimeToday) {
        tasksToMoveToToday.push(task);
        usedFreeTime += taskTime;
      }
    }
  }
  
  return {
    today,
    tomorrow,
    remainingToday,
    timeNeededToday,
    freeTimeToday,
    tasksToMoveToTomorrow,
    tasksToMoveToToday,
    tasksToKeepToday
  };
}

/**
 * ביצוע הדחיות האוטומטיות
 */
export async function executeAutoReschedule(editTask, rescheduleData) {
  const { today, tomorrow, tasksToMoveToTomorrow, tasksToMoveToToday } = rescheduleData;
  
  const updates = [];
  
  // העברת משימות למחר
  for (const task of tasksToMoveToTomorrow) {
    updates.push({
      task,
      action: 'moveToTomorrow',
      promise: editTask(task.id, {
        due_date: tomorrow,
        start_date: task.start_date === today ? tomorrow : task.start_date,
        due_time: null // איפוס השעה - יתוזמן מחדש
      })
    });
  }
  
  // משיכת משימות להיום
  for (const task of tasksToMoveToToday) {
    updates.push({
      task,
      action: 'moveToToday',
      promise: editTask(task.id, {
        due_date: today,
        start_date: task.start_date === tomorrow ? today : task.start_date,
        due_time: null
      })
    });
  }
  
  // ביצוע כל העדכונים
  const results = await Promise.allSettled(updates.map(u => u.promise));
  
  return {
    movedToTomorrow: tasksToMoveToTomorrow.length,
    movedToToday: tasksToMoveToToday.length,
    results
  };
}

/**
 * ✅ פונקציה נוחה: חישוב וביצוע אוטומטי
 */
export async function autoRescheduleIfNeeded(tasks, editTask, options = {}) {
  const { silent = false, onlyCalculate = false } = options;
  
  const rescheduleData = calculateAutoReschedule(tasks, editTask);
  
  const { tasksToMoveToTomorrow, tasksToMoveToToday, freeTimeToday } = rescheduleData;
  
  // אם אין מה לעשות
  if (tasksToMoveToTomorrow.length === 0 && tasksToMoveToToday.length === 0) {
    return {
      changed: false,
      ...rescheduleData
    };
  }
  
  // אם רק לחשב
  if (onlyCalculate) {
    return {
      changed: true,
      needsAction: true,
      ...rescheduleData
    };
  }
  
  // ביצוע
  const result = await executeAutoReschedule(editTask, rescheduleData);
  
  return {
    changed: true,
    ...rescheduleData,
    ...result
  };
}

/**
 * פורמט דקות לתצוגה
 */
export function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}
