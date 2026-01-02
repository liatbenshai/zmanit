/**
 * מנוע שיבוץ חכם - גרסה 4 (עם DEBUG)
 * =====================================
 * 
 * 🆕 חדש בגרסה 4:
 * 1. אירועי גוגל = בלוקים קבועים (לא ניתנים להזזה!)
 * 2. משימות המערכת = גמישות (מתאימות סביב הקבועים)
 * 3. המלצות חכמות לפיזור ואיזון
 * 4. תזכורות להפסקות
 * 5. מעקב אחר מספור רציף של אינטרוולים
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
  
  // הפסקות מומלצות
  breakReminders: {
    afterMinutes: 90,         // תזכורת להפסקה כל 90 דקות
    breakLength: 10,          // אורך הפסקה מומלץ
    lunchStart: 12 * 60,      // 12:00
    lunchEnd: 13 * 60,        // 13:00
    lunchLength: 30           // הפסקת צהריים מומלצת
  },
  
  // סוגי משימות לבוקר
  morningTaskTypes: ['transcription', 'תמלול'],
  
  // זמן עבודה נטו ביום (בדקות)
  get workMinutesPerDay() {
    return this.dayEnd - this.dayStart;
  },
  
  // כמה בלוקים מקסימום ביום
  get maxBlocksPerDay() {
    return Math.floor(this.workMinutesPerDay / (this.blockDuration + this.breakDuration));
  }
};

// ============================================
// סוגי בלוקים
// ============================================

export const BLOCK_TYPES = {
  GOOGLE_EVENT: 'google_event',     // אירוע מגוגל - קבוע!
  FLEXIBLE_TASK: 'flexible_task',   // משימה גמישה
  BREAK: 'break',                   // הפסקה
  LUNCH: 'lunch'                    // הפסקת צהריים
};

// ============================================
// פונקציה ראשית - שיבוץ שבועי משופר
// ============================================

/**
 * שיבוץ חכם לשבוע עם תמיכה באירועים קבועים
 * @param {Date} weekStart - תחילת השבוע (יום ראשון)
 * @param {Array} allTasks - כל המשימות
 * @returns {Object} תוכנית שבועית עם המלצות
 */
