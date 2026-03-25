/**
 * מנוע שיבוץ חכם - גרסה 4 מתוקנת + משודרג
 * ==========================================
 * 
 * תיקון: שעות עבודה נקראות מההגדרות של המשתמש
 * ✅ תמיכה בזמני בית/משפחה
 * ✅ Validation + Error Handling
 * ✅ Centralized Configuration
 */

import { WORK_HOURS, HOME_HOURS, getScheduleByType } from '../config/workSchedule';
import { getTaskType } from '../config/taskTypes';
import { toLocalISODate } from './dateTimeHelpers';
import {
  timeToMinutes,
  minutesToTime,
  findFreeSlots,
  isHomeTask,
  createBlock,
  validateTaskForScheduling,
  calculateDayStats,
  isOverbooked
} from './schedulerHelpers';
import ValidationService from '../services/ValidationService';
import ErrorHandler from '../services/ErrorHandler';
import Logger from '../services/Logger';
import ConfigService from '../services/ConfigService';

// ============================================
// הגדרות ברירת מחדל (משמשות רק אם אין הגדרות)
// ============================================

export const SMART_SCHEDULE_CONFIG = {
  // ברירות מחדל - יידרסו ע"י WORK_HOURS
  defaultDayStart: 8 * 60,      // 08:00
  defaultDayEnd: 16 * 60,       // 16:00
  
  blockDuration: 45,
  breakDuration: 5,
  
  breakReminders: {
    afterMinutes: 90,
    breakLength: 10,
    lunchLength: 30
  },
  
  morningTaskTypes: ['transcription', 'תמלול'],
  
  // ✅ פונקציה לקבלת שעות ליום ספציפי לפי סוג (work/home)
  getDayHours(dayOfWeek, scheduleType = 'work') {
    const schedule = scheduleType === 'home' ? HOME_HOURS : WORK_HOURS;
    const dayConfig = schedule[dayOfWeek];
    if (!dayConfig || !dayConfig.enabled) {
      return null; // יום לא פעיל
    }
    
    // קריאה מההגדרות האמיתיות
    const startHour = dayConfig.start || (scheduleType === 'home' ? 17 : 8);
    const endHour = dayConfig.end || (scheduleType === 'home' ? 21 : 16);
    
    return {
      start: startHour * 60,  // המרה לדקות
      end: endHour * 60,
      startHour,
      endHour,
      flexible: dayConfig.flexible || false
    };
  },
  
  get maxBlocksPerDay() {
    return Math.floor(480 / (this.blockDuration + this.breakDuration)); // ~8 שעות
  }
};

export const BLOCK_TYPES = {
  GOOGLE_EVENT: 'google_event',
  FLEXIBLE_TASK: 'flexible_task',
  BREAK: 'break',
  LUNCH: 'lunch'
};

// ============================================
// Safe Scheduling Entry Point
// ============================================

export async function scheduleWeekSafe(weekStart, allTasks) {
  const startTime = Date.now();
  
  try {
    Logger.info('Starting week scheduling', {
      weekStart: weekStart?.toISOString?.(),
      taskCount: allTasks?.length
    });

    const result = smartScheduleWeekV4(weekStart, allTasks);

    Logger.logPerformance('scheduleWeekSafe', startTime, {
      success: true,
      taskCount: allTasks.length,
      daysScheduled: result.days?.length
    });

    return {
      success: true,
      data: result
    };
  } catch (error) {
    Logger.error('Week scheduling failed', error);

    Logger.logPerformance('scheduleWeekSafe', startTime, {
      success: false,
      error: error.message
    });

    const errorResp = ErrorHandler.handle(error, {
      function: 'scheduleWeekSafe',
      input: { weekStart, taskCount: allTasks?.length }
    });

    return {
      success: false,
      ...errorResp
    };
  }
}

// ============================================
// פונקציה ראשית משודרגת
// ============================================

