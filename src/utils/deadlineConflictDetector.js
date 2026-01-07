/**
 * מנוע זיהוי התנגשויות דדליין
 * ===================================
 * 
 * מטרה: לזהות מראש כשלא נעמוד בדדליין ולהתריע בזמן
 * 
 * הלוגיקה:
 * 1. סורק את כל המשימות עם דדליין (תאריך + שעה)
 * 2. מחשב כמה זמן נשאר עד כל דדליין
 * 3. מחשב כמה זמן עבודה עדיין נדרש
 * 4. אם הזמן הנדרש > הזמן הזמין → התראה!
 * 5. מציע פתרונות: דחה משימות אחרות / שנה דדליין / חלק משימה
 */

import { WORK_HOURS } from '../config/workSchedule';

// ============================================
// הגדרות
// ============================================

const CONFIG = {
  // מתי להתריע (לפני כמה זמן)
  ALERT_THRESHOLDS: {
    CRITICAL: 60,    // דקות - פחות משעה = קריטי
    WARNING: 120,    // דקות - פחות משעתיים = אזהרה
    INFO: 240        // דקות - פחות מ-4 שעות = מידע
  },
  
  // כמה זמן לפני הדדליין להתריע
  ALERT_BEFORE_DEADLINE: {
    SAME_DAY: 120,   // דקות - 2 שעות לפני
    NEXT_DAY: 480,   // דקות - יום לפני (8 שעות עבודה)
    THIS_WEEK: 1440  // דקות - יום לפני (24 שעות)
  },
  
  // מרווח בטיחות
  SAFETY_BUFFER: 15  // דקות בין משימות
};

// ============================================
// פונקציות עזר לזמן
// ============================================

/**
 * המרת תאריך ושעה לאובייקט Date
 */
function parseDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  
  const date = new Date(dateStr);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    // אם אין שעה, נניח סוף יום עבודה
    date.setHours(17, 0, 0, 0);
  }
  return date;
}

/**
 * חישוב דקות עבודה זמינות בין שני זמנים
 */
function calculateAvailableWorkMinutes(fromDate, toDate) {
  if (!fromDate || !toDate || fromDate >= toDate) return 0;
  
  let totalMinutes = 0;
  const current = new Date(fromDate);
  
  while (current < toDate) {
    const dayOfWeek = current.getDay();
    const dayConfig = WORK_HOURS[dayOfWeek];
    
    if (dayConfig?.enabled) {
      const dayStart = dayConfig.start || 8;
      const dayEnd = dayConfig.end || 17;
      const dayStartMinutes = dayStart * 60;
      const dayEndMinutes = dayEnd * 60;
      
      const currentMinutes = current.getHours() * 60 + current.getMinutes();
      const isSameDay = current.toDateString() === toDate.toDateString();
      
      if (isSameDay) {
        // אותו יום - חשב עד שעת הסיום
        const endMinutes = toDate.getHours() * 60 + toDate.getMinutes();
        const effectiveStart = Math.max(currentMinutes, dayStartMinutes);
        const effectiveEnd = Math.min(endMinutes, dayEndMinutes);
        if (effectiveEnd > effectiveStart) {
          totalMinutes += effectiveEnd - effectiveStart;
        }
      } else {
        // יום מלא - חשב את כל שעות העבודה
        const effectiveStart = Math.max(currentMinutes, dayStartMinutes);
        if (dayEndMinutes > effectiveStart) {
          totalMinutes += dayEndMinutes - effectiveStart;
        }
      }
    }
    
    // עבור ליום הבא
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }
  
  return totalMinutes;
}

/**
 * תאריך מקומי בפורמט ISO
 */
function toLocalISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * פורמט שעה
 */
