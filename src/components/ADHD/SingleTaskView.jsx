import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * 🎯 תצוגת "משימה אחת" - מותאמת ADHD
 * 
 * במקום רשימה מפחידה של משימות, מציגה רק את הדבר הבא לעשות.
 * מפחיתה עומס קוגניטיבי ועוזרת להתמקד.
 */

/**
 * תאריך מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * פורמט זמן
 */
function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * מציאת המשימה הבאה לפי עדיפות
 * סדר עדיפויות: באיחור מימים קודמים > באיחור היום > דחוף > לפי שעה
 */
function getNextTask(tasks, today) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // משימות של היום שלא הושלמו
  const todayTasks = tasks.filter(t => {
    if (t.is_completed) return false;
    const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
    return taskDate === today;
  });
  
  // משימות באיחור (מימים קודמים)
  const overdueTasks = tasks.filter(t => {
    if (t.is_completed) return false;
    const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
    return taskDate && taskDate < today;
  });
  
  // משימות שהשעה שלהן כבר עברה היום
  const lateToday = todayTasks.filter(t => {
    if (!t.due_time) return false;
    const [h, m] = t.due_time.split(':').map(Number);
    const taskMinutes = h * 60 + (m || 0);
    return taskMinutes < currentMinutes;
  });
  
  // משימות שעדיין לא הגיע הזמן שלהן
  const upcomingToday = todayTasks.filter(t => {
    if (!t.due_time) return true;
    const [h, m] = t.due_time.split(':').map(Number);
    const taskMinutes = h * 60 + (m || 0);
    return taskMinutes >= currentMinutes;
  });

  // פונקציית מיון
  const sortTasks = (taskList) => {
    return taskList.sort((a, b) => {
      // דחוף/urgent קודם
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      
      // לפי רבע אייזנהאואר
      if ((a.quadrant || 4) !== (b.quadrant || 4)) {
        return (a.quadrant || 4) - (b.quadrant || 4);
      }
      
      // משימות עם שעה קבועה
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time && !b.due_time) return -1;
      if (!a.due_time && b.due_time) return 1;
      
      // לפי תאריך (הישן קודם)
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      
      // קצר קודם
      return (a.estimated_duration || 30) - (b.estimated_duration || 30);
    });
  };

  // מחזיר לפי סדר עדיפויות
  const sortedOverdue = sortTasks([...overdueTasks]);
  const sortedLateToday = sortTasks([...lateToday]);
  const sortedUpcoming = sortTasks([...upcomingToday]);
  
  return sortedOverdue[0] || sortedLateToday[0] || sortedUpcoming[0] || null;
}

/**
 * הודעות עידוד רנדומליות
 */
const ENCOURAGEMENTS = [
  "את יכולה לעשות את זה! 💪",
  "רק משימה אחת, צעד אחד 🎯",
  "התחלה קטנה = הצלחה גדולה ✨",
  "5 דקות והתחלת! 🚀",
  "את גיבורה על שהתחלת 🦸‍♀️",
  "כל צעד קטן נחשב 👣",
  "את עושה את זה נכון! 🌟"
];

function SingleTaskView({ 
  tasks = [], 
  onStartTask, 
  onCompleteTask, 
  onSwitchView,
  activeTimerTaskId 
}) {
  const [showEncouragement, setShowEncouragement] = useState(false);
  const today = toLocalISODate(new Date());
  
  // המשימה הנוכחית (אם יש טיימר פעיל) או הבאה
  const currentTask = useMemo(() => {
    if (activeTimerTaskId) {
      return tasks.find(t => t.id === activeTimerTaskId);
    }
    return getNextTask(tasks, today);
  }, [tasks, today, activeTimerTaskId]);

  // משימות נוספות להיום
  const remainingTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.is_completed) return false;
      if (currentTask && t.id === currentTask.id) return false;
      const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
      return taskDate === today;
    });
  }, [tasks, today, currentTask]);

  // זמן נותר להיום
  const totalRemainingMinutes = useMemo(() => {
    return remainingTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0) +
           (currentTask?.estimated_duration || 0);
  }, [remainingTasks, currentTask]);

  // הודעת עידוד רנדומלית
  const encouragement = useMemo(() => {
    return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
  }, []);

  // אם אין משימות להיום
  if (!currentTask) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-6"
        >
          <div className="text-8xl">🎉</div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
            סיימת את כל המשימות להיום!
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            מגיע לך מחמאה - עבודה מצוינת!
          </p>
          <button
            onClick={onSwitchView}
            className="mt-6 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            📋 לתצוגה המלאה
          </button>
        </motion.div>
      </div>
    );
  }

  const taskType = TASK_TYPES?.[currentTask.task_type] || { icon: '📌', name: 'משימה' };
  const isTimerRunning = activeTimerTaskId === currentTask.id;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg space-y-8"
      >
        {/* כותרת */}
        <div className="text-center">
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
            {isTimerRunning ? '⏱️ עובדת עכשיו על:' : '🎯 עכשיו את צריכה לעשות:'}
          </p>
        </div>

        {/* כרטיס המשימה */}
        <motion.div
          layout
          className={`
            p-8 rounded-3xl shadow-xl text-center
            ${isTimerRunning 
              ? 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700' 
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}
          `}
        >
          {/* אייקון וסוג */}
          <div className="text-5xl mb-4">{taskType.icon}</div>
          
          {/* שם המשימה */}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-4">
            {currentTask.title}
          </h2>

          {/* פרטים */}
          <div className="flex flex-wrap justify-center gap-4 text-gray-600 dark:text-gray-400 mb-6">
            {currentTask.estimated_duration && (
              <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                ⏱️ {formatDuration(currentTask.estimated_duration)}
              </span>
            )}
            {currentTask.due_time && (
              <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full text-blue-700 dark:text-blue-300">
                🕐 עד {currentTask.due_time.slice(0, 5)}
              </span>
            )}
            {currentTask.client && (
              <span className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full text-purple-700 dark:text-purple-300">
                👤 {currentTask.client}
              </span>
            )}
          </div>

          {/* כפתור פעולה ראשי */}
          {!isTimerRunning ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowEncouragement(true);
                setTimeout(() => setShowEncouragement(false), 2000);
                onStartTask?.(currentTask);
              }}
              className="w-full py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all"
            >
              ▶️ להתחיל עכשיו!
            </motion.button>
          ) : (
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onCompleteTask?.(currentTask)}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                ✅ סיימתי!
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* הודעת עידוד */}
        <AnimatePresence>
          {showEncouragement && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-xl text-green-600 dark:text-green-400 font-medium"
            >
              {encouragement}
            </motion.div>
          )}
        </AnimatePresence>

        {/* סיכום מה נשאר (מינימלי) */}
        <div className="text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-6">
          <p className="text-sm">
            {remainingTasks.length > 0 ? (
              <>
                אחרי זה: <span className="font-medium">{remainingTasks[0]?.title}</span>
                {remainingTasks.length > 1 && (
                  <span className="text-gray-400"> • עוד {remainingTasks.length} משימות</span>
                )}
              </>
            ) : (
              'זו המשימה האחרונה להיום! 🎯'
            )}
          </p>
          {totalRemainingMinutes > 0 && (
            <p className="text-xs mt-1 text-gray-400">
              סה"כ נשאר: {formatDuration(totalRemainingMinutes)}
            </p>
          )}
        </div>

        {/* כפתור מעבר לתצוגה רגילה */}
        <div className="text-center">
          <button
            onClick={onSwitchView}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            📋 לתצוגה המלאה
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default SingleTaskView;
