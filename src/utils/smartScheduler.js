/**
 * מנוע שיבוץ חכם - גרסה 3 (Ultimate)
 * =====================================
 * 
 * פילוסופיה מרכזית:
 * "לסיים כל משימה כמה שיותר מהר - לא לדחות לדדליין"
 * 
 * עקרונות:
 * 1. מילוי ימים למקסימום (100%) לפני מעבר ליום הבא
 * 2. משימה חדשה = משבצים מיד, לא מחכים לדדליין
 * 3. דדליין = בדיקת היתכנות, לא מטרת תכנון
 * 4. תמיד יש גמישות להפרעות - כי משימות מסתיימות מוקדם
 * 
 * סדר עדיפויות:
 * 1. משימות עם דדליין היום (חייבים לסיים!)
 * 2. משימות עם דדליין קרוב (לפי קרבה)
 * 3. משימות בלי דדליין (לסיים כמה שיותר מהר)
 * 
 * חוקי שיבוץ:
 * - בלוקים של 45 דקות + 5 דקות הפסקה
 * - תמלול: 08:00-12:00 (שעות עירנות)
 * - הגהה/תרגום/אחר: 12:00-16:00
 * 
 * ✅ תיקון: שימוש ב-toLocalISODate לתאריכים מקומיים
 */

import { WORK_HOURS } from '../config/workSchedule';
import { toLocalISODate } from './dateHelpers';

// ============================================
// הגדרות
// ============================================

export const SMART_SCHEDULE_CONFIG = {
  // שעות עבודה
  dayStart: 8 * 60,           // 08:00
  dayEnd: 16 * 60,            // 16:00
  
  // חלון בוקר (תמלול)
  morningStart: 8 * 60,       // 08:00
  morningEnd: 12 * 60,        // 12:00
  
  // חלון אחה"צ (הגהה, תרגום, אחר)
  afternoonStart: 12 * 60,    // 12:00
  afternoonEnd: 16 * 60,      // 16:00
  
  // בלוקים
  blockDuration: 45,          // 45 דקות
  breakDuration: 5,           // 5 דקות הפסקה
  
  // סוגי משימות לבוקר
  morningTaskTypes: ['transcription', 'תמלול'],
  
  // זמן עבודה נטו ביום (בדקות)
  get workMinutesPerDay() {
    return this.dayEnd - this.dayStart; // 480 דקות = 8 שעות
  },
  
  // כמה בלוקים מקסימום ביום
  get maxBlocksPerDay() {
    return Math.floor(this.workMinutesPerDay / (this.blockDuration + this.breakDuration)); // 9-10 בלוקים
  }
};

// ============================================
// פונקציה ראשית - שיבוץ שבועי
// ============================================

/**
 * שיבוץ חכם לשבוע
 * @param {Date} weekStart - תחילת השבוע (יום ראשון)
 * @param {Array} allTasks - כל המשימות
 * @returns {Object} תוכנית שבועית
 */