export function smartScheduleWeekV4(weekStart, allTasks) {
  const startTime = Date.now();
  
  try {
    // === Step 1: Validate inputs ===
    ErrorHandler.assertNotNull(weekStart, 'weekStart');
    ErrorHandler.assertNotNull(allTasks, 'allTasks');
    
    if (!Array.isArray(allTasks)) {
      throw ErrorHandler.createError('allTasks must be an array', 'INVALID_INPUT', { type: typeof allTasks });
    }

    // Validate all tasks
    const taskValidation = ValidationService.validateTasks(allTasks);
    if (!taskValidation.valid && taskValidation.errors.length > 0) {
      Logger.warn('Invalid tasks detected', { errors: taskValidation.errors });
      // Filter out invalid tasks, don't fail
      const validTasks = allTasks.filter((task, index) => {
        return !taskValidation.errors.some(e => e.index === index);
      });
      Logger.info(`Filtered ${allTasks.length - validTasks.length} invalid tasks`);
      allTasks = validTasks;
    }

    const config = SMART_SCHEDULE_CONFIG;
    
    const today = new Date();
    const todayISO = toLocalISODate(today);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndISO = toLocalISODate(weekEnd);
    const weekStartISO = toLocalISODate(weekStart);

    Logger.info('Scheduling week', { weekStart: weekStartISO, weekEnd: weekEndISO, taskCount: allTasks.length });
    
    // שלב 1: יצירת מבנה ימים
    const days = initializeDays(weekStart, config);
    
    // שלב 2: בדיקה אם זה שבוע בעבר
    if (weekEndISO < todayISO) {
      Logger.info('Week is in the past, returning empty plan');
      return createEmptyWeekPlan(weekStartISO, days);
    }
    
    // שלב 3: הפרדת משימות לסוגים
    const { googleEvents, flexibleTasks, completedTasks } = categorizeTasks(allTasks, weekStartISO, weekEndISO, todayISO);
    Logger.debug('Tasks categorized', { google: googleEvents.length, flexible: flexibleTasks.length, completed: completedTasks.length });
    
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

    const result = {
      weekStart: weekStartISO,
      days: days.map(d => formatDayForOutput(d, config)),
      summary: stats,
      warnings: schedulingResult.warnings,
      unscheduledTasks: schedulingResult.unscheduledTasks,
      recommendations,
      isCurrentWeek: weekStartISO <= todayISO && todayISO <= weekEndISO
    };

    Logger.logPerformance('smartScheduleWeekV4', startTime, {
      weekStart: weekStartISO,
      tasksScheduled: schedulingResult.scheduledTasks || 0,
      unscheduledCount: schedulingResult.unscheduledTasks?.length || 0
    });

    return result;
    
  } catch (error) {
    Logger.error('Scheduling failed', error);
    return ErrorHandler.handle(error, {
      function: 'smartScheduleWeekV4',
      input: { weekStart, taskCount: allTasks?.length }
    });
  }
}

// ============================================
// הפרדת משימות לסוגים - משודרגת
// ============================================

