import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { smartScheduleWeek } from '../../utils/smartScheduler';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

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
 * קבלת תאריך בפורמט ISO - תיקון timezone
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
  const { tasks, loading, error, loadTasks } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // שעה נוכחית - מתעדכנת כל דקה
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return {
      minutes: now.getHours() * 60 + now.getMinutes(),
      dateISO: now.toISOString().split('T')[0]
    };
  });
  
  // עדכון השעה כל דקה
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        minutes: now.getHours() * 60 + now.getMinutes(),
        dateISO: now.toISOString().split('T')[0]
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
  const allBlocks = selectedDayData.blocks || [];
  
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
    
    // האם הבלוק המקורי היה באיחור?
    const wasOverdue = isBlockPast(block);
    
    // עדכון לבלוק הבא
    nextStartMinutes = endMinutes + 5; // 5 דקות הפסקה
    
    return {
      ...block,
      originalStartTime: block.startTime,
      originalEndTime: block.endTime,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      isOverdue: wasOverdue,
      isRescheduled: wasOverdue // סימון שהזמן השתנה
    };
  });
  
  // בלוקים באיחור (היו באיחור לפי הזמן המקורי)
  const overdueBlocks = rescheduledBlocks.filter(b => b.isOverdue);
  
  // בלוקים עתידיים (לא היו באיחור במקור)
  const upcomingBlocks = rescheduledBlocks.filter(b => !b.isOverdue);

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
            <div className="flex items-center gap-1 text-red-600">
              <span>🔴 באיחור: {formatMinutes(timeStats.overdue)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span>פנוי ({formatMinutes(timeStats.remaining)})</span>
          </div>
        </div>

        {/* אזהרה אם לא יספיק */}
        {!timeStats.canFitAll && timeStats.pending > 0 && (
          <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
            ⚠️ לא יספיק! צריך {formatMinutes(timeStats.pending)} אבל נשארו רק {formatMinutes(timeStats.minutesLeftInDay)} עד 16:00
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

      {/* רשימת משימות */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
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
            {/* משימות באיחור - עם זמנים מחושבים מחדש */}
            {overdueBlocks.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                  🔴 באיחור ({overdueBlocks.length}) - זמנים מעודכנים מעכשיו
                </h3>
                <div className="space-y-2 border-r-4 border-red-500 pr-2">
                  {overdueBlocks.map((block, index) => (
                    <DailyTaskCard 
                      key={block.id || `overdue-${index}`} 
                      task={{
                        id: block.taskId || block.id,
                        title: block.title,
                        estimated_duration: block.duration,
                        time_spent: block.timeSpent || 0,
                        is_completed: block.isCompleted,
                        task_type: block.taskType,
                        due_time: block.startTime,
                        priority: 'urgent',
                        blockIndex: block.blockIndex,
                        totalBlocks: block.totalBlocks,
                        startTime: block.startTime,
                        endTime: block.endTime,
                        originalStartTime: block.originalStartTime,
                        originalEndTime: block.originalEndTime,
                        isOverdue: true,
                        isRescheduled: block.isRescheduled
                      }} 
                      onEdit={() => handleEditTask(block)}
                      onUpdate={loadTasks}
                      showTime={true}
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
      </motion.div>

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={getDateISO(selectedDate)}
        />
      </Modal>
    </div>
  );
}

export default DailyView;
