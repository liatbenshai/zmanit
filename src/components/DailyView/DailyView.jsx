import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { smartScheduleWeek } from '../../utils/smartScheduler';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import RescheduleModal from './RescheduleModal';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

// ===============================
// Drag & Drop State
// ===============================
let draggedTaskData = null;

/**
 * סוגי משימות מוגדרים - כולם לפי זמן
 */
export const TASK_TYPES = {
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    defaultDuration: 60,
    category: 'work'
  },
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '📝',
    defaultDuration: 45,
    category: 'work'
  },
  email: { 
    id: 'email', 
    name: 'מיילים', 
    icon: '📧',
    defaultDuration: 25,
    category: 'work'
  },
  course: { 
    id: 'course', 
    name: 'קורס התמלול', 
    icon: '📚',
    defaultDuration: 90,
    category: 'venture'
  },
  client_communication: { 
    id: 'client_communication', 
    name: 'לקוחות', 
    icon: '💬',
    defaultDuration: 30,
    category: 'work'
  },
  management: { 
    id: 'management', 
    name: 'ניהול', 
    icon: '👔',
    defaultDuration: 45,
    category: 'work'
  },
  family: { 
    id: 'family', 
    name: 'משפחה', 
    icon: '👨‍👩‍👧‍👦',
    defaultDuration: 60,
    category: 'family'
  },
  kids: { 
    id: 'kids', 
    name: 'ילדים', 
    icon: '🧒',
    defaultDuration: 30,
    category: 'family'
  },
  personal: { 
    id: 'personal', 
    name: 'זמן אישי', 
    icon: '🧘',
    defaultDuration: 30,
    category: 'personal'
  },
  unexpected: { 
    id: 'unexpected', 
    name: 'בלת"מים', 
    icon: '⚡',
    defaultDuration: 30,
    category: 'work'
  },
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📋',
    defaultDuration: 30,
    category: 'work'
  }
};

/**
 * שעות עבודה קבועות
 */
const WORK_HOURS = {
  start: 8, // 08:00
  end: 16,  // 16:00
  totalMinutes: 8 * 60 // 480 דקות
};

/**
 * המרה לתאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * קבלת התאריך בפורמט ישראלי
 */
function getDateHebrew(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return {
    full: `יום ${dayName}, ${day} ב${month} ${year}`,
    short: `${day}/${date.getMonth() + 1}`,
    dayName
  };
}

/**
 * ✅ תיקון: קבלת תאריך בפורמט ISO מקומי (לא UTC!)
 * זה קריטי כי toISOString() מחזיר UTC שיכול להיות יום אחר בישראל
 */
function getDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * בדיקה אם התאריך הוא היום
 */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * חישוב תחילת השבוע (יום ראשון)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * פורמט דקות לשעות:דקות
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0 דק\'';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} דק'`;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${String(mins).padStart(2, '0')} שעות`;
}

/**
 * תצוגת יום עבודה - מסך ראשי חדש
 */
