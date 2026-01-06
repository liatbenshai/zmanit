/**
 * מערכת דחייה אוטומטית של משימות
 * 
 * כשאין מספיק זמן להיום - מעביר משימות אוטומטית למחר
 * כשמתפנה זמן - מושך משימות ממחר להיום
 * 
 * ✅ תומך בהפרדה בין משימות עבודה למשימות בית
 */

// שעות עבודה
const WORK_HOURS = {
  start: 8.5,   // 08:30
  end: 16,      // 16:00
  totalMinutes: 450 // 7:30 שעות
};

// שעות בית
const HOME_HOURS = {
  start: 16.5,  // 16:30
  end: 21,      // 21:00
  totalMinutes: 270 // 4:30 שעות
};

// קטגוריות שנחשבות "בית"
const HOME_CATEGORIES = ['home', 'family', 'personal'];

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
 * חישוב כמה דקות נשארו להיום - לפי סוג לוח זמנים
 * @param {string} scheduleType - 'work' או 'home'
 */
function getRemainingMinutesToday(scheduleType = 'work') {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.getDay();
  
  // שישי-שבת
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    if (scheduleType === 'home') {
      return 8 * 60; // גמיש - 8 שעות
    }
    return 0; // אין שעות עבודה בסופ"ש
  }
  
  const hours = scheduleType === 'home' ? HOME_HOURS : WORK_HOURS;
  const startMinutes = hours.start * 60;
  const endMinutes = hours.end * 60;
  
  // אם לפני תחילת הטווח - מחזירים את כל הטווח
  if (currentMinutes < startMinutes) {
    return endMinutes - startMinutes;
  }
  
  // אם אחרי סוף הטווח - מחזירים 0
  if (currentMinutes >= endMinutes) {
    return 0;
  }
  
  // באמצע - מחזירים מה שנשאר
  return endMinutes - currentMinutes;
}

/**
 * בדיקה אם משימה היא משימת בית
 */
