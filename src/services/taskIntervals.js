/**
 * ניהול אינטרוולים של משימות
 * ================================
 * 
 * כשמשימה ארוכה מ-45 דקות, היא מתפצלת לאינטרוולים של 45 דקות.
 * כל אינטרוול הוא משימה נפרדת עם parent_task_id שמצביע על המשימה המקורית.
 * 
 * כשמסמנים אינטרוול כהושלם - רק הוא מסומן.
 * כשכל האינטרוולים הושלמו - המשימה ההורית מסומנת אוטומטית.
 * 
 * ✅ תיקון: שימוש ב-toLocalISODate לתאריכים מקומיים
 */

import { supabase } from './supabase';

// קונפיגורציה
const CONFIG = {
  INTERVAL_DURATION: 45,  // אורך כל אינטרוול בדקות
  MIN_DURATION_TO_SPLIT: 46  // מינימום דקות לפיצול (יותר מאינטרוול אחד)
};

/**
 * ✅ פונקציית עזר: המרת תאריך לפורמט ISO מקומי
 * זה קריטי כי toISOString() מחזיר UTC שיכול להיות יום אחר בישראל
 */
function toLocalISODate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * יצירת משימה עם פיצול אוטומטי לאינטרוולים
 * ==========================================
 * 
 * אם המשימה ארוכה מ-45 דקות, נוצרות משימות-ילד של 45 דקות כל אחת.
 * 
 * @param {Object} task - נתוני המשימה
 * @returns {Object} { parentTask, intervals } - המשימה ההורית ורשימת האינטרוולים
 */
