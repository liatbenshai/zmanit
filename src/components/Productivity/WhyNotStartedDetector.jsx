import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import toast from 'react-hot-toast';

/**
 * גלאי "למה לא התחלת?"
 * 
 * מופעל כאשר:
 * - יש משימה מתוכננת לשעה מסוימת
 * - עברו 5-7 דקות מהשעה
 * - אין טיימר רץ על משימה אחרת
 * 
 * לומד מהתשובות ומעדכן את מערכת הבלת"מים
 */

const DELAY_MINUTES = 6; // אחרי כמה דקות לשאול
const CHECK_INTERVAL = 30000; // בדיקה כל 30 שניות
const DISMISSED_KEY = 'zmanit_why_not_started_dismissed';
const DELAY_REASONS_KEY = 'zmanit_delay_reasons';

// סיבות לאיחור
const DELAY_REASONS = [
  { id: 'started_now', icon: '🚀', label: 'מתחילה עכשיו!', color: 'green', primary: true },
  { id: 'unexpected', icon: '📞', label: 'היה בלת"ם', color: 'orange', isBuffer: true },
  { id: 'previous_task', icon: '⏳', label: 'עדיין במשימה קודמת', color: 'blue' },
  { id: 'distracted', icon: '🫣', label: 'התפזרתי...', color: 'red' },
  { id: 'break', icon: '☕', label: 'לקחתי הפסקה', color: 'yellow' },
  { id: 'forgot', icon: '🤔', label: 'שכחתי', color: 'purple' },
];

// שמירת סיבות לאיחור (ללמידה)
function saveDelayReason(taskId, reason, delayMinutes) {
  try {
    const data = JSON.parse(localStorage.getItem(DELAY_REASONS_KEY) || '[]');
    data.push({
      taskId,
      reason: reason.id,
      isBuffer: reason.isBuffer || false,
      delayMinutes,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    });
    // שומרים רק 200 אחרונים
    if (data.length > 200) data.shift();
    localStorage.setItem(DELAY_REASONS_KEY, JSON.stringify(data));
  } catch (e) {}
}

// חישוב זמן בלת"מים ממוצע (לומד מההיסטוריה)
export function getAverageBufferTime() {
  try {
    const data = JSON.parse(localStorage.getItem(DELAY_REASONS_KEY) || '[]');
    const bufferReasons = data.filter(d => d.isBuffer);
    
    if (bufferReasons.length < 5) {
      return 30; // ברירת מחדל: 30 דקות ביום
    }
    
    // חישוב ממוצע לפי יום
    const byDate = {};
    bufferReasons.forEach(d => {
      if (!byDate[d.date]) byDate[d.date] = 0;
      byDate[d.date] += d.delayMinutes || 10;
    });
    
    const dailyAverages = Object.values(byDate);
    const avgPerDay = dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length;
    
    return Math.round(avgPerDay);
  } catch (e) {
    return 30;
  }
}

// סטטיסטיקות איחורים
export function getDelayStats() {
  try {
    const data = JSON.parse(localStorage.getItem(DELAY_REASONS_KEY) || '[]');
    if (data.length === 0) return null;
    
    const last30Days = data.filter(d => {
      const date = new Date(d.timestamp);
      const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 30;
    });
    
    const reasons = {};
    last30Days.forEach(d => {
      reasons[d.reason] = (reasons[d.reason] || 0) + 1;
    });
    
    return {
      total: last30Days.length,
      reasons,
      mostCommon: Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0],
      bufferTotal: last30Days.filter(d => d.isBuffer).reduce((sum, d) => sum + (d.delayMinutes || 0), 0),
      avgBufferPerDay: getAverageBufferTime()
    };
  } catch (e) {
    return null;
  }
}

/**
 * המרת תאריך לפורמט ISO מקומי
 */
function toLocalISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * הקומפוננטה הראשית
 */