export function smartScheduleWeekV4(weekStart, allTasks) {
  console.log('🚀 smartScheduleWeekV4 CALLED!', { weekStart, taskCount: allTasks?.length });
  
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
  
  console.log('📊 CATEGORIZED TASKS:', {
    googleEvents: googleEvents.length,
    flexibleTasks: flexibleTasks.length,
    completedTasks: completedTasks.length
  });
  
  // DEBUG: הצגת אירועי גוגל
  if (googleEvents.length > 0) {
    console.log('📅 GOOGLE EVENTS:', googleEvents.map(e => ({
      title: e.title,
      date: e.due_date,
      time: e.due_time,
      duration: e.estimated_duration,
      google_event_id: e.google_event_id,
      is_from_google: e.is_from_google,
      is_fixed: e.is_fixed
    })));
  } else {
    console.warn('⚠️ NO GOOGLE EVENTS FOUND! Check if tasks have google_event_id or is_from_google=true');
  }
  
  // שלב 4: שיבוץ אירועי גוגל קודם (הם קבועים!)
  scheduleGoogleEvents(googleEvents, days, config);
  
  // DEBUG: הצגת מה שובץ
  const todayDay = days.find(d => d.date === todayISO);
  if (todayDay) {
    console.log('📍 TODAY BLOCKS AFTER GOOGLE:', todayDay.blocks.map(b => ({
      title: b.title,
      start: b.startTime,
      end: b.endTime,
      isFixed: b.isFixed,
      isGoogleEvent: b.isGoogleEvent
    })));
  }
  
  // שלב 5: הוספת הפסקות מומלצות
  addBreakSuggestions(days, config);
  
  // שלב 6: שיבוץ משימות גמישות סביב האירועים הקבועים
  const sortedTasks = prioritizeTasks(flexibleTasks, todayISO);
  const schedulingResult = scheduleFlexibleTasks(sortedTasks, days, todayISO, config);
  
  // DEBUG: הצגת התוצאה הסופית להיום
  if (todayDay) {
    console.log('📍 TODAY FINAL BLOCKS:', todayDay.blocks.map(b => ({
      title: b.title,
      start: b.startTime,
      end: b.endTime,
      isFixed: b.isFixed,
      isGoogleEvent: b.isGoogleEvent
    })));
  }
  
  // שלב 7: שיבוץ משימות שהושלמו (לתצוגה)
  scheduleCompletedTasks(completedTasks, days, config);
  
  // שלב 8: יצירת המלצות לשיפור
  const recommendations = generateRecommendations(days, schedulingResult, config);
  
  // שלב 9: חישוב סטטיסטיקות
  const stats = calculateStats(days, schedulingResult, config);
  
  console.log('✅ smartScheduleWeekV4 DONE!', { 
    warnings: schedulingResult.warnings.length,
    unscheduled: schedulingResult.unscheduledTasks.length 
  });
  
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
    // לא מציגים משימות-הורה
    if (task.is_project) continue;
    
    // משימות שהושלמו
    if (task.is_completed) {
      if (task.due_date && task.due_date >= weekStartISO && task.due_date <= weekEndISO) {
        completedTasks.push(task);
      }
      continue;
    }
    
    // אירועי גוגל = קבועים!
    if (task.is_from_google || task.google_event_id) {
      googleEvents.push({
        ...task,
        isFixed: true,
        blockType: BLOCK_TYPES.GOOGLE_EVENT
      });
      continue;
    }
    
    // כל השאר = משימות גמישות
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
    if (!event.due_date || !event.due_time) {
      console.warn('⚠️ Google event missing date/time:', event.title, { due_date: event.due_date, due_time: event.due_time });
      continue;
    }
    
    const targetDay = days.find(d => d.date === event.due_date);
    if (!targetDay) {
      console.warn('⚠️ No target day for Google event:', event.title, event.due_date);
      continue;
    }
    
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
      startTime: event.due_time,
      endTime: minutesToTime(endMinutes),
      duration: duration,
      dayDate: targetDay.date,
      isFixed: true,
      isGoogleEvent: true,
      isFromGoogle: true,  // נוסף לתאימות
      blockType: BLOCK_TYPES.GOOGLE_EVENT,
      canMove: false,  // לא ניתן להזיז!
      canResize: false // לא ניתן לשנות גודל!
    };
    
    targetDay.blocks.push(block);
    targetDay.fixedMinutes = (targetDay.fixedMinutes || 0) + duration;
    
    // אם בתוך שעות העבודה - מעדכנים את הזמן המשובץ
    if (startMinutes >= config.dayStart && endMinutes <= config.dayEnd) {
      targetDay.totalScheduledMinutes += duration;
    }
    
    console.log('✅ Scheduled Google event:', event.title, `${event.due_time}-${minutesToTime(endMinutes)}`);
  }
  
  // מיון בלוקים לפי שעה
  for (const day of days) {
    day.blocks.sort((a, b) => a.startMinute - b.startMinute);
  }
}

// ============================================
// הוספת הפסקות מומלצות
// ============================================

function addBreakSuggestions(days, config) {
  for (const day of days) {
    if (!day.isWorkDay) continue;
    
    // הפסקת צהריים
    const hasLunchBlock = day.blocks.some(b => 
      b.startMinute < config.breakReminders.lunchEnd && 
      b.endMinute > config.breakReminders.lunchStart
    );
    
    if (!hasLunchBlock) {
      day.suggestedBreaks = day.suggestedBreaks || [];
      day.suggestedBreaks.push({
        type: BLOCK_TYPES.LUNCH,
        title: '🍽️ הפסקת צהריים מומלצת',
        startMinute: config.breakReminders.lunchStart,
        endMinute: config.breakReminders.lunchStart + config.breakReminders.lunchLength,
        startTime: minutesToTime(config.breakReminders.lunchStart),
        endTime: minutesToTime(config.breakReminders.lunchStart + config.breakReminders.lunchLength),
        isSuggestion: true
      });
    }
  }
}

