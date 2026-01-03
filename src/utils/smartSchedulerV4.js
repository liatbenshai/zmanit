console.log('✅ smartSchedulerV4.js LOADED - FIXED VERSION!');
/**
 * מנוע שיבוץ חכם - גרסה 4 מתוקנת
 * =====================================
 * 
 * תיקון: זמנים מחושבים נכון לכל בלוק
 */

import { WORK_HOURS } from '../config/workSchedule';
import { toLocalISODate } from './dateHelpers';

// ============================================
// הגדרות
// ============================================

export const SMART_SCHEDULE_CONFIG = {
  dayStart: 8 * 60,           // 08:00
  dayEnd: 16 * 60,            // 16:00
  morningStart: 8 * 60,
  morningEnd: 12 * 60,
  afternoonStart: 12 * 60,
  afternoonEnd: 16 * 60,
  blockDuration: 45,
  breakDuration: 5,
  
  breakReminders: {
    afterMinutes: 90,
    breakLength: 10,
    lunchStart: 12 * 60,
    lunchEnd: 13 * 60,
    lunchLength: 30
  },
  
  morningTaskTypes: ['transcription', 'תמלול'],
  
  get workMinutesPerDay() {
    return this.dayEnd - this.dayStart;
  },
  
  get maxBlocksPerDay() {
    return Math.floor(this.workMinutesPerDay / (this.blockDuration + this.breakDuration));
  }
};

export const BLOCK_TYPES = {
  GOOGLE_EVENT: 'google_event',
  FLEXIBLE_TASK: 'flexible_task',
  BREAK: 'break',
  LUNCH: 'lunch'
};

// ============================================
// פונקציה ראשית
// ============================================

export function smartScheduleWeekV4(weekStart, allTasks) {
  const config = SMART_SCHEDULE_CONFIG;
  
  const today = new Date();
  const todayISO = toLocalISODate(today);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndISO = toLocalISODate(weekEnd);
  const weekStartISO = toLocalISODate(weekStart);
  
  // שלב 1: יצירת מבנה ימים
  const days = initializeDays(weekStart, config);
  
  // שלב 2: בדיקה אם זה שבוע בעבר
  if (weekEndISO < todayISO) {
    return createEmptyWeekPlan(weekStartISO, days);
  }
  
  // שלב 3: הפרדת משימות לסוגים
  const { googleEvents, flexibleTasks, completedTasks } = categorizeTasks(allTasks, weekStartISO, weekEndISO, todayISO);
  
  // שלב 4: שיבוץ אירועי גוגל קודם (הם קבועים!)
  scheduleGoogleEvents(googleEvents, days, config);
  
  // שלב 5: שיבוץ משימות גמישות סביב האירועים הקבועים
  const sortedTasks = prioritizeTasks(flexibleTasks, todayISO);
  const schedulingResult = scheduleFlexibleTasks(sortedTasks, days, todayISO, config);
  
  // שלב 6: שיבוץ משימות שהושלמו (לתצוגה)
  scheduleCompletedTasks(completedTasks, days, config);
  
  // שלב 7: יצירת המלצות
  const recommendations = generateRecommendations(days, schedulingResult, config);
  
  // שלב 8: חישוב סטטיסטיקות
  const stats = calculateStats(days, schedulingResult, config);
  
  return {
    weekStart: weekStartISO,
    days: days.map(d => formatDayForOutput(d, config)),
    summary: stats,
    warnings: schedulingResult.warnings,
    unscheduledTasks: schedulingResult.unscheduledTasks,
    recommendations,
    isCurrentWeek: weekStartISO <= todayISO && todayISO <= weekEndISO
  };
}

// ============================================
// הפרדת משימות לסוגים
// ============================================

function categorizeTasks(allTasks, weekStartISO, weekEndISO, todayISO) {
  const googleEvents = [];
  const flexibleTasks = [];
  const completedTasks = [];
  
  for (const task of allTasks) {
    if (task.is_project) continue;
    
    if (task.is_completed) {
      if (task.due_date && task.due_date >= weekStartISO && task.due_date <= weekEndISO) {
        completedTasks.push(task);
      }
      continue;
    }
    
    if (task.is_from_google || task.google_event_id) {
      googleEvents.push({
        ...task,
        isFixed: true,
        blockType: BLOCK_TYPES.GOOGLE_EVENT
      });
      continue;
    }
    
    flexibleTasks.push({
      ...task,
      isFixed: false,
      blockType: BLOCK_TYPES.FLEXIBLE_TASK
    });
  }
  
  return { googleEvents, flexibleTasks, completedTasks };
}

