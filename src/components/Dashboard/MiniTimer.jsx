/**
 * MiniTimer - טיימר קומפקטי לדשבורד
 * ===================================
 * מאפשר להתחיל/להפסיק עבודה ישירות מהדשבורד
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useFiveMinuteRule } from '../Learning/FiveMinuteRule';
import PreTaskCheckin from '../Learning/PreTaskCheckin'; // ✅ צ'ק-אין לפני משימה
import { logTimerStop } from '../Learning/EscapeWindowDetector'; // ✅ רישום עצירות
import toast from 'react-hot-toast';

const FOCUS_WORK_SECONDS = 45 * 60;
const FOCUS_BREAK_SECONDS = 5 * 60;
const DEFAULT_DAILY_BREAK_WARNING_THRESHOLD = 6;

/**
 * פורמט זמן MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * פורמט דקות לשעות/דקות
 */
function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * MiniTimer Component
 */
export default function MiniTimer({ task: taskProp, onComplete, onNavigateToTask }) {
  const { editTask } = useTasks();
  
  // 🆕 משימה מקומית שמתעדכנת
  const [localTask, setLocalTask] = useState(taskProp);
  
  // עדכון כשה-prop משתנה
  useEffect(() => {
    setLocalTask(taskProp);
  }, [taskProp?.id, taskProp?.time_spent]);
  
  // שימוש ב-task מקומי
  const task = localTask;
  
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [focusPhase, setFocusPhase] = useState('work'); // work | break
  const [completedFocusCycles, setCompletedFocusCycles] = useState(0);
  const [sessionWorkMinutes, setSessionWorkMinutes] = useState(0);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [breakCountToday, setBreakCountToday] = useState(0);
  const [warnedBreakCountToday, setWarnedBreakCountToday] = useState(false);
  const [dailyBreakWarningThreshold, setDailyBreakWarningThreshold] = useState(DEFAULT_DAILY_BREAK_WARNING_THRESHOLD);
  
  // ✅ כלל 5 הדקות
  const {
    isFiveMinuteMode,
    showContinueModal,
    startFiveMinuteMode,
    handleContinue: fiveMinuteContinue,
    handleStop: fiveMinuteStop,
    ContinueModal
  } = useFiveMinuteRule(task?.id, () => {
    // פונקציה שנקראת כשעוצרים אחרי 5 דקות
    stopTimerInternal();
  });
  
  // ✅ צ'ק-אין לפני משימה
  const [showCheckin, setShowCheckin] = useState(false);
  const [pendingStart, setPendingStart] = useState(null); // 'regular' או 'fiveMinute'
  
  // Refs
  const intervalRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  
  // מפתח localStorage
  const timerStorageKey = task ? `timer_v2_${task.id}` : null;
  const breakCountStorageKey = `zmanit_break_count_${getTodayISO()}`;
  
  // חישובים
  const timeSpent = task?.time_spent ? parseInt(task.time_spent) : 0;
  const estimated = task?.estimated_duration ? parseInt(task.estimated_duration) : 30;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  const remaining = Math.max(0, estimated - totalSpent);
  const progress = estimated > 0 ? Math.min(100, Math.round((totalSpent / estimated) * 100)) : 0;
  const isOverTime = totalSpent > estimated && estimated > 0;
  const phaseDuration = focusModeEnabled
    ? (focusPhase === 'work' ? FOCUS_WORK_SECONDS : FOCUS_BREAK_SECONDS)
    : null;
  const phaseRemaining = phaseDuration ? Math.max(0, phaseDuration - elapsedSeconds) : null;

  const saveElapsedToTask = useCallback(async () => {
    if (!task || elapsedSecondsRef.current < 60) return 0;

    const minutesToAdd = Math.floor(elapsedSecondsRef.current / 60);
    const newTimeSpent = (task.time_spent || 0) + minutesToAdd;

    try {
      await editTask(task.id, { time_spent: newTimeSpent });
      setLocalTask(prev => prev ? { ...prev, time_spent: newTimeSpent } : null);
      setElapsedSeconds(elapsedSecondsRef.current % 60);
      return minutesToAdd;
    } catch (e) {
      return 0;
    }
  }, [task, editTask]);

  useEffect(() => {
    try {
      const focusSettings = JSON.parse(localStorage.getItem('zmanit_focus_settings') || '{}');
      const configuredThreshold = parseInt(focusSettings.maxDailyBreaks, 10);
      if (!Number.isNaN(configuredThreshold) && configuredThreshold > 0) {
        setDailyBreakWarningThreshold(configuredThreshold);
      } else {
        setDailyBreakWarningThreshold(DEFAULT_DAILY_BREAK_WARNING_THRESHOLD);
      }
    } catch {
      setDailyBreakWarningThreshold(DEFAULT_DAILY_BREAK_WARNING_THRESHOLD);
    }
  }, []);

  useEffect(() => {
    try {
      const savedBreaks = parseInt(localStorage.getItem(breakCountStorageKey) || '0', 10);
      setBreakCountToday(Number.isNaN(savedBreaks) ? 0 : savedBreaks);
    } catch {
      setBreakCountToday(0);
    }
    setWarnedBreakCountToday(false);
  }, [breakCountStorageKey]);
  
  // ===== טעינה מ-localStorage =====
  useEffect(() => {
    if (!timerStorageKey) return;
    
    try {
      const saved = localStorage.getItem(timerStorageKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.isRunning && !data.isInterrupted) {
          // חישוב זמן שעבר מאז השמירה
          const savedTime = new Date(data.startTime);
          const elapsed = Math.floor((Date.now() - savedTime.getTime()) / 1000);
          setElapsedSeconds(data.elapsedSeconds + elapsed);
          setStartTime(savedTime);
          setIsRunning(true);
          setIsPaused(false);
          // 🆕 שמירת מצב טיימר גם בשחזור
          if (task?.id) {
            localStorage.setItem('zmanit_active_timer', task.id);
            console.log('🔄 MiniTimer שוחזר - נשמר:', task.id);
          }
        } else if (data.isPaused) {
          setElapsedSeconds(data.elapsedSeconds);
          setIsPaused(true);
          setIsRunning(false);
        }
      }
    } catch (e) {
      console.error('Error loading timer state:', e);
    }
  }, [timerStorageKey]);
  
  // ===== שמירה ב-localStorage =====
  useEffect(() => {
    if (!timerStorageKey) return;
    
    const data = {
      isRunning,
      isPaused,
      isInterrupted: false,
      elapsedSeconds,
      startTime: startTime?.toISOString(),
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem(timerStorageKey, JSON.stringify(data));
  }, [isRunning, isPaused, elapsedSeconds, timerStorageKey, startTime]);
  
  // ===== טיימר =====
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);
  
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused]);
  
  // 🆕 שמירת מצב טיימר פעיל לAutoFocusManager
  useEffect(() => {
    if (isRunning && task?.id) {
      localStorage.setItem('zmanit_active_timer', task.id);
      console.log('🟢 MiniTimer useEffect - נשמר:', task.id);
    } else if (!isRunning && !isPaused) {
      // 🔧 תיקון: בדיקה אם יש טיימר רץ על משימה אחרת לפני מחיקה
      const currentActiveTimer = localStorage.getItem('zmanit_active_timer');
      if (currentActiveTimer && currentActiveTimer !== task?.id) {
        // יש טיימר על משימה אחרת - לא מוחקים
        const activeTimerData = localStorage.getItem(`timer_v2_${currentActiveTimer}`);
        if (activeTimerData) {
          try {
            const data = JSON.parse(activeTimerData);
            if (data.isRunning && data.startTime) {
              console.log('⏳ MiniTimer: יש טיימר אחר שרץ - לא מוחקים');
              return;
            }
          } catch (e) {}
        }
      }
      // רק אם הטיימר הנוכחי הוא שלנו ואנחנו לא רצים - מוחקים
      const current = localStorage.getItem('zmanit_active_timer');
      if (current === task?.id) {
        localStorage.removeItem('zmanit_active_timer');
        console.log('🔴 MiniTimer useEffect - נמחק');
      }
    }
  }, [isRunning, isPaused, task?.id]);
  
  // ===== פעולות =====
  const startTimer = useCallback(() => {
    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    // 🆕 שמירת מצב טיימר פעיל
    if (task?.id) {
      localStorage.setItem('zmanit_active_timer', task.id);
      console.log('🟢 MiniTimer התחיל - נשמר:', task.id);
    }
    toast.success('▶️ התחלנו לעבוד!', { duration: 2000 });
  }, [task?.id]);
  
  const pauseTimer = useCallback(async () => {
    setIsRunning(false);
    setIsPaused(true);
    // 🆕 מחיקת מצב טיימר (מושהה = לא עובדים)
    localStorage.removeItem('zmanit_active_timer');
    console.log('🟡 MiniTimer מושהה - נמחק');
    
    // שמירת הזמן
    if (elapsedSecondsRef.current >= 60 && task) {
      const minutesToAdd = await saveElapsedToTask();
      if (minutesToAdd > 0) {
        toast.success(`⏸️ ${minutesToAdd} דקות נשמרו`, { duration: 2000 });
      } else {
        toast.error('שגיאה בשמירה');
      }
    } else {
      toast('⏸️ מושהה', { duration: 1500 });
    }
  }, [task, saveElapsedToTask]);
  
  const resumeTimer = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    // 🆕 שמירת מצב טיימר כשממשיכים
    if (task?.id) {
      localStorage.setItem('zmanit_active_timer', task.id);
      console.log('🟢 MiniTimer ממשיך - נשמר:', task.id);
    }
    toast.success('▶️ ממשיכים!', { duration: 1500 });
  }, [task?.id]);
  
  // ✅ פונקציה פנימית לעצירה (נקראת גם מ-5 דקות)
  const stopTimerInternal = useCallback(async (completed = false) => {
    // 🆕 מחיקת מצב טיימר
    localStorage.removeItem('zmanit_active_timer');
    console.log('🔴 MiniTimer נעצר - נמחק');
    
    // ✅ רישום עצירה באמצע ל-EscapeWindowDetector
    if (!completed && task && elapsedSecondsRef.current >= 60) {
      logTimerStop(
        task.id,
        task.title,
        task.task_type,
        Math.floor(elapsedSecondsRef.current / 60),
        task.estimated_duration || 30,
        false
      );
    }
    
    // שמירת הזמן לפני עצירה
    if (elapsedSecondsRef.current >= 60 && task) {
      const minutesToAdd = await saveElapsedToTask();
      if (minutesToAdd > 0) {
        toast.success(`⏹️ ${minutesToAdd} דקות נשמרו`, { duration: 2000 });
      }
    }
    
    // איפוס
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTime(null);
    
    if (timerStorageKey) {
      localStorage.removeItem(timerStorageKey);
    }
    if (focusModeEnabled && (sessionWorkMinutes > 0 || completedFocusCycles > 0)) {
      setShowSessionSummary(true);
    }
  }, [task, timerStorageKey, focusModeEnabled, sessionWorkMinutes, completedFocusCycles, saveElapsedToTask]);
  
  // עצירה רגילה
  const stopTimer = stopTimerInternal;
  
  const completeTask = useCallback(async () => {
    await stopTimerInternal(true); // ✅ מסמן שהושלם
    
    if (task && onComplete) {
      onComplete(task);
    }
  }, [task, onComplete, stopTimerInternal]);

  const nextStepText = remaining > 0
    ? `נשארו בערך ${formatMinutes(remaining)} למשימה הזו.`
    : 'אפשר לעבור למשימה הבאה מהדשבורד.';

  useEffect(() => {
    if (!focusModeEnabled || !isRunning || isPaused || !phaseDuration) return;
    if (elapsedSeconds < phaseDuration) return;

    const handlePhaseTransition = async () => {
      if (focusPhase === 'work') {
        const saved = await saveElapsedToTask();
        setSessionWorkMinutes(prev => prev + (saved || 45));
        setCompletedFocusCycles(prev => prev + 1);
        const updatedBreakCount = breakCountToday + 1;
        setBreakCountToday(updatedBreakCount);
        localStorage.setItem(breakCountStorageKey, String(updatedBreakCount));
        if (updatedBreakCount >= dailyBreakWarningThreshold && !warnedBreakCountToday) {
          toast.error('שימי לב: יש הרבה הפסקות היום. כדאי לחזור לפוקוס רציף.', { duration: 4500 });
          setWarnedBreakCountToday(true);
        }
        setIsRunning(false);
        setElapsedSeconds(0);
        setFocusPhase('break');
        localStorage.removeItem('zmanit_active_timer');
        toast('🧘 זמן הפסקה! 5 דקות', { icon: '☕', duration: 3500 });
      } else {
        setIsRunning(false);
        setElapsedSeconds(0);
        setFocusPhase('work');
        toast('🎯 חוזרים לפוקוס 45 דקות', { icon: '🚀', duration: 3000 });
      }
    };

    handlePhaseTransition();
  }, [
    focusModeEnabled,
    isRunning,
    isPaused,
    elapsedSeconds,
    phaseDuration,
    focusPhase,
    saveElapsedToTask,
    breakCountToday,
    breakCountStorageKey,
    warnedBreakCountToday,
    dailyBreakWarningThreshold
  ]);
  
  // ===== אין משימה =====
  if (!task) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 text-center">
        <span className="text-4xl block mb-2">☕</span>
        <div className="text-gray-500 dark:text-gray-400">
          אין משימות להיום
        </div>
        <AnimatePresence>
          {showSessionSummary && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="mt-4 text-right bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800"
            >
              <div className="font-bold text-gray-900 dark:text-white mb-1">סיכום סשן פוקוס</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">מחזורים: {completedFocusCycles} | דקות פוקוס: {sessionWorkMinutes}</div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{nextStepText}</div>
              <button
                onClick={() => {
                  setShowSessionSummary(false);
                  setSessionWorkMinutes(0);
                  setCompletedFocusCycles(0);
                }}
                className="mt-3 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
              >
                מעולה, הבנתי
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  
  // ===== טיימר לא פעיל =====
  if (!isRunning && !isPaused) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl p-5 border-2 border-blue-300 dark:border-blue-700 shadow-lg"
      >
        {/* כותרת */}
        <div className="text-center mb-4">
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
            🎯 המשימה הבאה
          </div>
        </div>
        
        {/* פרטי משימה */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4">
          <div className="font-bold text-gray-900 dark:text-white text-lg">
            {task.title}
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span>⏱️ {formatMinutes(estimated)}</span>
            {task.due_time && <span>🕐 {task.due_time}</span>}
            {timeSpent > 0 && <span className="text-green-600">✓ {formatMinutes(timeSpent)} הושקעו</span>}
          </div>
        </div>
        
        {/* כפתורי התחלה */}
        <div className="space-y-2">
          {/* כפתור התחל רגיל */}
          <button
            onClick={() => {
              // הצג צ'ק-אין למשימות של 30+ דקות
              if (estimated >= 30) {
                setPendingStart('regular');
                setShowCheckin(true);
              } else {
                startTimer();
              }
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <span className="text-2xl">▶️</span>
            <span>התחל לעבוד!</span>
          </button>

          <button
            onClick={() => {
              setFocusModeEnabled(prev => !prev);
              setFocusPhase('work');
              setCompletedFocusCycles(0);
              setSessionWorkMinutes(0);
            }}
            className={`w-full py-3 rounded-xl text-white font-medium shadow-md transition-all flex items-center justify-center gap-2 ${
              focusModeEnabled
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                : 'bg-gradient-to-r from-slate-500 to-gray-600 hover:from-slate-600 hover:to-gray-700'
            }`}
          >
            <span>🎯</span>
            <span>{focusModeEnabled ? 'מצב פוקוס 45/5 פעיל' : 'הפעל מצב פוקוס 45/5'}</span>
          </button>
          
          {/* ✅ כפתור 5 דקות - להתחלה קלה */}
          <button
            onClick={() => {
              // 5 דקות = התחלה מהירה, בלי צ'ק-אין
              startFiveMinuteMode();
              startTimer();
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>5️⃣</span>
            <span>רק 5 דקות! (כלל ההתחלה הקלה)</span>
          </button>
        </div>
        
        {/* ✅ מודל "רוצה להמשיך?" */}
        <ContinueModal taskTitle={task.title} />
        
        {/* ✅ מודל צ'ק-אין לפני משימה */}
        <PreTaskCheckin
          isOpen={showCheckin}
          onClose={() => {
            setShowCheckin(false);
            setPendingStart(null);
          }}
          onStart={() => {
            setShowCheckin(false);
            if (pendingStart === 'fiveMinute') {
              startFiveMinuteMode();
            }
            startTimer();
            setPendingStart(null);
          }}
          taskTitle={task.title}
          taskDuration={estimated}
        />
        <AnimatePresence>
          {showSessionSummary && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="mt-4 text-right bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800"
            >
              <div className="font-bold text-gray-900 dark:text-white mb-1">סיכום סשן פוקוס</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">מחזורים: {completedFocusCycles} | דקות פוקוס: {sessionWorkMinutes}</div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{nextStepText}</div>
              <button
                onClick={() => {
                  setShowSessionSummary(false);
                  setSessionWorkMinutes(0);
                  setCompletedFocusCycles(0);
                }}
                className="mt-3 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
              >
                מעולה, הבנתי
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
  
  // ===== טיימר פעיל =====
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl p-4 border ${
        isOverTime 
          ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 border-red-200 dark:border-red-800'
          : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800'
      }`}
    >
      {/* כותרת + זמן */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className={`text-xs mb-1 ${isOverTime ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {isPaused ? '⏸️ מושהה' : (focusModeEnabled ? (focusPhase === 'work' ? '🔴 פוקוס 45' : '☕ הפסקה 5') : '🔴 עובד עכשיו')}
          </div>
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {task.title}
          </div>
        </div>
        
        {/* שעון */}
        <div className="text-left mr-3">
          <div className={`text-2xl font-mono font-bold ${
            isOverTime ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}>
            {formatTime(elapsedSeconds)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {focusModeEnabled && phaseRemaining !== null
              ? `נותרו ${formatTime(phaseRemaining)} לשלב`
              : (isOverTime ? `+${formatMinutes(totalSpent - estimated)} חריגה` : `${formatMinutes(remaining)} נותרו`)}
          </div>
        </div>
      </div>
      
      {/* סרגל התקדמות */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          className={`h-full ${isOverTime ? 'bg-red-500' : 'bg-green-500'}`}
        />
      </div>
      
      {/* כפתורים */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {/* Play/Pause */}
          {isPaused ? (
            <button
              onClick={resumeTimer}
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
            >
              ▶️ המשך
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium transition-colors"
            >
              ⏸️ השהה
            </button>
          )}
          
          {/* Stop */}
          <button
            onClick={stopTimer}
            className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm transition-colors"
          >
            ⏹️
          </button>
        </div>
        
        {/* סיום משימה */}
        <button
          onClick={completeTask}
          className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
        >
          ✅ סיימתי
        </button>
      </div>

      {focusModeEnabled && (
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-gray-800/50 rounded-lg p-2">
          מחזורים הושלמו: <b>{completedFocusCycles}</b> | דקות פוקוס בסשן: <b>{sessionWorkMinutes}</b> | הפסקות היום: <b>{breakCountToday}</b>
        </div>
      )}
      
      {/* קישור למשימה המלאה */}
      {onNavigateToTask && (
        <button
          onClick={() => onNavigateToTask(task)}
          className="w-full mt-3 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          לפרטים מלאים →
        </button>
      )}
      <AnimatePresence>
        {showSessionSummary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mt-4 text-right bg-white dark:bg-gray-800 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800"
          >
            <div className="font-bold text-gray-900 dark:text-white mb-1">סיכום סשן פוקוס</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">מחזורים: {completedFocusCycles} | דקות פוקוס: {sessionWorkMinutes}</div>
            <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{nextStepText}</div>
            <button
              onClick={() => {
                setShowSessionSummary(false);
                setSessionWorkMinutes(0);
                setCompletedFocusCycles(0);
              }}
              className="mt-3 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium"
            >
              מעולה, הבנתי
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