function formatTime(date) {
  if (!date) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ============================================
// מנוע זיהוי התנגשויות
// ============================================

/**
 * זיהוי כל המשימות שלא נעמוד בדדליין שלהן
 * 
 * @param {Array} tasks - כל המשימות
 * @returns {Array} רשימת התנגשויות עם פתרונות מוצעים
 */
export function detectDeadlineConflicts(tasks) {
  const now = new Date();
  const todayISO = toLocalISODate(now);
  const conflicts = [];
  
  // סנן רק משימות לא מושלמות עם דדליין
  const tasksWithDeadline = tasks.filter(task => 
    !task.is_completed && 
    task.due_date &&
    task.due_date >= todayISO
  );
  
  // מיין לפי דדליין (הקרוב ביותר קודם)
  tasksWithDeadline.sort((a, b) => {
    const aDeadline = parseDateTime(a.due_date, a.due_time);
    const bDeadline = parseDateTime(b.due_date, b.due_time);
    return aDeadline - bDeadline;
  });
  
  // בנה "ציר זמן" של משימות מתוזמנות
  const scheduledTasks = buildScheduledTimeline(tasks, now);
  
  // בדוק כל משימה עם דדליין
  for (const task of tasksWithDeadline) {
    const conflict = analyzeTaskDeadline(task, scheduledTasks, tasks, now);
    if (conflict) {
      conflicts.push(conflict);
    }
  }
  
  // מיין לפי דחיפות
  conflicts.sort((a, b) => {
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    return (priorityOrder[a.severity] || 2) - (priorityOrder[b.severity] || 2);
  });
  
  return conflicts;
}

/**
 * בניית ציר זמן של משימות מתוזמנות
 */
function buildScheduledTimeline(tasks, fromDate) {
  const todayISO = toLocalISODate(fromDate);
  
  return tasks
    .filter(t => !t.is_completed && t.due_date && t.due_date >= todayISO)
    .map(task => ({
      ...task,
      deadline: parseDateTime(task.due_date, task.due_time),
      remainingDuration: Math.max(0, (task.estimated_duration || 30) - (task.time_spent || 0))
    }))
    .sort((a, b) => a.deadline - b.deadline);
}

/**
 * ניתוח דדליין של משימה בודדת
 */
function analyzeTaskDeadline(task, scheduledTasks, allTasks, now) {
  const deadline = parseDateTime(task.due_date, task.due_time);
  if (!deadline) return null;
  
  // כמה זמן נשאר עד הדדליין
  const minutesToDeadline = Math.floor((deadline - now) / (1000 * 60));
  if (minutesToDeadline < 0) {
    // כבר עבר הדדליין!
    return {
      taskId: task.id,
      task,
      type: 'overdue',
      severity: 'critical',
      deadline,
      deadlineStr: `${task.due_date} ${task.due_time || ''}`,
      minutesToDeadline,
      message: `🚨 הדדליין עבר! המשימה הייתה צריכה להסתיים ב-${task.due_time || 'סוף היום'}`,
      solutions: generateOverdueSolutions(task, allTasks)
    };
  }
  
  // כמה זמן עבודה נדרש להשלמת המשימה
  const remainingDuration = Math.max(0, (task.estimated_duration || 30) - (task.time_spent || 0));
  
  // כמה זמן עבודה זמין עד הדדליין
  const availableMinutes = calculateAvailableWorkMinutes(now, deadline);
  
  // כמה זמן תפוס במשימות אחרות עד הדדליין
  const blockedMinutes = calculateBlockedMinutes(task, scheduledTasks, now, deadline);
  
  // זמן עבודה אפקטיבי זמין
  const effectiveAvailable = availableMinutes - blockedMinutes - CONFIG.SAFETY_BUFFER;
  
  // האם נעמוד בזמן?
  if (remainingDuration > effectiveAvailable) {
    // לא נעמוד!
    const shortfall = remainingDuration - effectiveAvailable;
    const severity = determineSeverity(minutesToDeadline, shortfall);
    
    return {
      taskId: task.id,
      task,
      type: 'conflict',
      severity,
      deadline,
      deadlineStr: `${task.due_date} ${task.due_time || ''}`,
      minutesToDeadline,
      remainingDuration,
      availableMinutes: effectiveAvailable,
      shortfall,
      blockedByOtherTasks: blockedMinutes,
      message: generateConflictMessage(task, shortfall, minutesToDeadline),
      solutions: generateSolutions(task, allTasks, shortfall, deadline)
    };
  }
  
  // נעמוד בזמן, אבל אולי צריך להתחיל בקרוב?
  if (remainingDuration > 0 && effectiveAvailable < remainingDuration * 1.5) {
    // מרווח צר - כדאי להתחיל בקרוב
    return {
      taskId: task.id,
      task,
      type: 'tight',
      severity: 'info',
      deadline,
      deadlineStr: `${task.due_date} ${task.due_time || ''}`,
      minutesToDeadline,
      remainingDuration,
      availableMinutes: effectiveAvailable,
      message: `⏰ "${task.title}" - מרווח הזמן צר. כדאי להתחיל בקרוב!`,
      solutions: []
    };
  }
  
  return null; // הכל בסדר
}

/**
 * חישוב זמן תפוס במשימות אחרות
 */
function calculateBlockedMinutes(currentTask, scheduledTasks, now, deadline) {
  let blocked = 0;
  
  for (const task of scheduledTasks) {
    if (task.id === currentTask.id) continue;
    if (task.deadline > deadline) continue; // משימות אחרי הדדליין שלנו לא רלוונטיות
    
    // אם המשימה צריכה להסתיים לפני הדדליין שלנו, היא תופסת זמן
    const taskDeadline = task.deadline;
    if (taskDeadline && taskDeadline <= deadline) {
      blocked += task.remainingDuration || 0;
    }
  }
  
  return blocked;
}

/**
 * קביעת רמת דחיפות
 */
function determineSeverity(minutesToDeadline, shortfall) {
  if (minutesToDeadline <= CONFIG.ALERT_THRESHOLDS.CRITICAL) {
    return 'critical';
  }
  if (minutesToDeadline <= CONFIG.ALERT_THRESHOLDS.WARNING || shortfall > 60) {
    return 'warning';
  }
  return 'info';
}

/**
 * יצירת הודעת התנגשות
 */
function generateConflictMessage(task, shortfall, minutesToDeadline) {
  const hours = Math.floor(shortfall / 60);
  const mins = shortfall % 60;
  const timeStr = hours > 0 ? `${hours} שעות ו-${mins} דקות` : `${mins} דקות`;
  
  if (minutesToDeadline < 60) {
    return `🚨 "${task.title}" - לא תספיקי! חסרות ${timeStr} והדדליין בעוד פחות משעה!`;
  }
  
  if (minutesToDeadline < 120) {
    return `⚠️ "${task.title}" - בעיה! חסרות ${timeStr} והדדליין בעוד פחות משעתיים`;
  }
  
  return `⏰ "${task.title}" - שימי לב! חסרות ${timeStr} עד הדדליין`;
}

// ============================================
// מחולל פתרונות
// ============================================

/**
 * יצירת פתרונות להתנגשות
 */
function generateSolutions(task, allTasks, shortfall, deadline) {
  const solutions = [];
  const todayISO = toLocalISODate(new Date());
  
  // פתרון 1: דחה את הדדליין
  const suggestedNewDeadline = calculateNewDeadline(deadline, shortfall);
  solutions.push({
    id: 'extend_deadline',
    type: 'extend_deadline',
    label: '📅 דחה את הדדליין',
    description: `הזז את הדדליין ל-${toLocalISODate(suggestedNewDeadline)} ${formatTime(suggestedNewDeadline)}`,
    action: {
      type: 'update_task',
      taskId: task.id,
      changes: {
        due_date: toLocalISODate(suggestedNewDeadline),
        due_time: formatTime(suggestedNewDeadline)
      }
    },
    impact: 'low'
  });
  
  // פתרון 2: דחה משימות אחרות
  const deferableTasks = findDeferableTasks(allTasks, task, shortfall, todayISO);
  if (deferableTasks.length > 0) {
    solutions.push({
      id: 'defer_others',
      type: 'defer_others',
      label: '↔️ דחה משימות אחרות',
      description: `דחה ${deferableTasks.length} משימות כדי לפנות ${deferableTasks.reduce((sum, t) => sum + t.freedMinutes, 0)} דקות`,
      tasks: deferableTasks,
      action: {
        type: 'defer_tasks',
        tasks: deferableTasks.map(t => ({
          taskId: t.id,
          newDate: t.suggestedNewDate
        }))
      },
      impact: 'medium'
    });
  }
  
  // פתרון 3: קצר את המשימה
  if (task.estimated_duration > 30) {
    const reducedDuration = Math.max(30, task.estimated_duration - shortfall);
    solutions.push({
      id: 'reduce_scope',
      type: 'reduce_scope',
      label: '✂️ צמצם את היקף המשימה',
      description: `קצר את המשימה ל-${reducedDuration} דקות במקום ${task.estimated_duration}`,
      action: {
        type: 'update_task',
        taskId: task.id,
        changes: {
          estimated_duration: reducedDuration
        }
      },
      impact: 'medium'
    });
  }
  
  // פתרון 4: התחל עכשיו!
  solutions.push({
    id: 'start_now',
    type: 'start_now',
    label: '▶️ התחל עכשיו!',
    description: 'התחל לעבוד על המשימה מיד',
    action: {
      type: 'start_task',
      taskId: task.id
    },
    impact: 'none',
    primary: true
  });
  
  return solutions;
}

/**
 * יצירת פתרונות למשימה שעבר הדדליין שלה
 */
function generateOverdueSolutions(task, allTasks) {
  const solutions = [];
  const now = new Date();
  
  // פתרון 1: קבע דדליין חדש
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  
  solutions.push({
    id: 'new_deadline',
    type: 'extend_deadline',
    label: '📅 קבע דדליין חדש למחר',
    description: `הזז את הדדליין ל-${toLocalISODate(tomorrow)} 17:00`,
    action: {
      type: 'update_task',
      taskId: task.id,
      changes: {
        due_date: toLocalISODate(tomorrow),
        due_time: '17:00'
      }
    },
    impact: 'low'
  });
  
  // פתרון 2: התחל עכשיו
  solutions.push({
    id: 'start_now',
    type: 'start_now',
    label: '▶️ התחל עכשיו!',
    description: 'התחל לעבוד על המשימה מיד - הדדליין כבר עבר!',
    action: {
      type: 'start_task',
      taskId: task.id
    },
    impact: 'none',
    primary: true
  });
  
  // פתרון 3: בטל את המשימה
  solutions.push({
    id: 'cancel',
    type: 'cancel',
    label: '❌ בטל את המשימה',
    description: 'סמן את המשימה כמבוטלת',
    action: {
      type: 'cancel_task',
      taskId: task.id
    },
    impact: 'high'
  });
  
  return solutions;
}

/**
 * חישוב דדליין חדש מוצע
 */
function calculateNewDeadline(currentDeadline, shortfallMinutes) {
  const newDeadline = new Date(currentDeadline);
  
  // הוסף את הזמן החסר בתוספת מרווח בטיחות
  const additionalMinutes = shortfallMinutes + CONFIG.SAFETY_BUFFER + 30;
  
  // חשב כמה ימי עבודה צריך להוסיף
  let remainingMinutes = additionalMinutes;
  
  while (remainingMinutes > 0) {
    const dayOfWeek = newDeadline.getDay();
    const dayConfig = WORK_HOURS[dayOfWeek];
    
    if (dayConfig?.enabled) {
      const dayEnd = (dayConfig.end || 17) * 60;
      const currentMinutes = newDeadline.getHours() * 60 + newDeadline.getMinutes();
      const availableToday = Math.max(0, dayEnd - currentMinutes);
      
      if (availableToday >= remainingMinutes) {
        newDeadline.setMinutes(newDeadline.getMinutes() + remainingMinutes);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= availableToday;
        newDeadline.setDate(newDeadline.getDate() + 1);
        newDeadline.setHours(WORK_HOURS[newDeadline.getDay()]?.start || 8, 0, 0, 0);
      }
    } else {
      newDeadline.setDate(newDeadline.getDate() + 1);
    }
  }
  
  return newDeadline;
}

/**
 * מציאת משימות שאפשר לדחות
 */
function findDeferableTasks(allTasks, priorityTask, neededMinutes, todayISO) {
  const deferableTasks = [];
  let freedMinutes = 0;
  
  // מצא משימות שאפשר לדחות (לא Q1, לא המשימה הנוכחית)
  const candidates = allTasks
    .filter(t => 
      !t.is_completed &&
      t.id !== priorityTask.id &&
      t.quadrant !== 1 &&
      t.due_date === todayISO
    )
    .sort((a, b) => (b.quadrant || 4) - (a.quadrant || 4)); // Q4 קודם
  
  for (const task of candidates) {
    if (freedMinutes >= neededMinutes) break;
    
    const taskDuration = task.estimated_duration || 30;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    deferableTasks.push({
      ...task,
      freedMinutes: taskDuration,
      suggestedNewDate: toLocalISODate(tomorrow)
    });
    
    freedMinutes += taskDuration;
  }
  
  return deferableTasks;
}

// ============================================
// בדיקת התנגשויות חדשות (לשימוש בזמן אמת)
// ============================================

/**
 * בדיקה מהירה - האם יש התנגשויות קריטיות?
 */
export function hasUrgentConflicts(tasks) {
  const conflicts = detectDeadlineConflicts(tasks);
  return conflicts.some(c => c.severity === 'critical');
}

/**
 * קבלת התנגשות הדחופה ביותר
 */
export function getMostUrgentConflict(tasks) {
  const conflicts = detectDeadlineConflicts(tasks);
  return conflicts[0] || null;
}

/**
 * בדיקה האם משימה ספציפית בסיכון
 */
export function isTaskAtRisk(task, allTasks) {
  if (!task.due_date || !task.due_time) return false;
  
  const conflicts = detectDeadlineConflicts(allTasks);
  return conflicts.some(c => c.taskId === task.id);
}

// ============================================
// ייצוא
// ============================================

export default {
  detectDeadlineConflicts,
  hasUrgentConflicts,
  getMostUrgentConflict,
  isTaskAtRisk,
  calculateAvailableWorkMinutes,
  CONFIG
};