function DailyView() {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks, editTask } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [dragOverTime, setDragOverTime] = useState(null); // שעה שמעליה גוררים
  const timelineRef = useRef(null);
  
  // ✅ תיקון: שעה נוכחית - משתמש ב-getDateISO במקום toISOString
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return {
      minutes: now.getHours() * 60 + now.getMinutes(),
      dateISO: getDateISO(now) // ✅ תיקון: תאריך מקומי
    };
  });
  
  // ✅ תיקון: עדכון השעה כל דקה - משתמש ב-getDateISO
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        minutes: now.getHours() * 60 + now.getMinutes(),
        dateISO: getDateISO(now) // ✅ תיקון: תאריך מקומי
      });
    }, 60 * 1000); // כל דקה
    
    return () => clearInterval(interval);
  }, []);

  // ניווט בין ימים
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // חישוב תוכנית שבועית עם smartScheduler
  const weekPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const weekStart = getWeekStart(selectedDate);
    console.log('📅 DailyView: Computing week plan from', getDateISO(weekStart));
    return smartScheduleWeek(weekStart, tasks);
  }, [tasks, selectedDate]);

  // קבלת הבלוקים ליום הנבחר מתוך התוכנית השבועית
  const selectedDayData = useMemo(() => {
    if (!weekPlan) return { blocks: [], tasks: [] };
    
    const dateISO = getDateISO(selectedDate);
    const dayPlan = weekPlan.days.find(d => d.date === dateISO);
    
    if (!dayPlan) {
      console.log('📅 No plan found for', dateISO);
      return { blocks: [], tasks: [] };
    }
    
    console.log('📅 Day plan for', dateISO, ':', dayPlan.blocks?.length || 0, 'blocks');
    return {
      blocks: dayPlan.blocks || [],
      usagePercent: dayPlan.usagePercent || 0,
      plannedMinutes: dayPlan.plannedMinutes || 0,
      completedMinutes: dayPlan.completedMinutes || 0
    };
  }, [weekPlan, selectedDate]);

  // חישוב זמנים מעודכן - כל המשימות שלא הושלמו נספרות
  const isViewingToday = getDateISO(selectedDate) === currentTime.dateISO;
  
  const timeStats = useMemo(() => {
    const blocks = selectedDayData.blocks || [];
    
    // פונקציה לבדיקה אם בלוק עבר
    const blockHasPassed = (block) => {
      if (!isViewingToday) return false;
      if (!block.endTime) return false;
      const [hour, min] = block.endTime.split(':').map(Number);
      return (hour * 60 + (min || 0)) < currentTime.minutes;
    };
    
    const completedMinutes = blocks
      .filter(b => b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    // כל המשימות שלא הושלמו - כולל באיחור - זה עבודה שצריך לעשות!
    const pendingMinutes = blocks
      .filter(b => !b.isCompleted)
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    // משימות באיחור (לסטטיסטיקה)
    const overdueMinutes = blocks
      .filter(b => !b.isCompleted && blockHasPassed(b))
      .reduce((sum, b) => sum + (b.duration || 0), 0);
    
    const inProgressMinutes = blocks
      .filter(b => !b.isCompleted && b.timeSpent > 0)
      .reduce((sum, b) => sum + (b.timeSpent || 0), 0);
    
    // זמן שנשאר = מעכשיו עד סוף היום (16:00) פחות עבודה שצריך לעשות
    const endOfDayMinutes = WORK_HOURS.end * 60; // 16:00 = 960 דקות
    const minutesLeftInDay = isViewingToday 
      ? Math.max(0, endOfDayMinutes - currentTime.minutes)
      : WORK_HOURS.totalMinutes;
    
    // זמן פנוי = זמן שנשאר ביום - משימות שצריך לעשות
    const freeMinutes = Math.max(0, minutesLeftInDay - pendingMinutes + inProgressMinutes);
    
    return {
      completed: completedMinutes,
      pending: pendingMinutes, // כל מה שצריך לעשות
      overdue: overdueMinutes,
      inProgress: inProgressMinutes,
      remaining: freeMinutes, // זמן פנוי באמת
      minutesLeftInDay: minutesLeftInDay,
      total: WORK_HOURS.totalMinutes,
      usedPercent: Math.round((completedMinutes / WORK_HOURS.totalMinutes) * 100),
      canFitAll: pendingMinutes <= minutesLeftInDay
    };
  }, [selectedDayData, isViewingToday, currentTime.minutes]);

  // handlers
  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    // מציאת המשימה המקורית מה-tasks (לא הבלוק)
    const originalTask = tasks.find(t => t.id === task.taskId || t.id === task.id);
    setEditingTask(originalTask || task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    loadTasks();
  };

  // ===============================
  // Drag & Drop Handlers
  // ===============================
  
  // התחלת גרירה
  const handleDragStart = (task, e) => {
    draggedTaskData = task;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  // סיום גרירה
  const handleDragEnd = () => {
    draggedTaskData = null;
    setDragOverTime(null);
  };

  // גרירה מעל אזור זמן
  const handleDragOverTimeline = (e) => {
    e.preventDefault();
    if (!timelineRef.current || !draggedTaskData) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    
    // המרה לזמן (8:00 - 16:00)
    const totalMinutes = 8 * 60; // 8 שעות
    const minutesFromStart = Math.round(percentage * totalMinutes);
    const roundedMinutes = Math.round(minutesFromStart / 15) * 15; // עיגול ל-15 דקות
    
    const hour = 8 + Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    setDragOverTime(timeStr);
  };

  // שחרור באזור זמן
  const handleDropOnTimeline = async (e) => {
    e.preventDefault();
    
    if (!draggedTaskData || !dragOverTime) {
      handleDragEnd();
      return;
    }

    try {
      await editTask(draggedTaskData.id, {
        due_time: dragOverTime,
        due_date: getDateISO(selectedDate)
      });
      
      toast.success(`המשימה הועברה לשעה ${dragOverTime}`);
      loadTasks();
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      toast.error('שגיאה בהעברת המשימה');
    } finally {
      handleDragEnd();
    }
  };

  // טעינה
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // שגיאה
  if (error) {
    return (
      <div className="card p-6 text-center text-red-600">
        <p>שגיאה בטעינת משימות: {error}</p>
        <button onClick={loadTasks} className="mt-4 btn btn-primary">
          נסי שוב
        </button>
      </div>
    );
  }

  // === סינון וחישוב מחדש של זמנים ===
  // בלוקים שעברו ולא הושלמו = "באיחור" - צריך לתזמן מחדש מעכשיו
  // בלוקים שעברו והושלמו = מוצגים כ"הושלמו"
  // בלוקים עתידיים = נדחים אם יש איחורים
  
  // פונקציה לבדיקה אם בלוק עבר (משתמשת ב-currentTime מה-state)
  const isBlockPast = (block) => {
    if (!isViewingToday) return false; // אם לא היום, הכל רלוונטי
    if (!block.endTime) return false;
    
    const [hour, min] = block.endTime.split(':').map(Number);
    const blockEndMinutes = hour * 60 + (min || 0);
    return blockEndMinutes < currentTime.minutes;
  };
  
  // פונקציה להמרת דקות לפורמט שעה
  const minutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  
  // הפרדת בלוקים
  // ✅ תיקון: מיון לפי זמן התחלה ואז לפי blockIndex
  const allBlocks = [...(selectedDayData.blocks || [])].sort((a, b) => {
    // קודם לפי זמן התחלה
    if (a.startTime && b.startTime) {
      const aTime = a.startTime.split(':').map(Number);
      const bTime = b.startTime.split(':').map(Number);
      const aMinutes = aTime[0] * 60 + (aTime[1] || 0);
      const bMinutes = bTime[0] * 60 + (bTime[1] || 0);
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    }
    // אם אותו זמן - לפי blockIndex
    if (a.blockIndex && b.blockIndex) {
      return a.blockIndex - b.blockIndex;
    }
    return 0;
  });
  
  // בלוקים שהושלמו - נשארים עם הזמנים המקוריים
  const completedBlocks = allBlocks.filter(b => b.isCompleted);
  
  // בלוקים פעילים (לא הושלמו)
  const activeBlocks = allBlocks.filter(b => !b.isCompleted);
  
  // === חישוב זמנים מחדש מעכשיו ===
  // כל המשימות הפעילות מתוזמנות מחדש מהשעה הנוכחית
  let nextStartMinutes = isViewingToday ? currentTime.minutes : WORK_HOURS.start * 60;
  
  const rescheduledBlocks = activeBlocks.map(block => {
    const duration = block.duration || 30;
    const startMinutes = nextStartMinutes;
    const endMinutes = startMinutes + duration;
    
    // האם הבלוק המקורי היה מתוכנן לשעה שעברה?
    const wasPostponed = isBlockPast(block);
    
    // עדכון לבלוק הבא
    nextStartMinutes = endMinutes + 5; // 5 דקות הפסקה
    
    return {
      ...block,
      originalStartTime: block.startTime,
      originalEndTime: block.endTime,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      isPostponed: wasPostponed,
      isRescheduled: wasPostponed // סימון שהזמן השתנה
    };
  });
  
  // בלוקים שנדחו (היו מתוכננים לשעה שעברה)
  const overdueBlocks = rescheduledBlocks.filter(b => b.isPostponed);
  
  // בלוקים עתידיים (לא נדחו)
  const upcomingBlocks = rescheduledBlocks.filter(b => !b.isPostponed);

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* כותרת עם ניווט */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* כותרת */}
        <div className="flex items-center justify-between mb-4">
          <div></div>
          
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              חזרה להיום
            </button>
          )}
        </div>

        {/* ניווט בין ימים */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
            title="היום הקודם"
          >
            ▶
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getDateHebrew(selectedDate).full}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {getHebrewDate(selectedDate)}
            </p>
            {isToday(selectedDate) && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                היום
              </span>
            )}
          </div>
          
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
            title="היום הבא"
          >
            ◀
          </button>
        </div>
        
        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-sm">
          שעות עבודה: {WORK_HOURS.start}:00 - {WORK_HOURS.end}:00
        </p>
      </motion.div>

      {/* סרגל זמן */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {isToday(selectedDate) ? 'זמן פנוי' : 'זמן מתוכנן'}: {formatMinutes(timeStats.remaining)}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isViewingToday && `נותרו ${formatMinutes(timeStats.minutesLeftInDay)} עד סוף היום`}
          </span>
        </div>
        
        {/* סרגל התקדמות */}
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            {/* הושלם - ירוק */}
            <div 
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(timeStats.completed / timeStats.total) * 100}%` }}
              title={`הושלם: ${formatMinutes(timeStats.completed)}`}
            />
            {/* ממתין לביצוע - כתום */}
            <div 
              className="bg-orange-500 transition-all duration-500"
              style={{ width: `${(timeStats.pending / timeStats.total) * 100}%` }}
              title={`ממתין: ${formatMinutes(timeStats.pending)}`}
            />
          </div>
        </div>
        
        {/* מקרא */}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>הושלם ({formatMinutes(timeStats.completed)})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span>ממתין ({formatMinutes(timeStats.pending)})</span>
          </div>
          {timeStats.overdue > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <span>🔄 נדחה: {formatMinutes(timeStats.overdue)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span>פנוי ({formatMinutes(timeStats.remaining)})</span>
          </div>
        </div>

        {/* אזהרה אם לא יספיק + הצעות */}
        {!timeStats.canFitAll && timeStats.pending > 0 && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
            <div className="text-red-700 dark:text-red-400 text-sm font-medium mb-2">
              ⚠️ לא יספיק! צריך {formatMinutes(timeStats.pending)} אבל נשארו רק {formatMinutes(timeStats.minutesLeftInDay)} עד 16:00
            </div>
            
            {/* הצעות לפתרון */}
            <div className="text-xs text-red-600 dark:text-red-300 space-y-1">
              <p className="font-medium">💡 הצעות:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                <li>העבירי {formatMinutes(timeStats.pending - timeStats.minutesLeftInDay)} למחר</li>
                <li>האם יש משימה שאפשר לקצר או לדחות?</li>
                <li>שקלי להאריך את יום העבודה ב-{formatMinutes(Math.min(60, timeStats.pending - timeStats.minutesLeftInDay))}</li>
              </ul>
            </div>
            
            {/* כפתור לפתיחת מודל ארגון מחדש */}
            <button
              onClick={() => setShowRescheduleModal(true)}
              className="mt-2 w-full py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              📅 ארגון מחדש - בחרי מה להעביר
            </button>
          </div>
        )}
      </motion.div>

      {/* כפתור הוספת משימה */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <Button onClick={handleAddTask} className="w-full py-3 text-lg">
          + משימה חדשה
        </Button>
      </motion.div>

      {/* רשימת משימות עם ציר זמן לגרירה */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-4"
      >
        {/* ציר זמן לגרירה - מוצג רק כשיש משימות */}
        {allBlocks.length > 0 && (
          <div 
            ref={timelineRef}
            className={`
              w-16 flex-shrink-0 rounded-lg border-2 border-dashed transition-all
              ${dragOverTime 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
              }
            `}
            onDragOver={handleDragOverTimeline}
            onDragLeave={() => setDragOverTime(null)}
            onDrop={handleDropOnTimeline}
          >
            {/* שעות */}
            <div className="h-full flex flex-col justify-between py-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-center">08:00</span>
              <span className="text-center">10:00</span>
              <span className="text-center">12:00</span>
              <span className="text-center">14:00</span>
              <span className="text-center">16:00</span>
            </div>
            
            {/* אינדיקטור זמן בגרירה */}
            {dragOverTime && (
              <div className="absolute left-0 right-0 bg-blue-500 text-white text-xs py-1 px-2 rounded text-center font-medium">
                {dragOverTime}
              </div>
            )}
          </div>
        )}

        {/* רשימת משימות */}
        <div className="flex-1 space-y-3">
        {allBlocks.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl mb-4 block">📝</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              אין משימות ל{isToday(selectedDate) ? 'היום' : 'תאריך זה'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              הוסיפי משימה חדשה להתחיל
            </p>
          </div>
        ) : (
          <>
            {/* משימות שנדחו - עם זמנים מחושבים מחדש */}
            {overdueBlocks.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-2">
                  🔄 נדחו ({overdueBlocks.length}) - זמנים מעודכנים
                </h3>
                <div className="space-y-2 border-r-4 border-orange-400 pr-2">
                  {overdueBlocks.map((block, index) => (
                    <DailyTaskCard 
                      key={block.id || `postponed-${index}`} 
                      task={{
                        id: block.taskId || block.id,
                        title: block.title,
                        estimated_duration: block.duration,
                        time_spent: block.timeSpent || 0,
                        is_completed: block.isCompleted,
                        task_type: block.taskType,
                        due_time: block.startTime,
                        priority: block.priority || 'normal',
                        blockIndex: block.blockIndex,
                        totalBlocks: block.totalBlocks,
                        startTime: block.startTime,
                        endTime: block.endTime,
                        originalStartTime: block.originalStartTime,
                        originalEndTime: block.originalEndTime,
                        isPostponed: true,
                        isRescheduled: block.isRescheduled
                      }} 
                      onEdit={() => handleEditTask(block)}
                      onUpdate={loadTasks}
                      showTime={true}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      draggable={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* משימות עתידיות - עם זמנים מעודכנים */}
            {upcomingBlocks.length > 0 && (
              <div className="mb-4">
                {overdueBlocks.length > 0 && (
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    📋 ממתינות ({upcomingBlocks.length})
                  </h3>
                )}
                <div className="space-y-2">
                  {upcomingBlocks.map((block, index) => (
                    <DailyTaskCard 
                      key={block.id || `block-${index}`} 
                      task={{
                        id: block.taskId || block.id,
                        title: block.title,
                        estimated_duration: block.duration,
                        time_spent: block.timeSpent || 0,
                        is_completed: block.isCompleted,
                        task_type: block.taskType,
                        due_time: block.startTime,
                        priority: block.priority,
                        blockIndex: block.blockIndex,
                        totalBlocks: block.totalBlocks,
                        startTime: block.startTime,
                        endTime: block.endTime,
                        originalStartTime: block.originalStartTime,
                        originalEndTime: block.originalEndTime,
                        isRescheduled: block.isRescheduled
                      }} 
                      onEdit={() => handleEditTask(block)}
                      onUpdate={loadTasks}
                      showTime={true}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      draggable={true}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* משימות שהושלמו */}
            {completedBlocks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ✅ הושלמו ({completedBlocks.length})
                </h3>
                <div className="space-y-2 opacity-60">
                  {completedBlocks.map((block, index) => (
                    <DailyTaskCard 
                      key={block.id || `completed-${index}`} 
                      task={{
                        id: block.taskId || block.id,
                        title: block.title,
                        estimated_duration: block.duration,
                        time_spent: block.timeSpent || 0,
                        is_completed: true,
                        task_type: block.taskType,
                        due_time: block.startTime,
                        startTime: block.startTime,
                        endTime: block.endTime
                      }} 
                      onEdit={() => handleEditTask(block)}
                      onUpdate={loadTasks}
                      showTime={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </motion.div>

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        {/* ✅ תיקון: key גורם ל-remount כשעוברים בין הוספה לעריכה */}
        <SimpleTaskForm
          key={editingTask?.id || 'new-task'}
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={getDateISO(selectedDate)}
        />
      </Modal>
      
      {/* מודל ארגון מחדש */}
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false);
          loadTasks(); // רענון אחרי שינויים
        }}
        overdueBlocks={overdueBlocks}
        allBlocks={rescheduledBlocks}
        selectedDate={selectedDate}
      />
    </div>
  );
}

export default DailyView;