// ============================================
// שיבוץ אירועי גוגל (קבועים!)
// ============================================

function scheduleGoogleEvents(googleEvents, days, config) {
  for (const event of googleEvents) {
    if (!event.due_date || !event.due_time) continue;
    
    const targetDay = days.find(d => d.date === event.due_date);
    if (!targetDay) continue;
    
    const startMinutes = timeToMinutes(event.due_time);
    const duration = event.estimated_duration || 60;
    const endMinutes = startMinutes + duration;
    
    const block = {
      id: `google-${event.id}`,
      taskId: event.id,
      task: event,
      type: event.task_type || 'meeting',
      taskType: event.task_type || 'meeting',
      priority: 'fixed',
      title: `📅 ${event.title}`,
      startMinute: startMinutes,
      endMinute: endMinutes,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      duration: duration,
      dayDate: targetDay.date,
      isFixed: true,
      isGoogleEvent: true,
      blockType: BLOCK_TYPES.GOOGLE_EVENT,
      canMove: false,
      canResize: false
    };
    
    targetDay.blocks.push(block);
    targetDay.fixedMinutes = (targetDay.fixedMinutes || 0) + duration;
    
    if (startMinutes >= config.dayStart && endMinutes <= config.dayEnd) {
      targetDay.totalScheduledMinutes += duration;
    }
  }
  
  for (const day of days) {
    day.blocks.sort((a, b) => a.startMinute - b.startMinute);
  }
}

// ============================================
// שיבוץ משימות גמישות - מתוקן!
// ============================================

function scheduleFlexibleTasks(sortedTasks, days, todayISO, config) {
  const warnings = [];
  const unscheduledTasks = [];
  
  // ✅ מעקב אחרי הזמן הבא הפנוי בכל יום
  const dayNextAvailable = new Map();
  for (const day of days) {
    if (day.isWorkDay && day.date >= todayISO) {
      dayNextAvailable.set(day.date, config.dayStart);
    }
  }
  
  // שיבוץ כל משימה
  for (const task of sortedTasks) {
    const totalDuration = task.estimated_duration || 30;
    let remainingDuration = totalDuration;
    let blocksCreated = 0;
    
    // מציאת ימים רלוונטיים
    const relevantDays = days.filter(d => {
      if (!d.isWorkDay) return false;
      if (d.date < todayISO) return false;
      if (task.start_date && d.date < task.start_date) return false;
      return true;
    });
    
    // עדיפות ליום ה-due_date אם קיים
    relevantDays.sort((a, b) => {
      if (task.due_date) {
        if (a.date === task.due_date) return -1;
        if (b.date === task.due_date) return 1;
      }
      return a.date.localeCompare(b.date);
    });
    
    for (const day of relevantDays) {
      if (remainingDuration <= 0) break;
      
      // ✅ מציאת חלונות פנויים עם מעקב אחרי הזמן הנוכחי
      const currentStart = dayNextAvailable.get(day.date) || config.dayStart;
      const freeSlots = findFreeSlotsForDay(day, currentStart, config);
      
      for (const slot of freeSlots) {
        if (remainingDuration <= 0) break;
        
        const availableTime = slot.end - slot.start;
        if (availableTime < 15) continue; // מינימום 15 דקות
        
        const blockDuration = Math.min(remainingDuration, availableTime, config.blockDuration);
        
        const block = {
          id: `${task.id}-block-${blocksCreated + 1}`,
          taskId: task.id,
          task: task,
          type: task.task_type || 'other',
          taskType: task.task_type || 'other',
          priority: task.priority || 'normal',
          title: task.title,
          startMinute: slot.start,
          endMinute: slot.start + blockDuration,
          startTime: minutesToTime(slot.start),
          endTime: minutesToTime(slot.start + blockDuration),
          duration: blockDuration,
          dayDate: day.date,
          isFixed: false,
          blockType: BLOCK_TYPES.FLEXIBLE_TASK,
          canMove: true,
          canResize: true,
          blockIndex: blocksCreated + 1,
          totalBlocks: Math.ceil(totalDuration / config.blockDuration)
        };
        
        day.blocks.push(block);
        day.totalScheduledMinutes += blockDuration;
        remainingDuration -= blockDuration;
        blocksCreated++;
        
        // ✅ עדכון הזמן הבא הפנוי ביום
        dayNextAvailable.set(day.date, slot.start + blockDuration + config.breakDuration);
        
        // עדכון ה-slot לבלוק הבא
        slot.start = slot.start + blockDuration + config.breakDuration;
      }
      
      // מיון בלוקים
      day.blocks.sort((a, b) => a.startMinute - b.startMinute);
    }
    
    // אם נשאר זמן לא משובץ
    if (remainingDuration > 0) {
      unscheduledTasks.push(task);
      warnings.push({
        type: 'not_scheduled',
        severity: 'high',
        taskTitle: task.title,
        message: `לא נמצא מקום ל"${task.title}" (${remainingDuration} דק' נותרו)`,
        taskId: task.id
      });
    }
  }
  
  return { warnings, unscheduledTasks };
}

