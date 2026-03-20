import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../../config/taskTypes';
import { timeToMinutes, minutesToTime } from '../../utils/timeOverlap';
import Modal from '../UI/Modal';
import QuickAdd from '../QuickAdd/QuickAdd';
import UrgentReschedule from '../Scheduler/UrgentReschedule';
import WeeklyReview from '../Analytics/WeeklyReview';
import ClientTracker from '../Analytics/ClientTracker';
import DailySummary from '../Analytics/DailySummary';
import TimeGapsReport from '../Analytics/TimeGapsReport';
import WorkPreferences from '../Settings/WorkPreferences';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import InterruptionsTracker from './InterruptionsTracker';
import MiniTimer from './MiniTimer';
import SmartRecommendationsPanel from './SmartRecommendationsPanel';
import DailyProgressCard from './DailyProgressCard';

/**
 * שעות העבודה
 */
const WORK_HOURS = { start: 8, end: 16 };

/**
 * צלילי התראה
 */
const SOUNDS = {
  taskStart: '/sounds/task-start.mp3',
  taskWarning: '/sounds/task-warning.mp3',
  taskEnd: '/sounds/task-end.mp3'
};

/**
 * נגן צליל (עם fallback)
 */
function playSound(type) {
  try {
    // יצירת צליל סינתטי אם אין קובץ
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // צלילים שונים לפי סוג
    if (type === 'taskStart') {
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
    } else if (type === 'taskWarning') {
      oscillator.frequency.value = 600;
      oscillator.type = 'triangle';
      gainNode.gain.value = 0.2;
    } else if (type === 'taskEnd') {
      oscillator.frequency.value = 400;
      oscillator.type = 'square';
      gainNode.gain.value = 0.2;
    }
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
  }
}

/**
 * פורמט שעה נוכחית
 */
function getCurrentTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (minutes < 0) return '0 דק\'';
  if (minutes < 60) return `${Math.round(minutes)} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * ברכה לפי שעה
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

/**
 * דשבורד ראשי
 */
function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const { tasks, loading, loadTasks, editTask, dataVersion } = useTasks();
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [lastAlertedTask, setLastAlertedTask] = useState(null);
  const [showTaskAlert, setShowTaskAlert] = useState(false);
  const [alertedWarnings, setAlertedWarnings] = useState(new Set());
  
  // מודלים
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showUrgent, setShowUrgent] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showClientTracker, setShowClientTracker] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showTimeGaps, setShowTimeGaps] = useState(false);
  
  // ✅ חדש: מודל הוספת משימה עם תכנון שבועי
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedTaskDate, setSelectedTaskDate] = useState(null);
  
  // ✅ חדש: מודל ניתוח הפרעות
  const [showInterruptions, setShowInterruptions] = useState(false);
  
  // עדכון שעה כל דקה
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // תאריך היום
  const today = new Date().toISOString().split('T')[0];
  const currentMinutes = timeToMinutes(currentTime);

  // משימות היום (ממוינות לפי שעה)
  const todayTasks = useMemo(() => {
    return tasks
      .filter(t => t.due_date === today && !t.is_completed && t.due_time)
      .sort((a, b) => timeToMinutes(a.due_time) - timeToMinutes(b.due_time));
  }, [tasks, today, dataVersion]);

  // המשימה הנוכחית
  const currentTask = useMemo(() => {
    for (const task of todayTasks) {
      const start = timeToMinutes(task.due_time);
      const end = start + (task.estimated_duration || 30);
      if (currentMinutes >= start && currentMinutes < end) {
        return { ...task, startMinutes: start, endMinutes: end };
      }
    }
    return null;
  }, [todayTasks, currentMinutes]);

  // המשימה הבאה
  const nextTask = useMemo(() => {
    for (const task of todayTasks) {
      const start = timeToMinutes(task.due_time);
      if (start > currentMinutes) {
        return { ...task, startMinutes: start };
      }
    }
    return null;
  }, [todayTasks, currentMinutes]);

  // ✅ חדש: המשימה הראשונה שלא הושלמה (גם אם הזמן עבר)
  const pendingTask = useMemo(() => {
    // קודם כל - בדיקה אם יש טיימר רץ על משימה כלשהי
    for (const task of todayTasks) {
      try {
        const timerData = localStorage.getItem(`timer_v2_${task.id}`);
        if (timerData) {
          const parsed = JSON.parse(timerData);
          if (parsed.isRunning || parsed.isPaused) {
            return task; // מחזיר את המשימה עם הטיימר הפעיל
          }
        }
      } catch (e) {}
    }
    // אחרת - המשימה הראשונה שלא הושלמה
    return todayTasks[0] || null;
  }, [todayTasks]);

  // זמן שנותר במשימה הנוכחית
  const timeRemaining = currentTask 
    ? currentTask.endMinutes - currentMinutes 
    : null;

  // אחוז התקדמות במשימה
  const progressPercent = currentTask
    ? ((currentMinutes - currentTask.startMinutes) / (currentTask.estimated_duration || 30)) * 100
    : 0;

  // זמן עד המשימה הבאה
  const timeUntilNext = nextTask
    ? nextTask.startMinutes - currentMinutes
    : null;

  // התראות צליל
  useEffect(() => {
    // התראה כשמתחילה משימה חדשה
    if (currentTask && lastAlertedTask !== currentTask.id) {
      playSound('taskStart');
      setLastAlertedTask(currentTask.id);
      setShowTaskAlert(true);
      setTimeout(() => setShowTaskAlert(false), 5000);
    }

    // התראה 5 דקות לפני סוף משימה
    if (currentTask && timeRemaining === 5 && !alertedWarnings.has(`${currentTask.id}-5min`)) {
      playSound('taskWarning');
      setAlertedWarnings(prev => new Set([...prev, `${currentTask.id}-5min`]));
    }

    // התראה כשנגמר הזמן
    if (currentTask && timeRemaining === 0 && !alertedWarnings.has(`${currentTask.id}-end`)) {
      playSound('taskEnd');
      setAlertedWarnings(prev => new Set([...prev, `${currentTask.id}-end`]));
    }
  }, [currentTask, timeRemaining, lastAlertedTask, alertedWarnings]);

  // סטטיסטיקות היום
  const todayStats = useMemo(() => {
    const completed = tasks.filter(t => t.due_date === today && t.is_completed);
    const pending = todayTasks.length;
    const totalPlannedMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const completedMinutes = completed.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    
    return {
      completed: completed.length,
      pending,
      totalPlannedMinutes,
      completedMinutes,
      totalTasks: completed.length + pending
    };
  }, [tasks, todayTasks, today]);

  // צבע לפי זמן שנותר
  const getTimeColor = (remaining) => {
    if (remaining <= 0) return 'text-red-500';
    if (remaining <= 5) return 'text-orange-500';
    return 'text-green-500';
  };

  // צבע פס התקדמות
  const getProgressColor = (percent) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const currentTaskType = currentTask ? (TASK_TYPES[currentTask.task_type] || TASK_TYPES.other) : null;
  const nextTaskType = nextTask ? (TASK_TYPES[nextTask.task_type] || TASK_TYPES.other) : null;

  // תאריך עברי
  const hebrewDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
    } catch (e) {
      return '';
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 p-4 pb-24 md:pb-4">
      {/* התראת משימה חדשה */}
      <AnimatePresence>
        {showTaskAlert && currentTask && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-4 left-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-elevated p-4 border-r-4 border-blue-500"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentTaskType?.icon}</span>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">התחילה משימה חדשה!</div>
                <div className="font-bold text-lg text-gray-900 dark:text-white">{currentTask.title}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-lg mx-auto space-y-4">
        {/* כותרת וברכה */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2 pb-1"
        >
          <div className="flex items-center justify-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {getGreeting()}, {user?.user_metadata?.name?.split(' ')[0] || 'שלום'}!
              </h1>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
                {hebrewDate}
              </p>
            </div>
          </div>
          <div className="text-4xl font-light text-gray-700 dark:text-gray-300 mt-2 font-mono tracking-wider">
            {currentTime}
          </div>
        </motion.div>

        {/* ✅ כרטיס התקדמות יומית חדש */}
        <DailyProgressCard tasks={tasks} currentTime={currentTime} />

        {/* כרטיס המשימה הנוכחית */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`
            rounded-2xl p-5 shadow-card
            ${currentTask
              ? `${currentTaskType?.color} border-2`
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60'
            }
          `}
        >
          {currentTask ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentTaskType?.icon}</span>
                  <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    עכשיו
                  </span>
                </div>
                <div className={`text-2xl font-bold font-mono ${getTimeColor(timeRemaining)}`}>
                  {timeRemaining > 0 ? formatMinutes(timeRemaining) : '⏰ נגמר הזמן!'}
                </div>
              </div>

              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{currentTask.title}</h2>

              {/* פס התקדמות */}
              <div className="relative h-2.5 bg-black/10 rounded-full overflow-hidden mb-2">
                <motion.div
                  className={`absolute top-0 right-0 h-full rounded-full ${getProgressColor(progressPercent)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{currentTask.due_time}</span>
                <span>{minutesToTime(currentTask.endMinutes)}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl mb-3 block">☕</span>
              <h2 className="text-lg font-medium text-gray-600 dark:text-gray-300">
                אין משימה כרגע
              </h2>
              {nextTask && (
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1.5">
                  הבאה ב-{nextTask.due_time}
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* 🔥 טיימר מהיר - התחל לעבוד! */}
        <MiniTimer 
          task={currentTask || nextTask || pendingTask}
          onComplete={async (task) => {
            await editTask(task.id, { 
              is_completed: true, 
              completed_at: new Date().toISOString() 
            });
            loadTasks();
          }}
          onNavigateToTask={(task) => {
            // TODO: ניווט לתצוגה היומית עם המשימה
            console.log('Navigate to task:', task.id);
          }}
        />

        {/* ציר זמן - משימות היום */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-card border border-gray-100 dark:border-gray-700/60"
        >
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2 text-sm">
            <span>📅</span> משימות היום
          </h3>

          {todayTasks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
              אין משימות מתוכננות להיום
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
              {todayTasks.map((task, index) => {
                const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                const start = timeToMinutes(task.due_time);
                const end = start + (task.estimated_duration || 30);
                const isPast = currentMinutes >= end;
                const isCurrent = currentTask?.id === task.id;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className={`
                      flex items-center gap-3 p-2.5 rounded-xl transition-all
                      ${isCurrent
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400/50'
                        : isPast
                          ? 'opacity-40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    <div className="text-xs font-mono text-gray-400 dark:text-gray-500 w-10 text-center">
                      {task.due_time}
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${taskType.color}`}>
                      {taskType.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm truncate ${isPast ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {formatMinutes(task.estimated_duration || 30)}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="badge bg-blue-500 text-white text-[10px] animate-pulse">
                        עכשיו
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* כפתורי ניווט */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => onNavigate?.('day')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-card hover:shadow-card-hover border border-gray-100 dark:border-gray-700/60 hover:border-blue-200 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span className="text-xl">📋</span>
            <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">תצוגה יומית</span>
          </button>

          <button
            onClick={() => onNavigate?.('week')}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-card hover:shadow-card-hover border border-gray-100 dark:border-gray-700/60 hover:border-blue-200 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span className="text-xl">📅</span>
            <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">תצוגת שבוע</span>
          </button>
        </motion.div>

        {/* כפתורים מהירים */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => setShowQuickAdd(true)}
            className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3.5 border border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span className="text-lg">⚡</span>
            <span className="font-medium text-amber-700 dark:text-amber-300 text-sm">משהו צץ</span>
          </button>

          <button
            onClick={() => setShowUrgent(true)}
            className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-3.5 border border-red-200/60 dark:border-red-800/40 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span className="text-lg">🚨</span>
            <span className="font-medium text-red-700 dark:text-red-300 text-sm">דחוף!</span>
          </button>
        </motion.div>

        {/* כפתור הוספת עבודה */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => {
            setSelectedTaskDate(today);
            setShowAddTask(true);
          }}
          className="w-full bg-gradient-to-l from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 font-medium active:scale-[0.98]"
        >
          <span className="text-xl">📥</span>
          <span>הוסף עבודה חדשה</span>
        </motion.button>

        {/* ✅ תכנון שבועי - בורר ימים מהיר */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-card border border-gray-100 dark:border-gray-700/60"
        >
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2 text-sm">
            <span>📆</span> הוסף משימה ליום...
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {(() => {
              const days = [];
              const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
              for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dateISO = date.toISOString().split('T')[0];
                const dayNum = date.getDay();
                const isWeekend = dayNum === 5 || dayNum === 6;
                const isToday = i === 0;

                days.push(
                  <button
                    key={dateISO}
                    onClick={() => {
                      setSelectedTaskDate(dateISO);
                      setShowAddTask(true);
                    }}
                    disabled={isWeekend}
                    className={`
                      flex-shrink-0 w-14 py-2.5 px-1 rounded-xl text-center transition-all active:scale-95
                      ${isWeekend
                        ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : isToday
                          ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
                          : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <div className="text-[10px] opacity-70">{dayNames[dayNum]}</div>
                    <div className="font-bold text-base">{date.getDate()}</div>
                    {isToday && <div className="text-[9px] font-medium">היום</div>}
                  </button>
                );
              }
              return days;
            })()}
          </div>
        </motion.div>

        {/* כפתורי דוחות והגדרות */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-100 dark:border-gray-700/60 overflow-hidden"
        >
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 px-4 pt-4 pb-2 text-sm flex items-center gap-2">
            <span>📊</span> דוחות וכלים
          </h3>
          <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-gray-700/50">
            <button
              onClick={() => setShowDailySummary(true)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-lg">📊</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">סיכום יומי</span>
            </button>
            <button
              onClick={() => setShowTimeGaps(true)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-lg">📈</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">לאן הלך הזמן?</span>
            </button>
            <button
              onClick={() => setShowInterruptions(true)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-lg">⏸️</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">הפרעות</span>
            </button>
            <button
              onClick={() => setShowWeeklyReview(true)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-lg">📋</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">סקירה שבועית</span>
            </button>
            <button
              onClick={() => setShowClientTracker(true)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-lg">👥</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">לקוחות</span>
            </button>
            <button
              onClick={() => setShowPreferences(true)}
              className="flex flex-col items-center gap-1.5 py-3 px-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:scale-[0.98]"
            >
              <span className="text-lg">⚙️</span>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">העדפות</span>
            </button>
          </div>
        </motion.div>

        {/* 🤖 המלצות חכמות */}
        <SmartRecommendationsPanel 
          tasks={tasks}
          onUpdateTask={editTask}
          onRefresh={loadTasks}
        />
      </div>

      {/* מודלים */}
      <QuickAdd 
        isOpen={showQuickAdd} 
        onClose={() => setShowQuickAdd(false)}
        onAdded={loadTasks}
      />

      <Modal
        isOpen={showUrgent}
        onClose={() => setShowUrgent(false)}
        title="🚨 עבודה דחופה"
      >
        <UrgentReschedule
          onClose={() => setShowUrgent(false)}
          onRescheduled={loadTasks}
        />
      </Modal>

      <Modal
        isOpen={showWeeklyReview}
        onClose={() => setShowWeeklyReview(false)}
        title="📊 סקירה שבועית"
      >
        <WeeklyReview onClose={() => setShowWeeklyReview(false)} />
      </Modal>

      <Modal
        isOpen={showClientTracker}
        onClose={() => setShowClientTracker(false)}
        title="👥 מעקב לקוחות"
      >
        <ClientTracker onClose={() => setShowClientTracker(false)} />
      </Modal>

      <Modal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        title="⚙️ העדפות עבודה"
      >
        <WorkPreferences 
          onClose={() => setShowPreferences(false)}
          onSaved={loadTasks}
        />
      </Modal>

      {/* סיכום יומי */}
      <Modal
        isOpen={showDailySummary}
        onClose={() => setShowDailySummary(false)}
        title=""
      >
        <DailySummary 
          tasks={tasks}
          date={new Date()}
          onClose={() => setShowDailySummary(false)}
          onMoveTasks={async (tasksToMove, newDate) => {
            for (const task of tasksToMove) {
              await editTask(task.id, { ...task, dueDate: newDate });
            }
            loadTasks();
            setShowDailySummary(false);
          }}
        />
      </Modal>

      {/* דוח פערים */}
      <Modal
        isOpen={showTimeGaps}
        onClose={() => setShowTimeGaps(false)}
        title=""
      >
        <TimeGapsReport 
          tasks={tasks}
          onClose={() => setShowTimeGaps(false)}
        />
      </Modal>

      {/* ✅ ניתוח הפרעות */}
      <Modal
        isOpen={showInterruptions}
        onClose={() => setShowInterruptions(false)}
        title="⏸️ ניתוח הפרעות"
      >
        <InterruptionsTracker />
      </Modal>

      {/* ✅ חדש: מודל הוספת משימה */}
      <Modal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        title={`➕ הוסף משימה ${selectedTaskDate === today ? 'להיום' : `ל-${new Date(selectedTaskDate + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}`}`}
      >
        <SimpleTaskForm
          defaultDate={selectedTaskDate}
          onClose={() => {
            setShowAddTask(false);
            loadTasks();
          }}
        />
      </Modal>
    </div>
  );
}

export default Dashboard;