export function smartScheduleWeek(weekStart, allTasks) {
  const config = SMART_SCHEDULE_CONFIG;
  
  // ✅ תיקון: שימוש ב-toLocalISODate
  const today = new Date();
  const todayISO = toLocalISODate(today);
  
  // סוף השבוע המבוקש
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndISO = toLocalISODate(weekEnd);
  const weekStartISO = toLocalISODate(weekStart);
  
  console.log('🚀 Smart Scheduler v3 - Starting week planning');
  console.log(`📅 Week: ${weekStartISO} - ${weekEndISO}`);
  console.log(`📅 Today: ${todayISO}`);
  
  // שלב 1: יצירת מבנה ימים
  const days = initializeDays(weekStart, config);
  
  // שלב 2: בדיקה אם זה שבוע בעבר
  if (weekEndISO < todayISO) {
    console.log('⏪ שבוע בעבר - לא משבצים משימות');
    return {
      weekStart: weekStartISO,
      days: days.map(formatDayForOutput),
      summary: { totalScheduledMinutes: 0, totalAvailableMinutes: 0, usagePercent: 0 },
      warnings: [],
      unscheduledTasks: [],
      isPastWeek: true
    };
  }
  
  // שלב 3: סינון משימות
  // סינון משימות שהושלמו ומשימות-הורה (is_project) שיש להן ילדים
  const pendingTasks = allTasks.filter(t => {
    // לא מציגים משימות שהושלמו
    if (t.is_completed) return false;
    // לא מציגים משימות-הורה (הילדים שלהן יוצגו במקום)
    if (t.is_project) return false;
    return true;
  });
  
  // 🔍 DEBUG: הצגת המשימות שמתקבלות
  console.log('🔍 DEBUG - allTasks received:', allTasks.length);
  console.log('🔍 DEBUG - pendingTasks after filter:', pendingTasks.length);
  
  // 🔍 DEBUG מורחב: הצגת כל האינטרוולים (כולל הושלמו)
  const allIntervals = allTasks.filter(t => t.parent_task_id);
  console.log('🔍 DEBUG - ALL intervals (including completed):', allIntervals.length);
  allIntervals.forEach(t => {
    console.log(`  📌 "${t.title}" | due: ${t.due_date} | completed: ${t.is_completed} | parent: ${t.parent_task_id?.slice(0,8)}`);
  });
  
  pendingTasks.forEach(t => {
    console.log(`  📌 Task: "${t.title}" | id: ${t.id} | parent_task_id: ${t.parent_task_id || 'none'} | duration: ${t.estimated_duration}`);
  });
  
  // אם זה שבוע עתידי (לא השבוע הנוכחי), לא משבצים
  // המשימות ישובצו כשנגיע לשבוע הזה
  const isCurrentWeek = weekStartISO <= todayISO && todayISO <= weekEndISO;
  const isFutureWeek = weekStartISO > todayISO;
  
  if (isFutureWeek) {
    console.log('⏩ שבוע עתידי - מציג תצוגה מקדימה');
    // בשבוע עתידי, נציג רק משימות עם due_date בשבוע הזה
    const tasksForThisWeek = pendingTasks.filter(t => {
      if (!t.due_date) return false;
      return t.due_date >= weekStartISO && t.due_date <= weekEndISO;
    });
    
    if (tasksForThisWeek.length === 0) {
      return {
        weekStart: weekStartISO,
        days: days.map(formatDayForOutput),
        summary: { totalScheduledMinutes: 0, totalAvailableMinutes: 0, usagePercent: 0 },
        warnings: [],
        unscheduledTasks: [],
        isFutureWeek: true
      };
    }
    
    const sortedTasks = prioritizeTasks(tasksForThisWeek, days[0].date);
    const schedulingResult = scheduleAllTasks(sortedTasks, days, config);
    const stats = calculateStats(days, schedulingResult, config);
    
    return {
      weekStart: weekStartISO,
      days: days.map(formatDayForOutput),
      summary: stats,
      warnings: schedulingResult.warnings,
      unscheduledTasks: schedulingResult.unscheduledTasks,
      isFutureWeek: true
    };
  }
  
  // שבוע נוכחי - שיבוץ רגיל
  console.log(`✅ Pending tasks: ${pendingTasks.length}`);
  
  const sortedTasks = prioritizeTasks(pendingTasks, todayISO);
  
  // שלב 4: שיבוץ משימות - רק מהיום והלאה
  const schedulingResult = scheduleAllTasksFromToday(sortedTasks, days, todayISO, config);
  
  // שלב 5: חישוב סטטיסטיקות
  const stats = calculateStats(days, schedulingResult, config);
  
  console.log('📈 Week stats:', stats);
  
  return {
    weekStart: weekStartISO,
    days: days.map(formatDayForOutput),
    summary: stats,
    warnings: schedulingResult.warnings,
    unscheduledTasks: schedulingResult.unscheduledTasks,
    isCurrentWeek: true
  };
}

// ============================================
// שלב 1: אתחול ימים
// ============================================