// ============================================
// מציאת חלונות פנויים ביום - מתוקן!
// ============================================

function findFreeSlotsForDay(day, startFrom, config) {
  const slots = [];
  const fixedBlocks = day.blocks.filter(b => b.isFixed || b.isGoogleEvent);
  
  // מיון לפי זמן התחלה
  fixedBlocks.sort((a, b) => a.startMinute - b.startMinute);
  
  let currentStart = Math.max(startFrom, config.dayStart);
  
  for (const block of fixedBlocks) {
    // אם הבלוק הקבוע מתחיל אחרי המיקום הנוכחי
    if (block.startMinute > currentStart) {
      const gapEnd = block.startMinute;
      if (gapEnd - currentStart >= 15) {
        slots.push({ start: currentStart, end: gapEnd });
      }
    }
    // קפיצה לאחרי הבלוק הקבוע
    currentStart = Math.max(currentStart, block.endMinute + config.breakDuration);
  }
  
  // רווח אחרי כל הבלוקים הקבועים
  if (config.dayEnd > currentStart) {
    slots.push({ start: currentStart, end: config.dayEnd });
  }
  
  return slots;
}

// ============================================
// שיבוץ משימות שהושלמו
// ============================================

function scheduleCompletedTasks(completedTasks, days, config) {
  for (const task of completedTasks) {
    const targetDay = days.find(d => d.date === task.due_date);
    if (!targetDay) continue;
    
    const startMinutes = task.due_time ? timeToMinutes(task.due_time) : config.dayStart;
    const duration = task.estimated_duration || 30;
    
    const block = {
      id: `completed-${task.id}`,
      taskId: task.id,
      task: task,
      type: task.task_type || 'other',
      title: `✅ ${task.title}`,
      startMinute: startMinutes,
      endMinute: startMinutes + duration,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(startMinutes + duration),
      duration: duration,
      dayDate: targetDay.date,
      isCompleted: true
    };
    
    targetDay.blocks.push(block);
  }
}

// ============================================
// יצירת המלצות
// ============================================

function generateRecommendations(days, schedulingResult, config) {
  const recommendations = [];
  
  const workDays = days.filter(d => d.isWorkDay);
  const avgLoad = workDays.reduce((sum, d) => sum + (d.totalScheduledMinutes || 0), 0) / workDays.length;
  
  const overloadedDays = workDays.filter(d => d.totalScheduledMinutes > avgLoad * 1.3);
  const lightDays = workDays.filter(d => d.totalScheduledMinutes < avgLoad * 0.5 && d.totalScheduledMinutes > 0);
  
  if (overloadedDays.length > 0 && lightDays.length > 0) {
    recommendations.push({
      type: 'rebalance',
      priority: 'high',
      title: '⚖️ איזון עומס',
      message: `יש ${overloadedDays.length} ימים עמוסים ו-${lightDays.length} ימים קלים`,
      action: {
        type: 'auto_rebalance',
        label: 'אזן אוטומטית',
        fromDays: overloadedDays.map(d => d.date),
        toDays: lightDays.map(d => d.date)
      }
    });
  }
  
  if (schedulingResult.unscheduledTasks.length > 0) {
    recommendations.push({
      type: 'unscheduled',
      priority: 'high',
      title: '⚠️ משימות ללא מקום',
      message: `${schedulingResult.unscheduledTasks.length} משימות לא נכנסות ללוח הזמנים`,
      tasks: schedulingResult.unscheduledTasks
    });
  }
  
  return recommendations;
}

