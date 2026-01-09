/**
 * MiniTimer - טיימר קומפקטי לדשבורד
 * ===================================
 * מאפשר להתחיל/להפסיק עבודה ישירות מהדשבורד
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';

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

/**
 * MiniTimer Component
 */
export default function MiniTimer({ task, onComplete, onNavigateToTask }) {
  const { editTask, updateTaskTime } = useTasks();
  
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  
  // Refs
  const intervalRef = useRef(null);
  const elapsedSecondsRef = useRef(0);
  
  // מפתח localStorage
  const timerStorageKey = task ? `timer_v2_${task.id}` : null;
  
  // חישובים
  const timeSpent = task?.time_spent ? parseInt(task.time_spent) : 0;
  const estimated = task?.estimated_duration ? parseInt(task.estimated_duration) : 30;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  const remaining = Math.max(0, estimated - totalSpent);
  const progress = estimated > 0 ? Math.min(100, Math.round((totalSpent / estimated) * 100)) : 0;
  const isOverTime = totalSpent > estimated && estimated > 0;
  
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
  
  // ===== פעולות =====
  const startTimer = useCallback(() => {
    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    toast.success('▶️ התחלנו לעבוד!', { duration: 2000 });
  }, []);
  
  const pauseTimer = useCallback(async () => {
    setIsRunning(false);
    setIsPaused(true);
    
    // שמירת הזמן
    if (elapsedSecondsRef.current >= 60 && task) {
      const minutesToAdd = Math.floor(elapsedSecondsRef.current / 60);
      const newTimeSpent = (task.time_spent || 0) + minutesToAdd;
      
      try {
        await editTask(task.id, { time_spent: newTimeSpent });
        toast.success(`⏸️ ${minutesToAdd} דקות נשמרו`, { duration: 2000 });
        setElapsedSeconds(elapsedSecondsRef.current % 60); // שמירת השאריות
      } catch (e) {
        toast.error('שגיאה בשמירה');
      }
    } else {
      toast('⏸️ מושהה', { duration: 1500 });
    }
  }, [task, editTask]);
  
  const resumeTimer = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
    toast.success('▶️ ממשיכים!', { duration: 1500 });
  }, []);
  
  const stopTimer = useCallback(async () => {
    // שמירת הזמן לפני עצירה
    if (elapsedSecondsRef.current >= 60 && task) {
      const minutesToAdd = Math.floor(elapsedSecondsRef.current / 60);
      const newTimeSpent = (task.time_spent || 0) + minutesToAdd;
      
      try {
        await editTask(task.id, { time_spent: newTimeSpent });
        toast.success(`⏹️ ${minutesToAdd} דקות נשמרו`, { duration: 2000 });
      } catch (e) {
        // ignore
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
  }, [task, editTask, timerStorageKey]);
  
  const completeTask = useCallback(async () => {
    await stopTimer();
    
    if (task && onComplete) {
      onComplete(task);
    }
  }, [task, onComplete, stopTimer]);
  
  // ===== אין משימה =====
  if (!task) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 text-center">
        <div className="text-gray-400 dark:text-gray-500 text-sm">
          אין משימות מתוכננות
        </div>
      </div>
    );
  }
  
  // ===== טיימר לא פעיל =====
  if (!isRunning && !isPaused) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">מוכנים להתחיל?</div>
            <div className="font-medium text-gray-900 dark:text-white truncate">
              {task.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatMinutes(estimated)} מתוכנן
              {timeSpent > 0 && ` • ${formatMinutes(timeSpent)} הושקעו`}
            </div>
          </div>
          
          <button
            onClick={startTimer}
            className="mr-3 w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            <span className="text-2xl">▶️</span>
          </button>
        </div>
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
            {isPaused ? '⏸️ מושהה' : '🔴 עובד עכשיו'}
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
            {isOverTime ? `+${formatMinutes(totalSpent - estimated)} חריגה` : `${formatMinutes(remaining)} נותרו`}
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
      
      {/* קישור למשימה המלאה */}
      {onNavigateToTask && (
        <button
          onClick={() => onNavigateToTask(task)}
          className="w-full mt-3 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          לפרטים מלאים →
        </button>
      )}
    </motion.div>
  );
}