function isHomeTask(task) {
  const category = task.category || task.task_category;
  if (category && HOME_CATEGORIES.includes(category)) {
    return true;
  }
  // בדיקה לפי סוג המשימה אם אין קטגוריה
  const taskType = task.task_type || '';
  if (['family', 'home', 'personal', 'shopping', 'errands'].includes(taskType)) {
    return true;
  }
  return false;
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
 * ✅ חדש: מפריד בין משימות עבודה למשימות בית
 */
export function calculateAutoReschedule(tasks, editTask) {
  const now = new Date();
  const today = toLocalISODate(now);
  const tomorrow = toLocalISODate(getNextWorkday(now));
  const dayOfWeek = now.getDay();
  
  // בשישי-שבת - אין התראות על משימות עבודה
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  
  // סינון משימות - רק משימות "רגילות", לא פרויקטים גדולים, לא הורים עם אינטרוולים
  // ✅ חדש: מפרידים בין עבודה לבית
  const todayTasks = tasks.filter(t => 
    !t.is_completed && 
    !isProjectTask(t) && 
    !isParentWithIntervals(t, tasks) && 
    (t.due_date === today || t.start_date === today)
  );
  
  // ✅ חדש: מפרידים לפי סוג
  const todayWorkTasks = todayTasks.filter(t => !isHomeTask(t));
  const todayHomeTasks = todayTasks.filter(t => isHomeTask(t));
  
  const tomorrowTasks = tasks.filter(t => 
    !t.is_completed && 
    !isProjectTask(t) && 
    !isParentWithIntervals(t, tasks) && 
    (t.due_date === tomorrow || t.start_date === tomorrow)
  );
  
  const tomorrowWorkTasks = tomorrowTasks.filter(t => !isHomeTask(t));
  
  // ✅ חדש: חישוב זמן פנוי לפי סוג
  const remainingWorkToday = isWeekend ? 0 : getRemainingMinutesToday('work');
  const remainingHomeToday = getRemainingMinutesToday('home');
  
  // ✅ תיקון מלא: לוגיקה חדשה להעברת משימות למחר
  // 1. חישוב סך כל הזמן הדרוש
  // 2. חישוב כמה זמן חסר
  // 3. מיון מהפחות דחוף לדחוף
  // 4. העברה למחר עד שמכסים את הזמן החסר
  
  // חישוב סך הזמן הדרוש לכל משימות העבודה
  let totalTimeNeeded = 0;
  todayWorkTasks.forEach(task => {
    if (!isTimerRunning(task.id)) {
      totalTimeNeeded += getRemainingTaskTime(task);
    }
  });
  
  // כמה זמן חסר?
  const timeOverflow = Math.max(0, totalTimeNeeded - remainingWorkToday);
  
  const tasksToMoveToTomorrow = [];
  const tasksToKeepToday = [];
  
  // ✅ חדש: זיהוי אינטרוולים לפי מספר
  const getIntervalInfo = (task) => {
    const match = task.title?.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      return { index: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return null;
  };
  
  // ✅ קיבוץ משימות: רגילות בנפרד, אינטרוולים לפי הורה
  const regularTasks = [];
  const intervalsByParent = new Map(); // parent_id -> [tasks sorted by index]
  
  todayWorkTasks.forEach(task => {
    if (task.parent_task_id) {
      const parentId = task.parent_task_id;
      if (!intervalsByParent.has(parentId)) {
        intervalsByParent.set(parentId, []);
      }
      intervalsByParent.get(parentId).push(task);
    } else {
      regularTasks.push(task);
    }
  });
  
  // מיון אינטרוולים לפי סדר המספור
  intervalsByParent.forEach((intervals, parentId) => {
    intervals.sort((a, b) => {
      const aInfo = getIntervalInfo(a);
      const bInfo = getIntervalInfo(b);
      return (aInfo?.index || 0) - (bInfo?.index || 0);
    });
  });
  
  // ✅ תיקון: אם יש זמן חסר - להעביר משימות למחר
  if (timeOverflow > 0) {
    // מיון משימות רגילות מהפחות דחוף לדחוף - כדי להעביר את הפחות דחופות קודם
    const sortedRegularForRemoval = [...regularTasks].sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      // normal קודם (יועבר למחר), urgent אחרון (יישאר)
      return bPriority - aPriority;
    });
    
    let timeFreed = 0;
    
    // העברת משימות רגילות למחר עד שמכסים את הזמן החסר
    sortedRegularForRemoval.forEach(task => {
      // משימות עם טיימר רץ - תמיד נשארות
      if (isTimerRunning(task.id)) {
        tasksToKeepToday.push(task);
        return;
      }
      
      // משימות דחופות - תמיד נשארות (גם אם אין מקום!)
      if (task.priority === 'urgent') {
        tasksToKeepToday.push(task);
        return;
      }
      
      const taskTime = getRemainingTaskTime(task);
      
      // אם עדיין צריך לפנות זמן - מעבירים למחר
      if (timeFreed < timeOverflow) {
        tasksToMoveToTomorrow.push(task);
        timeFreed += taskTime;
      } else {
        tasksToKeepToday.push(task);
      }
    });
    
    // ✅ טיפול באינטרוולים - להעביר מהסוף אם צריך
    intervalsByParent.forEach((intervals, parentId) => {
      // עוברים מהסוף להתחלה (האחרונים יועברו קודם)
      const reversedIntervals = [...intervals].reverse();
      
      reversedIntervals.forEach(task => {
        if (isTimerRunning(task.id)) {
          tasksToKeepToday.push(task);
          return;
        }
        
        const taskTime = getRemainingTaskTime(task);
        
        if (timeFreed < timeOverflow) {
          tasksToMoveToTomorrow.push(task);
          timeFreed += taskTime;
        } else {
          tasksToKeepToday.push(task);
        }
      });
    });
    
  } else {
    // אין זמן חסר - כל המשימות נשארות להיום
    regularTasks.forEach(task => tasksToKeepToday.push(task));
    intervalsByParent.forEach(intervals => {
      intervals.forEach(task => tasksToKeepToday.push(task));
    });
  }
  
  // חישוב הזמן שצריך היום (רק מה שנשאר)
  let timeNeededToday = 0;
  tasksToKeepToday.forEach(task => {
    timeNeededToday += getRemainingTaskTime(task);
  });
  
  // חישוב זמן פנוי שנשאר אחרי המשימות שנשארו
  const freeTimeToday = remainingWorkToday - timeNeededToday;
  
  // ✅ חדש: חישוב משימות שחורגות מסוף יום העבודה (16:00)
  // אלה משימות שנשארות להיום אבל זמן הסיום שלהן עובר את 16:00
  const WORK_END_MINUTES = 16 * 60; // 16:00
  const tasksOverflowingEndOfDay = [];
  
  tasksToKeepToday.forEach(task => {
    if (task.due_time) {
      const [h, m] = task.due_time.split(':').map(Number);
      const startMinutes = h * 60 + (m || 0);
      const endMinutes = startMinutes + getRemainingTaskTime(task);
      
      // אם המשימה מסתיימת אחרי 16:00 - היא חורגת
      if (endMinutes > WORK_END_MINUTES) {
        tasksOverflowingEndOfDay.push({
          ...task,
          startMinutes,
          endMinutes,
          overflowMinutes: endMinutes - WORK_END_MINUTES
        });
      }
    }
  });
  
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
    remainingWorkToday,
    timeNeededToday,
    freeTimeToday,
    tasksToMoveToTomorrow,
    tasksToMoveToToday,
    tasksToKeepToday,
    tasksOverflowingEndOfDay  // ✅ חדש: משימות שחורגות מ-16:00
  };
}

/**
 * ביצוע הדחיות האוטומטיות
 * ✅ תיקון: שומר את כל נתוני המשימה המקוריים
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
        // ✅ שומר את כל הנתונים המקוריים
        title: task.title,
        description: task.description,
        quadrant: task.quadrant,
        estimated_duration: task.estimated_duration,
        task_type: task.task_type,
        task_parameter: task.task_parameter,
        priority: task.priority,
        reminder_minutes: task.reminder_minutes,
        // ✅ משנה רק את התאריכים
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
        // ✅ שומר את כל הנתונים המקוריים
        title: task.title,
        description: task.description,
        quadrant: task.quadrant,
        estimated_duration: task.estimated_duration,
        task_type: task.task_type,
        task_parameter: task.task_parameter,
        priority: task.priority,
        reminder_minutes: task.reminder_minutes,
        // ✅ משנה רק את התאריכים
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