// ============================================
// פונקציות עזר
// ============================================

function initializeDays(weekStart, config) {
  const days = [];
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    date.setHours(12, 0, 0, 0);
    
    const dateISO = toLocalISODate(date);
    const dayOfWeek = date.getDay();
    const dayConfig = WORK_HOURS[dayOfWeek];
    const isWorkDay = dayConfig?.enabled || false;
    
    days.push({
      date: dateISO,
      dayName: dayConfig?.name || dayNames[dayOfWeek] || '',
      dayOfWeek,
      isWorkDay,
      isWeekend: dayOfWeek === 5 || dayOfWeek === 6,
      blocks: [],
      fixedMinutes: 0,
      totalScheduledMinutes: 0,
      suggestedBreaks: [],
      workHours: isWorkDay ? { start: 8, end: 16 } : null
    });
  }
  
  return days;
}

function prioritizeTasks(tasks, todayISO) {
  return [...tasks].sort((a, b) => {
    // 1. אינטרוולים של אותו הורה - לפי מספר
    if (a.parent_task_id && b.parent_task_id && a.parent_task_id === b.parent_task_id) {
      const aMatch = a.title.match(/\((\d+)\/\d+\)/);
      const bMatch = b.title.match(/\((\d+)\/\d+\)/);
      if (aMatch && bMatch) {
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      }
    }
    
    // 2. משימות באיחור קודם
    const aOverdue = a.due_date && a.due_date < todayISO;
    const bOverdue = b.due_date && b.due_date < todayISO;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // 3. לפי עדיפות
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // 4. לפי תאריך יעד
    if (a.due_date && b.due_date) {
      const dateCmp = a.due_date.localeCompare(b.due_date);
      if (dateCmp !== 0) return dateCmp;
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    return 0;
  });
}

function calculateStats(days, schedulingResult, config) {
  const workDays = days.filter(d => d.isWorkDay);
  const totalAvailable = workDays.length * (config.dayEnd - config.dayStart);
  const totalScheduled = workDays.reduce((sum, d) => sum + d.totalScheduledMinutes, 0);
  const totalFixed = workDays.reduce((sum, d) => sum + (d.fixedMinutes || 0), 0);
  
  return {
    totalScheduledMinutes: totalScheduled,
    totalAvailableMinutes: totalAvailable,
    totalFixedMinutes: totalFixed,
    totalFlexibleMinutes: totalScheduled - totalFixed,
    usagePercent: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0,
    fixedPercent: totalScheduled > 0 ? Math.round((totalFixed / totalScheduled) * 100) : 0,
    workDaysCount: workDays.length,
    overloadDays: workDays.filter(d => d.totalScheduledMinutes > (config.dayEnd - config.dayStart)).length,
    warningsCount: schedulingResult.warnings.length,
    unscheduledCount: schedulingResult.unscheduledTasks.length
  };
}

function formatDayForOutput(day, config) {
  const dayCapacity = day.isWorkDay ? (config.dayEnd - config.dayStart) : 0;
  
  const sortedBlocks = [...(day.blocks || [])].sort((a, b) => {
    if (a.startMinute === b.startMinute) {
      if (a.isFixed && !b.isFixed) return -1;
      if (!a.isFixed && b.isFixed) return 1;
    }
    return a.startMinute - b.startMinute;
  });
  
  return {
    ...day,
    blocks: sortedBlocks,
    scheduledBlocks: sortedBlocks,
    usagePercent: dayCapacity > 0 ? Math.round((day.totalScheduledMinutes / dayCapacity) * 100) : 0,
    freeMinutes: Math.max(0, dayCapacity - day.totalScheduledMinutes),
    scheduledMinutes: day.totalScheduledMinutes,
    availableMinutes: dayCapacity
  };
}

function createEmptyWeekPlan(weekStartISO, days) {
  return {
    weekStart: weekStartISO,
    days: days.map(d => formatDayForOutput(d, SMART_SCHEDULE_CONFIG)),
    summary: { totalScheduledMinutes: 0, totalAvailableMinutes: 0, usagePercent: 0 },
    warnings: [],
    unscheduledTasks: [],
    recommendations: [],
    isPastWeek: true
  };
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// ============================================
// ייצוא
// ============================================

export default {
  smartScheduleWeekV4,
  SMART_SCHEDULE_CONFIG,
  BLOCK_TYPES
};