// ============================================
// שיבוץ משימות גמישות
// ============================================

function scheduleFlexibleTasks(sortedTasks, days, todayISO, config) {
  const taskProgress = new Map();
  const warnings = [];
  const unscheduledTasks = [];
  
  // אתחול התקדמות
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
    scheduleFlexibleTask(task, days, taskProgress, todayISO, config);
  }
  
  // איסוף משימות שלא שובצו
  for (const [taskId, progress] of taskProgress) {
    if (progress.remaining > 0) {
      unscheduledTasks.push(progress.task);
      warnings.push({
        type: 'not_scheduled',
        severity: 'high',
        message: `לא נמצא מקום ל"${progress.task.title}" (${progress.remaining} דק' נותרו)`,
        taskId,
        suggestedAction: 'move_to_next_week'
      });
    }
  }
  
  return { taskProgress, warnings, unscheduledTasks };
}

function scheduleFlexibleTask(task, days, taskProgress, todayISO, config) {
  const progress = taskProgress.get(task.id);
  if (!progress) return;
  
  // מציאת ימים רלוונטיים
  const relevantDays = days.filter(d => {
    if (!d.isWorkDay) return false;
    if (d.date < todayISO) return false;
    if (task.start_date && d.date < task.start_date) return false;
    return true;
  });
  
  // שיבוץ
  for (const day of relevantDays) {
    if (progress.remaining <= 0) break;
    
    // מציאת חלונות פנויים (לא חוסמים את הקבועים!)
    const freeSlots = findFreeSlotsAroundFixed(day, config);
    
    console.log(`📊 Free slots for ${day.date}:`, freeSlots.map(s => `${minutesToTime(s.start)}-${minutesToTime(s.end)}`));
    
    for (const slot of freeSlots) {
      if (progress.remaining <= 0) break;
      
      const availableTime = slot.end - slot.start;
      const blockDuration = Math.min(progress.remaining, availableTime, config.blockDuration);
      
      if (blockDuration >= 15) { // מינימום 15 דקות
        const block = {
          id: `${task.id}-block-${progress.blocks.length + 1}`,
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
          canResize: true
        };
        
        day.blocks.push(block);
        progress.blocks.push(block);
        progress.scheduled += blockDuration;
        progress.remaining -= blockDuration;
        day.totalScheduledMinutes += blockDuration;
        
        // עדכון הסלוט - הזזת תחילתו
        slot.start += blockDuration + config.breakDuration;
      }
    }
    
    // מיון בלוקים
    day.blocks.sort((a, b) => a.startMinute - b.startMinute);
  }
}

// ============================================
// מציאת חלונות פנויים סביב בלוקים קבועים
// ============================================

function findFreeSlotsAroundFixed(day, config) {
  const slots = [];
  const fixedBlocks = day.blocks.filter(b => b.isFixed || b.isGoogleEvent);
  
  console.log(`🔍 Fixed blocks for ${day.date}:`, fixedBlocks.map(b => ({
    title: b.title,
    start: b.startTime,
    end: b.endTime
  })));
  
  // מיון לפי זמן התחלה
  fixedBlocks.sort((a, b) => a.startMinute - b.startMinute);
  
  let currentStart = config.dayStart;
  
  for (const block of fixedBlocks) {
    // רווח לפני הבלוק הקבוע
    if (block.startMinute > currentStart) {
      const gapSize = block.startMinute - currentStart;
      if (gapSize >= 15) {
        slots.push({ start: currentStart, end: block.startMinute });
      }
    }
    currentStart = Math.max(currentStart, block.endMinute + config.breakDuration);
  }
  
  // רווח אחרי כל הבלוקים
  if (config.dayEnd > currentStart) {
    slots.push({ start: currentStart, end: config.dayEnd });
  }
  
  return slots;
}

// ============================================
// שיבוץ משימות שהושלמו (לתצוגה)
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
// יצירת המלצות חכמות
// ============================================