export async function createTaskWithIntervals(task) {
  const duration = task.estimated_duration || 0;
  const blocksForToday = task.blocksForToday; // ✅ כמה בלוקים להיום (מהדיאלוג)
  
  console.log('🔧 createTaskWithIntervals נקראת:', {
    title: task.title,
    due_time: task.due_time,
    due_date: task.due_date,
    duration
  });
  
  // ✅ חדש: טעינת משימות קיימות לבדיקת חפיפות
  const { data: existingTasks, error: fetchError } = await supabase
    .from('tasks')
    .select('id, title, due_date, due_time, estimated_duration, is_completed')
    .eq('user_id', task.user_id)
    .eq('is_completed', false)
    .not('due_time', 'is', null);
  
  console.log('📋 משימות קיימות מ-DB:', existingTasks?.map(t => ({
    title: t.title,
    due_date: t.due_date,
    due_time: t.due_time,
    duration: t.estimated_duration
  })));
  
  if (fetchError) {
    console.error('❌ שגיאה בטעינת משימות:', fetchError);
  }
  
  // ✅ פונקציה למציאת סלוט פנוי
  const findFreeSlot = (targetDate, startFrom, neededDuration) => {
    // מציאת משימות ביום הזה
    const dayTasks = (existingTasks || []).filter(t => t.due_date === targetDate);
    
    console.log(`🔍 findFreeSlot: תאריך=${targetDate}, התחלה=${startFrom}, משך=${neededDuration}`);
    console.log(`📋 משימות ביום הזה:`, dayTasks.map(t => `${t.title} (${t.due_time})`));
    
    // יצירת רשימת זמנים תפוסים
    const occupiedSlots = dayTasks.map(t => {
      const [h, m] = t.due_time.split(':').map(Number);
      const start = h * 60 + (m || 0);
      const end = start + (t.estimated_duration || 30);
      return { start, end, title: t.title };
    }).sort((a, b) => a.start - b.start);
    
    console.log('🕐 סלוטים תפוסים:', occupiedSlots);
    
    let proposedStart = Math.ceil(startFrom / 5) * 5;
    
    for (let attempt = 0; attempt < 50; attempt++) {
      const proposedEnd = proposedStart + neededDuration;
      let hasConflict = false;
      
      for (const slot of occupiedSlots) {
        if (proposedStart < slot.end && proposedEnd > slot.start) {
          console.log(`⚠️ חפיפה עם "${slot.title}" - עובר ל-${slot.end + 5}`);
          proposedStart = slot.end + 5;
          proposedStart = Math.ceil(proposedStart / 5) * 5;
          hasConflict = true;
          break;
        }
      }
      
      if (!hasConflict) {
        console.log(`✅ סלוט פנוי: ${proposedStart} דקות`);
        return proposedStart;
      }
    }
    
    return proposedStart;
  };
  
  // פונקציית עזר - המרת דקות לזמן
  const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  
  // אם המשימה קצרה - יוצרים רגיל בלי פיצול
  if (duration < CONFIG.MIN_DURATION_TO_SPLIT) {
    // ✅ חדש: בדיקה ותיקון due_time אם יש חפיפה
    let finalDueTime = task.due_time;
    if (task.due_time && task.due_date) {
      const [h, m] = task.due_time.split(':').map(Number);
      const requestedStart = h * 60 + (m || 0);
      const freeSlot = findFreeSlot(task.due_date, requestedStart, duration || 30);
      if (freeSlot !== requestedStart) {
        finalDueTime = minutesToTime(freeSlot);
        console.log(`⚠️ חפיפה זוהתה! שונה מ-${task.due_time} ל-${finalDueTime}`);
      }
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        user_id: task.user_id,
        title: task.title,
        description: task.description || null,
        quadrant: task.quadrant || 1,
        start_date: task.start_date || null,
        due_date: task.due_date || null,
        due_time: finalDueTime || null,
        reminder_minutes: task.reminder_minutes || null,
        estimated_duration: duration || null,
        task_type: task.task_type || 'other',
        task_parameter: task.task_parameter || null,
        priority: task.priority || 'normal',
        is_project: false,
        parent_task_id: null,
        is_completed: false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { parentTask: data, intervals: [] };
  }
  
  // חישוב מספר האינטרוולים
  const numIntervals = Math.ceil(duration / CONFIG.INTERVAL_DURATION);
  const baseIntervalDuration = Math.floor(duration / numIntervals);
  const remainder = duration % numIntervals;
  
  if (blocksForToday !== undefined && blocksForToday !== null) {
  }
  
  // יצירת המשימה ההורית (כפרויקט)
  const { data: parentTask, error: parentError } = await supabase
    .from('tasks')
    .insert([{
      user_id: task.user_id,
      title: task.title,
      description: task.description || null,
      quadrant: task.quadrant || 1,
      start_date: task.start_date || null,
      due_date: task.due_date || null,
      due_time: task.due_time || null,
      reminder_minutes: task.reminder_minutes || null,
      estimated_duration: duration,
      task_type: task.task_type || 'other',
      task_parameter: task.task_parameter || null,
      priority: task.priority || 'normal',
      is_project: true,  // סימון כפרויקט כי יש לה ילדים
      parent_task_id: null,
      is_completed: false
    }])
    .select()
    .single();
  
  if (parentError) throw parentError;
  
  // חישוב זמנים לכל אינטרוול
  const intervals = [];
  const now = new Date();
  // ✅ תיקון: שימוש ב-toLocalISODate
  const todayISO = toLocalISODate(now);
  
  // תאריך התחלה - אם יש start_date משתמשים בו, אחרת היום
  let currentDate = task.start_date || task.due_date || todayISO;
  
  // ✅ חדש: ספירת בלוקים שנשבצו להיום
  let blocksScheduledToday = 0;
  const effectiveBlocksForToday = blocksForToday !== undefined && blocksForToday !== null 
    ? blocksForToday 
    : numIntervals; // אם לא צוין - הכל
  
  // אם תאריך ההתחלה הוא בעתיד - מתחילים ב-9:00
  // אם תאריך ההתחלה הוא היום - מתחילים מהשעה הנוכחית
  let currentTime;
  
  // ✅ חדש: בדיקת סוג הקטגוריה
  const taskCategory = task.category || 'work';
  const isHomeTask = taskCategory === 'home' || taskCategory === 'family';
  const dayEndHour = isHomeTask ? 21 : 16;  // שעות בית עד 21:00, עבודה עד 16:00
  const dayStartHour = isHomeTask ? 16.5 : 9;  // בית מ-16:30, עבודה מ-09:00
  
  if (currentDate > todayISO) {
    // תאריך עתידי - מתחילים בתחילת הטווח
    currentTime = { hours: Math.floor(dayStartHour), minutes: (dayStartHour % 1) * 60 };
  } else if (task.due_time) {
    // ✅ תיקון: יש שעה מוגדרת - בודקים חפיפות ומוצאים סלוט פנוי
    const [h, m] = task.due_time.split(':').map(Number);
    const requestedStart = h * 60 + (m || 0);
    const freeSlot = findFreeSlot(currentDate, requestedStart, baseIntervalDuration);
    currentTime = { hours: Math.floor(freeSlot / 60), minutes: freeSlot % 60 };
    console.log('📅 שעת התחלה מבוקשת:', task.due_time, '- סלוט פנוי:', minutesToTime(freeSlot));
  } else {
    // היום - מתחילים מהשעה הנוכחית + עיגול ל-5 דקות
    currentTime = { 
      hours: now.getHours(), 
      minutes: Math.ceil(now.getMinutes() / 5) * 5 
    };
    // אם עברנו שעה - מתקנים
    if (currentTime.minutes >= 60) {
      currentTime.hours++;
      currentTime.minutes = 0;
    }
    
    // ✅ תיקון: בדיקה לפי סוג המשימה
    if (isHomeTask) {
      // משימת בית - אם לפני 16:30, מתחילים ב-16:30
      if (currentTime.hours < 16 || (currentTime.hours === 16 && currentTime.minutes < 30)) {
        currentTime = { hours: 16, minutes: 30 };
      }
      // אם אחרי 21:00, עוברים למחר
      if (currentTime.hours >= dayEndHour) {
        currentDate = getNextDay(currentDate);  // גם שישי-שבת זמינים לבית
        currentTime = { hours: 16, minutes: 30 };
      }
    } else {
      // משימת עבודה - אם אחרי סוף יום העבודה, עוברים למחר
      if (currentTime.hours >= dayEndHour) {
        currentDate = getNextWorkDay(currentDate);
        currentTime = { hours: 9, minutes: 0 };
      }
    }
    
    // ✅ חדש: מציאת סלוט פנוי גם כשאין due_time
    const currentMinutes = currentTime.hours * 60 + currentTime.minutes;
    const freeSlot = findFreeSlot(currentDate, currentMinutes, baseIntervalDuration);
    currentTime = { hours: Math.floor(freeSlot / 60), minutes: freeSlot % 60 };
  }
  
  // ✅ חדש: רשימה דינמית של זמנים תפוסים (כולל אינטרוולים שאנחנו יוצרים)
  const localOccupiedSlots = [];
  
  for (let i = 0; i < numIntervals; i++) {
    // אורך האינטרוול הנוכחי
    const intervalDuration = baseIntervalDuration + (i < remainder ? 1 : 0);
    
    // ✅ חדש: מציאת סלוט פנוי שלא חופף למשימות קיימות או לאינטרוולים שכבר נוצרו
    const currentMinutes = currentTime.hours * 60 + currentTime.minutes;
    
    // בדיקת חפיפות עם משימות קיימות
    const dayTasks = (existingTasks || []).filter(t => t.due_date === currentDate);
    const allOccupied = [
      ...dayTasks.map(t => {
        const [h, m] = t.due_time.split(':').map(Number);
        return { start: h * 60 + (m || 0), end: h * 60 + (m || 0) + (t.estimated_duration || 30) };
      }),
      ...localOccupiedSlots.filter(s => s.date === currentDate)
    ].sort((a, b) => a.start - b.start);
    
    let proposedStart = currentMinutes;
    for (let attempt = 0; attempt < 50; attempt++) {
      const proposedEnd = proposedStart + intervalDuration;
      let hasConflict = false;
      
      for (const slot of allOccupied) {
        if (proposedStart < slot.end && proposedEnd > slot.start) {
          proposedStart = slot.end + 5;
          proposedStart = Math.ceil(proposedStart / 5) * 5;
          hasConflict = true;
          break;
        }
      }
      
      if (!hasConflict) break;
    }
    
    currentTime = { hours: Math.floor(proposedStart / 60), minutes: proposedStart % 60 };
    
    // חישוב זמן סיום
    const endTime = addMinutes(currentTime, intervalDuration);
    
    // ✅ חדש: בדיקה אם עברנו את מכסת הבלוקים להיום
    const isToday = currentDate === todayISO;
    if (isToday && blocksScheduledToday >= effectiveBlocksForToday) {
      // עברנו את המכסה - עוברים ליום הבא
      if (isHomeTask) {
        currentDate = getNextDay(currentDate);
        currentTime = { hours: 16, minutes: 30 };
      } else {
        currentDate = getNextWorkDay(currentDate);
        currentTime = { hours: 9, minutes: 0 };
      }
    }
    
    // ✅ תיקון: בדיקה אם עוברים את סוף היום - לפי סוג המשימה
    if (endTime.hours >= dayEndHour && i < numIntervals - 1) {
      // עוברים ליום הבא
      if (isHomeTask) {
        currentDate = getNextDay(currentDate);
        currentTime = { hours: 16, minutes: 30 };
      } else {
        currentDate = getNextWorkDay(currentDate);
        currentTime = { hours: 9, minutes: 0 };
      }
    }
    
    // ✅ שמירת הסלוט התפוס ברשימה המקומית
    const intervalStart = currentTime.hours * 60 + currentTime.minutes;
    localOccupiedSlots.push({
      date: currentDate,
      start: intervalStart,
      end: intervalStart + intervalDuration
    });
    
    const intervalData = {
      user_id: task.user_id,
      // רק אם יש יותר מאינטרוול אחד - מוסיפים מספור (ורק אם אין כבר)
      title: numIntervals > 1 && !task.title.includes('/')
        ? `${task.title} (${i + 1}/${numIntervals})`
        : task.title,
      description: numIntervals > 1 ? `אינטרוול ${i + 1} מתוך ${numIntervals}` : (task.description || null),
      quadrant: task.quadrant || 1,
      start_date: task.start_date || null,
      due_date: currentDate,
      due_time: formatTime(currentTime),
      reminder_minutes: task.reminder_minutes || null,
      estimated_duration: intervalDuration,
      task_type: task.task_type || 'other',
      task_parameter: task.task_parameter || null,
      priority: task.priority || 'normal',
      is_project: false,
      parent_task_id: parentTask.id,  // קישור להורה
      is_completed: false
    };
    
    intervals.push(intervalData);
    
    // ✅ עדכון ספירה
    if (currentDate === todayISO) {
      blocksScheduledToday++;
    }
    
    // התקדמות לאינטרוול הבא (עם 5 דקות הפסקה)
    currentTime = addMinutes(endTime, 5);
  }
  
  // יצירת כל האינטרוולים
  const { data: createdIntervals, error: intervalsError } = await supabase
    .from('tasks')
    .insert(intervals)
    .select();
  
  if (intervalsError) {
    // אם נכשל - מוחקים את ההורה
    await supabase.from('tasks').delete().eq('id', parentTask.id);
    throw intervalsError;
  }
  
  
  return { parentTask, intervals: createdIntervals };
}

/**
 * השלמת אינטרוול בודד
 * ====================
 * 
 * מסמן את האינטרוול כהושלם.
 * אם כל האינטרוולים של אותה משימה הושלמו - מסמן גם את ההורה.
 * 
 * @param {string} intervalId - מזהה האינטרוול
 * @returns {Object} { interval, parentCompleted } - האינטרוול המעודכן והאם ההורה הושלם
 */
export async function completeInterval(intervalId) {
  // סימון האינטרוול כהושלם
  const { data: interval, error: intervalError } = await supabase
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', intervalId)
    .select()
    .single();
  
  if (intervalError) throw intervalError;
  
  // אם אין הורה - זו משימה רגילה
  if (!interval.parent_task_id) {
    return { interval, parentCompleted: false };
  }
  
  // בדיקה אם כל האחים הושלמו
  const { data: siblings, error: siblingsError } = await supabase
    .from('tasks')
    .select('id, is_completed')
    .eq('parent_task_id', interval.parent_task_id);
  
  if (siblingsError) throw siblingsError;
  
  const allCompleted = siblings.every(s => s.is_completed);
  
  if (allCompleted) {
    // מסמנים את ההורה כהושלם
    const { error: parentError } = await supabase
      .from('tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', interval.parent_task_id);
    
    if (parentError) throw parentError;
    
    return { interval, parentCompleted: true, parentId: interval.parent_task_id };
  }
  
  const completedCount = siblings.filter(s => s.is_completed).length;
  
  return { interval, parentCompleted: false };
}

/**
 * ביטול השלמת אינטרוול
 * ====================
 * 
 * מסיר את סימון ההשלמה מאינטרוול.
 * אם ההורה מסומן כהושלם - מבטל גם אותו.
 * 
 * @param {string} intervalId - מזהה האינטרוול
 * @returns {Object} { interval, parentUncompleted }
 */
export async function uncompleteInterval(intervalId) {
  // ביטול השלמת האינטרוול
  const { data: interval, error: intervalError } = await supabase
    .from('tasks')
    .update({
      is_completed: false,
      completed_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', intervalId)
    .select()
    .single();
  
  if (intervalError) throw intervalError;
  
  // אם אין הורה - זו משימה רגילה
  if (!interval.parent_task_id) {
    return { interval, parentUncompleted: false };
  }
  
  // ביטול השלמת ההורה (אם היה מושלם)
  const { data: parent, error: parentError } = await supabase
    .from('tasks')
    .update({
      is_completed: false,
      completed_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', interval.parent_task_id)
    .eq('is_completed', true)  // רק אם היה מושלם
    .select()
    .single();
  
  // לא שגיאה אם לא נמצא - ההורה פשוט לא היה מושלם
  const parentUncompleted = !parentError && parent;
  
  return { interval, parentUncompleted };
}

/**
 * קבלת כל האינטרוולים של משימה
 * ============================
 * 
 * @param {string} parentTaskId - מזהה המשימה ההורית
 * @returns {Array} רשימת האינטרוולים
 */
export async function getTaskIntervals(parentTaskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', parentTaskId)
    .order('due_time', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * בדיקה אם משימה היא אינטרוול (יש לה הורה)
 */
export function isInterval(task) {
  return !!task.parent_task_id;
}

/**
 * בדיקה אם משימה היא הורה של אינטרוולים
 */
export function hasIntervals(task) {
  return task.is_project && !task.parent_task_id;
}

/**
 * קבלת סטטוס התקדמות של משימה עם אינטרוולים
 * 
 * @param {string} parentTaskId - מזהה המשימה ההורית
 * @returns {Object} { total, completed, percent }
 */
export async function getIntervalProgress(parentTaskId) {
  const intervals = await getTaskIntervals(parentTaskId);
  
  const total = intervals.length;
  const completed = intervals.filter(i => i.is_completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { total, completed, percent, intervals };
}

// === פונקציות עזר ===

function parseTime(timeStr) {
  if (!timeStr) return { hours: 9, minutes: 0 };
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 9, minutes: minutes || 0 };
}

function formatTime({ hours, minutes }) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addMinutes({ hours, minutes }, addMins) {
  const totalMinutes = hours * 60 + minutes + addMins;
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function getNextWorkDay(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  
  // דלג על שישי-שבת (5-6)
  const day = date.getDay();
  if (day === 5) date.setDate(date.getDate() + 2);
  else if (day === 6) date.setDate(date.getDate() + 1);
  
  // ✅ תיקון: שימוש ב-toLocalISODate
  return toLocalISODate(date);
}

/**
 * ✅ חדש: קבלת היום הבא (כולל שישי-שבת) - למשימות בית
 */
function getNextDay(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return toLocalISODate(date);
}

export default {
  createTaskWithIntervals,
  completeInterval,
  uncompleteInterval,
  getTaskIntervals,
  getIntervalProgress,
  isInterval,
  hasIntervals,
  CONFIG
};
