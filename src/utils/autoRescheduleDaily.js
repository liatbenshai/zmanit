/**
 * מערכת דחייה אוטומטית של משימות - גרסה מתוקנת v1.1
 * 
 * כשאין מספיק זמן להיום - מעביר משימות אוטומטית למחר
 * כשמתפנה זמן - מושך משימות ממחר להיום
 * 
 * ✅ תיקונים בגרסה 1.1:
 * 1. תיקון שעות עבודה (16:15 במקום 16:00)
 * 2. שיפור סינון משימות הוריות - לא סופרים אותן!
 * 3. סינון כפול: גם is_project וגם parent_task_id
 */

// ✅ תיקון: שעות עבודה מעודכנות
const WORK_HOURS = {
  start: 8.5,    // 08:30
  end: 16.25,    // 16:15 ✅ תיקון!
  totalMinutes: 465 // 7:45 שעות
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
  
  // שישי-שבת - חישוב דינמי של זמן בית
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    if (scheduleType === 'home') {
      // סופ"ש: 08:00 - 22:00
      const weekendStart = 8 * 60;   // 08:00
      const weekendEnd = 22 * 60;    // 22:00
      
      if (currentMinutes < weekendStart) {
        return weekendEnd - weekendStart; // כל היום
      }
      if (currentMinutes >= weekendEnd) {
        return 0;
      }
      return weekendEnd - currentMinutes; // מה שנשאר
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
  // רשימה מלאה של סוגי משימות בית/משפחה
  const taskType = task.task_type || '';
  const homeTaskTypes = [
    'family', 'home', 'personal', 'shopping', 'errands',
    // משפחה
    'shaked', 'dor', 'ava', 'yaron',
    // בית
    'cleaning', 'cooking', 'laundry'
  ];
  if (homeTaskTypes.includes(taskType)) {
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
 * ✅ תיקון v1.1: בדיקה משופרת אם משימה היא "הורה" שלא צריך לספור
 * משימה היא הורה אם:
 * 1. יש לה is_project: true
 * 2. או שיש לה ילדים עם parent_task_id
 */
function isParentTask(task, allTasks) {
  // בדיקה ישירה - אם המשימה מסומנת כפרויקט
  if (task.is_project === true) {
    return true;
  }
  
  // בדיקה עקיפה - אם יש משימות אחרות שמצביעות על זו כהורה
  return allTasks.some(t => t.parent_task_id === task.id);
}

/**
 * ✅ פונקציה ראשית: חישוב דחיות אוטומטיות
 * 
 * מחזירה רשימת משימות לעדכון:
 * - משימות שצריך להעביר למחר (אין מקום להיום)
 * - משימות שאפשר למשוך ממחר להיום (יש מקום)
 * 
 * ⚠️ לא סופר משימות הורה - רק את האינטרוולים שלהן!
 */
export function calculateAutoReschedule(tasks, editTask) {
  const now = new Date();
  const today = toLocalISODate(now);
  const tomorrow = toLocalISODate(getNextWorkday(now));
  const dayOfWeek = now.getDay();
  
  // בשישי-שבת - כל המשימות נחשבות כמשימות בית
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  
  // ✅ תיקון v1.1: סינון משופר - לא סופרים משימות הורה!
  // משימה נספרת רק אם:
  // 1. לא הושלמה
  // 2. לא הורה (is_project !== true AND אין ילדים)
  // 3. ליום הרלוונטי
  const todayTasks = tasks.filter(t => {
    // לא הושלמה
    if (t.is_completed) return false;
    
    // ✅ תיקון: לא סופרים משימות הורה!
    if (isParentTask(t, tasks)) return false;
    
    // ליום הנכון
    return t.due_date === today || t.start_date === today;
  });
  
  // בסופ"ש כל המשימות הן משימות בית
  const todayWorkTasks = isWeekend ? [] : todayTasks.filter(t => !isHomeTask(t));
  const todayHomeTasks = isWeekend ? todayTasks : todayTasks.filter(t => isHomeTask(t));
  
  const tomorrowTasks = tasks.filter(t => {
    if (t.is_completed) return false;
    if (isParentTask(t, tasks)) return false;
    return t.due_date === tomorrow || t.start_date === tomorrow;
  });
  
  const tomorrowWorkTasks = tomorrowTasks.filter(t => !isHomeTask(t));
  
  // חישוב זמן פנוי - בסופ"ש רק זמן בית
  const remainingWorkToday = isWeekend ? 0 : getRemainingMinutesToday('work');
  const remainingHomeToday = getRemainingMinutesToday('home');
  
  // בסופ"ש משתמשים בזמן הבית לחישוב
  const effectiveRemainingTime = isWeekend ? remainingHomeToday : remainingWorkToday;
  
  // בסופ"ש מחשבים את משימות הבית, בימים רגילים את משימות העבודה
  const relevantTasks = isWeekend ? todayHomeTasks : todayWorkTasks;
  
  // חישוב סך הזמן הדרוש
  let totalTimeNeeded = 0;
  relevantTasks.forEach(task => {
    if (!isTimerRunning(task.id)) {
      totalTimeNeeded += getRemainingTaskTime(task);
    }
  });
  
  // כמה זמן חסר?
  const timeOverflow = Math.max(0, totalTimeNeeded - effectiveRemainingTime);
  
  const tasksToMoveToTomorrow = [];
  const tasksToKeepToday = [];
  
  // זיהוי אינטרוולים לפי מספר
  const getIntervalInfo = (task) => {
    const match = task.title?.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      return { index: parseInt(match[1]), total: parseInt(match[2]) };
    }
    return null;
  };
  
  // קיבוץ משימות: רגילות בנפרד, אינטרוולים לפי הורה
  const regularTasks = [];
  const intervalsByParent = new Map(); // parent_id -> [tasks sorted by index]
  
  relevantTasks.forEach(task => {
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
  
  // אם יש זמן חסר - להעביר משימות למחר
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
    
    // טיפול באינטרוולים - להעביר מהסוף אם צריך
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
  
  // שימוש בזמן האפקטיבי (עבודה או בית)
  const freeTimeToday = effectiveRemainingTime - timeNeededToday;
  
  // חישוב משימות שחורגות מסוף היום - דינמי לפי סוג היום
  const DAY_END_MINUTES = isWeekend ? 22 * 60 : WORK_HOURS.end * 60;
  const tasksOverflowingEndOfDay = [];
  
  tasksToKeepToday.forEach(task => {
    if (task.due_time) {
      const [h, m] = task.due_time.split(':').map(Number);
      const startMinutes = h * 60 + (m || 0);
      const endMinutes = startMinutes + getRemainingTaskTime(task);
      
      // אם המשימה מסתיימת אחרי סוף היום - היא חורגת
      if (endMinutes > DAY_END_MINUTES) {
        tasksOverflowingEndOfDay.push({
          ...task,
          startMinutes,
          endMinutes,
          overflowMinutes: endMinutes - DAY_END_MINUTES
        });
      }
    }
  });
  
  // האם אפשר למשוך משימות ממחר?
  const tasksToMoveToToday = [];
  
  // בסופ"ש לא מציעים להקדים משימות עבודה!
  // רק משימות בית יכולות להיות מוקדמות לסופ"ש
  if (freeTimeToday > 15) { // לפחות 15 דקות פנויות
    let usedFreeTime = 0;
    
    // בסופ"ש - רק משימות בית ממחר
    // בימים רגילים - משימות עבודה ממחר
    const eligibleTomorrowTasks = isWeekend 
      ? tomorrowTasks.filter(t => isHomeTask(t))  // סופ"ש: רק משימות בית
      : tomorrowWorkTasks;  // ימים רגילים: משימות עבודה
    
    // מיון משימות מחר לפי עדיפות
    const sortedTomorrowTasks = [...eligibleTomorrowTasks].sort((a, b) => {
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
    remainingWorkToday: effectiveRemainingTime,
    timeNeededToday,
    freeTimeToday,
    tasksToMoveToTomorrow,
    tasksToMoveToToday,
    tasksToKeepToday,
    tasksOverflowingEndOfDay,
    isWeekend,
    // ✅ debug info
    _debug: {
      totalTasks: tasks.length,
      todayTasksCount: todayTasks.length,
      relevantTasksCount: relevantTasks.length,
      totalTimeNeeded,
      effectiveRemainingTime,
      timeOverflow
    }
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
        // שומר את כל הנתונים המקוריים
        title: task.title,
        description: task.description,
        quadrant: task.quadrant,
        estimated_duration: task.estimated_duration,
        task_type: task.task_type,
        task_parameter: task.task_parameter,
        priority: task.priority,
        reminder_minutes: task.reminder_minutes,
        // משנה רק את התאריכים
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
        // שומר את כל הנתונים המקוריים
        title: task.title,
        description: task.description,
        quadrant: task.quadrant,
        estimated_duration: task.estimated_duration,
        task_type: task.task_type,
        task_parameter: task.task_parameter,
        priority: task.priority,
        reminder_minutes: task.reminder_minutes,
        // משנה רק את התאריכים
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
 * פונקציה נוחה: חישוב וביצוע אוטומטי
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
