/**
 * ניהול אינטרוולים של משימות
 * ================================
 * 
 * כשמשימה ארוכה מ-45 דקות, היא מתפצלת לאינטרוולים של 45 דקות.
 * כל אינטרוול הוא משימה נפרדת עם parent_task_id שמצביע על המשימה המקורית.
 * 
 * כשמסמנים אינטרוול כהושלם - רק הוא מסומן.
 * כשכל האינטרוולים הושלמו - המשימה ההורית מסומנת אוטומטית.
 */

import { supabase } from './supabase';

// קונפיגורציה
const CONFIG = {
  INTERVAL_DURATION: 45,  // אורך כל אינטרוול בדקות
  MIN_DURATION_TO_SPLIT: 46  // מינימום דקות לפיצול (יותר מאינטרוול אחד)
};

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
  
  // אם המשימה קצרה - יוצרים רגיל בלי פיצול
  if (duration < CONFIG.MIN_DURATION_TO_SPLIT) {
    const { data, error } = await supabase
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
        estimated_duration: duration || null,
        task_type: task.task_type || 'other',
        task_parameter: task.task_parameter || null,
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
  
  console.log(`🔄 יוצר משימה עם ${numIntervals} אינטרוולים של ~${baseIntervalDuration} דקות`);
  
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
  
  // אם יש שעה מוגדרת - משתמשים בה, אחרת משתמשים בשעה הנוכחית
  let currentTime;
  if (task.due_time) {
    currentTime = parseTime(task.due_time);
    console.log('⏰ משתמש בשעה מוגדרת:', task.due_time);
  } else {
    // שעה נוכחית + עיגול ל-5 דקות
    currentTime = { 
      hours: now.getHours(), 
      minutes: Math.ceil(now.getMinutes() / 5) * 5 
    };
    // אם עברנו שעה - מתקנים
    if (currentTime.minutes >= 60) {
      currentTime.hours++;
      currentTime.minutes = 0;
    }
    console.log('⏰ משתמש בשעה נוכחית:', formatTime(currentTime));
  }
  
  let currentDate = task.due_date || now.toISOString().split('T')[0];
  console.log('📅 תאריך:', currentDate);
  
  for (let i = 0; i < numIntervals; i++) {
    // אורך האינטרוול הנוכחי
    const intervalDuration = baseIntervalDuration + (i < remainder ? 1 : 0);
    
    // חישוב זמן סיום
    const endTime = addMinutes(currentTime, intervalDuration);
    
    // בדיקה אם עוברים את סוף יום העבודה (16:00)
    if (endTime.hours >= 16 && i < numIntervals - 1) {
      // עוברים ליום הבא
      currentDate = getNextWorkDay(currentDate);
      currentTime = { hours: 9, minutes: 0 };
    }
    
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
      is_project: false,
      parent_task_id: parentTask.id,  // קישור להורה
      is_completed: false
    };
    
    intervals.push(intervalData);
    
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
  
  console.log(`✅ נוצרו ${createdIntervals.length} אינטרוולים למשימה "${task.title}"`);
  
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
    
    console.log(`✅ כל האינטרוולים הושלמו - המשימה ההורית סומנה כהושלמה`);
    return { interval, parentCompleted: true, parentId: interval.parent_task_id };
  }
  
  const completedCount = siblings.filter(s => s.is_completed).length;
  console.log(`✅ אינטרוול ${completedCount}/${siblings.length} הושלם`);
  
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
  
  return date.toISOString().split('T')[0];
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