function WhyNotStartedDetector() {
  const { tasks } = useTasks();
  const [showDialog, setShowDialog] = useState(false);
  const [lateTask, setLateTask] = useState(null);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [dismissedTasks, setDismissedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // בדיקה אם יש טיימר רץ
  const hasRunningTimer = useCallback(() => {
    // בדיקת טיימר פעיל
    const activeTimer = localStorage.getItem('zmanit_active_timer');
    if (activeTimer) return true;
    
    // בדיקת טיימרים ישנים
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('timer_v2_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data?.isRunning && !data?.isInterrupted) {
            return true;
          }
        } catch (e) {}
      }
    }
    
    return false;
  }, []);

  // מציאת משימה שעברה השעה שלה
  const checkForLateTasks = useCallback(() => {
    if (!tasks || tasks.length === 0) return;
    if (hasRunningTimer()) return; // יש טיימר רץ - לא מפריעים
    
    const now = new Date();
    const today = toLocalISODate(now); // 🔧 תיקון: שימוש בפונקציה אחידה
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // משימות היום שלא הושלמו
    const todayTasks = tasks.filter(t => {
      if (t.is_completed || t.deleted_at || !t.due_time) return false;
      // 🔧 תיקון: המרה לפורמט אחיד
      const taskDate = t.due_date ? toLocalISODate(new Date(t.due_date)) : null;
      return taskDate === today;
    });
    
    for (const task of todayTasks) {
      const [h, m] = task.due_time.split(':').map(Number);
      const taskMinutes = h * 60 + (m || 0);
      const minutesLate = currentMinutes - taskMinutes;
      
      // בדיקה אם עברו DELAY_MINUTES מהשעה המתוכננת
      if (minutesLate >= DELAY_MINUTES && minutesLate < 60) {
        // בדיקה אם כבר שאלנו על המשימה הזו היום
        const dismissKey = `${task.id}_${today}`;
        if (!dismissedTasks[dismissKey]) {
          setLateTask(task);
          setDelayMinutes(minutesLate);
          setShowDialog(true);
          return;
        }
      }
    }
  }, [tasks, hasRunningTimer, dismissedTasks]);

  // בדיקה תקופתית
  useEffect(() => {
    checkForLateTasks();
    const interval = setInterval(checkForLateTasks, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkForLateTasks]);

  // טיפול בתשובה
  const handleResponse = (reason) => {
    if (!lateTask) return;
    
    // שמירה ללמידה
    saveDelayReason(lateTask.id, reason, delayMinutes);
    
    // סימון שכבר שאלנו
    const today = new Date().toISOString().split('T')[0];
    const dismissKey = `${lateTask.id}_${today}`;
    const newDismissed = { ...dismissedTasks, [dismissKey]: true };
    setDismissedTasks(newDismissed);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed));
    
    // הודעה
    if (reason.id === 'started_now') {
      toast.success('💪 יאללה, בהצלחה!');
    } else if (reason.isBuffer) {
      toast('📝 נרשם כבלת"ם - המערכת לומדת');
    } else {
      toast('📝 נרשם - ננסה להשתפר!');
    }
    
    setShowDialog(false);
    setLateTask(null);
  };

  // סגירה בלי תשובה
  const handleDismiss = () => {
    if (lateTask) {
      const today = new Date().toISOString().split('T')[0];
      const dismissKey = `${lateTask.id}_${today}`;
      const newDismissed = { ...dismissedTasks, [dismissKey]: true };
      setDismissedTasks(newDismissed);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(newDismissed));
    }
    setShowDialog(false);
    setLateTask(null);
  };

  const taskType = lateTask ? (TASK_TYPES[lateTask.task_type] || TASK_TYPES.other) : null;

  return (
    <AnimatePresence>
      {showDialog && lateTask && (
        <>
          {/* רקע */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
            onClick={handleDismiss}
          />
          
          {/* דיאלוג */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001]
                       w-[95%] max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
            dir="rtl"
          >
            {/* כותרת */}
            <div className={`p-5 ${taskType?.bgLight || 'bg-orange-50'}`}>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white/50 dark:bg-gray-700/50 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">{taskType?.icon || '📋'}</span>
                </div>
                <div>
                  <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                    ⏰ עברו {delayMinutes} דקות מהשעה המתוכננת
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {lateTask.title}
                  </h2>
                  <div className="text-sm text-gray-500">
                    תוכנן ל-{lateTask.due_time}
                  </div>
                </div>
              </div>
            </div>

            {/* שאלה */}
            <div className="p-5">
              <h3 className="text-center text-gray-700 dark:text-gray-300 font-medium mb-4">
                למה לא התחלת?
              </h3>
              
              {/* כפתור ראשי */}
              {DELAY_REASONS.filter(r => r.primary).map(reason => (
                <motion.button
                  key={reason.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleResponse(reason)}
                  className="w-full p-4 mb-3 bg-gradient-to-l from-green-500 to-emerald-500 
                           text-white font-bold rounded-xl shadow-lg shadow-green-500/30
                           flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">{reason.icon}</span>
                  <span>{reason.label}</span>
                </motion.button>
              ))}

              {/* שאר הסיבות */}
              <div className="grid grid-cols-2 gap-2">
                {DELAY_REASONS.filter(r => !r.primary).map(reason => (
                  <motion.button
                    key={reason.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleResponse(reason)}
                    className={`
                      p-3 rounded-xl flex items-center gap-2 text-sm font-medium transition-all
                      ${reason.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 ring-2 ring-orange-300' : ''}
                      ${reason.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                      ${reason.color === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
                      ${reason.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : ''}
                      ${reason.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : ''}
                    `}
                  >
                    <span className="text-xl">{reason.icon}</span>
                    <span>{reason.label}</span>
                  </motion.button>
                ))}
              </div>

              {/* הסבר בלת"ם */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
                💡 כשבוחרת "היה בלת"ם" - המערכת לומדת כמה זמן להשאיר לבלת"מים ביום
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default WhyNotStartedDetector;