function generateRecommendations(days, schedulingResult, config) {
  const recommendations = [];
  
  // 1. איזון עומס בין ימים
  const workDays = days.filter(d => d.isWorkDay);
  const avgLoad = workDays.reduce((sum, d) => sum + (d.totalScheduledMinutes || 0), 0) / workDays.length;
  
  const overloadedDays = workDays.filter(d => d.totalScheduledMinutes > avgLoad * 1.3);
  const lightDays = workDays.filter(d => d.totalScheduledMinutes < avgLoad * 0.5 && d.totalScheduledMinutes > 0);
  
  if (overloadedDays.length > 0 && lightDays.length > 0) {
    recommendations.push({
      type: 'rebalance',
      priority: 'high',
      title: '⚖️ איזון עומס',
      message: `יש ${overloadedDays.length} ימים עמוסים ו-${lightDays.length} ימים קלים יחסית`,
      action: {
        type: 'auto_rebalance',
        label: 'אזן אוטומטית',
        fromDays: overloadedDays.map(d => d.date),
        toDays: lightDays.map(d => d.date)
      }
    });
  }
  
  // 2. משימות שניתן להקדים
  const tasksWithSlack = [];
  for (const day of workDays) {
    const flexibleBlocks = day.blocks.filter(b => !b.isFixed && !b.isCompleted);
    for (const block of flexibleBlocks) {
      if (block.task?.due_date && block.dayDate < block.task.due_date) {
        tasksWithSlack.push({
          task: block.task,
          currentDay: block.dayDate,
          dueDate: block.task.due_date
        });
      }
    }
  }
  
  if (tasksWithSlack.length > 0) {
    recommendations.push({
      type: 'early_completion',
      priority: 'medium',
      title: '🚀 אפשר להקדים',
      message: `${tasksWithSlack.length} משימות יכולות להיות מושלמות לפני המועד`,
      tasks: tasksWithSlack
    });
  }
  
  // 3. תזכורת להפסקות
  for (const day of workDays) {
    const continuousWork = calculateContinuousWork(day, config);
    if (continuousWork > config.breakReminders.afterMinutes) {
      recommendations.push({
        type: 'break_reminder',
        priority: 'medium',
        title: '☕ מומלץ להוסיף הפסקה',
        message: `ביום ${day.dayName} יש ${Math.round(continuousWork / 60)} שעות עבודה רצופות`,
        day: day.date
      });
    }
  }
  
  // 4. משימות לא משובצות
  if (schedulingResult.unscheduledTasks.length > 0) {
    recommendations.push({
      type: 'unscheduled',
      priority: 'high',
      title: '⚠️ משימות ללא מקום',
      message: `${schedulingResult.unscheduledTasks.length} משימות לא נכנסות ללוח הזמנים`,
      suggestions: [
        'העבירי משימות לשבוע הבא',
        'הארכי את יום העבודה',
        'הורידי עדיפות למשימות פחות דחופות'
      ],
      tasks: schedulingResult.unscheduledTasks
    });
  }
  
  return recommendations;
}

function calculateContinuousWork(day, config) {
  const blocks = day.blocks.filter(b => !b.isCompleted && !b.isSuggestion);
  if (blocks.length === 0) return 0;
  
  blocks.sort((a, b) => a.startMinute - b.startMinute);
  
  let maxContinuous = 0;
  let currentContinuous = 0;
  let lastEnd = config.dayStart;
  
  for (const block of blocks) {
    if (block.startMinute - lastEnd > 15) {
      // יש הפסקה
      maxContinuous = Math.max(maxContinuous, currentContinuous);
      currentContinuous = block.duration;
    } else {
      currentContinuous += block.duration;
    }
    lastEnd = block.endMinute;
  }
  
  return Math.max(maxContinuous, currentContinuous);
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
    
    // 5. לפי שעה
    if (a.due_time && b.due_time) {
      return a.due_time.localeCompare(b.due_time);
    }
    
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
  
  // מיון בלוקים - קבועים קודם, אחר כך לפי זמן
  const sortedBlocks = [...(day.blocks || [])].sort((a, b) => {
    // קבועים קודם באותו זמן
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