function categorizeTasks(allTasks, weekStartISO, weekEndISO, todayISO) {
  try {
    ErrorHandler.assertNotNull(allTasks, 'allTasks');
    ErrorHandler.assert(Array.isArray(allTasks), 'allTasks must be an array');

    const googleEvents = [];
    const flexibleTasks = [];
    const completedTasks = [];
    const seenTaskIds = new Set();
    
    for (const task of allTasks) {
      // Skip invalid tasks
      if (!task || !task.id) {
        Logger.warn('Skipping invalid task', { task });
        continue;
      }
      if (seenTaskIds.has(task.id)) {
        continue;
      }
      seenTaskIds.add(task.id);
      if (task.deleted_at) continue;

      if (task.is_project) continue;
      // תכנון שבועי: מציגים רק משימות עם תאריך יעד עד סוף השבוע (כולל פיגור)
      if (!task.due_date) continue;
      if (task.due_date > weekEndISO) continue;
      // תכנון שבועי: לא מציגים משימות/אירועים מהעבר הרחוק לפני תחילת השבוע
      if (task.due_date < weekStartISO) continue;
      
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

    Logger.debug('Tasks categorization complete', {
      googleEvents: googleEvents.length,
      flexibleTasks: flexibleTasks.length,
      completedTasks: completedTasks.length
    });

    return { googleEvents, flexibleTasks, completedTasks };
  } catch (error) {
    Logger.error('Task categorization failed', error);
    throw ErrorHandler.createError('Failed to categorize tasks', 'CATEGORIZATION_ERROR', { error: error.message });
  }
}

// ============================================
// שיבוץ אירועי גוגל (קבועים!) - משודרג
// ============================================

function scheduleGoogleEvents(googleEvents, days, config) {
  try {
    ErrorHandler.assertNotNull(googleEvents, 'googleEvents');
    ErrorHandler.assertNotNull(days, 'days');
    ErrorHandler.assertNotNull(config, 'config');
    
    ErrorHandler.assert(Array.isArray(googleEvents), 'googleEvents must be an array');
    ErrorHandler.assert(Array.isArray(days), 'days must be an array');

    let successCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const event of googleEvents) {
      try {
        // Validation
        if (!event || !event.id) {
          skippedCount++;
          continue;
        }

        if (!event.due_date || !event.due_time) {
          Logger.debug(`Skipping Google event ${event.id} - missing date/time`);
          skippedCount++;
          continue;
        }

        // Validate time format
        if (!ValidationService.isValidTime(event.due_time)) {
          Logger.warn(`Invalid time format for event ${event.id}: ${event.due_time}`);
          continue;
        }

        const targetDay = days.find(d => d.date === event.due_date);
        if (!targetDay) {
          Logger.debug(`No day found for event ${event.id} on ${event.due_date}`);
          continue;
        }

        // Get valid duration
        const duration = Math.max(1, event.estimated_duration || 60);
        
        // Validate duration
        if (duration > 480) { // Max 8 hours
          Logger.warn(`Event duration too long (${duration}m), capping to 480m`, { eventId: event.id });
        }

        const startMinutes = timeToMinutes(event.due_time);
        
        // Validate start time
        if (startMinutes < 0 || startMinutes > 1440) {
          Logger.warn(`Invalid start minutes ${startMinutes} for event ${event.id}`);
          continue;
        }

        const endMinutes = startMinutes + duration;

        const block = {
          id: `google-${event.id}`,
          taskId: event.id,
          task: event,
          type: event.task_type || 'meeting',
          taskType: event.task_type || 'meeting',
          priority: 'fixed',
          title: `📅 ${event.title || 'Google Event'}`,
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

        // Check for conflicts
        if (ValidationService.hasTimeConflict(startMinutes, endMinutes, targetDay.blocks)) {
          Logger.warn(`Time conflict detected for event ${event.id}`, {
            time: event.due_time,
            date: event.due_date
          });
          // Still add, but mark as conflicted
          block.hasConflict = true;
        }

        targetDay.blocks.push(block);
        targetDay.fixedMinutes = (targetDay.fixedMinutes || 0) + duration;

        // Get day hours
        const dayStart = targetDay.dayStart || config.defaultDayStart;
        const dayEnd = targetDay.dayEnd || config.defaultDayEnd;

        if (startMinutes >= dayStart && endMinutes <= dayEnd) {
          targetDay.totalScheduledMinutes = (targetDay.totalScheduledMinutes || 0) + duration;
        }

        successCount++;
      } catch (eventError) {
        Logger.warn(`Error scheduling Google event ${event?.id}`, eventError);
        errors.push({ eventId: event?.id, error: eventError.message });
      }
    }

    // Sort blocks by start time
    for (const day of days) {
      if (day.blocks && day.blocks.length > 1) {
        day.blocks.sort((a, b) => a.startMinute - b.startMinute);
      }
    }

    Logger.info('Google events scheduled', {
      total: googleEvents.length,
      success: successCount,
      skipped: skippedCount,
      errors: errors.length
    });

    if (errors.length > 0) {
      Logger.warn('Some Google events failed to schedule', { errors });
    }

  } catch (error) {
    Logger.error('Google events scheduling failed', error);
    throw ErrorHandler.createError('Failed to schedule Google events', 'GOOGLE_EVENTS_ERROR', { error: error.message });
  }
}

// ============================================
// שיבוץ משימות גמישות - מתוקן!
// ============================================

function scheduleFlexibleTasks(sortedTasks, days, todayISO, config) {
  const warnings = [];
  const unscheduledTasks = [];
  
  // ✅ קטגוריות שנחשבות כבית/משפחה
  const homeCategories = ['family', 'home', 'kids', 'personal'];
  
  // ✅ פונקציה לבדיקה אם משימה היא בית/משפחה
  const isHomeTask = (task) => {
    // בדיקה ראשונה: קטגוריה ישירה על המשימה
    const category = task.category || '';
    if (homeCategories.includes(category)) {
      return true;
    }
    
    // בדיקה שנייה: קבלת הקטגוריה מתוך הגדרות סוג המשימה
    const taskType = task.task_type || '';
    if (taskType) {
      const typeConfig = getTaskType(taskType);
      if (typeConfig && homeCategories.includes(typeConfig.category)) {
        return true;
      }
    }
    
    return false;
  };
  
  // ✅ מעקב אחרי הזמן הבא הפנוי בכל יום - עבודה ובית בנפרד
  const dayNextAvailableWork = new Map();
  const dayNextAvailableHome = new Map();
  
  for (const day of days) {
    if (day.date >= todayISO) {
      // זמני עבודה
      if (day.isWorkDay) {
        const dayStart = day.dayStart || config.defaultDayStart;
        dayNextAvailableWork.set(day.date, dayStart);
      }
      // זמני בית
      if (day.isHomeDay) {
        const homeStart = day.homeDayStart || 17 * 60;
        dayNextAvailableHome.set(day.date, homeStart);
      }
    }
  }
  
  // שיבוץ כל משימה
  for (const task of sortedTasks) {
    const totalDuration = task.estimated_duration || 30;
    let remainingDuration = totalDuration;
    let blocksCreated = 0;
    
    // ✅ בדיקה אם זו משימת בית/משפחה
    const isHome = isHomeTask(task);
    
    // מציאת ימים רלוונטיים
    const relevantDays = days.filter(d => {
      // ✅ לפי סוג המשימה - בודקים יום עבודה או יום בית
      if (isHome) {
        if (!d.isHomeDay) return false;
      } else {
        if (!d.isWorkDay) return false;
        // לא משבצים עבודת משימות לשבת
        if (d.dayOfWeek === 6) return false;
      }
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
      
      // ✅ מציאת חלונות פנויים לפי סוג המשימה
      const dayNextAvailable = isHome ? dayNextAvailableHome : dayNextAvailableWork;
      const dayStart = isHome ? (day.homeDayStart || 17 * 60) : (day.dayStart || config.defaultDayStart);
      const dayEnd = isHome ? (day.homeDayEnd || 21 * 60) : (day.dayEnd || config.defaultDayEnd);
      
      // ✅ תיקון: אם יש due_time, משתמשים בו כזמן התחלה קבוע!
      let requestedStart = null;
      let isFixedTime = false;
      if (task.due_time && day.date === task.due_date) {
        requestedStart = timeToMinutes(task.due_time);
        isFixedTime = true; // 🔧 משימה עם שעה קבועה - לא לשנות!
      }
      const currentStart = requestedStart || dayNextAvailable.get(day.date) || dayStart;
      
      // 🔧 תיקון מלא: אם יש due_time קבוע - יוצרים את כל הבלוקים ברצף מאותה שעה
      if (isFixedTime && requestedStart !== null) {
        let blockStart = requestedStart;
        
        // יוצרים את כל הבלוקים של המשימה ברצף
        while (remainingDuration > 0) {
          const duration = Math.min(remainingDuration, config.blockDuration);
          const block = {
            id: `${task.id}-block-${blocksCreated + 1}`,
            taskId: task.id,
            task: task,
            type: task.task_type || 'other',
            taskType: task.task_type || 'other',
            category: task.category || (isHome ? 'home' : 'work'),
            priority: task.priority || 'normal',
            title: task.title,
            startMinute: blockStart,
            endMinute: blockStart + duration,
            startTime: minutesToTime(blockStart),
            endTime: minutesToTime(blockStart + duration),
            duration: duration,
            dayDate: day.date,
            isFixed: true, // 🔧 סימון שזו משימה עם שעה קבועה
            isHomeTask: isHome,
            blockType: BLOCK_TYPES.FIXED_TASK,
            canMove: true,
            canResize: true,
            blockIndex: blocksCreated + 1,
            totalBlocks: Math.ceil(totalDuration / config.blockDuration)
          };
          
          day.blocks.push(block);
          day.totalScheduledMinutes += duration;
          remainingDuration -= duration;
          blocksCreated++;
          
          // הבלוק הבא מתחיל מיד אחרי (עם הפסקה קטנה)
          blockStart = blockStart + duration + config.breakDuration;
        }
        
        // עדכון הזמן הבא הפנוי ביום
        dayNextAvailable.set(day.date, blockStart);
        break; // סיימנו עם המשימה הזו - יוצאים מלולאת הימים
      }
      
      const freeSlots = findFreeSlotsForDayWithRange(day, currentStart, dayEnd, config, isHome);
      
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
          category: task.category || (isHome ? 'home' : 'work'),
          priority: task.priority || 'normal',
          title: task.title,
          startMinute: slot.start,
          endMinute: slot.start + blockDuration,
          startTime: minutesToTime(slot.start),
          endTime: minutesToTime(slot.start + blockDuration),
          duration: blockDuration,
          dayDate: day.date,
          isFixed: false,
          isHomeTask: isHome,
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
  
  // ✅ שימוש בשעות היום הספציפי
  const dayStart = day.dayStart || config.defaultDayStart;
  const dayEnd = day.dayEnd || config.defaultDayEnd;
  
  // מיון לפי זמן התחלה
  fixedBlocks.sort((a, b) => a.startMinute - b.startMinute);
  
  let currentStart = Math.max(startFrom, dayStart);
  
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
  if (dayEnd > currentStart) {
    slots.push({ start: currentStart, end: dayEnd });
  }
  
  return slots;
}

/**
 * ✅ פונקציה משופרת למציאת חלונות פנויים - עם תמיכה בטווחי זמן שונים (עבודה/בית)
 */
function findFreeSlotsForDayWithRange(day, startFrom, endAt, config, isHomeTask = false) {
  const slots = [];
  
  // ✅ סינון בלוקים - בודקים רק בלוקים מאותו סוג (עבודה או בית)
  const relevantBlocks = day.blocks.filter(b => {
    if (b.isFixed || b.isGoogleEvent) return true;
    // אם זו משימת בית, בודקים רק בלוקים של בית
    if (isHomeTask) return b.isHomeTask === true;
    // אחרת בודקים רק בלוקים של עבודה
    return b.isHomeTask !== true;
  });
  
  // מיון לפי זמן התחלה
  relevantBlocks.sort((a, b) => a.startMinute - b.startMinute);
  
  let currentStart = Math.max(startFrom, 0);
  
  for (const block of relevantBlocks) {
    // רק בלוקים בטווח הרלוונטי
    if (block.endMinute <= startFrom || block.startMinute >= endAt) continue;
    
    // אם הבלוק מתחיל אחרי המיקום הנוכחי
    if (block.startMinute > currentStart) {
      const gapEnd = Math.min(block.startMinute, endAt);
      if (gapEnd - currentStart >= 15) {
        slots.push({ start: currentStart, end: gapEnd });
      }
    }
    // קפיצה לאחרי הבלוק
    currentStart = Math.max(currentStart, block.endMinute + config.breakDuration);
  }
  
  // רווח אחרי כל הבלוקים עד סוף הטווח
  if (endAt > currentStart) {
    slots.push({ start: currentStart, end: endAt });
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
    
    // ✅ קריאת שעות עבודה
    const workDayConfig = WORK_HOURS[dayOfWeek];
    const isWorkDay = workDayConfig?.enabled || false;
    const workHours = config.getDayHours(dayOfWeek, 'work');
    const workDayStart = workHours?.start || config.defaultDayStart;
    const workDayEnd = workHours?.end || config.defaultDayEnd;
    const workAvailableMinutes = isWorkDay ? (workDayEnd - workDayStart) : 0;
    
    // ✅ קריאת שעות בית/משפחה
    const homeDayConfig = HOME_HOURS[dayOfWeek];
    const isHomeDay = homeDayConfig?.enabled || false;
    const homeHours = config.getDayHours(dayOfWeek, 'home');
    const homeDayStart = homeHours?.start || 17 * 60;
    const homeDayEnd = homeHours?.end || 21 * 60;
    const homeAvailableMinutes = isHomeDay ? (homeDayEnd - homeDayStart) : 0;
    const isFlexibleHomeDay = homeHours?.flexible || false;
    
    days.push({
      date: dateISO,
      dayName: workDayConfig?.name || homeDayConfig?.name || dayNames[dayOfWeek] || '',
      dayOfWeek,
      isWorkDay,
      isHomeDay,
      isWeekend: dayOfWeek === 5 || dayOfWeek === 6,
      blocks: [],
      fixedMinutes: 0,
      totalScheduledMinutes: 0,
      suggestedBreaks: [],
      // ✅ שעות עבודה
      workHours: isWorkDay ? { 
        start: workHours?.startHour || 8, 
        end: workHours?.endHour || 16 
      } : null,
      dayStart: workDayStart,  // בדקות (עבודה)
      dayEnd: workDayEnd,      // בדקות (עבודה)
      availableMinutes: workAvailableMinutes,
      // ✅ שעות בית/משפחה
      homeHours: isHomeDay ? {
        start: homeHours?.startHour || 17,
        end: homeHours?.endHour || 21,
        flexible: isFlexibleHomeDay
      } : null,
      homeDayStart,
      homeDayEnd,
      homeAvailableMinutes
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
    
    // ✅ 5. לפי שעה - משימות עם שעה מוקדמת יותר קודם!
    if (a.due_time && b.due_time) {
      return a.due_time.localeCompare(b.due_time);
    }
    // משימות עם שעה מוגדרת קודם למשימות בלי שעה
    if (a.due_time && !b.due_time) return -1;
    if (!a.due_time && b.due_time) return 1;
    
    return 0;
  });
}

function calculateStats(days, schedulingResult, config) {
  const workDays = days.filter(d => d.isWorkDay);
  
  // ✅ חישוב זמן זמין לפי שעות העבודה האמיתיות של כל יום
  const totalAvailable = workDays.reduce((sum, d) => sum + (d.availableMinutes || 0), 0);
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
    overloadDays: workDays.filter(d => d.totalScheduledMinutes > (d.availableMinutes || 0)).length,
    warningsCount: schedulingResult.warnings.length,
    unscheduledCount: schedulingResult.unscheduledTasks.length
  };
}

function formatDayForOutput(day, config) {
  // ✅ קיבולת יום לפי שעות העבודה האמיתיות
  const dayCapacity = day.availableMinutes || 0;
  
  const sortedBlocks = [...(day.blocks || [])].sort((a, b) => {
    if (a.startMinute === b.startMinute) {
      if (a.isFixed && !b.isFixed) return -1;
      if (!a.isFixed && b.isFixed) return 1;
    }
    return a.startMinute - b.startMinute;
  });

  // דה-דופליקציה: במקרה שנוצר אותו בלוק פעמיים (למשל מאותה משימה),
  // אנחנו משאירות רק מופע אחד כדי לא ליצור כפילויות בתצוגה.
  const seenBlockIds = new Set();
  const dedupedBlocks = [];
  for (const block of sortedBlocks) {
    const id = block?.id;
    const fallbackKey = id
      ? null
      : `${block?.taskId || ''}-${block?.startMinute ?? ''}-${block?.endMinute ?? ''}-${block?.blockType || ''}`;

    const key = id || fallbackKey;
    if (!key) continue;
    if (seenBlockIds.has(key)) continue;
    seenBlockIds.add(key);
    dedupedBlocks.push(block);
  }
  
  return {
    ...day,
    blocks: dedupedBlocks,
    scheduledBlocks: dedupedBlocks,
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

// ============================================
// ייצוא
// ============================================

export default {
  smartScheduleWeekV4,
  SMART_SCHEDULE_CONFIG,
  BLOCK_TYPES
};