function initializeDays(weekStart, config) {
  const days = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    // ✅ תיקון: קביעת שעה 12 למניעת בעיות timezone
    date.setHours(12, 0, 0, 0);
    
    // ✅ תיקון: שימוש ב-toLocalISODate
    const dateISO = toLocalISODate(date);
    const dayOfWeek = date.getDay();
    const dayConfig = WORK_HOURS[dayOfWeek];
    const isWorkDay = dayConfig?.enabled || false;
    
    const day = {
      date: dateISO,
      dayName: dayConfig?.name || '',
      dayOfWeek,
      isWorkDay,
      blocks: [],
      morningMinutesUsed: 0,
      afternoonMinutesUsed: 0,
      totalScheduledMinutes: 0,
      workHours: isWorkDay ? { start: 8, end: 16 } : null
    };
    
    // ❌ הוסר: בלוק אדמיניסטרציה קבוע - לפי בקשת המשתמשת
    
    days.push(day);
  }
  
  return days;
}

// ============================================
// שלב 2: מיון משימות לפי עדיפות
// ============================================

/**
 * מיון משימות - הכי דחוף קודם, אבל תמיד לסיים מהר!
 */
function prioritizeTasks(tasks, todayISO) {
  return [...tasks].sort((a, b) => {
    // ✅ תיקון חשוב: אינטרוולים של אותו הורה - לפי מספר בלוק!
    // זה צריך להיות ראשון כדי שאינטרוולים ישארו ביחד
    if (a.parent_task_id && b.parent_task_id && a.parent_task_id === b.parent_task_id) {
      // חילוץ מספר הבלוק מהכותרת: "משימה (2/4)" -> 2
      const aMatch = a.title.match(/\((\d+)\/\d+\)/);
      const bMatch = b.title.match(/\((\d+)\/\d+\)/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
    }
    
    // 1. משימות באיחור קודם!
    const aOverdue = a.due_date && a.due_date < todayISO;
    const bOverdue = b.due_date && b.due_date < todayISO;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // 2. לפי עדיפות (urgent > high > normal)
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // 3. לפי תאריך יעד (קרוב יותר קודם)
    if (a.due_date && b.due_date) {
      const dateCmp = a.due_date.localeCompare(b.due_date);
      if (dateCmp !== 0) return dateCmp;
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    // 4. לפי שעה אם יש (משימות עם שעה קבועה קודם)
    if (a.due_time && !b.due_time) return -1;
    if (!a.due_time && b.due_time) return 1;
    if (a.due_time && b.due_time) {
      const timeCmp = a.due_time.localeCompare(b.due_time);
      if (timeCmp !== 0) return timeCmp;
    }
    
    // 5. לפי תאריך יצירה (ישן יותר קודם)
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
}

// ============================================
// שלב 3: שיבוץ משימות
// ============================================

/**
 * שיבוץ כל המשימות - גרסה לשבוע עתידי
 */
function scheduleAllTasks(sortedTasks, days, config) {
  const taskProgress = new Map();
  const warnings = [];
  const unscheduledTasks = [];
  
  // אתחול התקדמות לכל משימה
  for (const task of sortedTasks) {
    taskProgress.set(task.id, {
      task,
      total: task.estimated_duration || 30,
      scheduled: 0,
      remaining: task.estimated_duration || 30,
      blocks: []
    });
  }
  
  // שיבוץ כל משימה
  for (const task of sortedTasks) {
    scheduleTask(task, days, taskProgress, config);
  }
  
  // איסוף משימות שלא שובצו
  for (const [taskId, progress] of taskProgress) {
    if (progress.remaining > 0) {
      unscheduledTasks.push(progress.task);
      warnings.push({
        type: 'not_scheduled',
        severity: 'high',
        message: `לא נמצא מקום ל"${progress.task.title}" (${progress.remaining} דק' נותרו)`,
        taskId
      });
    }
  }
  
  return { taskProgress, warnings, unscheduledTasks };
}

/**
 * שיבוץ כל המשימות - מהיום והלאה
 */
function scheduleAllTasksFromToday(sortedTasks, days, todayISO, config) {
  const taskProgress = new Map();
  const warnings = [];
  const unscheduledTasks = [];
  
  // ✅ תיקון: הרחבת הימים הרלוונטיים מעבר לשבוע הנוכחי
  // יוצרים ימים נוספים אם צריך (עד 14 ימים קדימה)
  const extendedDays = [...days];
  const lastDay = days[days.length - 1];
  
  if (lastDay) {
    // הוספת ימים נוספים (עד 2 שבועות קדימה)
    for (let i = 1; i <= 14; i++) {
      const nextDate = new Date(lastDay.date);
      nextDate.setDate(nextDate.getDate() + i);
      const nextDateISO = nextDate.toISOString().split('T')[0];
      
      // בדיקה שהיום לא קיים כבר
      if (!extendedDays.find(d => d.date === nextDateISO)) {
        const dayOfWeek = nextDate.getDay();
        // ✅ ימי עבודה: א'-ה' בלבד (0-4), לא שישי (5) ולא שבת (6)
        const isWorkDay = dayOfWeek >= 0 && dayOfWeek <= 4;
        
        if (isWorkDay) {
          extendedDays.push({
            date: nextDateISO,
            dateISO: nextDateISO,
            dayName: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][dayOfWeek],
            isWorkDay: true,
            blocks: [],
            totalScheduledMinutes: 0,
            morningMinutesUsed: 0,
            afternoonMinutesUsed: 0
          });
        }
      }
    }
  }
  
  // סינון ימים - רק מהיום והלאה וימי עבודה
  const relevantDays = extendedDays.filter(d => d.date >= todayISO && d.isWorkDay);
  
  console.log(`📅 ימים זמינים לשיבוץ: ${relevantDays.length} (כולל הרחבה)`);
  
  // ✅ תיקון: עדכון due_date של משימות באיחור להיום
  // כדי שאינטרוולים שה-due_date שלהם עבר יופיעו היום
  const tasksWithUpdatedDates = sortedTasks.map(task => {
    // אם זה אינטרוול (יש parent_task_id) וה-due_date עבר
    if (task.parent_task_id && task.due_date && task.due_date < todayISO) {
      console.log(`📅 עדכון אינטרוול באיחור: "${task.title}" מ-${task.due_date} להיום`);
      return {
        ...task,
        original_due_date: task.due_date,
        due_date: todayISO,
        is_overdue: true
      };
    }
    return task;
  });
  
  // אתחול התקדמות לכל משימה
  for (const task of tasksWithUpdatedDates) {
    taskProgress.set(task.id, {
      task,
      total: task.estimated_duration || 30,
      scheduled: 0,
      remaining: task.estimated_duration || 30,
      blocks: []
    });
  }
  
  // שיבוץ כל משימה
  for (const task of tasksWithUpdatedDates) {
    scheduleTask(task, relevantDays, taskProgress, config);
  }
  
  // איסוף משימות שלא שובצו
  for (const [taskId, progress] of taskProgress) {
    if (progress.remaining > 0) {
      unscheduledTasks.push(progress.task);
      warnings.push({
        type: 'not_scheduled',
        severity: 'high',
        message: `לא נמצא מקום ל"${progress.task.title}" (${progress.remaining} דק' נותרו)`,
        taskId
      });
    }
  }
  
  // העתקת הבלוקים לימים המקוריים (כולל ימים חדשים)
  for (const relevantDay of relevantDays) {
    const originalDay = days.find(d => d.date === relevantDay.date);
    if (originalDay) {
      originalDay.blocks = relevantDay.blocks;
      originalDay.totalScheduledMinutes = relevantDay.totalScheduledMinutes;
      originalDay.morningMinutesUsed = relevantDay.morningMinutesUsed;
      originalDay.afternoonMinutesUsed = relevantDay.afternoonMinutesUsed;
    } else if (relevantDay.blocks.length > 0) {
      // יום חדש עם בלוקים - מוסיפים למערך
      days.push(relevantDay);
    }
  }
  
  return { taskProgress, warnings, unscheduledTasks };
}

/**
 * שיבוץ משימה בודדת - למלא ימים ברצף!
 */
function scheduleTask(task, days, taskProgress, config) {
  const progress = taskProgress.get(task.id);
  if (!progress || progress.remaining <= 0) return;
  
  const isMorningTask = isMorningTaskType(task, config);
  
  // 🆕 לא מפצלים! כל משימה = בלוק אחד
  // הפיצול האמיתי קורה ב-taskIntervals.js שיוצר תתי-משימות בדאטהבייס
  const totalBlocks = 1;
  
  // עובר על כל הימים - ממלא כל יום למקסימום לפני מעבר להבא
  for (const day of days) {
    if (!day.isWorkDay) continue;
    if (progress.remaining <= 0) break;
    
    // בדיקת תאריך התחלה - לא לשבץ לפני start_date!
    if (task.start_date && day.date < task.start_date) {
      console.log(`📅 דילוג על ${day.date} - משימה "${task.title}" מתחילה רק ב-${task.start_date}`);
      continue;
    }
    
    // שיבוץ בחלון המועדף
    const preferredWindow = isMorningTask 
      ? { start: config.morningStart, end: config.morningEnd }
      : { start: config.afternoonStart, end: config.afternoonEnd };
    
    scheduleInWindow(task, day, preferredWindow, progress, totalBlocks, config);
    
    // אם נשאר - שיבוץ בחלון האחר
    if (progress.remaining > 0) {
      const altWindow = isMorningTask
        ? { start: config.afternoonStart, end: config.afternoonEnd }
        : { start: config.morningStart, end: config.morningEnd };
      
      scheduleInWindow(task, day, altWindow, progress, totalBlocks, config);
    }
  }
}

/**
 * שיבוץ בלוקים בחלון זמן מסוים
 */
function scheduleInWindow(task, day, window, progress, totalBlocks, config) {
  // מציאת סלוטים פנויים בחלון
  const freeSlots = findFreeSlots(day.blocks, window.start, window.end, config);
  
  for (const slot of freeSlots) {
    if (progress.remaining <= 0) break;
    
    let currentStart = slot.start;
    
    // 🆕 שיבוץ המשימה כולה כבלוק אחד (לא מפצלים!)
    // בודקים אם יש מספיק מקום למשימה
    if (progress.remaining > 0 && currentStart + progress.remaining <= slot.end) {
      const blockDuration = progress.remaining; // כל המשימה
      const blockEnd = currentStart + blockDuration;
      
      const blockIndex = 1; // תמיד בלוק אחד
      
      const block = {
        id: `${task.id}-block-${blockIndex}`,
        taskId: task.id,
        task: task,
        type: task.task_type || 'other',
        taskType: task.task_type || 'other',
        priority: task.priority || 'normal',
        title: task.title, // השם כמו שהוא - כבר יש מספור מ-taskIntervals
        startMinute: currentStart,
        endMinute: blockEnd,
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(blockEnd),
        duration: blockDuration,
        blockIndex,
        totalBlocks: 1,
        dayDate: day.date,
        isCompleted: task.is_completed || false,
        timeSpent: task.time_spent || 0
      };
      
      day.blocks.push(block);
      progress.blocks.push(block);
      progress.scheduled += blockDuration;
      progress.remaining -= blockDuration;
      day.totalScheduledMinutes += blockDuration;
      
      // עדכון שימוש בחלונות
      if (currentStart < config.morningEnd) {
        day.morningMinutesUsed += blockDuration;
      } else {
        day.afternoonMinutesUsed += blockDuration;
      }
    }
  }
  
  // מיון בלוקים לפי שעה
  day.blocks.sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * מציאת סלוטים פנויים בחלון
 */
function findFreeSlots(blocks, windowStart, windowEnd, config) {
  const slots = [];
  const sortedBlocks = blocks
    .filter(b => b.endMinute > windowStart && b.startMinute < windowEnd)
    .sort((a, b) => a.startMinute - b.startMinute);
  
  let current = windowStart;
  
  for (const block of sortedBlocks) {
    if (block.startMinute > current) {
      const gapSize = block.startMinute - current;
      if (gapSize >= config.blockDuration) {
        slots.push({ start: current, end: block.startMinute });
      }
    }
    current = Math.max(current, block.endMinute + config.breakDuration);
  }
  
  // סלוט בסוף החלון
  if (windowEnd > current) {
    const gapSize = windowEnd - current;
    if (gapSize >= config.blockDuration) {
      slots.push({ start: current, end: windowEnd });
    }
  }
  
  return slots;
}

/**
 * בדיקת היתכנות - האם אפשר לסיים לפני הדדליין?
 */
function checkFeasibility(task, days, config) {
  const duration = task.estimated_duration || 30;
  const deadline = task.due_date;
  
  let availableMinutes = 0;
  
  for (const day of days) {
    if (!day.isWorkDay) continue;
    if (day.date > deadline) break;
    
    // זמן פנוי ביום
    const dayCapacity = config.workMinutesPerDay - day.totalScheduledMinutes;
    availableMinutes += Math.max(0, dayCapacity);
  }
  
  return {
    canComplete: availableMinutes >= duration,
    availableMinutes,
    requiredMinutes: duration,
    deficit: Math.max(0, duration - availableMinutes)
  };
}

// ============================================
// שלב 4: סטטיסטיקות
// ============================================

function calculateStats(days, schedulingResult, config) {
  const workDays = days.filter(d => d.isWorkDay);
  const totalAvailable = workDays.length * (config.dayEnd - config.dayStart);
  const totalScheduled = workDays.reduce((sum, d) => sum + d.totalScheduledMinutes, 0);
  
  return {
    totalScheduledMinutes: totalScheduled,
    totalAvailableMinutes: totalAvailable,
    usagePercent: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0,
    workDaysCount: workDays.length,
    overloadDays: workDays.filter(d => d.totalScheduledMinutes > (config.dayEnd - config.dayStart)).length,
    warningsCount: schedulingResult.warnings.length,
    unscheduledCount: schedulingResult.unscheduledTasks.length
  };
}

function formatDayForOutput(day) {
  const config = SMART_SCHEDULE_CONFIG;
  const dayCapacity = day.isWorkDay ? (config.dayEnd - config.dayStart) : 0;
  
  // ✅ תיקון: מיון בלוקים לפי זמן התחלה
  const sortedBlocks = [...(day.blocks || [])].sort((a, b) => {
    // קודם לפי זמן התחלה
    if (a.startMinute !== b.startMinute) {
      return a.startMinute - b.startMinute;
    }
    // אם אותו זמן - לפי blockIndex (למשימות מפוצלות)
    if (a.blockIndex && b.blockIndex) {
      return a.blockIndex - b.blockIndex;
    }
    // לפי due_time אם יש
    if (a.startTime && b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return 0;
  });
  
  return {
    ...day,
    blocks: sortedBlocks,
    scheduledBlocks: sortedBlocks, // תאימות לאחור
    usagePercent: dayCapacity > 0 ? Math.round((day.totalScheduledMinutes / dayCapacity) * 100) : 0,
    freeMinutes: Math.max(0, dayCapacity - day.totalScheduledMinutes),
    scheduledMinutes: day.totalScheduledMinutes,
    availableMinutes: dayCapacity
  };
}

// ============================================
// פונקציות עזר
// ============================================

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function isSameDay(date1, date2) {
  return toLocalISODate(date1) === toLocalISODate(date2);
}

function daysBetween(date1, date2) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date2 - date1) / msPerDay);
}

function isMorningTaskType(task, config) {
  const taskType = task.task_type?.toLowerCase() || '';
  const taskTitle = task.title?.toLowerCase() || '';
  
  return config.morningTaskTypes.some(type => 
    taskType.includes(type.toLowerCase()) || 
    taskTitle.includes(type.toLowerCase())
  );
}

// ============================================
// פונקציה לתאימות לאחור
// ============================================

export function smartScheduleDay(date, allTasks) {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - dayOfWeek);
  weekStart.setHours(12, 0, 0, 0);
  
  const weekPlan = smartScheduleWeek(weekStart, allTasks);
  // ✅ תיקון: שימוש ב-toLocalISODate
  const dateISO = toLocalISODate(date);
  
  return weekPlan.days.find(d => d.date === dateISO) || {
    date: dateISO,
    isWorkDay: false,
    blocks: [],
    scheduledBlocks: []
  };
}

// ============================================
// ייצוא
// ============================================

export default {
  smartScheduleDay,
  smartScheduleWeek,
  SMART_SCHEDULE_CONFIG
};
